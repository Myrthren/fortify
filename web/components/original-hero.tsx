import Link from "next/link";
import Image from "next/image";
import { ArrowRight, ArrowUpRight, Check, Compass, FileText, Fingerprint, Sparkles, Workflow } from "lucide-react";

/** Illustrative product UI, clearly labelled and independent of account data. */
function WorkspaceIllustration() {
  return <div className="classic-product-scene">
    <div className="classic-product-glow" aria-hidden="true" />
    <div className="classic-product-window">
      <div className="classic-window-bar"><span className="classic-window-dots" aria-hidden="true"><i/><i/><i/></span><span>Fortify workspace</span><span className="classic-example-label">Example view</span></div>
      <div className="classic-window-body">
        <div className="classic-mini-nav"><Image src="/fortify-mark.png" alt="" width={24} height={24}/><span className="selected"><Compass size={16}/></span><Fingerprint size={16}/><Workflow size={16}/><FileText size={16}/></div>
        <div className="classic-mini-main">
          <div className="classic-mini-heading"><div><span>YOUR WORKSPACE</span><h2>Good ideas. Clear next steps.</h2></div><Sparkles size={18}/></div>
          <div className="classic-mini-action"><span className="classic-mini-icon"><Fingerprint size={20}/></span><div><strong>Built around your business.</strong><p>Your context. Your voice. Better starting points.</p></div></div>
          <div className="classic-mini-section"><span>A little less busywork.</span><ArrowUpRight size={13}/></div>
          <div className="classic-mini-row"><span className="classic-mini-icon"><Compass size={15}/></span><div><strong>Find the right people</strong><p>Research a focused list of prospects</p></div><ArrowRight size={13}/></div>
          <div className="classic-mini-row"><span className="classic-mini-icon"><FileText size={15}/></span><div><strong>Find the right words</strong><p>Draft outreach in your brand voice</p></div><ArrowRight size={13}/></div>
          <div className="classic-mini-workflow"><span><Check size={10}/> Research</span><i/><span><Check size={10}/> Draft</span><i/><span className="current">Review <ArrowUpRight size={10}/></span></div>
        </div>
      </div>
    </div>
    <div className="classic-product-caption"><span className="classic-caption-mark"><Image src="/fortify-mark.png" alt="" width={22} height={22}/></span><span>One account. Two ways to work.<small>On the web and inside Discord.</small></span><ArrowUpRight size={15}/></div>
  </div>;
}

export function OriginalHero() {
  return <section className="classic-hero">
    <div className="classic-hero-inner">
      <div className="classic-hero-copy">
        <span className="classic-community"><Image src="/fortify-mark.png" alt="" width={16} height={16}/> Built for the Fortune Fortress</span>
        <h1>The AI co-pilot<br/>for <span>online business.</span></h1>
        <p>Find the right leads. Write in your own voice. Bring your tools and your people together, with a little help from AI.</p>
        <div className="classic-hero-actions"><Link href="/login" className="btn-primary">Start free <ArrowRight size={16}/></Link><Link href="#features" className="btn-secondary">Explore the tools <ArrowUpRight size={15}/></Link></div>
        <div className="classic-hero-note"><Check size={13}/> No card needed <span>·</span> Sign in with Discord</div>
      </div>
      <WorkspaceIllustration/>
    </div>
    <div className="classic-hero-bottom"><span>Less switching. More moving forward.</span><div><span>Business context</span><i/><span>AI tools</span><i/><span>Your community</span></div></div>
  </section>;
}
