const mongoose = require("mongoose");

const DrinkOptionsSchema = new mongoose.Schema(
  {
    milk: {
      enabled: { type: Boolean, default: false },
      choices: { type: [String], default: [] },
    },
    temp: {
      enabled: { type: Boolean, default: false },
      choices: { type: [String], default: [] },
    },
    flavors: {
      enabled: { type: Boolean, default: false },
      choices: { type: [String], default: [] },
      multiple: { type: Boolean, default: false },
    },
  },
  { _id: false }
);

const AppMenuItemSchema = new mongoose.Schema(
  {
    title: String,
    description: String,
    price: Number,
    category: String,
    imageUrl: String,
    active: { type: Boolean, default: true },
    sortOrder: { type: Number, default: 0 },
    options: { type: DrinkOptionsSchema, default: undefined },
  },
  {
    collection: "appmenuitems",
    timestamps: true,
  }
);

module.exports = mongoose.model("AppMenuItem", AppMenuItemSchema);