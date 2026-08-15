/**
 * Display-only lists for the forms.
 *
 * Deliberately separate from `tables.ts`: the form runs in the browser, and
 * `tables.ts` holds the yields and per-head figures that are the product. Only
 * labels and keys cross that line. `options.test.ts` keeps the two in step.
 */

export const PROTEIN_CHOICES = [
  { key: "brisket", label: "Beef brisket, slow cooked" },
  { key: "porkShoulder", label: "Pork shoulder, pulled" },
  { key: "lambShoulder", label: "Lamb shoulder, bone in" },
  { key: "beefRoast", label: "Beef roast / rump" },
  { key: "chickenThigh", label: "Chicken thigh, boneless" },
  { key: "chickenBreast", label: "Chicken breast, boneless" },
  { key: "wholeChicken", label: "Whole chicken" },
  { key: "fishFillet", label: "Fish fillet (barramundi, salmon)" },
  { key: "wholeFish", label: "Whole fish" },
  { key: "prawns", label: "Prawns, shell on" },
  { key: "mince", label: "Mince (burger, tacos, koftas)" },
  { key: "tofu", label: "Tofu / firm plant protein" },
  { key: "legumes", label: "Legumes, dried" },
] as const;

export const STYLE_CHOICES = [
  { key: "shared", label: "Shared table" },
  { key: "plated", label: "Plated" },
  { key: "grazing", label: "Grazing / canapés" },
  { key: "van", label: "Van / street food" },
  { key: "multiday", label: "Multi-day / retreat" },
] as const;

/**
 * Courses, in the order they'd appear on a menu rather than alphabetically.
 * The recipe form writes one of these into `recipes.course`; the job page
 * groups by them. Shared so the two can't drift apart and leave a dish filed
 * under a heading the picker doesn't show.
 *
 * `course` is free text in the database, and older rows may hold something
 * that isn't on this list. Anything unrecognised — or missing — groups under
 * "Other" rather than disappearing.
 */
export const COURSE_CHOICES = [
  "Entrée",
  "Main",
  "Side",
  "Sauce",
  "Dessert",
  "Other",
] as const;

export const OTHER_COURSE = "Other";

export const BITE_SIZE_CHOICES = [
  { key: "smaller", label: "Smaller bites — one or two mouthfuls each" },
  { key: "standard", label: "Standard — as your recipes are written" },
  { key: "bigger", label: "Bigger bites — sliders and the like" },
] as const;

export const MENU_WEIGHT_CHOICES = [
  { key: "light", label: "Light lunch / daytime" },
  { key: "standard", label: "Standard dinner" },
  { key: "feasting", label: "Big feasting / long table" },
] as const;

export const STARCH_CHOICES = [
  { key: "none", label: "No starch" },
  { key: "potato", label: "Roast potato" },
  { key: "rice", label: "Rice" },
  { key: "couscous", label: "Cous cous / quinoa" },
  { key: "pasta", label: "Pasta" },
] as const;

export const VAN_ITEM_CHOICES = [
  { key: "burgers", label: "Burgers" },
  { key: "tacos", label: "Tacos" },
  { key: "loadedFries", label: "Loaded fries" },
] as const;

export const VENUE_CHOICES = [
  { key: "restaurant", label: "Restaurant" },
  { key: "cafe", label: "Cafe" },
  { key: "kiosk", label: "Kiosk / van on a pitch" },
  { key: "canteen", label: "Canteen" },
] as const;

export const VENUE_COVERS_HELP: Record<string, string> = {
  restaurant: "Covers seated — bookings plus walk-ins.",
  cafe: "Customers through the door, not just food orders.",
  kiosk: "Customers served, not items sold.",
  canteen: "The number who actually buy, not the roll.",
};

export const SERVICE_CATEGORY_CHOICES = [
  { key: "main", label: "Main" },
  { key: "entree", label: "Entrée" },
  { key: "side", label: "Side" },
  { key: "dessert", label: "Dessert" },
  { key: "counter", label: "Counter / cabinet" },
  { key: "drink", label: "Drink" },
] as const;

export const SHELF_LIFE_CHOICES = [
  { key: "short", label: "Short — 1–2 days" },
  { key: "medium", label: "Medium — 3–7 days" },
  { key: "long", label: "Long — 3+ weeks" },
] as const;

export const WEEKDAY_CHOICES = [
  "Mon",
  "Tue",
  "Wed",
  "Thu",
  "Fri",
  "Sat",
  "Sun",
] as const;

export const DISCLAIMER_TEXT =
  "These quantities are a planning guide based on standard yields. Check them against your own service records before ordering.";
