#!/usr/bin/env node
const fs = require('node:fs')
const path = require('node:path')
const Module = require('node:module')
const ts = require('typescript')
const root = path.resolve(__dirname, '../..')
const oldResolve = Module._resolveFilename
Module._resolveFilename = function(request, parent, isMain, options) {
  if (request.startsWith('@/')) request = path.join(root, request.slice(2))
  return oldResolve.call(this, request, parent, isMain, options)
}
require.extensions['.ts'] = (mod, filename) => {
  const source = fs.readFileSync(filename, 'utf8')
  const js = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, esModuleInterop: true } }).outputText
  mod._compile(js, filename)
}
const { createRng } = require(path.join(root, 'utils/rng.ts'))
const poker = require(path.join(root, 'games/holdem/engine.ts'))
const liars = require(path.join(root, 'games/liars-dice/engine.ts'))
const blackjack = require(path.join(root, 'games/blackjack-showdown/engine.ts'))
const botCore = require(path.join(root, 'lib/bots/core.ts'))
const roster = require(path.join(root, 'lib/bots/roster.ts'))
const pokerBot = require(path.join(root, 'lib/bots/holdem.ts'))
const liarsBot = require(path.join(root, 'lib/bots/liars-dice.ts'))
const bjBot = require(path.join(root, 'lib/bots/blackjack-showdown.ts'))
const rounds = Math.max(1, Number(process.argv[2] || 1000))
const tiers=['Rookie','Regular','Shark']
const stats = { holdemWins: Array(6).fill(0), diceWins: Array(4).fill(0), blackjackWins: Array(4).fill(0), tierWins:{Rookie:0,Regular:0,Shark:0},styleWins:{},illegal: 0, maxSteps: 0, totalHoldemActions:0 }
const rankChecks=[
  [[{rank:'A',suit:'♠'},{rank:'K',suit:'♠'},{rank:'Q',suit:'♠'},{rank:'J',suit:'♠'},{rank:'10',suit:'♠'}],8],
  [[{rank:'9',suit:'♠'},{rank:'9',suit:'♥'},{rank:'9',suit:'♦'},{rank:'9',suit:'♣'},{rank:'2',suit:'♠'}],7],
  [[{rank:'8',suit:'♠'},{rank:'8',suit:'♥'},{rank:'8',suit:'♦'},{rank:'2',suit:'♣'},{rank:'2',suit:'♠'}],6],
  [[{rank:'A',suit:'♥'},{rank:'J',suit:'♥'},{rank:'8',suit:'♥'},{rank:'5',suit:'♥'},{rank:'2',suit:'♥'}],5],
  [[{rank:'9',suit:'♠'},{rank:'8',suit:'♥'},{rank:'7',suit:'♦'},{rank:'6',suit:'♣'},{rank:'5',suit:'♠'}],4],
]
for(const [hand,category] of rankChecks)if(poker.rankSeven(hand)[0]!==category)throw new Error(`Poker hand rank should be ${category}`)

for (let n = 0; n < rounds; n++) {
  const rng = createRng(n + 94731)
  const tier=tiers[n%tiers.length]
  const profiles=roster.botRoster('Regular').map((profile,i)=>({...profile,tier:tiers[(n+i)%tiers.length]}))
  let t = poker.startHand(poker.createTable(), rng), steps = 0
  while (t.players.filter(p => p.stack > 0).length > 1 && steps++ < 10000) {
    if (t.street === 'finished') { t = poker.nextHand(t, rng); continue }
    const seat = t.currentSeat
    if (seat == null) throw new Error('Hold’em lost action seat')
    const view = poker.viewFor(t, seat)
    if ('deck' in view || (view.players.some((p,i)=>i!==seat&&p.hole.length))) throw new Error('Hold’em bot view leaks hidden cards')
    const profile = profiles[seat % 5]
    const action = pokerBot.decideHoldem(view, seat, botCore.freshBotMind(), profile, rng)
    try { t = poker.apply(t, seat, action) } catch (e) { stats.illegal++; throw e }
    if(t.players.reduce((sum,p)=>sum+p.stack+p.committed,0)!==9000)throw new Error('Hold’em chip conservation failed')
  }
  if (steps >= 10000) throw new Error('Hold’em exceeded step limit')
  stats.maxSteps = Math.max(stats.maxSteps, steps)
  stats.totalHoldemActions += steps
  const pokerWinner=t.players.reduce((best,p,i)=>p.stack>t.players[best].stack?i:best,0)
  stats.holdemWins[pokerWinner]++;stats.tierWins[profiles[pokerWinner%5].tier]++;stats.styleWins[profiles[pokerWinner%5].name]=(stats.styleWins[profiles[pokerWinner%5].name]||0)+1

  let d = liars.startGame(rng), ds = 0
  while (d.winner === null && ds++ < 1000) {
    if (d.reveal) { d = liars.nextRound(d, rng); continue }
    const seat = d.seat, view = liars.viewFor(d, seat)
    if ('dice' in view || view.ownDice.length !== d.dice[seat].length) throw new Error('Liar’s Dice bot view leaks hidden dice')
    const action = liarsBot.decideLiarsDice(view, botCore.freshBotMind(), profiles[seat % 5], rng)
    try { d = liars.apply(d, seat, action) } catch (e) { stats.illegal++; throw e }
  }
  if (d.winner === null) throw new Error('Liar’s Dice exceeded step limit')
  stats.diceWins[d.winner]++;stats.tierWins[profiles[d.winner%5].tier]++;stats.styleWins[profiles[d.winner%5].name]=(stats.styleWins[profiles[d.winner%5].name]||0)+1

  let b = blackjack.createBlackjackShowdown(rng), bs = 0
  while (b.phase !== 'finished' && bs++ < 300) {
    const seat=b.currentSeat
    if (seat===null) throw new Error('Blackjack Showdown lost action seat')
    const view=blackjack.viewFor(b,seat)
    if ('shoe' in view || (b.phase==='playing'&&view.dealer.length!==1) || (b.hiddenBets&&b.phase==='betting'&&view.players.some((p,i)=>i!==seat&&p.bet>0))) throw new Error('Blackjack bot view leaks hidden info')
    const profile=bjBot.BLACKJACK_BOTS[seat===0?0:seat-1]
    const action=b.phase==='settled'?{type:'next-hand'}:bjBot.decideBlackjack(view,seat,profile,rng)
    try { b=blackjack.apply(b,seat,action) } catch(e) { stats.illegal++; throw e }
  }
  if(b.phase!=='finished')throw new Error('Blackjack Showdown exceeded step limit')
  const bjProfile=bjBot.BLACKJACK_BOTS[b.winner===0?0:b.winner-1]
  stats.blackjackWins[b.winner]++;stats.tierWins[bjProfile.tier]++;stats.styleWins[bjProfile.name]=(stats.styleWins[bjProfile.name]||0)+1
}
console.log(JSON.stringify({tablesPerGame:rounds,averageHoldemActions:Math.round(stats.totalHoldemActions/rounds),...stats},null,2))
