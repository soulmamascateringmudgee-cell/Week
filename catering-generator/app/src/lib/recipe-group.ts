/**
 * Grouping and searching for the recipe picker.
 *
 * Kept out of the component so it can be tested: the failure that matters here
 * is a dish silently not appearing — filed under a course the picker doesn't
 * render, or dropped by a search that's fussier than the cook expects. Neither
 * shows up as an error, they just quietly leave food off the order.
 */

import { COURSE_CHOICES, OTHER_COURSE } from "./options.ts";

export interface RecipeChoice {
  id: string;
  name: string;
  course: string | null;
  serves: number;
}

export interface CourseGroup {
  course: string;
  recipes: RecipeChoice[];
}

/**
 * Free text typed into the search box, made comparable: case folded, accents
 * stripped, runs of whitespace collapsed. "Entree" should find "Entrée" and
 * "creme" should find "crème" — a cook typing quickly on a phone doesn't
 * reach for the accent key.
 */
export function normalise(text: string): string {
  return text
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Split the recipe book into course sections, in menu order.
 *
 * Every recipe lands somewhere. `course` is free text in the database, so a
 * value that isn't one of the known courses — or no value at all — groups
 * under "Other" rather than vanishing. Empty sections are dropped.
 */
export function groupByCourse(
  library: RecipeChoice[],
  query = "",
): CourseGroup[] {
  const needle = normalise(query);
  const matches = needle
    ? library.filter((recipe) => normalise(recipe.name).includes(needle))
    : library;

  const known = new Set<string>(COURSE_CHOICES);
  const byCourse = new Map<string, RecipeChoice[]>();

  for (const recipe of matches) {
    const course =
      recipe.course && known.has(recipe.course.trim())
        ? recipe.course.trim()
        : OTHER_COURSE;
    const bucket = byCourse.get(course);
    if (bucket) bucket.push(recipe);
    else byCourse.set(course, [recipe]);
  }

  return COURSE_CHOICES.map((course) => ({
    course: course as string,
    recipes: byCourse.get(course) ?? [],
  })).filter((group) => group.recipes.length > 0);
}
