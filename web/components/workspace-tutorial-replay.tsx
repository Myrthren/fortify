"use client";

import { RotateCcw } from "lucide-react";

export function WorkspaceTutorialReplay() {
  return <section className="workspace-tutorial-settings" aria-label="Workspace tutorial">
    <div><h2>Learn how Fortify works</h2><p>Explore business context, find a workspace, see saved activity, and learn where to get AI help.</p></div>
    <button type="button" onClick={() => window.dispatchEvent(new Event("fortify:tutorial-replay"))}><RotateCcw size={15}/> Replay tutorial</button>
  </section>;
}
