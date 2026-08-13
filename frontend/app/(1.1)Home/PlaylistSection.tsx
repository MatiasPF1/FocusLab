"use client";

import { useEffect, useState } from "react";
import {
  Plus,
  Music2,
  ListMusic,
  Trash2,
  Search,
  X,
  ChevronRight,
  Play,
  Pause,
  SkipBack,
  SkipForward,
} from "lucide-react";

import { useSpotifyWebPlayer } from "./useSpotifyWebPlayer";

const API_URL = process.env.NEXT_PUBLIC_API_URL;

// A queue as returned by the backend's /queues endpoints.
type Queue = {
  id: number;
  name: string;
  created_at: string;
};

// A song already saved inside a queue.
type QueueTrack = {
  id: number;
  queue_id: number;
  track_uri: string;
  track_name: string;
  artist_name: string;
  position: number;
};

// A Spotify search hit, before it is added to a queue.
type SearchResult = {
  track_uri: string;
  track_name: string;
  artist_name: string;
  image_url: string | null;
};

// What Spotify is doing right now, used to drive the player controls.
type PlayerState = {
  is_playing: boolean;
  track_uri: string | null;
  track_name: string | null;
  artist_name: string | null;
  image_url: string | null;
  device_name: string | null;
};

// One entry from the account's real Spotify listening history.
type RecentlyPlayedTrack = {
  track_uri: string;
  track_name: string;
  artist_name: string;
};

export default function PlaylistSection() {
  const [connected, setConnected] = useState<boolean | null>(null);
  const [queues, setQueues] = useState<Queue[]>([]);
  const [error, setError] = useState<string | null>(null);

  // Creating a new queue
  const [adding, setAdding] = useState(false);
  const [newName, setNewName] = useState("");
  const [saving, setSaving] = useState(false);

  // The queue whose songs are currently shown, plus that queue's songs.
  const [openQueueId, setOpenQueueId] = useState<number | null>(null);
  const [tracks, setTracks] = useState<QueueTrack[]>([]);

  // Searching Spotify for a song to add to the open queue
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [searching, setSearching] = useState(false);

  // What Spotify is currently playing
  const [player, setPlayer] = useState<PlayerState | null>(null);

  // The account's real listening history, shown underneath the queue list.
  const [recentlyPlayed, setRecentlyPlayed] = useState<RecentlyPlayedTrack[]>([]);

  /*
   * Registers this tab as a Spotify device, so music plays out of FocusLab and
   * the Spotify app never has to be open. Only worth starting once we know the
   * account is actually linked.
   */
  const {
    deviceId: webPlayerId,
    playerError,
    waitForDevice,
    activatePlayer,
  } = useSpotifyWebPlayer(connected === true);

  // On mount: check the Spotify connection and load existing queues.
  useEffect(() => {
    let cancelled = false;

    fetch(`${API_URL}/spotify/status`)
      .then((res) => res.json())
      .then((data) => {
        if (!cancelled) setConnected(Boolean(data.connected));
      })
      .catch(() => {
        if (!cancelled) setConnected(false);
      });

    fetch(`${API_URL}/queues`)
      .then((res) => res.json())
      .then((data) => {
        if (!cancelled) setQueues(data);
      })
      .catch(() => {
        if (!cancelled) setError("Could not load queues.");
      });

    return () => {
      cancelled = true;
    };
  }, []);

  /*
   * Keep the Now Playing card in step with Spotify. This runs for the whole
   * panel, not just while a queue is open, since the card sits above the
   * queue list and stays visible whichever queue (if any) is expanded.
   */
  useEffect(() => {
    if (connected !== true) return;

    let cancelled = false;

    async function refreshPlayer() {
      try {
        const res = await fetch(`${API_URL}/spotify/player`);
        if (!res.ok) throw new Error();

        const data = await res.json();
        if (!cancelled) setPlayer(data);
      } catch {
        // A failed poll is not worth an error message, the next one may work.
      }
    }

    refreshPlayer();
    // Playback can also be changed from the phone or desktop app, so keep checking.
    const timer = setInterval(refreshPlayer, 5000);

    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, [connected]);

  /*
   * Load the account's real listening history once, after we know Spotify is
   * connected. Older connections made before this feature existed will not
   * have granted the recently-played scope yet, so a failure here just means
   * an empty list rather than an error worth showing.
   */
  useEffect(() => {
    if (connected !== true) return;

    let cancelled = false;

    fetch(`${API_URL}/spotify/recently-played`)
      .then((res) => (res.ok ? res.json() : []))
      .then((data) => {
        if (!cancelled) setRecentlyPlayed(data);
      })
      .catch(() => {
        // Silent: this list is a nice-to-have, not core functionality.
      });

    return () => {
      cancelled = true;
    };
  }, [connected]);

  function handleConnectSpotify() {
    window.location.href = `${API_URL}/spotify/login`;
  }

  /*
   * Aims a command at this tab's own player once it is ready, so the music comes
   * out of FocusLab rather than some other Spotify app that happens to be open.
   * Before it is ready the backend picks a device itself.
   */
  async function withDevice(path: string) {
    /*
     * Pressing play seconds after the page loads used to arrive before the
     * player had connected, which sent no device at all and produced a "no
     * device found" error. Waiting the couple of seconds out is what the user
     * would do anyway, so do it for them.
     */
    const targetId = webPlayerId ?? (await waitForDevice());
    if (!targetId) return path;

    const separator = path.includes("?") ? "&" : "?";
    return `${path}${separator}device_id=${targetId}`;
  }

  /*
   * Every playback button goes through here so they all report Spotify's own
   * reason for failing, such as there being no active device to play on.
   */
  async function playerCommand(path: string, method: string) {
    setError(null);
    /*
     * Every playback button lands here from a real click, which is the only
     * moment the browser will let the player unlock its audio. It has to happen
     * before the first await, while the gesture is still in progress.
     */
    activatePlayer();

    try {
      const res = await fetch(`${API_URL}${await withDevice(path)}`, { method });
      /*
       * 409 means Spotify was already in the state we asked for, which happens
       * whenever the five-second poll lags behind reality. Re-reading the state
       * below is the whole fix, so it is not worth showing as an error.
       */
      if (!res.ok && res.status !== 409) {
        const body = await res.json().catch(() => null);
        throw new Error(body?.detail ?? "");
      }

      // Spotify needs a moment before it reports the new state back.
      setTimeout(async () => {
        try {
          const stateRes = await fetch(`${API_URL}/spotify/player`);
          if (stateRes.ok) setPlayer(await stateRes.json());
        } catch {
          // Ignore, the interval poll will catch up.
        }
      }, 700);
    } catch (commandError) {
      setError(
        commandError instanceof Error && commandError.message
          ? commandError.message
          : "That playback command failed.",
      );
    }
  }

  // Starts the whole queue on Spotify, beginning at the chosen song.
  function playQueue(position: number) {
    if (openQueueId === null) return;
    playerCommand(`/queues/${openQueueId}/play?position=${position}`, "POST");
  }

  /*
   * The Now Playing card's button only renders once player.track_name exists
   * (see the JSX below), so by the time this can be clicked Spotify always has
   * a track loaded — either playing or paused. That makes the choice a plain
   * pause/resume with no "what should play" ambiguity to resolve here.
   * Starting a specific song from scratch is instead done by clicking that
   * song's row inside an expanded queue, which calls playQueue directly.
   */
  function toggleGlobalPlayback() {
    if (player?.is_playing) {
      playerCommand("/spotify/pause", "PUT");
    } else {
      playerCommand("/spotify/resume", "PUT");
    }
  }

  async function createQueue() {
    const name = newName.trim();
    // Same rule the backend enforces: no blank names.
    if (!name) return;

    setSaving(true);
    setError(null);

    try {
      const res = await fetch(`${API_URL}/queues`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name }),
      });
      if (!res.ok) throw new Error();

      const created: Queue = await res.json();
      // Newest first, matching the order the backend lists them in.
      setQueues((current) => [created, ...current]);
      setAdding(false);
      setNewName("");
    } catch {
      setError("Could not create that queue.");
    } finally {
      setSaving(false);
    }
  }

  async function deleteQueue(id: number) {
    setError(null);
    try {
      const res = await fetch(`${API_URL}/queues/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error();

      setQueues((current) => current.filter((queue) => queue.id !== id));
      // If the queue being shown was the one deleted, close the panel.
      if (openQueueId === id) setOpenQueueId(null);
    } catch {
      setError("Could not delete that queue.");
    }
  }

  // Clicking a queue opens its songs, clicking it again closes them.
  async function toggleQueue(id: number) {
    if (openQueueId === id) {
      setOpenQueueId(null);
      return;
    }

    setOpenQueueId(id);
    // Old results belong to the previous queue, clear them before loading.
    setTracks([]);
    setResults([]);
    setQuery("");
    setError(null);

    try {
      const res = await fetch(`${API_URL}/queues/${id}`);
      if (!res.ok) throw new Error();

      const data = await res.json();
      setTracks(data.tracks);
    } catch {
      setError("Could not load that queue's songs.");
    }
  }

  async function searchSpotify() {
    const q = query.trim();
    if (!q) return;

    setSearching(true);
    setError(null);

    try {
        const res = await fetch(
            `${API_URL}/spotify/search?q=${encodeURIComponent(q)}&limit=10`,
      );
      if (!res.ok) throw new Error();

      setResults(await res.json());
    } catch {
      setError("Spotify search failed.");
    } finally {
      setSearching(false);
    }
  }

  async function addTrack(result: SearchResult) {
    if (openQueueId === null) return;
    setError(null);

    try {
      const res = await fetch(`${API_URL}/queues/${openQueueId}/tracks`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          track_uri: result.track_uri,
          track_name: result.track_name,
          artist_name: result.artist_name,
        }),
      });
      if (!res.ok) throw new Error();

      // The backend decides the position, so trust what it sends back.
      const created: QueueTrack = await res.json();
      setTracks((current) => [...current, created]);
    } catch {
      setError("Could not add that song.");
    }
  }

  async function removeTrack(trackId: number) {
    if (openQueueId === null) return;
    setError(null);

    try {
      const res = await fetch(
        `${API_URL}/queues/${openQueueId}/tracks/${trackId}`,
        { method: "DELETE" },
      );
      if (!res.ok) throw new Error();

      // The backend closes the gap in positions, so renumber locally to match.
      setTracks((current) =>
        current
          .filter((track) => track.id !== trackId)
          .map((track, index) => ({ ...track, position: index + 1 })),
      );
    } catch {
      setError("Could not remove that song.");
    }
  }

  return (
    <div className="bg-ob-surface border border-ob-line/60 rounded-2xl p-6 flex flex-col w-full text-left">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold text-ob-mist">Queues</h3>
        {connected ? (
          <ListMusic size={16} className="text-ob-slate" aria-hidden="true" />
        ) : (
          <button
            onClick={handleConnectSpotify}
            disabled={connected === null}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold bg-green-500 text-ob-void hover:bg-green-400 transition-colors disabled:opacity-50"
          >
            Connect Spotify
          </button>
        )}
      </div>

      {/* A failed command matters more than a player that never started */}
      {(error || playerError) && (
        <p className="mt-3 text-xs text-red-400">{error ?? playerError}</p>
      )}

      {/* Says why playing is not possible for the first few seconds after load */}
      {connected && !webPlayerId && !playerError && (
        <p className="mt-3 text-xs text-ob-slate">
          Starting the FocusLab player...
        </p>
      )}

      {/*
        Now Playing: global, not scoped to whichever queue is expanded (or
        whether one is expanded at all), since Spotify's own playback state
        is a single thing regardless of which queue panel is open here.
      */}
      {player?.track_name && (
        <div className="mt-4 bg-ob-base border border-ob-line/60 rounded-xl p-3 flex items-center gap-3">
          {player.image_url ? (
            <img
              src={player.image_url}
              alt=""
              className="w-12 h-12 rounded-lg object-cover shrink-0"
            />
          ) : (
            <div className="w-12 h-12 rounded-lg bg-ob-raised flex items-center justify-center shrink-0">
              <Music2 size={18} className="text-ob-slate" />
            </div>
          )}
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold text-ob-mist truncate">
              {player.track_name}
            </p>
            <p className="text-xs text-ob-slate truncate">
              {player.artist_name}
              {player.device_name ? ` · ${player.device_name}` : ""}
            </p>
            {/* Decorative only: there is no progress data to show, just that audio is flowing */}
            {player.is_playing && (
              <div className="flex items-end gap-0.5 h-2.5 mt-1.5" aria-hidden="true">
                <span className="w-0.5 h-full bg-ob-slate animate-pulse" />
                <span className="w-0.5 h-1.5 bg-ob-slate animate-pulse [animation-delay:150ms]" />
                <span className="w-0.5 h-2.5 bg-ob-slate animate-pulse [animation-delay:300ms]" />
              </div>
            )}
          </div>
          <div className="flex items-center gap-3 shrink-0">
            <button
              onClick={() => playerCommand("/spotify/previous", "POST")}
              aria-label="Previous song"
              className="text-ob-slate hover:text-ob-mist transition-colors"
            >
              <SkipBack size={15} />
            </button>
            <button
              onClick={toggleGlobalPlayback}
              aria-label={player.is_playing ? "Pause" : "Play"}
              className="flex items-center justify-center w-8 h-8 rounded-full bg-ob-mist text-ob-void hover:bg-white transition-colors"
            >
              {player.is_playing ? (
                <Pause size={14} fill="currentColor" />
              ) : (
                <Play size={14} fill="currentColor" />
              )}
            </button>
            <button
              onClick={() => playerCommand("/spotify/next", "POST")}
              aria-label="Next song"
              className="text-ob-slate hover:text-ob-mist transition-colors"
            >
              <SkipForward size={15} />
            </button>
          </div>
        </div>
      )}

      {queues.length > 0 && (
        <ul className="mt-4 flex flex-col gap-2">
          {queues.map((queue) => (
            <li
              key={queue.id}
              className="bg-ob-base/60 border border-ob-line/60 rounded-xl overflow-hidden"
            >
              <div className="group flex items-center gap-3 px-3 py-2.5 hover:bg-ob-raised/50 transition-colors">
                {/* The whole row is the click target, so the queue is obviously openable */}
                <button
                  onClick={() => toggleQueue(queue.id)}
                  aria-expanded={openQueueId === queue.id}
                  className="flex flex-1 items-center gap-3 min-w-0 text-sm text-ob-mist hover:text-white transition-colors"
                >
                  <span className="w-8 h-8 rounded-lg bg-ob-raised flex items-center justify-center shrink-0">
                    <Music2 size={14} className="text-ob-slate" />
                  </span>
                  <span className="truncate font-medium">{queue.name}</span>
                </button>
                <button
                  onClick={() => deleteQueue(queue.id)}
                  aria-label={`Delete ${queue.name}`}
                  className="text-ob-slate opacity-0 group-hover:opacity-100 hover:text-red-400 transition-all shrink-0"
                >
                  <Trash2 size={14} />
                </button>
                {/* Chevron points right when closed, down when open */}
                <ChevronRight
                  size={14}
                  className={`text-ob-slate shrink-0 transition-transform ${
                    openQueueId === queue.id ? "rotate-90" : ""
                  }`}
                />
              </div>

              {/* Songs and the Spotify search box for the queue that is open */}
              {openQueueId === queue.id && (
                <div className="border-t border-ob-line/60 px-4 py-3 flex flex-col gap-3">
                  {tracks.length > 0 ? (
                    <ul className="flex flex-col gap-1">
                      {tracks.map((track) => (
                        <li
                          key={track.id}
                          className="group/track flex items-center justify-between text-sm text-ob-mist py-1"
                        >
                          {/* The row number turns into a play button on hover */}
                          <button
                            onClick={() => playQueue(track.position)}
                            aria-label={`Play ${track.track_name}`}
                            className="flex items-center gap-2 min-w-0 text-left"
                          >
                            <span className="w-4 shrink-0 flex justify-end">
                              <span className="text-ob-slate tabular-nums group-hover/track:hidden">
                                {track.position}
                              </span>
                              <Play
                                size={12}
                                className="hidden group-hover/track:block text-ob-mist"
                              />
                            </span>
                            <span
                              className={`truncate ${
                                player?.track_uri === track.track_uri
                                  ? "text-ob-mist"
                                  : ""
                              }`}
                            >
                              {track.track_name}
                              <span className="text-ob-slate">
                                {" "}
                                — {track.artist_name}
                              </span>
                            </span>
                          </button>
                          <button
                            onClick={() => removeTrack(track.id)}
                            aria-label={`Remove ${track.track_name} from this queue permanently`}
                            title="Remove from queue permanently"
                            className="text-ob-slate opacity-0 group-hover/track:opacity-100 hover:text-red-400 transition-all shrink-0 ml-2"
                          >
                            <X size={14} />
                          </button>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="text-xs text-ob-slate">
                      No songs in this queue yet.
                    </p>
                  )}

                  <div className="flex items-center gap-2">
                    <input
                      value={query}
                      onChange={(event) => setQuery(event.target.value)}
                      onKeyDown={(event) => {
                        if (event.key === "Enter") searchSpotify();
                      }}
                      placeholder="Search Spotify for a song"
                      className="flex-1 bg-ob-base border border-ob-line rounded-lg px-3 py-1.5 text-sm text-ob-mist placeholder:text-ob-slate focus:outline-none focus:border-ob-slate"
                    />
                    <button
                      onClick={searchSpotify}
                      disabled={searching || !query.trim()}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-ob-raised text-ob-mist hover:bg-ob-line transition-colors disabled:opacity-50"
                    >
                      <Search size={13} />
                      {searching ? "..." : "Search"}
                    </button>
                  </div>

                  {/* Clicking a result appends it to the open queue */}
                  {results.length > 0 && (
                    <ul className="flex flex-col gap-1 max-h-56 overflow-y-auto">
                      {results.map((result) => (
                        <li key={result.track_uri}>
                          <button
                            onClick={() => addTrack(result)}
                            className="w-full flex items-center gap-2 text-left px-2 py-1.5 rounded-lg hover:bg-ob-raised/70 transition-colors"
                          >
                            <Plus size={13} className="text-ob-mist shrink-0" />
                            <span className="text-sm text-ob-mist truncate">
                              {result.track_name}
                              <span className="text-ob-slate">
                                {" "}
                                — {result.artist_name}
                              </span>
                            </span>
                          </button>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              )}
            </li>
          ))}
        </ul>
      )}

      {/*
        The primary "create" action lives here rather than in the header, so it
        also anchors the panel when there are no queues yet instead of leaving
        an empty space above a lone header icon.
      */}
      {connected &&
        (adding ? (
          <div className="mt-3 flex items-center gap-2">
            <input
              autoFocus
              value={newName}
              onChange={(event) => setNewName(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter") createQueue();
                if (event.key === "Escape") setAdding(false);
              }}
              placeholder="Queue name"
              className="flex-1 bg-ob-base border border-ob-line rounded-lg px-3 py-1.5 text-sm text-ob-mist placeholder:text-ob-slate focus:outline-none focus:border-ob-slate"
            />
            <button
              onClick={createQueue}
              disabled={saving || !newName.trim()}
              className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-ob-mist text-ob-void hover:bg-white transition-colors disabled:opacity-50"
            >
              {saving ? "Saving..." : "Save"}
            </button>
            <button
              onClick={() => setAdding(false)}
              className="px-3 py-1.5 rounded-lg text-xs font-semibold text-ob-slate hover:text-ob-mist transition-colors"
            >
              Cancel
            </button>
          </div>
        ) : (
          <button
            onClick={() => {
              setError(null);
              setNewName("");
              setAdding(true);
            }}
            className="mt-3 flex items-center gap-2 px-3 py-2.5 rounded-xl border border-dashed border-ob-line text-ob-slate hover:text-ob-mist hover:border-ob-slate transition-colors text-sm"
          >
            <Plus size={14} />
            Create New Queue
          </button>
        ))}

      {!connected && queues.length === 0 && (
        <p className="mt-4 text-xs text-ob-slate text-center py-4">
          Connect Spotify to start adding queues.
        </p>
      )}

      {/* The account's real listening history, independent of any saved queue */}
      {recentlyPlayed.length > 0 && (
        <div className="mt-6">
          <h4 className="text-[11px] font-semibold text-ob-slate tracking-[0.2em]">
            RECENTLY PLAYED
          </h4>
          <ul className="mt-2.5 flex flex-col gap-1.5">
            {recentlyPlayed.map((track) => (
              <li
                key={track.track_uri}
                className="flex items-center gap-2 text-sm text-ob-slate min-w-0"
              >
                <span className="w-1 h-1 rounded-full bg-ob-slate shrink-0" />
                <span className="truncate">
                  <span className="text-ob-mist">{track.track_name}</span>
                  {" — "}
                  {track.artist_name}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
