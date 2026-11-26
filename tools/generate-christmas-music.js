#!/usr/bin/env node
/* eslint-disable no-console */
//
// tools/generate-christmas-music.js
//
// Música navideña de fondo de la app: tres villancicos de DOMINIO PÚBLICO
// (Jingle Bells, We Wish You a Merry Christmas, Deck the Halls) arreglados
// para caja musical + piano eléctrico suave + bajo + cascabeles, con reverb.
// Es síntesis pura, sin grabaciones de terceros: no hay derechos de autor de
// por medio y el resultado es reproducible.
//
//   node tools/generate-christmas-music.js
//     -> assets/audio/navidad-1.m4a, navidad-2.m4a, navidad-3.m4a  (requiere ffmpeg)
//
'use strict';

const fs = require('fs');
const os = require('os');
const path = require('path');
const { execFileSync } = require('child_process');

const SR = 32000;
const TWO_PI = Math.PI * 2;
const mtof = (m) => 440 * Math.pow(2, (m - 69) / 12);

function mulberry32(a) {
  return function () {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Notas: nombre -> MIDI (octava 4 = C4 60)
const NOTE = (s) => {
  const m = /^([A-G])(#|b)?(\d)$/.exec(s);
  const base = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 }[m[1]];
  return 12 * (Number(m[3]) + 1) + base + (m[2] === '#' ? 1 : m[2] === 'b' ? -1 : 0);
};
// "E5:1 G5:0.5 -:1" -> [{n, d}] (n=null = silencio)
const mel = (str) => str.trim().split(/\s+/).map((tok) => {
  const [n, d] = tok.split(':');
  return { n: n === '-' ? null : NOTE(n), d: Number(d) };
});
const TRIADS = {
  C: ['C4', 'E4', 'G4'], F: ['F4', 'A4', 'C5'], G: ['G3', 'B3', 'D4'], G7: ['G3', 'B3', 'F4'],
  D: ['D4', 'F#4', 'A4'], D7: ['D4', 'F#4', 'C5'], A: ['A3', 'C#4', 'E4'], Am: ['A3', 'C4', 'E4'],
  Em: ['E4', 'G4', 'B4'], B: ['B3', 'D#4', 'F#4'], Dm: ['D4', 'F4', 'A4'],
};
const BASS = { C: 'C3', F: 'F2', G: 'G2', G7: 'G2', D: 'D3', D7: 'D3', A: 'A2', Am: 'A2', Em: 'E3', B: 'B2', Dm: 'D3' };

// ───────────────────────── Canciones (dominio público) ─────────────────────────
const SONGS = [
  {
    file: 'navidad-1', title: 'Jingle Bells', bpm: 132, meter: 4, pickup: 0,
    melody: mel(`
      E5:1 E5:1 E5:2   E5:1 E5:1 E5:2   E5:1 G5:1 C5:1.5 D5:0.5   E5:4
      F5:1 F5:1 F5:1.5 F5:0.5   F5:1 E5:1 E5:1 E5:0.5 E5:0.5   E5:1 D5:1 D5:1 E5:1   D5:2 G5:2
      E5:1 E5:1 E5:2   E5:1 E5:1 E5:2   E5:1 G5:1 C5:1.5 D5:0.5   E5:4
      F5:1 F5:1 F5:1 F5:1   F5:1 E5:1 E5:1 E5:0.5 E5:0.5   G5:1 G5:1 F5:1 D5:1   C5:4`),
    chords: ['C', 'C', 'C', 'C', 'F', 'C', 'G', 'G', 'C', 'C', 'C', 'C', 'F', 'C', 'G7', 'C'],
  },
  {
    file: 'navidad-2', title: 'We Wish You a Merry Christmas', bpm: 168, meter: 3, pickup: 1,
    melody: mel(`
      D5:1
      G5:1 G5:0.5 A5:0.5 G5:0.5 F#5:0.5   E5:1 C5:1 E5:1   A5:1 A5:0.5 B5:0.5 A5:0.5 G5:0.5   F#5:1 D5:1 F#5:1
      B5:1 B5:0.5 C6:0.5 B5:0.5 A5:0.5   G5:1 E5:1 D5:0.5 D5:0.5   E5:1 A5:1 F#5:1   G5:2 D5:1
      G5:1 G5:0.5 A5:0.5 G5:0.5 F#5:0.5   E5:1 C5:1 E5:1   A5:1 A5:0.5 B5:0.5 A5:0.5 G5:0.5   F#5:1 D5:1 F#5:1
      B5:1 B5:0.5 C6:0.5 B5:0.5 A5:0.5   G5:1 E5:1 D5:0.5 D5:0.5   E5:1 A5:1 F#5:1   G5:3`),
    chords: ['G', 'C', 'D', 'D', 'Em', 'C', 'D7', 'G', 'G', 'C', 'D', 'D', 'Em', 'C', 'D7', 'G'],
  },
  {
    file: 'navidad-3', title: 'Deck the Halls', bpm: 126, meter: 4, pickup: 0,
    melody: mel(`
      G5:1.5 F5:0.5 E5:1 D5:1   C5:1 D5:1 E5:1 C5:1   D5:0.5 E5:0.5 F5:0.5 D5:0.5 E5:1.5 D5:0.5   C5:1 B4:1 C5:2
      G5:1.5 F5:0.5 E5:1 D5:1   C5:1 D5:1 E5:1 C5:1   D5:0.5 E5:0.5 F5:0.5 D5:0.5 E5:1.5 D5:0.5   C5:1 B4:1 C5:2
      D5:1.5 E5:0.5 F5:1 D5:1   E5:1.5 F5:0.5 G5:1 D5:1   E5:0.5 F#5:0.5 G5:1 A5:0.5 B5:0.5 C6:1   B5:1 A5:1 G5:2
      G5:1.5 F5:0.5 E5:1 D5:1   C5:1 D5:1 E5:1 C5:1   A5:0.5 A5:0.5 A5:0.5 A5:0.5 G5:1.5 F5:0.5   E5:1 D5:1 C5:2`),
    chords: ['C', 'C', 'G', 'C', 'C', 'C', 'G', 'C', 'G', 'G', 'D', 'G', 'C', 'C', 'F', 'C'],
  },
];

// ───────────────────────── Instrumentos ─────────────────────────
function addTone(buf, start, dur, freq, amp, partials, decay, pan = 0) {
  const s0 = Math.round(start * SR);
  const len = Math.round((dur + 2.5) * SR);
  const gl = amp * Math.cos((pan + 1) * Math.PI / 4), gr = amp * Math.sin((pan + 1) * Math.PI / 4);
  for (let i = 0; i < len && s0 + i < buf.L.length; i++) {
    const t = i / SR;
    const att = Math.min(1, t / 0.004);
    const rel = t > dur + 0.05 ? Math.exp(-(t - dur - 0.05) * 6) : 1;
    let v = 0;
    for (const [mult, a, dk] of partials) {
      const f = freq * mult;
      if (f > SR / 2.2) continue;
      v += a * Math.sin(TWO_PI * f * t) * Math.exp(-t * decay * dk);
    }
    v *= att * rel;
    buf.L[s0 + i] += v * gl;
    buf.R[s0 + i] += v * gr;
  }
}
const MUSIC_BOX = [[1, 1, 1], [2, 0.42, 1.6], [3, 0.16, 2.4], [4.16, 0.12, 3.2], [5.43, 0.05, 4]];
const EPIANO = [[1, 1, 1], [2, 0.3, 1.5], [3, 0.08, 2]];
const BASS_TONE = [[1, 1, 1], [2, 0.25, 1.3]];

function sleighBells(buf, start, amp, rnd) {
  // ráfaga de 6-9 "cascabelitos" agudos muy cortos
  const n = 6 + Math.floor(rnd() * 4);
  for (let k = 0; k < n; k++) {
    const off = start + rnd() * 0.035;
    const f = 5200 + rnd() * 4800;
    const s0 = Math.round(off * SR), len = Math.round(0.09 * SR);
    const pan = (rnd() * 2 - 1) * 0.5;
    const gl = Math.cos((pan + 1) * Math.PI / 4), gr = Math.sin((pan + 1) * Math.PI / 4);
    for (let i = 0; i < len && s0 + i < buf.L.length; i++) {
      const t = i / SR;
      const v = amp / n * 2.2 * Math.sin(TWO_PI * f * t + rnd() * 0.0) * Math.exp(-t * 55) * (1 + 0.5 * Math.sin(TWO_PI * (f * 1.47) * t));
      buf.L[s0 + i] += v * gl; buf.R[s0 + i] += v * gr;
    }
  }
}

// Reverb Schroeder sencillo
function reverb(x, mix = 0.24, seedOff = 0) {
  const combs = [1557, 1617, 1491, 1422].map((d) => Math.round((d + seedOff) * SR / 44100));
  const aps = [225, 556].map((d) => Math.round(d * SR / 44100));
  const y = new Float32Array(x.length);
  for (const d of combs) {
    const b = new Float32Array(d); let idx = 0, lp = 0;
    for (let i = 0; i < x.length; i++) {
      const out = b[idx]; lp = out * 0.75 + lp * 0.25;
      b[idx] = x[i] + lp * 0.8; idx = (idx + 1) % d; y[i] += out / combs.length;
    }
  }
  for (const d of aps) {
    const b = new Float32Array(d); let idx = 0;
    for (let i = 0; i < y.length; i++) {
      const bo = b[idx]; const inp = y[i]; const out = -inp + bo;
      b[idx] = inp + bo * 0.5; idx = (idx + 1) % d; y[i] = out;
    }
  }
  const o = new Float32Array(x.length);
  for (let i = 0; i < x.length; i++) o[i] = x[i] * (1 - mix) + y[i] * mix * 1.6;
  return o;
}

function render(song) {
  const rnd = mulberry32(1225 + song.file.length * 7 + song.bpm);
  const beat = 60 / song.bpm;
  const bar = beat * song.meter;
  const melBeats = song.melody.reduce((a, b) => a + b.d, 0);
  const passBeats = melBeats; // incluye anacrusa
  const intro = bar; // un compás de cascabeles + acorde
  const passes = 2;
  const total = intro + passes * passBeats * beat + 3.5;
  const buf = { L: new Float32Array(Math.ceil(total * SR)), R: new Float32Array(Math.ceil(total * SR)) };

  // Intro
  addTone(buf, 0, bar, mtof(NOTE(BASS[song.chords[0]])), 0.22, BASS_TONE, 1.2);
  TRIADS[song.chords[0]].forEach((n, i) => addTone(buf, 0.02 * i, bar, mtof(NOTE(n)), 0.09, EPIANO, 1.1, (i - 1) * 0.35));

  for (let p = 0; p < passes; p++) {
    const t0 = intro + p * passBeats * beat;
    // melodía
    let t = t0;
    for (const { n, d } of song.melody) {
      if (n != null) {
        addTone(buf, t, d * beat, mtof(n), 0.30, MUSIC_BOX, 2.2, 0.05);
        if (p === 1) addTone(buf, t + 0.012, d * beat, mtof(n - 12), 0.13, EPIANO, 2.0, -0.25); // 2ª vuelta: doblada abajo
      }
      t += d * beat;
    }
    // acompañamiento por compás (después de la anacrusa)
    const tb = t0 + song.pickup * beat;
    song.chords.forEach((ch, b) => {
      const bt = tb + b * bar;
      addTone(buf, bt, beat * 1.8, mtof(NOTE(BASS[ch])), 0.24, BASS_TONE, 1.6);
      if (song.meter === 4) addTone(buf, bt + 2 * beat, beat * 1.8, mtof(NOTE(BASS[ch]) + 7), 0.18, BASS_TONE, 1.6);
      for (let k = song.meter === 3 ? 1 : 0; k < song.meter; k += song.meter === 3 ? 1 : 2) {
        const kt = song.meter === 3 ? bt + k * beat : bt + (k + 1) * beat;
        TRIADS[ch].forEach((n, i) => addTone(buf, kt + 0.008 * i, beat * 0.9, mtof(NOTE(n)), 0.075, EPIANO, 2.4, (i - 1) * 0.4));
      }
    });
    // cascabeles a corcheas, acento en 2 y 4 (o en 1 en 3/4)
    const steps = Math.floor(passBeats * 2);
    for (let s = 0; s < steps; s++) {
      const st = t0 + s * beat / 2;
      const beatIdx = Math.floor((s / 2 - song.pickup) + 1000 * song.meter) % song.meter;
      const onBeat = s % 2 === 0;
      const accent = song.meter === 4 ? onBeat && (beatIdx === 1 || beatIdx === 3) : onBeat && beatIdx === 0;
      sleighBells(buf, st, accent ? 0.11 : onBeat ? 0.06 : 0.035, rnd);
    }
  }
  // cascabeles de intro
  for (let s = 0; s < song.meter * 2; s++) sleighBells(buf, s * beat / 2, s % 2 ? 0.035 : 0.07, rnd);
  // final: acorde de tónica largo
  const end = intro + passes * passBeats * beat;
  const last = song.chords[song.chords.length - 1];
  addTone(buf, end, 2.5, mtof(NOTE(BASS[last])), 0.2, BASS_TONE, 0.8);
  TRIADS[last].forEach((n, i) => addTone(buf, end + 0.03 * i, 2.5, mtof(NOTE(n) + 12), 0.12, MUSIC_BOX, 0.9, (i - 1) * 0.4));

  // reverb + normalizar + fades
  const L = reverb(buf.L, 0.24, 0), R = reverb(buf.R, 0.24, 23);
  let peak = 0;
  for (let i = 0; i < L.length; i++) peak = Math.max(peak, Math.abs(L[i]), Math.abs(R[i]));
  const g = 0.85 / peak;
  const fin = Math.round(0.02 * SR), fout = Math.round(1.5 * SR);
  for (let i = 0; i < L.length; i++) {
    let e = 1;
    if (i < fin) e = i / fin;
    if (i > L.length - fout) e = (L.length - i) / fout;
    L[i] = Math.tanh(L[i] * g * 1.05) * e; R[i] = Math.tanh(R[i] * g * 1.05) * e;
  }
  return { L, R };
}

function writeWav(file, { L, R }) {
  const n = L.length, data = Buffer.alloc(n * 4);
  for (let i = 0; i < n; i++) {
    data.writeInt16LE(Math.max(-32767, Math.min(32767, Math.round(L[i] * 32767))), i * 4);
    data.writeInt16LE(Math.max(-32767, Math.min(32767, Math.round(R[i] * 32767))), i * 4 + 2);
  }
  const h = Buffer.alloc(44);
  h.write('RIFF', 0); h.writeUInt32LE(36 + data.length, 4); h.write('WAVE', 8); h.write('fmt ', 12);
  h.writeUInt32LE(16, 16); h.writeUInt16LE(1, 20); h.writeUInt16LE(2, 22); h.writeUInt32LE(SR, 24);
  h.writeUInt32LE(SR * 4, 28); h.writeUInt16LE(4, 32); h.writeUInt16LE(16, 34); h.write('data', 36); h.writeUInt32LE(data.length, 40);
  fs.writeFileSync(file, Buffer.concat([h, data]));
}

const outDir = path.join(__dirname, '..', 'assets', 'audio');
const keepWav = process.argv.includes('--wav');
for (const song of SONGS) {
  const wav = keepWav ? path.join(outDir, `${song.file}.wav`) : path.join(os.tmpdir(), `${song.file}.wav`);
  writeWav(wav, render(song));
  const m4a = path.join(outDir, `${song.file}.m4a`);
  execFileSync('ffmpeg', ['-y', '-loglevel', 'error', '-i', wav, '-c:a', 'aac', '-b:a', '96k', m4a]);
  if (!keepWav) fs.unlinkSync(wav);
  console.log(`🎄 ${song.title} -> ${path.relative(process.cwd(), m4a)} (${(fs.statSync(m4a).size / 1024).toFixed(0)} KB)`);
}
