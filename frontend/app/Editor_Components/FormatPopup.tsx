"use client";

import { RefObject, useState } from "react";
import { Bold, Check, ChevronRight, Italic, Type, Underline } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  BLOCK_TYPES,
  DEFAULT_TEXT_COLOR,
  TEXT_COLORS,
  applyBlockType,
  applyTextColor,
  toggleInline,
} from "./formatting";
import { SelectionState, useSelectionState } from "./useSelectionState";


const CARD_WIDTH = 184; // px — keep in sync with `w-46` on the card below
const GAP = 8; // breathing room between the selection and the card
const EDGE = 8; // minimum distance from the viewport edge
const FLIP_BELOW_ABOVE = 150; // above this much headroom the card sits on top

type Menu = "none" | "block" | "color";

type FormatPopupProps = {
  editorRef: RefObject<HTMLElement | null>;
  /* Called after every command so the host can persist the new HTML. */
  onFormat: () => void;
};

export default function FormatPopup({ editorRef, onFormat }: FormatPopupProps) {
  const { state, sync } = useSelectionState(editorRef);
  if (!state) return null;

  // Card lives in its own component so that losing the selection unmounts it,
  // which drops any open submenu with it — the next selection always opens
  // closed, no reset logic required.
  return <Card state={state} sync={sync} onFormat={onFormat} />;
}

function Card({
  state,
  sync,
  onFormat,
}: {
  state: SelectionState;
  sync: () => void;
  onFormat: () => void;
}) {
  const [menu, setMenu] = useState<Menu>("none");

  function run(command: () => void) {
    command();
    sync(); // execCommand edits the DOM behind React's back
    setMenu("none");
    onFormat();
  }

  const { rect, block } = state;

  // Anchor to the middle of the selection, clamped so the card never hangs off
  // the side, and flipped underneath when there is no room above.
  const below = rect.top < FLIP_BELOW_ABOVE;
  const half = CARD_WIDTH / 2;
  const left = Math.min(
    Math.max(rect.left + rect.width / 2, half + EDGE),
    window.innerWidth - half - EDGE,
  );

  return (
    <div
      style={{ top: below ? rect.bottom + GAP : rect.top - GAP, left }}
      // Keeps the text selection alive: without this, pressing a button blurs
      // the editor and execCommand has nothing to act on.
      onMouseDown={(event) => event.preventDefault()}
      className={cn(
        "fixed z-50 -translate-x-1/2",
        !below && "-translate-y-full",
      )}
    >
      <div className="w-46 overflow-hidden rounded-lg border border-ob-line/70 bg-ob-raised shadow-xl shadow-black/50">
        <button
          type="button"
          onClick={() => setMenu(menu === "block" ? "none" : "block")}
          className="flex w-full items-center justify-between gap-2 px-2.5 py-2 text-sm text-ob-mist transition hover:bg-ob-line/50"
        >
          <span className="flex items-center gap-2">
            <Type aria-hidden="true" size={14} className="text-ob-slate" />
            {block.label}
          </span>
          <ChevronRight aria-hidden="true" size={14} className="text-ob-slate" />
        </button>

        <div className="h-px bg-ob-line/60" />

        <div className="flex items-center gap-1 p-1.5">
          <ToolButton
            label="Text color"
            active={menu === "color"}
            onClick={() => setMenu(menu === "color" ? "none" : "color")}
          >
            <span className="text-sm font-semibold leading-none">A</span>
          </ToolButton>
          <ToolButton
            label="Bold"
            active={state.bold}
            onClick={() => run(() => toggleInline("bold"))}
          >
            <Bold aria-hidden="true" size={15} />
          </ToolButton>
          <ToolButton
            label="Italic"
            active={state.italic}
            onClick={() => run(() => toggleInline("italic"))}
          >
            <Italic aria-hidden="true" size={15} />
          </ToolButton>
          <ToolButton
            label="Underline"
            active={state.underline}
            onClick={() => run(() => toggleInline("underline"))}
          >
            <Underline aria-hidden="true" size={15} />
          </ToolButton>
        </div>
      </div>

      {menu === "block" && (
        <Panel>
          {BLOCK_TYPES.map((type) => (
            <button
              key={type.tag}
              type="button"
              onClick={() => run(() => applyBlockType(type.tag))}
              className="flex w-full items-center justify-between gap-3 rounded-md px-2 py-1.5 text-ob-mist transition hover:bg-ob-line/50"
            >
              <span className={type.preview}>{type.label}</span>
              {block.tag === type.tag && (
                <Check aria-hidden="true" size={14} className="shrink-0 text-[#4ac96b]" />
              )}
            </button>
          ))}
        </Panel>
      )}

      {menu === "color" && (
        <Panel>
          <button
            type="button"
            onClick={() => run(() => applyTextColor(DEFAULT_TEXT_COLOR.value))}
            className="mb-1 flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-sm text-ob-mist transition hover:bg-ob-line/50"
          >
            <Swatch color={DEFAULT_TEXT_COLOR.value} />
            {DEFAULT_TEXT_COLOR.label}
          </button>

          <div className="grid grid-cols-4 gap-1">
            {TEXT_COLORS.map((color) => (
              <button
                key={color.value}
                type="button"
                title={color.label}
                aria-label={color.label}
                onClick={() => run(() => applyTextColor(color.value))}
                className="flex items-center justify-center rounded-md py-1.5 transition hover:bg-ob-line/50"
              >
                <Swatch color={color.value} />
              </button>
            ))}
          </div>
        </Panel>
      )}
    </div>
  );
}

/* One icon button in the inline row. */
function ToolButton({
  label,
  active,
  onClick,
  children,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      aria-pressed={active}
      className={cn(
        "flex h-7 w-7 items-center justify-center rounded-md transition",
        active
          ? "bg-ob-line/70 text-ob-mist"
          : "text-ob-slate hover:bg-ob-line/50 hover:text-ob-mist",
      )}
    >
      {children}
    </button>
  );
}

/* The dropdown that hangs off the card for either submenu. */
function Panel({ children }: { children: React.ReactNode }) {
  return (
    <div className="absolute left-0 top-full mt-1 w-46 rounded-lg border border-ob-line/70 bg-ob-raised p-1 text-sm shadow-xl shadow-black/50">
      {children}
    </div>
  );
}

/* A letter "A" tinted with the colour it applies. */
function Swatch({ color }: { color: string }) {
  return (
    <span
      style={{ color }}
      className="flex h-5 w-5 items-center justify-center rounded border border-ob-line/70 text-xs font-semibold leading-none"
    >
      A
    </span>
  );
}
