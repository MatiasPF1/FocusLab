/*
 * The cover art a notebook entry can wear.
 *
 * The backend stores only the `id` of the chosen cover, never a path, so the
 * image files can be renamed or moved without invalidating what is already
 * saved. This catalogue is the one place the two are tied together.
 *
 * To add one: drop the file in frontend/public/covers/ and add a line here.
 */

export type Cover = {
  id: string;
  label: string;
  src: string;
};

export const COVERS: Cover[] = [
  { id: "cover1", label: "Dunes", src: "/covers/cover1.png" },
  { id: "cover2", label: "Wildflower", src: "/covers/cover2.png" },
  { id: "cover3", label: "Confetti", src: "/covers/cover3.png" },
];

/*
 * The image path for a stored id, or null when there is no cover.
 *
 * Returns null for an id that is not in the catalogue too, so a cover whose
 * file was removed degrades to a plain entry instead of a broken image.
 */
export function coverSrc(id: string | null | undefined): string | null {
  if (!id) return null;
  return COVERS.find((cover) => cover.id === id)?.src ?? null;
}
