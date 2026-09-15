import React, { forwardRef, useEffect, useImperativeHandle, useMemo, useRef, useState } from "react";
import { View, StyleSheet, ActivityIndicator } from "react-native";
import { WebView } from "react-native-webview";
import { colors } from "../theme/colors";
import { CHARACTER_OPTIONS } from "../assets/avatar3dParts";

/**
 * Visor del avatar 3D "de verdad": WebView + three.js (0.160.0, ES modules
 * vía CDN + importmap). A propósito NO usa expo-gl/@react-three/fiber --
 * esta app corre en arquitectura legacy de RN (newArchEnabled:false) y ya
 * nos topamos este mismo mes con que una librería de renderizado nativo (el
 * widget de Android) requería New Architecture y tronaba la app. WebView es
 * un módulo maduro, estable en legacy architecture, y adentro corre un
 * documento HTML normal -- cero riesgo de esa clase.
 *
 * v2: el personaje ya NO es geometría generada por código (primitivas de
 * three.js) -- se veía "gordo"/artificial sin importar cuánto se ajustara.
 * Ahora carga un modelo .glb real (Kenney "Mini Characters", CC0) elegido
 * entre 12 variantes vía GLTFLoader -- ver avatar3dParts.js. El accesorio
 * (lentes/gorra) se sigue armando con geometría simple, pero ahora se
 * posiciona midiendo la cabeza REAL del modelo cargado (bounding box del
 * mesh "head-mesh"), no con coordenadas fijas a mano.
 *
 * Uso:
 *   const ref = useRef(null);
 *   <Avatar3DViewer ref={ref} parts={{character, accessory}} interactive size={260} />
 *   ref.current.capture().then((dataUrl) => ...) // pide un snapshot PNG
 */
const Avatar3DViewer = forwardRef(function Avatar3DViewer(
  { parts, interactive = false, size = 200, onReady },
  ref
) {
  const webRef = useRef(null);
  const [loaded, setLoaded] = useState(false);
  const captureResolvers = useRef([]);

  useImperativeHandle(ref, () => ({
    capture: () =>
      new Promise((resolve) => {
        captureResolvers.current.push(resolve);
        webRef.current?.injectJavaScript("window.__captureSnapshot && window.__captureSnapshot(); true;");
      }),
  }));

  // Se re-envían las partes actuales cada vez que cambian -- la escena en
  // sí se crea UNA sola vez (ver html abajo, no depende de `parts`), así
  // que esto solo actualiza el modelo/accesorio visible, sin recargar el
  // WebView completo (evita el parpadeo/costo de reconstruir la página).
  // La URL del .glb se resuelve ACÁ (contra el catálogo del cliente) y se
  // manda ya resuelta -- el HTML embebido no necesita su propia tabla de
  // ids -> archivo.
  useEffect(() => {
    if (!loaded) return;
    const character = CHARACTER_OPTIONS.find((c) => c.id === parts?.character);
    const payload = JSON.stringify({
      characterUrl: character ? character.glb : null,
      accessory: parts?.accessory || null,
    });
    webRef.current?.injectJavaScript(`window.__updateAvatar && window.__updateAvatar(${payload}); true;`);
  }, [parts?.character, parts?.accessory, loaded]);

  const html = useMemo(() => buildHtml(interactive), [interactive]);

  const onMessage = (e) => {
    let msg;
    try {
      msg = JSON.parse(e.nativeEvent.data);
    } catch {
      return;
    }
    if (msg.type === "ready") {
      setLoaded(true);
      onReady?.();
    } else if (msg.type === "snapshot") {
      const resolvers = captureResolvers.current.splice(0, captureResolvers.current.length);
      resolvers.forEach((r) => r(msg.dataUrl));
    } else if (msg.type === "error") {
      console.log("❌ Avatar3DViewer JS error:", msg.message);
    } else if (msg.type === "debug") {
      console.log("🔍 Avatar3DViewer debug:", msg.message);
    }
  };

  return (
    <View style={[styles.wrap, { width: size, height: size }]}>
      {!loaded && (
        <View style={styles.loading}>
          <ActivityIndicator color={colors.primary} />
        </View>
      )}
      <WebView
        ref={webRef}
        originWhitelist={["*"]}
        source={{ html }}
        onMessage={onMessage}
        style={styles.webview}
        javaScriptEnabled
        domStorageEnabled
        scrollEnabled={false}
        // El scroll/orbit del avatar es a base de gestos dentro del canvas;
        // no queremos que el WebView intente hacer su propio scroll de página.
        bounces={false}
        androidLayerType="hardware"
      />
    </View>
  );
});

export default Avatar3DViewer;

function buildHtml(interactive) {
  return `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no" />
<style>
  html, body { margin:0; padding:0; overflow:hidden; background:transparent; touch-action:none; }
  #stage { width:100vw; height:100vh; }
</style>
</head>
<body>
<div id="stage"></div>
<script type="importmap">
{ "imports": {
    "three": "https://cdn.jsdelivr.net/npm/three@0.160.0/build/three.module.js",
    "three/addons/": "https://cdn.jsdelivr.net/npm/three@0.160.0/examples/jsm/"
} }
</script>
<script type="module">
import * as THREE from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";

var INTERACTIVE = ${interactive ? "true" : "false"};
var post = function (obj) {
  if (window.ReactNativeWebView) window.ReactNativeWebView.postMessage(JSON.stringify(obj));
};
window.onerror = function (msg) { post({ type: "error", message: String(msg) }); };

var scene = new THREE.Scene();
var camera = new THREE.PerspectiveCamera(32, 1, 0.1, 100);
// El modelo Kenney mide ~0.67 unidades de alto tal cual viene del archivo
// -- se escala x MODEL_SCALE para llenar el encuadre parecido a como lo
// hacía la geometría procedural anterior (personaje de ~2.7 unidades).
var MODEL_SCALE = 4;
camera.position.set(0, 1.35, 5.6);
camera.lookAt(0, 1.3, 0);

var renderer;
try {
  renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, preserveDrawingBuffer: true });
} catch (e) {
  post({ type: "error", message: "WebGLRenderer falló: " + e.message });
  throw e;
}
if (!renderer.getContext()) {
  post({ type: "error", message: "WebGL no disponible en este WebView" });
}
renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
document.getElementById("stage").appendChild(renderer.domElement);

var hemi = new THREE.HemisphereLight(0xfff3e0, 0x3a1410, 1.0);
scene.add(hemi);
var key = new THREE.DirectionalLight(0xffffff, 0.9);
key.position.set(2, 3, 2);
scene.add(key);
var rim = new THREE.DirectionalLight(0xffd9a0, 0.4);
rim.position.set(-2, 1, -2);
scene.add(rim);

var rig = new THREE.Group(); // rota completo con el arrastre
scene.add(rig);
var avatarGroup = new THREE.Group();
rig.add(avatarGroup);

var loader = new GLTFLoader();
var gltfCache = {}; // url -> gltf ya cargado, para no re-descargar al volver a elegir el mismo personaje
var currentModel = null;
var currentAccessory = null;
var currentHeadInfo = null; // medición de la cabeza tomada UNA vez al cargar, ver nota en loadAndSwapCharacter
var mixer = null;
var clock = new THREE.Clock();
var current = { characterUrl: null, accessory: null };

function loadCharacter(url) {
  return new Promise(function (resolve, reject) {
    if (gltfCache[url]) { resolve(gltfCache[url]); return; }
    loader.load(url, function (gltf) { gltfCache[url] = gltf; resolve(gltf); }, undefined, reject);
  });
}

// Mide el mesh de la cabeza REAL del modelo cargado (bounding box en
// coordenadas de mundo) -- así el accesorio se posiciona en proporción al
// personaje que sea, sin depender de coordenadas fijas a mano por modelo.
function measureHead(obj) {
  var headMesh = null;
  obj.traverse(function (c) { if (c.isMesh && /head/i.test(c.name || "")) headMesh = c; });
  if (!headMesh) return null;
  var box = new THREE.Box3().setFromObject(headMesh);
  var size = new THREE.Vector3(); box.getSize(size);
  var center = new THREE.Vector3(); box.getCenter(center);
  // Convertido a coordenadas LOCALES de avatarGroup (el padre de obj), no
  // de mundo -- rig gira en Y, así que "mundo" cambia con la rotación.
  var localCenter = avatarGroup.worldToLocal(center.clone());
  return { center: localCenter, size: size };
}

function buildAccessory(id, head) {
  if (!id || !head) return null;
  var g = new THREE.Group();
  var r = Math.max(head.size.x, head.size.z) / 2; // radio aproximado de la cabeza
  var cx = head.center.x, cy = head.center.y, cz = head.center.z;
  var frontZ = cz + head.size.z / 2;

  if (id === "acc3d_01") { // lentes
    var frameMat = new THREE.MeshStandardMaterial({ color: "#1c1c1c", roughness: 0.4 });
    var glassMat = new THREE.MeshStandardMaterial({
      color: "#bcd9e8", roughness: 0.15, metalness: 0.1, transparent: true, opacity: 0.35,
    });
    // v2: con la medición de cabeza real (antes rota, ver nota en
    // loadAndSwapCharacter) estos multiplicadores contra el radio de
    // cabeza quedaron gigantes -- se achican para que los lentes cubran
    // solo el área de los ojos, no media cara.
    var lensR = r * 0.17;
    var lensGeo = new THREE.TorusGeometry(lensR, lensR * 0.18, 8, 16);
    var glassGeo = new THREE.CircleGeometry(lensR * 0.95, 16);
    [-1, 1].forEach(function (side) {
      var lx = cx + r * 0.2 * side;
      var frame = new THREE.Mesh(lensGeo, frameMat);
      frame.position.set(lx, cy, frontZ * 0.94);
      g.add(frame);
      var glass = new THREE.Mesh(glassGeo, glassMat);
      glass.position.set(lx, cy, frontZ * 0.935);
      g.add(glass);
    });
    var bridge = new THREE.Mesh(new THREE.CylinderGeometry(lensR * 0.15, lensR * 0.15, r * 0.18, 6), frameMat);
    bridge.position.set(cx, cy, frontZ * 0.94); bridge.rotation.z = Math.PI / 2; g.add(bridge);
    [-1, 1].forEach(function (side) {
      var temple = new THREE.Mesh(new THREE.CylinderGeometry(lensR * 0.12, lensR * 0.12, r * 0.4, 6), frameMat);
      temple.position.set(cx + r * 0.38 * side, cy, frontZ * 0.65);
      temple.rotation.y = side * 0.55;
      g.add(temple);
    });
  } else if (id === "acc3d_02") { // gorra
    // El domo es un casquete parcial de esfera -- se ASIENTA un poco
    // adentro de la parte de arriba de la cabeza (como una gorra real,
    // que no flota) en vez de apoyar el borde justo en headTop (eso la
    // dejaba casi sin margen contra el borde de cámara y se recortaba).
    var capMat = new THREE.MeshStandardMaterial({ color: "#7a1e3a", roughness: 0.6 });
    var domeR = r * 0.95;
    var headTop = cy + head.size.y / 2;
    var domeY = headTop - domeR * 0.15;
    var dome = new THREE.Mesh(new THREE.SphereGeometry(domeR, 18, 14, 0, Math.PI * 2, 0, Math.PI * 0.55), capMat);
    dome.position.set(cx, domeY, cz);
    g.add(dome);
    // Visera: a la altura del aro del domo, saliendo hacia el frente de
    // la cabeza (frontZ, ya calculado como el borde de adelante real de
    // la cabeza) en vez de una fracción arbitraria que la dejaba flotando
    // por debajo de la barbilla.
    var brim = new THREE.Mesh(new THREE.CylinderGeometry(domeR * 0.6, domeR * 0.6, domeR * 0.09, 20), capMat);
    brim.position.set(cx, headTop - domeR * 0.08, frontZ + domeR * 0.25);
    brim.rotation.x = -0.12; // leve inclinación hacia abajo, como visera de verdad
    brim.scale.set(1, 1, 0.7);
    g.add(brim);
    var button = new THREE.Mesh(new THREE.SphereGeometry(domeR * 0.07, 8, 8), capMat);
    button.position.set(cx, domeY + domeR, cz);
    g.add(button);
  }
  return g;
}

function clearCurrent() {
  if (currentModel) { avatarGroup.remove(currentModel); currentModel = null; }
  if (currentAccessory) { avatarGroup.remove(currentAccessory); currentAccessory = null; }
  currentHeadInfo = null;
  mixer = null;
}

function applyAccessory(id, headInfo) {
  if (currentAccessory) { avatarGroup.remove(currentAccessory); currentAccessory = null; }
  var acc = buildAccessory(id, headInfo);
  if (acc) { avatarGroup.add(acc); currentAccessory = acc; }
}

function loadAndSwapCharacter(url) {
  if (!url) { clearCurrent(); return; }
  loadCharacter(url).then(function (gltf) {
    if (current.characterUrl !== url) return; // el usuario ya cambió de nuevo mientras cargaba
    clearCurrent();
    // OJO: gltf.scene.clone(true) (Object3D.clone normal) ROMPE modelos con
    // esqueleto/rig -- el SkinnedMesh clonado se queda apuntando al
    // esqueleto VIEJO (bind matrices mal remapeadas), lo que se ve como
    // geometría gigante/deformada en vez del personaje. Como acá solo hay
    // UN personaje visible a la vez por visor, no hace falta clonar en
    // absoluto -- se reusa directo el mismo objeto cacheado (quitar/volver
    // a agregar a la escena es válido en three.js).
    var obj = gltf.scene;
    if (obj.parent) obj.parent.remove(obj);
    obj.scale.setScalar(MODEL_SCALE);
    avatarGroup.add(obj);
    // Box3.setFromObject() (usado en measureHead) lee matrixWorld -- que
    // recién se recalcula durante el render(). Como esto corre ANTES del
    // próximo frame, sin este update() de más measureHead mide con el
    // matrixWorld VIEJO (de cuando three.js armó el modelo, antes de nuestro
    // scale x4), dando una cabeza ~4x más chica y mal centrada -- se
    // confirmó con un marcador de depuración que aparecía a la altura de
    // los pies en vez de la cabeza.
    obj.updateMatrixWorld(true);
    currentModel = obj;

    // La medición de la cabeza se toma AHORA, en la pose de reposo (recién
    // agregado, antes de que el loop de animación corra ni un frame) y se
    // GUARDA -- no se vuelve a medir en vivo más tarde. Se comprobó con
    // captura que re-medir después de que el mixer llevaba rato corriendo
    // devolvía una bounding box ~5x más grande (Box3.setFromObject no lleva
    // bien la deformación de un SkinnedMesh en animación), lo que inflaba
    // los lentes/la gorra hasta tapar toda la pantalla.
    currentHeadInfo = measureHead(obj);

    // Pose "idle" en loop (en vez de una T-pose fija) -- confirmado con
    // captura que el frame 0 de "idle" es una pose de pie natural, brazos
    // a los costados, y en loop le da al avatar un poco de vida (respira).
    if (gltf.animations && gltf.animations.length) {
      var clip = gltf.animations.find(function (a) { return a.name === "idle"; }) || gltf.animations[0];
      mixer = new THREE.AnimationMixer(obj);
      var action = mixer.clipAction(clip);
      action.setLoop(THREE.LoopRepeat, Infinity);
      action.play();
      mixer.update(0);
    }

    applyAccessory(current.accessory, currentHeadInfo);
    post({ type: "modelLoaded" });
  }).catch(function (err) {
    post({ type: "error", message: "GLB load falló: " + (err && err.message ? err.message : String(err)) });
  });
}

window.__updateAvatar = function (next) {
  var prevUrl = current.characterUrl;
  current = next || { characterUrl: null, accessory: null };
  if (current.characterUrl !== prevUrl) {
    loadAndSwapCharacter(current.characterUrl);
  } else if (currentModel) {
    applyAccessory(current.accessory, currentHeadInfo);
  }
};
window.__captureSnapshot = function () {
  renderer.render(scene, camera);
  var dataUrl = renderer.domElement.toDataURL("image/png");
  post({ type: "snapshot", dataUrl: dataUrl });
};

function resize() {
  var stage = document.getElementById("stage");
  var w = stage.clientWidth || window.innerWidth;
  var h = stage.clientHeight || window.innerHeight;
  if (!w || !h) return; // el WebView todavía no terminó su layout -- nada que medir aún
  camera.aspect = w / h;
  camera.updateProjectionMatrix();
  // ⚠️ El 3er argumento (updateStyle) en true deja que three.js iguale el
  // estilo CSS del canvas al tamaño real del buffer -- sin esto el canvas
  // se queda con un tamaño default/heredado distinto, dando un encuadre
  // recortado/deformado.
  renderer.setSize(w, h, true);
}
window.addEventListener("resize", resize);
// El primer resize() puede correr ANTES de que el WebView termine de
// acomodar su viewport -- innerWidth/innerHeight (o el tamaño de #stage)
// pueden venir en 0 todavía, dejando el canvas sin tamaño y la escena
// invisible aunque todo lo demás cargó bien. Se reintenta unas cuantas
// veces con requestAnimationFrame hasta que el tamaño ya no sea cero, y
// también al evento "load" por si acaso.
resize();
var resizeAttempts = 0;
(function ensureSized() {
  if (renderer.domElement.width > 0 || resizeAttempts > 30) return;
  resizeAttempts++;
  resize();
  requestAnimationFrame(ensureSized);
})();
window.addEventListener("load", resize);

// Rotación con el dedo (orbit simple, sin librerías extra) -- solo si
// interactive=true. La vista chica (no interactiva) se queda quieta salvo
// el auto-giro lento de ambiente.
var dragging = false, lastX = 0, rotY = 0.35, autoSpin = !INTERACTIVE;
function onDown(x) { dragging = true; lastX = x; }
function onMove(x) { if (!dragging) return; rotY += (x - lastX) * 0.008; lastX = x; }
function onUp() { dragging = false; }

if (INTERACTIVE) {
  document.addEventListener("touchstart", function (e) { onDown(e.touches[0].clientX); }, { passive: true });
  document.addEventListener("touchmove", function (e) { onMove(e.touches[0].clientX); }, { passive: true });
  document.addEventListener("touchend", onUp);
  document.addEventListener("mousedown", function (e) { onDown(e.clientX); });
  document.addEventListener("mousemove", function (e) { onMove(e.clientX); });
  document.addEventListener("mouseup", onUp);
}

function animate() {
  requestAnimationFrame(animate);
  var delta = clock.getDelta();
  if (mixer) mixer.update(delta);
  if (autoSpin) rotY += 0.004;
  rig.rotation.y = rotY;
  renderer.render(scene, camera);
}

animate();
post({ type: "ready" });
</script>
</body>
</html>`;
}

const styles = StyleSheet.create({
  // alignItems:"center" (el default sensato para casi todo) NO estira a
  // los hijos en el eje transversal -- el WebView (flex:1) se quedaba con
  // ancho 0 aunque el alto sí tomaba el tamaño del padre (diagnosticado
  // con canvas=600x300 stage=0x240: alto bien, ancho en cero). "stretch"
  // sí lo obliga a llenar exactamente el width/height que se le pasa.
  wrap: { alignItems: "stretch", justifyContent: "center", overflow: "hidden" },
  webview: { flex: 1, backgroundColor: "transparent" },
  loading: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: "center",
    justifyContent: "center",
    zIndex: 5,
  },
});
