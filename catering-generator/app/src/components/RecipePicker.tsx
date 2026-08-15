"use client";

import { useMemo, useState } from "react";

import { groupByCourse } from "@/lib/recipe-group.ts";
import type { RecipeChoice } from "@/lib/recipe-group.ts";

export type { RecipeChoice };

/**
 * Picks dishes off the recipe book for a job.
 *
 * A flat list of tickboxes is fine at a dozen recipes and useless at eighty —
 * which is where a working book ends up after a season. So this groups by
 * course into sections that open one at a time, and puts a search box above
 * them for when you know the dish name and don't want to hunt.
 *
 * The thing that has to survive collapsing is the answer to "what's on this
 * menu?". Sections that fold away can hide a ticked dish, so what's chosen is
 * listed in full at the top, whatever is open below.
 */
export default function RecipePicker({
  library,
  selected,
  onToggle,
  onClear,
}: {
  library: RecipeChoice[];
  selected: string[];
  onToggle: (id: string) => void;
  onClear: () => void;
}) {
  const [query, setQuery] = useState("");
  // Sections the cook has opened or shut by hand. Untouched sections fall
  // back to "open if something in it is ticked".
  const [opened, setOpened] = useState<Record<string, boolean>>({});

  const searching = query.trim() !== "";

  const chosen = useMemo(
    () => library.filter((r) => selected.includes(r.id)),
    [library, selected],
  );

  const groups = useMemo(
    () => groupByCourse(library, query),
    [library, query],
  );

  const found = groups.reduce((n, g) => n + g.recipes.length, 0);

  return (
    <>
      <p className="basis">
        Tick what&rsquo;s on this menu. Each one scales from what you wrote it
        for, with the crew meals and buffer already in.
      </p>

      {chosen.length > 0 && (
        <div className="chosen">
          <div className="chosen-head">
            <strong>
              On this menu — {chosen.length}{" "}
              {chosen.length === 1 ? "dish" : "dishes"}
            </strong>
            <button type="button" className="linklike" onClick={onClear}>
              Clear all
            </button>
          </div>
          <ul className="chips">
            {chosen.map((recipe) => (
              <li key={recipe.id}>
                <button
                  type="button"
                  className="chip"
                  onClick={() => onToggle(recipe.id)}
                  aria-label={`Take ${recipe.name} off this menu`}
                >
                  {recipe.name} <span aria-hidden="true">×</span>
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}

      <label htmlFor="recipe-search" style={{ marginTop: 14 }}>
        Find a dish
        <span className="hint">
          {library.length} in your recipe book. Type a few letters, or open a
          course below.
        </span>
      </label>
      <input
        id="recipe-search"
        type="search"
        value={query}
        placeholder="brisket, slaw, pav…"
        onChange={(e) => setQuery(e.target.value)}
      />

      {searching && (
        <p className="basis" style={{ marginTop: 8 }}>
          {found === 0
            ? `Nothing in the book matches “${query.trim()}”.`
            : `${found} ${found === 1 ? "dish" : "dishes"} matching “${query.trim()}”.`}
        </p>
      )}

      <div className="courses">
        {groups.map(({ course, recipes }) => {
          const ticked = recipes.filter((r) => selected.includes(r.id)).length;
          // While searching every section is open — a hit you can't see is
          // the same as no hit at all.
          const open = searching
            ? true
            : (opened[course] ?? recipes.some((r) => selected.includes(r.id)));

          return (
            <details
              key={course}
              open={open}
              onToggle={(e) => {
                // Search forces sections open; recording that would leave
                // everything open once the box is cleared.
                if (searching) return;
                const isOpen = e.currentTarget.open;
                setOpened((current) => ({ ...current, [course]: isOpen }));
              }}
            >
              <summary>
                {course}
                <span className="basis">
                  {recipes.length} {recipes.length === 1 ? "dish" : "dishes"}
                  {ticked > 0 && ` · ${ticked} on this menu`}
                </span>
              </summary>
              <div className="checks">
                {recipes.map((recipe) => (
                  <label className="check" key={recipe.id}>
                    <input
                      type="checkbox"
                      checked={selected.includes(recipe.id)}
                      onChange={() => onToggle(recipe.id)}
                    />
                    {recipe.name}
                    <span className="basis"> · for {recipe.serves}</span>
                  </label>
                ))}
              </div>
            </details>
          );
        })}
      </div>
    </>
  );
}
