const menu = require("../data/menu.data");

function getMenu(req, res) {
  res.json(menu);
}

module.exports = { getMenu };
