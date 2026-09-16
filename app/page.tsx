import { ModeSelect } from '@/components/mode-select'

export default function HomePage() {
  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] py-12">
      <div className="text-center mb-12 px-4">
        <h1 className="text-5xl sm:text-7xl md:text-8xl font-black tracking-[0.08em] sm:tracking-[0.2em] uppercase text-white mb-4 leading-none">
          FLOORED
        </h1>
        <p className="text-white/30 text-[10px] sm:text-[11px] tracking-[0.2em] sm:tracking-[0.3em] uppercase">
          Start with 1,000 chips &middot; Survive as long as you can
        </p>
      </div>
      <ModeSelect />
    </div>
  )
}
