# Ember — Legacy Clients

Two retro clients that look and feel like Ember's web UI, built for
severely constrained devices:

| Client | Path | Target |
| --- | --- | --- |
| Android 2.3 (Gingerbread) | `android/` | Sony Ericsson Xperia X10 Mini Pro (j20i), 240x320 |
| J2ME MIDlet | `j2me/EmberVeer.java` | Sony Ericsson 176x220 (MIDP 2.0 / CLDC 1.1) |

Both talk to Ember's plain-text endpoint: `GET /v?msg=<text>&maxlen=1500`.

---

## 1. Ember design & backend recon (Phase 1 report)

### Backend

- **Framework:** Next.js 16 App Router + TypeScript, React 19, Tailwind 4,
  shadcn/ui, Zustand stores, Prisma + SQLite.
- **AI routing:** `POST /api/chat` (`src/app/api/chat/route.ts`) validates the
  body, resolves a model from the static catalog (`src/lib/models/catalog.ts`,
  default `groq/openai/gpt-oss-120b`), and streams SSE from the provider's
  OpenAI-compatible gateway (`src/lib/server/provider-gateways.ts`). Provider
  keys live in `.env` (`GROQ_API_KEY`, `OPENROUTER_API_KEY`, `COHERE_API_KEY`,
  `NVIDIA_API_KEY`, `G4F_API_KEY`); the browser only learns whether a key
  exists (`GET /api/providers`). Tool loop: `web_search` / `web_fetch` via
  `<tool_call>` blocks, guarded by `StreamingLoopGuard`.
- **Other endpoints:** `/api/memories`, `/api/vision`, `/api/artifacts`,
  `/api/conversations`, `/api/prompts`, `/api/providers`.
- **Auth:** none — self-hosted, single user. `/v` follows the same policy.

### Visual identity (light theme is the default — `defaultTheme="light"`)

Extracted from `src/app/globals.css` (Claude-derived palette):

| Token | Value | Used for |
| --- | --- | --- |
| `--surface-1` / background | `#fcfcfb` | page canvas — **window background** |
| `--surface-2` | `#f0efec` | sidebar / header bar |
| `--composer` | `#f6f6f4` | composer field |
| `--card` | `#ffffff` | cards / assistant bubble |
| `--user-bubble` | `rgba(27,27,25,0.05)` | user bubble (≈ `#f0efeb` composited) |
| `--foreground` | `#1a1a19` | primary text |
| `--muted-foreground` | `#6d6b67` | secondary text |
| `--primary` / `--clay` | `#d97757` | **accent** — send button, links, highlights |
| `--clay-emphasized` | `#c6613f` | pressed accent |
| `--clay-dark` | `#b85537` | accent on light bg |
| `--border` | `rgba(11,11,11,0.08)` | hairlines (≈ `#ededec`) |
| `--border-strong` | `rgba(11,11,11,0.16)` | strong borders (≈ `#dcdcdb`) |
| `--destructive` | `#cd2054` | errors |

Dark mode exists (`#151515` canvas) but is not the default; legacy clients
ship the light look.

### Layout & vibe

- Single-route app shell: left sidebar (288px, surface-2) + main column.
- Sticky 52px top bar; chat transcript; composer pinned to the bottom.
- **User bubbles right**, `rounded-xl` (12px) ink-5% fill, no avatar.
  Assistant messages render directly on the canvas in a serif voice
  (Copernicus → Instrument Serif fallback) — no bubble at all.
- Composer: `composer-shell` — `#f6f6f4` field, 12px radius, soft shadow,
  hairline inset ring; clay square send button with arrow icon.
- Wordmark is a serif "Ember"; logo asset `public/logo.svg` (Z glyph in a
  dark rounded square — the "Z" branding is a leftover, the wordmark is the
  real identity). Film-grain overlay at 2% opacity, warm gray tones
  throughout, font-weight 360 body text.
- Fonts on web: Geist Sans (UI), Geist Mono (code), Copernicus/Lora serif
  (assistant voice). Legacy approximations: system serif for the wordmark,
  Roboto/system sans for body (Android), `Font.FACE_SYSTEM` (J2ME).

---

## 2. `/v` endpoint (Phase 2)

`src/app/v/route.ts`:

```
GET /v?msg=<text>&maxlen=1500   →   200 text/plain; charset=utf-8
```

- Plain UTF-8 text only — no JSON, no SSE, no HTML wrapper.
- Routes through the same catalog/gateway pipeline as `/api/chat`; uses
  `DEFAULT_MODEL_ID`, non-streaming, `stream:false`.
- `maxlen` defaults to **1500** and hard-trims with an ellipsis;
  `msg` must be URL-encoded, max 4000 chars.
- Errors are also plain text: `Ember error: <reason>` with proper status
  codes (400/502/504). No auth (self-hosted, like the rest of Ember).
- System prompt forces plain prose (no markdown/emoji) since these devices
  can't render it.

Test:

```bash
curl "http://localhost:3000/v?msg=Say%20hi%20in%20five%20words"
```

---

## 3. Android 2.3 client (Phase 3)

Ant-compatible structure (no gradle):

```
android/
├── AndroidManifest.xml
├── res/
│   ├── drawable/  btn_send.xml composer_bg.xml bubble_user.xml
│   │              bubble_assistant.xml icon.xml
│   ├── layout/    main.xml
│   └── values/    colors.xml strings.xml styles.xml
└── src/com/ember/legacy/ChatActivity.java
```

- `minSdkVersion 9`, `targetSdkVersion 10`; `DefaultHttpClient` + `AsyncTask`
  only; no external libraries.
- Ember's exact palette in `res/values/colors.xml` (pre-composited where the
  web uses alpha — 2.3 shape drawables render alpha poorly).
- `EmberTheme` = stock light theme + Ember window background and text colors.
- Bubbles: user right (ink-5% fill), Ember left (white card + hairline
  border), 6dp radius ≈ the web's 12px card radius at that density; composer
  field + clay Send button match the web recipe; serif wordmark header on
  surface-2.
- Built for 240x320: 14sp text, tight 6–8dp paddings, 1px hairlines.

Build (ant):

```bash
android update project -p android -t android-10
cd android && ant debug
```

## 4. J2ME client (Phase 4)

Single file: `j2me/EmberVeer.java` (MIDP 2.0 / CLDC 1.1, no external jars).

- Full-screen `Canvas` (no Forms/Lists): oat-white canvas, surface-2 header
  with bold wordmark, clay send pill, rounded bubbles — user right (ink-5%),
  Ember left (white + hairline), 6px arcs matching the web radius.
- Composer drawn manually at the bottom; `TextBox` opens on **Fire / 0 key /
  Send-pill tap**; up/down keys and pointer drag scroll the transcript.
- Transcript persists to RMS; UTF-8 end to end; JAD/manifest block is in the
  file header comment.

Build:

```bash
javac -bootclasspath <cldc1.1+midp2.0> j2me/EmberVeer.java
preverify -classpath <cldc1.1+midp2.0> j2me
jar cfe EmberVeer.jar EmberVeer -C j2me .
```

---

## 5. Where to set EMBER_HOST

- **Android:** top of `android/src/com/ember/legacy/ChatActivity.java`

  ```java
  static final String EMBER_HOST = "http://192.168.1.10:3000";
  ```

- **J2ME:** top of `j2me/EmberVeer.java`

  ```java
  private static final String EMBER_HOST = "http://192.168.1.10:3000";
  ```

Use your LAN IP (not `localhost`) so the phone can reach the dev server, e.g.
`bun run dev --hostname 0.0.0.0` or `PORT=3000 HOSTNAME=0.0.0.0` for the
standalone build.
