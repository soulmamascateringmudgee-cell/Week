"use client";

import { useCallback, useEffect, useState } from "react";

import { parseIngredients } from "@/lib/recipe-parse.ts";
import type { Category, RecipeIngredient } from "@/lib/types.ts";

interface StoredRecipe {
  id: string;
  name: string;
  course: string | null;
  serves: number;
  ingredients: RecipeIngredient[];
  method: string | null;
  notes: string | null;
}

const CATEGORIES: Category[] = [
  "Meat/Seafood",
  "Produce",
  "Dairy",
  "Dry goods",
  "Drinks",
  "Packaging",
];

const COURSES = ["Main", "Side", "Entrée", "Dessert", "Sauce", "Other"];

const BLANK_ROW: RecipeIngredient = {
  item: "",
  qty: 1,
  unit: "kg",
  category: "Produce",
};

export default function RecipesPage() {
  const [recipes, setRecipes] = useState<StoredRecipe[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  // The form doubles as the editor. `editingId` null means "adding new".
  const [editingId, setEditingId] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [course, setCourse] = useState("Main");
  const [serves, setServes] = useState(10);
  const [rows, setRows] = useState<RecipeIngredient[]>([{ ...BLANK_ROW }]);
  const [method, setMethod] = useState("");
  const [paste, setPaste] = useState("");
  const [link, setLink] = useState("");
  const [importing, setImporting] = useState(false);
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState("");

  const load = useCallback(async () => {
    try {
      const response = await fetch("/api/recipes");
      const body = await response.json();
      if (!response.ok) {
        setError(body.error ?? "Couldn't load your recipes.");
      } else {
        setError("");
        setRecipes(body.recipes as StoredRecipe[]);
      }
    } catch {
      setError("Couldn't reach the server.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  function resetForm() {
    setEditingId(null);
    setName("");
    setCourse("Main");
    setServes(10);
    setRows([{ ...BLANK_ROW }]);
    setMethod("");
    setPaste("");
    setNote("");
  }

  async function importFromLink() {
    setImporting(true);
    setNote("");
    try {
      const response = await fetch("/api/import-recipe", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ url: link }),
      });
      const body = await response.json();

      if (!response.ok) {
        setNote(body.error ?? "Couldn't read that page.");
        return;
      }

      const imported = body.recipe as {
        name: string;
        serves: number;
        servesAssumed: boolean;
        ingredients: RecipeIngredient[];
      };

      if (!editingId) setName(imported.name);
      setServes(imported.serves);
      setRows(imported.ingredients);
      setLink("");
      setNote(
        `Read ${imported.ingredients.length} ingredients from that page` +
          (imported.servesAssumed
            ? ", but it didn't say how many it serves — I've put 4, change it to match the recipe before you save."
            : `, written for ${imported.serves}.`) +
          " Pounds and ounces have been converted; cups are left as cups, because a cup of flour and a cup of oil aren't the same weight. Check it over before saving.",
      );
    } catch {
      setNote("Couldn't reach the server.");
    } finally {
      setImporting(false);
    }
  }

  function readPaste() {
    const parsed = parseIngredients(paste);
    if (parsed.length === 0) {
      setNote("Nothing readable in that. Type the ingredients in below instead.");
      return;
    }
    // Replace rather than append: pasting twice shouldn't double the order.
    setRows(parsed);
    setPaste("");
    setNote(
      `Read ${parsed.length} ingredient${parsed.length === 1 ? "" : "s"}. Check the quantities and units before you save — everything scales off them.`,
    );
  }

  function updateRow(index: number, patch: Partial<RecipeIngredient>) {
    setRows((current) =>
      current.map((row, i) => (i === index ? { ...row, ...patch } : row)),
    );
  }

  async function save(formEvent: React.FormEvent) {
    formEvent.preventDefault();
    setBusy(true);
    setError("");

    const payload = {
      name,
      course,
      serves,
      method,
      ingredients: rows.filter((row) => row.item.trim() !== ""),
    };

    const response = await fetch(
      editingId ? `/api/recipes/${editingId}` : "/api/recipes",
      {
        method: editingId ? "PATCH" : "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(payload),
      },
    );

    const body = await response.json();
    setBusy(false);

    if (!response.ok) {
      setError(body.error ?? "Couldn't save that recipe.");
      return;
    }
    resetForm();
    await load();
  }

  function edit(recipe: StoredRecipe) {
    setEditingId(recipe.id);
    setName(recipe.name);
    setCourse(recipe.course ?? "Main");
    setServes(recipe.serves);
    setRows(recipe.ingredients.length > 0 ? recipe.ingredients : [{ ...BLANK_ROW }]);
    setMethod(recipe.method ?? "");
    setNote("");
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  async function remove(recipe: StoredRecipe) {
    if (!window.confirm(`Delete "${recipe.name}"? This can't be undone.`)) return;
    await fetch(`/api/recipes/${recipe.id}`, { method: "DELETE" });
    if (editingId === recipe.id) resetForm();
    await load();
  }

  return (
    <>
      <h1>Your recipes</h1>
      <p className="lede">
        Write a dish once, in the quantities you actually buy for a set number
        of people. Attach it to a job and it scales to that headcount — with the
        crew meals and the buffer already in. Your numbers beat every table in
        here.
      </p>

      <form onSubmit={save}>
        <div className="card">
          <h2>{editingId ? "Edit dish" : "Add a dish"}</h2>

          <div className="grid">
            <div>
              <label htmlFor="recipe-name">Dish</label>
              <input
                id="recipe-name"
                type="text"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Slow-cooked brisket"
              />
            </div>
            <div>
              <label htmlFor="recipe-course">Course</label>
              <select
                id="recipe-course"
                value={course}
                onChange={(e) => setCourse(e.target.value)}
              >
                {COURSES.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label htmlFor="recipe-serves">
                Written for
                <span className="hint">How many people these amounts feed</span>
              </label>
              <input
                id="recipe-serves"
                type="number"
                onFocus={(e) => e.target.select()}
                min={1}
                required
                value={serves}
                onChange={(e) => setServes(Number(e.target.value))}
              />
            </div>
          </div>

          <label htmlFor="recipe-link" style={{ marginTop: 18 }}>
            Paste a recipe link
            <span className="hint">
              From a recipe site. It reads the ingredients off the page and
              converts pounds and ounces to metric.
            </span>
          </label>
          <input
            id="recipe-link"
            type="url"
            value={link}
            onChange={(e) => setLink(e.target.value)}
            placeholder="https://…"
          />
          <div className="actions">
            <button
              type="button"
              className="secondary"
              onClick={() => void importFromLink()}
              disabled={importing || link.trim() === ""}
            >
              {importing ? "Reading the page…" : "Read the link"}
            </button>
          </div>

          <label htmlFor="recipe-paste" style={{ marginTop: 18 }}>
            Or paste the ingredients
            <span className="hint">
              One per line, straight off your recipe card — &ldquo;5 kg beef
              brisket&rdquo;, &ldquo;500g butter&rdquo;, &ldquo;2 bunches
              broccolini&rdquo;. Bullets and numbering are fine.
            </span>
          </label>
          <textarea
            id="recipe-paste"
            value={paste}
            onChange={(e) => setPaste(e.target.value)}
            placeholder={"5 kg beef brisket\n2 tbsp smoked paprika\n3 x 400g tinned tomatoes\n2 bunches broccolini"}
          />
          <div className="actions">
            <button
              type="button"
              className="secondary"
              onClick={readPaste}
              disabled={paste.trim() === ""}
            >
              Read the ingredients
            </button>
          </div>
          {note && <p className="notice">{note}</p>}

          <h3>Ingredients</h3>
          {rows.map((row, index) => (
            <div className="row-item" key={index}>
              <div>
                <label htmlFor={`ing-item-${index}`}>Ingredient</label>
                <input
                  id={`ing-item-${index}`}
                  type="text"
                  value={row.item}
                  onChange={(e) => updateRow(index, { item: e.target.value })}
                />
              </div>
              <div>
                <label htmlFor={`ing-qty-${index}`}>Amount</label>
                <input
                  id={`ing-qty-${index}`}
                  type="number"
                  onFocus={(e) => e.target.select()}
                  min={0}
                  step="any"
                  value={row.qty}
                  onChange={(e) => updateRow(index, { qty: Number(e.target.value) })}
                />
              </div>
              <div>
                <label htmlFor={`ing-unit-${index}`}>Unit</label>
                <input
                  id={`ing-unit-${index}`}
                  type="text"
                  value={row.unit}
                  onChange={(e) => updateRow(index, { unit: e.target.value })}
                />
              </div>
              <div>
                <label htmlFor={`ing-cat-${index}`}>Supplier</label>
                <select
                  id={`ing-cat-${index}`}
                  value={row.category}
                  onChange={(e) =>
                    updateRow(index, { category: e.target.value as Category })
                  }
                >
                  {CATEGORIES.map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <button
                  type="button"
                  className="secondary"
                  onClick={() => setRows(rows.filter((_, i) => i !== index))}
                  aria-label={`Remove ${row.item || "this ingredient"}`}
                >
                  Remove
                </button>
              </div>
            </div>
          ))}

          <div className="actions">
            <button
              type="button"
              className="secondary"
              onClick={() => setRows([...rows, { ...BLANK_ROW }])}
            >
              Add an ingredient
            </button>
          </div>

          <label htmlFor="recipe-method" style={{ marginTop: 18 }}>
            Method
            <span className="hint">
              Optional. Doesn&rsquo;t affect the maths — it&rsquo;s here so the
              recipe travels with the numbers.
            </span>
          </label>
          <textarea
            id="recipe-method"
            value={method}
            onChange={(e) => setMethod(e.target.value)}
          />

          {error && (
            <p className="notice">
              <strong>{error}</strong>
            </p>
          )}

          <div className="actions">
            <button type="submit" disabled={busy || name.trim() === ""}>
              {busy ? "Saving…" : editingId ? "Save changes" : "Save dish"}
            </button>
            {editingId && (
              <button type="button" className="secondary" onClick={resetForm}>
                Cancel
              </button>
            )}
          </div>
        </div>
      </form>

      <h2>Saved dishes</h2>
      {loading && <div className="card">Loading…</div>}
      {!loading && recipes.length === 0 && (
        <div className="card">
          <p>
            Nothing yet. Add your most-used dish first — the one you cook at
            half your jobs. That&rsquo;s where the guessing costs you most.
          </p>
        </div>
      )}

      {recipes.map((recipe) => (
        <div className="card" key={recipe.id}>
          <h3 style={{ marginTop: 0, marginBottom: 4 }}>{recipe.name}</h3>
          <p className="basis">
            {recipe.course ?? "Dish"} · written for {recipe.serves} ·{" "}
            {recipe.ingredients.length} ingredient
            {recipe.ingredients.length === 1 ? "" : "s"}
          </p>
          <ul className="plain">
            {recipe.ingredients.map((ing, i) => (
              <li key={`${recipe.id}-${i}`}>
                {ing.qty} {ing.unit} {ing.item}
              </li>
            ))}
          </ul>
          <div className="actions">
            <button type="button" className="secondary" onClick={() => edit(recipe)}>
              Edit
            </button>
            <button
              type="button"
              className="secondary"
              onClick={() => void remove(recipe)}
            >
              Delete
            </button>
          </div>
        </div>
      ))}
    </>
  );
}
