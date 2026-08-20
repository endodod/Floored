'use client'

import { useSurvivalStore } from '@/store/survival-store'
import type { FloorMission } from '@/store/types'
import { getLobbyTicketCount } from '@/lib/survival/lobby-ticket'
import { canRerollMissionWithTicket } from '@/lib/survival/mission-reroll'
import { formatChips } from '@/utils/format'

function missionLabel(m: FloorMission): string {
  const minTag = m.minBet != null ? ` at ${formatChips(m.minBet)}+` : ''
  switch (m.type) {
    case 'win_streak':
      return `Win ${m.target} in a row${minTag}`
    case 'play_game': {
      const game = m.game?.split('-').join(' ') ?? 'a game'
      const times = m.target === 1 ? '' : ` ${m.target} times`
      return `Play ${game}${times}${minTag}`
    }
    case 'min_multiplier':
      return `Win with ${m.target}×+ multiplier${minTag}`
    case 'games_played':
      return `Play ${m.target} games${minTag}`
    case 'flawless':
      return `No losses this floor${minTag}`
    case 'win_count':
      return `Win ${m.target} rounds${minTag}`
    case 'big_win':
      return `Net ${formatChips(m.target)}+ in one round`
    default:
      return m.type
  }
}

interface MissionPanelProps {
  compact?: boolean
}

export function MissionPanel({ compact = false }: MissionPanelProps) {
  const missions = useSurvivalStore((s) => s.missions)
  const runSeed = useSurvivalStore((s) => s.runSeed)
  const currentFloor = useSurvivalStore((s) => s.currentFloor)
  const difficulty = useSurvivalStore((s) => s.difficulty)
  const floorGames = useSurvivalStore((s) => s.floorGames)
  const floorMinBet = useSurvivalStore((s) => s.floorMinBet)
  const missionOfferedKeys = useSurvivalStore((s) => s.missionOfferedKeys)
  const missionTicketRerolledSlots = useSurvivalStore((s) => s.missionTicketRerolledSlots)
  const shopTicketRollSeq = useSurvivalStore((s) => s.shopTicketRollSeq)
  const inventory = useSurvivalStore((s) => s.inventory)
  const rerollMissionWithTicket = useSurvivalStore((s) => s.rerollMissionWithTicket)
  const ticketCount = getLobbyTicketCount(inventory)

  const activeMissions = missions.filter((m) => !m.completed && !m.failed)
  const completedMissions = missions.filter((m) => m.completed)
  const failedMissions = missions.filter((m) => m.failed && !m.completed)

  function showMissionReroll(m: FloorMission): boolean {
    if (compact || ticketCount <= 0 || !runSeed || !difficulty) return false
    const idx = missions.indexOf(m)
    if (idx < 0) return false
    return canRerollMissionWithTicket(idx, missions, missionOfferedKeys, missionTicketRerolledSlots, {
      runSeed,
      floor: currentFloor,
      difficulty,
      floorGames,
      floorMinBet,
      rollSeq: shopTicketRollSeq + 1,
    })
  }

  function renderMission(m: FloorMission) {
    const idx = missions.indexOf(m)
    const pct = m.target > 0 ? Math.min(100, (m.progress / m.target) * 100) : 0
    const failed = m.failed === true
    const showReroll = showMissionReroll(m)

    return (
      <li
        key={m.id}
        className={`flex-1 min-h-0 flex flex-col justify-center rounded-lg border px-3 py-3 ${
          m.completed
            ? 'border-emerald-800/50 bg-emerald-950/20'
            : failed
              ? 'border-red-900/50 bg-red-950/20'
              : 'border-zinc-800 bg-zinc-950/40'
        }`}
      >
        <div className="flex items-start justify-between gap-2">
          <div className="flex flex-col gap-0.5 min-w-0">
            <span
              className={`leading-snug ${compact ? 'text-[11px]' : 'text-xs'} ${
                m.completed
                  ? 'text-emerald-400 line-through'
                  : failed
                    ? 'text-red-400 line-through'
                    : 'text-zinc-300'
              }`}
            >
              {missionLabel(m)}
              {failed && !m.completed ? ' — failed' : ''}
            </span>
            <span className={`font-semibold text-emerald-400 ${compact ? 'text-[9px]' : 'text-[10px]'}`}>
              +{m.rewardSparks} ✦
            </span>
          </div>
          <div className="flex h-7 items-center justify-center">
            {showReroll ? (
              <button
                type="button"
                onClick={() => rerollMissionWithTicket(idx)}
                className="inline-flex h-7 items-center gap-1 rounded-md border border-zinc-700 bg-zinc-950/80 pl-1.5 pr-2 text-zinc-100 hover:bg-zinc-900"
                title="Use a lobby reroll ticket to reroll this mission (once per mission)"
              >
                <span aria-hidden className="text-xs leading-none">↻:</span>
                <span aria-hidden className="text-xs leading-none">🎟️</span>
                <span className="text-[10px] font-bold tabular-nums leading-none">×1</span>
              </button>
            ) : (
              <span className="h-7 w-7" />
            )}
          </div>
        </div>
        {!m.completed && !failed && (
          <div className={`${compact ? 'mt-1 h-1' : 'mt-2 h-2'} rounded-full bg-zinc-800 overflow-hidden`}>
            <div
              className="h-full bg-amber-500/80 rounded-full transition-all"
              style={{ width: `${pct}%` }}
            />
          </div>
        )}
      </li>
    )
  }

  if (missions.length === 0) {
    return (
      <div className={`h-full rounded-xl border border-zinc-800 bg-zinc-900/60 ${compact ? 'p-2' : 'p-4'}`}>
        <p className="text-xs text-zinc-500">No missions this floor.</p>
      </div>
    )
  }

  return (
    <div className={`h-full rounded-xl border border-zinc-800 bg-zinc-900/60 flex flex-col gap-2 ${compact ? 'p-2' : 'p-4'}`}>
      <div className="shrink-0 flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <p className={`font-semibold uppercase tracking-wider text-zinc-400 ${compact ? 'text-[10px]' : 'text-xs'}`}>
            Missions
            <span className="text-zinc-600 font-normal normal-case tracking-normal">
              {' '}({missions.length}{activeMissions.length > 0 && activeMissions.length < missions.length ? ` · ${activeMissions.length} active` : ''})
            </span>
          </p>
          {!compact && (
            <p className="text-[10px] text-zinc-600 leading-snug mt-0.5">
              Play-game missions use this floor&apos;s lobby only. Each mission can be ticket-rerolled once.
            </p>
          )}
        </div>
      </div>

      <ul className="flex-1 flex flex-col gap-2 min-h-0">
        {activeMissions.length > 0 && activeMissions.length < missions.length && (
          <li className="list-none shrink-0">
            <p className="text-[9px] font-semibold uppercase tracking-wider text-amber-500/80 px-0.5">Active</p>
          </li>
        )}
        {activeMissions.map((m) => renderMission(m))}

        {completedMissions.length > 0 && (
          <li className="list-none shrink-0">
            <p className="text-[9px] font-semibold uppercase tracking-wider text-emerald-600 px-0.5 pt-1">Done</p>
          </li>
        )}
        {completedMissions.map((m) => renderMission(m))}

        {failedMissions.length > 0 && (
          <li className="list-none shrink-0">
            <p className="text-[9px] font-semibold uppercase tracking-wider text-red-700 px-0.5 pt-1">Failed</p>
          </li>
        )}
        {failedMissions.map((m) => renderMission(m))}
      </ul>
    </div>
  )
}
