// plugins/withoutAudioRecording.js
//
// La app solo REPRODUCE música de fondo (expo-audio), nunca graba. Pero el
// AndroidManifest de la librería expo-audio declara por su cuenta el permiso
// RECORD_AUDIO y servicios en primer plano (grabación y controles de pantalla
// de bloqueo) que Google Play trataría como permisos sensibles a justificar.
// Este plugin los QUITA del manifiesto final con tools:node="remove".
// Nada de esto se usa: no se llama a ningún API de grabación ni de controles.
const { withAndroidManifest } = require('expo/config-plugins');

const PERMISSIONS_TO_REMOVE = [
  'android.permission.RECORD_AUDIO',
  'android.permission.FOREGROUND_SERVICE_MEDIA_PLAYBACK',
];
const SERVICES_TO_REMOVE = [
  'expo.modules.audio.service.AudioRecordingService',
  'expo.modules.audio.service.AudioControlsService',
];

module.exports = function withoutAudioRecording(config) {
  return withAndroidManifest(config, (mod) => {
    const manifest = mod.modResults.manifest;
    manifest.$['xmlns:tools'] = 'http://schemas.android.com/tools';

    manifest['uses-permission'] = manifest['uses-permission'] || [];
    for (const name of PERMISSIONS_TO_REMOVE) {
      manifest['uses-permission'] = manifest['uses-permission'].filter((p) => p.$['android:name'] !== name);
      manifest['uses-permission'].push({ $: { 'android:name': name, 'tools:node': 'remove' } });
    }

    const app = manifest.application[0];
    app.service = app.service || [];
    for (const name of SERVICES_TO_REMOVE) {
      app.service = app.service.filter((s) => s.$['android:name'] !== name);
      app.service.push({ $: { 'android:name': name, 'tools:node': 'remove' } });
    }
    return mod;
  });
};
