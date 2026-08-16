"use client";

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

export default function EventResult({ plan }: { plan: EventPlan }) {
  return (
    <section>
      {plan.warnings.map((warning) => (
        <p className="notice" key={warning}>
          <strong>{warning}</strong>
        </p>
      ))}

      {plan.costing && (
        <div className="card">
          <h2>Food cost</h2>

          <p className="basis">
            ${plan.costing.total.toFixed(2)} across the lines that have a price
            — <strong>${plan.costing.perHead.toFixed(2)} a head</strong>
            {plan.costing.budget !== undefined && (
              <>
                {" "}
                against a ${plan.costing.budget.toFixed(2)} budget ($
                {plan.costing.budgetPerHead?.toFixed(2)} a head)
              </>
            )}
            .
          </p>

          {plan.costing.verdict === "over" && (
            <p className="notice">
              <strong>
                Over budget by $
                {(plan.costing.total - (plan.costing.budget ?? 0)).toFixed(2)}.
              </strong>{" "}
              The biggest lines are listed below — that&rsquo;s where the money
              is, not in the garnish.
            </p>
          )}

          {plan.costing.verdict === "under" && (
            <p className="basis">
              Inside the budget by $
              {((plan.costing.budget ?? 0) - plan.costing.total).toFixed(2)}.
              Every ingredient on this order has a price, so that&rsquo;s the
              whole food cost — not counting packaging, gas, or your time.
            </p>
          )}

          {plan.costing.verdict === "incomplete" && (
            <p className="notice">
              <strong>This is a partial total.</strong>{" "}
              {plan.costing.unpriced.length > 0 && (
                <>
                  {plan.costing.unpriced.length} ingredient
                  {plan.costing.unpriced.length === 1 ? " has" : "s have"} no
                  price on file.{" "}
                </>
              )}
              Don&rsquo;t quote off it until they&rsquo;re priced — a number
              that leaves things out is worse than no number.
            </p>
          )}

          {plan.costing.priced.length > 0 && (
            <div className="table-scroll">
              <table>
                <thead>
                  <tr>
                    <th>Item</th>
                    <th style={{ textAlign: "right" }}>Cost</th>
                  </tr>
                </thead>
                <tbody>
                  {plan.costing.priced.map((line) => (
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

          {plan.costing.unpriced.length > 0 && (
            <>
              <h3>No price on file</h3>
              <p className="basis">
                Add these on the Prices page and the total becomes the real one.
              </p>
              <ul className="plain">
                {plan.costing.unpriced.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            </>
          )}

          {plan.costing.mismatched.length > 0 && (
            <>
              <h3>Priced in a unit that doesn&rsquo;t match</h3>
              <ul className="plain">
                {plan.costing.mismatched.map((note) => (
                  <li key={note}>{note}</li>
                ))}
              </ul>
            </>
          )}
        </div>
      )}

      <div className="card">
        <h2>The order</h2>
        <p className="basis">
          {plan.guests} guests + {plan.crewMeals} crew ={" "}
          {plan.effectiveGuests}, buffer {Math.round(plan.bufferPct * 100)}%.{" "}
          {plan.servedProteinPerPerson} g served protein per person across{" "}
          {plan.servedPerProtein} g each.
        </p>

        {group(plan.orders).map(([category, lines]) => (
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
      </div>

      {plan.dietaryNotes.length > 0 && (
        <div className="card">
          <h2>Dietary items — order and pack separately</h2>
          <ul className="plain">
            {plan.dietaryNotes.map((note) => (
              <li key={note}>{note}</li>
            ))}
          </ul>
        </div>
      )}

      <div className="card">
        <h2>Packaging and disposables</h2>
        <ul className="plain">
          {plan.packaging.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
      </div>

      <div className="card">
        <h2>Countdown</h2>
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
      </div>

      <div className="card">
        <h2>Three risks on this job</h2>
        {plan.risks.map((risk) => (
          <div className="risk" key={risk.risk}>
            <div className="what">{risk.risk}</div>
            <div className="fix">{risk.fix}</div>
          </div>
        ))}
      </div>

      <div className="card">
        <h2>What this still needs to know</h2>
        <ul className="plain">
          {plan.missing.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
      </div>

      <p className="disclaimer">{DISCLAIMER_TEXT}</p>
    </section>
  );
}
