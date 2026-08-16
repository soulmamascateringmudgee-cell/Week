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
  /**
   * The figure before rounding. Totalling rounded numbers rounds twice and
   * drifts upward, so anything that adds lines together uses this.
   */
  rawQty?: number;
}

export interface CountdownStep {
  label: string;
  date: string;
  daysOut: number;
  overdue: boolean;
  items: string[];
}

/** One ingredient of a dish, already scaled to this job's headcount. */
export interface ScaledIngredient {
  item: string;
  qty: number;
  unit: string;
}

/**
 * A dish written out at this job's size — what actually goes into the pot on
 * the day, rather than the totals on the order sheet. The order sheet says buy
 * 6 kg of onions; this says which dish wants how many of them.
 */
export interface DishSheet {
  name: string;
  course?: string | null;
  /** "for 10, written for 10" */
  scaleNote: string;
  /**
   * True when the amounts are stuck in the ingredient names, so nothing on
   * this sheet can be trusted until the recipe is fixed.
   */
  unscalable?: boolean;
  ingredients: ScaledIngredient[];
  method?: string | null;
  notes?: string | null;
}

/** One job on the prep list, tied to the dish that needs it. */
export interface PrepTaskLine {
  dish: string;
  task: string;
  /** Why it sits on this day — shown so the timing can be argued with. */
  because: string;
  /** What goes into this dish, at this job's size. */
  ingredients: ScaledIngredient[];
}

/** One day of the prep list. `daysOut` counts back from the event. */
export interface PrepDay {
  daysOut: number;
  date: string;
  label: string;
  overdue: boolean;
  tasks: PrepTaskLine[];
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

/** One line of a recipe, in the quantity the operator actually buys. */
export interface RecipeIngredient {
  item: string;
  qty: number;
  unit: string;
  category: Category;
}

/**
 * A dish in the operator's own numbers. `serves` is how many people the
 * ingredient quantities below are written for — everything scales from that.
 */
export interface Recipe {
  id?: string;
  name: string;
  course?: string | null;
  serves: number;
  ingredients: RecipeIngredient[];
  method?: string | null;
  notes?: string | null;
}

/** How hungry the room is. Scales your recipes, not the built-in tables. */
export type BiteSize = "smaller" | "standard" | "bigger";

export interface EventInput {
  guests: number;
  /** Dishes from the operator's recipe book, scaled to this job. */
  recipes?: Recipe[];
  /** Defaults to "standard" when not given. */
  biteSize?: BiteSize;
  /** The operator's price list, for costing the order. */
  prices?: IngredientPrice[];
  /** Total food budget for this job, in dollars. */
  budget?: number;
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

/** What one ingredient costs, per unit, from the operator's price list. */
export interface IngredientPrice {
  id?: string;
  item: string;
  unit: string;
  price: number;
  supplier?: string | null;
}

export interface JobCosting {
  /** Total of the lines that could be costed — not necessarily the whole job. */
  total: number;
  perHead: number;
  priced: { item: string; cost: number; basis: string }[];
  /** Ingredients with no price on file. */
  unpriced: string[];
  /** Priced, but in a unit that can't be reconciled with the order line. */
  mismatched: string[];
  /** True only when every line was costed. */
  complete: boolean;
  budget?: number;
  budgetPerHead?: number;
  verdict: "under" | "over" | "incomplete" | "no-budget";
}

export interface EventPlan {
  guests: number;
  costing?: JobCosting;
  crewMeals: number;
  effectiveGuests: number;
  bufferPct: number;
  servedProteinPerPerson: number;
  servedPerProtein: number;
  orders: OrderLine[];
  dietaryNotes: string[];
  packaging: string[];
  /** Every attached dish written out at this job's size. */
  dishSheets: DishSheet[];
  /** Dated cooking prep, worked out from the dishes on the menu. */
  prep: PrepDay[];
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
