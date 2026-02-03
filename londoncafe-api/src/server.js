
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

// auth (cuando lo agreguemos)
const authRoutes = require("./routes/auth.routes");
const salesRoutes = require("./routes/sales");



const app = express();
app.use(cors({
  origin: true,
  credentials: true,
  allowedHeaders: ["Content-Type", "Authorization", "x-api-key"],
}));
app.use(express.json());

app.get("/api/health", (req, res) => {
  res.json({ ok: true, message: "LondonCafe API running 🚀" });
});

app.use("/api/auth", authRoutes);
app.use("/api/menu", menuRoutes);
app.use("/api/promos", promoRoutes);
app.use("/api/branches", branchRoutes);
app.use("/api", require("./routes/me.routes"));
app.use("/api/points", pointsRoutes);
app.use("/api/sales", salesRoutes);
app.use("/api/dev", require("./routes/dev"));
app.use("/api/rewards", rewardsRoutes);


const PORT = process.env.PORT ;

connectDB(process.env.MONGO_URI)
  .then(() => {
    app.listen(PORT, "0.0.0.0", () => console.log(`✅ API listening on http://localhost:${PORT}`));
  })
  .catch(() => process.exit(1));
