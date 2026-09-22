import { loadPromptsFile, savePromptsFile } from "@/lib/server/prompts-store";
import { authGuard } from "@/lib/auth/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * PUT /api/prompts/active
 * Body: { slot: "system-prompt" | "instructions", id: string | null }
 *
 * Slot rules:
 * - "system-prompt": replaces Ember's built-in system prompt entirely.
 * - "instructions": appended after the system prompt as the user's own
 *   standing instructions. Styles are allowed here (that's how a style gets
 *   applied to every reply); System Prompts are allowed too.
 */
export async function PUT(req: Request) {
  const { user, response } = await authGuard();
  if (!user) return response;

  let raw: unknown;
  try {
    raw = await req.json();
  } catch {
    return Response.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const body = raw as { slot?: unknown; id?: unknown };
  if (body.slot !== "system-prompt" && body.slot !== "instructions") {
    return Response.json(
      { error: 'slot must be "system-prompt" or "instructions".' },
      { status: 400 },
    );
  }
  if (body.id !== null && typeof body.id !== "string") {
    return Response.json(
      { error: "id must be a string or null (null clears the slot)." },
      { status: 400 },
    );
  }

  try {
    const file = loadPromptsFile();
    if (typeof body.id === "string") {
      const doc = file.prompts.find((p) => p.id === body.id);
      if (!doc) {
        return Response.json({ error: "Prompt not found." }, { status: 404 });
      }
    }

    if (body.slot === "system-prompt") {
      file.activeSystemPromptId = body.id;
    } else {
      file.activeInstructionsId = body.id;
    }
    savePromptsFile(file);
    return Response.json({
      ok: true,
      activeSystemPromptId: file.activeSystemPromptId,
      activeInstructionsId: file.activeInstructionsId,
    });
  } catch (err) {
    console.error("[api/prompts/active] PUT failed:", err);
    return Response.json({ error: "Failed to save selection." }, { status: 500 });
  }
}
