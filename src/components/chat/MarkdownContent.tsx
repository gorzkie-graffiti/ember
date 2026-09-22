"use client";

import { isValidElement, useState, type ReactNode } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import remarkBreaks from "remark-breaks";
import { Check, Copy } from "lucide-react";
import { cn } from "@/lib/utils";
import { highlightNode } from "./highlight";

function extractText(node: ReactNode): string {
  if (node == null || typeof node === "boolean") return "";
  if (typeof node === "string" || typeof node === "number") return String(node);
  if (Array.isArray(node)) return node.map(extractText).join("");
  if (isValidElement<{ children?: ReactNode }>(node)) {
    return extractText(node.props.children);
  }
  return "";
}

function CodeBlock({ children }: { children?: ReactNode }) {
  const [copied, setCopied] = useState(false);
  const code = extractText(children);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      setTimeout(() => setCopied(false), 1600);
    } catch {
      /* clipboard unavailable */
    }
  };

  return (
    <div className="group/code relative">
      <button
        aria-label="Copy code"
        onClick={copy}
        className="absolute right-2.5 top-2.5 rounded-md border border-border/60 bg-background/80 p-1.5 text-muted-foreground opacity-0 transition-opacity hover:text-foreground group-hover/code:opacity-100"
      >
        {copied ? <Check className="size-3 text-emerald-500" /> : <Copy className="size-3" />}
      </button>
      <pre>{children}</pre>
    </div>
  );
}

/**
 * Markdown renderer with optional search highlighting. When `highlight` is a
 * non-empty string, text-bearing block elements get their text nodes wrapped
 * in <mark> (see highlight.tsx). Fenced code blocks are left pristine.
 *
 * `variant` scopes the .assistant-prose styling so user bubbles and thinking
 * traces get the same GFM formatting at their own type scale.
 */
export function MarkdownContent({
  content,
  highlight,
  variant = "assistant",
}: {
  content: string;
  highlight?: string;
  variant?: "assistant" | "user" | "thinking";
}) {
  const query = highlight?.trim() ? highlight.trim() : "";

  const highlighted = query
    ? {
        p: ({ children }: { children?: ReactNode }) => (
          <p>{highlightNode(children, query)}</p>
        ),
        li: ({ children }: { children?: ReactNode }) => (
          <li>{highlightNode(children, query)}</li>
        ),
        h1: ({ children }: { children?: ReactNode }) => (
          <h1>{highlightNode(children, query)}</h1>
        ),
        h2: ({ children }: { children?: ReactNode }) => (
          <h2>{highlightNode(children, query)}</h2>
        ),
        h3: ({ children }: { children?: ReactNode }) => (
          <h3>{highlightNode(children, query)}</h3>
        ),
        h4: ({ children }: { children?: ReactNode }) => (
          <h4>{highlightNode(children, query)}</h4>
        ),
        h5: ({ children }: { children?: ReactNode }) => (
          <h5>{highlightNode(children, query)}</h5>
        ),
        h6: ({ children }: { children?: ReactNode }) => (
          <h6>{highlightNode(children, query)}</h6>
        ),
        blockquote: ({ children }: { children?: ReactNode }) => (
          <blockquote>{highlightNode(children, query)}</blockquote>
        ),
        td: ({ children }: { children?: ReactNode }) => (
          <td>{highlightNode(children, query)}</td>
        ),
        th: ({ children }: { children?: ReactNode }) => (
          <th>{highlightNode(children, query)}</th>
        ),
        pre: ({ children }: { children?: ReactNode }) => (
          <CodeBlock>{children}</CodeBlock>
        ),
        a: ({ children, href }: { children?: ReactNode; href?: string }) => (
          <a href={href} target="_blank" rel="noreferrer noopener">
            {children}
          </a>
        ),
      }
    : {
        pre: ({ children }: { children?: ReactNode }) => (
          <CodeBlock>{children}</CodeBlock>
        ),
        a: ({ children, href }: { children?: ReactNode; href?: string }) => (
          <a href={href} target="_blank" rel="noreferrer noopener">
            {children}
          </a>
        ),
      };

  return (
    <div className={cn("assistant-prose", variant !== "assistant" && `prose-${variant}`)}>
      <ReactMarkdown
        remarkPlugins={[remarkGfm, remarkBreaks]}
        components={highlighted}
      >
        {content}
      </ReactMarkdown>
    </div>
  );
}
