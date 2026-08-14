import {
  ATTACH_RATE,
  PREP_MINUTES_PER_KG,
  SAFETY_PCT,
  SHELF_LIFE_DAYS,
  THROUGHPUT_ITEMS_PER_HOUR,
  VENUE_LABEL,
  protein,
} from "./tables.ts";
import { round1, roundKg } from "./round.ts";
import { WEEKDAYS } from "./types.ts";
import type {
  DeliveryCycle,
  ParLine,
  PrepTask,
  Risk,
  ServiceInput,
  ServicePlan,
  Weekday,
} from "./types.ts";

function validate(input: ServiceInput): void {
  if (input.deliveryDays.length === 0) {
    throw new Error("Pick at least one delivery day — the order cycle hangs off it.");
  }
  const unique = new Set(input.deliveryDays);
  if (unique.size !== input.deliveryDays.length) {
    throw new Error("Each delivery day can only be listed once.");
  }
  for (const day of input.deliveryDays) {
    if (!WEEKDAYS.includes(day)) throw new Error(`Unknown delivery day: "${day}"`);
  }
  if (input.items.length === 0) {
    throw new Error("Add at least one menu item.");
  }
  const weeklyCovers = WEEKDAYS.reduce(
    (sum, day) => sum + (input.covers[day] ?? 0),
    0,
  );
  if (weeklyCovers <= 0) {
    throw new Error("Weekly covers are zero — enter your forecast before building par levels.");
  }
  for (const item of input.items) {
    if (!Number.isFinite(item.portionG) || item.portionG <= 0) {
      throw new Error(`"${item.name}" needs a served portion in grams.`);
    }
    if (item.proteinKey && !protein(item.proteinKey)) {
      throw new Error(`Unknown protein on "${item.name}": ${item.proteinKey}`);
    }
    if (item.mixPct !== undefined && (item.mixPct < 0 || item.mixPct > 5)) {
      throw new Error(`"${item.name}" has an impossible sales mix.`);
    }
  }
}

/**
 * The days a given delivery has to carry: from the day it lands, forward to
 * (but not including) the next delivery, wrapping around the week.
 */
function daysCarried(deliveryDay: Weekday, deliveryDays: Weekday[]): Weekday[] {
  const ordered = [...deliveryDays].sort(
    (a, b) => WEEKDAYS.indexOf(a) - WEEKDAYS.indexOf(b),
  );
  if (ordered.length === 1) {
    const start = WEEKDAYS.indexOf(deliveryDay);
    return Array.from({ length: 7 }, (_, i) => WEEKDAYS[(start + i) % 7]);
  }
  const start = WEEKDAYS.indexOf(deliveryDay);
  const carried: Weekday[] = [];
  for (let i = 0; i < 7; i += 1) {
    const day = WEEKDAYS[(start + i) % 7];
    if (i > 0 && ordered.includes(day)) break;
    carried.push(day);
  }
  return carried;
}

/**
 * Sales mix per item. A user-supplied figure wins; otherwise the venue's
 * attach rate for that category, split evenly across the items in it — which
 * is wrong in a predictable way, so it comes back marked as an assumption.
 */
function mixFor(
  input: ServiceInput,
  item: ServiceInput["items"][number],
): { mix: number; assumed: boolean } {
  if (item.mixPct !== undefined) return { mix: item.mixPct, assumed: false };
  const attach = ATTACH_RATE[input.venueType][item.category];
  const siblings = input.items.filter((i) => i.category === item.category).length;
  return { mix: siblings > 0 ? attach / siblings : attach, assumed: true };
}

export function planService(input: ServiceInput): ServicePlan {
  validate(input);

  const weeklyCovers = WEEKDAYS.reduce(
    (sum, day) => sum + (input.covers[day] ?? 0),
    0,
  );
  const warnings: string[] = [];
  const deliveries: DeliveryCycle[] = [];

  const ordered = [...input.deliveryDays].sort(
    (a, b) => WEEKDAYS.indexOf(a) - WEEKDAYS.indexOf(b),
  );

  // On-hand is a stock count taken once, so it offsets the first delivery of
  // the week only. Later cycles in the same week order to the full par.
  let firstCycle = true;

  for (const day of ordered) {
    const carries = daysCarried(day, ordered);
    const rawWindow = carries.reduce(
      (sum, d) => sum + (input.covers[d] ?? 0),
      0,
    );
    const windowDays = carries.length;

    // If the order has to go in more than a day ahead, it can't be corrected
    // once placed — carry half a day of covers as a cushion.
    const cushion =
      input.leadTimeHours > 24 ? (rawWindow / windowDays) * 0.5 : 0;
    const coverWindow = rawWindow + cushion;

    const lines: ParLine[] = [];

    for (const item of input.items) {
      const { mix, assumed } = mixFor(input, item);
      const yieldMultiplier = item.proteinKey
        ? protein(item.proteinKey)!.yieldMultiplier
        : 1;
      const safetyPct = SAFETY_PCT[item.shelfLife];

      const parKg = roundKg(
        (coverWindow * mix * item.portionG * yieldMultiplier * (1 + safetyPct)) /
          1000,
      );
      const onHandKg = firstCycle ? (item.onHandKg ?? 0) : 0;
      const orderKg = roundKg(Math.max(0, parKg - onHandKg));

      const shelfLifeDays = SHELF_LIFE_DAYS[item.shelfLife];
      let flag: string | undefined;
      if (item.shelfLife === "long") {
        flag =
          "Long shelf life — hold a minimum-stock line in supplier pack sizes rather than a weekly par.";
      } else if (shelfLifeDays < windowDays) {
        flag = `Shelf life is ${shelfLifeDays} days but this delivery has to cover ${windowDays}. Split the delivery, change the item, or accept the waste.`;
      }

      lines.push({
        item: item.name,
        category: item.category,
        coverWindow: Math.round(coverWindow),
        windowDays,
        mixPct: round1(mix * 100) / 100,
        mixIsAssumed: assumed,
        portionG: item.portionG,
        yieldMultiplier,
        safetyPct,
        parKg,
        onHandKg,
        orderKg,
        shelfLife: item.shelfLife,
        shelfLifeDays,
        flag,
        basis:
          `${Math.round(coverWindow)} covers × ${Math.round(mix * 100)}% mix × ${item.portionG} g` +
          (yieldMultiplier !== 1 ? ` × ${yieldMultiplier.toFixed(2)} yield` : "") +
          ` × ${(1 + safetyPct).toFixed(2)} safety` +
          (onHandKg > 0 ? ` − ${onHandKg} kg on hand` : ""),
      });
    }

    deliveries.push({ day, carries, coverWindow: Math.round(coverWindow), windowDays, lines });
    firstCycle = false;
  }

  // ------------------------------------------------------------ prep list

  const prepByItem = new Map<string, number>();
  for (const cycle of deliveries) {
    for (const line of cycle.lines) {
      const minutes = line.parKg * PREP_MINUTES_PER_KG[line.category];
      prepByItem.set(line.item, (prepByItem.get(line.item) ?? 0) + minutes);
    }
  }

  // Longest shelf life first — shortest hits service freshest.
  const shelfOrder: Record<string, number> = { long: 0, medium: 1, short: 2 };
  const prep: PrepTask[] = [...prepByItem.entries()]
    .map(([task, minutes]) => ({ task, minutes: Math.round(minutes) }))
    .sort((a, b) => {
      const itemA = input.items.find((i) => i.name === a.task);
      const itemB = input.items.find((i) => i.name === b.task);
      return (
        (shelfOrder[itemA?.shelfLife ?? "medium"] ?? 1) -
        (shelfOrder[itemB?.shelfLife ?? "medium"] ?? 1)
      );
    });

  const prepTotalMinutes = prep.reduce((sum, p) => sum + p.minutes, 0);

  // ------------------------------------------------------------- storage

  const storageKg = Math.max(
    ...deliveries.map((cycle) =>
      cycle.lines.reduce((sum, line) => sum + line.orderKg, 0),
    ),
  );

  // --------------------------------------------------------------- risks

  const risks: Risk[] = [];
  const assumedMix = deliveries[0].lines.some((l) => l.mixIsAssumed);

  if (assumedMix) {
    risks.push({
      risk: "Sales mix is a guess. One or two items on any menu carry 30–40% of their category, so an even split under-orders those and over-orders the tail.",
      fix: "Pull one week of item-level sales from your POS and rebuild the par table off real numbers. Nothing else in this plan moves the answer as much.",
    });
  }

  const shortLived = deliveries
    .flatMap((c) => c.lines)
    .filter((l) => l.flag && l.shelfLife !== "long");
  if (shortLived.length > 0) {
    const names = [...new Set(shortLived.map((l) => l.item))].join(", ");
    risks.push({
      risk: `${names} won't survive to the next delivery on this cycle.`,
      fix: "Add a mid-cycle drop for those items, move them to a longer-life alternative, or price the waste in deliberately rather than discovering it.",
    });
  }

  if (input.prepHoursAvailable !== undefined) {
    const availableMinutes = input.prepHoursAvailable * 60;
    if (prepTotalMinutes > availableMinutes) {
      risks.push({
        risk: `Prep needs about ${Math.round(prepTotalMinutes / 60)} hours a week against ${input.prepHoursAvailable} rostered.`,
        fix: "Roster more hours, move a component to a bought-in product, or cut a menu item. A par plan that needs hours you haven't got is not a plan.",
      });
    }
  }

  if (input.fridgeCapacityKg !== undefined && storageKg > input.fridgeCapacityKg) {
    risks.push({
      risk: `Biggest single delivery is about ${Math.round(storageKg)} kg against ${input.fridgeCapacityKg} kg of usable cold storage.`,
      fix: "Split that delivery across two drops, or free capacity before it lands. Storage, not money, is the usual hard limit.",
    });
  }

  if (ordered.length === 1) {
    risks.push({
      risk: "One delivery a week means a single order carries every trading day, so the whole week rides on one supplier and one forecast.",
      fix: "Add a second drop before the weekend if the supplier will do it — weekend covers usually run 1.6–2.2× a weekday.",
    });
  }

  if (input.venueType === "kiosk" && input.serviceWindowHours) {
    const busiestCovers = Math.max(
      ...WEEKDAYS.map((d) => input.covers[d] ?? 0),
    );
    const itemsPerCustomer = ATTACH_RATE.kiosk.main;
    const demand = busiestCovers * itemsPerCustomer;
    const capacity = THROUGHPUT_ITEMS_PER_HOUR * input.serviceWindowHours;
    if (demand > capacity) {
      risks.push({
        risk: `Busiest day needs about ${Math.round(demand)} items in a ${input.serviceWindowHours} hr window; one service point does roughly ${capacity}.`,
        fix: "Add a second service point or extend the window. On the busiest day the constraint is the window, not the stock.",
      });
    }
  }

  if (risks.length === 0) {
    risks.push({
      risk: "Ordering the par instead of par minus on hand.",
      fix: "Put the stock count on the order sheet as its own line so it can't be skipped.",
    });
  }

  // ------------------------------------------------------------- missing

  const missing: string[] = [];
  if (assumedMix) {
    missing.push(
      "Item-level sales mix from your POS for one week — every line marked 'assumed' is running on a default until you have it.",
    );
  }
  if (input.items.some((i) => i.onHandKg === undefined)) {
    missing.push(
      "Current on-hand for each par item. The order is always par minus on hand; without a count you'll over-order.",
    );
  }
  if (input.fridgeCapacityKg === undefined) {
    missing.push("Usable cold storage in kg — roughly 70% of nominal fridge volume.");
  }
  if (input.prepHoursAvailable === undefined) {
    missing.push("Prep hours actually rostered across the week.");
  }
  missing.push(
    "Last week's actual covers against forecast, and waste by item. Two weeks of that and these figures stop being estimates.",
  );

  if (weeklyCovers < 20) {
    warnings.push(
      `Weekly covers of ${weeklyCovers} are low enough that rounding dominates the maths — treat these as indicative.`,
    );
  }

  return {
    venueType: input.venueType,
    weeklyCovers,
    deliveries,
    prep,
    prepTotalMinutes,
    prepHoursAvailable: input.prepHoursAvailable,
    storageKg: Math.round(storageKg * 10) / 10,
    fridgeCapacityKg: input.fridgeCapacityKg,
    risks: risks.slice(0, 3),
    missing,
    warnings,
  };
}

export const VENUE_OPTIONS = (
  Object.keys(VENUE_LABEL) as (keyof typeof VENUE_LABEL)[]
).map((key) => ({ key, label: VENUE_LABEL[key] }));
