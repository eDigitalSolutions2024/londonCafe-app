const express = require("express");
const cors = require("cors");

// importar rutas
const menuRoutes = require("./routes/menu.routes");
const promoRoutes = require("./routes/promo.routes");
const branchRoutes = require("./routes/branch.routes");

const app = express();

app.use(cors());
app.use(express.json());

// health check
app.get("/api/health", (req, res) => {
  res.json({ ok: true, message: "LondonCafe API running 🚀" });
});

// montar rutas
app.use("/api/menu", menuRoutes);
app.use("/api/promos", promoRoutes);
app.use("/api/branches", branchRoutes);

const PORT = process.env.PORT || 4000;

app.listen(PORT, () => {
  console.log(`API listening on port ${PORT}`);
});
