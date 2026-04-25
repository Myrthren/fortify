import Image from "next/image";
import Link from "next/link";
import { cn } from "@/lib/utils";

export function Logo({
  size = 32,
  withWord = false,
  className,
}: {
  size?: number;
  withWord?: boolean;
  className?: string;
}) {
  return (
    <Link href="/" className={cn("inline-flex items-center gap-2", className)}>
      <Image
        src="/fortify-icon.png"
        alt="Fortify"
        width={size}
        height={size}
        className="rounded-md"
        priority
      />
      {withWord && (
        <span className="text-text font-semibold tracking-tight">Fortify</span>
      )}
    </Link>
  );
}
