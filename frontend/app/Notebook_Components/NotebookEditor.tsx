"use client";

import { useEffect, useState, type RefObject } from "react";
import {
  ArrowLeft,
  Check,
  ChevronLeft,
  ChevronRight,
  Copy,
  Download,
  ImagePlus,
  Loader2,
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
 * not scroll away with the writing - and holds the LaTeX of that same page,
 * transcribed by the agent service on demand.
 *
 * The left pane is the same uncontrolled contentEditable the To-Do editor uses,
 * so the owner holds the ref and re-syncs it when the open page changes.
 */

// An entry as returned by the backend's /notebook endpoints.
export type Note = {
  id: number;
  title: string;
  content: string; // HTML, edited via document.execCommand
  cover: string; // an id from covers.ts, "" for none
  created_at: string;
  updated_at: string;
};

/*
 * What the agent hands back for one page: the .tex it wrote, and the PDF it
 * compiled from that exact source.
 *
 * `pdfUrl` points at those bytes as a blob, and is null when the document would
 * not compile even after the agent's repair pass. The source is still worth
 * showing in that case, which is why the two are separate fields and not one or
 * the other.
 */
export type LatexResult = {
  source: string;
  pdfUrl: string | null;
  pdfError: string | null;
  // When this conversion was made, and whether the page has been edited since.
  // Both are about a stored conversion being read back - one that has just come
  // out of the agent is new and, by definition, current.
  madeAt: string | null;
  stale: boolean;
};

export function previewText(html: string) {
  return html
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/* Which half of the output pane is on show. */
type View = "rendered" | "source";

/* "21 Aug, 23:14" - a stored conversion says when it was made. */
function formatMadeAt(iso: string) {
  // The backend stamps UTC without saying so, which a browser would otherwise
  // read as local time and show an hour or five out.
  const stamped = iso.endsWith("Z") ? iso : `${iso}Z`;
  return new Date(stamped).toLocaleString("en-US", {
    day: "numeric",
    month: "short",
    hour: "numeric",
    minute: "2-digit",
  });
}

/* What the PDF is called once it is on disk: the entry, and which page of it. */
function pdfFileName(title: string, pageIndex: number) {
  const name = (title.trim() || "Untitled").replace(/[\\/:*?"<>|]/g, "-");
  return `${name} - page ${pageIndex + 1}.pdf`;
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
  // The right pane: the typeset page and the source it came from, or nothing
  // until it is asked for.
  latex: LatexResult | null;
  latexBusy: boolean;
  latexError: string | null;
  onTransformLatex: () => void;
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
  latex,
  latexBusy,
  latexError,
  onTransformLatex,
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
  // Flips back on its own a moment after a copy, so the button says what just
  // happened without needing a toast.
  const [copied, setCopied] = useState(false);
  // The typeset page is what the pane is for, so it opens on it; the source is
  // a tab away for anyone who wants to paste it into Overleaf.
  const [view, setView] = useState<View>("rendered");
  const cover = coverSrc(note.cover);

  // What is actually on show. A document that would not compile has nothing to
  // render, so it falls back to its source rather than an empty frame - and it
  // falls back without touching the choice the user made, which is waiting for
  // them again the next time there is a PDF.
  const shown: View = latex?.pdfUrl ? view : "source";

  useEffect(() => {
    if (!copied) return;
    const timer = setTimeout(() => setCopied(false), 1500);
    return () => clearTimeout(timer);
  }, [copied]);

  async function copyLatex() {
    if (!latex) return;
    try {
      await navigator.clipboard.writeText(latex.source);
      setCopied(true);
    } catch {
      // Clipboard access can be refused; the source is on screen to select.
    }
  }

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

            <div className="flex items-center gap-1">
              {/* Only worth showing once there is something to look at */}
              {latex && !latexBusy && (
                <>
                  {/* The page or its source. Both live at once, so this is a
                      switch between two things already here, not a reload. */}
                  {latex.pdfUrl && (
                    <div className="mr-1 flex items-center rounded-md border border-ob-line p-0.5">
                      {(["rendered", "source"] as View[]).map((option) => (
                        <button
                          key={option}
                          type="button"
                          onClick={() => setView(option)}
                          className={`rounded-[3px] px-2 py-0.5 text-[11px] capitalize transition ${
                            shown === option
                              ? "bg-ob-raised text-ob-mist"
                              : "text-ob-slate hover:text-ob-mist"
                          }`}
                        >
                          {option}
                        </button>
                      ))}
                    </div>
                  )}

                  {/* Icons alone: the row already carries a switch and a
                      button, and this pane can be as narrow as 20rem. */}
                  {shown === "rendered" && latex.pdfUrl ? (
                    <a
                      href={latex.pdfUrl}
                      download={pdfFileName(note.title, pageIndex)}
                      className="rounded-md p-1.5 text-ob-slate transition hover:bg-ob-raised hover:text-ob-mist"
                      title="Save the PDF"
                      aria-label="Save the PDF"
                    >
                      <Download aria-hidden="true" size={14} />
                    </a>
                  ) : (
                    <button
                      type="button"
                      onClick={copyLatex}
                      className="rounded-md p-1.5 text-ob-slate transition hover:bg-ob-raised hover:text-ob-mist"
                      title={copied ? "Copied" : "Copy the LaTeX source"}
                      aria-label="Copy the LaTeX source"
                    >
                      {copied ? (
                        <Check aria-hidden="true" size={14} />
                      ) : (
                        <Copy aria-hidden="true" size={14} />
                      )}
                    </button>
                  )}
                </>
              )}

              <button
                type="button"
                onClick={onTransformLatex}
                disabled={latexBusy}
                className="flex items-center gap-1.5 rounded-md border border-ob-line px-2.5 py-1 text-xs text-ob-slate transition hover:border-ob-slate hover:text-ob-mist disabled:pointer-events-none disabled:opacity-50"
              >
                {latexBusy ? (
                  <Loader2 aria-hidden="true" size={13} className="animate-spin" />
                ) : (
                  <Sigma aria-hidden="true" size={13} />
                )}
                {latexBusy ? "Transforming" : latex ? "Transform again" : "Transform to LaTeX"}
              </button>
            </div>
          </div>

          {/*
           * Four states, one slot: working, failed, done, and nothing asked for
           * yet.
           */}
          {latexBusy ? (
            <div className="flex flex-1 flex-col items-center justify-center gap-3 px-8">
              <Loader2
                aria-hidden="true"
                size={18}
                className="animate-spin text-ob-slate"
              />
              <p className="max-w-[16rem] text-center text-sm leading-relaxed text-ob-slate/70">
                Reading this page, setting it in LaTeX and typesetting it.
                Pictures take a moment longer.
              </p>
            </div>
          ) : latexError ? (
            <div className="flex flex-1 flex-col items-center justify-center gap-1 px-8">
              <p className="max-w-[18rem] text-center text-sm leading-relaxed text-red-400">
                {latexError}
              </p>
              <p className="text-xs text-ob-slate/70">Try again when it is up.</p>
            </div>
          ) : latex ? (
            <>
              {/* A line about where this came from, above whichever half is
                  showing. Nothing is said about a conversion that was just
                  made from the page as it stands - that is the normal case and
                  needs no explaining. */}
              {(latex.stale || latex.madeAt) && (
                <p
                  className={`shrink-0 border-b px-5 py-1.5 text-[11px] ${
                    latex.stale
                      ? "border-amber-400/25 bg-amber-400/5 text-amber-300/90"
                      : "border-ob-line/60 text-ob-slate"
                  }`}
                >
                  {latex.stale
                    ? "The page has changed since this was made. Transform again to catch it up."
                    : `Converted ${formatMadeAt(latex.madeAt!)}`}
                </p>
              )}

              {shown === "rendered" && latex.pdfUrl ? (
                /* The PDF itself, in the browser's own viewer - scrolling,
                   zooming and printing come with it. */
                <iframe
                  key={latex.pdfUrl}
                  src={latex.pdfUrl}
                  title="The typeset page"
                  className="min-h-0 flex-1 border-0 bg-ob-base"
                />
              ) : (
                <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">
                  {/* A document that would not compile still has its source to
                      show, with the engine's complaint above it. */}
                  {latex.pdfError && (
                    <div className="mb-4 rounded-md border border-red-400/30 bg-red-400/5 px-3 py-2">
                      <p className="text-xs font-medium text-red-400">
                        This did not typeset, so only the source is here.
                      </p>
                      <pre className="mt-1.5 max-h-32 overflow-y-auto whitespace-pre-wrap break-words font-mono text-[11px] leading-[1.5] text-ob-slate">
                        {latex.pdfError}
                      </pre>
                    </div>
                )}
                {/* A whole .tex document, so it wraps rather than scrolling
                    sideways - this pane is too narrow to read a long line in. */}
                <pre className="whitespace-pre-wrap break-words font-mono text-[12px] leading-[1.6] text-ob-mist/90">
                  {latex.source}
                </pre>
              </div>
              )}
            </>
          ) : (
            <div className="flex flex-1 items-center justify-center px-8">
              <p className="max-w-[16rem] text-center text-sm leading-relaxed text-ob-slate/70">
                The LaTeX version of this page will appear here.
              </p>
            </div>
          )}
        </aside>
      </div>
    </section>
  );
}
