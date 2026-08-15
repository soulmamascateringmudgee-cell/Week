/**
 * The quantity tables — the actual product.
 *
 * Only ever imported from server code (route handlers and the engines they
 * call), so the figures are never shipped to the browser. Keep it that way.
 *
 * Every number here is a starting point from standard industry yields. An
 * operator should replace them with their own measured figures — see the
 * "Make the numbers yours" section of the pack's SETUP.md.
 */

import type {
  Category,
  MenuWeight,
  ServiceCategory,
  ShelfLife,
  VenueType,
} from "./types.ts";

// ------------------------------------------------------------------- BUFFER

/** Percentage on top of the raw weight, by guest count. */
export function bufferFor(guests: number): number {
  if (guests < 40) return 0.1;
  if (guests <= 80) return 0.07;
  return 0.05;
}

/** Always cook for the crew. */
export const CREW_MEALS = 2;

/**
 * How hungry the room is, as a multiplier on your own recipes.
 *
 * A canapé menu written for 30 can be right or wildly wrong depending on
 * whether it's an hour of drinks before dinner or the whole meal. This is the
 * dial for that, and it only touches recipes — the built-in tables already
 * have their own per-head figures.
 */
export const BITE_SIZE: Record<string, number> = {
  smaller: 0.75,
  standard: 1,
  bigger: 1.3,
};

// ------------------------------------------------------------------ PROTEIN

/** Total *served* protein per person, grams, by how heavy the menu is. */
export const MENU_WEIGHT_G: Record<MenuWeight, number> = {
  light: 190,
  standard: 240,
  feasting: 290,
};

export const MENU_WEIGHT_LABEL: Record<MenuWeight, string> = {
  light: "Light lunch / daytime",
  standard: "Standard dinner",
  feasting: "Big feasting / long table",
};

export interface Protein {
  key: string;
  label: string;
  /** Raw weight per unit of served weight. 2.0 means 200 g raw per 100 g served. */
  yieldMultiplier: number;
  category: Category;
}

export const PROTEINS: Protein[] = [
  { key: "brisket", label: "Beef brisket, slow cooked", yieldMultiplier: 2.0, category: "Meat/Seafood" },
  { key: "porkShoulder", label: "Pork shoulder, pulled", yieldMultiplier: 2.0, category: "Meat/Seafood" },
  { key: "lambShoulder", label: "Lamb shoulder, bone in", yieldMultiplier: 2.2, category: "Meat/Seafood" },
  { key: "beefRoast", label: "Beef roast / rump", yieldMultiplier: 1.55, category: "Meat/Seafood" },
  { key: "chickenThigh", label: "Chicken thigh, boneless", yieldMultiplier: 1.45, category: "Meat/Seafood" },
  { key: "chickenBreast", label: "Chicken breast, boneless", yieldMultiplier: 1.35, category: "Meat/Seafood" },
  { key: "wholeChicken", label: "Whole chicken", yieldMultiplier: 2.2, category: "Meat/Seafood" },
  { key: "fishFillet", label: "Fish fillet (barramundi, salmon)", yieldMultiplier: 1.35, category: "Meat/Seafood" },
  { key: "wholeFish", label: "Whole fish", yieldMultiplier: 2.2, category: "Meat/Seafood" },
  { key: "prawns", label: "Prawns, shell on", yieldMultiplier: 2.0, category: "Meat/Seafood" },
  { key: "mince", label: "Mince (burger, tacos, koftas)", yieldMultiplier: 1.35, category: "Meat/Seafood" },
  { key: "tofu", label: "Tofu / firm plant protein", yieldMultiplier: 1.1, category: "Produce" },
  { key: "legumes", label: "Legumes, dried", yieldMultiplier: 0.42, category: "Dry goods" },
];

export function protein(key: string): Protein | undefined {
  return PROTEINS.find((p) => p.key === key);
}

// -------------------------------------------------------------------- SIDES

/** Served grams per person for one side, by how many sides are on the menu. */
export function sideGramsPerPerson(sideCount: number): number {
  if (sideCount <= 1) return 200;
  if (sideCount === 2) return 170;
  return 120;
}

export interface Starch {
  key: string;
  label: string;
  /** Raw/dry grams per person when it is one of several sides. */
  gramsPerPerson: number;
  soloGramsPerPerson: number;
  category: Category;
}

export const STARCHES: Starch[] = [
  { key: "potato", label: "Roast potato (raw)", gramsPerPerson: 120, soloGramsPerPerson: 200, category: "Produce" },
  { key: "rice", label: "Rice, dry", gramsPerPerson: 75, soloGramsPerPerson: 90, category: "Dry goods" },
  { key: "couscous", label: "Cous cous / quinoa, dry", gramsPerPerson: 60, soloGramsPerPerson: 75, category: "Dry goods" },
  { key: "pasta", label: "Pasta, dry", gramsPerPerson: 90, soloGramsPerPerson: 110, category: "Dry goods" },
];

export const SALAD_LEAVES_G = 70;
export const BREAD_PIECES = 1.25;
export const BUTTER_G = 15;

// ----------------------------------------------------- GRAZING AND CANAPÉS

/** Total served grams per person. */
export const GRAZING_TOTAL_G = { starter: 175, meal: 325 } as const;

/** Share of the grazing total, by component. */
export const GRAZING_SPLIT: { label: string; share: number; category: Category }[] = [
  { label: "Cheese", share: 0.22, category: "Dairy" },
  { label: "Cured meat", share: 0.17, category: "Meat/Seafood" },
  { label: "Crackers / bread", share: 0.1, category: "Dry goods" },
  { label: "Dips", share: 0.15, category: "Dairy" },
  { label: "Marinated veg / olives", share: 0.14, category: "Produce" },
  { label: "Fresh fruit", share: 0.22, category: "Produce" },
];

/** Pieces per person. */
export const CANAPE_PIECES = { predinner: 5, meal: 11 } as const;

// ------------------------------------------------------------- VAN / KIOSK

export interface VanItem {
  key: string;
  label: string;
  /** Items per person. */
  perPerson: number;
  carrierLabel: string;
  /** Buns/tortillas per item, allowing for breakage and seconds. */
  carrierPerItem: number;
}

export const VAN_ITEMS: VanItem[] = [
  { key: "burgers", label: "Burgers", perPerson: 1.2, carrierLabel: "Burger buns", carrierPerItem: 1.25 },
  { key: "tacos", label: "Tacos", perPerson: 2.75, carrierLabel: "Tortillas", carrierPerItem: 1.25 },
  { key: "loadedFries", label: "Loaded fries (serves)", perPerson: 1.0, carrierLabel: "Chips, raw", carrierPerItem: 0.2 },
];

export const SAUCE_ML_PER_ITEM = 30;
export const PICKLE_G_PER_ITEM = 25;
/** One service window feeds this many items an hour. */
export const THROUGHPUT_ITEMS_PER_HOUR = 70;

// --------------------------------------------------------- DESSERT, DRINKS

export const DESSERT_G = 110;
export const DESSERT_BITES = 2;
export const COFFEE_CUPS = 1.5;
export const MILK_ML_PER_COFFEE = 150;
export const SOFT_DRINK_ML = 400;
export const WATER_ML = 750;
export const WATER_ML_HOT = 1200;
export const ICE_G_CHILLING = 500;
export const ICE_G_DRINKS_SERVICE = 1000;

// ---------------------------------------------------------- SERVICE MODE

/**
 * Share of covers that orders an item in each category, by venue type.
 * The per-item mix is this attach rate split evenly across the items in that
 * category — the single biggest source of error in the whole plan, and the
 * reason the engine flags every derived mix as an assumption.
 */
export const ATTACH_RATE: Record<VenueType, Record<ServiceCategory, number>> = {
  restaurant: { main: 0.98, entree: 0.45, side: 0.62, dessert: 0.35, counter: 0.42, drink: 1.1 },
  cafe: { main: 0.3, entree: 0.0, side: 0.15, dessert: 0.1, counter: 0.25, drink: 1.18 },
  kiosk: { main: 1.35, entree: 0.0, side: 0.35, dessert: 0.1, counter: 0.15, drink: 0.55 },
  canteen: { main: 0.75, entree: 0.0, side: 0.3, dessert: 0.2, counter: 0.55, drink: 0.45 },
};

export const VENUE_LABEL: Record<VenueType, string> = {
  restaurant: "Restaurant",
  cafe: "Cafe",
  kiosk: "Kiosk / van on a pitch",
  canteen: "Canteen",
};

/** What "covers" means for each venue, shown as helper text on the form. */
export const COVERS_HELP: Record<VenueType, string> = {
  restaurant: "Covers seated — bookings plus walk-ins.",
  cafe: "Customers through the door, not just food orders.",
  kiosk: "Customers served, not items sold.",
  canteen: "The number who actually buy, not the roll.",
};

/** Safety stock on top of the computed par, by shelf-life band. */
export const SAFETY_PCT: Record<ShelfLife, number> = {
  short: 0.05,
  medium: 0.1,
  long: 0.1,
};

export const SHELF_LIFE_DAYS: Record<ShelfLife, number> = {
  short: 2,
  medium: 7,
  long: 21,
};

export const SHELF_LIFE_LABEL: Record<ShelfLife, string> = {
  short: "Short (1–2 days)",
  medium: "Medium (3–7 days)",
  long: "Long (3+ weeks)",
};

/** Minutes of prep per kilo, one person, by category. */
export const PREP_MINUTES_PER_KG: Record<ServiceCategory, number> = {
  main: 1.0,
  entree: 1.5,
  side: 2.0,
  dessert: 2.5,
  counter: 2.0,
  drink: 0.2,
};

// ------------------------------------------------------------- PACKAGING

export const PACKAGING_CORE = [
  "Gastronorm trays + lids — count against the number of dishes",
  "Cambros / insulated boxes",
  "Eskies + ice bricks",
  "Foil, cling film, baking paper, foil trays",
  "Zip bags, vac bags, takeaway containers",
  "Labels + waterproof marker",
  "Serving tongs, spoons, ladles — 2 per dish + 4 spare",
  "Nitrile gloves — 2 boxes minimum",
  "Sanitiser spray + food-safe sanitiser",
  "Chux, tea towels, paper towel",
  "Heavy-duty garbage bags + recycling",
  "Probe thermometer + temp log",
  "First aid kit, blue bandaids, burn gel",
];

export const PACKAGING_BY_STYLE: Record<string, string[]> = {
  shared: [
    "Platters, boards, bowls",
    "Chafing dishes + chafing fuel — 2 hrs each, count it",
    "Menu cards + allergen cards",
    "Napkins",
  ],
  plated: [
    "Plates and covers, counted against the cover number",
    "Chafing dishes + chafing fuel — 2 hrs each, count it",
    "Pass space and heat lamps confirmed with the venue",
    "Menu cards + allergen cards",
  ],
  grazing: [
    "Boards, slates, bowls and risers",
    "Cheese knives, picks, skewers",
    "Menu cards + allergen cards",
    "Napkins",
  ],
  van: [
    "Gas bottles — 2, one spare",
    "Oil + oil disposal container",
    "Wraps, boats, serviettes",
    "Order pad or POS, float, EFTPOS",
    "Hand-wash station",
    "Fire blanket / extinguisher",
    "Spare tongs and scrapers",
  ],
  multiday: [
    "Platters, boards, bowls",
    "Chafing dishes + chafing fuel — 2 hrs each, count it",
    "Urn / hot water",
    "Fridge and freezer capacity confirmed with the venue in writing",
    "Menu cards + allergen cards",
  ],
};

export const PACKAGING_CREW = [
  "Aprons, cloths, hats/hairnets",
  "Crew water and crew meals",
  "Run sheet printed, one per person",
];

// -------------------------------------------------------------- COUNTDOWN

export const COUNTDOWN: { daysOut: number; label: string; items: string[] }[] = [
  {
    daysOut: 14,
    label: "T-14 — Lock the job",
    items: [
      "Menu signed off in writing",
      "Deposit received / invoice raised",
      "Guest number estimate recorded",
      "Dietaries in writing — allergies vs preferences",
      "Venue confirmed: access, kitchen, power, water, fridge, gas, parking, bump-in",
      "Service times locked",
      "Pre-orders placed: whole lamb, seafood, specialty cheese, cake, hire gear",
    ],
  },
  {
    daysOut: 7,
    label: "T-7 — ORDER DAY",
    items: [
      "Confirm the working headcount — this is what you order to",
      "Shop the pantry first, record what's already in stock",
      "Send one email per supplier, delivery date and window on every order",
      "Confirm hire: crockery, chafers, urns, tables, linen",
      "Confirm crew: who, what time, what they're wearing, who leads",
      "Ask suppliers to flag short supply before dispatch",
    ],
  },
  {
    daysOut: 3,
    label: "T-3 — Final numbers",
    items: [
      "Final headcount in writing",
      "If the number moved more than 10%, adjust orders now",
      "Dietary count locked and matched to specific dishes",
      "All supplier orders confirmed back in writing",
      "Run sheet drafted",
      "Fuel, gas bottles and ice ordered or booked",
    ],
  },
  {
    daysOut: 2,
    label: "T-2 — Receive",
    items: [
      "Check every delivery against the order sheet before signing",
      "Short or wrong: call the supplier same day",
      "Marinades, sauces, dressings and slow-cook items started",
    ],
  },
  {
    daysOut: 1,
    label: "T-1 — Prep and pack",
    items: [
      "Pack the packaging and equipment kit today, not the morning of",
      "Label everything: dish, date, allergen flags",
      "Print menu cards, allergen cards, run sheet",
      "Fuel the vehicle, charge phone, test EFTPOS",
    ],
  },
  {
    daysOut: 0,
    label: "Event day — Load out",
    items: [
      "Cold chain: eskies + ice bricks packed last, loaded last, temps logged",
      "Knife kit, thermometer, gloves, sanitiser, first aid on board",
      "Serving gear counted out loud against the list",
      "Client contact and venue access details in the phone",
      "Business cards and final invoice ready",
    ],
  },
  {
    daysOut: -1,
    label: "T+1 — Close",
    items: [
      "Final invoice sent",
      "Actual quantities used vs ordered recorded",
      "Leftovers and waste noted",
      "Thank you + photo request to the client",
    ],
  },
];

export const DISCLAIMER =
  "These quantities are a planning guide based on standard yields. Check them against your own service records before ordering.";
