import { ParticleField } from "./particle-field";
import { OriginalHero } from "./original-hero";
import Link from "next/link";
import { ArrowRight, ArrowUpRight } from "lucide-react";
import { FortifyScene } from "./fortify-scene";

export function CommandHero() {
  return (
    <>
    <div className="theme-original-only"><OriginalHero /></div>
    <div className="theme-scifi-only"><section className="command-hero">
      <ParticleField className="hero-particle-tide" />
      <div className="command-hero-inner">
        <div className="command-copy">
          <h1>A clearer signal.<br /><span>Your next move.</span></h1>
          <p>Find the right leads. Make the right connections. Put AI to work with the context of your business.</p>
          <div className="command-actions"><Link href="/login" className="btn-primary">Start free <ArrowRight size={16} /></Link><Link href="#features" className="btn-secondary">Explore Fortify <ArrowUpRight size={16} /></Link></div>
          <p className="command-note">No card needed. Sign in with Discord.</p>
        </div>
        <FortifyScene kind="signal" />
      </div>
      <div className="command-rail"><span>01 / YOUR BUSINESS COMMAND CENTRE</span><span>RESEARCH <i /> CONNECT <i /> EXECUTE</span></div>
    </section></div>
    </>
  );
}
