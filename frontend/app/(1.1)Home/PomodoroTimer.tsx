"use client";

import { SkipBack, Pause, Play, SkipForward } from "lucide-react";
import { usePomodoroContext } from "../PomodoroProvider";

// Constants/Variables
const PRESETS = [5, 15, 25, "custom"] as const;

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

// State lives in PomodoroProvider (mounted once by AppShell) rather than
// here, so the running countdown survives navigating to another page and
// back instead of resetting every time this component unmounts.
export default function PomodoroTimer() {
  const {
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
  } = usePomodoroContext();

  // ######################################################################################################################################################################################################
  //                                        UI Representation
  // #####################################################################################################################################################################################################

  return (
    <div className="mt-6 flex flex-col items-center w-full">
      <div className="bg-ob-surface border border-ob-line/60 rounded-2xl px-10 py-9 flex flex-col items-center w-full">
        {/* Session length, as a segmented control rather than a row of loose pills */}
        <div className="flex items-center gap-1 bg-ob-base border border-ob-line/60 rounded-full p-1">
          {PRESETS.map((option) => (
            <button
              key={option}
              onClick={() => selectPreset(option)}
              className={`px-4 py-1.5 rounded-full text-xs font-semibold capitalize transition-colors ${
                preset === option
                  ? "bg-ob-mist text-ob-void"
                  : "text-ob-slate hover:text-ob-mist"
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

        {/* The clock carries the whole card, so it is sized to dominate it */}
        <span className="text-8xl font-extrabold tabular-nums tracking-tight text-ob-mist leading-none mt-8">
          {formatTime(secondsLeft)}
        </span>

        {/* One full-width bar reads as the single thing to press, flanked by quiet skip controls */}
        <div className="flex items-center gap-3 mt-9 w-full">
          <button
            onClick={skipBack}
            aria-label="Restart this session"
            className="w-11 h-11 shrink-0 rounded-xl border border-ob-line text-ob-slate hover:text-ob-mist hover:border-ob-slate transition-colors flex items-center justify-center"
          >
            <SkipBack size={16} />
          </button>
          <button
            onClick={togglePlayPause}
            className="flex-1 h-11 rounded-xl bg-ob-mist text-ob-void font-bold text-sm tracking-widest flex items-center justify-center gap-2 shadow-lg shadow-black/30 hover:bg-white transition-colors"
          >
            {isRunning ? (
              <>
                <Pause size={15} fill="currentColor" /> PAUSE
              </>
            ) : (
              <>
                <Play size={15} fill="currentColor" /> START
              </>
            )}
          </button>
          <button
            onClick={skipForward}
            aria-label="End this session"
            className="w-11 h-11 shrink-0 rounded-xl border border-ob-line text-ob-slate hover:text-ob-mist hover:border-ob-slate transition-colors flex items-center justify-center"
          >
            <SkipForward size={16} />
          </button>
        </div>
      </div>

      {/* Session number and status sit outside the card, not competing with the clock for weight */}
      <div className="mt-4 text-center">
        <p className="text-xs font-semibold text-ob-slate tabular-nums">
          #{sessionCount}
        </p>
        <p className="text-sm font-semibold text-ob-mist mt-0.5">
          {secondsLeft > 0 ? "Time to focus!" : "Session complete!"}
        </p>
      </div>
    </div>
  );
}
