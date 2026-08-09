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
    <div className="mt-6 bg-stone-900/60 border border-stone-800 rounded-2xl p-10 flex flex-col items-center w-full">
      <span className="text-7xl font-bold tabular-nums text-stone-100">
        {formatTime(secondsLeft)}
      </span>
      <span className="text-xs text-stone-500 tracking-widest mt-2">
        {secondsLeft > 0 ? "TIME TO FOCUS" : "SESSION COMPLETE"}
      </span>
      <div className="flex items-center gap-4 mt-6">
        <button
          onClick={skipBack}
          className="w-10 h-10 rounded-full bg-stone-800 flex items-center justify-center text-stone-300 hover:bg-stone-700 transition-colors"
        >
          <SkipBack size={16} />
        </button>
        <button
          onClick={togglePlayPause}
          className="w-14 h-14 rounded-full bg-indigo-400 flex items-center justify-center text-stone-950 hover:bg-indigo-300 transition-colors"
        >
          {isRunning ? <Pause size={20} /> : <Play size={20} />}
        </button>
        <button
          onClick={skipForward}
          className="w-10 h-10 rounded-full bg-stone-800 flex items-center justify-center text-stone-300 hover:bg-stone-700 transition-colors"
        >
          <SkipForward size={16} />
        </button>
      </div>

      {/* Session length picker: 5 / 15 / 25 minutes, or a custom value */}
      <div className="flex items-center gap-2 mt-8">
        {PRESETS.map((option) => (
          <button
            key={option}
            onClick={() => selectPreset(option)}
            className={`px-4 py-1.5 rounded-full text-xs font-semibold capitalize transition-colors ${
              preset === option
                ? "bg-indigo-400 text-stone-950"
                : "bg-stone-800 text-stone-400 hover:text-stone-200"
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
          className="mt-3 w-24 bg-stone-900 border border-stone-800 rounded-lg px-3 py-1.5 text-sm text-center text-stone-200 focus:outline-none focus:border-indigo-400/60"
        />
      )}
    </div>
  );
}
