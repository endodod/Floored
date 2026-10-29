import { Lobby } from '@/components/lobby'
import { PageTitle, SectionTitle } from '@/components/ui/terminal'
import { FreeplaySession } from '@/components/freeplay-session'
import { GAMES } from '@/lib/game-catalog'

export default function FreeplayPage() {
  return (
    <div className="mx-auto flex w-full max-w-[1152px] flex-1 min-h-0 flex-col gap-8 pb-12">
      <PageTitle
        title="Freeplay"
        className="sm:!items-start"
        sub={'All ' + GAMES.length + ' games with a 10K balance — no floors, no quotas, no minimum bet.'}
        aside={<FreeplaySession />}
      />
      <section className="flex flex-col gap-4" aria-labelledby="freeplay-games">
        <SectionTitle suit={3} note="Every game open">
          <span id="freeplay-games">Pick a table</span>
        </SectionTitle>
        <Lobby mode="freeplay" />
      </section>
    </div>
  )
}
