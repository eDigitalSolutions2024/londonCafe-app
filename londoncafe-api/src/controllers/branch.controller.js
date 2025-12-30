const branches = require("../data/branches.data");

function getBranches(req, res) {
  res.json(branches);
}

module.exports = { getBranches };
