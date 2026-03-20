"use client";
import { useState, useRef } from "react";
import { useRouter } from "next/navigation";

// ─── Icons ────────────────────────────────────────────────────────────────────

function IconCamera() {
  return (
    <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" />
      <circle cx="12" cy="13" r="4" />
    </svg>
  );
}

function IconSparkle() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 3l1.88 5.76a2 2 0 0 0 1.36 1.36L21 12l-5.76 1.88a2 2 0 0 0-1.36 1.36L12 21l-1.88-5.76a2 2 0 0 0-1.36-1.36L3 12l5.76-1.88a2 2 0 0 0 1.36-1.36z" />
    </svg>
  );
}

function IconMusic() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M9 18V5l12-2v13" />
      <circle cx="6" cy="18" r="3" />
      <circle cx="18" cy="16" r="3" />
    </svg>
  );
}

function IconEye({ show }: { show: boolean }) {
  return show ? (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  ) : (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M17.94 17.94A10.07 10.07 0 0112 20c-7 0-11-8-11-8a18.45 18.45 0 015.06-5.94M9.9 4.24A9.12 9.12 0 0112 4c7 0 11 8 11 8a18.5 18.5 0 01-2.16 3.19m-6.72-1.07a3 3 0 11-4.24-4.24" />
      <line x1="1" y1="1" x2="23" y2="23" />
    </svg>
  );
}

function IconLink() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M10 13a5 5 0 007.54.54l3-3a5 5 0 00-7.07-7.07l-1.72 1.71" />
      <path d="M14 11a5 5 0 00-7.54-.54l-3 3a5 5 0 007.07 7.07l1.71-1.71" />
    </svg>
  );
}

function IconInfo() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10" />
      <line x1="12" y1="8" x2="12" y2="12" />
      <line x1="12" y1="16" x2="12.01" y2="16" />
    </svg>
  );
}

function IconHelp() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10" />
      <path d="M9.09 9a3 3 0 015.83 1c0 2-3 3-3 3" />
      <line x1="12" y1="17" x2="12.01" y2="17" />
    </svg>
  );
}

function IconSettings() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 010 2.83 2 2 0 01-2.83 0l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-4 0v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83-2.83l.06-.06A1.65 1.65 0 004.68 15a1.65 1.65 0 00-1.51-1H3a2 2 0 010-4h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 012.83-2.83l.06.06A1.65 1.65 0 009 4.68a1.65 1.65 0 001-1.51V3a2 2 0 014 0v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 2.83l-.06.06A1.65 1.65 0 0019.4 9a1.65 1.65 0 001.51 1H21a2 2 0 010 4h-.09a1.65 1.65 0 00-1.51 1z" />
    </svg>
  );
}

function IconShield() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
    </svg>
  );
}

// ─── Setup Page ───────────────────────────────────────────────────────────────

export default function SetupPage() {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [photoUrl, setPhotoUrl] = useState<string | null>(null);
  const [geminiKey, setGeminiKey] = useState("");
  const [spotifyKey, setSpotifyKey] = useState("");
  const [showGemini, setShowGemini] = useState(false);

  function handlePhotoChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setPhotoUrl(URL.createObjectURL(file));
  }

  return (
    // Level 0 base — #0e0e0e
    <div className="min-h-screen w-full flex flex-col" style={{ backgroundColor: "#0e0e0e", color: "#e7e5e5", fontFamily: "Inter, sans-serif" }}>

      {/* ── Top bar ── */}
      <header className="flex items-center justify-between px-10 pt-7 pb-0">
        <span style={{ fontFamily: "Manrope, sans-serif", fontSize: "0.75rem", letterSpacing: "0.12em", color: "#939eb4" }} className="uppercase font-semibold">
          FocusLab
        </span>
        <div className="flex items-center gap-4" style={{ color: "#484848" }}>
          <button className="hover:text-[#939eb4] transition-colors"><IconHelp /></button>
          <button className="hover:text-[#939eb4] transition-colors"><IconSettings /></button>
        </div>
      </header>

      {/* ── Main content ── */}
      <main className="flex-1 flex flex-col px-10 pt-14 pb-10 max-w-300">

        {/* Headline — editorial asymmetric */}
        <div className="mb-12" style={{ maxWidth: "480px" }}>
          <h1 style={{ fontFamily: "Manrope, sans-serif", fontSize: "3.5rem", fontWeight: 700, lineHeight: 1.05, color: "#e7e5e5", letterSpacing: "-0.02em" }}>
            Current Setup
          </h1>
          <p style={{ fontSize: "0.875rem", color: "#939eb4", marginTop: "1rem", lineHeight: 1.65, letterSpacing: "-0.011em", maxWidth: "360px" }}>
            Establish your cognitive sanctuary by connecting your essential tools. FocusLab tailors the environment to your rhythm.
          </p>
        </div>

        {/* Two-column layout */}
        <div className="flex gap-6 items-start w-full">

          {/* ── Left: Profile card ── Level 2 card */}
          <div
            className="flex flex-col items-center gap-5 rounded-lg p-8 shrink-0"
            style={{ backgroundColor: "#191a1a", width: "240px" }}
          >
            {/* Photo area */}
            <button
              onClick={() => fileInputRef.current?.click()}
              className="relative flex items-center justify-center rounded-lg overflow-hidden transition-all group"
              style={{ width: "148px", height: "148px", backgroundColor: "#131313" }}
            >
              {photoUrl ? (
                <img src={photoUrl} alt="Profile" className="w-full h-full object-cover" />
              ) : (
                <span style={{ color: "#484848" }} className="group-hover:text-[#939eb4] transition-colors">
                  <IconCamera />
                </span>
              )}
            </button>
            <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handlePhotoChange} />

            <div className="text-center">
              <p style={{ fontFamily: "Manrope, sans-serif", fontSize: "0.9rem", fontWeight: 600, color: "#e7e5e5", letterSpacing: "-0.01em" }}>
                Profile Identity
              </p>
              <p style={{ fontSize: "0.75rem", color: "#939eb4", marginTop: "0.3rem", letterSpacing: "-0.011em" }}>
                A visual anchor for your digital workspace.
              </p>
            </div>

            <button
              onClick={() => fileInputRef.current?.click()}
              style={{ fontSize: "0.65rem", letterSpacing: "0.12em", color: "#939eb4" }}
              className="uppercase hover:text-[#d1e4fb] transition-colors"
            >
              Add Photo
            </button>
          </div>

          {/* ── Right: Integration cards + side label ── */}
          <div className="flex flex-1 gap-0 items-start">
            <div className="flex flex-col gap-3 flex-1">

              {/* Gemini card — Level 2 */}
              <div className="rounded-lg p-6" style={{ backgroundColor: "#191a1a" }}>
                <div className="flex items-start gap-4">
                  <div className="shrink-0 mt-0.5" style={{ color: "#b5c8df" }}>
                    <IconSparkle />
                  </div>
                  <div className="flex-1">
                    <p style={{ fontFamily: "Manrope, sans-serif", fontSize: "1rem", fontWeight: 600, color: "#e7e5e5", letterSpacing: "-0.01em" }}>
                      Gemini API Connection
                    </p>
                    <p style={{ fontSize: "0.8rem", color: "#939eb4", marginTop: "0.3rem", letterSpacing: "-0.011em", lineHeight: 1.55 }}>
                      This key powers the AI Research Hub, enabling contextual understanding and synthesis of your workspace data.
                    </p>
                    {/* Input row */}
                    <div
                      className="flex items-center gap-2 mt-4 rounded"
                      style={{ backgroundColor: "#131313", padding: "0 12px", height: "40px" }}
                    >
                      <input
                        type={showGemini ? "text" : "password"}
                        placeholder="Enter Gemini API Key"
                        value={geminiKey}
                        onChange={e => setGeminiKey(e.target.value)}
                        className="flex-1 bg-transparent outline-none"
                        style={{ fontSize: "0.8rem", color: "#e7e5e5", letterSpacing: geminiKey ? "-0.011em" : "0", caretColor: "#b5c8df" }}
                        // placeholder style handled via CSS below
                      />
                      <button
                        type="button"
                        onClick={() => setShowGemini(v => !v)}
                        className="shrink-0 transition-colors"
                        style={{ color: "#484848" }}
                        onMouseEnter={e => (e.currentTarget.style.color = "#939eb4")}
                        onMouseLeave={e => (e.currentTarget.style.color = "#484848")}
                      >
                        <IconEye show={showGemini} />
                      </button>
                      <button
                        type="button"
                        className="shrink-0 transition-colors"
                        style={{ color: "#484848" }}
                        onMouseEnter={e => (e.currentTarget.style.color = "#939eb4")}
                        onMouseLeave={e => (e.currentTarget.style.color = "#484848")}
                      >
                        <IconInfo />
                      </button>
                    </div>
                  </div>
                </div>
              </div>

              {/* Spotify card — Level 2 */}
              <div className="rounded-lg p-6" style={{ backgroundColor: "#191a1a" }}>
                <div className="flex items-start gap-4">
                  <div className="shrink-0 mt-0.5" style={{ color: "#1ed760" }}>
                    <IconMusic />
                  </div>
                  <div className="flex-1">
                    <p style={{ fontFamily: "Manrope, sans-serif", fontSize: "1rem", fontWeight: 600, color: "#e7e5e5", letterSpacing: "-0.01em" }}>
                      Spotify Soundscape
                    </p>
                    <p style={{ fontSize: "0.8rem", color: "#939eb4", marginTop: "0.3rem", letterSpacing: "-0.011em", lineHeight: 1.55 }}>
                      Connect your personal key to synchronize curated focus audio and ambient soundscapes directly into your sessions.{" "}
                      <span style={{ color: "#e7e5e5", fontWeight: 600 }}>A Spotify Premium account is required.</span>
                    </p>
                    {/* Input row */}
                    <div
                      className="flex items-center gap-2 mt-4 rounded"
                      style={{ backgroundColor: "#131313", padding: "0 12px", height: "40px" }}
                    >
                      <input
                        type="password"
                        placeholder="Spotify API Personal Key"
                        value={spotifyKey}
                        onChange={e => setSpotifyKey(e.target.value)}
                        className="flex-1 bg-transparent outline-none"
                        style={{ fontSize: "0.8rem", color: "#e7e5e5", letterSpacing: spotifyKey ? "-0.011em" : "0", caretColor: "#b5c8df" }}
                      />
                      <button
                        type="button"
                        className="shrink-0 transition-colors"
                        style={{ color: "#484848" }}
                        onMouseEnter={e => (e.currentTarget.style.color = "#939eb4")}
                        onMouseLeave={e => (e.currentTarget.style.color = "#484848")}
                      >
                        <IconLink />
                      </button>
                    </div>
                  </div>
                </div>
              </div>

              {/* Bottom action row */}
              <div className="flex items-center justify-between mt-2">
                <div className="flex items-center gap-2" style={{ color: "#484848", fontSize: "0.7rem", letterSpacing: "0.05em" }}>
                  <IconShield />
                  <span className="uppercase">Encrypted Environment</span>
                </div>

                {/* Primary CTA — brushed satin gradient */}
                <button
                  onClick={() => router.push("/MainDashboard_Component")}
                  className="rounded-lg transition-opacity hover:opacity-80"
                  style={{
                    background: "linear-gradient(45deg, #b5c8df, #36485b)",
                    color: "#0e0e0e",
                    fontSize: "0.7rem",
                    fontWeight: 700,
                    letterSpacing: "0.1em",
                    padding: "0.65rem 1.6rem",
                  }}
                >
                  ENTER WORKSPACE
                </button>
              </div>

            </div>

            {/* Vertical side label */}
            <div
              className="shrink-0 flex flex-col items-center gap-3 ml-6 select-none"
              style={{ paddingTop: "8px" }}
            >
              <div
                style={{
                  writingMode: "vertical-rl",
                  transform: "rotate(180deg)",
                  fontSize: "0.6rem",
                  letterSpacing: "0.18em",
                  color: "#484848",
                  textTransform: "uppercase",
                  lineHeight: 1.2,
                }}
              >
                Integration Zone
              </div>
              <div style={{ width: "1px", height: "48px", backgroundColor: "#252626" }} />
              <span style={{ fontSize: "0.65rem", color: "#484848", letterSpacing: "0.08em" }}>01</span>
            </div>
          </div>
        </div>
      </main>

      {/* ── Footer ── */}
      <footer className="px-10 pb-10 flex items-end justify-between" style={{ marginTop: "auto" }}>
        <div className="flex gap-16">
          <div style={{ maxWidth: "240px" }}>
            <p style={{ fontSize: "0.65rem", letterSpacing: "0.12em", color: "#484848", textTransform: "uppercase", marginBottom: "0.6rem" }}>
              Privacy Standards
            </p>
            <p style={{ fontSize: "0.75rem", color: "#484848", lineHeight: 1.6, letterSpacing: "-0.011em" }}>
              API keys are stored locally within your secure vault. FocusLab never transmits{" "}
              <span style={{ color: "#939eb4" }}>sensitive</span> tokens to external trackers.
            </p>
          </div>
        </div>

        {/* Editorial page number */}
        <div
          style={{
            fontFamily: "Manrope, sans-serif",
            fontSize: "3.5rem",
            fontWeight: 700,
            color: "#191a1a",
            lineHeight: 1,
            letterSpacing: "-0.03em",
            userSelect: "none",
          }}
        >
          01/01
        </div>
      </footer>

      {/* Global placeholder style */}
      <style>{`
        input::placeholder { color: #484848; }
      `}</style>
    </div>
  );
}
