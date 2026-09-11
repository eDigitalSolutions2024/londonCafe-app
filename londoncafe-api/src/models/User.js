const mongoose = require("mongoose");

const avatarSchema = new mongoose.Schema(
  {
    skin: { type: String, default: "skin_01" },
    hair: { type: String, default: "hair_01" },
    top: { type: String, default: "top_01" },
    bottom: { type: String, default: "bottom_01" },
    shoes: { type: String, default: "shoes_01" },
    accessory: { type: String, default: null },
  },
  { _id: false }
);

// ✅ Avatar 3D "de verdad" -- reemplaza en USO (no en schema, para no
// romper cuentas viejas a medio migrar) al `avatarConfig` plano de solo
// pelo. Se arma combinando partes 3D prediseñadas (ver
// src/assets/avatar3dParts.js en el cliente) -- NO es generación por IA
// desde la foto (esa opción de mercado -- Ready Player Me -- cerró en
// enero 2026, y las alternativas de pago cobran $800+/mes, desproporcionado
// para esta app). La foto solo sugiere un tono de piel de partida.
// `snapshotUrl` es un PNG plano pre-renderizado (captura del canvas de
// three.js) que se usa en los 11+ lugares chicos de la app en vez de
// cargar el visor 3D interactivo ahí (ver Avatar3DViewer.jsx).
const avatar3dSchema = new mongoose.Schema(
  {
    owned: { type: Boolean, default: false },
    parts: {
      hair: { type: String, default: null },
      head: { type: String, default: null },
      body: { type: String, default: null },
      outfit: { type: String, default: null },
      accessory: { type: String, default: null },
    },
    colors: {
      skin: { type: String, default: null },
      hair: { type: String, default: null },
    },
    snapshotUrl: { type: String, default: null },
    createdAt: { type: Date, default: null },
    updatedAt: { type: Date, default: null },
  },
  { _id: false }
);

// ✅ Historial de puntos (opcional pero recomendado)
const pointsHistorySchema = new mongoose.Schema(
  {
    type: { type: String, enum: ["EARN", "REDEEM", "ADJUST"], default: "EARN" },
    points: { type: Number, required: true }, // + o -
    source: { type: String, default: "QR" }, // QR / manual / promo / etc
    ref: { type: String, default: null }, // claimCode / ticketId
    note: { type: String, default: null },
    createdAt: { type: Date, default: Date.now },
  },
  { _id: false }
);

// ✅ Buddy (energía + inventario + control de recarga por login)
const buddySchema = new mongoose.Schema(
  {
    energy: { type: Number, default: 100, min: 0, max: 100 },

    coffee: { type: Number, default: 1, min: 0 },
    bread: { type: Number, default: 1, min: 0 },

      energyAlerts: {
      fifty: {
        type: Boolean,
        default: false,
      },
      twentyFive: {
        type: Boolean,
        default: false,
      },
      ten: {
        type: Boolean,
        default: false,
      },
    },

    lastEnergyAt: { type: Date, default: Date.now },
    lastRefillAt: { type: Date, default: null },
    lastLoginAt: { type: Date, default: null },

    // ✅ Daily reward / rachas
    streakCount: { type: Number, default: 0, min: 0 },
    bestStreak: { type: Number, default: 0, min: 0 },
    lastClaimDay: { type: String, default: "" }, // "YYYY-MM-DD"
    lastStreakDay: { type: String, default: "" }, // "YYYY-MM-DD"

    // ✅ Recovery de racha (1 vez)
    streakPrevCount:   { type: Number, default: 0, min: 0 },
    streakBrokenDay:   { type: String, default: "" }, // "YYYY-MM-DD" (día donde se detectó ruptura)
    streakRecoveryUsed:{ type: Boolean, default: false },

    // ✅ cupones (si los vas a usar)
    coupons: {
      type: [
        {
          id: String,
          type: String,
          title: String,
          description: String,
          createdAt: Date,
          expiresAt: Date,
          redeemedAt: Date,
        },
      ],
      default: [],
    },
  },
  { _id: false }
);

// ✅ Mascota VIP (tipo Tamagotchi / POU) -- vive junto al `buddy` (el
// avatar humano). hunger/happiness/energy/hygiene decaen con el tiempo
// real (mismo patrón que buddy.energy en utils/buddy.js). Se alimenta
// con el MISMO inventario que el avatar: user.buddy.coffee /
// user.buddy.bread (una sola despensa). Comer ensucia -> aparece `mess`
// (popó) y baja `hygiene`; se arregla con "Limpiar". "Dormir" recupera
// `energy`. Cuidarla da `xp` (nivel de amistad). Ver pet.controller.js.
const petSchema = new mongoose.Schema(
  {
    owned: { type: Boolean, default: false },
    species: { type: String, enum: ["cat", "dog", "hamster", null], default: null },
    name: { type: String, default: null, trim: true, maxlength: 20 },

    hunger: { type: Number, default: 100, min: 0, max: 100 },
    happiness: { type: Number, default: 100, min: 0, max: 100 },
    energy: { type: Number, default: 100, min: 0, max: 100 },
    hygiene: { type: Number, default: 100, min: 0, max: 100 },
    mess: { type: Boolean, default: false },

    xp: { type: Number, default: 0, min: 0 },

    // Mejor puntaje (fichas juntadas en una sola partida) del Café Tetris.
    // Alimenta el leaderboard -- ver GET /pet/leaderboard.
    tetrisBest: { type: Number, default: 0, min: 0 },

    // ✅ Anti-spam de notificaciones: se marca al avisar y se limpia cuando
    // la barra correspondiente se recupera (mismo patrón que
    // buddy.energyAlerts). Ver cron/pushJobs.js.
    notifyFlags: {
      mess: { type: Boolean, default: false },
      hunger: { type: Boolean, default: false },
      energy: { type: Boolean, default: false },
      happiness: { type: Boolean, default: false },
    },

    lastStatsAt: { type: Date, default: Date.now },
    lastFedAt: { type: Date, default: null },
    lastPlayAt: { type: Date, default: null },
    lastCleanAt: { type: Date, default: null },
    lastSleepAt: { type: Date, default: null },
    adoptedAt: { type: Date, default: null },
  },
  { _id: false }
);

const userSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },

    // ✅ Género
    gender: {
      type: String,
      enum: ["male", "female", "other"],
      default: "other",
      required: true,
    },

    // ✅ NUEVO: Teléfono (E.164 recomendado, ej: +16561234567)
    phone: {
      type: String,
      trim: true,
      default: null,
      // opcional: validación básica de E.164 (puedes aflojarla si quieres)
      match: /^\+?[0-9]{10,16}$/,
    },

    // ✅ NUEVO: Fecha de nacimiento
    birthDate: {
      type: Date,
      default: null,
    },

    username: {
      type: String,
      trim: true,
      lowercase: true,
      minlength: 3,
      maxlength: 20,
      match: /^[a-z0-9_]+$/,
      default: null,
    },

    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
    },

    // ✅ Cambiar de correo desde Configuración ya no se aplica directo --
    // se guarda aquí hasta que se confirme con un código enviado al
    // correo NUEVO (mismo mecanismo de EmailVerification que el
    // registro). Antes PUT /me aplicaba el correo tal cual, sin probar
    // que la persona fuera dueña de esa dirección -- cualquiera con la
    // sesión abierta podía cambiarlo sin confirmar nada.
    pendingEmail: { type: String, default: null, lowercase: true, trim: true },

    passwordHash: { type: String, required: true },
    isEmailVerified: { type: Boolean, default: false },

    // ✅ Avatar (plano, legado -- se mantiene solo como fallback transitorio
    // mientras las cuentas migran al avatar 3D)
    avatarConfig: { type: avatarSchema, default: () => ({}) },

    // ✅ Avatar 3D real -- ver avatar3dSchema arriba. Migración OBLIGATORIA:
    // toda cuenta sin `avatar3d.owned` debe pasar por el flujo de creación
    // la próxima vez que abra la app (gate en el cliente vía getMe/login).
    avatar3d: { type: avatar3dSchema, default: () => ({}) },

    // ✅ Puntos
    points: { type: Number, default: 0 }, // disponibles para canje
    lifetimePoints: { type: Number, default: 0 }, // acumulados históricos
    pointsHistory: { type: [pointsHistorySchema], default: [] },

    // ✅ Buddy
    buddy: { type: buddySchema, default: () => ({}) },

    // ✅ Mascota VIP
    pet: { type: petSchema, default: () => ({}) },

     // ✅ Push notifications
    expoPushToken: {
      type: String,
      default: "",
      trim: true,
    },

    notificationPrefs: {
      promos: { type: Boolean, default: true },
      lowEnergy: { type: Boolean, default: true },
      streak: { type: Boolean, default: true },
      pet: { type: Boolean, default: true },
    },
  },
  { timestamps: true }
);

// ✅ Índice unique para phone pero sin romper si está null
userSchema.index({ phone: 1 }, { unique: true, sparse: true });

module.exports = mongoose.model("User", userSchema);