"use client";

import { Fragment } from "react";

import PrintButton from "@/components/PrintButton.tsx";
import Section from "@/components/Section.tsx";
import { stockedCount } from "@/lib/pantry.ts";
import { formatAmount } from "@/lib/round.ts";
import { DISCLAIMER_TEXT } from "@/lib/options.ts";
import { groupBySection, hasSections } from "@/lib/recipe-sections.ts";
import type { Category, EventPlan, OrderLine } from "@/lib/types.ts";

const CATEGORY_ORDER: Category[] = [
  "Meat/Seafood",
  "Produce",
  "Dairy",
  "Dry goods",
  "Drinks",
  "Packaging",
];

function group(orders: OrderLine[]): [Category, OrderLine[]][] {
  return CATEGORY_ORDER.map(
    (category) =>
      [category, orders.filter((o) => o.category === category)] as [
        Category,
        OrderLine[],
      ],
  ).filter(([, lines]) => lines.length > 0);
}

const count = (n: number, one: string, many = `${one}s`) =>
  `${n} ${n === 1 ? one : many}`;

/**
 * A finished job, as foldable sections.
 *
 * The order sheet is the reason the page exists, so it's the one thing open
 * when the results land. Everything else — costing, packaging, countdown,
 * risks — folds, with its size on the heading so a shut section still says
 * how much is in it.
 *
 * The two things that never fold are the warnings and the summary strip. A
 * warning you have to open a drawer to find is a warning that gets missed, and
 * the strip is the whole job in one line: headcount, cost, where it sits
 * against the budget.
 */
export default function EventResult({ plan }: { plan: EventPlan }) {
  const grouped = group(plan.orders);
  const costing = plan.costing;
  const stocked = stockedCount(plan.orders);

  return (
    <section>
      {plan.warnings.map((warning) => (
        <p className="notice warn" key={warning}>
          <strong>{warning}</strong>
        </p>
      ))}

      {/* The whole job in one line, above everything that folds. */}
      <div className="summary-strip">
        <div>
          <span className="figure">{plan.effectiveGuests}</span>
          <span className="basis">
            to feed — {plan.guests} guests + {plan.crewMeals} crew
          </span>
        </div>
        <div>
          <span className="figure">{count(plan.orders.length, "line")}</span>
          <span className="basis">to order</span>
        </div>
        {costing && (
          <div>
            <span className="figure">${costing.perHead.toFixed(2)}</span>
            <span className="basis">
              a head
              {costing.verdict === "over" && " · over budget"}
              {costing.verdict === "under" && " · inside budget"}
              {costing.verdict === "incomplete" && " · partial"}
            </span>
          </div>
        )}
      </div>

      <div className="actions">
        <PrintButton />
      </div>

      <Section
        title="The order"
        count={
          stocked > 0
            ? `${count(plan.orders.length, "line")} · ${stocked} in the pantry`
            : count(plan.orders.length, "line")
        }
        open
      >
        <p className="basis">
          {plan.guests} guests + {plan.crewMeals} crew ={" "}
          {plan.effectiveGuests}, buffer {Math.round(plan.bufferPct * 100)}%.{" "}
          {plan.servedProteinPerPerson} g served protein per person across{" "}
          {plan.servedPerProtein} g each.
        </p>

        {/*
          Each supplier folds on its own. You shop this list one supplier at
          a time — standing at the greengrocer, the four other categories are
          just scrolling between you and the produce. They open by default,
          because the order sheet is the thing you came for and nothing on it
          should start hidden; folding is something you do as you go.
        */}
        {stocked > 0 && (
          <p className="notice good">
            <strong>
              ✻ marks {stocked} line{stocked === 1 ? "" : "s"} you already have
              some of.
            </strong>{" "}
            The order still shows what the job needs; underneath it says what
            your count says and what&rsquo;s left to buy. Nothing has been taken
            off — check the shelf before you shop.
          </p>
        )}

        {grouped.map(([category, lines]) => (
          <Section
            key={category}
            variant="plain"
            title={category}
            count={count(lines.length, "line")}
            open
          >
            <div className="table-scroll">
              <table>
                <thead>
                  <tr>
                    <th>Item</th>
                    <th>For</th>
                    <th style={{ textAlign: "right" }}>Qty</th>
                  </tr>
                </thead>
                <tbody>
                  {lines.map((line) => (
                    <tr key={`${line.item}-${line.forDish}`}>
                      <td>
                        {/* The mark you can see at a glance down the column,
                            without reading a word of it. */}
                        {line.inStock && (
                          <span
                            className="have"
                            aria-label="some already in the pantry"
                          >
                            ✻
                          </span>
                        )}
                        {line.item}
                        {line.assumption && <span className="tag">assumed</span>}
                        {/* Not "assumed" — an assumption is a figure we stand
                            behind. This one is wrong until the recipe is
                            fixed, and has to read that way. */}
                        {line.unscalable && (
                          <span className="tag warn">amount in the name</span>
                        )}
                        <div className="basis">{line.basis}</div>
                      </td>
                      <td>{line.forDish}</td>
                      <td className="num">
                        {line.unscalable ? (
                          <span className="broken-qty" title="The recipe's amount is in the ingredient name">
                            {formatAmount(line.qty, line.unit)} {line.unit}
                          </span>
                        ) : (
                          <>
                            {formatAmount(line.qty, line.unit)} {line.unit}
                          </>
                        )}
                        {/* The order stays at what the job needs. What the
                            pantry says goes underneath it, never instead. */}
                        {line.inStock && (
                          <div
                            className={
                              line.inStock.covered ? "stocked all" : "stocked"
                            }
                          >
                            {line.inStock.covered ? (
                              <>
                                have {line.inStock.have} {line.inStock.haveUnit}{" "}
                                — <strong>buy none</strong>
                              </>
                            ) : line.inStock.buy === null ? (
                              <>
                                have {line.inStock.have} {line.inStock.haveUnit}{" "}
                                — check before you shop
                              </>
                            ) : (
                              <>
                                have {line.inStock.have} {line.inStock.haveUnit}{" "}
                                —{" "}
                                <strong>
                                  buy {line.inStock.buy} {line.unit}
                                </strong>
                              </>
                            )}
                          </div>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Section>
        ))}
      </Section>

      {costing && (
        <Section
          title="Food cost"
          count={
            costing.verdict === "incomplete"
              ? `$${costing.total.toFixed(2)} — partial`
              : `$${costing.total.toFixed(2)}`
          }
          tone={
            costing.verdict === "over" || costing.verdict === "incomplete"
              ? "warn"
              : undefined
          }
        >
          <p className="basis">
            ${costing.total.toFixed(2)} across the lines that have a price —{" "}
            <strong>${costing.perHead.toFixed(2)} a head</strong>
            {costing.budget !== undefined && (
              <>
                {" "}
                against a ${costing.budget.toFixed(2)} budget ($
                {costing.budgetPerHead?.toFixed(2)} a head)
              </>
            )}
            .
          </p>

          {costing.verdict === "over" && (
            <p className="notice warn">
              <strong>
                Over budget by $
                {(costing.total - (costing.budget ?? 0)).toFixed(2)}.
              </strong>{" "}
              The biggest lines are listed below — that&rsquo;s where the money
              is, not in the garnish.
            </p>
          )}

          {costing.verdict === "under" && (
            <p className="basis">
              Inside the budget by $
              {((costing.budget ?? 0) - costing.total).toFixed(2)}. Every
              ingredient on this order has a price, so that&rsquo;s the whole
              food cost — not counting packaging, gas, or your time.
            </p>
          )}

          {costing.verdict === "incomplete" && (
            <p className="notice warn">
              <strong>This is a partial total.</strong>{" "}
              {costing.unpriced.length > 0 && (
                <>
                  {costing.unpriced.length} ingredient
                  {costing.unpriced.length === 1 ? " has" : "s have"} no price on
                  file.{" "}
                </>
              )}
              Don&rsquo;t quote off it until they&rsquo;re priced — a number that
              leaves things out is worse than no number.
            </p>
          )}

          {costing.savedByShopping > 0 && (
            <p className="notice good">
              <strong>
                ${costing.savedByShopping.toFixed(2)} of that is shopping
                around.
              </strong>{" "}
              Every line below is costed at the cheapest shop that has a price
              for it, and says which one. Buying the lot at the dearest would
              come to ${(costing.total + costing.savedByShopping).toFixed(2)}.
            </p>
          )}

          {costing.priced.length > 0 && (
            <div className="table-scroll">
              <table>
                <thead>
                  <tr>
                    <th>Item</th>
                    <th style={{ textAlign: "right" }}>Cost</th>
                  </tr>
                </thead>
                <tbody>
                  {costing.priced.map((line) => (
                    <tr key={line.item}>
                      <td>
                        {line.item}
                        <div className="basis">{line.basis}</div>
                      </td>
                      <td className="num">
                        ${line.cost.toFixed(2)}
                        {line.dearestCost !== undefined && (
                          <div className="basis">
                            ${line.dearestCost.toFixed(2)} elsewhere
                          </div>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {costing.unpriced.length > 0 && (
            <>
              <h3>No price on file</h3>
              <p className="basis">
                Add these on the Prices page and the total becomes the real one.
              </p>
              <ul className="plain">
                {costing.unpriced.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            </>
          )}

          {costing.mismatched.length > 0 && (
            <>
              <h3>Priced in a unit that doesn&rsquo;t match</h3>
              <ul className="plain">
                {costing.mismatched.map((note) => (
                  <li key={note}>{note}</li>
                ))}
              </ul>
            </>
          )}
        </Section>
      )}

      {plan.dietaryNotes.length > 0 && (
        <Section
          title="Dietary — order and pack separately"
          count={count(plan.dietaryNotes.length, "item")}
          tone="warn"
        >
          <ul className="plain">
            {plan.dietaryNotes.map((note) => (
              <li key={note}>{note}</li>
            ))}
          </ul>
        </Section>
      )}

      <Section
        title="Packaging and disposables"
        count={count(plan.packaging.length, "item")}
      >
        <ul className="plain">
          {plan.packaging.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
      </Section>

      <Section
        title="Countdown"
        count={
          plan.countdown.some((step) => step.overdue)
            ? `${count(plan.countdown.length, "step")} · some passed`
            : count(plan.countdown.length, "step")
        }
        tone={plan.countdown.some((step) => step.overdue) ? "warn" : undefined}
      >
        {plan.countdown.map((step) => (
          <div
            className={step.overdue ? "step overdue" : "step"}
            key={step.label}
          >
            <div className="when">
              {step.label}
              {step.overdue && <span className="tag">passed</span>}
            </div>
            <div className="date">{step.date}</div>
            <ul className="plain">
              {step.items.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          </div>
        ))}
      </Section>

      {/*
        The prep list and the recipe sheets. These are what you work from at
        the bench, as opposed to the order sheet, which is what you shop from.
        Both come off the same scaled numbers as the order lines, so the sheet
        and the shop cannot disagree.
      */}
      {plan.prep.length > 0 && (
        <Section
          title="Prep list"
          count={count(
            plan.prep.reduce((n, day) => n + day.tasks.length, 0),
            "job",
          )}
          tone={plan.prep.some((day) => day.overdue) ? "warn" : undefined}
        >
          <p className="basis">
            Worked backwards from the event date. A dish sits on the day its
            longest step demands, and each line says why.
          </p>
          {plan.prep.map((day) => (
            <div
              className={day.overdue ? "step overdue" : "step"}
              key={`${day.daysOut}-${day.date}`}
            >
              <div className="when">
                {day.label}
                {day.overdue && <span className="tag warn">passed</span>}
              </div>
              <div className="date">{day.date}</div>
              {day.tasks.map((task) => (
                <div className="prep-task" key={`${task.dish}-${task.task}`}>
                  <strong>{task.dish}</strong> — {task.task}
                  <div className="because">{task.because}</div>
                  {task.ingredients.length > 0 && (
                    <div className="amounts">
                      {task.ingredients
                        .map((i) => `${formatAmount(i.qty, i.unit)} ${i.unit} ${i.item}`)
                        .join(" · ")}
                    </div>
                  )}
                </div>
              ))}
            </div>
          ))}
        </Section>
      )}

      {plan.dishSheets.length > 0 && (
        <Section
          title="Recipe sheets"
          count={count(plan.dishSheets.length, "dish")}
        >
          <p className="basis">
            Every dish written out at this job&rsquo;s size, with its method.
          </p>
          {plan.dishSheets.map((dish) => (
            <div className="sheet" key={dish.name}>
              <div className="when">{dish.name}</div>
              <div className="date">{dish.scaleNote}</div>

              {/* Amounts stuck in the ingredient names — the numbers below are
                  multiplications of "1 ea" and are not real. */}
              {dish.unscalable && (
                <p className="broken">
                  <strong>Don&rsquo;t cook from these numbers.</strong> This
                  recipe&rsquo;s amounts are in the ingredient names instead of
                  the amount column, so scaling has multiplied the wrong thing.
                  Fix it on the Recipes page.
                </p>
              )}

              {/* The parts the dish was written in — dry, wet, the sauce that
                  goes over it — kept as headings. A cook reading one flat list
                  has to work the parts out again at the bench. Only shown when
                  there is more than one, so a dish that is a single list isn't
                  given a heading saying so. */}
              <table className="lines">
                <tbody>
                  {groupBySection(dish.ingredients).map((part, p) => (
                    <Fragment key={`${dish.name}-part-${p}`}>
                      {hasSections(dish.ingredients) && (
                        <tr className="part">
                          <th colSpan={2} scope="colgroup">
                            {part.heading}
                          </th>
                        </tr>
                      )}
                      {part.ingredients.map((line, i) => (
                        <tr key={`${dish.name}-${p}-${line.item}-${i}`}>
                          <td>{line.item}</td>
                          <td className="num">
                            {dish.unscalable ? "—" : `${formatAmount(line.qty, line.unit)} ${line.unit}`}
                          </td>
                        </tr>
                      ))}
                    </Fragment>
                  ))}
                </tbody>
              </table>

              {dish.method && <p className="method">{dish.method}</p>}
              {dish.notes && <p className="method">{dish.notes}</p>}
            </div>
          ))}
        </Section>
      )}

      <Section title="Three risks on this job" count={count(plan.risks.length, "risk")}>
        {plan.risks.map((risk) => (
          <div className="risk" key={risk.risk}>
            <div className="what">{risk.risk}</div>
            <div className="fix">{risk.fix}</div>
          </div>
        ))}
      </Section>

      <Section
        title="What this still needs to know"
        count={count(plan.missing.length, "thing")}
      >
        <ul className="plain">
          {plan.missing.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
      </Section>

      <p className="disclaimer">{DISCLAIMER_TEXT}</p>
    </section>
  );
}
