const express = require("express");

const router = express.Router();

// Fase 0 (ADR-001, Wallet Engine): esta ruta otorgaba puntos directamente a
// partir de un userId + total enviados en el body, SIN ninguna
// autenticación (el require de posAuth ya estaba comentado antes de este
// cambio, apuntando además a una ruta que nunca existió). El userId que
// necesita es el mismo id que va impreso, sin cifrar, en el QR de
// cualquier cliente — cualquiera que lo copiara podía otorgarse puntos
// arbitrarios sin pasar por caja. No se encontró ningún llamador real en
// ninguno de los dos repositorios; se cierra en vez de asegurarse, porque
// el diseño del Wallet Engine consolida toda acreditación de puntos en un
// solo motor (apps/api) y esta ruta escribía Mongo directamente, que es
// justo el patrón que el rediseño elimina.
router.post("/from-pos", (req, res) => {
  console.warn(
    "[sales.from-pos] Intento de uso de endpoint retirado por seguridad (ADR-001, Fase 0).",
    { ip: req.ip, bodyKeys: Object.keys(req.body || {}) }
  );
  return res.status(410).json({
    ok: false,
    message: "Este endpoint fue retirado por seguridad. Contacta al equipo técnico si dependías de él.",
  });
});

module.exports = router;
