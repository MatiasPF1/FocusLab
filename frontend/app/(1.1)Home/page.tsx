import PomodoroTimer from "./PomodoroTimer";
import PlaylistSection from "./PlaylistSection";

// The Sidebar and the surrounding flex shell now live in AppShell, so every
// dashboard page (this one included) contributes only its own content.
export default function HomePage() {
  return (
    <>
      <section className="flex-1 flex flex-col items-center p-6 overflow-y-auto">
        <div className="w-full max-w-xl flex flex-col items-center text-center mt-10">
          <h2 className="text-6xl font-bold mt-2 text-ob-mist">Pomodoro Timer</h2>
          <p className="text-sm text-ob-slate mt-3 max-w-md">
            Block out the distractions and get back to your
            coursework. Deep work starts with a single session.
          </p>
          <PomodoroTimer />
        </div>
      </section>

      {/* Queues get their own column so a long track/history list scrolls on its own, independent of the timer */}
      <aside className="w-96 shrink-0 border-l border-ob-line/60 p-6 overflow-y-auto">
        <PlaylistSection />
      </aside>
    </>
  );
}
