"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Home, FileText, CheckSquare, Sparkles, Calendar } from "lucide-react";

const NAV_ITEMS = [
  { label: "Home", icon: Home, href: "/(1.1)Home" },
  { label: "To-Do", icon: CheckSquare, href: "/(1.3)To-Do" },
  { label: "Notebook", icon: FileText, href: "/(1.2)Notebook" },
  { label: "AI Study", icon: Sparkles, href: "/(1.4)AI_Study" },
  { label: "Calendar", icon: Calendar, href: "/(1.5)Calendar" },
];

// Shared left navigation sidebar, imported directly by each dashboard page.
export default function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="w-56 shrink-0 border-r border-ob-line/60 flex flex-col p-4 bg-ob-void">
      <div className="mb-8">
        <h1 className="text-lg font-semibold text-ob-mist">FocusLab</h1>
      </div>
      <nav className="flex flex-col gap-1">
        {NAV_ITEMS.map(({ label, icon: Icon, href }) => {
          const active = pathname === href;
          return (
            <Link
              key={label}
              href={href}
              className={`flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm transition-colors ${
                active
                  ? "bg-ob-line/40 text-ob-mist"
                  : "text-ob-slate hover:text-ob-mist"
              }`}
            >
              <Icon size={16} />
              {label}
            </Link>
          );
        })}
      </nav>
    </aside>
  );
}
