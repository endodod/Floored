'use client'

import { Button } from '@/components/ui/button'
import { CityScene } from '@/components/story/city-scene'
import type { SceneArtState } from '@/components/story/scene-art'
import { DUSTWATER_SCENE } from '@/lib/story/scene-theme'

const TITLE_ART: SceneArtState = { locked: [false, false, true], tonight: null, boss: 'waiting', roadOpen: false, nextCity: 'Rattlesnake Jct', car: false }

/** No story yet: Dustwater at night behind the title, and one button. */
export function TitleScreen({ onStart }: { onStart: () => void }) {
  return (
    <div className="st-screen relative flex min-h-0 flex-1 flex-col overflow-hidden rounded-lg [@media(max-height:500px)]:min-h-[30rem] [@media(max-height:500px)]:shrink-0">
      <CityScene config={DUSTWATER_SCENE} state={TITLE_ART} className="opacity-80">
        <div className="st-title-vignette absolute inset-0" />
        <div className="absolute inset-x-0 top-[9%] flex flex-col items-center px-6 text-center sm:top-[12%]">
          <p className="felt-print !text-[11px] !tracking-[0.34em]">Floored · Story mode</p>
          <h1 className="st-title st-motion mt-3 text-[46px] font-black uppercase leading-[0.95] tracking-[0.06em] sm:text-[76px]">
            The Circuit
          </h1>
          <p className="mt-4 max-w-[30rem] text-[14px] leading-relaxed text-[#e9dfc8] sm:text-[15px]">
            Your grandfather left you a seat at a club that no longer exists. Twelve cities, one circuit, and a rival who is always a city ahead.
          </p>
          <p className="mt-2 max-w-[30rem] text-[13px] leading-relaxed text-soft">
            Play nights at the tables, take work where you find it, and win each city&apos;s boss to move on. Play money only.
          </p>
          <p className="mt-2 max-w-[30rem] text-[12.5px] leading-relaxed text-gold">
            Chapter one: Dustwater is open. The other eleven towns are still being built.
          </p>
          <Button size="lg" className="mt-6 h-12 px-8 text-[15px]" onClick={onStart}>
            Start the story
          </Button>
        </div>
      </CityScene>
    </div>
  )
}
