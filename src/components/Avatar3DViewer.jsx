import React, { forwardRef, useEffect, useImperativeHandle, useMemo, useRef, useState } from "react";
import { View, StyleSheet, ActivityIndicator } from "react-native";
import { WebView } from "react-native-webview";
import { colors } from "../theme/colors";

/**
 * Visor del avatar 3D "de verdad": WebView + three.js (r128, vía CDN).
 * A propósito NO usa expo-gl/@react-three/fiber -- esta app corre en
 * arquitectura legacy de RN (newArchEnabled:false) y ya nos topamos este
 * mismo mes con que una librería de renderizado nativo (el widget de
 * Android) requería New Architecture y tronaba la app. WebView es un
 * módulo maduro, estable en legacy architecture, y adentro corre un
 * documento HTML normal -- cero riesgo de esa clase.
 *
 * Las partes del avatar (pelo/cabeza/cuerpo/atuendo/accesorio) son
 * GEOMETRÍA 3D generada con código (primitivas de three.js combinadas),
 * no modelos .glb descargados de un pack externo -- así el visor funciona
 * hoy mismo sin depender de conseguir/licenciar assets de terceros.
 * Reemplazar una parte por un modelo real después es cuestión de cambiar
 * cómo se arma esa pieza en HTML_TEMPLATE, sin tocar el resto.
 *
 * Uso:
 *   const ref = useRef(null);
 *   <Avatar3DViewer ref={ref} parts={...} colors={...} interactive size={260} />
 *   ref.current.capture().then((dataUrl) => ...) // pide un snapshot PNG
 */
const Avatar3DViewer = forwardRef(function Avatar3DViewer(
  { parts, colors: avatarColors, interactive = false, size = 200, onReady },
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
  // que esto solo actualiza la geometría visible, sin recargar el WebView
  // completo (evita el parpadeo/costo de reconstruir la página).
  useEffect(() => {
    if (!loaded) return;
    const payload = JSON.stringify({ parts: parts || {}, colors: avatarColors || {} });
    webRef.current?.injectJavaScript(`window.__updateAvatar && window.__updateAvatar(${payload}); true;`);
  }, [parts, avatarColors, loaded]);

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
<script src="https://cdnjs.cloudflare.com/ajax/libs/three.js/0.148.0/three.min.js"></script>
<script>
(function () {
  var INTERACTIVE = ${interactive ? "true" : "false"};
  var post = function (obj) {
    if (window.ReactNativeWebView) window.ReactNativeWebView.postMessage(JSON.stringify(obj));
  };

  window.onerror = function (msg) { post({ type: "error", message: String(msg) }); };

  var scene = new THREE.Scene();
  var camera = new THREE.PerspectiveCamera(32, 1, 0.1, 100);
  // El personaje mide ~2.7 unidades de alto (puntas del pelo ~2.15,
  // pies ~-0.5) -- se aleja lo suficiente para que quepa completo con
  // margen, centrado a la mitad de esa altura.
  camera.position.set(0, 0.95, 5.6);
  camera.lookAt(0, 0.85, 0);

  var renderer;
  try {
    renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, preserveDrawingBuffer: true });
  } catch (e) {
    post({ type: "error", message: "WebGLRenderer falló: " + e.message });
    return;
  }
  if (!renderer.getContext()) {
    post({ type: "error", message: "WebGL no disponible en este WebView" });
    return;
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

  var current = { parts: {}, colors: {} };
  var partMeshes = {}; // slot -> Mesh/Group actual, para poder quitarlo al cambiar

  function clearSlot(slot) {
    if (partMeshes[slot]) {
      avatarGroup.remove(partMeshes[slot]);
      partMeshes[slot] = null;
    }
  }

  function buildBody(id, skinColor) {
    var g = new THREE.Group();
    var mat = new THREE.MeshStandardMaterial({ color: skinColor || "#e0ac69", roughness: 0.7 });
    var big = id === "body3d_02";
    var torso = new THREE.Mesh(new THREE.CapsuleGeometry(big ? 0.46 : 0.4, 0.75, 6, 12), mat);
    torso.position.y = 0.62;
    g.add(torso);
    var armGeo = new THREE.CapsuleGeometry(0.09, 0.55, 4, 8);
    var armL = new THREE.Mesh(armGeo, mat); armL.position.set(-0.52, 0.68, 0); armL.rotation.z = 0.18; g.add(armL);
    var armR = new THREE.Mesh(armGeo, mat); armR.position.set(0.52, 0.68, 0); armR.rotation.z = -0.18; g.add(armR);
    var legGeo = new THREE.CapsuleGeometry(0.13, 0.5, 4, 8);
    var legL = new THREE.Mesh(legGeo, mat); legL.position.set(-0.18, -0.1, 0); g.add(legL);
    var legR = new THREE.Mesh(legGeo, mat); legR.position.set(0.18, -0.1, 0); g.add(legR);
    return g;
  }

  // Oscurece un color hex un poco -- se usa para que la nariz/cejas no
  // sean el mismo tono plano de la piel/pelo, dan algo de relieve a la cara.
  function shade(hex, amt) {
    var c = new THREE.Color(hex || "#e0ac69");
    c.multiplyScalar(1 + amt);
    return c;
  }

  function buildHead(id, skinColor) {
    var mat = new THREE.MeshStandardMaterial({ color: skinColor || "#e0ac69", roughness: 0.6 });
    var oval = id === "head3d_02";
    var head = new THREE.Mesh(new THREE.SphereGeometry(0.42, 24, 20), mat);
    head.scale.set(1, oval ? 1.12 : 1, 0.92);
    head.position.y = 1.62;
    buildFace(head, skinColor);
    return head;
  }

  // Cara estilo Bitmoji/Snapchat: ojos grandes (esclera + iris + brillo),
  // cejas, nariz y boca sonriente -- todo geometría simple de three.js
  // montada como hijos del mesh de la cabeza, así rota/escala con ella.
  function buildFace(head, skinColor) {
    // Los rasgos son HIJOS de head, así que sus posiciones son LOCALES al
    // origen de la cabeza (0,0,0) -- heredan el position.y=1.62 del padre
    // automáticamente. Sumar 1.62 aquí también (como el bug original de
    // "ojos simples") los mandaba a y=3.24 en el mundo, muy por encima de
    // la cabeza real -- por eso nunca se veían.
    var cy = 0;

    // Ojos: esclera blanca + iris oscuro + punto de brillo, el look
    // "grande y expresivo" característico de Bitmoji.
    var scleraMat = new THREE.MeshStandardMaterial({ color: "#ffffff", roughness: 0.3 });
    var irisMat = new THREE.MeshStandardMaterial({ color: "#3a2418", roughness: 0.25 });
    var pupilMat = new THREE.MeshStandardMaterial({ color: "#120b08", roughness: 0.2 });
    var glintMat = new THREE.MeshStandardMaterial({ color: "#ffffff", emissive: "#ffffff", emissiveIntensity: 0.5 });

    [-1, 1].forEach(function (side) {
      var ex = 0.155 * side;
      var sclera = new THREE.Mesh(new THREE.SphereGeometry(0.075, 14, 14), scleraMat);
      sclera.scale.set(1, 1.15, 0.6);
      sclera.position.set(ex, cy + 0.01, 0.365);
      head.add(sclera);

      var iris = new THREE.Mesh(new THREE.SphereGeometry(0.04, 12, 12), irisMat);
      iris.position.set(ex, cy + 0.01, 0.408);
      head.add(iris);

      var pupil = new THREE.Mesh(new THREE.SphereGeometry(0.02, 10, 10), pupilMat);
      pupil.position.set(ex, cy + 0.01, 0.425);
      head.add(pupil);

      var glint = new THREE.Mesh(new THREE.SphereGeometry(0.012, 8, 8), glintMat);
      glint.position.set(ex - 0.018, cy + 0.035, 0.43);
      head.add(glint);
    });

    // Cejas: cápsulas finas encima de cada ojo.
    var browMat = new THREE.MeshStandardMaterial({ color: shade(skinColor, -0.55), roughness: 0.8 });
    [-1, 1].forEach(function (side) {
      var brow = new THREE.Mesh(new THREE.CapsuleGeometry(0.012, 0.11, 4, 6), browMat);
      brow.position.set(0.16 * side, cy + 0.145, 0.375);
      brow.rotation.z = Math.PI / 2 + side * 0.18;
      head.add(brow);
    });

    // Nariz: pequeño bulto que sobresale al centro de la cara.
    var noseMat = new THREE.MeshStandardMaterial({ color: shade(skinColor, -0.08), roughness: 0.6 });
    var nose = new THREE.Mesh(new THREE.SphereGeometry(0.038, 10, 10), noseMat);
    nose.scale.set(0.8, 1, 0.9);
    nose.position.set(0, cy - 0.06, 0.415);
    head.add(nose);

    // Boca: medio toro (arco) que forma una sonrisa simple.
    var mouthMat = new THREE.MeshStandardMaterial({ color: "#7a3b3b", roughness: 0.5 });
    var mouth = new THREE.Mesh(new THREE.TorusGeometry(0.07, 0.013, 8, 16, Math.PI), mouthMat);
    mouth.rotation.z = Math.PI; // voltea el arco para que abra hacia arriba (∪, sonrisa)
    mouth.position.set(0, cy - 0.16, 0.375);
    head.add(mouth);
  }

  function buildHair(id, hairColor) {
    if (!id || id === "hair3d_04") return null; // "bald"/rapado -- sin mesh
    var mat = new THREE.MeshStandardMaterial({ color: hairColor || "#1c1c1c", roughness: 0.8 });
    var g = new THREE.Group();
    g.position.y = 1.62;
    if (id === "hair3d_01") { // corto/spiky
      for (var i = 0; i < 7; i++) {
        var a = (i / 7) * Math.PI * 2;
        var spike = new THREE.Mesh(new THREE.ConeGeometry(0.07, 0.22, 8), mat);
        spike.position.set(Math.cos(a) * 0.22, 0.32 + Math.random() * 0.05, Math.sin(a) * 0.22);
        spike.rotation.set((Math.random() - 0.5) * 0.4, 0, (Math.random() - 0.5) * 0.4);
        g.add(spike);
      }
    } else if (id === "hair3d_02") { // largo
      var cap = new THREE.Mesh(new THREE.SphereGeometry(0.45, 20, 16, 0, Math.PI * 2, 0, Math.PI * 0.55), mat);
      cap.position.y = 0.06; g.add(cap);
      var back = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.18, 0.7, 16), mat);
      back.position.set(0, -0.32, -0.12); g.add(back);
    } else if (id === "hair3d_03") { // chongo/bun
      var cap2 = new THREE.Mesh(new THREE.SphereGeometry(0.44, 20, 16, 0, Math.PI * 2, 0, Math.PI * 0.5), mat);
      cap2.position.y = 0.05; g.add(cap2);
      var bun = new THREE.Mesh(new THREE.SphereGeometry(0.14, 14, 14), mat);
      bun.position.set(0, 0.42, -0.1); g.add(bun);
    }
    return g;
  }

  function buildOutfit(id, group) {
    // el "atuendo" ajusta el color/silueta del torso ya creado por buildBody
    var colorsById = { outfit3d_01: "#7a1e3a", outfit3d_02: "#3c5a7a", outfit3d_03: "#3a7a4e" };
    var c = colorsById[id] || "#7a1e3a";
    var shirtMat = new THREE.MeshStandardMaterial({ color: c, roughness: 0.75 });
    var shirt = new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.46, 0.5, 16), shirtMat);
    shirt.position.y = 0.82;
    if (id === "outfit3d_02") { // hoodie -- capucha
      var hood = new THREE.Mesh(new THREE.TorusGeometry(0.25, 0.08, 8, 16, Math.PI), shirtMat);
      hood.position.set(0, 1.28, -0.15); hood.rotation.x = Math.PI; shirt.add(hood);
    } else if (id === "outfit3d_03") { // jacket -- cuello
      var collar = new THREE.Mesh(new THREE.TorusGeometry(0.28, 0.045, 8, 16), shirtMat);
      collar.position.y = 1.06; collar.rotation.x = Math.PI / 2; shirt.add(collar);
    }
    return shirt;
  }

  function buildAccessory(id) {
    if (!id) return null;
    var g = new THREE.Group();
    if (id === "acc3d_01") { // lentes
      var frameMat = new THREE.MeshStandardMaterial({ color: "#222222" });
      var lensGeo = new THREE.TorusGeometry(0.09, 0.015, 8, 16);
      var lL = new THREE.Mesh(lensGeo, frameMat); lL.position.set(-0.15, 1.62, 0.4); g.add(lL);
      var lR = new THREE.Mesh(lensGeo, frameMat); lR.position.set(0.15, 1.62, 0.4); g.add(lR);
      var bridge = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, 0.08, 6), frameMat);
      bridge.position.set(0, 1.62, 0.4); bridge.rotation.z = Math.PI / 2; g.add(bridge);
    } else if (id === "acc3d_02") { // gorra
      var capMat = new THREE.MeshStandardMaterial({ color: "#7a1e3a" });
      var dome = new THREE.Mesh(new THREE.SphereGeometry(0.45, 16, 12, 0, Math.PI * 2, 0, Math.PI * 0.45), capMat);
      dome.position.y = 1.68; g.add(dome);
      var brim = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.22, 0.03, 16), capMat);
      brim.position.set(0, 1.55, 0.28); brim.scale.set(1, 1, 0.6); g.add(brim);
    }
    return g;
  }

  function rebuild(next) {
    current = next;
    var p = next.parts || {};
    var c = next.colors || {};

    clearSlot("body"); clearSlot("head"); clearSlot("hair"); clearSlot("outfit"); clearSlot("accessory");

    var body = buildBody(p.body, c.skin);
    avatarGroup.add(body); partMeshes.body = body;

    var head = buildHead(p.head, c.skin);
    avatarGroup.add(head); partMeshes.head = head;

    var hair = buildHair(p.hair, c.hair);
    if (hair) { avatarGroup.add(hair); partMeshes.hair = hair; }

    if (p.outfit) {
      var outfit = buildOutfit(p.outfit);
      avatarGroup.add(outfit); partMeshes.outfit = outfit;
    }

    var acc = buildAccessory(p.accessory);
    if (acc) { avatarGroup.add(acc); partMeshes.accessory = acc; }
  }

  window.__updateAvatar = function (next) { rebuild(next); };
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
    // ⚠️ El 3er argumento (updateStyle) en false deja el tamaño VISUAL
    // (CSS) del canvas sin tocar mientras cambia el buffer de dibujo --
    // como el canvas no tenía su propio CSS explícito, quedaba con un
    // tamaño default (o heredado) distinto al buffer real, dando un
    // encuadre recortado/deformado. true dejará que three.js iguale el
    // estilo del canvas al tamaño real, así siempre calzan.
    renderer.setSize(w, h, true);
  }
  window.addEventListener("resize", resize);
  // El primer resize() puede correr ANTES de que el WebView termine de
  // acomodar su viewport -- innerWidth/innerHeight (o el tamaño de
  // #stage) pueden venir en 0 todavía, dejando el canvas sin tamaño y la
  // escena invisible aunque todo lo demás cargó bien. Se reintenta unas
  // cuantas veces con requestAnimationFrame hasta que el tamaño ya no
  // sea cero, y también al evento "load" por si acaso.
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
  // interactive=true. La vista chica (no interactiva) se queda quieta
  // salvo el auto-giro lento de ambiente.
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
    if (autoSpin) rotY += 0.004;
    rig.rotation.y = rotY;
    renderer.render(scene, camera);
  }

  rebuild({ parts: {}, colors: {} });
  animate();
  post({ type: "ready" });
})();
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
