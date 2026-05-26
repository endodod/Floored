# Graph Report - .  (2026-05-22)

## Corpus Check
- 157 files · ~85,462 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 1078 nodes · 3114 edges · 69 communities (49 shown, 20 thin omitted)
- Extraction: 99% EXTRACTED · 1% INFERRED · 0% AMBIGUOUS · INFERRED: 32 edges (avg confidence: 0.89)
- Token cost: 0 input · 0 output

## Community Hubs (Navigation)
- [[_COMMUNITY_Multi-Game UI Components|Multi-Game UI Components]]
- [[_COMMUNITY_Survival Run Engine & Upgrades|Survival Run Engine & Upgrades]]
- [[_COMMUNITY_Blackjack Card System|Blackjack Card System]]
- [[_COMMUNITY_Floor Generation & Missions|Floor Generation & Missions]]
- [[_COMMUNITY_NPM Dependencies|NPM Dependencies]]
- [[_COMMUNITY_State Initialization & Migration|State Initialization & Migration]]
- [[_COMMUNITY_Bet Panel UI|Bet Panel UI]]
- [[_COMMUNITY_Home Page & Difficulty|Home Page & Difficulty]]
- [[_COMMUNITY_Plinko Board|Plinko Board]]
- [[_COMMUNITY_Roulette Engine|Roulette Engine]]
- [[_COMMUNITY_Poker Hand Engine|Poker Hand Engine]]
- [[_COMMUNITY_App Layout & Modals|App Layout & Modals]]
- [[_COMMUNITY_Case Battles Engine|Case Battles Engine]]
- [[_COMMUNITY_Lobby & Mission Panel|Lobby & Mission Panel]]
- [[_COMMUNITY_TypeScript Config|TypeScript Config]]
- [[_COMMUNITY_Keno Engine|Keno Engine]]
- [[_COMMUNITY_HiLo Engine|HiLo Engine]]
- [[_COMMUNITY_Run Dice Engine|Run Dice Engine]]
- [[_COMMUNITY_Survival Store & Run State|Survival Store & Run State]]
- [[_COMMUNITY_Balance Audit & EV Analysis|Balance Audit & EV Analysis]]
- [[_COMMUNITY_Mines Engine|Mines Engine]]
- [[_COMMUNITY_Survival UI Panels|Survival UI Panels]]
- [[_COMMUNITY_Game Layout & Dock Components|Game Layout & Dock Components]]
- [[_COMMUNITY_Fortune Wheel Engine|Fortune Wheel Engine]]
- [[_COMMUNITY_Chicken Race Engine|Chicken Race Engine]]
- [[_COMMUNITY_Coin Flip Engine|Coin Flip Engine]]
- [[_COMMUNITY_Chicken Road Engine|Chicken Road Engine]]
- [[_COMMUNITY_Platform Architecture & Conventions|Platform Architecture & Conventions]]
- [[_COMMUNITY_Slots Engine|Slots Engine]]
- [[_COMMUNITY_ShadCN UI Config|ShadCN UI Config]]
- [[_COMMUNITY_Dragon Tower Engine|Dragon Tower Engine]]
- [[_COMMUNITY_Survival Balance & Reroll System|Survival Balance & Reroll System]]
- [[_COMMUNITY_Street Cups Engine|Street Cups Engine]]
- [[_COMMUNITY_Run Summary UI|Run Summary UI]]
- [[_COMMUNITY_Over-Under Engine|Over-Under Engine]]
- [[_COMMUNITY_Crash Game Engine|Crash Game Engine]]
- [[_COMMUNITY_Slots UI Patcher|Slots UI Patcher]]
- [[_COMMUNITY_Roulette UI Patcher|Roulette UI Patcher]]
- [[_COMMUNITY_Gambling Quotes Widget|Gambling Quotes Widget]]
- [[_COMMUNITY_Dev Mode & BlessCurse Mechanics|Dev Mode & Bless/Curse Mechanics]]
- [[_COMMUNITY_Floor Mission Variants|Floor Mission Variants]]
- [[_COMMUNITY_Tailwind & Next.js Config|Tailwind & Next.js Config]]
- [[_COMMUNITY_Claude Settings Permissions|Claude Settings Permissions]]
- [[_COMMUNITY_Crash Curve Animation|Crash Curve Animation]]
- [[_COMMUNITY_ESLint Config|ESLint Config]]
- [[_COMMUNITY_Layout Stability Rule|Layout Stability Rule]]
- [[_COMMUNITY_Next.js Config Module|Next.js Config Module]]
- [[_COMMUNITY_PostCSS Config|PostCSS Config]]
- [[_COMMUNITY_Supabase Client|Supabase Client]]
- [[_COMMUNITY_Perk Proc Chances|Perk Proc Chances]]
- [[_COMMUNITY_Balance Value Table|Balance Value Table]]
- [[_COMMUNITY_minBetMult Mission System|minBetMult Mission System]]
- [[_COMMUNITY_Game Component Props Contract|Game Component Props Contract]]
- [[_COMMUNITY_Design Color Palette|Design Color Palette]]
- [[_COMMUNITY_Plinko Game Reference|Plinko Game Reference]]
- [[_COMMUNITY_Mines Game Reference|Mines Game Reference]]
- [[_COMMUNITY_Dragon Tower Game Reference|Dragon Tower Game Reference]]
- [[_COMMUNITY_Chicken Race Game Reference|Chicken Race Game Reference]]
- [[_COMMUNITY_Chicken Road Game Reference|Chicken Road Game Reference]]
- [[_COMMUNITY_1P Poker Game Reference|1P Poker Game Reference]]
- [[_COMMUNITY_Fortune Wheel Game Reference|Fortune Wheel Game Reference]]
- [[_COMMUNITY_Run Dice Game Reference|Run Dice Game Reference]]
- [[_COMMUNITY_Over-Under Game Reference|Over-Under Game Reference]]

## God Nodes (most connected - your core abstractions)
1. `useSurvivalStore` - 79 edges
2. `formatChips()` - 59 edges
3. `useSettingsStore` - 42 edges
4. `useSurvivalPerks()` - 40 edges
5. `useBless()` - 38 edges
6. `useCurse()` - 38 edges
7. `useSurvivalGameOver()` - 38 edges
8. `useBetGuard()` - 35 edges
9. `usePerkProc()` - 30 edges
10. `buildPendingResult()` - 28 edges

## Surprising Connections (you probably didn't know these)
- `Floored Next.js Configuration` --references--> `Floored Casino Simulation Platform`  [INFERRED]
  next.config.mjs → AI_HANDSHAKE.md
- `Floored App Icon (F letter, green on dark)` --conceptually_related_to--> `Floored Casino Simulation Platform`  [INFERRED]
  app/icon.svg → AI_HANDSHAKE.md
- `leveledItems()` --calls--> `build`  [INFERRED]
  lib/survival/upgrades-catalog.ts → package.json
- `cn()` --calls--> `clsx`  [INFERRED]
  lib/utils.ts → package.json
- `Tech Stack (Next.js, Zustand, Radix, Framer Motion, Supabase, Prisma)` --references--> `Floored Next.js Configuration`  [INFERRED]
  README.md → next.config.mjs

## Hyperedges (group relationships)
- **Shared Game Control Dock Component Pattern** — game_component_gamedockchiprow, game_component_gamedockbetrow, game_component_gamedocksettledrow, game_template_control_zone, ai_handshake_game_layout_ts [EXTRACTED 0.95]
- **Balance Audit → Red Flags → Mega Prompt Fix Loop** — balance_audit_red_flags, balance_audit_game_breakdown, mega_prompt_crash_ev, mega_prompt_street_cups_ev, mega_prompt_keno_ev [INFERRED 0.85]
- **Survival Spark Economy Constants Cluster** — ai_handshake_balance_ts, balance_audit_spark_economy, mega_prompt_starting_sparks, mega_prompt_over_quota_sparks, mega_prompt_reroll_tickets_floor [EXTRACTED 0.95]

## Communities (69 total, 20 thin omitted)

### Community 0 - "Multi-Game UI Components"
Cohesion: 0.05
Nodes (159): BlackjackGame(), BlackjackGameProps, CARD_CSS, CaseBattlesGame(), CaseBattlesGameProps, CaseBattlesResult, ItemSlot(), PendingResult (+151 more)

### Community 1 - "Survival Run Engine & Upgrades"
Cohesion: 0.06
Nodes (51): GameResolvePayload, PurchasedUpgrade, applyResolveModifiers(), ResolveModifierResult, migratePurchasedUpgradeIds(), getPerkProcChance(), perkProcChancePercent(), perkRequiresProcRoll() (+43 more)

### Community 2 - "Blackjack Card System"
Cohesion: 0.12
Nodes (42): CardBack(), CardFace(), cardInner, cardShell, isRedSuit(), blackjackEngine, buildBlessedDeck(), buildCursedDeck() (+34 more)

### Community 3 - "Floor Generation & Missions"
Cohesion: 0.09
Nodes (36): FloorMission, GameName, sparkFloorMult(), fisherYates(), generateFloor(), generateRunSchedule(), pickLobbyGameReroll(), clampProgress() (+28 more)

### Community 4 - "NPM Dependencies"
Cohesion: 0.05
Nodes (38): dependencies, class-variance-authority, clsx, framer-motion, lucide-react, next, pixi.js, @prisma/client (+30 more)

### Community 5 - "State Initialization & Migration"
Cohesion: 0.10
Nodes (33): initFloorTicketRerollState(), initShopSlotState(), calcQuotaTarget(), lobbyGamesOfferedFromFloor(), migratePersistedState(), missionOfferedKeysFromMissions(), addOfferedId(), availableIdsForShopSlot() (+25 more)

### Community 6 - "Bet Panel UI"
Cohesion: 0.09
Nodes (23): BetPanel(), Props, formatTime(), HistoryEntryCard(), toneBorder(), toneTitle(), GameOutcomeToast(), GameOutcomeToastProps (+15 more)

### Community 7 - "Home Page & Difficulty"
Cohesion: 0.12
Nodes (21): DIFFICULTIES, DifficultyDialog(), Props, FloorPanel(), FELT, ModeSelect(), Difficulty, calcMissionRerollCost() (+13 more)

### Community 8 - "Plinko Board"
Cohesion: 0.13
Nodes (22): easeIn(), getBallPos(), lerp(), PlinkoBall, PlinkoBoard(), PlinkoBoardProps, pinX(), pinY() (+14 more)

### Community 9 - "Roulette Engine"
Cohesion: 0.14
Nodes (21): BET_LABELS, BET_PAYOUTS, EUROPEAN_WHEEL_ORDER, formatRouletteResultLabel(), getNumberColor(), getOutcomeLabelForTarget(), getPayoutForTarget(), initRoulette() (+13 more)

### Community 10 - "Poker Hand Engine"
Cohesion: 0.16
Nodes (21): buildLosingHand(), createDeck(), dealHand(), drawCards(), evaluateHand(), getWinningIndices(), HAND_LABELS, HAND_PAYOUTS (+13 more)

### Community 11 - "App Layout & Modals"
Cohesion: 0.11
Nodes (16): inter, metadata, BankruptModal(), BankruptModalProps, Navbar(), FreeplayGamePage(), SurvivalGamePage(), useFreeplayGameBankroll() (+8 more)

### Community 12 - "Case Battles Engine"
Cohesion: 0.12
Nodes (20): addCase(), CASE_MULTIPLIERS, CASE_TEMPLATES, computeCost(), getCases(), initCaseBattle(), ITEM_TIERS, loseGame() (+12 more)

### Community 13 - "Lobby & Mission Panel"
Cohesion: 0.15
Nodes (17): GameEntry, GAMES, Lobby(), Props, calcShopPrice(), SURVIVAL_GAME_POOL, applyLobbyGameReroll(), availableLobbyGamesForSlot() (+9 more)

### Community 14 - "TypeScript Config"
Cohesion: 0.09
Nodes (21): compilerOptions, allowJs, esModuleInterop, incremental, isolatedModules, jsx, lib, module (+13 more)

### Community 15 - "Keno Engine"
Cohesion: 0.15
Nodes (20): applyRevealStats(), clearKenoPicks(), computeKenoStats(), drawNumbers(), getKenoMultiplier(), getKenoPayout(), HIT_MULTIPLIERS, initKeno() (+12 more)

### Community 16 - "HiLo Engine"
Cohesion: 0.15
Nodes (19): ALL_CARDS, bumpStreak(), cashOutHiLo(), goAgainHiLo(), guessHiLo(), initHiLo(), loseGame(), randomCard() (+11 more)

### Community 17 - "Run Dice Engine"
Cohesion: 0.15
Nodes (19): classifyRunDiceTotal(), generateRunDiceConfig(), getPayoutMultiplier(), getRunDicePayout(), getWinProbability(), getWinWeight(), initRunDice(), loseGame() (+11 more)

### Community 18 - "Survival Store & Run State"
Cohesion: 0.16
Nodes (15): RUN_PERSIST_KEYS, ConsumableStack, DefeatReason, DiceConfig, FloorRecord, GameMode, GameResult, Modifier (+7 more)

### Community 19 - "Balance Audit & EV Analysis"
Cohesion: 0.12
Nodes (19): Survival Perks Helpers (lib/survival/survival-perks.ts), useSurvivalPerks Hook (hooks/use-survival-perks.ts), Individual Game Balance Breakdown, Balance Red Flags and EV Outliers, Blackjack Game, Coin Flip Game, Crash Game, Keno Game (+11 more)

### Community 20 - "Mines Engine"
Cohesion: 0.15
Nodes (16): blessedCashOutMines(), buildTiles(), cashOutMines(), DIFFICULTY_MINES, getMinesPayout(), initMines(), loseGame(), randomTiles() (+8 more)

### Community 21 - "Survival UI Panels"
Cohesion: 0.16
Nodes (14): ActiveItemsPanel(), ShopOffer, slotIdsToOffers(), GAME_STYLES, gameLabel(), GameNavLink(), OwnedUpgradesList(), RARITY_TONE (+6 more)

### Community 22 - "Game Layout & Dock Components"
Cohesion: 0.25
Nodes (18): Game Layout Constants (components/game-layout.ts), Case Battles Game, GameActiveBetBadge Component, GameDockBackButton Component, GameDockBetRow Component, GameDockChipRow Component, GameDockSettledRow Component, GameFieldWithHistory Component (+10 more)

### Community 23 - "Fortune Wheel Engine"
Cohesion: 0.16
Nodes (15): getTargetRotation(), getWheelPayout(), initWheel(), loseGame(), pickResultColor(), previewWheelOutcome(), SEGMENT_DEGREES, spinWheel() (+7 more)

### Community 24 - "Chicken Race Engine"
Cohesion: 0.15
Nodes (13): Chicken, CHICKENS, generateRaceFrames(), initChickenRace(), loseGame(), pickWinner(), previewRaceOutcome(), settleRace() (+5 more)

### Community 25 - "Coin Flip Engine"
Cohesion: 0.21
Nodes (13): cap(), cashOut(), flip(), flipAgain(), initCoinFlip(), loseFlipAgain(), loseGame(), startFlip() (+5 more)

### Community 26 - "Chicken Road Engine"
Cohesion: 0.20
Nodes (13): advanceChickenRound(), advanceChickenRoundSafe(), advanceChickenStepSuccess(), cashOutChicken(), getChickenPayout(), initChicken(), loseGame(), randomChance() (+5 more)

### Community 27 - "Platform Architecture & Conventions"
Cohesion: 0.14
Nodes (15): Engine Purity Convention, Floored Casino Simulation Platform, Freeplay Store (store/freeplay-store.ts), Game Registry (lib/game-registry.tsx), Lobby Component (components/lobby.tsx), onResolve Bankroll Contract, Store Types (store/types.ts), Survival Store (store/survival-store.ts) (+7 more)

### Community 28 - "Slots Engine"
Cohesion: 0.19
Nodes (13): getSlotsResultPayout(), initSlots(), loseGame(), PAYTABLE, REEL, resolveReels(), spinReel(), spinSlots() (+5 more)

### Community 29 - "ShadCN UI Config"
Cohesion: 0.14
Nodes (13): aliases, components, utils, rsc, $schema, style, tailwind, baseColor (+5 more)

### Community 30 - "Dragon Tower Engine"
Cohesion: 0.18
Nodes (10): cashOut(), FLOOR_MULTIPLIERS, initDragonTower(), loseGame(), pickTile(), startDragonTower(), winGame(), DragonTowerState (+2 more)

### Community 31 - "Survival Balance & Reroll System"
Cohesion: 0.17
Nodes (13): Survival Balance Constants (lib/survival/balance.ts), Upgrades Catalog (lib/survival/upgrades-catalog.ts), Math Utils (utils/math.ts), Floor Generator and Game Selection, Quota and Bankroll Targets, Reroll System (Sparks vs Tickets), Survival Run Structure, Shop Items and Upgrade System (+5 more)

### Community 32 - "Street Cups Engine"
Cohesion: 0.21
Nodes (10): endShuffleStreetCups(), generateSwaps(), initStreetCups(), loseGame(), pickCupStreetCups(), startStreetCups(), winGame(), CupSwap (+2 more)

### Community 33 - "Run Summary UI"
Cohesion: 0.24
Nodes (10): headline(), RunSummary(), RunSummaryProps, RunSummary, Card, CardContent, CardDescription, CardFooter (+2 more)

### Community 34 - "Over-Under Engine"
Cohesion: 0.24
Nodes (10): getOverUnderPayout(), getOverUnderPayoutMultiplier(), initOverUnder(), loseGameResolve(), randomRoll(), resolveOverUnderRound(), startOverUnderRound(), winGameResolve() (+2 more)

### Community 35 - "Crash Game Engine"
Cohesion: 0.24
Nodes (9): computeMultiplier(), generateCrashPoint(), initCrash(), loseGame(), startCrashRound(), winGame(), CrashOutcome, CrashStage (+1 more)

### Community 36 - "Slots UI Patcher"
Cohesion: 0.20
Nodes (9): end, filePath, fs, head, path, s, start, tail (+1 more)

### Community 37 - "Roulette UI Patcher"
Cohesion: 0.25
Nodes (7): filePath, fs, head, path, s, start, tail

### Community 38 - "Gambling Quotes Widget"
Cohesion: 0.40
Nodes (4): GameDockRandomQuote(), GameDockRandomQuoteVariant, VARIANT_CLASS, GAMBLING_QUOTES

### Community 39 - "Dev Mode & Bless/Curse Mechanics"
Cohesion: 0.67
Nodes (4): Dev Mode / Navbar Dev Tools, Settings Store (store/settings-store.ts), Bless Mechanic (winGame / useBless), Curse Mechanic (loseGame / useCurse)

### Community 40 - "Floor Mission Variants"
Cohesion: 0.67
Nodes (4): Floor Missions System, Remove big_win 30x Mission Variant (C1), Flawless Mission Floor Gate (C2), Full Mission Variant Pool Replacement (D2)

### Community 41 - "Tailwind & Next.js Config"
Cohesion: 0.50
Nodes (4): Tailwind JIT Dynamic Class Warning, Floored Next.js Configuration, PostCSS Tailwind CSS Plugin Config, Tech Stack (Next.js, Zustand, Radix, Framer Motion, Supabase, Prisma)

### Community 43 - "Crash Curve Animation"
Cohesion: 0.67
Nodes (3): buildSmoothPath(), CrashCurve(), mult()

## Knowledge Gaps
- **301 isolated node(s):** `extends`, `$schema`, `style`, `rsc`, `tsx` (+296 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **20 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `useSurvivalStore` connect `Multi-Game UI Components` to `Run Summary UI`, `Blackjack Card System`, `Survival Run Engine & Upgrades`, `Bet Panel UI`, `Home Page & Difficulty`, `App Layout & Modals`, `Lobby & Mission Panel`, `Survival Store & Run State`, `Survival UI Panels`?**
  _High betweenness centrality (0.054) - this node is a cross-community bridge._
- **Why does `cn()` connect `Bet Panel UI` to `Multi-Game UI Components`, `Run Summary UI`, `NPM Dependencies`, `Home Page & Difficulty`?**
  _High betweenness centrality (0.050) - this node is a cross-community bridge._
- **Why does `clsx` connect `NPM Dependencies` to `Bet Panel UI`?**
  _High betweenness centrality (0.036) - this node is a cross-community bridge._
- **What connects `extends`, `$schema`, `style` to the rest of the system?**
  _304 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `Multi-Game UI Components` be split into smaller, more focused modules?**
  _Cohesion score 0.05368973132131027 - nodes in this community are weakly interconnected._
- **Should `Survival Run Engine & Upgrades` be split into smaller, more focused modules?**
  _Cohesion score 0.06398730830248546 - nodes in this community are weakly interconnected._
- **Should `Blackjack Card System` be split into smaller, more focused modules?**
  _Cohesion score 0.11840888066604996 - nodes in this community are weakly interconnected._