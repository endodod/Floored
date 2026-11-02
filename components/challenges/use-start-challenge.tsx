'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useChallengeStore } from '@/store/challenge-store'
import { challengeKey, type ChallengeDef, type ChallengeSource } from '@/lib/challenges/types'
import { formatChips } from '@/utils/format'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'

/**
 * Starting a challenge: continues the attempt in progress if it is the same
 * one, asks before replacing a different one (that attempt then ends as given
 * up), and otherwise starts a fresh try and opens the challenge hub.
 */
export function useStartChallenge() {
  const router = useRouter()
  const attempt = useChallengeStore((s) => s.attempt)
  const start = useChallengeStore((s) => s.start)
  const giveUp = useChallengeStore((s) => s.giveUp)
  const [pending, setPending] = useState<{ source: ChallengeSource; def: ChallengeDef } | null>(null)

  const live = attempt && !attempt.finished ? attempt : null

  function begin(source: ChallengeSource, def: ChallengeDef) {
    start(source, def)
    router.push('/challenge')
  }

  function request(source: ChallengeSource, def: ChallengeDef) {
    if (live?.key === challengeKey(source, def.id)) {
      router.push('/challenge')
      return
    }
    if (live) {
      setPending({ source, def })
      return
    }
    begin(source, def)
  }

  const dialog = (
    <Dialog open={!!pending} onOpenChange={(open) => !open && setPending(null)}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>Leave {live?.def.name ?? 'your challenge'}?</DialogTitle>
          <DialogDescription>
            Only one challenge runs at a time. Starting {pending?.def.name} ends your current attempt as given up, with{' '}
            <span className="num text-ink">{formatChips(live?.bankroll ?? 0)}</span>. It still counts as a try.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <DialogClose asChild>
            <Button variant="outline">Keep playing</Button>
          </DialogClose>
          <Button
            onClick={() => {
              const next = pending
              setPending(null)
              if (!next) return
              giveUp()
              begin(next.source, next.def)
            }}
          >
            Start new
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )

  return { request, dialog, liveKey: live?.key ?? null }
}
