import { redirect } from "next/navigation";

/**
 * is-a.dev deployment: the subdomain IS the preview.
 * Everything lands on the read-only interface tour; sign-in stays at /login.
 */
export default function Home() {
  redirect("/preview");
}
