"use client";

import { useEffect, useRef, useState } from "react";
import { Bot, X, SendHorizontal, Paperclip, Plus } from "lucide-react";

import AgentMarkdown from "./AgentMarkdown";

/*
 * FocusAI — the chat panel.
 *
 * Posts to Client_MCP/http_MCP.py, which hands the transcript to the LangGraph
 * agent, which drives the Canvas MCP server over stdio. That service runs
 * separately from the main backend, hence its own base URL.
 *
 * The transcript is owned here and resent in full with every message: the
 * agent endpoint keeps no session, so this state is the conversation.
 */

const AGENT_URL = process.env.NEXT_PUBLIC_AGENT_URL ?? "http://localhost:8001";

type Message = {
  id: number;
  role: "user" | "agent";
  text: string;
};

const GREETING: Message = {
  id: 0,
  role: "agent",
  text: "Hey — I'm FocusAI. Ask me about your Canvas courses, your grades, or what you still owe.",
};

// Shown under an untouched transcript as one-tap starting points.
const SUGGESTIONS = [
  "What are my grades this semester?",
  "What have I not submitted?",
  "List my courses",
];

export default function FocusAIPanel({ onClose }: { onClose: () => void }) {
  const [messages, setMessages] = useState<Message[]>([GREETING]);
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const endRef = useRef<HTMLDivElement>(null);

  // Keep the newest message in view, including while one is still pending.
  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, sending]);

  async function send(text: string) {
    const question = text.trim();
    if (!question || sending) return;

    const asked: Message[] = [
      ...messages,
      { id: Date.now(), role: "user", text: question },
    ];
    setMessages(asked);
    setDraft("");
    setError(null);
    setSending(true);

    try {
      const res = await fetch(`${AGENT_URL}/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          // The panel calls the model's turns "agent"; the API wants the name
          // the model itself uses.
          messages: asked.map((message) => ({
            role: message.role === "agent" ? "assistant" : "user",
            content: message.text,
          })),
        }),
      });
      if (!res.ok) throw new Error();

      const { reply } = await res.json();
      setMessages((prev) => [
        ...prev,
        { id: Date.now() + 1, role: "agent", text: reply },
      ]);
    } catch {
      setError("FocusAI did not answer. Is the agent service running?");
    } finally {
      setSending(false);
    }
  }

  const untouched = messages.length === 1;

  return (
    <div className="fixed bottom-4 left-60 z-50 flex w-[24rem] flex-col overflow-hidden rounded-2xl border border-ob-line/60 bg-ob-surface shadow-2xl shadow-black/40 h-[min(36rem,calc(100vh-2rem))]">
      {/* Header */}
      <header className="flex items-center gap-3 border-b border-ob-line/60 px-4 py-3">
        <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-ob-raised text-ob-mist">
          <Bot size={16} />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium text-ob-mist">FocusAI</p>
          <p className="text-xs text-ob-slate">Your study agent</p>
        </div>
        <button
          type="button"
          onClick={() => {
            setMessages([GREETING]);
            setError(null);
          }}
          className="rounded-lg p-1.5 text-ob-slate transition-colors hover:bg-ob-raised hover:text-ob-mist"
          title="New chat"
        >
          <Plus size={16} />
        </button>
        <button
          type="button"
          onClick={onClose}
          className="rounded-lg p-1.5 text-ob-slate transition-colors hover:bg-ob-raised hover:text-ob-mist"
          title="Close"
        >
          <X size={16} />
        </button>
      </header>

      {/* Transcript */}
      <div className="flex flex-1 flex-col gap-4 overflow-y-auto px-4 py-4">
        {messages.map((message) =>
          message.role === "user" ? (
            <div key={message.id} className="flex justify-end">
              <p className="max-w-[85%] whitespace-pre-wrap rounded-2xl rounded-br-md bg-ob-raised px-3.5 py-2.5 text-sm leading-relaxed text-ob-mist">
                {message.text}
              </p>
            </div>
          ) : (
            <div key={message.id} className="flex gap-2.5">
              <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-ob-raised text-ob-slate">
                <Bot size={13} />
              </span>
              <div className="min-w-0 max-w-[85%] rounded-2xl rounded-tl-md border border-ob-line/60 bg-ob-base px-3.5 py-2.5 text-sm text-ob-mist">
                <AgentMarkdown text={message.text} />
              </div>
            </div>
          ),
        )}

        {sending && (
          <div className="flex gap-2.5">
            <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-ob-raised text-ob-slate">
              <Bot size={13} />
            </span>
            <p className="rounded-2xl rounded-tl-md border border-ob-line/60 bg-ob-base px-3.5 py-2.5 text-sm text-ob-slate">
              Thinking…
            </p>
          </div>
        )}

        {error && (
          <p className="rounded-xl border border-ob-line/60 bg-ob-base px-3.5 py-2.5 text-xs text-ob-slate">
            {error}
          </p>
        )}

        {untouched && !sending && (
          <div className="flex flex-wrap gap-2 pt-1">
            {SUGGESTIONS.map((suggestion) => (
              <button
                key={suggestion}
                type="button"
                onClick={() => send(suggestion)}
                className="rounded-full border border-ob-line px-3 py-1.5 text-xs text-ob-slate transition-colors hover:border-ob-slate hover:text-ob-mist"
              >
                {suggestion}
              </button>
            ))}
          </div>
        )}

        <div ref={endRef} />
      </div>

      {/* Composer */}
      <div className="border-t border-ob-line/60 p-3">
        <div className="flex items-end gap-2 rounded-xl border border-ob-line bg-ob-base px-3 py-2 focus-within:border-ob-slate">
          <button
            type="button"
            className="pb-1 text-ob-slate transition-colors hover:text-ob-mist"
            title="Attach a note"
          >
            <Paperclip size={15} />
          </button>
          <textarea
            rows={1}
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            onKeyDown={(event) => {
              // Enter sends; Shift+Enter is how you get a second line.
              if (event.key === "Enter" && !event.shiftKey) {
                event.preventDefault();
                send(draft);
              }
            }}
            placeholder="Ask FocusAI anything…"
            className="max-h-28 flex-1 resize-none bg-transparent py-1 text-sm text-ob-mist placeholder:text-ob-slate focus:outline-none"
          />
          <button
            type="button"
            onClick={() => send(draft)}
            disabled={!draft.trim() || sending}
            className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-ob-raised text-ob-mist transition-colors hover:bg-ob-line disabled:opacity-40 disabled:hover:bg-ob-raised"
            title="Send"
          >
            <SendHorizontal size={14} />
          </button>
        </div>
        <p className="mt-2 text-center text-[11px] text-ob-slate">
          FocusAI can make mistakes. Check anything important.
        </p>
      </div>
    </div>
  );
}
