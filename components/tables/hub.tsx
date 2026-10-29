'use client'

import { useRouter } from 'next/navigation'
import { PageTitle, SectionTitle } from '@/components/ui/terminal'
import { Button } from '@/components/ui/button'
import { useTablesStore } from '@/store/tables-store'
import { formatChips } from '@/utils/format'
import { useHydrated } from '@/hooks/use-hydrated'

const buyIns = [100, 500, 2000]

export function TablesHub() {
  const router = useRouter()
  const hydrated = useHydrated()
  const wallet = useTablesStore(s => s.wallet)
  const table = useTablesStore(s => s.table)
  const activeGame = useTablesStore(s => s.activeGame)
  const played = useTablesStore(s => s.played)
  const won = useTablesStore(s => s.won)
  const start = useTablesStore(s => s.start)
  const refill = useTablesStore(s => s.refill)
  const reserve = useTablesStore(s => s.reserve)
  return <div className="mx-auto flex w-full max-w-[960px] flex-col gap-7 pb-12">
    <PageTitle title="Tables" sub="Sit down with the bots. Play money only; no rake." />
    <section className="grid gap-4 rounded-2xl border border-line bg-ground p-5 sm:grid-cols-[1fr_auto] sm:items-center sm:p-7">
      <div><p className="text-xs uppercase tracking-[.18em] text-dim">Tables wallet</p><p className="num mt-1 text-3xl text-ink">{hydrated ? formatChips(wallet) : '—'}</p>{hydrated && wallet < 100 && !activeGame && <Button className="mt-3" variant="outline" onClick={refill}>Refill to 10,000</Button>}</div>
      <p className="text-sm text-dim">{played} tables played · {won} wins</p>
    </section>
    <section>
      <SectionTitle note="12 hands · four seats · the winner collects the prize pool">Blackjack Showdown</SectionTitle>
      <p className="mb-5 max-w-[65ch] text-sm leading-6 text-dim">Everyone starts with 1,000 tournament chips. Play 12 hands against one shared dealer, who hits through 16. Blackjack pays 3:2; double on your first two cards, with no splits. Bets run from 10–500, and the final hand’s bets stay secret until everyone commits. Fall below the minimum and you’re out.</p>
      {activeGame === 'blackjack-showdown' && table && table.phase !== 'finished' && <div className="mb-5 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-felt/40 bg-felt/10 p-4"><p className="text-sm">You have a table in progress · hand {table.handNumber} of 12</p><Button onClick={() => router.push('/tables/blackjack-showdown')}>Resume table</Button></div>}
      {activeGame && activeGame !== 'blackjack-showdown' && <div className="mb-5 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-felt/40 bg-felt/10 p-4"><p className="text-sm">You have a {activeGame === 'holdem' ? 'Hold’em' : 'Liar’s Dice'} table in progress</p><Button onClick={() => router.push(`/tables/${activeGame}`)}>Resume table</Button></div>}
      <div className="grid gap-3 md:grid-cols-3">{buyIns.map((buyIn) => <article key={buyIn} className="flex flex-col gap-4 rounded-xl border border-line bg-ground p-5">
        <div><p className="text-xs uppercase tracking-widest text-dim">Buy-in</p><p className="num mt-1 text-2xl">{formatChips(buyIn)}</p><p className="mt-1 text-xs text-dim">{formatChips(buyIn * 4)} prize pool</p></div>
        <Button disabled={!hydrated || wallet < buyIn || Boolean(activeGame)} onClick={() => { start(buyIn); router.push('/tables/blackjack-showdown') }}>Join table</Button>
      </article>)}</div>
    </section>
    <section>
      <SectionTitle note="Four players · five dice each · winner takes the pot">Liar’s Dice</SectionTitle>
      <p className="mb-4 max-w-[65ch] text-sm leading-6 text-dim">Bid on the total dice showing a face across all cups. Ones are wild for other faces. Raise the bid or call Liar; lose a die when you’re wrong. Last player with dice wins.</p>
      <div className="flex flex-wrap gap-2">{buyIns.map(buyIn=><Button key={buyIn} variant="outline" disabled={!hydrated||wallet<buyIn||Boolean(activeGame)} onClick={()=>{if(reserve('liars-dice',buyIn))router.push('/tables/liars-dice')}}>Join · {formatChips(buyIn)}</Button>)}</div>
    </section>
    <section>
      <SectionTitle note="Six seats · rising blinds · 65/35 top-two payout">Texas Hold’em</SectionTitle>
      <p className="mb-4 max-w-[65ch] text-sm leading-6 text-dim">A no-limit Sit & Go. Everyone starts with 1,500 chips; blinds rise every ten hands. The tournament runs until one player holds the chips. Side pots settle all-ins.</p>
      <div className="flex flex-wrap gap-2">{buyIns.map(buyIn=><Button key={buyIn} variant="outline" disabled={!hydrated||wallet<buyIn||Boolean(activeGame)} onClick={()=>{if(reserve('holdem',buyIn))router.push('/tables/holdem')}}>Join · {formatChips(buyIn)}</Button>)}</div>
    </section>
  </div>
}
