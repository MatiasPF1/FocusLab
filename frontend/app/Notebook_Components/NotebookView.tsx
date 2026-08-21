"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { FilePlus, Plus, Trash2 } from "lucide-react";
import NotebookEditor, {
  previewText,
  type LatexResult,
  type Note,
} from "./NotebookEditor";
import { coverSrc } from "./covers";
import {
  insertPageAfter,
  joinPages,
  pageFingerprint,
  pageIsEmpty,
  removePage,
  replacePage,
  splitPages,
} from "./pages";

/*
 * The Notebook workspace: a list of entries, and the editor for whichever one
 * is open.
 *
 * A copy of the To-Do page ((1.3)To-Do/page.tsx) rather than a shared
 * component, so the two can drift apart from here. Nothing in this file talks
 * to the FocusAI agent.
 */

const API_URL = process.env.NEXT_PUBLIC_API_URL;

// The LaTeX conversion is served by the agent container, not the backend: that
// is the process holding the Anthropic key. Same base URL the chat panel uses.
const AGENT_URL = process.env.NEXT_PUBLIC_AGENT_URL ?? "http://localhost:8001";

// The Notebook's own collection, separate from the To-Do page's /notes. The
// two were one set of rows once, and an edit on either page moved the other;
// they are different tables now and neither knows about the other.
const NOTEBOOK_PATH = "/notebook";

// How long to wait after the user stops typing before saving to the backend,
// so every keystroke doesn't fire its own request.
const SAVE_DEBOUNCE_MS = 600;

/*
 * The PDF bytes as something an <iframe> and a download link can point at.
 *
 * It arrives base64 inside JSON, and a data: URL cannot be used because
 * browsers refuse to render one in a frame - so it becomes bytes and then a
 * blob. Every URL made here has to be handed back to revokeObjectURL, which is
 * what showLatex below is for.
 */
function pdfObjectUrl(base64: string) {
  const bytes = Uint8Array.from(atob(base64), (character) => character.charCodeAt(0));
  return URL.createObjectURL(new Blob([bytes], { type: "application/pdf" }));
}

function formatCardDate(iso: string) {
  const date = new Date(iso);
  const sameYear = date.getFullYear() === new Date().getFullYear();
  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: sameYear ? undefined : "numeric",
  });
}

export default function NotebookView() {
  const [notes, setNotes] = useState<Note[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeNoteId, setActiveNoteId] = useState<number | null>(null);
  const [contentIsEmpty, setContentIsEmpty] = useState(true);
  // Which page of the open entry the left pane is showing.
  const [pageIndex, setPageIndex] = useState(0);
  const contentRef = useRef<HTMLDivElement>(null);

  // The right pane: the LaTeX of the page currently open, once it has been
  // asked for. Never persisted - it is derived from the page, so it is thrown
  // away rather than saved and left to go stale.
  const [latex, setLatex] = useState<LatexResult | null>(null);
  const [latexBusy, setLatexBusy] = useState(false);
  const [latexError, setLatexError] = useState<string | null>(null);
  // The blob URL currently on show, kept beside the state because it is a
  // resource to release rather than something to render.
  const pdfUrlRef = useRef<string | null>(null);
  // Bumped every time a conversion is asked for, so a stored one arriving late
  // can tell that it is no longer the thing the pane is waiting for.
  const latexJobRef = useRef(0);

  // Debounced-save timers, one per field so editing the title doesn't reset
  // an in-flight wait on the body and vice versa.
  const titleTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const contentTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Load every entry once on mount.
  useEffect(() => {
    let cancelled = false;

    fetch(`${API_URL}${NOTEBOOK_PATH}`)
      .then((res) => {
        if (!res.ok) throw new Error();
        return res.json();
      })
      .then((data) => {
        if (!cancelled) setNotes(data);
      })
      .catch(() => {
        if (!cancelled) setError("Could not load the notebook.");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  /*
   * Show a conversion, or clear the pane, releasing whatever the last one was
   * pointing at.
   *
   * Everything that puts something in the output pane goes through here: a
   * blob URL lives until it is revoked, and nothing else knows when the one
   * before it stopped being needed.
   */
  function showLatex(next: LatexResult | null) {
    if (pdfUrlRef.current) URL.revokeObjectURL(pdfUrlRef.current);
    pdfUrlRef.current = next?.pdfUrl ?? null;
    setLatex(next);
  }

  // The last one outlives the component otherwise: closing the editor unmounts
  // it without any of the paths above running.
  useEffect(
    () => () => {
      if (pdfUrlRef.current) URL.revokeObjectURL(pdfUrlRef.current);
    },
    [],
  );

  /*
   * Which page the editable div is currently holding.
   *
   * The editor is written to by hand rather than rendered, so nothing about it
   * says what is in there - and an empty one is ambiguous between "this page is
   * blank" and "React has just mounted this and nobody has filled it in yet".
   * The answer is kept on the node itself: a div React has just created carries
   * no marker, so a remount is always correctly read as "not holding anything",
   * with no bookkeeping to reset and nothing to get out of step.
   *
   * This matters because saving folds the editor back into the entry. Fold in
   * an empty div that was never filled and the entry is gone.
   */
  function pageKey(noteId: number, index: number) {
    return `${noteId}:${index}`;
  }

  function editorShows(key: string) {
    return contentRef.current?.dataset.page === key;
  }

  const activeNote = notes.find((note) => note.id === activeNoteId) ?? null;

  const sortedNotes = useMemo(
    () =>
      [...notes].sort(
        (a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime(),
      ),
    [notes],
  );

  // An entry's pages live inside its content HTML, split on a sentinel - see
  // pages.ts for why they are not a column of their own.
  const pages = useMemo(() => splitPages(activeNote?.content ?? ""), [activeNote?.content]);
  const pageCount = pages.length;

  // The editable body is uncontrolled (imperative innerHTML) so typing never
  // fights React's render cycle. It gets re-synced when the open entry changes
  // or when a different page is turned to - never on a keystroke, which is why
  // this depends on the two indices and not on the content itself.
  useEffect(() => {
    if (!activeNote || !contentRef.current) return;
    const key = pageKey(activeNote.id, pageIndex);
    // The entry's content changes on every keystroke and none of those are a
    // reason to overwrite the editor; the page being shown is.
    if (editorShows(key)) return;

    const html = splitPages(activeNote.content)[pageIndex] ?? "";
    contentRef.current.innerHTML = html;
    contentRef.current.dataset.page = key;
    setContentIsEmpty(previewText(html) === "");

    // The output belongs to the page that was converted, so turning to another
    // one empties the pane rather than leaving the wrong page's LaTeX beside it.
    showLatex(null);
    setLatexError(null);
    // activeNote, not activeNoteId: an entry that arrives after this component
    // mounted has to be written into the editor when it lands, and only the
    // whole object changes then. The guard above makes the extra runs free.
  }, [activeNote, pageIndex]);

  /*
   * Put back the conversion this page already has, if it has one.
   *
   * Declared after the effect above on purpose: that one clears the pane and
   * writes the page into the editor, so by the time this runs the DOM holds the
   * page being fingerprinted. A 404 is the ordinary answer - it means this page
   * has never been converted - and leaves the pane empty.
   */
  useEffect(() => {
    if (activeNoteId === null) return;
    let cancelled = false;
    const job = latexJobRef.current;
    const entryId = activeNoteId;
    const index = pageIndex;

    fetch(`${API_URL}${NOTEBOOK_PATH}/${entryId}/latex/${index}`)
      .then((res) => (res.ok ? res.json() : null))
      .then((stored) => {
        // A conversion started since this went out has taken the pane over, and
        // what is on screen is newer than what is stored.
        if (cancelled || !stored || latexJobRef.current !== job) return;
        showLatex({
          source: stored.source,
          pdfUrl: stored.pdf ? pdfObjectUrl(stored.pdf) : null,
          pdfError: null,
          madeAt: stored.updated_at,
          // Fingerprinted against the live editor rather than the saved note:
          // the two differ by whatever is still sitting in the save debounce.
          stale: stored.page_hash !== pageFingerprint(contentRef.current?.innerHTML ?? ""),
        });
      })
      .catch(() => {
        // Nothing to say: the pane is empty, which is what it would be anyway.
      });

    return () => {
      cancelled = true;
    };
  }, [activeNoteId, pageIndex]);

  /*
   * The entry's full content with whatever is currently in the editor folded
   * back into the open page.
   *
   * The editor holds one page, so anything that saves the whole entry has to
   * rebuild it from the other pages plus this one.
   */
  function contentWithOpenPage(note: Note) {
    const live = contentRef.current?.innerHTML;
    // Nothing is folded in from an editor that is not known to be showing this
    // page. Without this, a save arriving while the editor is a fresh empty div
    // writes that emptiness over the entry - which is how a page of notes
    // disappears without anybody deleting anything.
    if (live === undefined || !editorShows(pageKey(note.id, pageIndex))) {
      return note.content;
    }
    return joinPages(replacePage(splitPages(note.content), pageIndex, live));
  }

  // Opening an entry always starts at its first page.
  function openNote(id: number) {
    setPageIndex(0);
    setActiveNoteId(id);
  }

  async function createNote() {
    setError(null);
    try {
      const res = await fetch(`${API_URL}${NOTEBOOK_PATH}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      if (!res.ok) throw new Error();

      const created: Note = await res.json();
      setNotes((prev) => [created, ...prev]);
      openNote(created.id);
    } catch {
      setError("Could not create a new entry.");
    }
  }

  // Fire-and-forget save. Local state already reflects the edit optimistically,
  // this just persists it and reconciles updated_at once the server responds.
  function patchNote(id: number, patch: Partial<Pick<Note, "title" | "content" | "cover">>) {
    fetch(`${API_URL}${NOTEBOOK_PATH}/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(patch),
    })
      .then((res) => {
        if (!res.ok) throw new Error();
        return res.json();
      })
      .then((updated: Note) => {
        setNotes((prev) => prev.map((note) => (note.id === id ? updated : note)));
      })
      .catch(() => {
        setError("Could not save that change.");
      });
  }

  // Sends whatever is still waiting in the debounce timers right away, so
  // navigating back or deleting never loses the last few keystrokes.
  function flushPending(id: number) {
    const hadPendingTitle = titleTimerRef.current !== null;
    const hadPendingContent = contentTimerRef.current !== null;
    if (titleTimerRef.current) {
      clearTimeout(titleTimerRef.current);
      titleTimerRef.current = null;
    }
    if (contentTimerRef.current) {
      clearTimeout(contentTimerRef.current);
      contentTimerRef.current = null;
    }
    if (!hadPendingTitle && !hadPendingContent) return;

    const current = notes.find((note) => note.id === id);
    if (!current) return;
    patchNote(id, {
      title: current.title,
      // The editor only holds the open page, so the entry is rebuilt around it.
      content: hadPendingContent ? contentWithOpenPage(current) : current.content,
    });
  }

  function handleTitleChange(id: number, title: string) {
    setNotes((prev) => prev.map((note) => (note.id === id ? { ...note, title } : note)));

    if (titleTimerRef.current) clearTimeout(titleTimerRef.current);
    titleTimerRef.current = setTimeout(() => patchNote(id, { title }), SAVE_DEBOUNCE_MS);
  }

  // Not debounced, unlike the title and body: picking a cover is one discrete
  // choice rather than a stream of keystrokes, so it saves straight away.
  function handleCoverChange(id: number, cover: string) {
    setNotes((prev) => prev.map((note) => (note.id === id ? { ...note, cover } : note)));
    patchNote(id, { cover });
  }

  function handleContentInput() {
    if (!activeNote || !contentRef.current) return;
    // Same rule as contentWithOpenPage: an editor that was never filled in has
    // nothing to say about what this page contains, even if something was just
    // typed into it.
    if (!editorShows(pageKey(activeNote.id, pageIndex))) return;
    const pageHtml = contentRef.current.innerHTML;
    setContentIsEmpty(previewText(pageHtml) === "");

    // What is saved is the whole entry, so the edited page has to be folded
    // back in beside the pages that are not on screen.
    const content = joinPages(
      replacePage(splitPages(activeNote.content), pageIndex, pageHtml),
    );
    setNotes((prev) =>
      prev.map((note) => (note.id === activeNote.id ? { ...note, content } : note)),
    );

    // Whatever is in the output pane was made from the page as it was before
    // this keystroke, so it now describes an older version of it. Said once,
    // rather than on every letter typed after that.
    setLatex((prev) => (prev && !prev.stale ? { ...prev, stale: true } : prev));

    if (contentTimerRef.current) clearTimeout(contentTimerRef.current);
    const id = activeNote.id;
    contentTimerRef.current = setTimeout(
      () => patchNote(id, { content }),
      SAVE_DEBOUNCE_MS,
    );
  }

  // ###########################################################################
  //                                 PAGES
  // ###########################################################################

  /*
   * Save the entry right away, outside the debounce.
   *
   * Adding, deleting or turning a page rewrites the content in a way the user
   * would not expect to lose, so none of it waits on a timer.
   */
  function commitContent(id: number, content: string) {
    setNotes((prev) =>
      prev.map((note) => (note.id === id ? { ...note, content } : note)),
    );
    if (contentTimerRef.current) {
      clearTimeout(contentTimerRef.current);
      contentTimerRef.current = null;
    }
    patchNote(id, { content });
  }

  function goToPage(index: number) {
    if (!activeNote) return;
    const target = Math.max(0, Math.min(index, pageCount - 1));
    if (target === pageIndex) return;
    // Fold the open page in before turning, so nothing typed since the last
    // keystroke handler is stranded in the DOM.
    commitContent(activeNote.id, contentWithOpenPage(activeNote));
    setPageIndex(target);
  }

  function addPage() {
    if (!activeNote) return;
    const withOpenPage = splitPages(contentWithOpenPage(activeNote));
    commitContent(activeNote.id, joinPages(insertPageAfter(withOpenPage, pageIndex)));
    setPageIndex(pageIndex + 1); // land on the page just made
  }

  function deletePage() {
    if (!activeNote || pageCount === 1) return;
    const withOpenPage = splitPages(contentWithOpenPage(activeNote));
    const remaining = removePage(withOpenPage, pageIndex);
    commitContent(activeNote.id, joinPages(remaining));
    // Deleting the last page steps back, otherwise stay put and let the next
    // page slide into this slot.
    setPageIndex(Math.min(pageIndex, remaining.length - 1));
  }

  // ###########################################################################
  //                                  LATEX
  // ###########################################################################

  /*
   * Convert the open page and put the result in the right-hand pane.
   *
   * What is sent is the live editor rather than the saved content: the save
   * debounce may still be holding the last few keystrokes, and handing back a
   * transcription of a page as it was a second ago would be a strange thing to
   * do. The agent answers with a whole .tex document, so nothing here parses
   * it - it is text to show and to copy.
   */
  /*
   * Persist a conversion against the page it was made from.
   *
   * Fire-and-forget, and deliberately not allowed to disturb the pane: the
   * result is already on screen and useful, so a failure here is a note in the
   * entry's error line rather than something that takes the LaTeX away.
   */
  function storeLatex(
    entryId: number,
    index: number,
    body: { source: string; pdf: string | null; page_hash: string },
  ) {
    fetch(`${API_URL}${NOTEBOOK_PATH}/${entryId}/latex/${index}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    })
      .then((res) => {
        if (!res.ok) throw new Error();
      })
      .catch(() => {
        setError("The conversion could not be saved, so it is only on screen.");
      });
  }

  async function transformToLatex() {
    if (!activeNote || latexBusy) return;
    const pageHtml = contentRef.current?.innerHTML ?? pages[pageIndex] ?? "";

    // Caught here as well as in the agent, so an empty page answers instantly
    // instead of going all the way to the model to be told the same thing.
    // pageIsEmpty only looks at text, and a page that is nothing but a pasted
    // screenshot is very much worth converting - hence the second half.
    if (pageIsEmpty(pageHtml) && !/<img\b/i.test(pageHtml)) {
      showLatex(null);
      setLatexError("There is nothing on this page to convert.");
      return;
    }

    const job = ++latexJobRef.current;
    const entryId = activeNote.id;
    const index = pageIndex;

    setLatexBusy(true);
    setLatexError(null);
    try {
      const res = await fetch(`${AGENT_URL}/latex`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          html: pageHtml,
          title: activeNote.title,
          page: pageIndex + 1,
          page_count: pageCount,
        }),
      });

      // FastAPI puts the readable half of a failure in `detail` - an empty
      // page, a page too long - so it is worth showing instead of "failed".
      const body = await res.json().catch(() => null);
      if (!res.ok) throw new Error(body?.detail ?? "");

      // A page turned while this was in flight, or a second conversion started:
      // either way the answer is for a pane that has moved on.
      if (latexJobRef.current !== job) return;

      showLatex({
        source: body.latex,
        // The PDF becomes a blob here rather than in the pane: whoever makes
        // one of these owns revoking it, and that is showLatex.
        pdfUrl: body.pdf ? pdfObjectUrl(body.pdf) : null,
        pdfError: body.pdf_error ?? null,
        // Just made, from the page as it stands: nothing to date, nothing stale.
        madeAt: null,
        stale: false,
      });

      // Keep it. A conversion costs a call to Claude and a compile, and this
      // page will be opened again - see the Notebook's /latex routes.
      storeLatex(entryId, index, {
        source: body.latex,
        pdf: body.pdf ?? null,
        page_hash: pageFingerprint(pageHtml),
      });
    } catch (error) {
      setLatexError(
        (error as Error).message ||
          "Could not convert this page. Is the agent service running?",
      );
    } finally {
      setLatexBusy(false);
    }
  }

  async function deleteNote(id: number) {
    setError(null);
    if (titleTimerRef.current) {
      clearTimeout(titleTimerRef.current);
      titleTimerRef.current = null;
    }
    if (contentTimerRef.current) {
      clearTimeout(contentTimerRef.current);
      contentTimerRef.current = null;
    }

    
    try {
      const res = await fetch(`${API_URL}${NOTEBOOK_PATH}/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error();

      setNotes((prev) => prev.filter((note) => note.id !== id));
      if (activeNoteId === id) setActiveNoteId(null);
    } catch {
      setError("Could not delete that entry.");
    }
  }

  function goBackToList() {
    if (activeNote) flushPending(activeNote.id);
    setActiveNoteId(null);
  }

  // ###########################################################################
  //                              DETAIL VIEW
  // ###########################################################################

  if (activeNote) {
    return (
      <NotebookEditor
        note={activeNote}
        error={error}
        contentRef={contentRef}
        contentIsEmpty={contentIsEmpty}
        pageIndex={pageIndex}
        pageCount={pageCount}
        latex={latex}
        latexBusy={latexBusy}
        latexError={latexError}
        onTransformLatex={transformToLatex}
        onBack={goBackToList}
        onDelete={deleteNote}
        onTitleChange={handleTitleChange}
        onCoverChange={handleCoverChange}
        onContentInput={handleContentInput}
        onGoToPage={goToPage}
        onAddPage={addPage}
        onDeletePage={deletePage}
      />
    );
  }

  // ###########################################################################
  //                               LIST VIEW
  // ###########################################################################

  return (
    <section className="flex-1 overflow-y-auto p-6">
      <div className="mx-auto flex w-full max-w-5xl flex-col pt-10">
        {/* Greeting: a quiet prompt above a heading that carries the weight */}
        <header>
          <p className="text-sm text-ob-slate">Ready to start writing?</p>
          <h2 className="mt-1 text-3xl font-bold tracking-tight text-white">
            Your Notebook
          </h2>
        </header>

        {/* No section label above the row - the heading already said what this
            is, and the only thing here that does anything is the new-entry button */}
        <div className="mt-8 flex items-center justify-end">
          <button
            type="button"
            onClick={createNote}
            className="rounded-md p-1.5 text-ob-slate transition hover:bg-ob-raised hover:text-ob-mist focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ob-line"
            aria-label="New entry"
            title="New entry"
          >
            <FilePlus aria-hidden="true" size={19} strokeWidth={1.8} />
          </button>
        </div>

        {error && <p className="mt-3 text-xs text-red-400">{error}</p>}

        {!loading && sortedNotes.length === 0 ? (
          <button
            type="button"
            onClick={createNote}
            className="mt-4 flex h-[300px] w-[210px] shrink-0 flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-ob-line text-ob-slate transition hover:border-ob-mist hover:text-ob-mist"
          >
            <Plus aria-hidden="true" size={22} strokeWidth={1.8} />
            <span className="text-sm">New entry</span>
          </button>
        ) : (
          /*
           * One horizontal row rather than a wrapping grid: entries stay on a
           * single line ordered by recency, so the newest is always in the same
           * place. The scrollbar is styled rather than hidden, since with no
           * arrows it is the only cue that there is more to the right.
           */
          <div
            className="mt-4 flex gap-3 overflow-x-auto pb-3
                       [&::-webkit-scrollbar]:h-1.5
                       [&::-webkit-scrollbar-track]:rounded-full
                       [&::-webkit-scrollbar-track]:bg-ob-raised/50
                       [&::-webkit-scrollbar-thumb]:rounded-full
                       [&::-webkit-scrollbar-thumb]:bg-ob-line
                       hover:[&::-webkit-scrollbar-thumb]:bg-ob-slate"
          >
            {sortedNotes.map((note) => {
              const cover = coverSrc(note.cover);
              return (
                <article
                  key={note.id}
                  onClick={() => openNote(note.id)}
                  className="group relative flex h-[300px] w-[210px] shrink-0 cursor-pointer flex-col overflow-hidden rounded-xl border border-ob-line/60 bg-ob-surface transition hover:border-ob-line hover:bg-ob-raised/40"
                >
                  {/* A covered entry reads as the object itself: the art fills
                      the card and the title sits on it, under a scrim dark
                      enough to carry white text over any of the covers. */}
                  {cover && (
                    <>
                      <img
                        src={cover}
                        alt=""
                        className="absolute inset-0 h-full w-full object-cover"
                        draggable={false}
                      />
                      <span className="absolute inset-0 bg-linear-to-t from-black/90 via-black/40 to-black/5" />
                    </>
                  )}

                  <button
                    type="button"
                    onClick={(event) => {
                      event.stopPropagation();
                      deleteNote(note.id);
                    }}
                    className="absolute right-2 top-2 z-10 rounded-md bg-ob-base/60 p-1.5 text-ob-slate opacity-0 transition hover:bg-ob-raised hover:text-red-400 group-hover:opacity-100 focus-visible:opacity-100"
                    aria-label="Delete entry"
                  >
                    <Trash2 aria-hidden="true" size={15} />
                  </button>

                  {/* With a cover the text drops to the foot of the card; without
                      one the preview does the work of showing what is inside. */}
                  <div
                    className={`relative flex min-h-0 flex-1 flex-col p-4 ${
                      cover ? "justify-end" : ""
                    }`}
                  >
                    {/* min-h-0 lets the preview shrink so the date keeps its slot */}
                    <div className={cover ? "shrink-0" : "min-h-0 flex-1"}>
                      <p className="line-clamp-2 pr-6 font-semibold leading-snug text-white">
                        {note.title.trim() || "Untitled"}
                      </p>
                      {!cover && (
                        <p className="mt-2 line-clamp-[9] text-[13px] leading-[1.5] text-ob-slate">
                          {previewText(note.content) || "No content yet"}
                        </p>
                      )}
                    </div>

                    <p
                      className={`mt-3 shrink-0 text-xs ${
                        cover ? "text-white/70" : "text-ob-slate/70"
                      }`}
                    >
                      {formatCardDate(note.updated_at)}
                    </p>
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </div>
    </section>
  );
}
