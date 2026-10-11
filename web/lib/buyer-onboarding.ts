type Progress = { dna: boolean; voice: boolean; research: boolean; draft: boolean };
type Step = { title: string; description: string; href: string; done: boolean };

export function buyerOnboarding(tier: string, progress: Progress): Step[] {
  if (tier === "FREE") return [
    { title: "Try a free draft", description: "Explore hook generation. Saved brand voices and competitor research require a paid plan.", href: "/dashboard#hook-generator", done: progress.draft },
    { title: "See the paid workflow", description: "Compare plans for business context, brand voice and competitor research. No subscription starts here.", href: "/pricing", done: false },
  ];
  return [
    { title: "1. Add business context", description: "Save your audience, offer and constraints in Company DNA.", href: "/dashboard/company-dna", done: progress.dna },
    { title: "2. Save your brand voice", description: "Use your own writing samples to personalise hooks and outreach.", href: "/dashboard/voice", done: progress.voice },
    { title: "3. Research one competitor", description: "Scan a rival, inspect the findings and choose an evidence-backed angle.", href: "/dashboard/competitors", done: progress.research },
    { title: "4. Turn the angle into hooks", description: "Paste a supported research angle below. Your saved context and active voice apply automatically.", href: "/dashboard#hook-generator", done: progress.draft },
  ];
}
