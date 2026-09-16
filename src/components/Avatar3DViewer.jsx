import React, { forwardRef, useEffect, useImperativeHandle, useMemo, useRef, useState } from "react";
import { View, StyleSheet, ActivityIndicator } from "react-native";
import { WebView } from "react-native-webview";
import { colors } from "../theme/colors";
import { CHARACTER_OPTIONS, BRAND_LOGO_URL, SKIN_TONE_OPTIONS } from "../assets/avatar3dParts";

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
 * mesh "head-mesh"), no con coordenadas fijas a mano. El picker de
 * accesorios está OCULTO por lo pronto en AvatarCustomizeScreen (se veían
 * desproporcionados en varios de los 12 personajes) -- el código sigue acá,
 * listo para reactivarse cuando se ajuste mejor.
 *
 * buildBrand() arma un logo de London Café al pecho + "LONDON VIBES /
 * COFFEE MOMENTS" en la espalda, pero está APAGADO (no se llama) -- no
 * gustó cómo se veía puesto. Queda el código por si se retoma con otro
 * diseño.
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
    const tone = SKIN_TONE_OPTIONS.find((t) => t.id === parts?.skinTone);
    const payload = JSON.stringify({
      characterUrl: character ? character.glb : null,
      accessory: parts?.accessory || null,
      skinColor: tone ? tone.color : null,
    });
    webRef.current?.injectJavaScript(`window.__updateAvatar && window.__updateAvatar(${payload}); true;`);
  }, [parts?.character, parts?.accessory, parts?.skinTone, loaded]);

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
var BRAND_LOGO_URL = "${BRAND_LOGO_URL}";
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
var currentBrand = null; // logo del pecho + texto de la espalda, ver buildBrand()
var currentHeadInfo = null; // medición de la cabeza tomada UNA vez al cargar, ver nota en loadAndSwapCharacter
var mixer = null;
var clock = new THREE.Clock();
var current = { characterUrl: null, accessory: null, skinColor: null };

function loadCharacter(url) {
  return new Promise(function (resolve, reject) {
    if (gltfCache[url]) { resolve(gltfCache[url]); return; }
    loader.load(url, function (gltf) { gltfCache[url] = gltf; resolve(gltf); }, undefined, reject);
  });
}

// Mide un mesh por nombre (regex) -- SIZE sale de la geometría LOCAL cruda
// (bind pose, sin transformar) × MODEL_SCALE, no de Box3.setFromObject()
// sobre el mundo. OJO: probado con captura -- usar el AABB de mundo para el
// tamaño se ve "bien" a rotación 0, pero el rig arranca rotado (rotY=0.35)
// y un box no-cúbico rotado en Y agranda su propio AABB (mezcla ancho y
// profundidad), dando un tamaño que depende de en qué ángulo esté el
// avatar en ese momento -- con esa cabeza dio 2.17 de ancho en vez de 1.81
// (el 4x real), bastante para que el logo saliera gigante. CENTER sí usa
// mundo (vía Box3.setFromObject), porque ahí SÍ queremos la posición
// actual ya rotada, para que el parche quede pegado al cuerpo al girarlo.
function measureMesh(obj, namePattern) {
  var mesh = null;
  obj.traverse(function (c) { if (c.isMesh && namePattern.test(c.name || "")) mesh = c; });
  if (!mesh) return null;
  mesh.geometry.computeBoundingBox();
  var size = new THREE.Vector3();
  mesh.geometry.boundingBox.getSize(size);
  size.multiplyScalar(MODEL_SCALE);

  var box = new THREE.Box3().setFromObject(mesh);
  var worldCenter = new THREE.Vector3();
  box.getCenter(worldCenter);
  var localCenter = avatarGroup.worldToLocal(worldCenter.clone());
  return { center: localCenter, size: size };
}
function measureHead(obj) { return measureMesh(obj, /head/i); }
function measureBody(obj) { return measureMesh(obj, /body/i); }

// Tono de piel real -- recolorea SOLO los píxeles "color piel" de la
// textura compartida (colormap.png, la MISMA imagen para los 12
// personajes: es una paleta de franjas de color planas, no una textura por
// personaje). Se identificó offline con un script (decodificando los
// accessors UV del .glb + la imagen) que los píxeles de piel de TODOS los
// personajes caen en una franja de tonos cálidos bien distinguible de las
// franjas de ropa/pelo (azul/verde/morado/gris/blanco) -- ver
// isSkinLikeColor(). Antes "tono de piel" cambiaba el personaje ENTERO
// (otro modelo con otro pelo/outfit) porque los 12 personajes ya vienen
// con un tono fijo horneado; esto en cambio conserva el personaje/outfit
// elegido y solo tiñe su piel.
function hexToRgb(hex) {
  var v = parseInt(String(hex).replace("#", ""), 16);
  return { r: (v >> 16) & 255, g: (v >> 8) & 255, b: v & 255 };
}
function rgbToHsl(r, g, b) {
  r /= 255; g /= 255; b /= 255;
  var max = Math.max(r, g, b), min = Math.min(r, g, b);
  var h, s, l = (max + min) / 2;
  if (max === min) { h = s = 0; }
  else {
    var d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    if (max === r) h = (g - b) / d + (g < b ? 6 : 0);
    else if (max === g) h = (b - r) / d + 2;
    else h = (r - g) / d + 4;
    h /= 6;
  }
  return [h, s, l];
}
function hue2rgb(p, q, t) {
  if (t < 0) t += 1;
  if (t > 1) t -= 1;
  if (t < 1 / 6) return p + (q - p) * 6 * t;
  if (t < 1 / 2) return q;
  if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
  return p;
}
function hslToRgb(h, s, l) {
  if (s === 0) { var v = Math.round(l * 255); return [v, v, v]; }
  var q = l < 0.5 ? l * (1 + s) : l + s - l * s;
  var p = 2 * l - q;
  return [
    Math.round(hue2rgb(p, q, h + 1 / 3) * 255),
    Math.round(hue2rgb(p, q, h) * 255),
    Math.round(hue2rgb(p, q, h - 1 / 3) * 255),
  ];
}
// Rango calibrado contra los 12 personajes reales (script offline): piel
// cae en R>G>B, con R-B entre 35 y 140 -- valores más chicos son ropa/pelo
// grisáceo/azulado, más grandes son acentos muy saturados (ej. naranja de
// gorra/botón), que NO son piel.
function isSkinLikeColor(r, g, b) {
  return r > g && g >= b - 5 && (r - b) >= 35 && (r - b) <= 140 && r >= 100 && r <= 245 && g >= 60 && g <= 170 && b >= 40 && b <= 130;
}

function applySkinTint(root, hex) {
  if (!root) return;
  var materials = [];
  root.traverse(function (c) {
    if (c.isMesh && c.material && materials.indexOf(c.material) === -1) materials.push(c.material);
  });
  materials.forEach(function (mat) {
    if (!mat.map || !mat.map.image) return;
    // La imagen ORIGINAL (de fábrica) y su ImageData se guardan UNA sola
    // vez por material -- así, elegir otro tono (o quitarlo) siempre parte
    // del píxel original en vez de ir combinando tintes sobre un tinte
    // anterior, y no hay que volver a leer/decodificar la imagen cada vez.
    if (!mat.userData.__skinBaseData) {
      var img = mat.map.image;
      var base = document.createElement("canvas");
      base.width = img.width; base.height = img.height;
      var baseCtx = base.getContext("2d");
      baseCtx.drawImage(img, 0, 0);
      var baseData = baseCtx.getImageData(0, 0, base.width, base.height);
      mat.userData.__skinBaseData = baseData;
      mat.userData.__origColorSpace = mat.map.colorSpace;
      mat.userData.__origFlipY = mat.map.flipY;
      // Luminosidad PROMEDIO de los píxeles de piel del personaje de
      // fábrica -- se usa como referencia para anclar el tono elegido a
      // SU luminosidad real (ver más abajo), conservando el degradado/
      // sombreado relativo de cada píxel en vez de aplanarlo todo.
      var bd = baseData.data;
      var sum = 0, n = 0;
      for (var bi = 0; bi < bd.length; bi += 4) {
        if (isSkinLikeColor(bd[bi], bd[bi + 1], bd[bi + 2])) {
          sum += rgbToHsl(bd[bi], bd[bi + 1], bd[bi + 2])[2];
          n++;
        }
      }
      mat.userData.__skinAvgL = n ? sum / n : 0.5;
    }
    var baseData = mat.userData.__skinBaseData;
    if (!hex) {
      // Sin tono elegido: restaura el original tal cual (por si venía de
      // un tinte previo en esta misma sesión).
      if (mat.userData.__skinTinted) {
        var restoreCanvas = document.createElement("canvas");
        restoreCanvas.width = baseData.width; restoreCanvas.height = baseData.height;
        restoreCanvas.getContext("2d").putImageData(baseData, 0, 0);
        var origTex = new THREE.CanvasTexture(restoreCanvas);
        origTex.colorSpace = mat.userData.__origColorSpace;
        origTex.flipY = mat.userData.__origFlipY;
        mat.map = origTex;
        mat.needsUpdate = true;
        mat.userData.__skinTinted = false;
      }
      return;
    }

    var w = baseData.width, h = baseData.height;
    var out = document.createElement("canvas");
    out.width = w; out.height = h;
    var ctx = out.getContext("2d");
    var imgData = ctx.createImageData(w, h);
    var src = baseData.data;
    var dst = imgData.data;
    dst.set(src); // copia rápida de todo -- solo se pisan los píxeles de piel abajo

    var target = hexToRgb(hex);
    var thsl = rgbToHsl(target.r, target.g, target.b);
    var avgL = mat.userData.__skinAvgL;
    // Memo por color ÚNICO -- colormap.png es una paleta de franjas planas
    // (pocas decenas de colores distintos en total, ver nota arriba de
    // isSkinLikeColor), así que el cálculo de HSL caro se hace como mucho
    // unas cuantas veces en vez de una por cada uno de los 262,144 píxeles
    // -- esto era el cuello de botella real que volvió a hacer lento el
    // guardado (el WebView de Android corre JS bastante más lento que un
    // V8 de escritorio para un loop así de grande).
    var cache = {};
    for (var i = 0; i < src.length; i += 4) {
      var r = src[i], g = src[i + 1], b = src[i + 2];
      if (!isSkinLikeColor(r, g, b)) continue;
      var key = (r << 16) | (g << 8) | b;
      var rgb = cache[key];
      if (!rgb) {
        var hsl = rgbToHsl(r, g, b);
        // Ancla la luminosidad al tono ELEGIDO (no al original) --
        // conservando cuánto se aparta este píxel del promedio de fábrica,
        // para no perder el sombreado/degradado del modelo. Antes se
        // conservaba la luminosidad original completa y solo se cambiaba
        // tono/saturación, lo que dejaba "Claro" y "Moreno oscuro" casi
        // igual de claros/oscuros que el personaje de fábrica -- apenas
        // notorio.
        var newL = Math.max(0, Math.min(1, thsl[2] + (hsl[2] - avgL)));
        rgb = hslToRgb(thsl[0], thsl[1], newL);
        cache[key] = rgb;
      }
      dst[i] = rgb[0]; dst[i + 1] = rgb[1]; dst[i + 2] = rgb[2];
    }
    ctx.putImageData(imgData, 0, 0);
    var tex = new THREE.CanvasTexture(out);
    tex.colorSpace = mat.userData.__origColorSpace;
    tex.flipY = mat.userData.__origFlipY;
    tex.needsUpdate = true;
    mat.map = tex;
    mat.needsUpdate = true;
    mat.userData.__skinTinted = true;
  });
}

var logoTexture = null; // se cargaba acá; apagado junto con buildBrand() más abajo

// Dibuja un rectángulo con esquinas redondeadas en un canvas 2D -- usado
// para la placa del texto de atrás (sin esto ctx.fillRect() daría un
// rectángulo con esquinas cuadradas, menos parecido a una etiqueta real).
function roundRectPath(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

// Logo de London Café al frente (parche, PNG con transparencia real) +
// "LONDON VIBES / COFFEE MOMENTS" atrás (dibujado con canvas sobre una
// placa del color de marca -- así se lee igual sin importar de qué color
// sea la camisa de cada uno de los 12 personajes). Ambos son planos
// simples pegados al cuerpo, no geometría 3D -- mucho más tolerante a
// que el torso varíe de forma entre personajes que un accesorio rígido.
//
// OJO con el ancho: Box3.setFromObject() de un SkinnedMesh lee la
// geometría en su pose de BIND (T-pose, brazos bien abiertos), NUNCA la
// pose animada -- da igual en qué momento se mida. body.size.x (ancho de
// PUNTA A PUNTA de mano a mano en T-pose) sale gigante por eso, se
// confirmó con captura (el logo tapaba medio cuerpo). head.size.x en
// cambio es la cabeza sola, no le afectan los brazos -- se usa esa como
// referencia de escala en vez del ancho del body-mesh. Alto/profundidad
// (Y/Z) sí son confiables desde body (los brazos en T-pose no cambian
// cuánto mide el cuerpo de pies a hombro ni de pecho a espalda).
function buildBrand(head, body) {
  if (!body || !head) return null;
  var g = new THREE.Group();
  var scaleRef = head.size.x;
  var frontZ = body.center.z + body.size.z / 2;
  var backZ = body.center.z - body.size.z / 2;
  // A la altura del pecho -- un poco abajo del hombro (arriba del todo del
  // body-mesh, que termina donde empieza el cuello/cabeza).
  var chestY = body.center.y + body.size.y * 0.32;

  var logoSize = scaleRef * 0.5;
  var logoMat = new THREE.MeshBasicMaterial({ map: logoTexture, transparent: true, alphaTest: 0.1 });
  var logo = new THREE.Mesh(new THREE.PlaneGeometry(logoSize, logoSize), logoMat);
  logo.position.set(body.center.x, chestY, frontZ + 0.003);
  g.add(logo);

  var canvas = document.createElement("canvas");
  canvas.width = 512; canvas.height = 220;
  var ctx = canvas.getContext("2d");
  ctx.fillStyle = "#7a1e3a";
  roundRectPath(ctx, 4, 4, 504, 212, 28);
  ctx.fill();
  ctx.fillStyle = "#ffffff";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.font = "900 58px Arial, sans-serif";
  ctx.fillText("LONDON VIBES", 256, 84);
  ctx.font = "700 42px Arial, sans-serif";
  ctx.fillText("COFFEE MOMENTS", 256, 152);
  var backTexture = new THREE.CanvasTexture(canvas);
  // Sin esto el canvas se ve descolorido/rosa pálido en vez del maroon de
  // marca -- CanvasTexture no asume espacio sRGB por defecto como sí lo
  // hacen las texturas cargadas de archivo, y el renderer corrige de más.
  backTexture.colorSpace = THREE.SRGBColorSpace;
  var backMat = new THREE.MeshBasicMaterial({ map: backTexture, transparent: true });
  var backW = scaleRef * 1.15;
  var backH = backW * (canvas.height / canvas.width);
  var back = new THREE.Mesh(new THREE.PlaneGeometry(backW, backH), backMat);
  back.position.set(body.center.x, chestY, backZ - 0.003);
  back.rotation.y = Math.PI; // mira hacia atrás (normal por defecto del plano es +Z)
  g.add(back);

  return g;
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
  if (currentBrand) { avatarGroup.remove(currentBrand); currentBrand = null; }
  currentHeadInfo = null;
  mixer = null;
}

// Apagado por lo pronto -- lentes/gorra (buildAccessory arriba) se veían
// mal puestos (flotando, desproporcionados) en varios de los 12
// personajes. Esto los apaga en TODOS lados (no solo el picker de
// AvatarCustomizeScreen), incluyendo cuentas que ya tenían uno guardado de
// antes. buildAccessory() se deja intacto para reactivar esto después con
// mejor ajuste -- no se llama desde ningún lado mientras tanto.
function applyAccessory() {
  if (currentAccessory) { avatarGroup.remove(currentAccessory); currentAccessory = null; }
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

    // buildBrand() (logo al pecho + texto atrás) se deja definido pero SIN
    // llamar -- no gustó cómo se veía puesto. currentBrand se queda en
    // null siempre por ahora.

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
    applySkinTint(currentModel, current.skinColor);
    post({ type: "modelLoaded" });
  }).catch(function (err) {
    post({ type: "error", message: "GLB load falló: " + (err && err.message ? err.message : String(err)) });
  });
}

window.__updateAvatar = function (next) {
  var prevUrl = current.characterUrl;
  var prevSkin = current.skinColor;
  current = next || { characterUrl: null, accessory: null, skinColor: null };
  if (current.characterUrl !== prevUrl) {
    // loadAndSwapCharacter ya aplica el tono actual (current.skinColor) al
    // terminar de cargar el modelo nuevo -- no hace falta repetirlo aquí.
    loadAndSwapCharacter(current.characterUrl);
  } else if (currentModel) {
    applyAccessory(current.accessory, currentHeadInfo);
    if (current.skinColor !== prevSkin) applySkinTint(currentModel, current.skinColor);
  }
};
window.__captureSnapshot = function () {
  // El snapshot solo se USA chiquito en toda la app (78-150px: Home,
  // PetDioramaCard, etc.) -- pero se estaba capturando al tamaño completo
  // del visor EN VIVO (hasta 240 CSS px × devicePixelRatio, o sea hasta
  // 480x480+ px reales), dando un PNG varias veces más pesado de lo que
  // hace falta y tardando ~30s en subir. Se achica el buffer SOLO para
  // esta captura (pixelRatio 1, tamaño fijo chico) y se restaura el
  // tamaño real después para no afectar la vista interactiva.
  var CAPTURE_SIZE = 320;
  var prevWidth = renderer.domElement.width;
  var prevHeight = renderer.domElement.height;
  var prevAspect = camera.aspect;

  renderer.setPixelRatio(1);
  renderer.setSize(CAPTURE_SIZE, CAPTURE_SIZE, false);
  camera.aspect = 1;
  camera.updateProjectionMatrix();
  renderer.render(scene, camera);
  var dataUrl = renderer.domElement.toDataURL("image/png");

  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.setSize(prevWidth, prevHeight, false);
  camera.aspect = prevAspect;
  camera.updateProjectionMatrix();
  renderer.render(scene, camera);

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
