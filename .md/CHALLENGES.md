# Challenges, Community challenges and the Daily Ladder

Three modes added together, plus the Ladder shortened to 15 rungs. The site now offers:
Daily (the daily challenge and the daily ladder, tabbed), Ladder (endless runs),
Challenges (house), Community (player-made), Tables and Freeplay.

## Challenges (house)

- 20 hand-made, themed challenges in `lib/challenges/presets.ts`. Each has 2–6 games and
  1–6 bets per game, a min bet, and starts at **1,000** (`CHALLENGE_START_BANKROLL`).
- Rules are the Daily's: one shared bankroll, place every bet (any order); the attempt
  fails if the bankroll drops below the min bet with bets left; leaving a game mid-round
  forfeits that round's stake (the bet still counts); give up any time.
- Unlike the Daily, retries are unlimited. **Stats per challenge: tries** (counted when an
  attempt starts) **and best bankroll** (the end bankroll of an attempt with every bet
  placed; failed and given-up attempts never set a best). Completions are counted too.
- Preset ids are stable: stats are keyed by them. Add new challenges at the end; never
  reuse or renumber an id.

## Community challenges

- `/community` lists player-made challenges (newest or most played, 60 at most) and has
  the create form. Creating needs a signed-in account; playing doesn't.
- Same limits as house challenges, checked by `validateChallengeInput`
  (`lib/challenges/types.ts`) on the client and in the route: name 3–40, theme 2–24,
  description ≤ 160, min bet from `CHALLENGE_MIN_BET_OPTIONS`, 2–6 distinct games, 1–6 bets
  each, start 1,000. At most 25 published challenges per account.
- API: `app/api/community/route.ts` (GET list, POST create) and
  `app/api/community/[id]/route.ts` (GET one with its top ten; POST `{event:'try'}` when an
  attempt starts, `{event:'result', endReason, endBankroll}` when it ends). The store sends
  one of each per attempt, never per bet, to keep Neon asleep.
- Tables: `CommunityChallenge` (with a `tries` counter) and `CommunityChallengeScore` (best
  completed result per signed-in player, a float so large bankrolls fit), migration
  `prisma/migrations/20261102120000_add_community_challenges`. **Run
  `npx prisma migrate deploy` when deploying**; until then the list shows "couldn't be
  loaded" and everything else keeps working.
- The player's own tries and best per community challenge live in the same local store as
  the house ones (keyed `community:<id>`), so they sync with the account.
- Results are reported by the client, so a determined player could post a fake best. It's
  play money; there is no server-side replay.

## How it's built

- Game mode `'challenge'` (`store/types.ts`). Routes: `/challenges` (house list),
  `/community` (community list + create), `/challenge` (the attempt in progress: bet slip,
  games, result) and `/challenge/[game]`.
- `store/challenge-store.ts` (`floored-challenges`, synced as `challenges`): one attempt at
  a time (a copy of its definition, so community challenges replay unchanged) and `stats`
  keyed `preset:<id>` / `community:<id>`. Starting a different challenge with one in
  progress asks first and ends the old one as given up.
- `useChallengeGameBankroll` (`hooks/use-game-bankroll.ts`), the min bet in
  `useGameMinBet`, the dock's end state in `useRunEnd`. Dev curse/bless/force-tie never
  apply in challenges.
- UI: `components/challenges/` (card, start flow with the replace dialog, profile records).
- Profile (`/account` → Records): **Challenges** and **Community challenges** are
  collapsed rows with totals (tried, tries, best); opening one lists every challenge's
  tries and best.

## Daily Ladder and the 15-rung Ladder

- `LADDER_RUNGS` is 15 (was 18). Checkpoints stay every 3 rungs (5 checkpoints). A climb
  saved past rung 15 tops out on its next clear (`topped` uses `>=`).
- `store/ladder-store.ts` is a factory with two instances: `useLadderStore` (endless,
  `floored-ladder`) and `useDailyLadderStore` (`floored-daily-ladder`, synced as
  `daily-ladder`). Same rules; the daily one allows **one climb per UTC day**, has no
  Abandon (cash out ends it), and seeds every picker from the date and a draw counter, so
  every player taking the same path sees the same games. A climb left over from an earlier
  day is closed (banked as it stands) when the page opens. The Ladder's "lives only count
  from the first checkpoint" rule applies here too: a fall before rung 3 restarts the climb
  from the ground (with a seeded picker), so the daily's first rungs can be retried.
- Routes `/daily-ladder` and `/daily-ladder/[game]` reuse `components/ladder/ladder-hub.tsx`
  and `ladder-game-page.tsx`. Hooks pick the store by route with `useActiveLadderStore()` /
  `useLadderHub()` (`lib/ladder/active.ts`); the game mode is still `'ladder'`.
- `/daily` and `/daily-ladder` share a tab strip (`components/daily/daily-tabs.tsx`); the
  navbar's Daily link covers both.

## Not done / to check

- The create form and the signed-in score path were type-checked and the signed-out API
  paths were run against a local Postgres, but publishing and saving a best need Neon Auth
  and weren't run end to end.
- No leaderboard page for a community challenge yet (the API already returns a top ten).
- No moderation or deleting of community challenges.
