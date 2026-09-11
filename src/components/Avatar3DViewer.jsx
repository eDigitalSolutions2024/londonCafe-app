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
<script src="https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.min.js"></script>
<script>
(function () {
  var INTERACTIVE = ${interactive ? "true" : "false"};
  var post = function (obj) {
    if (window.ReactNativeWebView) window.ReactNativeWebView.postMessage(JSON.stringify(obj));
  };

  window.onerror = function (msg) { post({ type: "error", message: String(msg) }); };

  var scene = new THREE.Scene();
  var camera = new THREE.PerspectiveCamera(32, 1, 0.1, 100);
  camera.position.set(0, 1.15, 4.2);
  camera.lookAt(0, 1.0, 0);

  var renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, preserveDrawingBuffer: true });
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

  function buildHead(id, skinColor) {
    var mat = new THREE.MeshStandardMaterial({ color: skinColor || "#e0ac69", roughness: 0.6 });
    var oval = id === "head3d_02";
    var head = new THREE.Mesh(new THREE.SphereGeometry(0.42, 24, 20), mat);
    head.scale.set(1, oval ? 1.12 : 1, 0.92);
    head.position.y = 1.62;
    // ojos simples
    var eyeMat = new THREE.MeshStandardMaterial({ color: "#241a14" });
    var eyeGeo = new THREE.SphereGeometry(0.045, 10, 10);
    var eyeL = new THREE.Mesh(eyeGeo, eyeMat); eyeL.position.set(-0.15, 1.62, 0.36); head.add(eyeL);
    var eyeR = new THREE.Mesh(eyeGeo, eyeMat); eyeR.position.set(0.15, 1.62, 0.36); head.add(eyeR);
    return head;
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
    var w = window.innerWidth, h = window.innerHeight;
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    renderer.setSize(w, h, false);
  }
  window.addEventListener("resize", resize);
  resize();

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
  wrap: { alignItems: "center", justifyContent: "center", overflow: "hidden" },
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
