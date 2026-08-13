"use client";

import { useEffect, useState } from "react";
import { SkipBack, Pause, Play, SkipForward } from "lucide-react";

// Constants/Variables 
const PRESETS = [5, 15, 25, "custom"] as const;
const DEFAULT_MINUTES = 25;
type Preset = (typeof PRESETS)[number];

//###################################################################################################################################################################
//                                                     LOGIC
//##########################################################################################################################################################################

// Turns  seconds count into "Minutes:Second" for display.
function formatTime(totalSeconds: number) 
{
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}

export default function PomodoroTimer() {
  // Which preset is currently selected
  const [preset, setPreset] = useState<Preset>(DEFAULT_MINUTES);
  // Minutes typed into the custom field 
  const [customMinutes, setCustomMinutes] = useState(DEFAULT_MINUTES);  // Minutes
  const [secondsLeft, setSecondsLeft] = useState(DEFAULT_MINUTES * 60); // Seconds 
  const [isRunning, setIsRunning] = useState(false);                    // Start Is Off



  // Tick the countdown down once a second while running.
  useEffect(() => 
    {
    if (!isRunning)
      {
         return;                   // Not Running
      }
    if (secondsLeft <= 0)
      {
      setIsRunning(false);       // Stop ticking once the session hits zero.
      return;
      }

    const intervalId = setInterval(() =>
    {
      setSecondsLeft((current) => current - 1);
    }, 1000
    );
    // Clear the interval whenever this effect re-runs or unmounts,so we never end up with multiple timers ticking at once
    return () => clearInterval(intervalId);
    },[isRunning, secondsLeft]);



  // Applies a preset/custom length: stops the timer and resets the clock to it.
  function selectPreset(next: Preset) {
    setPreset(next);
    setIsRunning(false);
    const minutes = next === "custom" ? customMinutes : next;
    setSecondsLeft(minutes * 60);
  }

  // While on the custom preset, editing the minutes field live-updates the clock.
  function handleCustomMinutesChange(value: number) {
    const minutes = Number.isNaN(value) ? 0 : Math.max(0, value);
    setCustomMinutes(minutes);
    setIsRunning(false);
    setSecondsLeft(minutes * 60);
  }

  function togglePlayPause() {
    setIsRunning((current) => !current);
  }

  // "Skip back" restarts the current session from the top.
  function skipBack() {
    const minutes = preset === "custom" ? customMinutes : preset;
    setSecondsLeft(minutes * 60);
  }

  // "Skip forward" ends the current session immediately.
  function skipForward() {
    setSecondsLeft(0);
    setIsRunning(false);
  }



  // ######################################################################################################################################################################################################
  //                                        UI Representation 
  // #####################################################################################################################################################################################################

  return (
    <div className="mt-6 bg-ob-surface border border-ob-line/60 rounded-2xl p-12 flex flex-col items-center w-full">
      {/* The clock carries the whole card, so it is sized to dominate it */}
      <span className="text-8xl font-extrabold tabular-nums tracking-tight text-ob-mist leading-none">
        {formatTime(secondsLeft)}
      </span>
      <span className="text-[11px] font-semibold text-ob-slate tracking-[0.28em] mt-4">
        {secondsLeft > 0 ? "TIME TO FOCUS" : "SESSION COMPLETE"}
      </span>

      {/*
        Skip controls stay quiet so the single light button reads as the one
        thing to press, the same way the mockup weights them.
      */}
      <div className="flex items-center gap-7 mt-9">
        <button
          onClick={skipBack}
          aria-label="Restart this session"
          className="text-ob-slate hover:text-ob-mist transition-colors"
        >
          <SkipBack size={18} />
        </button>
        <button
          onClick={togglePlayPause}
          aria-label={isRunning ? "Pause" : "Start"}
          className="w-16 h-16 rounded-2xl bg-ob-mist flex items-center justify-center text-ob-void shadow-lg shadow-black/30 hover:bg-white transition-colors"
        >
          {isRunning ? <Pause size={22} fill="currentColor" /> : <Play size={22} fill="currentColor" />}
        </button>
        <button
          onClick={skipForward}
          aria-label="End this session"
          className="text-ob-slate hover:text-ob-mist transition-colors"
        >
          <SkipForward size={18} />
        </button>
      </div>

      {/* Session length picker: 5 / 15 / 25 minutes, or a custom value */}
      <div className="flex items-center gap-2 mt-10">
        {PRESETS.map((option) => (
          <button
            key={option}
            onClick={() => selectPreset(option)}
            className={`px-4 py-1.5 rounded-full text-xs font-semibold capitalize transition-colors border ${
              preset === option
                ? "bg-ob-mist text-ob-void border-ob-mist"
                : "border-ob-line text-ob-slate hover:text-ob-mist hover:border-ob-slate"
            }`}
          >
            {option === "custom" ? "Custom" : `${option}m`}
          </button>
        ))}
      </div>

      {preset === "custom" && (
        <input
          type="number"
          min={1}
          value={customMinutes}
          onChange={(e) => handleCustomMinutesChange(e.target.valueAsNumber)}
          className="mt-3 w-24 bg-ob-base border border-ob-line rounded-lg px-3 py-1.5 text-sm text-center text-ob-mist focus:outline-none focus:border-ob-slate"
        />
      )}
    </div>
  );
}
