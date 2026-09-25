#!/usr/bin/env node
/* eslint-disable no-console */
//
// tools/generate-game-music.js
//
// Compone la música de fondo de los minijuegos: un loop ORIGINAL de deep house
// (estilo club londinense: 120 BPM, acordes tipo Rhodes en La menor, bajo
// redondo, hi-hats abiertos a contratiempo, "sidechain" del bombo).
// Es síntesis pura, sin muestras de terceros: no hay derechos de autor de
// por medio y el resultado es reproducible (semilla fija).
//
//   node tools/generate-game-music.js            -> assets/audio/london-deep-house.wav
//
// Se puede reemplazar por otra pista (mismo nombre de archivo, .wav) sin tocar
// código. Todo lo "musical" está arriba, en las constantes: tempo, progresión,
// patrones y niveles de cada instrumento.
'use strict';

const fs = require('fs');
const path = require('path');

// ───────────────────────── Parámetros ─────────────────────────
const SR = 22050; // suficiente para fondo; mantiene el archivo chico (~2.8 MB)
const BPM = 120;
const BARS = 16; // 8 compases "A" (base) + 8 compases "B" (con arpegio y clap)
const STEPS = 16; // semicorcheas por compás
const BEAT = 60 / BPM;
const BAR = BEAT * 4;
const STEP = BAR / STEPS;
const N = Math.round(BARS * BAR * SR); // largo EXACTO del loop
const TAIL = Math.round(3 * SR); // cola de reverb/delay que se pliega al inicio
const LEN = N + TAIL;

// Niveles (antes del master)
const LV = { kick: 0.42, bass: 0.26, chords: 0.78, pad: 0.30, pluck: 0.55, hats: 0.50, clap: 0.50, shaker: 0.30, sweep: 0.05 };

// Progresión (2 compases por acorde, ×2 = 16 compases): Am9 – Dm9 – Fmaj9 – G6/9
const CHORDS = [
  { name: 'Am9', root: 45, tones: [57, 60, 64, 67, 71] },
  { name: 'Dm9', root: 50, tones: [53, 57, 60, 64, 69] },
  { name: 'Fmaj9', root: 41, tones: [57, 60, 64, 67, 72] },
  { name: 'G6/9', root: 43, tones: [59, 62, 64, 69, 74] },
];
const chordAtBar = (bar) => CHORDS[Math.floor((bar % 8) / 2)];

const BASS_A = [
  { s: 2, n: 0, v: 1.0, l: 1.6 }, { s: 5, n: 0, v: 0.7, l: 1.0 }, { s: 7, n: 12, v: 0.8, l: 1.0 },
  { s: 10, n: 0, v: 1.0, l: 1.6 }, { s: 13, n: 7, v: 0.7, l: 1.6 },
];
const BASS_B = [
  { s: 2, n: 0, v: 1.0, l: 1.6 }, { s: 3, n: 12, v: 0.55, l: 0.8 }, { s: 6, n: 0, v: 0.9, l: 1.6 },
  { s: 10, n: 0, v: 1.0, l: 1.6 }, { s: 11, n: 7, v: 0.55, l: 0.8 }, { s: 14, n: 0, v: 0.8, l: 1.4 },
];
const STAB_STEPS = [{ s: 0, v: 1.0 }, { s: 3, v: 0.7 }, { s: 6, v: 0.85 }, { s: 10, v: 0.7 }];
const PLUCK_SEQ = [0, 2, 4, 2, 3, 1, 2, 4, 3, 2, 1, 3, 4, 2, 3, 1];
const PLUCK_MASK = [1, 0, 1, 1, 0, 1, 0, 1, 1, 0, 1, 0, 1, 1, 0, 1];

// ───────────────────────── Utilidades DSP ─────────────────────────
function mulberry32(a) {
  return function () {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const rnd = mulberry32(20260925);
const noise = () => rnd() * 2 - 1;
const mtof = (m) => 440 * Math.pow(2, (m - 69) / 12);
const TWO_PI = Math.PI * 2;

const stereo = () => ({ L: new Float32Array(LEN), R: new Float32Array(LEN) });

/** Biquad RBJ (LP/HP/BP) con estado propio. */
function biquad(type, fc, q = 0.707) {
  const w = (TWO_PI * fc) / SR, cos = Math.cos(w), sin = Math.sin(w), alpha = sin / (2 * q);
  let b0, b1, b2;
  const a0 = 1 + alpha, a1 = -2 * cos, a2 = 1 - alpha;
  if (type === 'lp') { b0 = (1 - cos) / 2; b1 = 1 - cos; b2 = (1 - cos) / 2; }
  else if (type === 'hp') { b0 = (1 + cos) / 2; b1 = -(1 + cos); b2 = (1 + cos) / 2; }
  else { b0 = alpha; b1 = 0; b2 = -alpha; } // bp
  let x1 = 0, x2 = 0, y1 = 0, y2 = 0;
  return (x) => {
    const y = (b0 * x + b1 * x1 + b2 * x2 - a1 * y1 - a2 * y2) / a0;
    x2 = x1; x1 = x; y2 = y1; y1 = y;
    return y;
  };
}

function addAt(bus, start, i, l, r) {
  const k = start + i;
  if (k >= LEN) return;
  bus.L[k] += l; bus.R[k] += r;
}

// ───────────────────────── Instrumentos ─────────────────────────
function kick(drums, t0, vel) {
  const s0 = Math.round(t0 * SR), dur = Math.round(0.5 * SR);
  let phase = 0;
  for (let i = 0; i < dur; i++) {
    const t = i / SR;
    phase += (TWO_PI * (58 + 120 * Math.exp(-t / 0.028))) / SR;
    const env = (1 - Math.exp(-t / 0.002)) * Math.exp(-t / 0.13);
    const s = (Math.sin(phase) * env + noise() * (1 - Math.exp(-t / 0.0007)) * Math.exp(-t / 0.003) * 0.35) * vel * LV.kick;
    addAt(drums, s0, i, s, s);
  }
}

function hat(drums, rev, t0, vel, open, pan) {
  const s0 = Math.round(t0 * SR), dur = Math.round((open ? 0.3 : 0.08) * SR);
  const hp = biquad('hp', open ? 5500 : 7000, 0.8), tau = open ? 0.085 : 0.016;
  for (let i = 0; i < dur; i++) {
    const s = hp(noise()) * Math.exp(-i / SR / tau) * vel * LV.hats;
    addAt(drums, s0, i, s * (1 - pan), s * (1 + pan));
    addAt(rev, s0, i, s * 0.06, s * 0.06);
  }
}

function clap(drums, rev, t0, vel) {
  const hits = [0, 0.011, 0.022], amps = [1, 0.8, 0.6];
  for (let h = 0; h < hits.length; h++) {
    const s0 = Math.round((t0 + hits[h]) * SR), dur = Math.round(0.22 * SR);
    const bp = biquad('bp', 1300, 1.1);
    const tau = h === hits.length - 1 ? 0.07 : 0.018;
    for (let i = 0; i < dur; i++) {
      const s = bp(noise()) * Math.exp(-i / SR / tau) * amps[h] * vel * LV.clap;
      addAt(drums, s0, i, s, s);
      addAt(rev, s0, i, s * 0.5, s * 0.5);
    }
  }
}

function shaker(drums, t0, vel, pan) {
  const s0 = Math.round(t0 * SR), dur = Math.round(0.05 * SR), hp = biquad('hp', 8500, 0.7);
  for (let i = 0; i < dur; i++) {
    const s = hp(noise()) * Math.exp(-i / SR / 0.014) * vel * LV.shaker;
    addAt(drums, s0, i, s * (1 - pan), s * (1 + pan));
  }
}

function bassNote(bass, t0, midi, dur, vel) {
  const s0 = Math.round(t0 * SR), n = Math.round((dur + 0.08) * SR), f = mtof(midi);
  let ph = 0;
  for (let i = 0; i < n; i++) {
    const t = i / SR;
    ph += (TWO_PI * f) / SR;
    const raw = Math.sin(ph) + 0.9 * Math.sin(2 * ph) + 0.55 * Math.sin(3 * ph) + 0.25 * Math.sin(4 * ph);
    const env = (1 - Math.exp(-t / 0.004)) * Math.exp(-t / 0.15) * (t < dur ? 1 : Math.exp(-(t - dur) / 0.02));
    const s = Math.tanh(raw * 1.4) * env * vel * LV.bass * 0.7;
    addAt(bass, s0, i, s, s);
  }
}

function epStab(chords, rev, t0, tones, vel, len) {
  const s0 = Math.round(t0 * SR), n = Math.round((len + 0.35) * SR);
  const partials = [1, 2, 3, 4.01, 6.02], amps = [1, 0.5, 0.18, 0.08, 0.04];
  tones.forEach((m, vi) => {
    const f = mtof(m);
    for (const [ch, det] of [['L', 0.9985], ['R', 1.0015]]) {
      let ph = partials.map(() => 0);
      for (let i = 0; i < n; i++) {
        const t = i / SR;
        let s = 0;
        for (let p = 0; p < partials.length; p++) {
          ph[p] += (TWO_PI * f * det * partials[p]) / SR;
          s += Math.sin(ph[p]) * amps[p] * Math.exp(-t / (0.5 / partials[p]));
        }
        const gate = t < len ? 1 : Math.exp(-(t - len) / 0.06);
        const trem = 1 + 0.06 * Math.sin(TWO_PI * 4.5 * t + vi);
        const v = s * (1 - Math.exp(-t / 0.004)) * gate * trem * vel * LV.chords * 0.28;
        const k = s0 + i;
        if (k < LEN) { chords[ch][k] += v; rev[ch][k] += v * 0.35; }
      }
    }
  });
}

function padChord(pad, rev, t0, dur, tones) {
  const s0 = Math.round((t0 - 0.7) * SR), total = Math.round((dur + 1.6) * SR);
  const att = 0.7, rel = 0.9;
  tones.forEach((m) => {
    for (const [ch, det] of [['L', 0.997], ['R', 1.003]]) {
      const f = mtof(m - 12) * det;
      let ph1 = 0, ph2 = 0;
      const lp1 = biquad('lp', 850, 0.6), lp2 = biquad('lp', 850, 0.6);
      for (let i = 0; i < total; i++) {
        const t = i / SR; // 0 = `att` segundos ANTES del inicio del acorde
        // sube durante att (llega a tope justo al inicio del acorde), sostiene dur, baja durante rel
        const env = Math.min(1, t / att) * Math.min(1, Math.max(0, (att + dur + rel - t) / rel));
        ph1 += (TWO_PI * f) / SR; ph2 += (TWO_PI * f * 1.006) / SR;
        const saw = (2 * ((ph1 / TWO_PI) % 1) - 1) + (2 * ((ph2 / TWO_PI) % 1) - 1);
        const s = lp2(lp1(saw)) * env * LV.pad * 0.5;
        const k = s0 + i;
        if (k >= 0 && k < LEN) { pad[ch][k] += s; rev[ch][k] += s * 0.25; }
        else if (k < 0) { const kk = k + N; if (kk >= 0 && kk < LEN) { pad[ch][kk] += s; rev[ch][kk] += s * 0.25; } }
      }
    }
  });
}

function pluck(pl, rev, t0, midi, vel, pan) {
  const s0 = Math.round(t0 * SR), n = Math.round(0.4 * SR), f = mtof(midi);
  let ph = 0;
  for (let i = 0; i < n; i++) {
    const t = i / SR;
    ph += (TWO_PI * f) / SR;
    const tri = (2 / Math.PI) * Math.asin(Math.sin(ph));
    const s = (0.7 * Math.sin(ph) + 0.3 * tri) * (1 - Math.exp(-t / 0.002)) * Math.exp(-t / 0.11) * vel * LV.pluck;
    addAt(pl, s0, i, s * (1 - pan), s * (1 + pan));
    addAt(rev, s0, i, s * 0.3, s * 0.3);
  }
}

// ───────────────────────── Efectos ─────────────────────────
/** Delay "ping-pong" de corchea con puntillo. */
function pingPong(bus, timeSec, feedback, mix) {
  const d = Math.round(timeSec * SR);
  const outL = new Float32Array(LEN), outR = new Float32Array(LEN);
  for (let i = 0; i < LEN; i++) {
    const inL = bus.L[i], inR = bus.R[i];
    const dl = i - d >= 0 ? outR[i - d] : 0; // L recibe lo que sonó en R
    const dr = i - d >= 0 ? outL[i - d] : 0;
    outL[i] = inL + dl * feedback;
    outR[i] = inR + dr * feedback;
  }
  for (let i = 0; i < LEN; i++) { bus.L[i] = bus.L[i] + (outL[i] - bus.L[i]) * mix; bus.R[i] = bus.R[i] + (outR[i] - bus.R[i]) * mix; }
}

/** Reverb tipo Freeverb (4 combs + 2 allpass por canal). Devuelve el "wet". */
function reverb(sendBus) {
  const scale = SR / 44100;
  const combLens = [1116, 1188, 1277, 1356].map((x) => Math.round(x * scale));
  const apLens = [556, 441].map((x) => Math.round(x * scale));
  const process = (input, spread) => {
    const out = new Float32Array(LEN);
    const combs = combLens.map((len) => ({ buf: new Float32Array(len + spread), i: 0, store: 0, len: len + spread }));
    const aps = apLens.map((len) => ({ buf: new Float32Array(len + spread), i: 0, len: len + spread }));
    const fb = 0.8, damp = 0.35;
    for (let n = 0; n < LEN; n++) {
      const x = input[n] * 0.03;
      let acc = 0;
      for (const c of combs) {
        const y = c.buf[c.i];
        c.store = y * (1 - damp) + c.store * damp;
        c.buf[c.i] = x + c.store * fb;
        c.i = (c.i + 1) % c.len;
        acc += y;
      }
      for (const a of aps) {
        const b = a.buf[a.i];
        const y = -acc + b;
        a.buf[a.i] = acc + b * 0.5;
        a.i = (a.i + 1) % a.len;
        acc = y;
      }
      out[n] = acc;
    }
    return out;
  };
  return { L: process(sendBus.L, 0), R: process(sendBus.R, Math.round(23 * scale)) };
}

// ───────────────────────── Composición ─────────────────────────
function compose() {
  const drums = stereo(), bass = stereo(), chords = stereo(), pad = stereo(), pl = stereo(), rev = stereo(), sweepBus = stereo();

  for (let bar = 0; bar < BARS; bar++) {
    const b0 = bar * BAR, ch = chordAtBar(bar), sectionB = bar >= 8;
    const stepT = (s) => b0 + s * STEP;

    // Bombo: 4 al piso
    for (let beat = 0; beat < 4; beat++) kick(drums, b0 + beat * BEAT, 1);

    // Hi-hats: abierto a contratiempo + cerrado suave en tiempos
    for (const s of [2, 6, 10, 14]) hat(drums, rev, stepT(s), 1.0, true, 0.15);
    for (const s of [0, 4, 8, 12]) hat(drums, rev, stepT(s), 0.4, false, -0.1);
    if (sectionB) for (let s = 0; s < 16; s++) shaker(drums, stepT(s) + (s % 2 ? 0.012 : 0), [0.6, 0.3, 0.45, 0.3][s % 4], s % 2 ? 0.25 : -0.25);

    // Clap en 2 y 4 (desde el compás 5)
    if (bar >= 4) { clap(drums, rev, stepT(4), 1); clap(drums, rev, stepT(12), 1); }

    // Bajo
    const pat = bar % 2 === 0 ? BASS_A : BASS_B;
    for (const n of pat) bassNote(bass, stepT(n.s), ch.root + n.n, n.l * STEP, n.v);

    // Acordes (stabs sincopados)
    for (const st of STAB_STEPS) epStab(chords, rev, stepT(st.s), ch.tones, st.v, 3 * STEP * 0.9);

    // Pad: un acorde sostenido cada 2 compases (más presente en B)
    if (bar % 2 === 0) padChord(pad, rev, b0, BAR * 2, ch.tones.slice(0, 4));

    // Arpegio de pluck con delay (sección B)
    if (sectionB) {
      for (let s = 0; s < 16; s++) {
        if (!PLUCK_MASK[s]) continue;
        const midi = ch.tones[PLUCK_SEQ[s] % ch.tones.length] + 12;
        pluck(pl, rev, stepT(s), midi, [1, 0.6, 0.8, 0.6][s % 4], s % 2 ? 0.3 : -0.3);
      }
    }

    // Barrido de ruido que sube en el último compás: lleva de vuelta al inicio del loop
    if (bar === BARS - 1) {
      const s0 = Math.round(b0 * SR), n = Math.round(BAR * SR);
      let y1 = 0, y2 = 0; // dos polos que conservan estado mientras sube el corte
      for (let i = 0; i < n; i++) {
        const p = i / n, fc = Math.min(400 * Math.pow(15, p), 9000);
        const a = 1 - Math.exp((-TWO_PI * fc) / SR);
        y1 += a * (noise() - y1); y2 += a * (y1 - y2);
        const tail = Math.min(1, (n - 1 - i) / (SR * 0.03)); // 30 ms de fade al final
        const s = y2 * Math.pow(p, 2.2) * LV.sweep * 3 * tail;
        addAt(sweepBus, s0, i, s, s);
      }
    }
  }

  // Sidechain: el nivel baja al golpe del bombo y se recupera
  const duck = (depth) => {
    const d = new Float32Array(LEN);
    for (let i = 0; i < LEN; i++) { const tk = (i / SR) % BEAT; d[i] = 1 - depth * Math.exp(-tk / 0.11); }
    return d;
  };
  const dBass = duck(0.5), dRest = duck(0.68);
  for (let i = 0; i < LEN; i++) {
    bass.L[i] *= dBass[i]; bass.R[i] *= dBass[i];
    for (const b of [chords, pad, pl]) { b.L[i] *= dRest[i]; b.R[i] *= dRest[i]; }
  }

  pingPong(pl, 0.375, 0.4, 0.55);

  const wet = reverb(rev);
  const master = stereo();
  for (let i = 0; i < LEN; i++) {
    for (const ch of ['L', 'R']) {
      master[ch][i] = drums[ch][i] + bass[ch][i] + chords[ch][i] + pad[ch][i] + pl[ch][i] + sweepBus[ch][i] + wet[ch][i] * 1.6;
    }
  }

  // Pliega la cola sobre el inicio: el loop es continuo (la reverb/delay del final sigue al empezar)
  const out = { L: new Float32Array(N), R: new Float32Array(N) };
  for (const ch of ['L', 'R']) {
    for (let i = 0; i < N; i++) out[ch][i] = master[ch][i] + (i < TAIL ? master[ch][N + i] : 0);
  }
  return { out, buses: { drums, bass, chords, pad, pl, wet } };
}

function finish(out) {
  // Pasa-altos de 45 Hz (2 pasadas de 2do orden): el loop es periodico, se "calienta" con una vuelta previa
  for (const ch of ['L', 'R']) {
    const hp1 = biquad('hp', 45, 0.707), hp2 = biquad('hp', 45, 0.707);
    for (let i = N - 2 * SR; i < N; i++) hp2(hp1(out[ch][i])); // calentamiento con el final del loop (lo que suena justo antes del inicio)
    for (let i = 0; i < N; i++) out[ch][i] = hp2(hp1(out[ch][i]));
  }
  // Ganancia hacia RMS objetivo de fondo (-15 dBFS) y limitador suave
  let sq = 0;
  for (const ch of ['L', 'R']) for (let i = 0; i < N; i++) sq += out[ch][i] * out[ch][i];
  const rms = Math.sqrt(sq / (2 * N)), g = Math.pow(10, -15 / 20) / rms;
  let peak = 0;
  for (const ch of ['L', 'R']) for (let i = 0; i < N; i++) { const v = Math.tanh((out[ch][i] * g) / 0.85) * 0.85; out[ch][i] = v; peak = Math.max(peak, Math.abs(v)); }
  return g;
}

function writeWav(file, L, R) {
  const frames = L.length, data = Buffer.alloc(frames * 4);
  for (let i = 0; i < frames; i++) {
    data.writeInt16LE(Math.max(-32768, Math.min(32767, Math.round(L[i] * 32767))), i * 4);
    data.writeInt16LE(Math.max(-32768, Math.min(32767, Math.round(R[i] * 32767))), i * 4 + 2);
  }
  const h = Buffer.alloc(44);
  h.write('RIFF', 0); h.writeUInt32LE(36 + data.length, 4); h.write('WAVE', 8); h.write('fmt ', 12);
  h.writeUInt32LE(16, 16); h.writeUInt16LE(1, 20); h.writeUInt16LE(2, 22); h.writeUInt32LE(SR, 24);
  h.writeUInt32LE(SR * 4, 28); h.writeUInt16LE(4, 32); h.writeUInt16LE(16, 34); h.write('data', 36); h.writeUInt32LE(data.length, 40);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, Buffer.concat([h, data]));
}

module.exports = { compose, finish, writeWav, SR, N, BPM };

if (require.main === module) {
  const target = process.argv[2] || path.join(__dirname, '..', 'assets', 'audio', 'london-deep-house.wav');
  const { out } = compose();
  const gain = finish(out);
  writeWav(target, out.L, out.R);
  console.log(`OK ${target}`);
  console.log(`  ${BPM} BPM, ${BARS} compases, ${(N / SR).toFixed(2)} s, ${SR} Hz estéreo, ganancia master x${gain.toFixed(2)}`);
  console.log(`  tamaño: ${(fs.statSync(target).size / 1024 / 1024).toFixed(2)} MB`);
}
