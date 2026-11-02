import type { ChoiceOption, Condition, Effect, Expression, FactionId, Scene, Speaker } from './types'

/**
 * The scene runner: pure functions over a scene and the bits of the save that
 * conditions read. The store applies the effects; the dialogue box renders the
 * step this returns.
 */

/** What conditions may read. */
export interface StoryContext {
  flags: Record<string, true>
  factions: Record<FactionId, number>
  /** Money in multiples of the current city's minimum bet. */
  moneyM: number
}

export function holds(c: Condition | undefined, ctx: StoryContext): boolean {
  if (!c) return true
  if ('flag' in c) return !!ctx.flags[c.flag]
  if ('not' in c) return !holds(c.not, ctx)
  if ('all' in c) return c.all.every((x) => holds(x, ctx))
  if ('any' in c) return c.any.some((x) => holds(x, ctx))
  if ('faction' in c) return (ctx.factions[c.faction] ?? 0) >= c.atLeast
  return ctx.moneyM >= c.moneyAtLeast
}

export type DialogueStep =
  | { kind: 'line'; node: string; speaker: Speaker; expression: Expression; text: string }
  | { kind: 'choice'; node: string; prompt?: string; options: (ChoiceOption & { index: number })[] }
  | { kind: 'end'; node: string; effects: Effect[] }

export function stepAt(scene: Scene, node: string, ctx: StoryContext): DialogueStep {
  const n = scene.nodes[node]
  if (!n) throw new Error(`Scene ${scene.id}: no node "${node}"`)
  if (n.kind === 'line') return { kind: 'line', node, speaker: n.speaker, expression: n.expression ?? 'neutral', text: n.text }
  if (n.kind === 'end') return { kind: 'end', node, effects: n.effects ?? [] }
  const options = n.options.map((o, index) => ({ ...o, index })).filter((o) => holds(o.if, ctx))
  if (!options.length) throw new Error(`Scene ${scene.id}: every option at "${node}" is closed`)
  return { kind: 'choice', node, prompt: n.prompt, options }
}

/** After a line: the next node. */
export function nextAfterLine(scene: Scene, node: string): string {
  const n = scene.nodes[node]
  if (n?.kind !== 'line') throw new Error(`Scene ${scene.id}: "${node}" is not a line`)
  return n.next
}

/** Taking option `index` (its index in the node's own list): where it leads and what it changes. */
export function choose(scene: Scene, node: string, index: number, ctx: StoryContext): { next: string; effects: Effect[] } {
  const n = scene.nodes[node]
  if (n?.kind !== 'choice') throw new Error(`Scene ${scene.id}: "${node}" is not a choice`)
  const option = n.options[index]
  if (!option || !holds(option.if, ctx)) throw new Error(`Scene ${scene.id}: option ${index} at "${node}" is not open`)
  return { next: option.to, effects: option.effects ?? [] }
}
