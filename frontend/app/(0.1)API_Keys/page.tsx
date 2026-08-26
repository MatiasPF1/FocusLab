"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Music, GraduationCap, Bot } from "lucide-react";

/*
 * FocusLab is being built as a DESKTOP app (one install per user, backend on
 * localhost), not a hosted web app, which is why this page asks each user for
 * their own keys instead of the app shipping a single shared set.
 *
 * This used to sit between the landing page and the dashboard, so every launch
 * walked past it whether or not the keys were already saved. It is now a
 * settings page instead, reached from the gear in the sidebar, and the landing
 * page goes straight to the dashboard.
 *
 * Three services need credentials for the app to run whole, one tab each:
 *
 *   Spotify   - the player on the Home page. Each install registers its own
 *               Spotify app, which sidesteps Spotify's 25-user Development
 *               Mode allowlist: every user is user #1 of their own app rather
 *               than one of 25 slots in ours.
 *   Canvas    - courses, assignments and grades. The token is per-school and
 *               per-person, so it could never be shipped centrally.
 *   Claude    - the Anthropic key FocusAI and the AI Study page run on. It is
 *               billed to whoever pastes it.
 *
 * What is saved here is what the app runs on. Each service resolves its
 * credentials saved-keys-first and falls back to a .env only when nothing has
 * been saved - see the resolve_* functions in apis/Retrieving_Keys/core.py,
 * and the three readers that call them: get_spotify_config
 * (apis/spotify/OAuth_Logic.py), _credentials (apis/canvas/core.py) and
 * Client_MCP/keys.py for the agent. Nothing needs restarting after a save.
 */

const API_URL = process.env.NEXT_PUBLIC_API_URL;

// Must match SPOTIFY_REDIRECT_URI in the backend .env exactly. Spotify stopped
// accepting "localhost" aliases in November 2025, so this is the literal
// loopback IP and cannot be written any other way.
const REDIRECT_URI = "http://127.0.0.1:8000/spotify/callback";

// Which set of credentials a service would actually use right now.
type Source = "environment" | "database" | "none";

type KeysStatus = {
  spotify_client_id: string | null;
  spotify_client_secret_set: boolean;
  canvas_url: string | null;
  canvas_token_set: boolean;
  anthropic_key_set: boolean;
  updated_at: string | null;
  active_source: Source; // Spotify's, named before the other two existed
  canvas_source: Source;
  anthropic_source: Source;
};

// Every box on this page, flat, because that is also the shape /keys accepts.
type Fields = {
  spotify_client_id: string;
  spotify_client_secret: string;
  canvas_url: string;
  canvas_token: string;
  anthropic_key: string;
};

const EMPTY_FIELDS: Fields = {
  spotify_client_id: "",
  spotify_client_secret: "",
  canvas_url: "",
  canvas_token: "",
  anthropic_key: "",
};

type ServiceId = "spotify" | "canvas" | "claude";

type Service = {
  id: ServiceId;
  label: string;
  icon: typeof Music;
  powers: string; // What stops working without it
  // Only this service's boxes are sent when its tab is saved, so the other
  // two are left untouched rather than blanked.
  fields: {
    name: keyof Fields;
    label: string;
    type: "text" | "password";
    placeholder: string;
    // Whether the backend says this one is already stored. The secrets are
    // write-only, so for those this is the only way to know.
    saved: (status: KeysStatus | null) => boolean;
  }[];
  source: (status: KeysStatus | null) => Source;
  steps: React.ReactNode;
};

// Reused by every step list so the numbering stays visually consistent.
function Step({ n, children }: { n: number; children: React.ReactNode }) {
  return (
    <li>
      <span className="text-ob-mist">{n}.</span> {children}
    </li>
  );
}

function ExternalLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="text-indigo-400 underline underline-offset-2 hover:text-indigo-300"
    >
      {children}
    </a>
  );
}

const SERVICES: Service[] = [
  {
    id: "spotify",
    label: "Spotify",
    icon: Music,
    powers: "the player and playlist queues on the Home page",
    source: (status) => status?.active_source ?? "none",
    fields: [
      {
        name: "spotify_client_id",
        label: "Client ID",
        type: "text",
        placeholder: "e.g. 4f2b8c1e9a7d4f60b3e5c8a1d2f7b9e0",
        saved: (status) => Boolean(status?.spotify_client_id),
      },
      {
        name: "spotify_client_secret",
        label: "Client Secret",
        type: "password",
        placeholder: "................................",
        saved: (status) => Boolean(status?.spotify_client_secret_set),
      },
    ],
    steps: (
      <>
        <Step n={1}>
          Open the{" "}
          <ExternalLink href="https://developer.spotify.com/dashboard">
            Spotify Developer Dashboard
          </ExternalLink>{" "}
          and click <span className="text-ob-mist">Create app</span>.
        </Step>
        <Step n={2}>
          Set the Redirect URI to exactly this, then click Add:
          <code className="mt-2 block break-all rounded bg-ob-void px-3 py-2 font-mono text-xs text-ob-mist">
            {REDIRECT_URI}
          </code>
        </Step>
        <Step n={3}>
          Tick <span className="text-ob-mist">Web API</span> and{" "}
          <span className="text-ob-mist">Web Playback SDK</span>, then save.
        </Step>
        <Step n={4}>
          Open Settings on the new app and copy the Client ID and Client Secret
          into the boxes below.
        </Step>
      </>
    ),
  },
  {
    id: "canvas",
    label: "Canvas",
    icon: GraduationCap,
    powers: "courses, assignments and grades, and the questions FocusAI answers about them",
    source: (status) => status?.canvas_source ?? "none",
    fields: [
      {
        name: "canvas_url",
        label: "Canvas URL",
        type: "text",
        placeholder: "e.g. https://your-school.instructure.com",
        saved: (status) => Boolean(status?.canvas_url),
      },
      {
        name: "canvas_token",
        label: "Access Token",
        type: "password",
        placeholder: "e.g. 7~aBcD...",
        saved: (status) => Boolean(status?.canvas_token_set),
      },
    ],
    steps: (
      <>
        <Step n={1}>
          Sign in to your school&apos;s Canvas. The address bar gives you the
          first box - the host only, such as{" "}
          <span className="text-ob-mist">https://your-school.instructure.com</span>.
        </Step>
        <Step n={2}>
          Open{" "}
          <span className="text-ob-mist">Account &rarr; Settings</span> from the
          left-hand menu (
          <ExternalLink href="https://community.canvaslms.com/t5/Student-Guide/How-do-I-manage-API-access-tokens-in-my-user-account/ta-p/273">
            Canvas&apos; own guide
          </ExternalLink>{" "}
          walks through this).
        </Step>
        <Step n={3}>
          Scroll to <span className="text-ob-mist">Approved Integrations</span>{" "}
          and click <span className="text-ob-mist">+ New Access Token</span>.
          Name it FocusLab and leave the expiry blank so it does not stop
          working mid-semester.
        </Step>
        <Step n={4}>
          Copy the token straight away - Canvas shows it once and never again -
          and paste it below.
        </Step>
      </>
    ),
  },
  {
    id: "claude",
    label: "Claude",
    icon: Bot,
    powers: "FocusAI and the AI Study page",
    source: (status) => status?.anthropic_source ?? "none",
    fields: [
      {
        name: "anthropic_key",
        label: "API Key",
        type: "password",
        placeholder: "sk-ant-...",
        saved: (status) => Boolean(status?.anthropic_key_set),
      },
    ],
    steps: (
      <>
        <Step n={1}>
          Open the{" "}
          <ExternalLink href="https://console.anthropic.com/settings/keys">
            Anthropic Console
          </ExternalLink>{" "}
          and sign in, creating an account if you do not have one.
        </Step>
        <Step n={2}>
          The key is billed per use, so add credit under{" "}
          <ExternalLink href="https://console.anthropic.com/settings/billing">
            Billing
          </ExternalLink>{" "}
          first. A few dollars covers a lot of studying.
        </Step>
        <Step n={3}>
          Click <span className="text-ob-mist">Create Key</span>, name it
          FocusLab, and copy it - the console shows it once.
        </Step>
        <Step n={4}>
          Paste it below. It is yours: it stays on this machine and is only ever
          sent to Anthropic.
        </Step>
      </>
    ),
  },
];

export default function ApiKeysPage() {
  const [service, setService] = useState<ServiceId>("spotify");
  const [fields, setFields] = useState<Fields>(EMPTY_FIELDS);
  const [status, setStatus] = useState<KeysStatus | null>(null);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // What is already stored, so a returning user sees their saved ids filled in.
  useEffect(() => {
    let cancelled = false;

    fetch(`${API_URL}/keys/status`)
      .then((res) => (res.ok ? res.json() : null))
      .then((data: KeysStatus | null) => {
        if (cancelled || !data) return;
        setStatus(data);
        // Secrets are deliberately never returned, so those boxes stay empty.
        setFields((current) => ({
          ...current,
          spotify_client_id: data.spotify_client_id ?? "",
          canvas_url: data.canvas_url ?? "",
        }));
      })
      .catch(() => {
        if (!cancelled) setError("Could not reach the FocusLab backend.");
      });

    return () => {
      cancelled = true;
    };
  }, []);

  const active = SERVICES.find((entry) => entry.id === service)!;
  const activeSource = active.source(status);

  async function saveKeys() {
    setSaving(true);
    setMessage(null);
    setError(null);
    try {
      // Only the open tab's boxes go up. Anything the request leaves out the
      // backend leaves exactly as it was, so saving Canvas cannot wipe Spotify.
      const payload = Object.fromEntries(
        active.fields.map((field) => [field.name, fields[field.name]]),
      );
      const res = await fetch(`${API_URL}/keys`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      // fetch only rejects on a network failure, not on a 4xx/5xx body
      if (!res.ok) {
        const body = await res.json().catch(() => null);
        throw new Error(body?.detail ?? "Could not save those keys.");
      }
      const data: KeysStatus = await res.json();
      setStatus(data);
      // Clearing the secrets mirrors the fact that the API will never hand
      // them back; the ids come back from the response instead.
      setFields((current) => ({
        ...current,
        spotify_client_secret: "",
        canvas_token: "",
        anthropic_key: "",
        spotify_client_id: data.spotify_client_id ?? current.spotify_client_id,
        canvas_url: data.canvas_url ?? current.canvas_url,
      }));
      setMessage(`${active.label} keys saved.`);
    } catch (saveError) {
      setError(
        saveError instanceof Error
          ? saveError.message
          : "Could not save those keys.",
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <main className="flex-1 overflow-y-auto bg-ob-base text-ob-mist">
      <div className="mx-auto flex min-h-full max-w-2xl flex-col justify-center px-6 py-16">
        <header className="mb-8">
          <h1 className="text-3xl font-semibold text-white">Connect your services</h1>
          <p className="mt-3 text-sm leading-relaxed text-ob-slate">
            FocusLab runs on your machine, so it uses{" "}
            <span className="text-ob-mist">your own</span> credentials rather
            than a shared set. Set up whichever ones you want - each takes about
            five minutes, once, and the rest of the app keeps working without
            them.
          </p>
        </header>

        {/* One button per service. The dot is whether that one is usable now */}
        <div className="mb-8 flex gap-2">
          {SERVICES.map(({ id, label, icon: Icon, source }) => {
            const configured = source(status) !== "none";
            const selected = id === service;
            return (
              <button
                key={id}
                type="button"
                onClick={() => {
                  setService(id);
                  // Last save's outcome belonged to the tab that is closing
                  setMessage(null);
                  setError(null);
                }}
                className={`flex flex-1 items-center justify-center gap-2 rounded-lg border px-4 py-2.5 text-sm transition-colors ${
                  selected
                    ? "border-ob-line bg-ob-surface text-ob-mist"
                    : "border-ob-line/50 text-ob-slate hover:border-ob-slate hover:text-ob-mist"
                }`}
              >
                <Icon size={16} />
                {label}
                <span
                  aria-hidden
                  className={`h-1.5 w-1.5 rounded-full ${
                    configured ? "bg-emerald-400" : "bg-ob-slate/40"
                  }`}
                />
              </button>
            );
          })}
        </div>

        <p className="mb-4 text-sm text-ob-slate">
          Powers <span className="text-ob-mist">{active.powers}</span>.
        </p>

        {/* Setup steps. For Spotify the redirect URI is the part people get wrong */}
        <ol className="mb-8 space-y-3 rounded-lg border border-ob-line bg-ob-surface p-5 text-sm text-ob-slate">
          {active.steps}
        </ol>

        {/* The form itself, rebuilt from whichever service is open */}
        <div className="space-y-4">
          {active.fields.map(({ name, label, type, placeholder, saved }) => (
            <label key={name} className="block">
              <span className="mb-1.5 block text-sm text-ob-mist">
                {label}
                {type === "password" && saved(status) && (
                  <span className="ml-2 text-xs text-emerald-400">
                    already saved - leave blank to keep it
                  </span>
                )}
              </span>
              <input
                type={type}
                value={fields[name]}
                onChange={(event) =>
                  setFields((current) => ({
                    ...current,
                    [name]: event.target.value,
                  }))
                }
                placeholder={placeholder}
                spellCheck={false}
                className="w-full rounded-md border border-ob-line bg-ob-surface px-3 py-2 font-mono text-sm text-ob-mist outline-none placeholder:text-ob-slate/60 focus:border-indigo-400"
              />
            </label>
          ))}

          <p className="text-xs leading-relaxed text-ob-slate">
            These are stored locally by the FocusLab backend and are never sent
            anywhere except {active.label}. Secrets are write-only: once saved,
            the app will not hand them back out again.
          </p>
        </div>

        {/* Result of the last save attempt */}
        {message && <p className="mt-4 text-sm text-emerald-400">{message}</p>}
        {error && <p className="mt-4 text-sm text-red-400">{error}</p>}

        {/*
          Which of the two sources this service is actually running on. The
          backend only answers "database" when it found a stored key, so that
          alone means saved and in use. "environment" is the opposite: nothing
          saved here, a .env on the machine carrying it - worth saying, because
          otherwise a working service with empty boxes looks broken.
        */}
        {activeSource === "database" && (
          <p className="mt-4 rounded-md border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-xs text-emerald-300">
            In use. {active.label} is running on these keys - no restart needed.
          </p>
        )}
        {activeSource === "environment" && (
          <p className="mt-4 rounded-md border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs text-amber-300">
            {active.label} is currently running on a .env file on this machine.
            Save your own keys here and they take over.
          </p>
        )}

        {/* Actions */}
        <div className="mt-8 flex items-center gap-3">
          <button
            type="button"
            onClick={saveKeys}
            disabled={saving}
            className="rounded-full bg-white px-6 py-2.5 text-sm font-semibold text-black transition-colors hover:bg-white/90 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {saving ? "Saving..." : `Save ${active.label} keys`}
          </button>

          <Link
            href="/(1.1)Home"
            className="rounded-full border border-ob-line px-6 py-2.5 text-sm text-ob-mist transition-colors hover:bg-ob-raised"
          >
            Back to Home
          </Link>
        </div>
      </div>
    </main>
  );
}
