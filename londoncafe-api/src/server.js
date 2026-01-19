const express = require("express");
const cors = require("cors");
const dotenv = require("dotenv");

const { connectDB } = require("./config/db");

// rutas existentes
const menuRoutes = require("./routes/menu.routes");
const promoRoutes = require("./routes/promo.routes");
const branchRoutes = require("./routes/branch.routes");

// auth (cuando lo agreguemos)
const authRoutes = require("./routes/auth.routes");

dotenv.config();

const app = express();
app.use(cors());
app.use(express.json());

app.get("/api/health", (req, res) => {
  res.json({ ok: true, message: "LondonCafe API running 🚀" });
});

app.use("/api/auth", authRoutes);
app.use("/api/menu", menuRoutes);
app.use("/api/promos", promoRoutes);
app.use("/api/branches", branchRoutes);

const PORT = process.env.PORT || 4000;

connectDB(process.env.MONGO_URI)
  .then(() => {
    app.listen(PORT, "0.0.0.0", () => console.log(`✅ API listening on http://localhost:${PORT}`));
  })
  .catch(() => process.exit(1));
