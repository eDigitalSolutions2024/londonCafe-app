const { Router } = require("express");
const { getLiveStoreVersions } = require("../utils/storeVersion");

const router = Router();

// GET /api/app/version-check -- versión REAL ya publicada en cada tienda
// (cacheada, ver storeVersion.js). El cliente la compara contra su propia
// versión (Constants.expoConfig.version) para mostrar el banner de
// "hay una actualización" -- ver UpdateBanner en HomeScreen.jsx.
router.get("/version-check", async (req, res) => {
  try {
    const versions = await getLiveStoreVersions();
    return res.json({ ok: true, ...versions });
  } catch (e) {
    return res.status(500).json({ ok: false, error: "SERVER_ERROR" });
  }
});

module.exports = router;
