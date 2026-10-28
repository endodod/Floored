import { Lobby } from '@/components/lobby'
import { PageTitle } from '@/components/ui/terminal'
import { GAMES } from '@/lib/game-catalog'

export default function FreeplayPage() {
  return (
    <div className="mx-auto flex w-full max-w-[1152px] flex-1 min-h-0 flex-col gap-6 pb-12">
      <PageTitle
        title="Freeplay"
        sub={`All ${GAMES.length} games with a 10K balance — no floors, no quotas, no minimum bet.`}
      />
      <Lobby mode="freeplay" />
    </div>
  )
}
