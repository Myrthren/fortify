# Business setup

Business Setup turns a short interview into persistent operating context for Fortify. It is available at `/dashboard/setup` and stores one active business per user alongside any inactive saved businesses.

## Plan capacity

| Plan | Saved businesses |
| --- | ---: |
| Free | 0 |
| Pro | 1 |
| Elite | 5 |
| Apex | Unlimited |

The API enforces capacity when a business is created and serializes creation per user so parallel requests cannot exceed the allowance. A partial database index guarantees one active profile per user. The interface displays current capacity and disables the add action when the account reaches its limit.

If an account is downgraded below its existing profile count, Fortify retains the saved data rather than deleting it. The current profile remains active, but switching is locked until the user removes enough archived profiles to fit the new limit. Free accounts do not inject retained business context into AI features.

## Interview and output

The four-step interview records identity, offer, audience, demand channels, a 90-day outcome and the current constraint. On activation, Fortify creates a three-phase blueprint that links to existing tools: Company DNA for the foundation, a relevant demand surface, and an operating-system surface.

The active business is included in Advisor context and AI chat context for eligible plans. Switching the active business changes that context without deleting any other saved work. Saved context can be edited; the server revalidates the interview and regenerates recommendations after every update.

## Data and API

`BusinessProfile` belongs to a user. `GET /api/businesses` lists profiles and capacity, `POST` creates and activates one, `PATCH` changes the active profile, and `DELETE` removes a profile and promotes the most recently updated remaining profile when needed. Mutations use the existing signed-in user and origin checks.

The database change is mirrored in `prisma/business-setup.sql`. Production Netlify builds run `scripts/ensure-business.cjs` before Next.js compilation so the idempotent table and indexes exist before the release begins serving requests.
