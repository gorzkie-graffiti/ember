"use client";

import { Fragment, cloneElement, isValidElement, type ReactNode } from "react";
import type { ChatMessage } from "@/lib/models/types";

/** Escape user input before embedding in a RegExp. */
export function escapeRegExp(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/** Case-insensitive occurrence count of `needle` inside `haystack`. */
export function countOccurrences(haystack: string, needle: string): number {
  if (!needle) return 0;
  const hay = haystack.toLowerCase();
  const ned = needle.toLowerCase();
  let count = 0;
  let pos = hay.indexOf(ned);
  while (pos !== -1) {
    count++;
    pos = hay.indexOf(ned, pos + ned.length);
  }
  return count;
}

/**
 * Split a plain string on `query` (case-insensitive), wrapping each match
 * in a <mark>. Returns the original string when the query is empty.
 */
export function splitOnQuery(text: string, query: string): ReactNode {
  if (!query) return text;
  const regex = new RegExp(`(${escapeRegExp(query)})`, "gi");
  const parts = text.split(regex);
  if (parts.length === 1) return text;
  const lower = query.toLowerCase();
  return parts.map((part, i) =>
    part.toLowerCase() === lower ? <mark key={i}>{part}</mark> : <Fragment key={i}>{part}</Fragment>,
  );
}

/**
 * Recursively walk a ReactNode tree and wrap query matches in <mark>.
 * Skips <pre> subtrees (block code stays clean) and leaves non-text nodes
 * untouched. Used by MarkdownContent to support in-chat search highlighting.
 */
export function highlightNode(node: ReactNode, query: string): ReactNode {
  if (!query || node == null || typeof node === "boolean") return node;
  if (typeof node === "string" || typeof node === "number") {
    return splitOnQuery(String(node), query);
  }
  if (Array.isArray(node)) {
    return node.map((child, i) => highlightNode(child, query));
  }
  if (isValidElement<{ children?: ReactNode }>(node)) {
    // Keep fenced code blocks pristine.
    if (node.type === "pre") return node;
    const children = node.props?.children;
    if (children !== undefined) {
      return cloneElement(node, undefined, highlightNode(children, query));
    }
  }
  return node;
}

/** Inline <mark>-wrapped text for plain (non-markdown) strings. */
export function HighlightText({ text, query }: { text: string; query?: string }) {
  if (!query) return <>{text}</>;
  return <>{splitOnQuery(text, query)}</>;
}

/* ------------------------------------------------------------------ */
/* In-chat search match computation                                    */
/* ------------------------------------------------------------------ */

/**
 * Flatten every query occurrence across a conversation into an ordered list
 * (one entry per occurrence), so a cursor index maps 1:1 to a message.
 * Searches message content, thinking traces, and attachment names.
 */
export function computeSearchMatches(
  messages: ChatMessage[],
  query: string,
): { total: number; messageIds: string[] } {
  const q = query.trim().toLowerCase();
  if (!q) return { total: 0, messageIds: [] };
  const messageIds: string[] = [];
  for (const m of messages) {
    const haystack = [
      m.content,
      m.thinking ?? "",
      ...(m.attachments ?? []).map((a) => a.name),
    ]
      .join("\n")
      .toLowerCase();
    let pos = haystack.indexOf(q);
    while (pos !== -1) {
      messageIds.push(m.id);
      pos = haystack.indexOf(q, pos + q.length);
    }
  }
  return { total: messageIds.length, messageIds };
}
