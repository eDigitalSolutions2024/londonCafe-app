// src/models/AppMeta.js
//
// Documento único (_id fijo) para configuración global chiquita que no
// amerita su propia colección de verdad -- por ahora solo guarda qué
// versión de cada tienda ya se anunció por push, para no mandar el
// mismo aviso de "nueva versión" más de una vez (ver cron/pushJobs.js).
const mongoose = require("mongoose");

const appMetaSchema = new mongoose.Schema(
  {
    _id: { type: String, default: "singleton" },
    lastAnnouncedVersion: {
      ios: { type: String, default: null },
      android: { type: String, default: null },
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model("AppMeta", appMetaSchema);
