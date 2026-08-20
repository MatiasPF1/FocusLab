"use client";

import { useState, type RefObject } from "react";
import {
  ArrowLeft,
  ChevronLeft,
  ChevronRight,
  ImagePlus,
  Plus,
  Sigma,
  Trash2,
} from "lucide-react";
import FormatPopup from "../Editor_Components/FormatPopup";
import ImageResizer from "../Editor_Components/ImageResizer";
import { EDITOR_PROSE } from "../Editor_Components/formatting";
import CoverPicker from "./CoverPicker";
import { coverSrc } from "./covers";

/*
 * The Notebook's writing surface: a spread of two panes.
 *
 * Left is the page being written, one page at a time. Right is fixed - it does
 * not scroll away with the writing - and is where a converted version of the
 * page will eventually appear. Its button is deliberately inert for now.
 *
 * The left pane is the same uncontrolled contentEditable the To-Do editor uses,
 * so the owner holds the ref and re-syncs it when the open page changes.
 */

// An entry as returned by the backend's /notes endpoints.
export type Note = {
  id: number;
  title: string;
  content: string; // HTML, edited via document.execCommand
  cover: string; // an id from covers.ts, "" for none
  created_at: string;
  updated_at: string;
};

export function previewText(html: string) {
  return html
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function formatFullDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

type NotebookEditorProps = {
  note: Note;
  error: string | null;
  contentRef: RefObject<HTMLDivElement | null>;
  contentIsEmpty: boolean;
  // Which page of this entry is open, and how many there are.
  pageIndex: number;
  pageCount: number;
  onBack: () => void;
  onDelete: (id: number) => void;
  onTitleChange: (id: number, title: string) => void;
  onCoverChange: (id: number, cover: string) => void;
  onContentInput: () => void;
  onGoToPage: (index: number) => void;
  onAddPage: () => void;
  onDeletePage: () => void;
};

export default function NotebookEditor({
  note,
  error,
  contentRef,
  contentIsEmpty,
  pageIndex,
  pageCount,
  onBack,
  onDelete,
  onTitleChange,
  onCoverChange,
  onContentInput,
  onGoToPage,
  onAddPage,
  onDeletePage,
}: NotebookEditorProps) {
  const [pickingCover, setPickingCover] = useState(false);
  const cover = coverSrc(note.cover);

  const atFirstPage = pageIndex === 0;
  const atLastPage = pageIndex === pageCount - 1;

  return (
    <section className="flex flex-1 flex-col overflow-hidden">
      {/* ##################################################################
          TOP BAR - spans both panes
          ################################################################## */}
      <div className="flex shrink-0 items-center justify-between border-b border-ob-line/60 px-6 py-3">
        <button
          type="button"
          onClick={onBack}
          className="flex items-center gap-1.5 rounded-md px-2 py-1 text-sm text-ob-slate transition hover:bg-ob-raised hover:text-ob-mist"
        >
          <ArrowLeft aria-hidden="true" size={16} />
          Notebook
        </button>

        <div className="flex items-center gap-1">
          {/* relative: the picker hangs off this button */}
          <div className="relative">
            <button
              type="button"
              onClick={() => setPickingCover((open) => !open)}
              className="flex items-center gap-1.5 rounded-md px-2 py-1 text-sm text-ob-slate transition hover:bg-ob-raised hover:text-ob-mist"
            >
              <ImagePlus aria-hidden="true" size={15} />
              {cover ? "Change cover" : "Add cover"}
            </button>
            {pickingCover && (
              <CoverPicker
                value={note.cover}
                onChange={(next) => onCoverChange(note.id, next)}
                onClose={() => setPickingCover(false)}
              />
            )}
          </div>

          <button
            type="button"
            onClick={() => onDelete(note.id)}
            className="flex items-center gap-1.5 rounded-md px-2 py-1 text-sm text-ob-slate transition hover:bg-ob-raised hover:text-red-400"
          >
            <Trash2 aria-hidden="true" size={15} />
            Delete
          </button>
        </div>
      </div>

      {error && (
        <p className="shrink-0 px-6 pt-3 text-xs text-red-400">{error}</p>
      )}

      {/* ##################################################################
          THE SPREAD - writing on the left, output on the right
          ################################################################## */}
      <div className="flex min-h-0 flex-1">
        {/* ---------------------------- LEFT ---------------------------- */}
        <div className="flex min-w-0 flex-1 flex-col">
          <div className="flex-1 overflow-y-auto px-6 py-6">
            <div className="mx-auto w-full max-w-2xl">
              {/* Cover and title belong to the entry, so they sit above the
                  first page only rather than repeating on every one. */}
              {atFirstPage && (
                <>
                  {cover && (
                    <div className="mb-4 h-40 w-full overflow-hidden rounded-xl border border-ob-line/60">
                      <img
                        src={cover}
                        alt=""
                        className="h-full w-full object-cover"
                        draggable={false}
                      />
                    </div>
                  )}

                  <p className="text-xs text-ob-slate">
                    Last edited on {formatFullDate(note.updated_at)}
                  </p>

                  <input
                    type="text"
                    value={note.title}
                    onChange={(event) => onTitleChange(note.id, event.target.value)}
                    placeholder="Untitled"
                    className="mt-3 w-full bg-transparent text-4xl font-bold text-ob-mist outline-none placeholder:text-ob-slate/50"
                  />
                </>
              )}

              {/* Select text for the formatting popup, click an image to resize it. */}
              <FormatPopup editorRef={contentRef} onFormat={onContentInput} />
              <ImageResizer editorRef={contentRef} onResize={onContentInput} />

              <div className={`relative pb-16 ${atFirstPage ? "mt-6" : "mt-0"}`}>
                {contentIsEmpty && (
                  <p className="pointer-events-none absolute left-0 top-0 text-ob-slate/50">
                    {atFirstPage ? "Write something..." : "Continue here..."}
                  </p>
                )}
                <div
                  ref={contentRef}
                  contentEditable
                  suppressContentEditableWarning
                  onInput={onContentInput}
                  className={`note-content min-h-[50vh] text-base leading-7 text-ob-mist outline-none ${EDITOR_PROSE}`}
                />
              </div>
            </div>
          </div>

          {/* Page controls sit under the writing, not over it, so they never
              cover the last line being typed. */}
          <div className="flex shrink-0 items-center justify-center gap-1 border-t border-ob-line/60 px-6 py-2.5">
            <button
              type="button"
              onClick={() => onGoToPage(pageIndex - 1)}
              disabled={atFirstPage}
              className="rounded-md p-1.5 text-ob-slate transition hover:bg-ob-raised hover:text-ob-mist disabled:pointer-events-none disabled:opacity-30"
              aria-label="Previous page"
              title="Previous page"
            >
              <ChevronLeft aria-hidden="true" size={16} />
            </button>

            <span className="min-w-[6.5rem] text-center text-xs tabular-nums text-ob-slate">
              Page {pageIndex + 1} of {pageCount}
            </span>

            <button
              type="button"
              onClick={() => onGoToPage(pageIndex + 1)}
              disabled={atLastPage}
              className="rounded-md p-1.5 text-ob-slate transition hover:bg-ob-raised hover:text-ob-mist disabled:pointer-events-none disabled:opacity-30"
              aria-label="Next page"
              title="Next page"
            >
              <ChevronRight aria-hidden="true" size={16} />
            </button>

            <span className="mx-1.5 h-4 w-px bg-ob-line" />

            <button
              type="button"
              onClick={onAddPage}
              className="flex items-center gap-1.5 rounded-md px-2 py-1 text-xs text-ob-slate transition hover:bg-ob-raised hover:text-ob-mist"
              title="Add a page after this one"
            >
              <Plus aria-hidden="true" size={14} />
              Page
            </button>

            <button
              type="button"
              onClick={onDeletePage}
              disabled={pageCount === 1}
              className="rounded-md p-1.5 text-ob-slate transition hover:bg-ob-raised hover:text-red-400 disabled:pointer-events-none disabled:opacity-30"
              aria-label="Delete this page"
              title="Delete this page"
            >
              <Trash2 aria-hidden="true" size={14} />
            </button>
          </div>
        </div>

        {/* ---------------------------- RIGHT ---------------------------- */}
        {/*
         * Fixed beside the writing rather than below it: it holds the converted
         * version of the page, so it has to stay in view while the left pane is
         * being typed into.
         */}
        <aside className="flex w-[40%] min-w-[20rem] shrink-0 flex-col border-l border-ob-line/60 bg-ob-base">
          <div className="flex shrink-0 items-center justify-between border-b border-ob-line/60 px-5 py-2.5">
            <p className="text-[10px] uppercase tracking-[0.14em] text-ob-slate">
              Output
            </p>
            <button
              type="button"
              className="flex items-center gap-1.5 rounded-md border border-ob-line px-2.5 py-1 text-xs text-ob-slate transition hover:border-ob-slate hover:text-ob-mist"
            >
              <Sigma aria-hidden="true" size={13} />
              Transform to LaTeX
            </button>
          </div>

          <div className="flex flex-1 items-center justify-center px-8">
            <p className="max-w-[16rem] text-center text-sm leading-relaxed text-ob-slate/70">
              The LaTeX version of this page will appear here.
            </p>
          </div>
        </aside>
      </div>
    </section>
  );
}
