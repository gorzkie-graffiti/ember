import type { Metadata } from "next";
import Link from "next/link";
import {
  ArrowRight,
  Brain,
  Eye,
  KeyRound,
  LayoutGrid,
  PlayCircle,
  ShieldCheck,
  Sparkles,
  UserCheck,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { getAuthUser } from "@/lib/auth/server";

export const metadata: Metadata = {
  title: "Ember — a self-hosted AI workspace",
  description:
    "Ember is a private AI chat workspace: streaming replies, vision, memory, artifacts and bring-your-own provider keys. Request access to get started.",
};

const FEATURES = [
  {
    icon: Sparkles,
    title: "Real streaming chat",
    body: "Token-by-token replies with thinking, effort controls and a model picker spanning Groq, Cohere, NVIDIA, OpenRouter and G4F.",
  },
  {
    icon: Eye,
    title: "Vision & attachments",
    body: "Drop in images, PDFs and code. Ember analyses, OCRs and reads them into the conversation.",
  },
  {
    icon: Brain,
    title: "Durable memory",
    body: "Facts worth keeping are captured server-side and carried into every future conversation.",
  },
  {
    icon: LayoutGrid,
    title: "Artifacts & projects",
    body: "Long-form output lands in an artifact panel you can preview, edit and export.",
  },
  {
    icon: KeyRound,
    title: "Bring your own keys",
    body: "Every account stores its own provider API keys server-side. You control the spend and the models.",
  },
  {
    icon: ShieldCheck,
    title: "Private by default",
    body: "Everything sits behind an approved account. Your conversations, memory and artifacts stay yours.",
  },
];

const STEPS = [
  {
    icon: UserCheck,
    step: "01",
    title: "Request access",
    body: "Tell us your email and why you want in. That's the whole form.",
  },
  {
    icon: ShieldCheck,
    step: "02",
    title: "Get reviewed",
    body: "An admin approves or declines from the panel. You hold a sign-in code from the moment you register.",
  },
  {
    icon: Sparkles,
    step: "03",
    title: "Open the workspace",
    body: "Sign in, add your own provider keys, and start chatting.",
  },
];

export default async function LandingPage() {
  const user = await getAuthUser();

  return (
    <div className="min-h-dvh bg-background text-foreground">
      {/* Ambient wash */}
      <div
        aria-hidden
        className="pointer-events-none fixed inset-x-0 top-0 h-[520px] bg-[radial-gradient(60%_100%_at_50%_0%,rgba(217,119,87,0.16),transparent_70%)]"
      />

      <header className="relative z-10">
        <nav className="mx-auto flex max-w-6xl items-center justify-between px-5 py-5 sm:px-8">
          <Link href="/" className="flex items-center gap-2.5">
            <img src="/logo.svg" alt="" className="size-7" />
            <span className="font-display text-xl tracking-tight">Ember</span>
          </Link>
          <div className="flex items-center gap-2">
            {user ? (
              <>
                <Button asChild variant="ghost" className="h-9 rounded-full text-[13px]">
                  <Link href="/chat">Open workspace</Link>
                </Button>
                {user.role === "admin" ? (
                  <Button asChild className="h-9 rounded-full text-[13px]">
                    <Link href="/admin">Admin</Link>
                  </Button>
                ) : null}
              </>
            ) : (
              <>
                <Button
                  asChild
                  variant="ghost"
                  className="h-9 rounded-full text-[13px]"
                >
                  <Link href="/login">Sign in</Link>
                </Button>
                <Button asChild className="h-9 rounded-full px-4 text-[13px]">
                  <Link href="/register">Request access</Link>
                </Button>
              </>
            )}
          </div>
        </nav>
      </header>

      <main className="relative z-10">
        {/* Hero */}
        <section className="mx-auto max-w-6xl px-5 pb-16 pt-10 sm:px-8 sm:pt-20">
          <div className="mx-auto max-w-3xl text-center">
            <span className="inline-flex items-center gap-2 rounded-full border border-border/70 bg-card/70 px-3 py-1 text-[11.5px] font-medium uppercase tracking-[0.14em] text-muted-foreground backdrop-blur">
              <span className="size-1.5 rounded-full bg-primary" />
              Self-hosted · invite only
            </span>
            <h1 className="mt-6 font-display text-[44px] leading-[1.05] tracking-tight sm:text-6xl">
              Your own AI workspace,
              <br className="hidden sm:block" />{" "}
              <span className="text-primary">under your keys.</span>
            </h1>
            <p className="mx-auto mt-6 max-w-xl text-[15px] leading-relaxed text-muted-foreground sm:text-base">
              Ember is a private chat client with streaming replies, vision,
              memory and artifacts — running on the providers you connect. Access
              is reviewed by the admin, so the door stays shut until you&apos;re in.
            </p>

            <div className="mt-9 flex flex-col items-center justify-center gap-3 sm:flex-row">
              <Button
                asChild
                size="lg"
                className="h-11 w-full gap-2 rounded-full px-6 text-[14px] sm:w-auto"
              >
                <Link href="/preview">
                  <PlayCircle className="size-4" />
                  Preview the interface
                </Link>
              </Button>
              <Button
                asChild
                size="lg"
                variant="outline"
                className="h-11 w-full gap-2 rounded-full border-border-strong px-6 text-[14px] sm:w-auto"
              >
                <Link href="/register">
                  Request access
                  <ArrowRight className="size-4" />
                </Link>
              </Button>
            </div>
            <p className="mt-4 text-[12.5px] text-muted-foreground">
              The preview needs no account. Setting up a workspace does.
            </p>
          </div>

          {/* Preview card */}
          <Link
            href="/preview"
            className="group mx-auto mt-14 block max-w-4xl rounded-2xl border border-border/70 bg-card p-2 shadow-[0_24px_60px_-30px_rgba(11,11,11,0.35)] transition-transform duration-300 hover:-translate-y-0.5"
          >
            <div className="overflow-hidden rounded-xl border border-border/60 bg-background">
              <div className="flex items-center gap-1.5 border-b border-border/60 bg-secondary/60 px-3 py-2.5">
                <span className="size-2.5 rounded-full bg-muted-foreground/30" />
                <span className="size-2.5 rounded-full bg-muted-foreground/30" />
                <span className="size-2.5 rounded-full bg-muted-foreground/30" />
                <span className="ml-3 truncate font-mono text-[11px] text-muted-foreground">
                  ember · chat
                </span>
                <span className="ml-auto flex items-center gap-1.5 text-[11.5px] font-medium text-primary">
                  <PlayCircle className="size-3.5" />
                  Open preview
                </span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-[190px_1fr]">
                <div className="hidden flex-col gap-2 border-r border-border/60 bg-sidebar p-3 sm:flex">
                  {["Debugging a Prisma migration", "Trip plan: Lisbon", "Rewrite my resume", "Explain WebSockets"].map(
                    (title, i) => (
                      <div
                        key={title}
                        className={`truncate rounded-lg px-2.5 py-1.5 text-[12px] ${
                          i === 0
                            ? "bg-sidebar-accent text-sidebar-accent-foreground"
                            : "text-muted-foreground"
                        }`}
                      >
                        {title}
                      </div>
                    ),
                  )}
                </div>
                <div className="flex min-h-[240px] flex-col gap-3 p-5">
                  <div className="ml-auto max-w-[75%] rounded-xl bg-[var(--user-bubble)] px-3.5 py-2 text-[13px] leading-relaxed">
                    Why does my Prisma enum migration fail on SQLite?
                  </div>
                  <div className="max-w-[85%] text-[13px] leading-relaxed text-foreground">
                    SQLite has no native enum type — Prisma maps it to a{" "}
                    <code className="rounded bg-secondary px-1 py-0.5 font-mono text-[11.5px]">
                      TEXT
                    </code>{" "}
                    column with a check constraint. Let&apos;s look at what your
                    migration is actually emitting…
                  </div>
                  <div className="mt-auto flex items-center gap-2 rounded-xl border border-border/60 bg-composer px-3 py-2.5 text-[12.5px] text-muted-foreground">
                    <Sparkles className="size-3.5 text-primary" />
                    Ask Ember anything…
                  </div>
                </div>
              </div>
            </div>
          </Link>
        </section>

        {/* Features */}
        <section className="mx-auto max-w-6xl px-5 py-16 sm:px-8">
          <h2 className="font-display text-3xl tracking-tight sm:text-4xl">
            Everything a chat app should do
          </h2>
          <p className="mt-3 max-w-2xl text-[14.5px] leading-relaxed text-muted-foreground">
            One workspace, many providers. Ember is a single-route client — chat,
            artifacts, memory and settings all live in the same shell.
          </p>
          <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {FEATURES.map(({ icon: Icon, title, body }) => (
              <div
                key={title}
                className="rounded-xl border border-border/60 bg-card p-5 transition-colors hover:border-border-strong"
              >
                <span className="flex size-9 items-center justify-center rounded-lg bg-[var(--clay-soft)] text-primary">
                  <Icon className="size-[18px]" />
                </span>
                <h3 className="mt-3.5 text-[14.5px] font-semibold">{title}</h3>
                <p className="mt-1.5 text-[13px] leading-relaxed text-muted-foreground">
                  {body}
                </p>
              </div>
            ))}
          </div>
        </section>

        {/* How access works */}
        <section className="mx-auto max-w-6xl px-5 py-16 sm:px-8">
          <div className="rounded-2xl border border-border/60 bg-secondary/40 p-6 sm:p-10">
            <h2 className="font-display text-3xl tracking-tight sm:text-4xl">
              How you get in
            </h2>
            <div className="mt-8 grid gap-6 sm:grid-cols-3">
              {STEPS.map(({ icon: Icon, step, title, body }) => (
                <div key={step}>
                  <div className="flex items-center gap-3">
                    <span className="flex size-8 items-center justify-center rounded-lg bg-card text-primary">
                      <Icon className="size-4" />
                    </span>
                    <span className="font-mono text-[12px] text-muted-foreground">
                      {step}
                    </span>
                  </div>
                  <h3 className="mt-3 text-[15px] font-semibold">{title}</h3>
                  <p className="mt-1.5 text-[13px] leading-relaxed text-muted-foreground">
                    {body}
                  </p>
                </div>
              ))}
            </div>
            <div className="mt-9 flex flex-wrap gap-3">
              <Button
                asChild
                className="h-10 gap-2 rounded-full px-5 text-[13.5px]"
              >
                <Link href="/register">
                  Request access <ArrowRight className="size-4" />
                </Link>
              </Button>
              <Button
                asChild
                variant="outline"
                className="h-10 gap-2 rounded-full border-border-strong px-5 text-[13.5px]"
              >
                <Link href="/login">I already have access</Link>
              </Button>
            </div>
          </div>
        </section>
      </main>

      <footer className="relative z-10 border-t border-border/60">
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-3 px-5 py-8 text-[12.5px] text-muted-foreground sm:flex-row sm:px-8">
          <span className="flex items-center gap-2">
            <img src="/logo.svg" alt="" className="size-4" />
            Ember · self-hosted AI chat
          </span>
          <div className="flex items-center gap-4">
            <Link href="/preview" className="hover:text-foreground">
              Preview
            </Link>
            <Link href="/register" className="hover:text-foreground">
              Request access
            </Link>
            <Link href="/login" className="hover:text-foreground">
              Sign in
            </Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
