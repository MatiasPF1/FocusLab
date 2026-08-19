"use client";

/*
 * The Canvas tasks panel, modelled on the Tasks widget in the Canvas student
 * dashboard: a week window you can step through, one progress ring per course,
 * and the assignments due inside that window grouped by day.
 *
 * Everything here comes from GET /canvas/tasks, which reads Canvas directly.
 * There is nothing to connect and nothing saved on our side.
 */

import { useEffect, useState } from "react";
import { ChevronLeft, ChevronRight, ClipboardList, Settings, Square, SquareCheck } from "lucide-react";

const API_URL = process.env.NEXT_PUBLIC_API_URL;

type Task = {
  id: number;
  course: string | null;
  course_id: number;
  teacher: string | null;
  color: string | null;
  title: string;
  due: string;
  points: number | null;
  done: boolean;
  link: string | null;
};

type TaskWindow = {
  start: string;
  end: string;
  done: number;
  total: number;
  tasks: Task[];
};

// Canvas leaves a course's colour unset until the student picks one.
const FALLBACK_COLOR = "#6b7280";

/*
 * A date-only string ("2026-03-11") parsed with new Date() is read as UTC and
 * can land on the previous day once it is printed in a western timezone. Every
 * window date is built and compared as a local date instead.
 */
function localDate(iso: string) {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y, m - 1, d);
}

function toISO(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(
    date.getDate(),
  ).padStart(2, "0")}`;
}

function shiftWeeks(iso: string, weeks: number) {
  const date = localDate(iso);
  date.setDate(date.getDate() + weeks * 7);
  return toISO(date);
}

const MONTH_DAY: Intl.DateTimeFormatOptions = { month: "short", day: "numeric" };

/*
 * Canvas labels each group by how far off it is rather than by its date, so
 * "due Tomorrow" reads the same way here. Anything past this week is just named.
 */
function dayLabel(due: string) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const day = new Date(due);
  day.setHours(0, 0, 0, 0);

  const days = Math.round((day.getTime() - today.getTime()) / 86_400_000);
  if (days === 0) return "Today";
  if (days === 1) return "Tomorrow";
  if (days === -1) return "Yesterday";
  return day.toLocaleDateString(undefined, { weekday: "long", ...MONTH_DAY });
}

export default function TasksSection() {
  // Null start means "the week containing today", which is what the backend defaults to.
  const [start, setStart] = useState<string | null>(null);
  const [data, setData] = useState<TaskWindow | null>(null);
  const [courseFilter, setCourseFilter] = useState<number | "all">("all");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    const query = start ? `?start=${start}` : "";
    fetch(`${API_URL}/canvas/tasks${query}`)
      .then((res) => {
        if (!res.ok) throw new Error(String(res.status));
        return res.json();
      })
      .then((incoming: TaskWindow) => {
        if (cancelled) return;
        setData(incoming);
        setError(null);
      })
      .catch(() => {
        /*
         * A missing or expired CANVAS_TOKEN is the usual cause, and it is a
         * setup problem rather than something the panel can recover from.
         */
        if (!cancelled) setError("Could not reach Canvas.");
      });

    return () => {
      cancelled = true;
    };
  }, [start]);

  const tasks = data?.tasks ?? [];
  const shown = courseFilter === "all" ? tasks : tasks.filter((t) => t.course_id === courseFilter);

  // One entry per course, so the filter and the rings agree on what exists.
  const courses = Array.from(
    new Map(tasks.map((t) => [t.course_id, { id: t.course_id, name: t.course, color: t.color }])).values(),
  );

  /*
   * The ring is one arc per course rather than a single bar: a week that is
   * finished in three classes and untouched in a fourth should not read as
   * "mostly done", and the separate arcs are what show that.
   */
  const rings = courses.map((course) => {
    const mine = tasks.filter((t) => t.course_id === course.id);
    return {
      ...course,
      fraction: mine.length ? mine.filter((t) => t.done).length / mine.length : 0,
    };
  });

  const done = shown.filter((t) => t.done).length;
  const percent = shown.length ? Math.round((done / shown.length) * 100) : 0;

  // Groups keep the order the backend sorted them into, which is by due date.
  const groups = shown.reduce<Record<string, Task[]>>((acc, task) => {
    const label = dayLabel(task.due);
    (acc[label] ??= []).push(task);
    return acc;
  }, {});

  const range = data
    ? `${localDate(data.start).toLocaleDateString(undefined, MONTH_DAY)} to ${localDate(
        data.end,
      ).toLocaleDateString(undefined, MONTH_DAY)}`
    : "";

  return (
    <div className="bg-ob-surface border border-ob-line/60 rounded-2xl p-6 flex flex-col w-full text-left mt-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          <h3 className="text-lg font-semibold text-ob-mist leading-tight">Tasks</h3>
          <Settings size={13} className="text-ob-slate" />
        </div>

        <div className="flex items-center gap-1 text-xs text-ob-slate">
          <button
            onClick={() => setStart(shiftWeeks(data?.start ?? toISO(new Date()), -1))}
            className="p-1 rounded hover:text-ob-mist transition-colors"
            aria-label="Previous week"
          >
            <ChevronLeft size={14} />
          </button>
          <span className="text-ob-mist tabular-nums">{range}</span>
          <button
            onClick={() => setStart(shiftWeeks(data?.start ?? toISO(new Date()), 1))}
            className="p-1 rounded hover:text-ob-mist transition-colors"
            aria-label="Next week"
          >
            <ChevronRight size={14} />
          </button>
        </div>
      </div>

      <select
        value={courseFilter}
        onChange={(e) => setCourseFilter(e.target.value === "all" ? "all" : Number(e.target.value))}
        className="mt-4 w-full bg-transparent border-b border-ob-line text-sm text-ob-mist py-2 outline-none"
      >
        <option value="all">All Courses</option>
        {courses.map((course) => (
          <option key={course.id} value={course.id}>
            {course.name}
          </option>
        ))}
      </select>

      {/* Concentric arcs, outermost course first, over a faint full circle each */}
      <div className="relative mt-6 mx-auto w-44 h-44">
        <svg viewBox="0 0 176 176" className="w-full h-full -rotate-90">
          {rings.map((ring, index) => {
            const radius = 78 - index * 11;
            const circumference = 2 * Math.PI * radius;
            const color = ring.color ?? FALLBACK_COLOR;
            return (
              <g key={ring.id}>
                <circle
                  cx="88"
                  cy="88"
                  r={radius}
                  fill="none"
                  stroke={color}
                  strokeOpacity={0.15}
                  strokeWidth="8"
                />
                <circle
                  cx="88"
                  cy="88"
                  r={radius}
                  fill="none"
                  stroke={color}
                  strokeWidth="8"
                  strokeLinecap="round"
                  strokeDasharray={`${circumference * ring.fraction} ${circumference}`}
                />
              </g>
            );
          })}
        </svg>

        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-3xl font-bold text-ob-mist tabular-nums">{percent}%</span>
          <span className="text-xs text-ob-slate tabular-nums">
            {done}/{shown.length}
          </span>
          <span className="text-xs text-ob-slate">Complete</span>
        </div>
      </div>

      <div className="mt-5 flex items-center justify-center gap-8 border-b border-ob-line pb-2.5">
        <ClipboardList size={16} className="text-ob-mist" />
        <SquareCheck size={16} className="text-ob-slate" />
      </div>

      {error && <p className="mt-4 text-xs text-ob-slate text-center py-4">{error}</p>}

      {!error && shown.length === 0 && (
        <p className="mt-4 text-xs text-ob-slate text-center py-4">
          Nothing due this week.
        </p>
      )}

      {Object.entries(groups).map(([label, group]) => (
        <div key={label} className="mt-4">
          <p className="text-xs text-ob-slate">
            due <span className="text-ob-mist font-medium">{label}</span>
          </p>

          <ul className="mt-2 flex flex-col gap-2">
            {group.map((task) => {
              const color = task.color ?? FALLBACK_COLOR;
              return (
                <li key={task.id}>
                  <a
                    href={task.link ?? "#"}
                    target="_blank"
                    rel="noreferrer"
                    className="flex gap-3 rounded-xl border border-ob-line/60 p-2.5 hover:border-ob-slate transition-colors"
                  >
                    {/* The colour block is how Canvas tells the courses apart at a glance */}
                    <span
                      className="w-9 h-9 shrink-0 rounded-lg flex items-center justify-center"
                      style={{ backgroundColor: color }}
                    >
                      <ClipboardList size={16} className="text-white" />
                    </span>

                    <span className="min-w-0 flex-1">
                      <span className="block text-[11px] font-medium truncate" style={{ color }}>
                        {task.course}
                        {task.teacher && ` - ${task.teacher}`}
                      </span>
                      <span className="block text-sm font-semibold text-ob-mist truncate">
                        {task.title}
                      </span>
                      <span className="block text-[11px] text-ob-slate">
                        Due{" "}
                        {new Date(task.due).toLocaleString(undefined, {
                          ...MONTH_DAY,
                          hour: "numeric",
                          minute: "2-digit",
                        })}
                        {task.points !== null && ` | ${task.points} points`}
                      </span>
                    </span>

                    {task.done ? (
                      <SquareCheck size={14} className="text-ob-slate shrink-0" />
                    ) : (
                      <Square size={14} className="text-ob-slate shrink-0" />
                    )}
                  </a>
                </li>
              );
            })}
          </ul>
        </div>
      ))}
    </div>
  );
}
