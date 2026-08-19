"use client";

import { usePathname } from "next/navigation";
import Sidebar from "./(1.1)Home/Sidebar";
import { SpotifyPlayerProvider } from "./SpotifyPlayerProvider";
import { PomodoroProvider } from "./PomodoroProvider";

/*
 * Mounted once by the root layout and never torn down by client-side
 * navigation, so the sidebar (and, via SpotifyPlayerProvider and
 * PomodoroProvider, the Spotify player and the pomodoro timer) survive
 * switching between dashboard pages instead of being discarded and rebuilt
 * from scratch on every click — which is what full-page-shell duplication in
 * each page.tsx was doing before.
 *
 * The intro pages are the exception: the landing page and the API-keys setup
 * page are full-screen and have no navigation, so they render without this
 * shell and never start a Spotify connection before the user has even reached
 * the app - which also matters because the keys page is where the credentials
 * that connection needs are entered in the first place.
 */
export default function AppShell({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  // Next may hand back the parentheses percent-encoded depending on how the
  // route was reached, so compare against the decoded path.
  const currentPath = decodeURIComponent(pathname);
  const isIntro = currentPath === "/" || currentPath === "/(0.1)API_Keys";

  if (isIntro) {
    return <>{children}</>;
  }

  return (
    <SpotifyPlayerProvider>
      <PomodoroProvider>
        <div className="h-screen w-screen bg-ob-base text-ob-mist flex">
          <Sidebar />
          {children}
        </div>
      </PomodoroProvider>
    </SpotifyPlayerProvider>
  );
}
