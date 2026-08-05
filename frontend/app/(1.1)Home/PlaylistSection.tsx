"use client";

import { Plus, Music2 } from "lucide-react";

// Placeholder UI only — Spotify API wiring (auth, search, queue playback) comes later.
export default function PlaylistSection() {
  function handleAddQueue() {
    // TODO: wire up Spotify API to add a playlist/queue here.
  }

  return (
    <div className="mt-6 bg-white/5 border border-white/10 rounded-2xl p-6 flex flex-col w-full">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold">Playlists:</h3>
        <button
          onClick={handleAddQueue}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold bg-indigo-500 text-white hover:bg-indigo-400 transition-colors"
        >
          <Plus size={14} />
          Add Queue
        </button>
      </div>

      <div className="mt-4 flex flex-col items-center justify-center py-8 text-white/40 text-sm gap-2">
        <Music2 size={24} className="text-white/20" />
        No queues added yet.
      </div>
    </div>
  );
}
