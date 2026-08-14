export type MenuWeight = "light" | "standard" | "feasting";
export type ServiceStyle = "shared" | "plated" | "grazing" | "van" | "multiday";
export type VenueType = "restaurant" | "cafe" | "kiosk" | "canteen";
export type ShelfLife = "short" | "medium" | "long";
export type Weekday = "Mon" | "Tue" | "Wed" | "Thu" | "Fri" | "Sat" | "Sun";

export const WEEKDAYS: Weekday[] = [
  "Mon",
  "Tue",
  "Wed",
  "Thu",
  "Fri",
  "Sat",
  "Sun",
];

export type Category =
  | "Meat/Seafood"
  | "Produce"
  | "Dairy"
  | "Dry goods"
  | "Packaging"
  | "Drinks";

/** One orderable line. `basis` shows the maths so a chef can sanity-check it. */
export interface OrderLine {
  item: string;
  qty: number;
  unit: string;
  category: Category;
  forDish: string;
  basis: string;
  /** True when a figure came from a default rather than something the user told us. */
  assumption?: boolean;
}

export interface CountdownStep {
  label: string;
  date: string;
  daysOut: number;
  overdue: boolean;
  items: string[];
}

export interface Risk {
  risk: string;
  fix: string;
}

// ---------------------------------------------------------------- EVENT MODE

export interface Dietary {
  label: string;
  count: number;
}

export interface EventInput {
  guests: number;
  /** ISO yyyy-mm-dd */
  eventDate: string;
  /** ISO yyyy-mm-dd */
  today: string;
  style: ServiceStyle;
  menuWeight: MenuWeight;
  /** Keys into PROTEINS. */
  proteins: string[];
  sidesCount: number;
  starch: "potato" | "rice" | "couscous" | "pasta" | "none";
  bread: boolean;
  dessert: "none" | "shared" | "bites";
  grazing: "none" | "starter" | "meal";
  canapes: "none" | "predinner" | "meal";
  drinksService: boolean;
  hotOrOutdoors: boolean;
  dietaries: Dietary[];
  /** Van / kiosk only. */
  vanItem?: "burgers" | "tacos" | "loadedFries";
  serviceWindowHours?: number;
}

export interface EventPlan {
  guests: number;
  crewMeals: number;
  effectiveGuests: number;
  bufferPct: number;
  servedProteinPerPerson: number;
  servedPerProtein: number;
  orders: OrderLine[];
  dietaryNotes: string[];
  packaging: string[];
  countdown: CountdownStep[];
  risks: Risk[];
  missing: string[];
  warnings: string[];
}

// -------------------------------------------------------------- SERVICE MODE

export type ServiceCategory =
  | "main"
  | "entree"
  | "side"
  | "dessert"
  | "counter"
  | "drink";

export interface ServiceItem {
  name: string;
  category: ServiceCategory;
  /** Key into PROTEINS. Omit for items with no yield loss. */
  proteinKey?: string;
  portionG: number;
  /** 0..1. Omit to derive from venue attach rates + an even split. */
  mixPct?: number;
  shelfLife: ShelfLife;
  onHandKg?: number;
}

export interface ServiceInput {
  venueType: VenueType;
  covers: Record<Weekday, number>;
  deliveryDays: Weekday[];
  leadTimeHours: number;
  items: ServiceItem[];
  fridgeCapacityKg?: number;
  prepHoursAvailable?: number;
  /** Kiosk/van: how many hours the window is open on its busiest day. */
  serviceWindowHours?: number;
}

export interface ParLine {
  item: string;
  category: ServiceCategory;
  coverWindow: number;
  windowDays: number;
  mixPct: number;
  mixIsAssumed: boolean;
  portionG: number;
  yieldMultiplier: number;
  safetyPct: number;
  parKg: number;
  onHandKg: number;
  orderKg: number;
  shelfLife: ShelfLife;
  shelfLifeDays: number;
  flag?: string;
  basis: string;
}

export interface DeliveryCycle {
  day: Weekday;
  carries: Weekday[];
  coverWindow: number;
  windowDays: number;
  lines: ParLine[];
}

export interface PrepTask {
  task: string;
  minutes: number;
}

export interface ServicePlan {
  venueType: VenueType;
  weeklyCovers: number;
  deliveries: DeliveryCycle[];
  prep: PrepTask[];
  prepTotalMinutes: number;
  prepHoursAvailable?: number;
  storageKg: number;
  fridgeCapacityKg?: number;
  risks: Risk[];
  missing: string[];
  warnings: string[];
}
