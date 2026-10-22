import { redirect } from "next/navigation";

// Retired feature: keep old bookmarks useful without exposing logo tools.
export default function RetiredLogoPage() {
  redirect("/dashboard");
}
