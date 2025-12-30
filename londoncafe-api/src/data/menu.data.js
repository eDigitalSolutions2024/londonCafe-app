const menu = [
  {
    id: "coffee",
    name: "Café Caliente",
    items: [
      {
        id: "latte",
        name: "Latte",
        description: "Espresso con leche vaporizada.",
        price: 65,
        imageUrl: "https://picsum.photos/200/200?coffee"
      },
      {
        id: "capuccino",
        name: "Capuccino",
        description: "Espresso, leche y espuma.",
        price: 70,
        imageUrl: "https://picsum.photos/200/201?capuccino"
      }
    ]
  },
  {
    id: "frappes",
    name: "Frappés",
    items: [
      {
        id: "oreo",
        name: "Frappé Oreo",
        description: "Frappé de vainilla con galleta Oreo.",
        price: 85,
        imageUrl: "https://picsum.photos/200/202?frappe"
      }
    ]
  }
];

module.exports = menu;
