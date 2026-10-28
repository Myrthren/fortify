# Growth Missions

Growth Missions is a paid workspace at `/dashboard/missions`. A member chooses a saved business, an outcome tracked in the lead pipeline, a target, and a deadline. The offer and audience begin with the saved business profile and can be adjusted for this mission.

The workspace reads existing pipeline leads. A member explicitly adds a prospect to review, then approves or rejects it. Adding a prospect links it to the mission for review; approval marks that link as approved. Neither action sends outreach, launches a search, or spends credits. The pipeline remains account-wide, so the interface asks the member to choose leads that fit the selected business. The existing pipeline page is where members write, send outside Fortify, and record contact, reply, call-booked, won, or lost stages.

The page loads compact summaries for all missions and full lead details only for the selected mission. Its initial prospect list contains recent pipeline leads; a specific search queries the account pipeline and returns up to 100 matches, so older leads can be found by name, website or research.

The live mission progress counts approved prospects with a recorded milestone for the chosen outcome, or currently in that exact pipeline stage. Reply, call-booked and won milestones are stamped separately when an approved lead enters each stage, so a later stage change does not erase a recorded achievement. The weekly briefing is computed from saved approval times, milestone records and pipeline updates; it is not an independently verified outcome report. The next move is a rule-based prompt drawn from the pending and approved queues. Outbound Engine remains separately gated and is not part of this release.

`GrowthMission` and `GrowthMissionLead` are additive Prisma models. `prisma/deploy-safe.sql` creates the corresponding tables and indexes before the Netlify build, preserving legacy production tables. The new route checks the signed-in member, plan, business ownership, and origin before creating a mission. Prospect review routes check mission ownership and lead ownership.
