import { ModeSelect } from '@/components/mode-select'
import { PageTitle } from '@/components/ui/terminal'
import { DailyCountdown } from '@/components/daily/countdown'

export default function HomePage() {
  return (
    <div className="mx-auto flex w-full max-w-[1152px] flex-col gap-6 pb-12">
      <PageTitle
        title="Choose a mode"
        sub="Casino games for play money. Nothing here costs or pays out real money."
        aside={
          <p className="text-[13px] text-dim">
            Next daily in <DailyCountdown className="num text-ink" />
          </p>
        }
      />
      <ModeSelect />
    </div>
  )
}
