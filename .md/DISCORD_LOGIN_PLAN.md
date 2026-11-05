# Discord login — plan

Add "Sign in with Discord" next to the existing Google sign-in. Not built yet.

## How Google sign-in works today

Auth is **Neon Auth** (`@neondatabase/auth` 0.5.0-beta, a managed Better Auth). The app holds no
OAuth code of its own:

| Piece | File | Role |
| --- | --- | --- |
| Server client | `lib/auth/server.ts` | `createNeonAuth({ baseUrl, cookies.secret })` |
| Browser client | `lib/auth/client.ts` | `createAuthClient()` |
| Route proxy | `app/api/auth/[...path]/route.ts` | `auth.handler()` forwards OAuth start/callback to Neon |
| UI provider | `app/auth-provider.tsx` | `NeonAuthUIProvider social={{ providers: ['google'] }}` |
| Sign-in pages | `app/auth/[path]/page.tsx` | `<AuthView>` draws the email form and one button per provider |
| Session users | `app/account/page.tsx`, `app/api/{run,state,community}/…` | read `user.id`, `user.name`, `user.email` |

The Google client ID/secret live in the Neon console (Project → Auth → OAuth providers), not in
`.env`. Users live in Neon's own auth schema; Prisma tables only store `userId` strings
(`prisma/schema.prisma`, top comment).

So for Google, "adding a provider" was: enable it in the Neon console + list it in
`social.providers`. Discord should be the same **if Neon Auth offers Discord**.

## Step 0 — check Neon supports Discord (blocker)

Neon's public docs (Nov 2026) list only Google, GitHub and Vercel/Microsoft, and say providers
can't be added beyond that list. Discord is not mentioned. Before any code:

1. Open the Neon console → Auth → OAuth providers and look for Discord.
2. Check the `social.providers` type in `node_modules/@neondatabase/auth` (after `pnpm install`):
   does the provider union include `'discord'`?

If both say yes → **Path A**. If not → **Path B** (owner decision).

## Path A — Neon offers Discord (expected: ~1 hour)

1. **Discord app.** discord.com/developers/applications → New Application ("Floored").
   OAuth2 → copy Client ID and Client Secret. Add the redirect URI Neon shows for Discord in its
   console (Neon hosts the callback; do *not* invent one). Scopes: `identify email`.
   Add a separate redirect for each environment Neon gives (dev/preview/prod), if it gives several.
2. **Neon console.** Enable Discord, paste the ID/secret. Nothing goes in `.env.example`
   (same as Google) — note that in this doc once done.
3. **Code** — one line in `app/auth-provider.tsx`:
   ```tsx
   social={{ providers: ['google', 'discord'] }}
   ```
   `<AuthView>` then shows the Discord button on `/auth/sign-in` and `/auth/sign-up`
   automatically. No route, schema or Prisma change.
4. **Account linking.** Decide what happens when a Google user signs in with Discord using the
   same email. Better Auth links accounts only for "trusted" providers; otherwise the user gets an
   "account not linked" error. Prefer linking (Neon console setting, if exposed). If it isn't
   exposed, accept separate accounts and say so on the sign-in page.
5. **Display name.** Discord gives `name` (global name, else username) and an email that may be
   unverified. The existing fallback `user.name || user.email.split('@')[0]` already handles
   both; check `app/api/community/*` where names are cut to 32 chars.
6. **Optional polish.** Show which provider an account uses on `/account` ("Signed in with
   Discord") via `authClient.listAccounts()`; let a signed-in user link the other provider from
   `/account` with `authClient.linkSocial({ provider: 'discord' })`. Only if the owner wants it.

## Path B — Neon has no Discord (owner decision)

Options, best first:

1. **Wait / ask Neon.** File a request with Neon and ship GitHub instead if a second provider is
   wanted now (same one-line change as Path A). Zero risk.
2. **Self-host Better Auth on the same Neon Postgres.** Better Auth has a built-in Discord
   provider. Replace `lib/auth/*`, the route handler and the UI provider with Better Auth's
   server/client (and a UI kit or hand-built buttons from the shared pieces). The big job is
   **keeping user ids**: every `userId` in `Run`, `UserState`, `LeaderboardEntry`,
   `CommunityChallenge*`, `UserCosmetic` points at a Neon Auth id. Migrate Neon Auth's user and
   account rows into Better Auth's tables with the same ids, or every signed-in player loses
   their synced progress. Also re-register the Google client (callback URL changes to ours) and
   move secrets into `.env`. Estimate: 1–2 days plus a careful migration rehearsal on a Neon branch.
3. **Hand-rolled Discord OAuth beside Neon Auth.** Not recommended: we can't mint Neon Auth
   sessions ourselves, so it would be a second session system and every API route would need to
   check both.

## Testing (either path)

- New user via Discord → lands signed in; `/account` shows the Discord name and email.
- Play a survival run → `/api/run` stores it under the new `userId`; refresh keeps it.
- Guest progress moves into the new account on first sign-in (`components/account-sync.tsx`).
- Existing Google user, same email, signs in with Discord → linked or a clear error (step 4).
- Discord account with no verified email → sign-in still works or fails with a clear message.
- Sign out, sign back in with Discord → same account, same data.
- Phone width (360px): both provider buttons fit on `/auth/sign-in`.
- `npx tsc --noEmit` and `pnpm lint` (three known errors only).

## Open questions for the owner

1. If Neon has no Discord: wait (B1), or migrate to self-hosted Better Auth (B2)?
2. Same email across Google and Discord: link into one account, or keep separate?
3. Want the "linked sign-ins" panel on `/account` (A6), or just the button?
