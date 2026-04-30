"use client";
import { useRouter } from "next/navigation";

export function DealDelete({ id }: { id: string }) {
  const router = useRouter();
  async function remove() {
    await fetch(`/api/deals/${id}`, { method: "DELETE" });
    router.refresh();
  }
  return (
    <button onClick={remove} className="text-xs text-text-muted hover:text-red-400">
      Remove
    </button>
  );
}
