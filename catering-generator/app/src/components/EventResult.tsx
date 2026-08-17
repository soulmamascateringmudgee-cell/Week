"use client";

import Section from "@/components/Section.tsx";
import { DISCLAIMER_TEXT } from "@/lib/options.ts";
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

  return (
    <section>
      {plan.warnings.map((warning) => (
        <p className="notice" key={warning}>
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

      <Section
        title="The order"
        count={count(plan.orders.length, "line")}
        open
      >
        <p className="basis">
          {plan.guests} guests + {plan.crewMeals} crew ={" "}
          {plan.effectiveGuests}, buffer {Math.round(plan.bufferPct * 100)}%.{" "}
          {plan.servedProteinPerPerson} g served protein per person across{" "}
          {plan.servedPerProtein} g each.
        </p>

        {grouped.map(([category, lines]) => (
          <div key={category}>
            <h3>{category}</h3>
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
                        {line.item}
                        {line.assumption && <span className="tag">assumed</span>}
                        <div className="basis">{line.basis}</div>
                      </td>
                      <td>{line.forDish}</td>
                      <td className="num">
                        {line.qty} {line.unit}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
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
            <p className="notice">
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
            <p className="notice">
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
                      <td className="num">${line.cost.toFixed(2)}</td>
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
