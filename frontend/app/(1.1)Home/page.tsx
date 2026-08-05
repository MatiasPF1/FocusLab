import Sidebar from "./Sidebar";
import PomodoroTimer from "./PomodoroTimer";
import PlaylistSection from "./PlaylistSection";

export default function HomePage() {
  return (
    <main className="h-screen w-screen bg-black text-white flex">
      <Sidebar />
      <section className="flex-1 flex flex-col items-center p-6 overflow-y-auto">
        <div className="w-full max-w-2xl flex flex-col items-center text-center mt-10">
          <h2 className="text-6xl font-bold mt-2">Pomodoro Timer</h2>
          <p className="text-sm text-white/50 mt-3 max-w-md">
            Focus on the core complexity of your current
            thesis. Silence is your best collaborator.
          </p>
          <PomodoroTimer />
          <PlaylistSection />
        </div>
      </section>
    </main>
  );
}
