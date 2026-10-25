# Research Institute prototype

## Simulation environments

The same agent model can now run in three concrete worlds. **Research Institute** presents a technical laboratory, **Operations Studio** presents a coordinated office floor, and **Orbital Command** presents a space-station mission deck. Switching worlds preserves the seed, decisions, replay tape and live state while adapting the architecture and the visible roles, goals, activities, memories, records, interventions and event language. The last selection is stored locally for the user.

The renderer receives a typed environment id and derives its palette, labels, architectural props, glazing and signal colour from `lib/institute-themes.ts`. `lib/institute-theme-presentation.ts` adapts user-facing vocabulary without rewriting the stored deterministic world, so old replays remain compatible. Static structures remain batched and theme changes remount the scene so all WebGL resources are disposed before the next environment is created.

The Simulation Lab at `/dashboard/research-lab` is independent of Plans. It is a bounded fictional world with six agents, two approaches, shared equipment, computing slots and a 100-credit fictional reserve. No actual model is trained and world credits are not account credits or currency.

## Working modes

Autonomous rules mode runs locally without AI requests. Each agent chooses a legal action from its role, personal objective, available resources, memories and published evidence. Agents choose from the same prior snapshot; the engine rotates action resolution order to avoid permanently favouring one researcher. Funding transfers, preparation, experiments, instrument degradation, evidence review and approval change subsequent available actions. Results are produced by seeded world rules, never invented by an AI response.

AI-assisted mode selects the same six agents' legal actions through one bounded provider request per round. The adapter validates all six unique decisions and rejects unknown actions or oversized notes. The existing provider wrapper may use its configured availability fallback; the response records the reported provider/model identifier. Failure never silently switches the simulation to rules mode.

AI is disabled unless `LAB_AI_ENABLED=true` and the OpenRouter provider is configured. AI-assisted requests use the authenticated member's shared model allowance. The local preview deliberately has AI disabled. No real AI request is required to try the prototype.

AI calls require authentication and a matching origin. Private `ResearchDecisionBatch` reservations are made before provider calls under a PostgreSQL transaction advisory lock. The limits are six reserved batches per user and 60 globally per UTC day. Failed calls count toward those limits. Atomic claims prevent parallel duplicates; successful repeated snapshots return cached decisions. Input is bounded, output is capped at 1,800 tokens and an 18-second shared abort deadline bounds provider time. These are request/token limits, not a guaranteed dollar budget. Account credits and normal content history are untouched.

## Controls and persistence

The research floor is a real-time Three.js environment, loaded only when the lab is opened. It replaces the original SVG floor plan. Six articulated characters move along authored routes through the office, laboratory, compute suite and analysis area as their actual agent locations change. Idle, walking and workstation poses are visual representations of the current engine state; the 3D view does not invent additional research events.

The environment uses authored meshes and procedural materials, including workstation keyboards, monitors, cabinets, instruments, robot arms, chairs, server blades, cables, glass and plants. The anatomical head and eye geometry is derived from MakeHuman Community core assets and bundled with the application. Its iris texture is served locally; the scene makes no remote asset requests. Three.js is MIT licensed. Rendering uses physical materials, environment lighting, shadows, ambient occlusion and restrained bloom. Static fittings are batched by material. Balanced graphics disables the expensive effects and caps rendering resolution. Hidden tabs suspend drawing; unmounting disposes graphics resources.

The lab follows Fortify's graphite, black and silver palette. Its controls use the shared site colour variables and Sci-fi display typography. Equipment, flooring, glazing and on-screen diagrams use neutral materials; small health/fault indicators retain their semantic colours. In Sci-fi mode, an animated dotted planet above the meeting table echoes the landing-page motif. Classic hides that ambient display and uses Classic typography. Theme changes do not rebuild the world or modify recorded research states; reduced-motion preferences keep the planet static.

Camera controls include orbit, pan, zoom, room presets, an eye-level Inside view, following the selected person, a cinematic orbit and fullscreen. Arrival uses the closer Lab camera. Playback sits directly beneath the scene in both normal and fullscreen views, alongside an event menu for instrument faults, compute shortages and dataset changes. Agent details can be expanded; the default floor uses the full available width. A small scene overlay identifies the selected person's actual recorded activity. People can be selected directly in 3D, from projected name labels or through the accessible people strip. Reduced-motion preferences disable idle and limb animation, camera easing and cinematic rotation; station changes are shown immediately.

Task-area lights illuminate the work surfaces, with one softened directional shadow map and environment reflections for metal and glass. Instrument health changes bench illumination and indicator colours; compute outages dim the compute task light. Monitors show actual health, capacity and recorded experiment readings rather than decorative waveform data. Articulated poses distinguish seated reading, typing, standing bench work, equipment service, discussion, waiting and walking, with eased transitions. Only people at authored chair positions sit. These poses follow the recorded decision: a fault alone never makes a character appear to repair equipment before that agent has chosen to do so. Station and route changes leave the saved world format and seeded engine unchanged.

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

`npm run test:institute` runs engine/API, component callback, spatial route and activity-pose tests. These cover seeded reproducibility, all six roles, resource conservation, real compute contention, faulty evidence, dataset changes, approval requirements, immutable replay, request validation, auth/origin checks, duplicate reservations, daily limits, provider failure, local saving/restoration, playback, interventions, inspection, reset handling, distinct work positions and doorway routing. Model requests and storage are mocked in the backend tests; component callback tests do not verify WebGL rendering.

The local preview is produced by `../../scripts/render-institute-preview.cjs` and served on port 8455 by `../../scripts/serve-institute-preview.cjs`. It bundles the actual component, WebGL environment and engine, with both site themes, and stores progress locally. It has no account data or real credentials. The isolated headless check in `../../scripts/check-institute-3d.cjs` captures actual browser renders, checks movement after a round, selects a person through their scene label, exercises camera presets and checks mobile horizontal overflow. `example-replay.json` contains reproducible baseline and equipment-fault histories generated by the engine.

This is a stylized 3D prototype. Working poses and gestures use authored procedural animation, with planar two-bone reaches at known work surfaces. There are no imported motion-capture clips or general object-aware full-body IK. GPU performance varies by device. The production Next build and TypeScript checks pass locally. Live-provider and production-database behavior still require release validation.

## Visible teamwork and character motion

Successful actions now attach bounded, structured exchanges to their recorded events: sender, recipient, type, subject and an actual experiment identifier where relevant. Funding requests and transfers, measurement handoffs, reviews, bench readiness and engineering support are visible without changing seeded results or granting resources twice. Deferred actions and blocked experiments do not create successful handoffs. Schema-1 recordings without this optional metadata still load; the scene does not invent missing exchanges for them.

The selected person's exchanges appear as optional communication traces in the 3D room, with a single travelling marker per recorded exchange. Markers settle rather than loop indefinitely. A readable Team exchanges disclosure exposes the full current-round log and lets keyboard users select either participant. If simultaneous decisions produce a redundant request after its review in one round, scene focus favours the actual response; both records remain in the log. Replay reads only the displayed snapshot. These are recorded communications, not generated spoken dialogue.

The Team camera frames a selected agent and their co-located collaborator, with the central meeting area as its fallback. People orient and look toward real collaborators at the meeting or analysis stations. Reviewing evidence together uses a discussion pose, including a seated reviewer. Remote support does not teleport people together.

Characters have articulated wrists and fingers, anatomical head meshes with eyelid morphs, cloth surface detail and shoe fittings. Distance-based foot cycles plant the stance foot, lift the swing foot and counter-rotate the ankle. Planar arm reaches align terminal and bench work to the authored surface heights. Static details are merged within rigid body parts, while animated pivots remain independent. Reduced motion suppresses blinking, gesture oscillation and travelling markers. These visual changes leave the research clock and results unchanged.

The teamwork demonstration at the local preview's `teamwork.html` starts from four rounds generated by the actual rules engine and uses a separate device-save key, preserving the normal preview run.

## Rendering performance

The default graphics mode is Auto: render the physically lit scene directly and adapt the drawing-buffer scale between 0.7 and 1.25 after sustained frame-time windows. Device pixel ratio still caps the buffer; manual Balanced locks it to at most 1 and High to at most 1.5. High explicitly adds half-resolution ambient occlusion and restrained bloom. Effect targets are created on demand and disposed when leaving High.

Opaque character fittings use BatchedMesh submissions while their authored skeletons keep the same transforms, gestures, visibility and raycast targets. Tiny fittings use box geometry, larger rounded fittings keep their bevels with a lighter tessellation, and transparent glass uses one pass. Static transforms are baked once. The directional shadow map is 1024 square; walking refreshes it at up to 20 Hz, resting poses at 5 Hz (10 Hz on High). Labels update at most 30 Hz and unchanged semantic attributes are retained.

The renderer cancels its animation callback when the scene leaves the viewport or its document is hidden, then restarts without accumulating a hidden-time movement jump. Research rounds retain their existing controller behavior. The loading overlay remains until the first actual render, with material shaders warmed asynchronously where supported.

Optional local diagnostics are enabled with ?profile. They report drawing-buffer dimensions, textures, geometries, material programs, and sampled frame intervals / CPU submission times / all-pass draw and triangle counts. Counts explicitly include composer passes and shadow renders. These diagnostics are not a GPU timer or a universal device FPS promise. The isolated before/after benchmark and rendering-control checks live beside the preview scripts; graphics settings never alter the stored research history.

## Anatomical head replacement

The sphere-based faces have been replaced with cropped adult head/neck geometry from MakeHuman Community core assets (CC0), blended into six subtle head variations. Source revision, changes and the asset license are recorded under public/models/institute. Only head/neck and eye data are included in the application; MakeHuman application code and the full body model are not shipped.

Head data is quantized and bundled in lib/institute-head-data.json. The source fitting file maps the eye mesh onto its sockets; the iris texture's alpha mask discards the transparent cornea patch. Eyelid closure uses relative morph deltas on the head mesh, preserving the spherical eye shape. The face remains a separate mesh so character batching does not discard its morph attributes.

Hair follows the anatomical scalp and is clipped along a smooth hairline, with a small outward offset that covers the crown. Neck surfaces are narrowed and joined inside the raised shirt collar. Eyebrows are tapered surface ribbons and glasses use thin fitted rims. Existing clothing palette, actions, routes, world rules, device saves, adaptive graphics, batching and off-screen pause remain in place.

The local characters.html review shows the same head factory from front, three-quarter and profile views. A blink query is used for the closed-lid render check. This is an anatomical, stylized character pass; it does not add motion capture, facial dialogue or photographic skin capture.

The reproducible processing helper is ../../scripts/build-institute-head-assets.cjs and reads the downloaded CC0 reference inputs from ../../outputs/institute-character-source. Source processing includes eye fitting, head variation, cropping, neck fitting, scalp clipping, morph retention and numeric packing.
