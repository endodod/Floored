import Link from 'next/link'
import { TABLE_GAMES } from '@/lib/tables/catalog'
import { TABLES_START_WALLET, TABLE_TIERS } from '@/lib/tables/stakes'
import { TABLES_CASH_STEPS, TABLES_STEPS } from '@/lib/tables/tutorials'
import { Button } from '@/components/ui/button'
import { PageTitle } from '@/components/ui/terminal'
import { HowItWorks, StartPanel } from '@/components/mode-intro'
import { formatChips } from '@/utils/format'

export default function TablesPage() {
  return (
    <div className="mx-auto flex w-full max-w-[1152px] flex-col gap-8 pb-12">
      <PageTitle
        title="Tables"
        sub="Play bots at tournament tables (a buy-in, a prize pool, everyone starts even) or at cash tables (bring your own chips, leave any time)."
      />
      <StartPanel
        figures={[
          { label: 'Table games', value: TABLE_GAMES.length },
          { label: 'Buy-in tiers', value: TABLE_TIERS.map((tier) => formatChips(tier.buyIn)).join(' / ') },
          { label: 'Starting wallet', value: formatChips(TABLES_START_WALLET) },
        ]}
        action={
          <Button asChild size="lg" className="w-full sm:w-auto">
            <Link href="/tables/lobby">Play Tables →</Link>
          </Button>
        }
        note="Buy-ins go to the prize pool. In Hold’em and Blackjack everyone starts with the same table bankroll; in Liar’s Dice everyone starts with the same number of dice."
      />
      <HowItWorks steps={TABLES_STEPS} delay={180} title="Tournaments" />
      <HowItWorks steps={TABLES_CASH_STEPS} delay={240} title="Cash tables" />
    </div>
  )
}
