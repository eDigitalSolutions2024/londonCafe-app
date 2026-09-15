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

  // v2: antes el torso era una cápsula y los brazos salían casi de su
  // CENTRO (a la altura del estómago, no del hombro) -- sin cuello, sin
  // manos ni pies. La primera pasada de este rediseño probó partir el
  // torso en pecho+cintura, pero el pecho (esfera achatada) quedaba más
  // angosto que donde estaban los brazos a esa altura -- se veían
  // flotando, separados del cuerpo. Se volvió a UNA sola cápsula (más
  // corta, deja espacio para el cuello) y en su lugar se ajustó dónde
  // sale cada pieza: brazos a la altura del hombro (arriba del todo del
  // torso, no al centro), + cuello, manos y pies nuevos.
  // Poses/gestos: en vez de un brazo con codo (dos segmentos + IK), que
  // sería mucho más código, cada pose es solo una rotación distinta del
  // MISMO brazo de una pieza en dos ejes -- rotZ (abre/cierra hacia el
  // cuerpo, como ya existía) y rotX (nuevo: sube/baja el brazo hacia
  // adelante). armPose() calcula con la MISMA fórmula, sin importar la
  // pose, hacia dónde apunta el extremo de la mano, y recorre el centro
  // de la cápsula medio-largo en esa dirección -- así el otro extremo
  // (el del hombro) se queda anclado en su sitio pase lo que pase.
  var POSES = {
    pose3d_01: { L: { rotX: 0, rotZ: 0.12 }, R: { rotX: 0, rotZ: -0.12 } }, // normal
    pose3d_02: { L: { rotX: -0.3, rotZ: 0.62 }, R: { rotX: -0.3, rotZ: -0.62 } }, // manos en cintura
    pose3d_03: { L: { rotX: 0, rotZ: 0.12 }, R: { rotX: -2.7, rotZ: -0.3 } }, // saludo
    pose3d_04: { L: { rotX: 0, rotZ: 0.12 }, R: { rotX: -1.85, rotZ: -0.1 } }, // pulgar arriba
    pose3d_05: { L: { rotX: 0, rotZ: 0.12 }, R: { rotX: -2.5, rotZ: -0.45 } }, // paz
    pose3d_06: { L: { rotX: 0.55, rotZ: 0.22 }, R: { rotX: 0.55, rotZ: -0.22 } }, // manos atrás
  };
  function armPose(shoulderX, shoulderY, rotX, rotZ, armLen) {
    var dx = Math.cos(rotX) * Math.sin(rotZ);
    var dy = -Math.cos(rotX) * Math.cos(rotZ);
    var dz = Math.sin(rotX);
    var half = armLen / 2;
    return { x: shoulderX + dx * half, y: shoulderY + dy * half, z: dz * half, dx: dx, dy: dy, dz: dz };
  }

  function buildBody(id, skinColor, poseId) {
    var g = new THREE.Group();
    var mat = new THREE.MeshStandardMaterial({ color: skinColor || "#e0ac69", roughness: 0.7 });
    var big = id === "body3d_02";

    // v6: seguía viéndose "gordo" incluso adelgazado (v5) -- el problema
    // real no era solo el radio, era la PROPORCIÓN: una cápsula con el
    // largo corto respecto al radio es CASI PURO casquete redondeado en
    // las puntas (con radio 0.44/largo 0.56 el 60% de la altura eran los
    // dos extremos redondos), se lee como una pelota sin importar qué
    // tan delgada. Ahora el largo es mucho mayor que el radio -- mismo
    // truco que un cilindro con tapas redondeadas chicas en vez de una
    // píldora gruesa.
    var torsoRadius = big ? 0.3 : 0.26;
    var torso = new THREE.Mesh(new THREE.CapsuleGeometry(torsoRadius, 0.85, 6, 12), mat);
    torso.position.y = 0.62;
    g.add(torso);

    // Cuello: conecta la base de la cabeza (~y=1.20) con la punta del
    // torso (~y=1.28) -- antes la cabeza quedaba pegada directo al
    // torso, sin nada entre medio.
    var neck = new THREE.Mesh(new THREE.CylinderGeometry(0.11, 0.15, 0.16, 12), mat);
    neck.position.y = 1.3;
    g.add(neck);

    // Brazos a la altura del HOMBRO (arriba del todo del torso, dentro
    // de su sección cilíndrica ancha) -- antes salían del centro del
    // torso (y=0.68 contra un centro de torso en 0.62), casi del
    // estómago. armX queda un poco DENTRO del radio del torso a esa
    // altura para que se vean pegados, no flotando separados.
    // v3: los brazos quedaban cortos y muy abiertos (rotación de 0.24 rad
    // + solo 0.48 de largo) -- se veían como aletitas saliendo del
    // hombro en vez de brazos colgando a los lados. Ahora son más largos
    // (bajan a la altura de la cadera, como brazos de verdad colgando) y
    // casi verticales (rotación chica, solo un poco abiertos).
    // v4: con la camisa (radio fijo 0.49, ver buildOutfit) el brazo
    // quedaba METIDO dentro de su silueta -- solo se asomaban la mano y
    // la punta del hombro, con el resto del brazo tapado por la tela,
    // así que se veían como dos piezas flotando sueltas en vez de un
    // brazo completo. armX ahora se mide contra el radio de la CAMISA
    // (no del torso desnudo) para que el brazo quede afuera de verdad.
    var armY = 0.9;
    var armLen = 0.62;
    var armX = 0.39; // afuera del radio de la camisa adelgazada (0.44, ver buildOutfit)
    var pose = POSES[poseId] || POSES.pose3d_01;
    var armGeo = new THREE.CapsuleGeometry(0.08, armLen, 4, 8);
    var handGeo = new THREE.SphereGeometry(0.095, 10, 10);

    [
      { side: -1, def: pose.L },
      { side: 1, def: pose.R },
    ].forEach(function (arm) {
      var shoulderX = armX * arm.side;
      var p = armPose(shoulderX, armY, arm.def.rotX, arm.def.rotZ, armLen);

      var armMesh = new THREE.Mesh(armGeo, mat);
      armMesh.position.set(p.x, p.y, p.z);
      armMesh.rotation.x = arm.def.rotX;
      armMesh.rotation.z = arm.def.rotZ;
      g.add(armMesh);

      // Mano: en la punta de la cápsula (medio largo + radio, en la
      // misma dirección que ya calculó armPose para el centro).
      var handDrop = armLen / 2 + 0.08;
      var hand = new THREE.Mesh(handGeo, mat);
      hand.position.set(shoulderX + p.dx * handDrop, armY + p.dy * handDrop, p.dz * handDrop);
      g.add(hand);
    });

    var legGeo = new THREE.CapsuleGeometry(0.12, 0.46, 4, 8);
    var legL = new THREE.Mesh(legGeo, mat); legL.position.set(-0.16, -0.25, 0); g.add(legL);
    var legR = new THREE.Mesh(legGeo, mat); legR.position.set(0.16, -0.25, 0); g.add(legR);

    // Pies: esferas achatadas y alargadas hacia adelante (+z), color fijo
    // de zapato (no depende del tono de piel) -- así siempre se ven como
    // zapatitos puestos, no como pies desnudos.
    var shoeMat = new THREE.MeshStandardMaterial({ color: "#4a3728", roughness: 0.8 });
    var footGeo = new THREE.SphereGeometry(0.135, 10, 8);
    var footL = new THREE.Mesh(footGeo, shoeMat);
    footL.scale.set(1, 0.55, 1.35); footL.position.set(-0.16, -0.62, 0.04); g.add(footL);
    var footR = new THREE.Mesh(footGeo, shoeMat);
    footR.scale.set(1, 0.55, 1.35); footR.position.set(0.16, -0.62, 0.04); g.add(footR);

    return g;
  }

  // Oscurece un color hex un poco -- se usa para que la nariz/cejas no
  // sean el mismo tono plano de la piel/pelo, dan algo de relieve a la cara.
  function shade(hex, amt) {
    var c = new THREE.Color(hex || "#e0ac69");
    c.multiplyScalar(1 + amt);
    return c;
  }

  function buildHead(id, skinColor, eyeColor, eyebrowId, noseId, mouthId) {
    var mat = new THREE.MeshStandardMaterial({ color: skinColor || "#e0ac69", roughness: 0.6 });
    var oval = id === "head3d_02";
    var head = new THREE.Mesh(new THREE.SphereGeometry(0.42, 24, 20), mat);
    head.scale.set(1, oval ? 1.12 : 1, 0.92);
    head.position.y = 1.62;
    buildFace(head, skinColor, eyeColor, eyebrowId, noseId, mouthId);
    return head;
  }

  // Cara estilo Bitmoji/Snapchat: ojos grandes (esclera + iris + brillo),
  // cejas, nariz y boca -- todo geometría simple de three.js montada como
  // hijos del mesh de la cabeza, así rota/escala con ella. Cejas/nariz/
  // boca tienen 2-3 variantes cada una (ver avatar3dParts.js) para poder
  // personalizar la cara sin necesitar un rig/animación de verdad.
  function buildFace(head, skinColor, eyeColor, eyebrowId, noseId, mouthId) {
    // Los rasgos son HIJOS de head, así que sus posiciones son LOCALES al
    // origen de la cabeza (0,0,0) -- heredan el position.y=1.62 del padre
    // automáticamente. Sumar 1.62 aquí también (como el bug original de
    // "ojos simples") los mandaba a y=3.24 en el mundo, muy por encima de
    // la cabeza real -- por eso nunca se veían.
    var cy = 0;

    // Ojos: esclera blanca + iris de color elegible + punto de brillo, el
    // look "grande y expresivo" característico de Bitmoji.
    var scleraMat = new THREE.MeshStandardMaterial({ color: "#ffffff", roughness: 0.3 });
    var irisMat = new THREE.MeshStandardMaterial({ color: eyeColor || "#3a2418", roughness: 0.25 });
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

    // Cejas: 3 variantes -- recta (cápsula fina), arqueada (arco de
    // toro) o gruesa (cápsula más ancha).
    var browMat = new THREE.MeshStandardMaterial({ color: shade(skinColor, -0.55), roughness: 0.8 });
    [-1, 1].forEach(function (side) {
      var brow;
      if (eyebrowId === "eyebrow3d_02") { // arqueada
        brow = new THREE.Mesh(new THREE.TorusGeometry(0.06, 0.011, 6, 10, Math.PI * 0.65), browMat);
        brow.position.set(0.16 * side, cy + 0.135, 0.38);
        brow.rotation.z = Math.PI * 0.68 + side * 0.05;
        brow.rotation.y = side * 0.3;
      } else {
        var thick = eyebrowId === "eyebrow3d_03" ? 0.022 : 0.012;
        brow = new THREE.Mesh(new THREE.CapsuleGeometry(thick, 0.11, 4, 6), browMat);
        brow.position.set(0.16 * side, cy + 0.145, 0.375);
        brow.rotation.z = Math.PI / 2 + side * 0.18;
      }
      head.add(brow);
    });

    // Nariz: chica (bulto discreto) o marcada (más grande y protruida).
    var noseMat = new THREE.MeshStandardMaterial({ color: shade(skinColor, -0.08), roughness: 0.6 });
    var noseBig = noseId === "nose3d_02";
    var nose = new THREE.Mesh(new THREE.SphereGeometry(noseBig ? 0.05 : 0.038, 10, 10), noseMat);
    nose.scale.set(0.8, noseBig ? 1.15 : 1, noseBig ? 1.05 : 0.9);
    nose.position.set(0, cy - 0.06, noseBig ? 0.43 : 0.415);
    head.add(nose);

    // Boca: sonrisa (arco chico), neutral (línea recta) o sonrisón (arco
    // grande y más brillante -- casi enseñando dientes).
    var mouthMat = new THREE.MeshStandardMaterial({ color: "#7a3b3b", roughness: 0.5 });
    var mouth;
    if (mouthId === "mouth3d_02") { // neutral
      mouth = new THREE.Mesh(new THREE.CapsuleGeometry(0.008, 0.075, 4, 6), mouthMat);
      mouth.rotation.z = Math.PI / 2;
      mouth.position.set(0, cy - 0.155, 0.385);
    } else if (mouthId === "mouth3d_03") { // sonrisón
      mouth = new THREE.Mesh(new THREE.TorusGeometry(0.095, 0.02, 8, 16, Math.PI * 0.85), mouthMat);
      mouth.rotation.z = Math.PI + Math.PI * 0.075;
      mouth.position.set(0, cy - 0.165, 0.375);
    } else { // sonrisa (default)
      mouth = new THREE.Mesh(new THREE.TorusGeometry(0.07, 0.013, 8, 16, Math.PI), mouthMat);
      mouth.rotation.z = Math.PI; // voltea el arco para que abra hacia arriba (∪, sonrisa)
      mouth.position.set(0, cy - 0.16, 0.375);
    }
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

  // Antes la "camisa" era solo una banda de color (CylinderGeometry)
  // flotando encima de un torso 100% del color de piel -- se veía como
  // una pintura, no como ropa real. Ahora: una CÁPSULA que envuelve el
  // torso completo (mismo tipo de geometría que buildBody, un poco más
  // grande de radio para taparlo del todo), MANGAS de verdad sobre la
  // parte de arriba de cada brazo (mismo origen/rotación que armL/armR en
  // buildBody, pero más gruesas que el brazo desnudo), un cuello, y un
  // PANTALÓN corto sobre la parte de arriba de cada pierna -- así ya no
  // queda piel desnuda de brazos/piernas por debajo de "ropa puesta".
  function buildOutfit(id) {
    if (!id) return null;
    var g = new THREE.Group();
    var colorsById = { outfit3d_01: "#7a1e3a", outfit3d_02: "#3c5a7a", outfit3d_03: "#3a7a4e" };
    var c = colorsById[id] || "#7a1e3a";
    var shirtMat = new THREE.MeshStandardMaterial({ color: c, roughness: 0.7 });

    // Radio/alto suficiente para envolver el torso completo (buildBody
    // v5: radio hasta 0.38 en el cuerpo grande, centro en y=0.62) -- si
    // quedara más chica, la piel se asoma por los bordes. Adelgazada
    // junto con el torso (antes 0.49) para que la camisa no se vea
    // como un huevo -- ahora sigue de cerca la silueta más esbelta.
    var shirt = new THREE.Mesh(new THREE.CapsuleGeometry(0.44, 0.56, 6, 12), shirtMat);
    shirt.position.y = 0.6;
    g.add(shirt);

    // Mangas: mismo origen/rotación que armL/armR (buildBody v3, hombro a
    // y=0.9, brazo casi vertical), pero con radio mayor y solo cubriendo
    // la parte de arriba del brazo -- así se ven como tela encima del
    // brazo, no como el brazo repintado.
    var sleeveGeo = new THREE.CapsuleGeometry(0.1, 0.2, 4, 8);
    var sleeveL = new THREE.Mesh(sleeveGeo, shirtMat);
    sleeveL.position.set(-0.39, 1.0, 0); sleeveL.rotation.z = 0.12; g.add(sleeveL);
    var sleeveR = new THREE.Mesh(sleeveGeo, shirtMat);
    sleeveR.position.set(0.39, 1.0, 0); sleeveR.rotation.z = -0.12; g.add(sleeveR);

    // Cuello de la camisa: a la altura de la base del cuello (buildBody
    // v2 pone el cuello en y=1.3, radio inferior 0.15).
    var collarRadius = id === "outfit3d_03" ? 0.055 : 0.04;
    var collar = new THREE.Mesh(new THREE.TorusGeometry(0.17, collarRadius, 8, 16), shirtMat);
    collar.position.y = 1.22; collar.rotation.x = Math.PI / 2; g.add(collar);

    if (id === "outfit3d_02") { // hoodie -- capucha, detrás de la cabeza
      var hood = new THREE.Mesh(new THREE.TorusGeometry(0.25, 0.08, 8, 16, Math.PI), shirtMat);
      hood.position.set(0, 1.55, -0.15); hood.rotation.x = Math.PI; g.add(hood);
    }

    // Pantalón: mismo origen que legL/legR (buildBody v2), solo la mitad
    // de arriba de cada pierna, color neutro fijo (no depende del outfit).
    var pantsMat = new THREE.MeshStandardMaterial({ color: "#33414f", roughness: 0.8 });
    var pantsGeo = new THREE.CapsuleGeometry(0.135, 0.2, 4, 8);
    var pantsL = new THREE.Mesh(pantsGeo, pantsMat);
    pantsL.position.set(-0.16, 0.0, 0); g.add(pantsL);
    var pantsR = new THREE.Mesh(pantsGeo, pantsMat);
    pantsR.position.set(0.16, 0.0, 0); g.add(pantsR);

    return g;
  }

  function buildAccessory(id) {
    if (!id) return null;
    var g = new THREE.Group();
    if (id === "acc3d_01") { // lentes
      // v2: quedaban a la misma z que los ojos (0.4, adentro del rango
      // esclera-iris-pupila-brillo de buildFace que llega hasta z=0.43),
      // así que se enterraban dentro del ojo en vez de verse claramente
      // ENFRENTE de la cara. Ahora salen más al frente (z=0.46) y cada
      // aro lleva un cristal (disco semi-transparente) adentro -- sin
      // eso, de frente un aro delgado casi no se distingue como lente.
      var frameMat = new THREE.MeshStandardMaterial({ color: "#1c1c1c", roughness: 0.4 });
      var glassMat = new THREE.MeshStandardMaterial({
        color: "#bcd9e8", roughness: 0.15, metalness: 0.1, transparent: true, opacity: 0.35,
      });
      var lensGeo = new THREE.TorusGeometry(0.095, 0.018, 8, 16);
      var glassGeo = new THREE.CircleGeometry(0.09, 16);
      [-1, 1].forEach(function (side) {
        var lx = 0.155 * side;
        var frame = new THREE.Mesh(lensGeo, frameMat);
        frame.position.set(lx, 1.62, 0.46);
        g.add(frame);
        var glass = new THREE.Mesh(glassGeo, glassMat);
        glass.position.set(lx, 1.62, 0.455);
        g.add(glass);
      });
      var bridge = new THREE.Mesh(new THREE.CylinderGeometry(0.014, 0.014, 0.09, 6), frameMat);
      bridge.position.set(0, 1.625, 0.46); bridge.rotation.z = Math.PI / 2; g.add(bridge);
      // Patillas hacia las orejas, para que se lean como lentes puestos
      // y no como un antifaz flotando.
      [-1, 1].forEach(function (side) {
        var temple = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, 0.16, 6), frameMat);
        temple.position.set(0.245 * side, 1.625, 0.34);
        temple.rotation.y = side * 0.55;
        g.add(temple);
      });
    } else if (id === "acc3d_02") { // gorra
      // v2: el domo (radio 0.45, casquete desde el polo norte) quedaba
      // centrado casi en el centro de la cabeza (y=1.68 contra el centro
      // real de la cabeza en 1.62) en vez de apoyado ENCIMA de ella --
      // se veía enterrada/mal puesta. Ahora se apoya justo sobre la
      // parte de arriba de la cabeza (~y=1.9) y la visera es más ancha
      // y plana, saliendo claramente hacia el frente.
      var capMat = new THREE.MeshStandardMaterial({ color: "#7a1e3a", roughness: 0.6 });
      var dome = new THREE.Mesh(new THREE.SphereGeometry(0.44, 18, 14, 0, Math.PI * 2, 0, Math.PI * 0.52), capMat);
      dome.position.y = 1.88;
      g.add(dome);
      var brim = new THREE.Mesh(new THREE.CylinderGeometry(0.26, 0.26, 0.035, 20), capMat);
      brim.position.set(0, 1.72, 0.32);
      brim.scale.set(1, 1, 0.75);
      g.add(brim);
      // Botoncito arriba, detalle típico de gorra de beisbol.
      var button = new THREE.Mesh(new THREE.SphereGeometry(0.03, 8, 8), capMat);
      button.position.set(0, 2.2, 0);
      g.add(button);
    }
    return g;
  }

  function rebuild(next) {
    current = next;
    var p = next.parts || {};
    var c = next.colors || {};

    clearSlot("body"); clearSlot("head"); clearSlot("hair"); clearSlot("outfit"); clearSlot("accessory");

    var body = buildBody(p.body, c.skin, p.pose);
    avatarGroup.add(body); partMeshes.body = body;

    var head = buildHead(p.head, c.skin, c.eyes, p.eyebrow, p.nose, p.mouth);
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
