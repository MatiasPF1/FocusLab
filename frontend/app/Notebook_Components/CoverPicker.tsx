"use client";

import { useEffect, useRef } from "react";
import { Check, X } from "lucide-react";
import { COVERS } from "./covers";

/*
 * The panel that picks an entry's cover.
 *
 * Anchored under whatever opened it, so the editor and the card menu can both
 * use it. Choosing closes it - a cover is a one-tap decision, not a form.
 */

type CoverPickerProps = {
  // The id currently on the entry, "" for none.
  value: string;
  onChange: (cover: string) => void;
  onClose: () => void;
};

export default function CoverPicker({ value, onChange, onClose }: CoverPickerProps) {
  const panelRef = useRef<HTMLDivElement>(null);

  // Click-away and Escape both dismiss, which is what every other popover in
  // the app trains the user to expect.
  useEffect(() => {
    function onPointerDown(event: MouseEvent) {
      if (!panelRef.current?.contains(event.target as Node)) onClose();
    }
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") onClose();
    }
    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [onClose]);

  function choose(cover: string) {
    onChange(cover);
    onClose();
  }

  return (
    <div
      ref={panelRef}
      className="absolute right-0 top-full z-30 mt-2 w-max rounded-xl border border-ob-line bg-ob-surface p-3 shadow-2xl shadow-black/50"
    >
      <div className="mb-2.5 flex items-center gap-6">
        <p className="text-[10px] uppercase tracking-[0.14em] text-ob-slate">Cover</p>
        <button
          type="button"
          onClick={onClose}
          className="ml-auto rounded p-0.5 text-ob-slate transition hover:text-ob-mist"
          aria-label="Close"
        >
          <X aria-hidden="true" size={13} />
        </button>
      </div>

      <div className="flex items-start gap-2">
        {COVERS.map((cover) => {
          const active = cover.id === value;
          return (
            <button
              key={cover.id}
              type="button"
              onClick={() => choose(cover.id)}
              className="group flex w-[62px] flex-col gap-1.5 focus-visible:outline-none"
              title={cover.label}
              aria-pressed={active}
            >
              <span
                className={`relative block h-[84px] w-full overflow-hidden rounded-md border transition ${
                  active
                    ? "border-indigo-400 ring-1 ring-indigo-400/40"
                    : "border-ob-line group-hover:border-ob-slate"
                }`}
              >
                <img
                  src={cover.src}
                  alt=""
                  className="h-full w-full object-cover"
                  draggable={false}
                />
                {active && (
                  <span className="absolute right-1 top-1 flex h-4 w-4 items-center justify-center rounded-full bg-indigo-400 text-ob-base">
                    <Check aria-hidden="true" size={11} strokeWidth={3} />
                  </span>
                )}
              </span>
              <span
                className={`truncate text-center text-[11px] transition ${
                  active ? "text-ob-mist" : "text-ob-slate group-hover:text-ob-mist"
                }`}
              >
                {cover.label}
              </span>
            </button>
          );
        })}

        {/* "None" is a swatch of its own so removing a cover is the same gesture
            as choosing one, rather than a differently-shaped button elsewhere. */}
        <button
          type="button"
          onClick={() => choose("")}
          className="group flex w-[62px] flex-col gap-1.5 focus-visible:outline-none"
          title="No cover"
          aria-pressed={value === ""}
        >
          <span
            className={`relative flex h-[84px] w-full items-center justify-center overflow-hidden rounded-md border border-dashed transition ${
              value === ""
                ? "border-indigo-400 bg-ob-raised/40 ring-1 ring-indigo-400/40"
                : "border-ob-line bg-ob-base group-hover:border-ob-slate"
            }`}
          >
            <X
              aria-hidden="true"
              size={15}
              className={value === "" ? "text-indigo-400" : "text-ob-slate"}
            />
          </span>
          <span
            className={`truncate text-center text-[11px] transition ${
              value === "" ? "text-ob-mist" : "text-ob-slate group-hover:text-ob-mist"
            }`}
          >
            None
          </span>
        </button>
      </div>
    </div>
  );
}
