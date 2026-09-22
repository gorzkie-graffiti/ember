# Ember — AI Chat (self-hosted)

A Claude-style AI chat app: real streaming, vision, persistent memory,
artifacts, and a multi-provider model picker.

**Stack:** Next.js 16 (App Router) · TypeScript · Tailwind CSS 4 · shadcn/ui ·
Prisma + SQLite · OpenAI-compatible provider gateways (Groq, Cohere, G4F,
NVIDIA, OpenRouter)

---

## 0. Accounts, access requests & the admin panel

Ember is **invite-only**. Nothing except the marketing surface is reachable
without an approved account.

| Route          | Who can see it | What it is                                              |
| -------------- | -------------- | ------------------------------------------------------- |
| `/`            | everyone       | Landing page with the **Preview** and **Request access** buttons |
| `/preview`     | everyone       | Static, read-only mock of the workspace                 |
| `/register`    | everyone       | The whole sign-up: **email + why you want access**      |
| `/login`       | everyone       | Email + sign-in code (admins may use the admin password)|
| `/chat`        | approved users | The actual workspace                                   |
| `/admin`       | admins         | Approve / reject / revoke users                        |

**How it flows.** Registering asks for an email and a reason. The account is
created as `pending` and Ember shows a one-time sign-in code — the only time
it is ever displayed. An admin reviews the reason and approves or declines.
Once approved, sign in with the email + that code. Because there is no
password, an admin can mint a fresh code for anyone who loses theirs.

**Admin panel** (`/admin`) lists every account with its reason, lets you
approve, reject, revoke, restore or delete, and reset sign-in codes. Revoking
kills the person's live session on their very next request (sessions are
re-checked against the database, not just trusted from the cookie).

**Everyone has their own API keys.** Each account stores its own provider keys
under **Settings → Your API keys**; those are used for that person's requests
before the shared `.env` keys. Key values never leave the server — the UI and
APIs only ever return a last-4 hint. An account may also fall back to the
deployment's `.env` key for any provider it hasn't supplied.

### Auth environment variables

```bash
# Signs session cookies. Required in any real deployment.
AUTH_SECRET="$(node -e "console.log(require('crypto').randomBytes(32).toString('hex'))")"

# Who may sign in as admin with the password below.
# Comma-separated. "*" = any email (single-operator convenience).
ADMIN_EMAILS="you@example.com"
ADMIN_PASSWORD="a-long-random-password"
```

Sign in at `/login` with any email listed in `ADMIN_EMAILS` and
`ADMIN_PASSWORD` in the code field. Rotating `AUTH_SECRET` signs everyone out.

---

## 1. Requirements

- **Bun** (recommended) or Node.js 20+ with npm — https://bun.sh
  ```bash
  curl -fsSL https://bun.sh/install | bash
  ```
- No database server needed — SQLite, created automatically.

## 2. Install dependencies

```bash
bun install        # or: npm install
```

## 3. Set up the database

```bash
bun run db:generate   # generate the Prisma client (required after install)
bun run db:push       # creates db/custom.db from prisma/schema.prisma
```

The database URL lives in `.env` (`file:../db/custom.db`, relative to
`prisma/`). Delete `db/custom.db` anytime for a factory reset, then re-run
`bun run db:push`.

## 4. AI credentials — bring your own provider keys

There is **no built-in provider**. Every model in the picker is served
through its provider's OpenAI-compatible gateway and lights up as soon as
that provider's API key is present in `.env` (see section 5). Without any
key the site still runs, chats persist, memory/artifacts work — model
replies fail with an actionable "not configured" error.

## 5. Providers via `.env`

Each key you add instantly lights up that provider's models in the picker:

| Variable             | Provider   | Models                          |
| -------------------- | ---------- | ------------------------------- |
| `OPENROUTER_API_KEY` | OpenRouter | Auto-router, MiniMax M3         |
| `GROQ_API_KEY`       | Groq       | GPT-OSS 120B/20B, Compound      |
| `COHERE_API_KEY`     | Cohere     | Command A/A+, Aya Expanse       |
| `NVIDIA_API_KEY`     | NVIDIA NIM | Nemotron, Llama 3.3             |
| `G4F_API_KEY`        | G4F        | Gemini Flash variants           |

`*_BASE_URL` overrides are also supported (any OpenAI-compatible endpoint).
Keys are server-side only — the browser only learns whether a key exists.
**Restart the dev server after editing `.env`.**

Image analysis (vision fallback / OCR) routes through the same gateways —
currently the G4F Gemini Flash models are vision-capable, so `G4F_API_KEY`
enables it.

## 6. Run

```bash
bun run dev          # development → http://localhost:3000
```

Production:

```bash
bun run build
bun run start        # serves the standalone build
```

## 7. Scripts

| Script              | What it does                        |
| ------------------- | ----------------------------------- |
| `bun run dev`       | Dev server on port 3000             |
| `bun run lint`      | ESLint                              |
| `bun run db:push`   | Sync prisma/schema.prisma → SQLite  |
| `bun run db:generate` | Generate the Prisma client        |

## Troubleshooting

- **Can't sign in as admin** → set `ADMIN_EMAILS` to your address (or `*`) and
  `ADMIN_PASSWORD` in `.env`, then restart the dev server and use the password
  in the *sign-in code* field on `/login`.
- **"Your request is still awaiting approval"** → expected; approve the account
  from `/admin` first.
- **"<Provider> is not configured for your account"** → add your own key under
  Settings → Your API keys, or put the provider key in `.env` on the server.
- **"@prisma/client did not initialize yet"** → run `bun run db:generate`.
- **Chat error: "… is not configured on this server"** → add that provider's
  API key to `.env` and restart the dev server (see step 4).
- **Models grayed out "Not connected"** → add that provider's API key to
  `.env` and restart the dev server.
- **"No vision model is connected"** when attaching an image → add a key for
  a vision-capable provider (e.g. `G4F_API_KEY`) and restart.
- **Port 3000 busy** → `PORT=3001 bun run dev` (or edit the `dev` script).
