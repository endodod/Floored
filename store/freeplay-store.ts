'use client'

import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { FreeplayStore } from './types'

export const useFreeplayStore = create<FreeplayStore>()(
  persist(
    (set) => ({
      bankroll: 10_000,
      setBankroll: (n) => set((s) => ({ bankroll: n, peakBankroll: Math.max(s.peakBankroll, n) })),
      bust: false,
      markBust: () => set({ bust: true }),
      reset: () => set((s) => ({ bankroll: 10_000, bust: false, resetCount: s.resetCount + 1 })),
      peakBankroll: 10_000,
      resetCount: 0,
    }),
    {
      name: 'floored-freeplay',
      // The balance is kept (and synced to the account, components/account-sync.tsx).
      partialize: (state) => ({
        bankroll: state.bankroll,
        bust: state.bust,
        peakBankroll: state.peakBankroll,
        resetCount: state.resetCount,
      }),
    },
  ),
)
