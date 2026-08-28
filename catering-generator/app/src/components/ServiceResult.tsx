"use client";

import { DISCLAIMER_TEXT } from "@/lib/options.ts";
import type { ServicePlan } from "@/lib/types.ts";

export default function ServiceResult({ plan }: { plan: ServicePlan }) {
  const prepHours = Math.round((plan.prepTotalMinutes / 60) * 10) / 10;

  return (
    <section>
      {plan.warnings.map((warning) => (
        <p className="notice warn" key={warning}>
          <strong>{warning}</strong>
        </p>
      ))}

      {plan.deliveries.map((cycle) => (
        <div className="card" key={cycle.day}>
          <h2>{cycle.day} delivery</h2>
          <p className="basis">
            Carries {cycle.carries.join(", ")} — {cycle.coverWindow} covers
            across {cycle.windowDays} days. The order is par minus what you
            counted on hand; count before you send it.
          </p>
          <div className="table-scroll">
            <table>
              <thead>
                <tr>
                  <th>Item</th>
                  <th style={{ textAlign: "right" }}>Par</th>
                  <th style={{ textAlign: "right" }}>On hand</th>
                  <th style={{ textAlign: "right" }}>Order</th>
                </tr>
              </thead>
              <tbody>
                {cycle.lines.map((line) => (
                  <tr key={line.item}>
                    <td>
                      {line.item}
                      {line.mixIsAssumed && (
                        <span className="tag">mix assumed</span>
                      )}
                      <div className="basis">{line.basis}</div>
                      {line.flag && (
                        <div className="basis">
                          <strong>{line.flag}</strong>
                        </div>
                      )}
                    </td>
                    <td className="num">{line.parKg} kg</td>
                    <td className="num">{line.onHandKg} kg</td>
                    <td className="num">{line.orderKg} kg</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ))}

      <div className="card">
        <h2>Daily prep to hold par</h2>
        <p className="basis">
          Longest shelf life first, so the short-life items hit service
          freshest. About {prepHours} hours a week, one person
          {plan.prepHoursAvailable !== undefined &&
            `, against ${plan.prepHoursAvailable} rostered`}
          . Count what&rsquo;s left each morning and prep the gap — don&rsquo;t
          prep the whole number.
        </p>
        <div className="table-scroll">
          <table>
            <thead>
              <tr>
                <th>Component</th>
                <th style={{ textAlign: "right" }}>Est. weekly prep</th>
              </tr>
            </thead>
            <tbody>
              {plan.prep.map((task) => (
                <tr key={task.task}>
                  <td>{task.task}</td>
                  <td className="num">{task.minutes} min</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="card">
        <h2>Storage</h2>
        <p className="basis">
          The biggest single delivery is about {plan.storageKg} kg
          {plan.fridgeCapacityKg !== undefined
            ? `, against ${plan.fridgeCapacityKg} kg of usable cold storage.`
            : ". Check it fits before you send the order — usable capacity is about 70% of nominal."}
        </p>
      </div>

      <div className="card">
        <h2>Three risks on this operation</h2>
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
