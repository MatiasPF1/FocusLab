"use client";

import { RefObject, useCallback, useEffect, useState } from "react";
import { BlockType, activeBlockType, isInlineActive } from "./formatting";

/* Viewport coordinates of the highlighted text, which is all the popup needs
 * to anchor itself. */
export type SelectionRect = {
  top: number;
  bottom: number;
  left: number;
  width: number;
};

/* Everything the toolbar needs to draw itself, read in one pass. */
export type SelectionState = {
  rect: SelectionRect;
  block: BlockType;
  bold: boolean;
  italic: boolean;
  underline: boolean;
};

function readRect(editor: HTMLElement | null): SelectionRect | null {
  const selection = window.getSelection();
  if (!editor || !selection || selection.isCollapsed || selection.rangeCount === 0) {
    return null;
  }

  const range = selection.getRangeAt(0);
  if (!editor.contains(range.commonAncestorContainer)) return null;

  // Clicking an image selects it, but there is no text to bold — let the image
  // resizer own that selection instead of covering it with this toolbar.
  if (range.cloneContents().textContent?.trim() === "") return null;

  const rect = range.getBoundingClientRect();
  if (rect.width === 0 && rect.height === 0) return null;

  return { top: rect.top, bottom: rect.bottom, left: rect.left, width: rect.width };
}

function unchanged(a: SelectionState | null, b: SelectionState | null) {
  if (!a || !b) return a === b;
  return (
    Math.round(a.rect.top) === Math.round(b.rect.top) &&
    Math.round(a.rect.left) === Math.round(b.rect.left) &&
    Math.round(a.rect.width) === Math.round(b.rect.width) &&
    a.block.tag === b.block.tag &&
    a.bold === b.bold &&
    a.italic === b.italic &&
    a.underline === b.underline
  );
}

/*
 * Tracks the text selected inside `editorRef`: where it sits on screen and
 * which formatting is already applied to it. Null whenever there is nothing
 * to format.
 *
 * Returns a stable object while the selection sits still, so the toolbar only
 * re-renders when something actually changed rather than on every
 * selectionchange event the browser fires mid-drag.
 *
 * `sync` re-reads it on demand — execCommand mutates the DOM behind React's
 * back, so the toolbar calls this after each command to refresh its own
 * active states.
 */
export function useSelectionState(editorRef: RefObject<HTMLElement | null>) {
  const [state, setState] = useState<SelectionState | null>(null);

  const sync = useCallback(() => {
    const editor = editorRef.current;
    const rect = readRect(editor);
    const next: SelectionState | null = rect && {
      rect,
      block: activeBlockType(editor),
      bold: isInlineActive("bold"),
      italic: isInlineActive("italic"),
      underline: isInlineActive("underline"),
    };
    setState((prev) => (unchanged(prev, next) ? prev : next));
  }, [editorRef]);

  useEffect(() => {
    document.addEventListener("selectionchange", sync);
    // Capture phase: the editor lives inside a scrolling panel, and that
    // panel's scroll event never bubbles up to window.
    window.addEventListener("scroll", sync, true);
    window.addEventListener("resize", sync);

    return () => {
      document.removeEventListener("selectionchange", sync);
      window.removeEventListener("scroll", sync, true);
      window.removeEventListener("resize", sync);
    };
  }, [sync]);

  return { state, sync };
}
