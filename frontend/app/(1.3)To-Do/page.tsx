"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Plus, Trash2 } from "lucide-react";
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
      <div className="mx-auto flex w-full max-w-5xl flex-col gap-6 pt-10">
        <header>
          <h2 className="text-4xl font-bold text-ob-mist">To-Do</h2>
          <p className="mt-2 text-sm text-ob-slate">
            Keep quick notes close while you work.
          </p>
        </header>

        {error && <p className="text-xs text-red-400">{error}</p>}

        <button
          type="button"
          onClick={createNote}
          className="flex min-h-12 w-full items-center justify-center gap-2 rounded-md bg-[#4ac96b] px-5 py-3 text-lg font-medium text-[#101713] shadow-sm transition hover:bg-[#58d476] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#4ac96b] active:scale-[0.995]"
        >
          <Plus aria-hidden="true" size={21} strokeWidth={2} />
          Note
        </button>

        {!loading && sortedNotes.length === 0 ? (
          <p className="py-10 text-center text-sm text-ob-slate">
            No notes yet — add one above.
          </p>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {sortedNotes.map((note) => (
              <article
                key={note.id}
                onClick={() => setActiveNoteId(note.id)}
                className="group relative flex min-h-32 cursor-pointer flex-col justify-between gap-3 rounded-xl border border-ob-line/60 bg-ob-surface p-4 transition hover:border-ob-line"
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

                <div className="min-w-0">
                  <p className="truncate pr-6 font-semibold text-ob-mist">
                    {note.title.trim() || "Untitled"}
                  </p>
                  <p className="mt-2 line-clamp-4 text-sm leading-6 text-ob-slate">
                    {previewText(note.content) || "No content yet"}
                  </p>
                </div>

                <p className="text-xs text-ob-slate/70">
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
