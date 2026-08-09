"use client";

import { Plus, Music2 } from "lucide-react";

// Placeholder UI only — Spotify API wiring (auth, search, queue playback) comes later.
export default function PlaylistSection() {
  function handleAddQueue() {
    // TODO: wire up Spotify API to add a playlist/queue here.
  }

  return (
    <div className="mt-6 bg-stone-900/60 border border-stone-800 rounded-2xl p-6 flex flex-col w-full">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold text-stone-100">Playlists:</h3>
        <button
          onClick={handleAddQueue}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold bg-indigo-400 text-stone-950 hover:bg-indigo-300 transition-colors"
        >
          <Plus size={14} />
          Add Queue
        </button>
      </div>

      <div className="mt-4 flex flex-col items-center justify-center py-8 text-stone-500 text-sm gap-2">
        <Music2 size={24} className="text-stone-600" />
        No queues added yet.
      </div>
    </div>
  );
}
