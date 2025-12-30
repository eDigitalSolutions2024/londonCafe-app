const promotions = require("../data/promos.data");

function getPromotions(req, res) {
  res.json(promotions);
}

module.exports = { getPromotions };
