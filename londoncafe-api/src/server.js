// server.js (o index.js)
const dotenv = require("dotenv");
dotenv.config();

const path = require("path");
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
const eventsRoutes = require("./routes/events.routes");
// payments
const paymentsRoutes = require("./routes/payments.routes");
const paymentsController = require("./controllers/payments.controller"); // para webhook raw
const orderRoutes = require("./routes/order.routes");
const appRoutes = require("./routes/app.routes");

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

// ✅ Ahora sí, JSON para todo lo demás -- el límite default de express.json
// es 100kb, y el snapshot del avatar 3D (PNG capturado del canvas del
// visor, mandado como data-URL base64 en el body de
// POST /me/avatar3d/snapshot) lo pasa fácil, tirando HTTP_413 antes de
// llegar siquiera al controller (confirmado: nunca se guardaba el
// snapshot de nadie, todas las cuentas se quedaban con el avatar plano de
// respaldo). 10mb da margen de sobra para una imagen de avatar.
app.use(express.json({ limit: "10mb" }));

// Snapshots del avatar 3D (PNG plano, ver me.controller.js
// uploadAvatar3DSnapshot) -- almacenamiento local en disco, sin
// S3/Cloudinary por ahora (ver plan del avatar 3D).
app.use("/uploads", express.static(path.join(__dirname, "..", "uploads")));

// Assets ESTÁTICOS del avatar 3D (modelos .glb del cuerpo base -- Kenney
// "Mini Characters", CC0, ver public/avatar3d-assets/kenney/License.txt)
// -- a diferencia de /uploads, esto SÍ se commitea al repo (son assets de
// la app, no contenido generado por el usuario). El visor (Avatar3DViewer.jsx)
// los carga con GLTFLoader desde acá vía HTTPS, igual que ya carga three.js
// desde un CDN.
app.use("/avatar3d-assets", express.static(path.join(__dirname, "..", "public", "avatar3d-assets")));

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
app.use("/api/events", eventsRoutes);
app.use("/api/sales", salesRoutes);
app.use("/api/dev", require("./routes/dev"));
app.use("/api/rewards", rewardsRoutes);
app.use("/api/buddy", buddyRoutes);
app.use("/api/pet", require("./routes/pet.routes"));
app.use("/api/friends", require("./routes/friends.routes"));
app.use("/api", require("./routes/internalPush.routes"));
app.use("/api/app", appRoutes);
// ✅ Payments normal: /api/payments/sheet
app.use("/api/payments", paymentsRoutes);
app.use("/api/giftcards", giftcardsRouter);

app.use("/api/orders", orderRoutes);
// start

require("./cron/pushJobs");


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