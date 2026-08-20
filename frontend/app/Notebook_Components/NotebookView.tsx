"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { FilePlus, Plus, Trash2 } from "lucide-react";
import NotebookEditor, { previewText, type Note } from "./NotebookEditor";
import { coverSrc } from "./covers";
import {
  insertPageAfter,
  joinPages,
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

// The Notebook has no collection of its own on the backend yet, so this
// scaffold reads and writes the same /notes rows the To-Do page does - open
// both pages and you are looking at one set of notes twice. Point this at the
// Notebook's own route once it exists; it is the only line that has to change.
const NOTES_PATH = "/notes";

// How long to wait after the user stops typing before saving to the backend,
// so every keystroke doesn't fire its own request.
const SAVE_DEBOUNCE_MS = 600;

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

  // Debounced-save timers, one per field so editing the title doesn't reset
  // an in-flight wait on the body and vice versa.
  const titleTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const contentTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Load every entry once on mount.
  useEffect(() => {
    let cancelled = false;

    fetch(`${API_URL}${NOTES_PATH}`)
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
    const html = splitPages(activeNote.content)[pageIndex] ?? "";
    contentRef.current.innerHTML = html;
    setContentIsEmpty(previewText(html) === "");
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
    if (live === undefined) return note.content;
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
      const res = await fetch(`${API_URL}${NOTES_PATH}`, {
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
    fetch(`${API_URL}${NOTES_PATH}/${id}`, {
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
      const res = await fetch(`${API_URL}${NOTES_PATH}/${id}`, { method: "DELETE" });
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
