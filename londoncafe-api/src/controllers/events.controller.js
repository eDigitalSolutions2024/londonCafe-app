// controllers/events.controller.js
//
// Fase 1 (ecosistema digital de ventas): proxy de escritura hacia
// POST /api/events de apps/api -- la app no puede tener POS_API_KEY en el
// bundle (se expondría a cualquiera), así que este backend lo manda
// servidor-a-servidor, igual que ya hace points.controller.js con Wallet V2.
function getUid(req) {
  return req.user?.uid || req.user?.sub || req.user?.userId || req.user?.id || null;
}

// Mismo POS_URL/POS_API_KEY que ya usa order.controller.js/points.controller.js.
const POS_URL = process.env.POS_URL || "https://api.londoncafejrz.com/api";

/**
 * POST /api/events  (APP)
 * body: { type, orderId?, ruleId?, itemIds?, revenueImpact?, meta? }
 * userId se toma del token, sessionId/channel los agrega este proxy --
 * el cliente móvil solo manda lo que le concierne.
 */
async function postEvent(req, res) {
  try {
    const uid = getUid(req);
    if (!uid) return res.status(401).json({ ok: false, error: "BAD_TOKEN" });

    const { type, orderId, ruleId, itemIds, revenueImpact, meta, sessionId } = req.body || {};

    const posRes = await fetch(`${POS_URL}/events`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-api-key": process.env.POS_API_KEY || "" },
      body: JSON.stringify({
        type,
        channel: "app",
        userId: uid,
        orderId,
        ruleId,
        itemIds,
        revenueImpact,
        meta,
        sessionId,
      }),
    });
    const data = await posRes.json().catch(() => ({}));
    if (!posRes.ok) {
      console.log("postEvent POS error:", posRes.status, data);
      return res.status(502).json({ ok: false, error: "EVENTS_UPSTREAM_ERROR" });
    }

    return res.status(201).json({ ok: true, id: data.id });
  } catch (err) {
    console.log("postEvent error:", err?.message);
    return res.status(500).json({ ok: false, error: "SERVER_ERROR" });
  }
}

module.exports = { postEvent };
