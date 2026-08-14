"use client";

import { usePathname } from "next/navigation";
import Sidebar from "./(1.1)Home/Sidebar";
import { SpotifyPlayerProvider } from "./SpotifyPlayerProvider";

/*
 * Mounted once by the root layout and never torn down by client-side
 * navigation, so the sidebar (and, via SpotifyPlayerProvider, the Spotify
 * player) survive switching between dashboard pages instead of being
 * discarded and rebuilt from scratch on every click — which is what
 * full-page-shell duplication in each page.tsx was doing before.
 *
 * The landing page is the one exception: it is a full-screen intro with its
 * own background and no navigation, so it renders without this shell and
 * never starts a Spotify connection before the user has even reached the app.
 */
export default function AppShell({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const isLanding = pathname === "/";

  if (isLanding) {
    return <>{children}</>;
  }

  return (
    <SpotifyPlayerProvider>
      <div className="h-screen w-screen bg-ob-base text-ob-mist flex">
        <Sidebar />
        {children}
      </div>
    </SpotifyPlayerProvider>
  );
}
