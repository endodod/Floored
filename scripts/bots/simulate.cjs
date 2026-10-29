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
const rounds = Math.max(1, Number(process.argv[2] || 100))
const stats = { holdemWins: Array(6).fill(0), diceWins: Array(4).fill(0), blackjackWins: Array(4).fill(0), illegal: 0, maxSteps: 0 }

for (let n = 0; n < rounds; n++) {
  const rng = createRng(n + 94731)
  let t = poker.startHand(poker.createTable(), rng), steps = 0
  while (t.players.filter(p => p.stack > 0).length > 1 && steps++ < 10000) {
    if (t.street === 'finished') { t = poker.nextHand(t, rng); continue }
    const seat = t.currentSeat
    if (seat == null) throw new Error('Hold’em lost action seat')
    const view = poker.viewFor(t, seat)
    if ('deck' in view || (view.players.some((p,i)=>i!==seat&&p.hole.length))) throw new Error('Hold’em bot view leaks hidden cards')
    const profile = roster.botRoster('Regular')[seat % 5]
    const action = pokerBot.decideHoldem(view, seat, botCore.freshBotMind(), profile, rng)
    try { t = poker.apply(t, seat, action) } catch (e) { stats.illegal++; throw e }
  }
  if (steps >= 10000) throw new Error('Hold’em exceeded step limit')
  stats.maxSteps = Math.max(stats.maxSteps, steps)
  stats.holdemWins[t.players.reduce((best,p,i)=>p.stack>t.players[best].stack?i:best,0)]++

  let d = liars.startGame(rng), ds = 0
  while (d.winner === null && ds++ < 1000) {
    if (d.reveal) { d = liars.nextRound(d, rng); continue }
    const seat = d.seat, view = liars.viewFor(d, seat)
    if ('dice' in view || view.ownDice.length !== d.dice[seat].length) throw new Error('Liar’s Dice bot view leaks hidden dice')
    const action = liarsBot.decideLiarsDice(view, botCore.freshBotMind(), roster.botRoster('Regular')[seat % 5], rng)
    try { d = liars.apply(d, seat, action) } catch (e) { stats.illegal++; throw e }
  }
  if (d.winner === null) throw new Error('Liar’s Dice exceeded step limit')
  stats.diceWins[d.winner]++

  let b = blackjack.createBlackjackShowdown(rng), bs = 0
  while (b.phase !== 'finished' && bs++ < 300) {
    const seat=b.currentSeat
    if (seat===null) throw new Error('Blackjack Showdown lost action seat')
    const view=blackjack.viewFor(b,seat)
    if ('shoe' in view || (b.hiddenBets&&b.phase==='betting'&&view.players.some((p,i)=>i!==seat&&p.bet>0))) throw new Error('Blackjack bot view leaks hidden info')
    const profile=bjBot.BLACKJACK_BOTS[(seat+1)%bjBot.BLACKJACK_BOTS.length]
    const action=b.phase==='settled'?{type:'next-hand'}:bjBot.decideBlackjack(view,seat,profile,rng)
    try { b=blackjack.apply(b,seat,action) } catch(e) { stats.illegal++; throw e }
  }
  if(b.phase!=='finished')throw new Error('Blackjack Showdown exceeded step limit')
  stats.blackjackWins[b.winner]++
}
console.log(JSON.stringify({tablesPerGame:rounds,...stats},null,2))
