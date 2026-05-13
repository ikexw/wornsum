// ============================================================
//  PRODUCTS  —  edit this file to add, remove, or update items
//
//  Fields:
//    id          unique number (don't repeat)
//    name        product title shown on the card
//    category    "Tops" | "Bottoms" | "Outerwear" | "Accessories"
//    price       number in USD (no dollar sign)
//    size        size string shown on the card
//    image       path relative to site root  e.g. "images/my-jacket.jpg"
//    featured    true → shown on the Home page Featured section
//    description short blurb (used in future detail views)
// ============================================================

const products = [
  {
    id: 1,
    name: "Vintage Levi's Trucker Jacket",
    category: "Outerwear",
    price: 85,
    size: "M",
    image: "images/placeholder.svg",
    featured: true,
    description: "Classic Levi's denim trucker, lightly faded. Excellent condition."
  },
  {
    id: 2,
    name: "Y2K Cargo Pants",
    category: "Bottoms",
    price: 55,
    size: "32W",
    image: "images/placeholder.svg",
    featured: true,
    description: "Wide-leg cargo in tan. Multi-pocket, relaxed fit."
  },
  {
    id: 3,
    name: "Oversized Flannel Shirt",
    category: "Tops",
    price: 35,
    size: "L",
    image: "images/placeholder.svg",
    featured: true,
    description: "Soft red plaid flannel, slightly oversized cut."
  },
  {
    id: 4,
    name: "Canvas Tote Bag",
    category: "Accessories",
    price: 22,
    size: "One Size",
    image: "images/placeholder.svg",
    featured: true,
    description: "Heavy natural canvas tote. Minimal branding."
  },
  {
    id: 5,
    name: "Ribbed Wool Beanie",
    category: "Accessories",
    price: 18,
    size: "One Size",
    image: "images/placeholder.svg",
    featured: false,
    description: "Navy ribbed wool beanie. Classic, warm."
  },
  {
    id: 6,
    name: "Slim Chinos",
    category: "Bottoms",
    price: 40,
    size: "30W",
    image: "images/placeholder.svg",
    featured: false,
    description: "Olive slim-fit chinos. Light wear, great condition."
  },
  {
    id: 7,
    name: "Graphic Band Tee",
    category: "Tops",
    price: 28,
    size: "M",
    image: "images/placeholder.svg",
    featured: false,
    description: "Vintage-style band graphic, faded wash."
  },
  {
    id: 8,
    name: "Insulated Puffer Vest",
    category: "Outerwear",
    price: 62,
    size: "L",
    image: "images/placeholder.svg",
    featured: false,
    description: "Navy puffer vest. Excellent condition, barely worn."
  }
];
