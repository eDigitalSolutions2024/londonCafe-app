// server.js (o index.js)
const dotenv = require("dotenv");
dotenv.config();

const express = require("express");
const cors = require("cors");

const { connectDB } = require("./config/db");

// rutas existentes
const menuRoutes = require("./routes/menu.routes");
const promoRoutes = require("./routes/promo.routes");
const branchRoutes = require("./routes/branch.routes");
const pointsRoutes = require("./routes/points.routes");
const rewardsRoutes = require("./routes/rewards.routes");
const buddyRoutes = require("./routes/buddy.routes");
const authRoutes = require("./routes/auth.routes");
const salesRoutes = require("./routes/sales");
const giftcardsRouter = require("./routes/giftcards");
// payments
const paymentsRoutes = require("./routes/payments.routes");
const paymentsController = require("./controllers/payments.controller"); // para webhook raw

const app = express();

// ✅ CORS (incluye stripe-signature)
app.use(
  cors({
    origin: true,
    credentials: true,
    allowedHeaders: ["Content-Type", "Authorization", "x-api-key", "stripe-signature"],
  })
);

/**
 * ✅ Stripe Webhook MUST be raw BEFORE express.json()
 * OJO: La ruta debe coincidir EXACTA con la configurada en Stripe:
 * /api/payments/webhook
 */
app.post(
  "/api/payments/webhook",
  express.raw({ type: "application/json" }),
  paymentsController.handleStripeWebhook
);

// ✅ Ahora sí, JSON para todo lo demás
app.use(express.json());

// health
app.get("/api/health", (req, res) => {
  res.json({ ok: true, message: "LondonCafe API running 🚀" });
});

// routes
app.use("/api/auth", authRoutes);
app.use("/api/menu", menuRoutes);
app.use("/api/promos", promoRoutes);
app.use("/api/branches", branchRoutes);
app.use("/api", require("./routes/me.routes"));
app.use("/api/points", pointsRoutes);
app.use("/api/sales", salesRoutes);
app.use("/api/dev", require("./routes/dev"));
app.use("/api/rewards", rewardsRoutes);
app.use("/api/buddy", buddyRoutes);

// ✅ Payments normal: /api/payments/sheet
app.use("/api/payments", paymentsRoutes);
app.use("/api/giftcards", giftcardsRouter);
// start
const PORT = process.env.PORT || 3001;

connectDB(process.env.MONGO_URI)
  .then(() => {
    app.listen(PORT, "0.0.0.0", () => {
      console.log(`✅ API listening on http://localhost:${PORT}`);
    });
  })
  .catch((err) => {
    console.log("❌ DB connection failed:", err?.message || err);
    process.exit(1);
  });