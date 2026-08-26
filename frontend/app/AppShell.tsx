"use client";

import { useState } from "react";
import { usePathname } from "next/navigation";
import Sidebar from "./(1.1)Home/Sidebar";
import { SpotifyPlayerProvider } from "./SpotifyPlayerProvider";
import { PomodoroProvider } from "./PomodoroProvider";
import FocusAIPanel from "./(1.1)Home/FocusAIPanel";

/*
 * Mounted once by the root layout and never torn down by client-side
 * navigation, so the sidebar (and, via SpotifyPlayerProvider and
 * PomodoroProvider, the Spotify player and the pomodoro timer) survive
 * switching between dashboard pages instead of being discarded and rebuilt
 * from scratch on every click — which is what full-page-shell duplication in
 * each page.tsx was doing before.
 *
 * The landing page is the exception: it is full-screen, has no navigation, and
 * should not start a Spotify connection before the user has even reached the
 * app, so it renders without this shell. The API-keys page used to be exempt
 * too, back when it sat between the landing page and the dashboard; it is now
 * a settings page reached from the sidebar, so it keeps the shell like any
 * other in-app page.
 */
export default function AppShell({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  // The FocusAI chat floats over whichever page is showing, so its open state
  // belongs here alongside the sidebar rather than inside any one page.
  const [focusAIOpen, setFocusAIOpen] = useState(false);
  // Next may hand back the parentheses percent-encoded depending on how the
  // route was reached, so compare against the decoded path.
  const currentPath = decodeURIComponent(pathname);
  const isIntro = currentPath === "/";

  if (isIntro) {
    return <>{children}</>;
  }

  return (
    <SpotifyPlayerProvider>
      <PomodoroProvider>
        <div className="h-screen w-screen bg-ob-base text-ob-mist flex">
          <Sidebar
            focusAIOpen={focusAIOpen}
            onToggleFocusAI={() => setFocusAIOpen((open) => !open)}
          />
          {children}
          {focusAIOpen && <FocusAIPanel onClose={() => setFocusAIOpen(false)} />}
        </div>
      </PomodoroProvider>
    </SpotifyPlayerProvider>
  );
}
