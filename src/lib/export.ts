import type { Conversation } from "@/lib/models/types";
import { getModel } from "@/lib/models/catalog";

/**
 * Serialize a conversation to clean markdown. Attachments become footnote
 * references; thinking traces are collapsed sections.
 */
export function conversationToMarkdown(conversation: Conversation): string {
  const lines: string[] = [];
  const date = new Date(conversation.createdAt).toLocaleString();

  lines.push(`# ${conversation.title}`);
  lines.push("");
  lines.push(
    `> Exported from Ember · ${conversation.incognito ? "Incognito chat" : "Chat"} · ${date} · ${
      getModel(conversation.modelId)?.displayName ?? conversation.modelId
    }`,
  );
  lines.push("");

  if (conversation.messages.length === 0) {
    lines.push("_No messages._");
    return lines.join("\n");
  }

  for (const m of conversation.messages) {
    const who = m.role === "user" ? "🧑 **You**" : `✨ **${m.modelDisplayName ?? "Assistant"}**`;
    const time = new Date(m.createdAt).toLocaleTimeString([], {
      hour: "2-digit",
      minute: "2-digit",
    });

    lines.push(`### ${who} · ${time}`);
    lines.push("");

    if (m.attachments?.length) {
      for (const a of m.attachments) {
        const via = a.visionAnalysis
          ? ` _(analyzed via ${a.visionAnalysis.viaModelName})_`
          : a.extractedText
            ? " _(text extracted)_"
            : "";
        lines.push(`- 📎 \`${a.name}\`${via}`);
      }
      lines.push("");
    }

    if (m.thinking) {
      lines.push("<details>");
      lines.push("<summary>Thinking</summary>");
      lines.push("");
      lines.push(m.thinking);
      lines.push("");
      lines.push("</details>");
      lines.push("");
    }

    lines.push(m.content || "_…_");
    lines.push("");
  }

  return lines.join("\n");
}

export function downloadConversationMarkdown(conversation: Conversation) {
  const md = conversationToMarkdown(conversation);
  const blob = new Blob([md], { type: "text/markdown;charset=utf-8" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = `${conversation.title.replace(/[^\w\s-]/g, "").trim().replace(/\s+/g, "-").slice(0, 60) || "chat"}.md`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(a.href);
}
