"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Home, FileText, CheckSquare, Sparkles, Calendar } from "lucide-react";

const NAV_ITEMS = [
  { label: "Home", icon: Home, href: "/(1.1)Home" },
  { label: "Notebook", icon: FileText, href: "/(1.2)Notebook" },
  { label: "To-Do", icon: CheckSquare, href: "/(1.3)To-Do" },
  { label: "AI Study", icon: Sparkles, href: "/(1.4)AI_Study" },
  { label: "Calendar", icon: Calendar, href: "/(1.5)Calendar" },
];

// Shared left navigation sidebar, imported directly by each dashboard page.
export default function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="w-56 shrink-0 border-r border-white/10 flex flex-col p-4">
      <div className="mb-8">
        <h1 className="text-lg font-semibold">FocusLab</h1>
        <p className="text-xs text-white/40">The Digital Curator</p>
      </div>
      <nav className="flex flex-col gap-1">
        {NAV_ITEMS.map(({ label, icon: Icon, href }) => {
          const active = pathname === href;
          return (
            <Link
              key={label}
              href={href}
              className={`flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm ${
                active ? "bg-indigo-500/15 text-indigo-300" : "text-white/60"
              }`}
            >
              <Icon size={16} />
              {label}
            </Link>
          );
        })}
      </nav>
      <div className="mt-auto flex flex-col gap-2 text-xs text-white/40">
        <span>Help</span>
        <span>Archive</span>
      </div>
    </aside>
  );
}
