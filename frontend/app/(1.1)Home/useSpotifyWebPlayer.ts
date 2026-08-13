"use client";

import { useCallback, useEffect, useRef, useState } from "react";

const API_URL = process.env.NEXT_PUBLIC_API_URL;

// Spotify's official player library, which must be loaded from their own domain.
const SDK_SRC = "https://sdk.scdn.co/spotify-player.js";

// The name this player appears under in Spotify Connect, on every other device.
const PLAYER_NAME = "FocusLab";

/*
 * The SDK ships no TypeScript types of its own, and a types package would be a
 * whole dependency for the four things we touch, so describe just those here.
 */
type PlayerEvent = {
  device_id?: string;
  message?: string;
};

type SpotifyPlayer = {
  connect: () => Promise<boolean>;
  disconnect: () => void;
  activateElement: () => Promise<void>;
  addListener: (
    event: string,
    callback: (payload: PlayerEvent) => void,
  ) => boolean;
};

declare global {
  interface Window {
    Spotify?: {
      Player: new (options: {
        name: string;
        volume?: number;
        getOAuthToken: (callback: (token: string) => void) => void;
      }) => SpotifyPlayer;
    };
    // The SDK calls this the moment it has finished loading.
    onSpotifyWebPlaybackSDKReady?: () => void;
  }
}

// Every way the browser player can fail, all reported the same way.
const FAILURE_EVENTS = [
  "initialization_error",
  "authentication_error",
  "account_error",
  "playback_error",
];

/**
 * Turns this browser tab into a Spotify device.
 *
 * Spotify will only play through an app it can see, and normally that means the
 * desktop or phone app. The Web Playback SDK registers the page itself as one of
 * those apps, so FocusLab can play music without Spotify being open anywhere.
 *
 * Returns the device id to aim playback commands at, which is null until the
 * player has finished connecting.
 */
export function useSpotifyWebPlayer(enabled: boolean) {
  const [deviceId, setDeviceId] = useState<string | null>(null);
  const [playerError, setPlayerError] = useState<string | null>(null);

  // Holding the player here keeps React from building a second one on re-render.
  const playerRef = useRef<SpotifyPlayer | null>(null);

  /*
   * The same device id, kept in a ref as well as in state. waitForDevice runs
   * inside a click handler that captured an earlier render, so it cannot read
   * the state variable and see an up-to-date value. A ref is always current.
   */
  const deviceIdRef = useRef<string | null>(null);

  /**
   * Waits for the player to finish connecting, up to a few seconds.
   *
   * Connecting takes a moment after the page loads, and a click landing inside
   * that window used to fail with "no device found" — telling the user to open
   * the Spotify app, which is exactly what this player exists to avoid.
   * Returns the device id, or null if it never became ready.
   */
  /**
   * Unlocks audio so the player can actually be heard.
   *
   * Browsers refuse to let a page start sound by itself, so the SDK's audio
   * element stays locked until it is activated from inside a genuine user
   * gesture. Without this the play command succeeds, Spotify reports the track
   * as playing, and yet nothing comes out of the speakers.
   *
   * Must be called from a click handler before any await, or the browser no
   * longer counts it as part of the gesture.
   */
  const activatePlayer = useCallback(() => {
    playerRef.current?.activateElement().catch(() => {
      // Already unlocked, or the browser refused. The play attempt still runs.
    });
  }, []);

  const waitForDevice = useCallback(async (timeoutMs = 8000) => {
    const deadline = Date.now() + timeoutMs;

    while (Date.now() < deadline) {
      if (deviceIdRef.current) return deviceIdRef.current;
      await new Promise((resolve) => setTimeout(resolve, 150));
    }
    return deviceIdRef.current;
  }, []);

  useEffect(() => {
    // Nothing to connect to until the user has linked their Spotify account.
    if (!enabled) return;

    // The SDK loads asynchronously, so it can still arrive after we clean up.
    let cancelled = false;

    function startPlayer() {
      if (cancelled || playerRef.current || !window.Spotify) return;

      const player = new window.Spotify.Player({
        name: PLAYER_NAME,
        volume: 0.5,
        /*
         * Called once when connecting, and again by itself every time the token
         * expires an hour later, so this must fetch a fresh one each time rather
         * than hand back a token it remembered.
         */
        getOAuthToken: async (callback) => {
          try {
            const res = await fetch(`${API_URL}/spotify/token`);
            if (!res.ok) throw new Error();

            const data = await res.json();
            callback(data.access_token);
          } catch {
            setPlayerError("Could not get a Spotify token for this browser.");
          }
        },
      });

      // Spotify hands us the device id only once the player is really usable.
      player.addListener("ready", ({ device_id }) => {
        if (cancelled || !device_id) return;
        deviceIdRef.current = device_id;
        setDeviceId(device_id);
        setPlayerError(null);
      });

      // Fires when the player goes away, such as the computer going to sleep.
      player.addListener("not_ready", () => {
        if (cancelled) return;
        deviceIdRef.current = null;
        setDeviceId(null);
      });

      for (const failure of FAILURE_EVENTS) {
        player.addListener(failure, ({ message }) => {
          if (!cancelled) {
            setPlayerError(message ?? "The in-browser Spotify player failed.");
          }
        });
      }

      player.connect();
      playerRef.current = player;
    }

    if (window.Spotify) {
      // The script is already on the page from an earlier mount.
      startPlayer();
    } else {
      // The SDK looks for this global itself, so it has to exist before loading.
      window.onSpotifyWebPlaybackSDKReady = startPlayer;

      if (!document.querySelector(`script[src="${SDK_SRC}"]`)) {
        const script = document.createElement("script");
        script.src = SDK_SRC;
        script.async = true;
        document.body.appendChild(script);
      }
    }

    return () => {
      /*
       * Clearing the ref as well as disconnecting matters: React runs effects
       * twice in development, and a player left behind here would make the
       * second run skip building the one that actually gets used.
       */
      cancelled = true;
      playerRef.current?.disconnect();
      playerRef.current = null;
      deviceIdRef.current = null;
      setDeviceId(null);
    };
  }, [enabled]);

  return { deviceId, playerError, waitForDevice, activatePlayer };
}
