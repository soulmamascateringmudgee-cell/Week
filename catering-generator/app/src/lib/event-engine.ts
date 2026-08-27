import {
  BITE_SIZE,
  BREAD_PIECES,
  BUTTER_G,
  CANAPE_PIECES,
  COFFEE_CUPS,
  COUNTDOWN,
  CREW_MEALS,
  DESSERT_BITES,
  DESSERT_G,
  GRAZING_SPLIT,
  GRAZING_TOTAL_G,
  ICE_G_CHILLING,
  ICE_G_DRINKS_SERVICE,
  MENU_WEIGHT_G,
  MILK_ML_PER_COFFEE,
  PACKAGING_BY_STYLE,
  PACKAGING_CORE,
  PACKAGING_CREW,
  PICKLE_G_PER_ITEM,
  PROTEINS,
  SALAD_LEAVES_G,
  SAUCE_ML_PER_ITEM,
  SOFT_DRINK_ML,
  STARCHES,
  THROUGHPUT_ITEMS_PER_HOUR,
  VAN_ITEMS,
  WATER_ML,
  WATER_ML_HOT,
  bufferFor,
  protein,
  sideGramsPerPerson,
} from "./tables.ts";
import { combineOrders } from "./combine.ts";
import { scaledToOrderUnits, toOrderUnits } from "./measure.ts";
import { toWholeProduce } from "./produce.ts";
import { hasUnscalableAmounts, unscalableWarning } from "./recipe-health.ts";
import { costOrders } from "./costing.ts";
import { addDays, daysBetween, formatDate, parseISODate } from "./dates.ts";
import { round1, roundForUnit, roundKg, roundL, roundUnits } from "./round.ts";
import type {
  CountdownStep,
  DishSheet,
  EventInput,
  EventPlan,
  OrderLine,
  Risk,
} from "./types.ts";
import { buildPrepPlan } from "./prep.ts";

function validate(input: EventInput): void {
  if (!Number.isFinite(input.guests) || input.guests < 1) {
    throw new Error("Guest count must be at least 1.");
  }
  if (input.guests > 5000) {
    throw new Error("Guest count over 5000 — check the number before ordering.");
  }
  // No proteins is fine when the menu is made of the operator's own recipes —
  // a canapé job doesn't have a "main", and printing a 9 kg mince line on it
  // is worse than printing nothing.
  if (input.proteins.length === 0 && (input.recipes ?? []).length === 0) {
    throw new Error(
      "Add a dish from your recipes, or tick a protein — otherwise there's nothing to work out.",
    );
  }
  for (const key of input.proteins) {
    if (!protein(key)) throw new Error(`Unknown protein: "${key}"`);
  }
  if (input.sidesCount < 0 || input.sidesCount > 6) {
    throw new Error("Sides count must be between 0 and 6.");
  }
}

export function planEvent(input: EventInput): EventPlan {
  validate(input);

  const today = parseISODate(input.today);
  const eventDate = parseISODate(input.eventDate);
  const daysToEvent = daysBetween(today, eventDate);

  const guests = Math.round(input.guests);
  const effectiveGuests = guests + CREW_MEALS;
  const bufferPct = bufferFor(guests);
  const scale = effectiveGuests * (1 + bufferPct);

  const orders: OrderLine[] = [];
  const warnings: string[] = [];

  /** Turn grams-per-person into a rounded kilo line. */
  const kgLine = (
    gramsPerPerson: number,
    line: Omit<OrderLine, "qty" | "unit" | "basis">,
    basisPrefix: string,
  ): void => {
    const kg = (gramsPerPerson * scale) / 1000;
    if (kg <= 0) return;
    orders.push({
      ...line,
      qty: roundKg(kg),
      rawQty: kg,
      unit: "kg",
      basis: `${basisPrefix} → ${Math.round(gramsPerPerson)} g/head × ${effectiveGuests} (incl. ${CREW_MEALS} crew) × ${(1 + bufferPct).toFixed(2)} buffer`,
    });
  };

  // -------------------------------------------------------------- recipes
  //
  // The operator's own dishes, in their own quantities. These are already
  // ordering weights — what you buy for `serves` people — so they scale
  // straight off the headcount with no yield multiplier on top. A recipe
  // saying 5 kg of brisket means order 5 kg.

  const recipes = input.recipes ?? [];
  const biteSize = input.biteSize ?? "standard";
  const appetite = BITE_SIZE[biteSize] ?? 1;

  const dishSheets: DishSheet[] = [];

  for (const recipe of recipes) {
    if (!Number.isFinite(recipe.serves) || recipe.serves < 1) {
      throw new Error(
        `"${recipe.name}" doesn't say how many it serves, so it can't be scaled.`,
      );
    }
    const factor = (scale / recipe.serves) * appetite;

    // A recipe whose amounts live in its ingredient names multiplies "1 ea" and
    // produces a confidently wrong sheet. Say so rather than order from it.
    const unscalable = hasUnscalableAmounts(recipe);
    if (unscalable) warnings.push(unscalableWarning(recipe));

    // The same scaled numbers the order lines are built from, kept per dish so
    // a cook can see how much of the shop belongs to which pot.
    dishSheets.push({
      name: recipe.name,
      course: recipe.course ?? null,
      unscalable,
      scaleNote: `written for ${recipe.serves} → ×${factor.toFixed(2)} for ${effectiveGuests} (incl. ${CREW_MEALS} crew) + ${Math.round(bufferPct * 100)}% buffer`,
      // The cook's own sheet gets the same treatment as the order sheet. At
      // this scale "41.8 cup" is no more useful standing at the bench than it
      // is standing at the greengrocer.
      ingredients: scaledToOrderUnits(
        recipe.ingredients
          .filter((i) => Number.isFinite(i.qty) && i.qty > 0)
          .map((i) => ({
            item: i.item,
            qty: roundForUnit(i.qty * factor, i.unit),
            unit: i.unit,
          })),
      ),
      method: recipe.method ?? null,
      notes: recipe.notes ?? null,
    });

    for (const ingredient of recipe.ingredients) {
      if (!Number.isFinite(ingredient.qty) || ingredient.qty <= 0) continue;
      const scaled = ingredient.qty * factor;
      orders.push({
        item: ingredient.item,
        qty: roundForUnit(scaled, ingredient.unit),
        rawQty: scaled,
        unit: ingredient.unit,
        category: ingredient.category,
        forDish: recipe.name,
        basis:
          `${ingredient.qty} ${ingredient.unit} per ${recipe.serves} → ×${factor.toFixed(2)} for ${effectiveGuests} (incl. ${CREW_MEALS} crew) + ${Math.round(bufferPct * 100)}% buffer` +
          (biteSize === "standard" ? "" : `, ${biteSize} bites`),
      });
    }
  }

  if (recipes.length > 0 && input.sidesCount > 0) {
    warnings.push(
      `You've attached ${recipes.length} recipe${recipes.length === 1 ? "" : "s"} and also asked for ${input.sidesCount} generic side${input.sidesCount === 1 ? "" : "s"}. Check you're not ordering the same food twice — if the recipes cover your sides, set the sides count to 0.`,
    );
  }

  // ------------------------------------------------------------- proteins

  // Zero proteins means the menu is entirely the operator's own recipes, so
  // there is no "main" to divide up. Dividing by zero here would put Infinity
  // on an order sheet.
  const servedProteinPerPerson =
    input.proteins.length > 0 ? MENU_WEIGHT_G[input.menuWeight] : 0;
  const servedPerProtein =
    input.proteins.length > 0
      ? servedProteinPerPerson / input.proteins.length
      : 0;

  for (const key of input.proteins) {
    const p = protein(key)!;
    const rawPerHead = servedPerProtein * p.yieldMultiplier;
    kgLine(
      rawPerHead,
      {
        item: p.label,
        category: p.category,
        forDish: "Main",
      },
      `${Math.round(servedPerProtein)} g served × ${p.yieldMultiplier.toFixed(2)} yield`,
    );
  }

  // ---------------------------------------------------------------- sides

  const starch = STARCHES.find((s) => s.key === input.starch);
  const totalSideSlots = input.sidesCount + (starch ? 1 : 0);

  if (input.sidesCount > 0) {
    const perSide = sideGramsPerPerson(totalSideSlots);
    for (let i = 1; i <= input.sidesCount; i += 1) {
      kgLine(
        perSide,
        {
          item: `Side ${i} — raw ingredients`,
          category: "Produce",
          forDish: `Side ${i}`,
          assumption: true,
        },
        `${totalSideSlots} sides on the menu`,
      );
    }
    kgLine(
      SALAD_LEAVES_G,
      { item: "Salad leaves", category: "Produce", forDish: "Salads" },
      "Leaves only, picked weight",
    );
  }

  if (starch) {
    const grams =
      totalSideSlots <= 1 ? starch.soloGramsPerPerson : starch.gramsPerPerson;
    kgLine(
      grams,
      { item: starch.label, category: starch.category, forDish: "Starch" },
      totalSideSlots <= 1 ? "Only starch on the menu" : "One of several sides",
    );
  }

  if (input.bread) {
    orders.push({
      item: "Bread rolls / flatbread",
      qty: roundUnits(BREAD_PIECES * scale),
      unit: "pieces",
      category: "Dry goods",
      forDish: "Table bread",
      basis: `${BREAD_PIECES} pieces/head × ${effectiveGuests} × ${(1 + bufferPct).toFixed(2)} buffer`,
    });
    kgLine(
      BUTTER_G,
      { item: "Butter", category: "Dairy", forDish: "Table bread" },
      "Served with bread",
    );
  }

  // -------------------------------------------------------------- grazing

  if (input.grazing !== "none") {
    const total = GRAZING_TOTAL_G[input.grazing];
    for (const part of GRAZING_SPLIT) {
      kgLine(
        total * part.share,
        {
          item: part.label,
          category: part.category,
          forDish: "Grazing",
        },
        `${total} g grazing/head × ${Math.round(part.share * 100)}%`,
      );
    }
  }

  if (input.canapes !== "none") {
    const pieces = CANAPE_PIECES[input.canapes];
    orders.push({
      item: "Canapés (pieces to produce)",
      qty: roundUnits(pieces * scale),
      unit: "pieces",
      category: "Produce",
      forDish: "Canapés",
      basis: `${pieces} pieces/head × ${effectiveGuests} × ${(1 + bufferPct).toFixed(2)} buffer`,
      assumption: true,
    });
  }

  // ------------------------------------------------------------ van items

  const vanItem = input.vanItem
    ? VAN_ITEMS.find((v) => v.key === input.vanItem)
    : undefined;
  let vanItemCount = 0;

  if (vanItem) {
    vanItemCount = vanItem.perPerson * scale;
    orders.push({
      item: `${vanItem.label} — items to serve`,
      qty: roundUnits(vanItemCount),
      unit: "items",
      category: "Produce",
      forDish: "Van service",
      basis: `${vanItem.perPerson} per head × ${effectiveGuests} × ${(1 + bufferPct).toFixed(2)} buffer`,
    });

    if (vanItem.key === "loadedFries") {
      orders.push({
        item: vanItem.carrierLabel,
        qty: roundKg((vanItemCount * vanItem.carrierPerItem * 1000) / 1000),
        unit: "kg",
        category: "Produce",
        forDish: "Van service",
        basis: `${vanItem.carrierPerItem} kg per serve × ${roundUnits(vanItemCount)} serves`,
      });
    } else {
      orders.push({
        item: vanItem.carrierLabel,
        qty: roundUnits(vanItemCount * vanItem.carrierPerItem),
        unit: "pieces",
        category: "Dry goods",
        forDish: "Van service",
        basis: `${vanItem.carrierPerItem}× the item count (breakage + seconds)`,
      });
    }

    orders.push({
      item: "Sauces",
      qty: roundL((vanItemCount * SAUCE_ML_PER_ITEM) / 1000),
      unit: "L",
      category: "Dry goods",
      forDish: "Van service",
      basis: `${SAUCE_ML_PER_ITEM} ml per item × ${roundUnits(vanItemCount)} items`,
    });
    orders.push({
      item: "Pickles / onion",
      qty: roundKg((vanItemCount * PICKLE_G_PER_ITEM) / 1000),
      unit: "kg",
      category: "Produce",
      forDish: "Van service",
      basis: `${PICKLE_G_PER_ITEM} g per item × ${roundUnits(vanItemCount)} items`,
    });
  }

  // -------------------------------------------------------------- dessert

  if (input.dessert === "shared") {
    kgLine(
      DESSERT_G,
      { item: "Dessert components", category: "Dairy", forDish: "Dessert", assumption: true },
      "Plated / shared dessert",
    );
  } else if (input.dessert === "bites") {
    orders.push({
      item: "Petit fours / sweet bites",
      qty: roundUnits(DESSERT_BITES * scale),
      unit: "pieces",
      category: "Dry goods",
      forDish: "Dessert",
      basis: `${DESSERT_BITES} pieces/head × ${effectiveGuests} × ${(1 + bufferPct).toFixed(2)} buffer`,
    });
  }

  // --------------------------------------------------------------- drinks

  const waterMl = input.hotOrOutdoors ? WATER_ML_HOT : WATER_ML;
  orders.push({
    item: "Water",
    qty: roundL((waterMl * scale) / 1000),
    unit: "L",
    category: "Drinks",
    forDish: "Service",
    basis: input.hotOrOutdoors
      ? `${waterMl} ml/head (hot or outdoors)`
      : `${waterMl} ml/head`,
  });

  if (input.drinksService) {
    orders.push({
      item: "Juice / soft drink",
      qty: roundL((SOFT_DRINK_ML * scale) / 1000),
      unit: "L",
      category: "Drinks",
      forDish: "Drinks service",
      basis: `${SOFT_DRINK_ML} ml/head`,
    });
    orders.push({
      item: "Milk (coffee)",
      qty: roundL((COFFEE_CUPS * MILK_ML_PER_COFFEE * scale) / 1000),
      unit: "L",
      category: "Dairy",
      forDish: "Coffee",
      basis: `${COFFEE_CUPS} cups/head × ${MILK_ML_PER_COFFEE} ml milk`,
    });
  }

  const iceG = input.drinksService ? ICE_G_DRINKS_SERVICE : ICE_G_CHILLING;
  orders.push({
    item: "Ice",
    qty: roundKg((iceG * scale) / 1000),
    unit: "kg",
    category: "Packaging",
    forDish: "Cold chain / drinks",
    basis: input.drinksService
      ? `${iceG} g/head with drinks service`
      : `${iceG} g/head, chilling only`,
  });

  // ----------------------------------------------------------- dietaries

  const dietaryNotes: string[] = [];
  const dietaryTotal = input.dietaries.reduce((sum, d) => sum + d.count, 0);
  for (const d of input.dietaries) {
    if (d.count <= 0) continue;
    dietaryNotes.push(
      `${d.label} × ${d.count} — order and pack separately, labelled. Do not let this become general stock.`,
    );
  }
  if (dietaryTotal > 0) {
    dietaryNotes.push(
      "Brief the crew before service: dietary containers are not for topping up the main dishes.",
    );
  }

  // ----------------------------------------------------------- packaging

  const packaging = [
    ...PACKAGING_CORE,
    ...(PACKAGING_BY_STYLE[input.style] ?? []),
    ...PACKAGING_CREW,
  ];

  // ---------------------------------------------------------------- prep

  const prep = buildPrepPlan(recipes, dishSheets, input.eventDate, input.today);

  // ----------------------------------------------------------- countdown

  const countdown: CountdownStep[] = COUNTDOWN.map((step) => {
    const date = addDays(eventDate, -step.daysOut);
    return {
      label: step.label,
      date: formatDate(date),
      daysOut: step.daysOut,
      overdue: step.daysOut > 0 && daysToEvent < step.daysOut,
      items: step.items,
    };
  });

  if (daysToEvent < 0) {
    warnings.push(
      "The event date is in the past. Check the date before you order anything.",
    );
  } else if (daysToEvent < 7) {
    warnings.push(
      `Today is T-${daysToEvent}. Order day (T-7) has already passed — place orders today and call your suppliers rather than emailing.`,
    );
  }

  // --------------------------------------------------------------- risks

  const risks: Risk[] = [];

  if (daysToEvent >= 0 && daysToEvent < 7) {
    risks.push({
      risk: `Only ${daysToEvent} days out — past the T-7 order anchor.`,
      fix: "Phone every supplier today rather than emailing, and confirm delivery windows verbally. Drop any menu item you can't source in time now, not on the day.",
    });
  }

  if (vanItem && input.serviceWindowHours) {
    const capacity = THROUGHPUT_ITEMS_PER_HOUR * input.serviceWindowHours;
    if (vanItemCount > capacity) {
      risks.push({
        risk: `Throughput: ${roundUnits(vanItemCount)} items in a ${input.serviceWindowHours} hr window needs ~${Math.ceil(vanItemCount / input.serviceWindowHours)} items/hr, above the ~${THROUGHPUT_ITEMS_PER_HOUR}/hr one window does.`,
        fix: "Add a second service point, extend the window, or pre-portion so service is assembly only. Extra food will not sell itself faster.",
      });
    }
  }

  if (dietaryTotal > 0) {
    risks.push({
      risk: `${dietaryTotal} dietary guests — the usual failure is their food getting used up in the main service.`,
      fix: "Order and pack dietary items separately, label them, and keep them off the main pass.",
    });
  }

  if (input.grazing !== "none") {
    risks.push({
      risk: "Grazing goes roughly 30% faster than expected when there's alcohol and no seating.",
      fix: "Weigh grazing out rather than eyeballing it, hold back a top-up tray, and order it fresh at T-2 maximum.",
    });
  }

  if (input.style === "multiday") {
    risks.push({
      risk: "Multi-day: venue fridge and freezer capacity is what bites, not the food cost.",
      fix: "Measure the venue's usable cold storage before finalising, and split the delivery across the stay if it won't fit.",
    });
  }

  if (input.hotOrOutdoors) {
    risks.push({
      risk: "Hot or outdoor service — cold chain and water both come under pressure.",
      fix: "Double the ice, log temps on arrival and every two hours, and keep the dairy and leaf salads in the shade until service.",
    });
  }

  if (input.proteins.some((k) => k === "fishFillet" || k === "wholeFish" || k === "prawns")) {
    risks.push({
      risk: "Seafood on the menu — shortest shelf life and the most likely short-supply item.",
      fix: "Order at T-7 with delivery at T-2 at the earliest, and ask the supplier to confirm the species and size before dispatch.",
    });
  }

  if (input.style === "plated" && guests >= 60) {
    risks.push({
      risk: `Plated service for ${guests} — the constraint is pass space and hands, not food.`,
      fix: "Confirm the pass can hold a full wave, and roster enough plating hands to get all covers away inside 15 minutes.",
    });
  }

  if (risks.length === 0) {
    risks.push({
      risk: "Headcount moving after the order goes in.",
      fix: "Get the final number in writing at T-3, and put a change cut-off in the quote so anything after that is charged.",
    });
  }

  // ------------------------------------------------------------- missing

  const missing: string[] = [];
  if (dietaryTotal === 0) {
    missing.push(
      "Any dietaries? Allergies and preferences in writing, and whether a shared dish already covers them.",
    );
  }
  missing.push(
    "What's already in the pantry, freezer and packaging store? Shop that first — it comes straight off this order.",
  );
  missing.push(
    "Venue: kitchen access, fridge and freezer space, power, gas and bump-in time.",
  );
  if (vanItem && !input.serviceWindowHours) {
    missing.push(
      "How many hours is the service window? Without it the throughput check can't run.",
    );
  }
  missing.push(
    "Is the guest count confirmed or an estimate? If it's an estimate, when do you get the final number?",
  );

  // Costing runs on the combined lines, so bacon is priced once against its
  // total rather than three times against three part-quantities.
  // Spoons and cups become millilitres and grams before anything is totalled.
  // A recipe's "1½ cups" scaled to a real job is "41.8 cup", which nobody can
  // order — and two dishes measuring the same vinegar in different spoons
  // would otherwise print as two lines nobody adds up.
  const combinedOrders = combineOrders(toOrderUnits(orders));
  const costing =
    (input.prices ?? []).length > 0 || input.budget !== undefined
      ? costOrders(combinedOrders, input.prices ?? [], guests, input.budget)
      : undefined;

  // Fresh produce is bought by the piece, so the order sheet counts it that
  // way — four carrots, not 380 g of carrot. This runs last of all, for two
  // reasons. After combining, so a vegetable shared across three dishes rounds
  // up once instead of three times. After costing, because a price is quoted
  // per kilo and the costing has to see the kilos.
  const shoppingOrders = toWholeProduce(combinedOrders);

  return {
    guests,
    crewMeals: CREW_MEALS,
    effectiveGuests,
    bufferPct,
    servedProteinPerPerson,
    servedPerProtein: round1(servedPerProtein),
    // One line per ingredient, not one per dish. Three bacon lines is three
    // chances to order the wrong amount.
    orders: shoppingOrders,
    costing,
    dietaryNotes,
    packaging,
    dishSheets,
    prep,
    countdown,
    risks: risks.slice(0, 3),
    missing,
    warnings,
  };
}

export const PROTEIN_OPTIONS = PROTEINS.map((p) => ({
  key: p.key,
  label: p.label,
}));
