/*
 * Splitting one entry's stored HTML into notebook pages.
 *
 * There is no `pages` column: an entry's pages live inside the same `content`
 * HTML, separated by a sentinel <hr>. That is deliberate - these rows are still
 * shared with the To-Do page, and read by the MCP agent's HTML flattener, and
 * both keep working with a marker that is simply valid HTML. Storing a JSON
 * array in `content` instead would have shown up as raw JSON in To-Do and as
 * garbage to the agent.
 */

// Written on save, matched loosely on read so a hand-edited entry still splits.
export const PAGE_BREAK = '<hr data-page-break="true">';

const PAGE_BREAK_PATTERN = /<hr[^>]*data-page-break[^>]*>/gi;

/*
 * The pages of an entry, always at least one.
 *
 * A blank entry is a single empty page rather than no pages, so the editor
 * never has to render "nothing to write on".
 */
export function splitPages(html: string): string[] {
  const pages = (html ?? "").split(PAGE_BREAK_PATTERN);
  return pages.length > 0 ? pages : [""];
}

// Back into one HTML string for storage.
export function joinPages(pages: string[]): string {
  return pages.join(PAGE_BREAK);
}

/*
 * The same list with one page replaced.
 *
 * Used on every keystroke, so it copies rather than mutating the array held in
 * React state.
 */
export function replacePage(pages: string[], index: number, html: string): string[] {
  const next = [...pages];
  next[index] = html;
  return next;
}

// A new blank page inserted directly after `index`.
export function insertPageAfter(pages: string[], index: number): string[] {
  const next = [...pages];
  next.splice(index + 1, 0, "");
  return next;
}

/*
 * The list with one page dropped, never going below a single page: deleting
 * the only page clears it instead of leaving the entry with none.
 */
export function removePage(pages: string[], index: number): string[] {
  if (pages.length <= 1) return [""];
  const next = [...pages];
  next.splice(index, 1);
  return next;
}

// Whether a page has anything on it once the tags are stripped.
export function pageIsEmpty(html: string): boolean {
  return (
    html
      .replace(/<[^>]+>/g, " ")
      .replace(/\s|&nbsp;/g, "")
      .trim() === ""
  );
}
