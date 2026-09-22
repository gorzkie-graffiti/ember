import {
  loadPromptsFile,
  savePromptsFile,
  sanitizePromptDoc,
} from "@/lib/server/prompts-store";
import type { PromptsFile } from "@/lib/server/prompts-store";
import type { PromptDoc } from "@/lib/models/types";
import { authGuard } from "@/lib/auth/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** GET /api/prompts → { activeSystemPromptId, activeInstructionsId, prompts } */
export async function GET() {
  const { user, response } = await authGuard();
  if (!user) return response;

  try {
    const file = loadPromptsFile();
    return Response.json({
      activeSystemPromptId: file.activeSystemPromptId,
      activeInstructionsId: file.activeInstructionsId,
      prompts: file.prompts,
    });
  } catch (err) {
    console.error("[api/prompts] GET failed:", err);
    return Response.json({ error: "Failed to load prompts." }, { status: 500 });
  }
}

/** POST /api/prompts — create or update one doc. Body: { prompt: PromptDoc } */
export async function POST(req: Request) {
  const { user, response } = await authGuard();
  if (!user) return response;

  let raw: unknown;
  try {
    raw = await req.json();
  } catch {
    return Response.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const body = raw as { prompt?: unknown };
  const doc = sanitizePromptDoc(body.prompt);
  if (!doc) {
    return Response.json(
      { error: "Invalid prompt: expected { prompt: { name, type, origin, text } }." },
      { status: 400 },
    );
  }

  try {
    const file = loadPromptsFile();
    const idx = file.prompts.findIndex((p) => p.id === doc.id);
    if (idx >= 0) {
      // Preserve original creation time and origin on edit.
      const existing = file.prompts[idx];
      file.prompts[idx] = {
        ...doc,
        createdAt: existing.createdAt,
        origin: existing.origin,
        updatedAt: Date.now(),
      };
    } else {
      if (file.prompts.length >= 50) {
        return Response.json(
          { error: "Prompt limit reached (50). Delete some first." },
          { status: 422 },
        );
      }
      file.prompts.push(doc);
    }
    savePromptsFile(file);
    return Response.json({ ok: true, prompt: file.prompts[idx >= 0 ? idx : file.prompts.length - 1] });
  } catch (err) {
    console.error("[api/prompts] POST failed:", err);
    return Response.json({ error: "Failed to save prompt." }, { status: 500 });
  }
}

/** DELETE /api/prompts?id=... — also clears active pointers referencing it. */
export async function DELETE(req: Request) {
  const { user, response } = await authGuard();
  if (!user) return response;

  const id = new URL(req.url).searchParams.get("id");
  if (!id) {
    return Response.json({ error: "Missing required query param 'id'." }, { status: 400 });
  }

  try {
    const file = loadPromptsFile();
    const before = file.prompts.length;
    file.prompts = file.prompts.filter((p) => p.id !== id);
    if (file.prompts.length === before) {
      return Response.json({ error: "Prompt not found." }, { status: 404 });
    }
    let changed = false;
    if (file.activeSystemPromptId === id) {
      file.activeSystemPromptId = null;
      changed = true;
    }
    if (file.activeInstructionsId === id) {
      file.activeInstructionsId = null;
      changed = true;
    }
    if (changed) savePromptsFile(file);
    return Response.json({ ok: true });
  } catch (err) {
    console.error("[api/prompts] DELETE failed:", err);
    return Response.json({ error: "Failed to delete prompt." }, { status: 500 });
  }
}

export type { PromptsFile, PromptDoc };
