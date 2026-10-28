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
      <li key={m.id} className={`flex flex-col justify-center ${compact ? 'py-2' : 'py-3'}`}>
        <div className="flex items-start justify-between gap-3">
          <div className="flex min-w-0 flex-col gap-0.5">
            <span
              className={`leading-snug ${compact ? 'text-[12px]' : 'text-[13px]'} ${
                m.completed || failed ? 'text-dim line-through' : 'text-ink'
              }`}
            >
              {missionLabel(m)}
            </span>
            <span className="text-[13px]">
              <span className="num text-gold">+{m.rewardSparks}</span>
              <span className="text-dim"> sparks</span>
              {m.completed && <span className="text-felt"> · done</span>}
              {failed && !m.completed && <span className="text-loss"> · failed</span>}
            </span>
          </div>
          {showReroll && (
            <button
              type="button"
              onClick={() => rerollMissionWithTicket(idx)}
              className="h-7 shrink-0 rounded-full border border-control px-2.5 text-xs font-medium text-soft transition-colors hover:border-dim hover:text-ink"
              title="Use a reroll ticket on this mission (once per mission)"
            >
              Reroll · 1 ticket
            </button>
          )}
        </div>
        {!m.completed && !failed && (
          <div className={`${compact ? 'mt-1.5 h-1' : 'mt-2 h-1.5'} overflow-hidden rounded-full bg-raised`}>
            <div className="h-full rounded-full bg-felt transition-[width]" style={{ width: `${pct}%` }} />
          </div>
        )}
      </li>
    )
  }

  if (missions.length === 0) {
    return (
      <div className={`h-full rounded-md bg-surface ${compact ? 'p-3' : 'p-5'}`}>
        <p className="text-[13px] text-dim">No missions this floor.</p>
      </div>
    )
  }

  const groups: { key: string; label: string; list: FloorMission[] }[] = [
    { key: 'active', label: 'Active', list: activeMissions },
    { key: 'done', label: 'Done', list: completedMissions },
    { key: 'failed', label: 'Failed', list: failedMissions },
  ].filter((g) => g.list.length > 0)
  const showGroupLabels = groups.length > 1

  return (
    <div className={`flex h-full flex-col gap-2 rounded-md bg-surface ${compact ? 'p-3' : 'p-5'}`}>
      <div className="shrink-0">
        <h3 className={`font-semibold text-ink ${compact ? 'text-[13px]' : 'text-base'}`}>
          Missions <span className="font-normal text-dim">{missions.length}</span>
        </h3>
        {!compact && (
          <p className="mt-1 text-[13px] leading-5 text-dim">
            Play-game missions count this floor&apos;s games only. Each mission can be rerolled once with a ticket.
          </p>
        )}
      </div>

      <div className="flex min-h-0 flex-1 flex-col">
        {groups.map((g) => (
          <div key={g.key}>
            {showGroupLabels && <p className="pt-2 text-xs text-dim">{g.label}</p>}
            <ul className="divide-y divide-rule">{g.list.map((m) => renderMission(m))}</ul>
          </div>
        ))}
      </div>
    </div>
  )
}
