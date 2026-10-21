# Research Institute prototype

The Simulation Lab at `/dashboard/research-lab` is independent of Plans. It is a bounded fictional research world with six agents, two research approaches, shared equipment, computing slots and an 100-credit fictional grant. No actual model is trained and lab credits are not account credits or currency.

## Working modes

Autonomous rules mode runs locally without AI requests. Each agent chooses a legal action from its role, personal objective, available resources, memories and published evidence. Agents choose from the same prior snapshot; the engine rotates action resolution order to avoid permanently favouring one researcher. Funding transfers, preparation, experiments, instrument degradation, evidence review and approval change subsequent available actions. Results are produced by seeded world rules, never invented by an AI response.

AI-assisted mode selects the same six agents' legal actions through one bounded provider request per round. The adapter validates all six unique decisions and rejects unknown actions or oversized notes. The existing provider wrapper may use its configured availability fallback; the response records the reported provider/model identifier. Failure never silently switches the simulation to rules mode.

AI is disabled unless `LAB_AI_ENABLED=true` and an existing Anthropic or Groq provider is configured. The local preview deliberately has AI disabled. No real AI request is required to try the prototype.

AI calls require authentication and a matching origin. Private `ResearchDecisionBatch` reservations are made before provider calls under a PostgreSQL transaction advisory lock. The limits are six reserved batches per user and 60 globally per UTC day. Failed calls count toward those limits. Atomic claims prevent parallel duplicates; successful repeated snapshots return cached decisions. Input is bounded, output is capped at 1,800 tokens and an 18-second shared abort deadline bounds provider time. These are request/token limits, not a guaranteed dollar budget. Account credits and normal content history are untouched.

## Controls and persistence

- Run, pause, choose playback speed or advance one round at a time.
- Inspect each agent's current action, concise decision note and recent memory.
- Inspect raw, reviewed, rejected and retired experimental readings.
- Introduce an instrument fault, a new test distribution, a three-round compute shortage, a grant reduction or an emergency grant.
- Change the research priority between balanced, reliability first and rapid iteration.
- Replay recorded snapshots without altering the latest state, return to the latest snapshot and resume.
- Autosave to the current browser device and export the full session as JSON. Each signed-in account uses a separate device key and component instance.

Sessions stop after approval or 24 rounds. Up to 40 interventions are permitted. A closed page stops executing; it resumes from the last device save when reopened. There is no always-running world worker, cross-device save, import interface, team collaboration or branch manager in this prototype. The first implementation is not load-tested for many concurrent users. Use one active tab per saved session.

The benchmark is intentionally fictional and simple: scores depend on the selected approach, prototype revision, test-distribution revision, instrument condition and seeded noise. Prior prototype/dataset readings remain visible but cannot support approval of the current configuration. A result can fail because of resource choices or unavailable evidence; success is not scripted.

## Storage and release

`ResearchDecisionBatch` is mirrored in both Prisma schemas. The additive `prisma/research-institute.sql` is prepared and verified by `scripts/ensure-institute.cjs` during Netlify production builds. It adds one private table and indexes; it does not delete or alter existing member data. Rules mode uses no server decision storage. Other environments must apply the additive SQL before enabling AI mode. No production database changes, hosting purchases or deployments are necessary to review the local prototype.

## Checks and preview

`npm run test:institute` runs engine/API tests and component callback tests. These cover seeded reproducibility, all six roles, resource conservation, real compute contention, faulty evidence, dataset changes, approval requirements, immutable replay, request validation, auth/origin checks, duplicate reservations, daily limits, provider failure, local saving/restoration, playback, interventions, inspection and reset handling. Model requests and storage are mocked in the backend tests; component callback tests do not verify browser layout or real DOM events.

The local preview is produced by `../../scripts/render-institute-preview.cjs` and served on port 8455 by `../../scripts/serve-institute-preview.cjs`. It bundles the actual component and engine, with both site themes, and stores progress locally. It has no account data or real credentials. `research-floor.svg/png` is an export of the actual floor component and generated round-eight state, not a screenshot. `example-replay.json` contains reproducible baseline and equipment-fault histories generated by the engine.
