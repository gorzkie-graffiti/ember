import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { RegisterForm } from "./RegisterForm";

export const metadata: Metadata = {
  title: "Request access — Ember",
  description: "Request an account on this Ember instance.",
};

export default function RegisterPage() {
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
        <RegisterForm />
      </div>
    </div>
  );
}
