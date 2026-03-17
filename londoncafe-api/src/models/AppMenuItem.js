const mongoose = require("mongoose");

const OptionChoiceSchema = new mongoose.Schema(
  {
    label: { type: String, required: true, trim: true },
    extraPrice: { type: Number, default: 0 },
  },
  { _id: false }
);

const DrinkOptionsSchema = new mongoose.Schema(
  {
    milk: {
      enabled: { type: Boolean, default: false },
      choices: { type: [OptionChoiceSchema], default: [] },
    },
    temp: {
      enabled: { type: Boolean, default: false },
      choices: { type: [OptionChoiceSchema], default: [] },
    },
    flavors: {
      enabled: { type: Boolean, default: false },
      choices: { type: [OptionChoiceSchema], default: [] },
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