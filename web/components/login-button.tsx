"use client";

import { signIn } from "next-auth/react";
import { useState } from "react";
import { Loader2 } from "lucide-react";

export function LoginButton() {
  const [pending, setPending] = useState(false);

  return (
    <button
      type="button"
      disabled={pending}
      onClick={() => {
        setPending(true);
        signIn("discord", { callbackUrl: "/dashboard" });
      }}
      className="btn-secondary w-full py-3 text-base"
      style={{ background: "#5865F2", borderColor: "#4752C4", color: "#fff" }}
    >
      {pending ? (
        <Loader2 className="h-5 w-5 animate-spin" />
      ) : (
        <DiscordIcon />
      )}
      Continue with Discord
    </button>
  );
}

function DiscordIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-5 w-5" fill="currentColor">
      <path d="M20.317 4.369A19.79 19.79 0 0016.558 3a14.7 14.7 0 00-.617 1.262 18.27 18.27 0 00-5.882 0A14.7 14.7 0 009.442 3a19.79 19.79 0 00-3.76 1.369C2.064 9.79 1.07 15.062 1.567 20.26a19.94 19.94 0 005.993 3.013 14.42 14.42 0 001.281-2.07 12.85 12.85 0 01-2.018-.964c.169-.124.334-.253.494-.387a14.27 14.27 0 0012.366 0c.16.134.325.263.494.387a12.85 12.85 0 01-2.02.965 14.42 14.42 0 001.282 2.07 19.94 19.94 0 005.993-3.013c.59-6.012-1.001-11.235-3.115-15.892zM8.02 16.65c-1.184 0-2.156-1.087-2.156-2.422s.954-2.421 2.156-2.421c1.21 0 2.174 1.094 2.156 2.42 0 1.336-.954 2.423-2.156 2.423zm7.96 0c-1.184 0-2.156-1.087-2.156-2.422s.954-2.421 2.156-2.421c1.21 0 2.174 1.094 2.156 2.42 0 1.336-.946 2.423-2.156 2.423z" />
    </svg>
  );
}
