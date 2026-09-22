"use client";

import Image from "next/image";
import { getProvider } from "@/lib/models/providers";
import type { ProviderId } from "@/lib/models/types";
import { cn } from "@/lib/utils";

interface ProviderLogoProps {
  provider: ProviderId;
  size?: number;
  className?: string;
}

/** Renders a provider mark from /public/provider-logos. */
export function ProviderLogo({ provider, size = 20, className }: ProviderLogoProps) {
  const info = getProvider(provider);
  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center justify-center rounded-[6px] border border-border/60 bg-secondary/60 p-[3px]",
        className,
      )}
      style={{ width: size + 6, height: size + 6 }}
    >
      <Image
        src={info.logo}
        alt={`${info.name} logo`}
        width={size}
        height={size}
        className="rounded-[2px] object-contain"
      />
    </span>
  );
}

/** Small colored dot tinted with the provider accent (from config). */
export function ProviderDot({
  provider,
  className,
}: {
  provider: ProviderId;
  className?: string;
}) {
  const info = getProvider(provider);
  return (
    <span
      aria-hidden
      className={cn("inline-block size-1.5 rounded-full", className)}
      style={{ backgroundColor: info.accent }}
    />
  );
}
