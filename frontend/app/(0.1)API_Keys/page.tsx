"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

/*
 * FocusLab is being built as a DESKTOP app (one install per user, backend on
 * localhost), not a hosted web app, which is why this page asks each user for
 * their own Spotify keys instead of the app shipping a single shared set.
 *
 * Step two of the intro flow: the landing page hands off here, and this page
 * hands off to the dashboard. Each desktop install registers its own Spotify
 * app, which is what sidesteps Spotify's 25-user Development Mode allowlist -
 * every user is user #1 of their own app rather than one of 25 slots in ours.
 *
 * NOTE: saving here stores the keys but does not yet drive the Spotify
 * connection. The backend still reads its credentials from the environment
 * (see get_spotify_config in apis/spotify/core.py). Flipping that over is a
 * one-function change, described in get_stored_spotify_config in
 * apis/Retrieving_Keys/core.py.
 */

const API_URL = process.env.NEXT_PUBLIC_API_URL;

// Must match SPOTIFY_REDIRECT_URI in the backend .env exactly. Spotify stopped
// accepting "localhost" aliases in November 2025, so this is the literal
// loopback IP and cannot be written any other way.
const REDIRECT_URI = "http://127.0.0.1:8000/spotify/callback";

type KeysStatus = {
  spotify_client_id: string | null;
  spotify_client_secret_set: boolean;
  updated_at: string | null;
  active_source: "environment" | "database" | "none";
};

export default function ApiKeysPage() {
  const [clientId, setClientId] = useState("");
  const [clientSecret, setClientSecret] = useState("");
  const [status, setStatus] = useState<KeysStatus | null>(null);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // What is already stored, so a returning user sees their saved id filled in.
  useEffect(() => {
    let cancelled = false;

    fetch(`${API_URL}/keys/status`)
      .then((res) => (res.ok ? res.json() : null))
      .then((data: KeysStatus | null) => {
        if (cancelled || !data) return;
        setStatus(data);
        // The secret is deliberately never returned, so that box stays empty.
        if (data.spotify_client_id) setClientId(data.spotify_client_id);
      })
      .catch(() => {
        if (!cancelled) setError("Could not reach the FocusLab backend.");
      });

    return () => {
      cancelled = true;
    };
  }, []);

  async function saveKeys() {
    setSaving(true);
    setMessage(null);
    setError(null);
    try {
      const res = await fetch(`${API_URL}/keys`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          spotify_client_id: clientId,
          spotify_client_secret: clientSecret,
        }),
      });
      // fetch only rejects on a network failure, not on a 4xx/5xx body
      if (!res.ok) {
        const body = await res.json().catch(() => null);
        throw new Error(body?.detail ?? "Could not save those keys.");
      }
      const data: KeysStatus = await res.json();
      setStatus(data);
      // Clearing it mirrors the fact that the API will never hand it back.
      setClientSecret("");
      setMessage("Keys saved.");
    } catch (saveError) {
      setError(
        saveError instanceof Error
          ? saveError.message
          : "Could not save those keys.",
      );
    } finally {
      setSaving(false);
    }
  }

  const savedAlready = Boolean(status?.spotify_client_id);

  return (
    <main className="h-screen w-screen overflow-y-auto bg-ob-base text-ob-mist">
      <div className="mx-auto flex min-h-full max-w-2xl flex-col justify-center px-6 py-16">
        <header className="mb-8">
          <h1 className="text-3xl font-semibold text-white">
            Connect your Spotify app
          </h1>
          <p className="mt-3 text-sm leading-relaxed text-ob-slate">
            FocusLab runs on your machine, so it uses{" "}
            <span className="text-ob-mist">your own</span> Spotify credentials
            rather than a shared set. Takes about five minutes, once.
          </p>
        </header>

        {/* Setup steps - the redirect URI is the part people get wrong */}
        <ol className="mb-8 space-y-3 rounded-lg border border-ob-line bg-ob-surface p-5 text-sm text-ob-slate">
          <li>
            <span className="text-ob-mist">1.</span> Open the{" "}
            <a
              href="https://developer.spotify.com/dashboard"
              target="_blank"
              rel="noopener noreferrer"
              className="text-indigo-400 underline underline-offset-2 hover:text-indigo-300"
            >
              Spotify Developer Dashboard
            </a>{" "}
            and click <span className="text-ob-mist">Create app</span>.
          </li>
          <li>
            <span className="text-ob-mist">2.</span> Set the Redirect URI to
            exactly this, then click Add:
            <code className="mt-2 block break-all rounded bg-ob-void px-3 py-2 font-mono text-xs text-ob-mist">
              {REDIRECT_URI}
            </code>
          </li>
          <li>
            <span className="text-ob-mist">3.</span> Tick{" "}
            <span className="text-ob-mist">Web API</span> and{" "}
            <span className="text-ob-mist">Web Playback SDK</span>, then save.
          </li>
          <li>
            <span className="text-ob-mist">4.</span> Open Settings on the new
            app and copy the Client ID and Client Secret into the boxes below.
          </li>
        </ol>

        {/* The form itself */}
        <div className="space-y-4">
          <label className="block">
            <span className="mb-1.5 block text-sm text-ob-mist">Client ID</span>
            <input
              type="text"
              value={clientId}
              onChange={(event) => setClientId(event.target.value)}
              placeholder="e.g. 4f2b8c1e9a7d4f60b3e5c8a1d2f7b9e0"
              spellCheck={false}
              className="w-full rounded-md border border-ob-line bg-ob-surface px-3 py-2 font-mono text-sm text-ob-mist outline-none placeholder:text-ob-slate/60 focus:border-indigo-400"
            />
          </label>

          <label className="block">
            <span className="mb-1.5 block text-sm text-ob-mist">
              Client Secret
              {status?.spotify_client_secret_set && (
                <span className="ml-2 text-xs text-emerald-400">
                  already saved - leave blank to keep it
                </span>
              )}
            </span>
            <input
              type="password"
              value={clientSecret}
              onChange={(event) => setClientSecret(event.target.value)}
              placeholder="................................"
              spellCheck={false}
              className="w-full rounded-md border border-ob-line bg-ob-surface px-3 py-2 font-mono text-sm text-ob-mist outline-none placeholder:text-ob-slate/60 focus:border-indigo-400"
            />
          </label>

          <p className="text-xs leading-relaxed text-ob-slate">
            These are stored locally by the FocusLab backend and are never sent
            anywhere except Spotify. The secret is write-only: once saved, the
            app will not hand it back out again.
          </p>
        </div>

        {/* Result of the last save attempt */}
        {message && <p className="mt-4 text-sm text-emerald-400">{message}</p>}
        {error && <p className="mt-4 text-sm text-red-400">{error}</p>}

        {/*
          Until the backend switch described at the top of this file is flipped,
          a .env still overrides anything saved here. Saying so beats a user
          pasting correct keys and wondering why nothing changed.
        */}
        {status?.active_source === "environment" && savedAlready && (
          <p className="mt-4 rounded-md border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs text-amber-300">
            Saved, but the backend is still reading its credentials from its
            .env file, so these are not in use yet.
          </p>
        )}

        {/* Actions */}
        <div className="mt-8 flex items-center gap-3">
          <button
            type="button"
            onClick={saveKeys}
            disabled={saving}
            className="rounded-full bg-white px-6 py-2.5 text-sm font-semibold text-black transition-colors hover:bg-white/90 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {saving ? "Saving..." : "Save keys"}
          </button>

          <Link
            href="/(1.1)Home"
            className="rounded-full border border-ob-line px-6 py-2.5 text-sm text-ob-mist transition-colors hover:bg-ob-raised"
          >
            {savedAlready ? "Continue" : "Skip for now"}
          </Link>
        </div>
      </div>
    </main>
  );
}
