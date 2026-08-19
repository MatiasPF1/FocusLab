"use client";

import { RefObject, useCallback, useEffect, useRef, useState } from "react";

/*
 * Click an image inside `editorRef` to select it, then drag either side handle
 * to resize it — the same gesture Notion uses.
 *
 * The new width is written straight onto the image as an inline style, so it
 * travels with the note's HTML and survives a reload with no schema change.
 * Height stays `auto`, which keeps the aspect ratio locked.
 *
 * The selected <img> is held in a ref rather than state: it is a DOM node this
 * component mutates, not something React renders. What React renders is `box`,
 * the measured rectangle the overlay sits on.
 */

const MIN_WIDTH = 80; // px — below this the two handles start to overlap
const HANDLE_HIT = 14; // px — grabbable width of a handle

type Side = "left" | "right";
type Box = { top: number; left: number; width: number; height: number };

type ImageResizerProps = {
  editorRef: RefObject<HTMLElement | null>;
  /* Called once a drag finishes, so the host can persist the new HTML. */
  onResize: () => void;
};

export default function ImageResizer({ editorRef, onResize }: ImageResizerProps) {
  const imageRef = useRef<HTMLImageElement | null>(null);
  const [box, setBox] = useState<Box | null>(null);
  // Where the drag started, so every move is measured against one fixed origin
  // instead of accumulating rounding error frame by frame.
  const dragRef = useRef<{ x: number; width: number; side: Side } | null>(null);

  const measure = useCallback(() => {
    const image = imageRef.current;
    if (!image) {
      setBox(null);
      return;
    }
    const rect = image.getBoundingClientRect();
    setBox({ top: rect.top, left: rect.left, width: rect.width, height: rect.height });
  }, []);

  useEffect(() => {
    // Select on a click that lands on an image, deselect on anything else.
    // Presses on our own handles never reach the document, so arriving here
    // means the user moved on.
    function onPointerDown(event: PointerEvent) {
      const target = event.target;
      const editor = editorRef.current;
      imageRef.current =
        target instanceof HTMLImageElement && editor?.contains(target) ? target : null;
      measure();
    }

    document.addEventListener("pointerdown", onPointerDown);
    // Capture phase: the editor sits in a scrolling panel whose scroll event
    // never bubbles up to window.
    window.addEventListener("scroll", measure, true);
    window.addEventListener("resize", measure);

    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      window.removeEventListener("scroll", measure, true);
      window.removeEventListener("resize", measure);
    };
  }, [editorRef, measure]);

  if (!box) return null;

  function startDrag(event: React.PointerEvent<HTMLDivElement>, side: Side) {
    const image = imageRef.current;
    if (!image) return;
    event.preventDefault();
    event.stopPropagation();
    event.currentTarget.setPointerCapture(event.pointerId);
    dragRef.current = {
      x: event.clientX,
      width: image.getBoundingClientRect().width,
      side,
    };
  }

  function onDrag(event: React.PointerEvent<HTMLDivElement>) {
    const drag = dragRef.current;
    const image = imageRef.current;
    const editor = editorRef.current;
    if (!drag || !image || !editor) return;

    // Dragging the left handle outward means moving left, hence the flip.
    const delta = (event.clientX - drag.x) * (drag.side === "left" ? -1 : 1);
    const width = Math.round(
      Math.min(Math.max(drag.width + delta, MIN_WIDTH), editor.clientWidth),
    );

    image.style.width = `${width}px`;
    image.style.height = "auto";
    measure();
  }

  function endDrag(event: React.PointerEvent<HTMLDivElement>) {
    if (!dragRef.current) return;
    dragRef.current = null;
    event.currentTarget.releasePointerCapture(event.pointerId);
    onResize();
  }

  return (
    <div
      style={{ top: box.top, left: box.left, width: box.width, height: box.height }}
      className="pointer-events-none fixed z-40 rounded-md ring-2 ring-[#4ac96b]"
    >
      {(["left", "right"] as const).map((side) => (
        <div
          key={side}
          onPointerDown={(event) => startDrag(event, side)}
          onPointerMove={onDrag}
          onPointerUp={endDrag}
          onPointerCancel={endDrag}
          style={{ width: HANDLE_HIT }}
          // Hit area is wider than the visible bar so the handle is easy to grab.
          className={`pointer-events-auto absolute inset-y-0 flex cursor-ew-resize items-center justify-center ${
            side === "left" ? "-left-1.75" : "-right-1.75"
          }`}
        >
          <span className="h-9 max-h-[70%] w-1 rounded-full bg-[#4ac96b] shadow-sm shadow-black/50" />
        </div>
      ))}
    </div>
  );
}
