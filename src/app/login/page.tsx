import type { Metadata } from "next";
import { Suspense } from "react";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { LoginForm } from "./LoginForm";

export const metadata: Metadata = {
  title: "Sign in — Ember",
  description: "Sign in to this Ember instance.",
};

export default function LoginPage() {
  return (
    <div className="relative flex min-h-dvh flex-col items-center justify-center bg-background px-5 py-12">
      <div
        aria-hidden
        className="pointer-events-none fixed inset-x-0 top-0 h-[420px] bg-[radial-gradient(60%_100%_at_50%_0%,rgba(217,119,87,0.14),transparent_70%)]"
      />
      <Link
        href="/"
        className="relative z-10 mb-8 flex items-center gap-1.5 text-[13px] text-muted-foreground transition-colors hover:text-foreground"
      >
        <ArrowLeft className="size-3.5" />
        Back to home
      </Link>
      <div className="relative z-10 flex w-full justify-center">
        <Suspense fallback={<div className="h-[360px] w-full max-w-md" />}>
          <LoginForm />
        </Suspense>
      </div>
    </div>
  );
}
