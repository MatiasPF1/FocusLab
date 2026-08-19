"use client";

import type { RefObject } from "react";
import { ArrowLeft, Trash2 } from "lucide-react";
import FormatPopup from "../Editor_Components/FormatPopup";
import ImageResizer from "../Editor_Components/ImageResizer";
import { EDITOR_PROSE } from "../Editor_Components/formatting";

// A note as returned by the backend's /notes endpoints.
export type Note = {
  id: number;
  title: string;
  content: string; // HTML, edited via document.execCommand
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

type NoteEditorProps = {
  note: Note;
  error: string | null;
  // The body is uncontrolled (imperative innerHTML), so the owner keeps the ref
  // and re-syncs it only when the open note changes.
  contentRef: RefObject<HTMLDivElement | null>;
  contentIsEmpty: boolean;
  onBack: () => void;
  onDelete: (id: number) => void;
  onTitleChange: (id: number, title: string) => void;
  onContentInput: () => void;
};

export default function NoteEditor({
  note,
  error,
  contentRef,
  contentIsEmpty,
  onBack,
  onDelete,
  onTitleChange,
  onContentInput,
}: NoteEditorProps) {
  return (
    <section className="flex-1 overflow-y-auto p-6">
      <div className="mx-auto flex w-full max-w-3xl flex-col gap-1 pt-6">
        <div className="flex items-center justify-between">
          <button
            type="button"
            onClick={onBack}
            className="flex items-center gap-1.5 rounded-md px-2 py-1 text-sm text-ob-slate transition hover:bg-ob-raised hover:text-ob-mist"
          >
            <ArrowLeft aria-hidden="true" size={16} />
            Notes
          </button>
          <button
            type="button"
            onClick={() => onDelete(note.id)}
            className="flex items-center gap-1.5 rounded-md px-2 py-1 text-sm text-ob-slate transition hover:bg-ob-raised hover:text-red-400"
          >
            <Trash2 aria-hidden="true" size={15} />
            Delete
          </button>
        </div>

        {error && <p className="mt-3 text-xs text-red-400">{error}</p>}

        <p className="mt-4 text-xs text-ob-slate">
          Last edited on {formatFullDate(note.updated_at)}
        </p>

        <input
          type="text"
          value={note.title}
          onChange={(event) => onTitleChange(note.id, event.target.value)}
          placeholder="Untitled"
          className="mt-4 w-full bg-transparent text-4xl font-bold text-ob-mist outline-none placeholder:text-ob-slate/50"
        />

        {/* Select text for the formatting popup, click an image to resize it. */}
        <FormatPopup editorRef={contentRef} onFormat={onContentInput} />
        <ImageResizer editorRef={contentRef} onResize={onContentInput} />

        <div className="relative mt-6 pb-16">
          {contentIsEmpty && (
            <p className="pointer-events-none absolute left-0 top-0 text-ob-slate/50">
              Write something...
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
    </section>
  );
}
