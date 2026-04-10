const router = require("express").Router();
const { requireInternalKey } = require("../middleware/internalKey");
const { sendNewPromoPush } = require("../controllers/internalPush.controller");

router.post("/internal/push/new-promo", requireInternalKey, sendNewPromoPush);

module.exports = router;