"use client";

import { createContext, useContext, useEffect, useState } from "react";

const PRESETS = [5, 15, 25, "custom"] as const;
const DEFAULT_MINUTES = 25;
type Preset = (typeof PRESETS)[number];

type PomodoroContextValue = {
  preset: Preset;
  customMinutes: number;
  secondsLeft: number;
  isRunning: boolean;
  sessionCount: number;
  selectPreset: (next: Preset) => void;
  handleCustomMinutesChange: (value: number) => void;
  togglePlayPause: () => void;
  skipBack: () => void;
  skipForward: () => void;
};

const PomodoroContext = createContext<PomodoroContextValue | null>(null);

/*
 * Mounted once by AppShell rather than by the Home page, for the same reason
 * SpotifyPlayerProvider is: owning the timer state at the shell level means
 * it survives navigating to Notebook, To-Do, and back, instead of being
 * discarded and restarted from scratch whenever Home unmounts.
 */
export function PomodoroProvider({ children }: { children: React.ReactNode }) {
  const [preset, setPreset] = useState<Preset>(DEFAULT_MINUTES);
  const [customMinutes, setCustomMinutes] = useState(DEFAULT_MINUTES);
  const [secondsLeft, setSecondsLeft] = useState(DEFAULT_MINUTES * 60);
  const [isRunning, setIsRunning] = useState(false);
  const [sessionCount, setSessionCount] = useState(1);

  useEffect(() => {
    if (!isRunning) {
      return;
    }
    if (secondsLeft <= 0) {
      setIsRunning(false);
      setSessionCount((current) => current + 1);
      return;
    }

    const intervalId = setInterval(() => {
      setSecondsLeft((current) => current - 1);
    }, 1000);
    return () => clearInterval(intervalId);
  }, [isRunning, secondsLeft]);

  function selectPreset(next: Preset) {
    setPreset(next);
    setIsRunning(false);
    const minutes = next === "custom" ? customMinutes : next;
    setSecondsLeft(minutes * 60);
  }

  function handleCustomMinutesChange(value: number) {
    const minutes = Number.isNaN(value) ? 0 : Math.max(0, value);
    setCustomMinutes(minutes);
    setIsRunning(false);
    setSecondsLeft(minutes * 60);
  }

  function togglePlayPause() {
    setIsRunning((current) => !current);
  }

  function skipBack() {
    const minutes = preset === "custom" ? customMinutes : preset;
    setSecondsLeft(minutes * 60);
  }

  function skipForward() {
    setSecondsLeft(0);
    setIsRunning(false);
  }

  return (
    <PomodoroContext.Provider
      value={{
        preset,
        customMinutes,
        secondsLeft,
        isRunning,
        sessionCount,
        selectPreset,
        handleCustomMinutesChange,
        togglePlayPause,
        skipBack,
        skipForward,
      }}
    >
      {children}
    </PomodoroContext.Provider>
  );
}

// Throws rather than silently returning undefined, so a future page that
// forgets AppShell fails loudly during development instead of at click time.
export function usePomodoroContext() {
  const context = useContext(PomodoroContext);
  if (!context) {
    throw new Error("usePomodoroContext must be used within PomodoroProvider");
  }
  return context;
}
