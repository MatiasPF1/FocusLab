/*
 * The vocabulary the rich-text popup speaks: the block types it can apply, the
 * text colours it offers, and thin wrappers over document.execCommand.
 *
 * Kept separate from the React components so any editable surface — the notes
 * on the To-Do page today, the notebook later — can reuse the same commands
 * and the same prose styling without pulling in the UI.
 */

export type BlockType = {
  label: string;
  tag: string;
  /* How the label previews itself inside the dropdown. */
  preview: string;
};

export const BLOCK_TYPES: BlockType[] = [
  { label: "Normal Text", tag: "p", preview: "text-sm" },
  { label: "Heading 1", tag: "h1", preview: "text-xl font-bold" },
  { label: "Heading 2", tag: "h2", preview: "text-lg font-bold" },
  { label: "Heading 3", tag: "h3", preview: "text-base font-semibold" },
  { label: "Heading 4", tag: "h4", preview: "text-sm font-semibold" },
];

export type TextColor = { label: string; value: string };

/* Restores body text to ob-mist — the palette's "no colour" option. */
export const DEFAULT_TEXT_COLOR: TextColor = { label: "Default", value: "#d1d5db" };

/* Eight hues, all picked to stay legible on the Midnight Obsidian background. */
export const TEXT_COLORS: TextColor[] = [
  { label: "Gray", value: "#9aa5b1" },
  { label: "Red", value: "#ff7369" },
  { label: "Orange", value: "#ffa344" },
  { label: "Yellow", value: "#ffdc49" },
  { label: "Green", value: "#4ac96b" },
  { label: "Blue", value: "#529cca" },
  { label: "Purple", value: "#9a6dd7" },
  { label: "Pink", value: "#e255a1" },
];

export type InlineCommand = "bold" | "italic" | "underline";

export function toggleInline(command: InlineCommand) {
  document.execCommand(command, false);
}

export function applyBlockType(tag: string) {
  document.execCommand("formatBlock", false, tag);
}

export function applyTextColor(value: string) {
  // styleWithCSS makes the colour land as `style="color: …"` rather than a
  // legacy <font> tag, so the stored HTML stays consistent with everything
  // else the editor writes. Flipped back off afterwards so bold/italic keep
  // emitting plain <b>/<i>.
  document.execCommand("styleWithCSS", false, "true");
  document.execCommand("foreColor", false, value);
  document.execCommand("styleWithCSS", false, "false");
}

/* Whether bold/italic/underline is on at the caret. Throws in some browsers
 * when there is no selection at all, hence the guard. */
export function isInlineActive(command: InlineCommand) {
  try {
    return document.queryCommandState(command);
  } catch {
    return false;
  }
}

/* Walks up from the caret to the nearest block we know about, so the dropdown
 * can label itself "Heading 2" instead of always saying "Normal Text". */
export function activeBlockType(root: HTMLElement | null): BlockType {
  const selection = window.getSelection();
  if (!root || !selection || selection.rangeCount === 0) return BLOCK_TYPES[0];

  let node: Node | null = selection.getRangeAt(0).startContainer;
  while (node && node !== root) {
    if (node instanceof HTMLElement) {
      const tag = node.tagName.toLowerCase();
      const match = BLOCK_TYPES.find((type) => type.tag === tag);
      if (match) return match;
    }
    node = node.parentNode;
  }
  return BLOCK_TYPES[0];
}

/* Rendering rules for the editable body, shared so every editor renders the
 * blocks this toolbar produces the same way. */
export const EDITOR_PROSE =
  "[&_h1]:mt-6 [&_h1]:text-3xl [&_h1]:font-bold " +
  "[&_h2]:mt-6 [&_h2]:text-2xl [&_h2]:font-bold " +
  "[&_h3]:mt-4 [&_h3]:text-xl [&_h3]:font-semibold " +
  "[&_h4]:mt-4 [&_h4]:text-lg [&_h4]:font-semibold " +
  "[&_ul]:list-disc [&_ul]:pl-6 " +
  "[&_a]:text-[#4ac96b] [&_a]:underline " +
  // Images default to their natural size, capped at the column width, until
  // ImageResizer writes an explicit inline width onto one.
  "[&_img]:my-2 [&_img]:h-auto [&_img]:max-w-full [&_img]:rounded-md";
