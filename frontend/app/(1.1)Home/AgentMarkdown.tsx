"use client";

import ReactMarkdown, { type Components } from "react-markdown";
import remarkGfm from "remark-gfm";
import { Download } from "lucide-react";

/*
 * The agent answers in Markdown — bold course names, bulleted lists, and,
 * when it has been asked for lecture slides, links to Canvas files. Printing
 * that as text left the links as unclickable "[L1.Automata.pdf](https://…)",
 * which is the whole reason this exists.
 *
 * Raw HTML is not enabled, so a reply cannot inject markup into the page.
 */

// A Canvas file link, as opposed to a link to a page. Canvas stamps its
// pre-signed file URLs with download_frd=1; the extension test catches
// anything else that is plainly a file.
function isDownload(href: string) {
  return (
    /download_frd=1/.test(href) ||
    /\.(pdf|docx?|pptx?|xlsx?|zip|csv|txt|png|jpe?g)(\?|$)/i.test(href)
  );
}

// Defined out here so the map keeps one identity across renders.
const COMPONENTS: Components = {
  p: ({ children }) => <p className="leading-relaxed">{children}</p>,

  strong: ({ children }) => (
    <strong className="font-semibold text-white">{children}</strong>
  ),

  em: ({ children }) => <em className="italic">{children}</em>,

  a: ({ href, children }) => {
    const url = href ?? "";

    // A file gets a chip with an icon, big enough to be an obvious target -
    // this is the thing the user actually came to click.
    if (isDownload(url)) {
      return (
        <a
          href={url}
          target="_blank"
          rel="noopener noreferrer"
          className="my-0.5 inline-flex max-w-full items-center gap-1.5 rounded-lg border border-ob-line bg-ob-raised px-2.5 py-1.5 text-xs text-ob-mist transition-colors hover:border-ob-slate hover:bg-ob-line"
        >
          <Download size={13} className="shrink-0 text-ob-slate" />
          <span className="truncate">{children}</span>
        </a>
      );
    }

    return (
      <a
        href={url}
        target="_blank"
        rel="noopener noreferrer"
        className="break-words text-ob-mist underline decoration-ob-slate underline-offset-2 transition-colors hover:decoration-ob-mist"
      >
        {children}
      </a>
    );
  },

  ul: ({ children }) => (
    <ul className="list-disc space-y-1 pl-4 marker:text-ob-slate">{children}</ul>
  ),
  ol: ({ children }) => (
    <ol className="list-decimal space-y-1 pl-4 marker:text-ob-slate">
      {children}
    </ol>
  ),
  li: ({ children }) => <li className="leading-relaxed">{children}</li>,

  // The agent only ever reaches for small headings, so they are sized as
  // emphasis rather than as document structure.
  h1: ({ children }) => (
    <p className="font-semibold text-white">{children}</p>
  ),
  h2: ({ children }) => (
    <p className="font-semibold text-white">{children}</p>
  ),
  h3: ({ children }) => (
    <p className="font-semibold text-white">{children}</p>
  ),

  code: ({ children }) => (
    <code className="rounded bg-ob-raised px-1 py-0.5 font-mono text-[0.8em]">
      {children}
    </code>
  ),
  pre: ({ children }) => (
    <pre className="overflow-x-auto rounded-lg border border-ob-line/60 bg-ob-void p-2.5 text-xs">
      {children}
    </pre>
  ),

  // Grade questions come back as tables often enough to be worth styling.
  // The wrapper scrolls so a wide one never widens the panel.
  table: ({ children }) => (
    <div className="overflow-x-auto">
      <table className="w-full border-collapse text-left text-xs">
        {children}
      </table>
    </div>
  ),
  th: ({ children }) => (
    <th className="border-b border-ob-line px-2 py-1.5 font-medium text-ob-slate">
      {children}
    </th>
  ),
  td: ({ children }) => (
    <td className="border-b border-ob-line/40 px-2 py-1.5">{children}</td>
  ),

  hr: () => <hr className="border-ob-line/60" />,

  blockquote: ({ children }) => (
    <blockquote className="border-l-2 border-ob-line pl-3 text-ob-slate">
      {children}
    </blockquote>
  ),
};

export default function AgentMarkdown({ text }: { text: string }) {
  return (
    // space-y sets the gap between blocks, so no element needs its own margin.
    <div className="space-y-2">
      <ReactMarkdown remarkPlugins={[remarkGfm]} components={COMPONENTS}>
        {text}
      </ReactMarkdown>
    </div>
  );
}
