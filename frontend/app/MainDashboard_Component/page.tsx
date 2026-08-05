import { Home, FileText, CheckSquare, Sparkles, Calendar } from "lucide-react";
import PomodoroTimer from "./PomodoroTimer";

export default function DashboardPage() {
  return (
    <main className="h-screen w-screen bg-black text-white flex">
      <Sidebar />
      <CenterContent />
    </main>
  );
}

// Left navigation sidebar
function Sidebar() {
  const navItems = [
    { label: "Home", icon: Home, active: true },
    { label: "Notebook", icon: FileText },
    { label: "To-Do", icon: CheckSquare },
    { label: "AI Study", icon: Sparkles },
    { label: "Calendar", icon: Calendar },
  ];
  return (
    <aside className="w-56 shrink-0 border-r border-white/10 flex flex-col p-4">
      <div className="mb-8">
        <h1 className="text-lg font-semibold">FocusLab</h1>
        <p className="text-xs text-white/40">The Digital Curator</p>
      </div>
      <nav className="flex flex-col gap-1">
        {navItems.map(({ label, icon: Icon, active }) => (
          <div
            key={label}
            className={`flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm ${
              active ? "bg-indigo-500/15 text-indigo-300" : "text-white/60"
            }`}
          >
            <Icon size={16} />
            {label}
          </div>
        ))}
      </nav>
      <div className="mt-auto flex flex-col gap-2 text-xs text-white/40">
        <span>Help</span>
        <span>Archive</span>
      </div>
    </aside>
  );
}

// Main center content: topbar + pomodoro timer
function CenterContent() {
  return (
    <section className="flex-1 flex flex-col items-center p-6 overflow-y-auto">
      <div className="w-full max-w-2xl flex flex-col items-center text-center mt-10">
        <h2 className="text-6xl font-bold mt-2">Pomodoro Timer</h2>
        <p className="text-sm text-white/50 mt-3 max-w-md">
          Focus on the core complexity of your current
          thesis. Silence is your best collaborator.
        </p>
        <PomodoroTimer />
      </div>
    </section>
  );
}
