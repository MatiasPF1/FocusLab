import Sidebar from "./Sidebar";
import PomodoroTimer from "./PomodoroTimer";
import PlaylistSection from "./PlaylistSection";

export default function HomePage() {
  return (
    <main className="h-screen w-screen bg-stone-950 text-stone-200 flex">
      <Sidebar />
      <section className="flex-1 flex flex-col items-center p-6 overflow-y-auto">
        <div className="w-full max-w-2xl flex flex-col items-center text-center mt-10">
          <h2 className="text-6xl font-bold mt-2 text-stone-100">Pomodoro Timer</h2>
          <p className="text-sm text-stone-400 mt-3 max-w-md">
            Block out the distractions and get back to your
            coursework. Deep work starts with a single session.
          </p>
          <PomodoroTimer />
          <PlaylistSection />
        </div>
      </section>
    </main>
  );
}
