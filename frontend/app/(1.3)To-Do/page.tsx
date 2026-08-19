"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { FilePlus, Plus, Trash2 } from "lucide-react";
import NoteEditor, { previewText, type Note } from "./NoteEditor";

const API_URL = process.env.NEXT_PUBLIC_API_URL;

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

export default function ToDoPage() {
  const [notes, setNotes] = useState<Note[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeNoteId, setActiveNoteId] = useState<number | null>(null);
  const [contentIsEmpty, setContentIsEmpty] = useState(true);
  const contentRef = useRef<HTMLDivElement>(null);

  // Debounced-save timers, one per field so editing the title doesn't reset
  // an in-flight wait on the body and vice versa.
  const titleTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const contentTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Load every note once on mount.
  useEffect(() => {
    let cancelled = false;

    fetch(`${API_URL}/notes`)
      .then((res) => {
        if (!res.ok) throw new Error();
        return res.json();
      })
      .then((data) => {
        if (!cancelled) setNotes(data);
      })
      .catch(() => {
        if (!cancelled) setError("Could not load notes.");
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

  // The editable body is uncontrolled (imperative innerHTML) so typing never
  // fights React's render cycle. It only gets re-synced when the open note
  // changes, not on every keystroke.
  useEffect(() => {
    if (activeNote && contentRef.current) {
      contentRef.current.innerHTML = activeNote.content;
      setContentIsEmpty(previewText(activeNote.content) === "");
    }
  }, [activeNoteId]);

  async function createNote() {
    setError(null);
    try {
      const res = await fetch(`${API_URL}/notes`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      if (!res.ok) throw new Error();

      const created: Note = await res.json();
      setNotes((prev) => [created, ...prev]);
      setActiveNoteId(created.id);
    } catch {
      setError("Could not create a new note.");
    }
  }

  // Fire-and-forget save. Local state already reflects the edit optimistically,
  // this just persists it and reconciles updated_at once the server responds.
  function patchNote(id: number, patch: Partial<Pick<Note, "title" | "content">>) {
    fetch(`${API_URL}/notes/${id}`, {
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
      content: hadPendingContent
        ? contentRef.current?.innerHTML ?? current.content
        : current.content,
    });
  }

  function handleTitleChange(id: number, title: string) {
    setNotes((prev) => prev.map((note) => (note.id === id ? { ...note, title } : note)));

    if (titleTimerRef.current) clearTimeout(titleTimerRef.current);
    titleTimerRef.current = setTimeout(() => patchNote(id, { title }), SAVE_DEBOUNCE_MS);
  }

  function handleContentInput() {
    if (!activeNote || !contentRef.current) return;
    const html = contentRef.current.innerHTML;
    setContentIsEmpty(previewText(html) === "");
    setNotes((prev) =>
      prev.map((note) => (note.id === activeNote.id ? { ...note, content: html } : note)),
    );

    if (contentTimerRef.current) clearTimeout(contentTimerRef.current);
    const id = activeNote.id;
    contentTimerRef.current = setTimeout(
      () => patchNote(id, { content: html }),
      SAVE_DEBOUNCE_MS,
    );
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
      const res = await fetch(`${API_URL}/notes/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error();

      setNotes((prev) => prev.filter((note) => note.id !== id));
      if (activeNoteId === id) setActiveNoteId(null);
    } catch {
      setError("Could not delete that note.");
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
      <NoteEditor
        note={activeNote}
        error={error}
        contentRef={contentRef}
        contentIsEmpty={contentIsEmpty}
        onBack={goBackToList}
        onDelete={deleteNote}
        onTitleChange={handleTitleChange}
        onContentInput={handleContentInput}
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
          <p className="text-sm text-ob-slate">Ready to start taking notes?</p>
          <h2 className="mt-1 text-3xl font-bold tracking-tight text-white">
            Your Notes
          </h2>
        </header>

        {/* Section bar: label on the left, the only real action on the right */}
        <div className="mt-10 flex items-center justify-between">
          <h3 className="text-xl font-semibold text-white">Notes</h3>
          <button
            type="button"
            onClick={createNote}
            className="rounded-md p-1.5 text-ob-slate transition hover:bg-ob-raised hover:text-ob-mist focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ob-line"
            aria-label="New note"
            title="New note"
          >
            <FilePlus aria-hidden="true" size={19} strokeWidth={1.8} />
          </button>
        </div>

        {/* Sorting is always newest-first, so this reads as a label, not a control */}
        <div className="mt-3">
          <span className="inline-block rounded-full border border-ob-line bg-ob-raised/60 px-3 py-1 text-xs font-medium text-ob-mist">
            Recent
          </span>
        </div>

        {error && <p className="mt-3 text-xs text-red-400">{error}</p>}

        {!loading && sortedNotes.length === 0 ? (
          <button
            type="button"
            onClick={createNote}
            className="mt-4 flex h-[300px] w-[210px] shrink-0 flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-ob-line text-ob-slate transition hover:border-ob-mist hover:text-ob-mist"
          >
            <Plus aria-hidden="true" size={22} strokeWidth={1.8} />
            <span className="text-sm">New note</span>
          </button>
        ) : (
          /*
           * One horizontal row rather than a wrapping grid: notes stay on a
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
            {sortedNotes.map((note) => (
              <article
                key={note.id}
                onClick={() => setActiveNoteId(note.id)}
                className="group relative flex h-[300px] w-[210px] shrink-0 cursor-pointer flex-col rounded-xl border border-ob-line/60 bg-ob-surface p-4 transition hover:border-ob-line hover:bg-ob-raised/40"
              >
                <button
                  type="button"
                  onClick={(event) => {
                    event.stopPropagation();
                    deleteNote(note.id);
                  }}
                  className="absolute right-2 top-2 rounded-md p-1.5 text-ob-slate opacity-0 transition hover:bg-ob-raised hover:text-red-400 group-hover:opacity-100 focus-visible:opacity-100"
                  aria-label="Delete note"
                >
                  <Trash2 aria-hidden="true" size={15} />
                </button>

                {/* min-h-0 lets the preview shrink so the date keeps its slot */}
                <div className="min-h-0 flex-1">
                  <p className="line-clamp-2 pr-6 font-semibold leading-snug text-white">
                    {note.title.trim() || "Untitled"}
                  </p>
                  <p className="mt-2 line-clamp-[9] text-[13px] leading-[1.5] text-ob-slate">
                    {previewText(note.content) || "No content yet"}
                  </p>
                </div>

                <p className="mt-3 shrink-0 text-xs text-ob-slate/70">
                  {formatCardDate(note.updated_at)}
                </p>
              </article>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}
