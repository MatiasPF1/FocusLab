"use client";

import { createContext, useContext, useEffect, useState } from "react";
import { useSpotifyWebPlayer } from "./(1.1)Home/useSpotifyWebPlayer";

const API_URL = process.env.NEXT_PUBLIC_API_URL;

type SpotifyPlayerContextValue = {
  connected: boolean | null;
  deviceId: string | null;
  playerError: string | null;
  waitForDevice: (timeoutMs?: number) => Promise<string | null>;
  activatePlayer: () => void;
};

const SpotifyPlayerContext = createContext<SpotifyPlayerContextValue | null>(
  null,
);

/*
 * Mounted once by AppShell rather than by the Home page, so the Spotify Web
 * Playback SDK player survives navigating to Notebook, To-Do, and back.
 *
 * It used to live inside PlaylistSection, which only renders on Home. Leaving
 * Home unmounted PlaylistSection, which tore the player down completely —
 * disconnecting FocusLab as a Spotify Connect device and stopping playback,
 * simply because you switched pages. Owning the connection at the shell level
 * fixes that: the player now only disconnects when the tab itself closes.
 */
export function SpotifyPlayerProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const [connected, setConnected] = useState<boolean | null>(null);

  // Checked once per session, here rather than in Home, for the same reason.
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

    return () => {
      cancelled = true;
    };
  }, []);

  const { deviceId, playerError, waitForDevice, activatePlayer } =
    useSpotifyWebPlayer(connected === true);

  return (
    <SpotifyPlayerContext.Provider
      value={{ connected, deviceId, playerError, waitForDevice, activatePlayer }}
    >
      {children}
    </SpotifyPlayerContext.Provider>
  );
}

// Throws rather than silently returning undefined, so a future page that
// forgets AppShell fails loudly during development instead of at click time.
export function useSpotifyPlayerContext() {
  const context = useContext(SpotifyPlayerContext);
  if (!context) {
    throw new Error(
      "useSpotifyPlayerContext must be used within SpotifyPlayerProvider",
    );
  }
  return context;
}
