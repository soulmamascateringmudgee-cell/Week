"use client";

import { useCallback, useEffect, useState } from "react";

import DictateRecipe from "@/components/DictateRecipe.tsx";
import type { DictatedRecipe } from "@/components/DictateRecipe.tsx";
import Section from "@/components/Section.tsx";
import { COURSE_CHOICES } from "@/lib/options.ts";
import { parseIngredients } from "@/lib/recipe-parse.ts";
import { groupByCourse } from "@/lib/recipe-group.ts";
import { groupBySection, hasSections, sectionChoices } from "@/lib/recipe-sections.ts";
import type { Category, RecipeIngredient } from "@/lib/types.ts";
import { prepareUpload } from "@/lib/upload-file.ts";

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

const BLANK_ROW: RecipeIngredient = {
  item: "",
  qty: 1,
  unit: "kg",
  category: "Produce",
  section: "",
};

/** Matches the reader's own limit. Kept in step with MAX_PAGES in lib/pages.ts. */
const MAX_RECIPE_PAGES = 8;

/** Matches the reader's ceiling on a whole upload. */
const MAX_RECIPE_UPLOAD_BYTES = 24_000_000;

/** A photo waiting to be read, with the name to show the cook. */
interface StagedPhoto {
  name: string;
  mediaType: string;
  data: string;
}

export default function RecipesPage() {
  const [recipes, setRecipes] = useState<StoredRecipe[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  /** What's typed in the search box over the saved dishes. */
  const [browse, setBrowse] = useState("");

  /*
   * The book split into course sections, filtered by that box.
   *
   * This is the same groupByCourse the job page's picker uses, deliberately.
   * A dish has to file under the same course in both places — finding the
   * pavlova under Dessert when you're building a menu and under Other when
   * you're editing it would be the app disagreeing with itself.
   */
  const courses = groupByCourse(recipes, browse);

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
  const [readingPhoto, setReadingPhoto] = useState(false);
  const [addingPhotos, setAddingPhotos] = useState(false);
  const [photos, setPhotos] = useState<StagedPhoto[]>([]);
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

  /**
   * Add chosen photos to the ones waiting.
   *
   * They stage rather than reading immediately because a recipe often runs
   * over a page — a card photographed in halves, a method that continues on
   * the back — and a phone camera takes one shot at a time. Reading them
   * separately would give two half-recipes and lose any ingredient split
   * across the break.
   */
  async function stagePhotos(chosen: File[]) {
    setAddingPhotos(true);
    setNote("");
    try {
      const room = MAX_RECIPE_PAGES - photos.length;
      if (room <= 0) {
        setNote(
          `That's already ${MAX_RECIPE_PAGES} photos, as many as the reader takes at once.`,
        );
        return;
      }
      const added: StagedPhoto[] = [];
      for (const file of chosen.slice(0, room)) {
        // Redrawn as a JPEG rather than sent as-is: an iPhone photo is HEIC,
        // which the reader won't open, and the failure would be baffling
        // because the picture looks perfectly normal in the camera roll.
        const upload = await prepareUpload(file, MAX_RECIPE_UPLOAD_BYTES);
        added.push({
          name: file.name || `Photo ${photos.length + added.length + 1}`,
          mediaType: upload.mediaType,
          data: upload.data,
        });
      }
      setPhotos((waiting) => [...waiting, ...added]);
      if (chosen.length > room) {
        setNote(
          `Added ${room} of those ${chosen.length}. The reader takes ${MAX_RECIPE_PAGES} at a time.`,
        );
      }
    } catch {
      setNote("Couldn't open that photo. Try another.");
    } finally {
      setAddingPhotos(false);
    }
  }

  /**
   * The staged photos of a recipe card, a cookbook page, or someone's
   * handwriting, read as one recipe. The fields it fills are the same editable
   * fields as everything else — nothing is saved until the cook has looked at
   * the numbers.
   */
  async function readPhoto() {
    setReadingPhoto(true);
    setNote("");
    try {
      const response = await fetch("/api/read-recipe-photo", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          pages: photos.map(({ mediaType, data }) => ({ mediaType, data })),
        }),
      });
      const body = await response.json();

      if (!response.ok) {
        setNote(body.error ?? "Couldn't read that photo.");
        return;
      }

      const read = body.recipe as {
        name: string;
        serves: number;
        ingredients: RecipeIngredient[];
        method: string;
        unreadable: string[];
      };

      if (!editingId && read.name) setName(read.name);
      if (read.serves >= 1) setServes(read.serves);
      setRows(read.ingredients);
      if (read.method) setMethod(read.method);

      const checks = [
        `Read ${read.ingredients.length} ingredients from ${photos.length === 1 ? "that photo" : `those ${photos.length} photos`}`,
        read.serves >= 1
          ? `written for ${read.serves}`
          : "it didn't say how many it serves, so set that yourself",
        read.unreadable.length > 0
          ? `couldn't make out: ${read.unreadable.join(", ")}`
          : "",
      ].filter(Boolean);
      setNote(`${checks.join(" · ")}. Check every amount before you save.`);
      // Cleared only on success. A failure leaves them staged, so a dropout
      // doesn't mean finding the cookbook page again.
      setPhotos([]);
    } catch {
      setNote("Couldn't read that photo.");
    } finally {
      setReadingPhoto(false);
    }
  }

  /**
   * A recipe said out loud. The fields it fills are the same editable fields
   * as everything else, and anything the reader was unsure about is named
   * rather than smoothed over — a wrong number a cook trusts is worse than a
   * gap they can see.
   */
  function readDictated(read: DictatedRecipe) {
    if (!editingId && read.name) setName(read.name);
    if (read.serves >= 1) setServes(read.serves);
    setRows(read.ingredients);
    if (read.method) setMethod(read.method);

    const checks = [
      `Read ${read.ingredients.length} ingredient${read.ingredients.length === 1 ? "" : "s"} from that`,
      read.serves >= 1
        ? `written for ${read.serves}`
        : "you didn't say how many it serves, so set that yourself",
      read.unclear.length > 0 ? `check: ${read.unclear.join(" · ")}` : "",
    ].filter(Boolean);
    setNote(`${checks.join(" · ")}. Check every amount before you save.`);
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
    const parts = groupBySection(parsed).filter((p) => p.section !== null);
    setNote(
      `Read ${parsed.length} ingredient${parsed.length === 1 ? "" : "s"}` +
        (parts.length > 0
          ? `, in ${parts.length} part${parts.length === 1 ? "" : "s"} — ${parts
              .map((p) => p.heading)
              .join(", ")}`
          : "") +
        `. Check the quantities and units before you save — everything scales off them.`,
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
                {COURSE_CHOICES.map((c) => (
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

          <DictateRecipe onRead={readDictated} onNote={setNote} />

          <label htmlFor="recipe-photo" style={{ marginTop: 18 }}>
            Photograph a recipe
            <span className="hint">
              A recipe card, a page of a cookbook, your own handwriting. It
              reads the amounts into the fields below for you to check. A
              recipe that runs over the page can go in as several photos and be
              read as one.
            </span>
          </label>
          <input
            id="recipe-photo"
            type="file"
            accept="image/*"
            multiple
            disabled={readingPhoto || addingPhotos}
            onChange={(e) => {
              const chosen = Array.from(e.target.files ?? []);
              // Cleared so choosing the same photo twice still fires.
              e.target.value = "";
              if (chosen.length > 0) void stagePhotos(chosen);
            }}
          />
          {addingPhotos && <p className="notice">Getting that ready…</p>}

          {photos.length > 0 && (
            <>
              <ul className="pages" style={{ marginTop: 12 }}>
                {photos.map((photo, index) => (
                  <li key={`${photo.name}-${index}`}>
                    <span>
                      {photos.length > 1 && <strong>{index + 1}. </strong>}
                      {photo.name}
                    </span>
                    <button
                      type="button"
                      className="linklike"
                      disabled={readingPhoto || addingPhotos}
                      onClick={() =>
                        setPhotos((waiting) =>
                          waiting.filter((_, i) => i !== index),
                        )
                      }
                    >
                      Remove
                    </button>
                  </li>
                ))}
              </ul>
              <div className="actions">
                <button
                  type="button"
                  onClick={() => void readPhoto()}
                  disabled={readingPhoto || addingPhotos}
                >
                  {readingPhoto
                    ? "Reading…"
                    : photos.length === 1
                      ? "Read this photo"
                      : `Read these ${photos.length} photos`}
                </button>
                <button
                  type="button"
                  className="linklike"
                  disabled={readingPhoto || addingPhotos}
                  onClick={() => setPhotos([])}
                >
                  Start again
                </button>
              </div>
            </>
          )}

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
              broccolini&rdquo;. Bullets and numbering are fine. Leave the
              headings in — &ldquo;Dry ingredients:&rdquo;, &ldquo;For the
              marinade&rdquo; — and everything under one is filed to that part
              of the dish.
            </span>
          </label>
          <textarea
            id="recipe-paste"
            value={paste}
            onChange={(e) => setPaste(e.target.value)}
            placeholder={"Dry:\n500 g plain flour\n2 tsp smoked paprika\n\nWet:\n600 ml buttermilk\n3 eggs"}
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
          {note && <p className="notice check">{note}</p>}

          <h3>Ingredients</h3>
          <p className="basis">
            Leave the part blank for a dish that&rsquo;s just one list. Fill it
            in — Dry, Wet, Marinade, For the topping — and the dish prints
            under those headings on the bench sheet, in the order you wrote
            them. It changes no amount; it only changes how the dish reads.
          </p>
          <datalist id="section-choices">
            {sectionChoices(rows).map((choice) => (
              <option key={choice} value={choice} />
            ))}
          </datalist>
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
                <label htmlFor={`ing-section-${index}`}>Part</label>
                <input
                  id={`ing-section-${index}`}
                  type="text"
                  list="section-choices"
                  value={row.section ?? ""}
                  placeholder="Dry, Wet…"
                  onChange={(e) => updateRow(index, { section: e.target.value })}
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
              // The new row inherits the last row's part. Ingredients are
              // entered a block at a time — six dry things, then four wet —
              // and retyping "Dry" six times is how a section ends up spelt
              // two ways and split into two headings.
              onClick={() =>
                setRows([
                  ...rows,
                  { ...BLANK_ROW, section: rows.at(-1)?.section ?? "" },
                ])
              }
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
            <p className="notice warn">
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

      {!loading && recipes.length > 0 && (
        <>
          <label htmlFor="browse">
            Find a dish
            <span className="hint">
              Searches every course at once. Leave it empty to browse.
            </span>
          </label>
          <input
            id="browse"
            type="search"
            value={browse}
            onChange={(e) => setBrowse(e.target.value)}
            placeholder="brisket, slaw, pavlova…"
          />

          {/* A search that matches nothing has to say so. An empty page under
              a search box reads as "you have no recipes", which after typing
              a dish name is the wrong and rather alarming conclusion. */}
          {courses.length === 0 && (
            <p className="notice" style={{ marginTop: 14 }}>
              No dish matches &ldquo;{browse}&rdquo;. Check the spelling, or
              clear the box to see all {recipes.length}.
            </p>
          )}

          <div style={{ marginTop: 14 }}>
            {courses.map((group) => (
              <Section
                key={group.course}
                title={group.course}
                count={`${group.recipes.length} dish${
                  group.recipes.length === 1 ? "" : "es"
                }`}
                // Searching opens everything: a hit inside a shut section is
                // the same as no hit at all.
                open={browse.trim() !== ""}
              >
                {group.recipes.map((recipe) => (
                  <div className="dish" key={recipe.id}>
                    <h3>{recipe.name}</h3>
                    <p className="basis">
                      Written for {recipe.serves} ·{" "}
                      {recipe.ingredients.length} ingredient
                      {recipe.ingredients.length === 1 ? "" : "s"}
                      {hasSections(recipe.ingredients) &&
                        ` · ${groupBySection(recipe.ingredients).length} parts`}
                    </p>
                    {/* Grouped only when there is more than one part. A lone
                        "Ingredients" heading over a list of ingredients is
                        noise on every dish in the book. */}
                    {groupBySection(recipe.ingredients).map((part, p) => (
                      <div key={`${recipe.id}-part-${p}`}>
                        {hasSections(recipe.ingredients) && (
                          <p className="part">{part.heading}</p>
                        )}
                        <ul className="plain">
                          {part.ingredients.map((ing, i) => (
                            <li key={`${recipe.id}-${p}-${i}`}>
                              {ing.qty} {ing.unit} {ing.item}
                            </li>
                          ))}
                        </ul>
                      </div>
                    ))}
                    <div className="actions">
                      <button
                        type="button"
                        className="secondary"
                        onClick={() => edit(recipe)}
                      >
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
              </Section>
            ))}
          </div>
        </>
      )}
    </>
  );
}
