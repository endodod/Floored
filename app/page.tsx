import { ModeSelect } from '@/components/mode-select'
import { PageTitle } from '@/components/ui/terminal'
import { DailyCountdown } from '@/components/daily/countdown'
import { HouseQuote } from '@/components/house-quote'

export default function HomePage() {
  return (
    <div className="mx-auto flex w-full max-w-[1152px] flex-col gap-6 pb-12">
      <div className="flex flex-col gap-3">
        <PageTitle
          title="Choose a mode"
          sub="Casino games for play money. Nothing here costs or pays out real money."
          aside={
            <p className="text-[13px] text-dim">
              Next daily in <DailyCountdown className="num text-ink" />
            </p>
          }
        />
        <div className="rise [--d:60ms]">
          <HouseQuote />
        </div>
      </div>
      <ModeSelect />
    </div>
  )
}
