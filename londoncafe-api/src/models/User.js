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
// pelo. NO es generación por IA desde la foto (esa opción de mercado --
// Ready Player Me -- cerró en enero 2026, y las alternativas de pago
// cobran $800+/mes, desproporcionado para esta app).
//
// v2: `parts.character` reemplaza a lo que antes eran 8 campos sueltos
// (hair/head/body/outfit/eyebrow/nose/mouth/pose) -- las primitivas de
// three.js generadas por código (esferas/cápsulas) se veían artificiales
// sin importar cuánto se ajustaran. Ahora es UN personaje completo,
// modelo .glb real (Kenney "Mini Characters", CC0) elegido entre 12
// variantes ya diseñadas por un artista -- ver src/assets/avatar3dParts.js
// en el cliente y londoncafe-api/public/avatar3d-assets/kenney/. Los
// colores de piel/pelo/ojos quedaron fijos por personaje (vienen ya
// pintados en el modelo), así que `colors` ya no aplica.
// `snapshotUrl` es un PNG plano pre-renderizado (captura del canvas de
// three.js) que se usa en los 11+ lugares chicos de la app en vez de
// cargar el visor 3D interactivo ahí (ver Avatar3DViewer.jsx).
const avatar3dSchema = new mongoose.Schema(
  {
    owned: { type: Boolean, default: false },
    parts: {
      character: { type: String, default: null },
      accessory: { type: String, default: null },
      // Tono de piel -- recoloreo real de los píxeles de piel de la
      // textura del personaje (independiente de qué personaje/outfit se
      // eligió), ver SKIN_TONE_OPTIONS en avatar3dParts.js del cliente y
      // applySkinTint() en Avatar3DViewer.jsx. null = tono de fábrica.
      skinTone: { type: String, default: null },
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

    // Nivel más alto DESBLOQUEADO del Café Crush (progresión secuencial,
    // ver matchLevels.js en el cliente y playPet() abajo) -- todo nivel
    // < match3Level ya se pasó, match3Level mismo es el actual abierto.
    match3Level: { type: Number, default: 1, min: 1, max: 10 },

    // Mismo patrón que match3Level/tetrisBest, pero para "Salto Café"
    // (estilo Doodle Jump) -- ver doodleLevels.js en el cliente.
    doodleBest: { type: Number, default: 0, min: 0 },
    doodleLevel: { type: Number, default: 1, min: 1, max: 10 },

    // Mismo patrón para "Barista Ninja" -- FALTABAN en el schema (el
    // controller ya los leía/escribía desde que se agregó el juego, pero
    // al no estar declarados acá Mongoose los ignoraba en strict mode: se
    // veían bien en la MISMA respuesta de /pet/play porque el objeto en
    // memoria sí los tenía, pero nunca se guardaban de verdad en Mongo --
    // ninjaBest y la progresión de niveles se reseteaban en cada login).
    ninjaBest: { type: Number, default: 0, min: 0 },
    ninjaLevel: { type: Number, default: 1, min: 1, max: 10 },

    // Survival: mejor puntaje del modo sin fin de cada juego (independiente
    // de *Best/*Level de arriba, que son del modo por niveles) -- ver
    // playPet() con mode:"survival".
    tetrisSurvivalBest: { type: Number, default: 0, min: 0 },
    doodleSurvivalBest: { type: Number, default: 0, min: 0 },
    ninjaSurvivalBest: { type: Number, default: 0, min: 0 },

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

    // ✅ "Dormir" ya no es instantáneo: pone a la mascota a dormir por
    // SLEEP_FREEZE_MIN minutos reales (ojos cerrados + resto de acciones
    // bloqueadas, ver isAsleep() en pet.controller.js) para que la gente
    // salga de la app y vuelva -- sleepNotified controla el push de
    // "ya despertó" (una sola vez por sueño, ver cron/pushJobs.js).
    sleepUntil: { type: Date, default: null },
    sleepNotified: { type: Boolean, default: true },
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
    // Sin `default: null` a propósito -- el índice unique+sparse de abajo
    // solo ignora el campo cuando está AUSENTE, no cuando vale null. Con
    // el default, Mongoose guardaba phone:null en cada cuenta sin
    // teléfono, y la segunda cuenta así chocaba con "PHONE_ALREADY_EXISTS"
    // (E11000 dup key: { phone: null }) aunque ninguna de las dos hubiera
    // puesto un número.
    phone: {
      type: String,
      trim: true,
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
    // Cuándo se pidió el cambio -- si pasan 24h sin confirmarlo, getMe()
    // lo cancela solo (ver PENDING_EMAIL_EXPIRE_MS en me.controller.js),
    // igual que normalizeStreakAutoReset ya hace con la racha. Evita que
    // el banner "Confirma tu correo nuevo" se quede pegado para siempre
    // si la persona nunca vuelve a esa pantalla.
    pendingEmailRequestedAt: { type: Date, default: null },

    passwordHash: { type: String, required: true },
    isEmailVerified: { type: Boolean, default: false },

    // ✅ Avatar (plano, legado -- se mantiene solo como fallback transitorio
    // mientras las cuentas migran al avatar 3D)
    avatarConfig: { type: avatarSchema, default: () => ({}) },

    // ✅ Avatar 3D real -- ver avatar3dSchema arriba. Migración OBLIGATORIA:
    // toda cuenta sin `avatar3d.owned` debe pasar por el flujo de creación
    // la próxima vez que abra la app (gate en el cliente vía getMe/login).
    avatar3d: { type: avatar3dSchema, default: () => ({}) },

    // ✅ Pase VIP comprado en la Tienda -- vía Stripe, ver
    // payments.controller.js (createVipPassSheet) y
    // me.controller.js (confirmVipPass). isUserVIP() en me.controller.js
    // revisa esto ADEMÁS del saldo real del POS y del mes gratis de cuenta
    // nueva -- cualquiera de los tres da acceso VIP.
    vipPass: {
      active: { type: Boolean, default: false },
      purchasedAt: { type: Date, default: null },
      expiresAt: { type: Date, default: null },
      lastPaymentIntentId: { type: String, default: null },
    },

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
      reengage: { type: Boolean, default: true },
    },

    // ✅ "Amigos en el café ahora" -- opt-in (apagado por default), sin
    // NINGÚN historial: solo se guarda el estado ACTUAL, se sobreescribe
    // en cada ping y nunca se acumula. El cliente calcula la distancia al
    // café él mismo (ver LocationScreen.jsx para las coordenadas) y solo
    // manda un booleano -- el servidor nunca recibe ni guarda coordenadas
    // GPS reales de nadie. atCafeUpdatedAt sirve para expirar solo el
    // estado si la app dejó de mandar pings (se fue sin que se detectara
    // la salida) -- ver STALE_MS en friends.controller.js.
    presence: {
      shareEnabled: { type: Boolean, default: false },
      atCafe: { type: Boolean, default: false },
      atCafeUpdatedAt: { type: Date, default: null },
    },

    // ✅ Recuperar usuarios inactivos: se toca SOLO en getMe (cada vez que
    // la app abre con sesión ya iniciada, ver AuthContext.jsx) -- no sirve
    // usar `updatedAt` (cambia con cualquier guardado de fondo, como el
    // cron de energía, sin que la persona haya abierto la app de verdad).
    lastActiveAt: { type: Date, default: null },
    // Un aviso por episodio de inactividad, no uno por cada corrida del
    // cron mientras sigue inactivo -- se resetean los dos en getMe en
    // cuanto vuelve a abrir la app (ver pushJobs.js).
    reengageFlags: {
      day1: { type: Boolean, default: false },
      day7: { type: Boolean, default: false },
      day30: { type: Boolean, default: false },
    },
  },
  { timestamps: true }
);

// ✅ Índice unique para phone pero sin romper si está null
userSchema.index({ phone: 1 }, { unique: true, sparse: true });

module.exports = mongoose.model("User", userSchema);