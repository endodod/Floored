import { memo, type ReactNode } from 'react'
import { createRng } from '@/utils/rng'
import type { CitySceneConfig, PieceKind, ScenePalette, ScenePiece, SceneLayout } from '@/lib/story/scene-theme'

/**
 * The drawn night street behind the story hub (SVG, generated here, no image
 * files). Each piece draws itself in its own local units with the ground at its
 * bottom edge; `SceneArt` places them per layout from the city's config. The
 * sky, desert and road run far past the view box so wider screens see more
 * street instead of bars. Classes starting `st-` animate (see globals.css);
 * all of them stop under reduced motion.
 */

/** What the art shows from the save: dark or chained doors, the car light, the road sign. */
export interface SceneArtState {
  /** Venue doors 0 dive, 1 main floor, 2 high-roller room. */
  locked: [boolean, boolean, boolean]
  tonight: 0 | 1 | 2 | null
  /** The boss's back room: open (waiting), away (rematch later) or beaten. */
  boss: 'waiting' | 'away' | 'beaten' | 'none'
  roadOpen: boolean
  nextCity: string | null
  car: boolean
}

interface Ctx {
  P: ScenePalette
  id: string
  state: SceneArtState
  config: CitySceneConfig
}

const SANS = { fontFamily: 'var(--font-floored-sans)' }
const MONO = { fontFamily: 'var(--font-floored-mono)' }

function Chain({ x, y, w, h }: { x: number; y: number; w: number; h: number }) {
  return (
    <g>
      <rect x={x} y={y} width={w} height={h} fill="#050506" opacity={0.75} />
      <path d={`M${x - 4} ${y + h * 0.2} L${x + w + 4} ${y + h * 0.72} M${x + w + 4} ${y + h * 0.2} L${x - 4} ${y + h * 0.72}`} stroke="#8b9096" strokeWidth={5} strokeDasharray="7 3" fill="none" />
      <rect x={x + w / 2 - 9} y={y + h * 0.42} width={18} height={15} rx={2} fill="#a87a2e" stroke="#2a1c0c" strokeWidth={1.5} />
      <path d={`M${x + w / 2 - 5} ${y + h * 0.42} v-5 a5 5 0 0 1 10 0 v5`} stroke="#a87a2e" strokeWidth={3} fill="none" />
    </g>
  )
}

function Windows({ c, x, y, cols, rows, w, h, gx, gy, seed }: { c: Ctx; x: number; y: number; cols: number; rows: number; w: number; h: number; gx: number; gy: number; seed: number }) {
  const rng = createRng(seed)
  const out: ReactNode[] = []
  for (let r = 0; r < rows; r++)
    for (let k = 0; k < cols; k++) {
      const lit = rng() < 0.42
      out.push(
        <rect key={`${r}-${k}`} x={x + k * gx} y={y + r * gy} width={w} height={h} fill={lit ? c.P.window : c.P.windowDim} opacity={lit ? 0.55 + rng() * 0.35 : 0.8} />,
      )
    }
  return <>{out}</>
}

function Halftone({ c, x, y, w, h, o = 0.4 }: { c: Ctx; x: number; y: number; w: number; h: number; o?: number }) {
  return <rect x={x} y={y} width={w} height={h} fill={`url(#${c.id}-dots)`} opacity={o} />
}

function Casino({ c }: { c: Ctx }) {
  const { P, state, config } = c
  const sign = config.sign
  const letters = [...sign.text]
  const fit = Math.min(410, letters.length * 36)
  const doorLit = (v: 0 | 1 | 2) => (state.tonight === v ? 1 : 0.8)
  return (
    <g>
      <path d="M30 150 L30 128 L120 128 L120 112 L500 112 L500 128 L590 128 L590 150 Z" fill={P.roof} />
      <rect x={30} y={150} width={560} height={270} fill={P.wall} />
      <rect x={30} y={150} width={560} height={6} fill={P.trim} />
      <rect x={30} y={256} width={560} height={6} fill={P.trim} />
      {/* upper windows (the high-roller door takes the right end) */}
      {[0, 1, 2, 3, 4, 5].map((i) => (
        <g key={i}>
          <rect x={58 + i * 64} y={174} width={36} height={50} fill={i % 3 === 1 ? P.windowDim : P.window} opacity={i % 3 === 1 ? 0.9 : 0.5} />
          <path d={`M${58 + i * 64} ${186 + (i % 2) * 6}h36M${58 + i * 64} ${200}h36M${58 + i * 64} ${212}h36`} stroke={P.wall} strokeWidth={2} opacity={0.6} />
        </g>
      ))}
      <Halftone c={c} x={420} y={112} w={170} h={308} o={0.45} />
      {/* the sign on the roof */}
      <rect x={150} y={96} width={6} height={18} fill={P.trim} />
      <rect x={462} y={96} width={6} height={18} fill={P.trim} />
      <rect x={86} y={24} width={448} height={74} rx={6} fill="#0a090b" stroke={P.trim} strokeWidth={3} />
      <text x={310} y={80} textAnchor="middle" fontSize={50} fontWeight={800} textLength={fit} lengthAdjust="spacingAndGlyphs" style={SANS} fill={P.neonDead}>
        {sign.text}
      </text>
      <text x={310} y={80} textAnchor="middle" fontSize={50} fontWeight={800} textLength={fit} lengthAdjust="spacingAndGlyphs" style={SANS} filter={`url(#${c.id}-glow)`}>
        {letters.map((ch, i) => (
          <tspan key={i} fill={sign.dead.includes(i) ? 'transparent' : P.neonSign} className={i === sign.flicker ? 'st-motion st-flicker' : undefined}>
            {ch}
          </tspan>
        ))}
      </text>
      {/* The dive: a side door with a bar light */}
      <text x={100} y={306} textAnchor="middle" fontSize={22} fontWeight={800} style={SANS} fill={state.locked[0] ? P.neonDead : P.neonBar} filter={state.locked[0] ? undefined : `url(#${c.id}-glow)`}>
        {config.barName === 'DINER' ? 'BAR' : 'DIVE'}
      </text>
      <rect x={66} y={316} width={68} height={104} fill={P.trim} />
      <rect x={72} y={322} width={56} height={98} fill={state.locked[0] ? '#0b0a0c' : '#6a3d1c'} opacity={doorLit(0)} />
      <rect x={80} y={332} width={40} height={22} fill={state.locked[0] ? '#141215' : P.window} opacity={0.7} />
      {state.locked[0] && <Chain x={72} y={322} w={56} h={98} />}
      {/* The main floor: double doors under a bulb marquee */}
      <rect x={212} y={292} width={176} height={128} fill={P.trim} />
      <rect x={222} y={306} width={156} height={114} fill={state.locked[1] ? '#0b0a0c' : `url(#${c.id}-door)`} opacity={doorLit(1)} />
      <path d="M300 306 V420" stroke={P.trim} strokeWidth={4} />
      {state.locked[1] && <Chain x={222} y={306} w={156} h={114} />}
      <path d="M186 266 L414 266 L404 298 L196 298 Z" fill="#2a1418" stroke="#4a2a22" strokeWidth={2} />
      <text x={300} y={290} textAnchor="middle" fontSize={20} fontWeight={800} letterSpacing={6} style={SANS} fill="#d9a441">CASINO</text>
      {Array.from({ length: 16 }, (_, i) => (
        <circle key={i} cx={200 + i * 13.3} cy={298} r={3.2} fill="#ffd98a" className="st-motion st-chase" style={{ animationDelay: `${(i % 3) * 0.4}s` }} />
      ))}
      <ellipse cx={300} cy={420} rx={150} ry={16} fill={`url(#${c.id}-pool)`} opacity={state.locked[1] ? 0.2 : 0.9} />
      {/* The high-roller room: upstairs, gold-framed, chained until your name is good enough */}
      <rect x={440} y={240} width={160} height={8} fill={P.trim} />
      <path d="M446 240 V222 M470 240 V222 M560 240 V222 M584 240 V222 M440 222 H600" stroke={P.trim} strokeWidth={3} />
      <path d="M600 246 L646 420 M586 246 L632 420" stroke={P.trim} strokeWidth={4} />
      {Array.from({ length: 8 }, (_, i) => (
        <path key={i} d={`M${589 + i * 5.6} ${266 + i * 20}h${14}`} stroke={P.trim} strokeWidth={3} />
      ))}
      <rect x={468} y={160} width={64} height={80} fill={state.locked[2] ? '#0b0a0c' : '#d9a441'} />
      <rect x={474} y={166} width={52} height={74} fill={state.locked[2] ? '#100e10' : '#6e1f29'} opacity={doorLit(2)} />
      {!state.locked[2] && <path d="M474 166 Q500 196 526 166" fill="#a92b42" opacity={0.8} />}
      {state.locked[2] && <Chain x={474} y={166} w={52} h={74} />}
    </g>
  )
}

function Backroom({ c }: { c: Ctx }) {
  const { P, state } = c
  const open = state.boss === 'waiting'
  return (
    <g>
      <path d="M0 74 L170 58 L170 200 L0 200 Z" fill={P.wall} />
      <path d="M-6 76 L176 58 L176 50 L-6 68 Z" fill={P.roof} />
      <Halftone c={c} x={0} y={70} w={60} h={130} o={0.5} />
      <text x={85} y={98} textAnchor="middle" fontSize={13} fontWeight={700} letterSpacing={2} style={MONO} fill="#b8a27a" opacity={0.8}>BACK ROOM</text>
      <rect x={56} y={112} width={58} height={88} fill={P.trim} />
      <rect x={61} y={117} width={48} height={83} fill={open ? '#f1b866' : '#0d0b0c'} opacity={open ? 0.85 : 1} />
      {open && (
        <>
          <ellipse cx={85} cy={176} rx={20} ry={6} fill={P.felt} />
          <rect x={82} y={176} width={6} height={24} fill="#1a120c" />
        </>
      )}
      {state.boss === 'away' && (
        <g>
          <rect x={66} y={140} width={38} height={16} fill="#e9dfc8" />
          <text x={85} y={152} textAnchor="middle" fontSize={9} fontWeight={700} style={SANS} fill="#3a2a20">CLOSED</text>
        </g>
      )}
      <path d="M85 102 V108" stroke="#6a6a6a" strokeWidth={1.5} />
      <circle cx={85} cy={110} r={4} fill={P.lamp} filter={`url(#${c.id}-glow)`} className="st-motion st-lamp" />
      <path d="M85 112 L40 200 L130 200 Z" fill={P.lamp} opacity={open ? 0.08 : 0.04} />
    </g>
  )
}

function Motel({ c }: { c: Ctx }) {
  const { P, state, config } = c
  const rng = createRng(17)
  return (
    <g>
      <rect x={0} y={50} width={460} height={210} fill={P.wallLit} />
      <rect x={-6} y={40} width={472} height={14} fill={P.roof} />
      {/* upstairs rooms and the walkway */}
      {Array.from({ length: 8 }, (_, i) => {
        const lit = rng() < 0.45
        return (
          <g key={`u${i}`}>
            <rect x={18 + i * 56} y={70} width={26} height={52} fill={P.wall} />
            <rect x={48 + i * 56} y={80} width={16} height={22} fill={lit ? P.window : P.windowDim} opacity={lit ? 0.7 : 0.9} />
          </g>
        )
      })}
      <rect x={0} y={146} width={460} height={8} fill={P.trim} />
      <path d="M0 124 H460" stroke={P.trim} strokeWidth={3} />
      {Array.from({ length: 38 }, (_, i) => (
        <rect key={`b${i}`} x={2 + i * 12} y={124} width={2} height={22} fill={P.trim} />
      ))}
      {/* ground-floor rooms; number 5 is yours */}
      {Array.from({ length: 6 }, (_, i) => {
        const mine = i === 4
        const lit = mine ? !state.car : rng() < 0.4
        return (
          <g key={`g${i}`}>
            <rect x={160 + i * 50} y={182} width={30} height={78} fill={P.wall} />
            <rect x={164 + i * 50} y={188} width={22} height={8} fill={mine ? '#d9a441' : P.trim} opacity={mine ? 0.9 : 0.6} />
            {mine && <text x={175 + i * 50} y={195} textAnchor="middle" fontSize={7} fontWeight={800} style={SANS} fill="#2a1c0c">5</text>}
            <rect x={192 + i * 50} y={196} width={14} height={20} fill={lit ? P.window : P.windowDim} opacity={lit ? 0.75 : 0.9} />
          </g>
        )
      })}
      {/* the diner on the corner */}
      <rect x={8} y={176} width={124} height={74} fill={`url(#${c.id}-door)`} />
      <rect x={8} y={226} width={124} height={8} fill="#2a1c14" />
      {[30, 58, 86, 114].map((x) => (
        <g key={x}>
          <rect x={x - 1} y={234} width={2} height={16} fill="#1a120c" />
          <ellipse cx={x} cy={234} rx={6} ry={2.5} fill="#a92b42" />
        </g>
      ))}
      <rect x={8} y={176} width={124} height={74} fill="none" stroke={P.trim} strokeWidth={4} />
      <text x={70} y={168} textAnchor="middle" fontSize={17} fontWeight={800} letterSpacing={3} style={SANS} fill={P.neonBar} filter={`url(#${c.id}-glow)`}>
        {config.barName}
      </text>
      <ellipse cx={70} cy={262} rx={90} ry={10} fill={`url(#${c.id}-pool)`} opacity={0.8} />
      <Halftone c={c} x={330} y={54} w={130} h={206} o={0.45} />
    </g>
  )
}

function MotelSign({ c }: { c: Ctx }) {
  const { P, config } = c
  const star = Array.from({ length: 10 }, (_, i) => {
    const r = i % 2 ? 11 : 26
    const a = (Math.PI / 5) * i - Math.PI / 2
    return `${70 + r * Math.cos(a)},${34 + r * Math.sin(a)}`
  }).join(' ')
  return (
    <g>
      <rect x={64} y={150} width={12} height={270} fill={P.trim} />
      <polygon points={star} fill="none" stroke={P.neonMotel} strokeWidth={4} filter={`url(#${c.id}-glow)`} />
      <rect x={6} y={64} width={128} height={64} rx={8} fill="#140c12" stroke={P.neonMotel} strokeWidth={3} filter={`url(#${c.id}-glow)`} />
      <text x={70} y={106} textAnchor="middle" fontSize={24} fontWeight={800} textLength={Math.min(112, config.motelName.length * 15)} lengthAdjust="spacingAndGlyphs" style={SANS} fill={P.neonMotel} filter={`url(#${c.id}-glow)`}>
        {config.motelName}
      </text>
      <rect x={28} y={132} width={84} height={20} fill="#efe6d2" />
      <text x={70} y={147} textAnchor="middle" fontSize={13} fontWeight={800} letterSpacing={4} style={SANS} fill="#2a2420">MOTEL</text>
      <rect x={20} y={160} width={100} height={24} rx={3} fill="#0b0d0c" stroke={P.trim} strokeWidth={2} />
      <text x={70} y={177} textAnchor="middle" fontSize={13} fontWeight={800} letterSpacing={2} style={SANS} fill={P.neonVacancy} filter={`url(#${c.id}-glow)`} className="st-motion st-flicker-slow">
        VACANCY
      </text>
    </g>
  )
}

function TruckWash({ c }: { c: Ctx }) {
  const { P } = c
  const bay = (x0: number, x1: number) => (
    <g>
      <path d={`M${x0} 210 L${x0} 124 Q${(x0 + x1) / 2} 96 ${x1} 124 L${x1} 210 Z`} fill="#07080a" />
      {[x0 + 22, x1 - 42].map((bx) => (
        <g key={bx}>
          <rect x={bx} y={134} width={20} height={70} rx={8} fill={P.wash} opacity={0.32} />
          {[0, 1, 2, 3, 4].map((k) => (
            <path key={k} d={`M${bx} ${142 + k * 13}h20`} stroke="#07080a" strokeWidth={3} opacity={0.6} />
          ))}
        </g>
      ))}
      <ellipse cx={(x0 + x1) / 2} cy={208} rx={(x1 - x0) / 2.3} ry={4} fill={P.wash} opacity={0.18} />
    </g>
  )
  return (
    <g>
      <rect x={0} y={80} width={340} height={130} fill={P.wall} />
      <rect x={-4} y={72} width={348} height={12} fill={P.roof} />
      <rect x={40} y={34} width={260} height={34} fill="#0a0b0d" stroke={P.trim} strokeWidth={2} />
      <path d="M70 68 V72 M270 68 V72" stroke={P.trim} strokeWidth={3} />
      <text x={170} y={59} textAnchor="middle" fontSize={21} fontWeight={800} letterSpacing={4} style={SANS} fill={P.wash} filter={`url(#${c.id}-glow)`}>
        TRUCK WASH
      </text>
      {bay(28, 152)}
      {bay(188, 312)}
      <Halftone c={c} x={0} y={84} w={340} h={126} o={0.25} />
    </g>
  )
}

function Cups({ c }: { c: Ctx }) {
  return (
    <g>
      <ellipse cx={45} cy={58} rx={70} ry={7} fill={`url(#${c.id}-pool)`} opacity={0.9} />
      <path d="M12 34 L78 60 M78 34 L12 60" stroke="#2b1d12" strokeWidth={3} />
      <rect x={0} y={28} width={90} height={7} rx={1} fill="#5a3b22" />
      <rect x={3} y={23} width={84} height={6} fill={c.P.felt} />
      {[18, 39, 60].map((x) => (
        <g key={x}>
          <path d={`M${x} 23 L${x + 2} 7 L${x + 12} 7 L${x + 14} 23 Z`} fill="#cfc6b4" />
          <path d={`M${x + 9} 23 L${x + 10} 7 L${x + 12} 7 L${x + 14} 23 Z`} fill="#8f877a" />
        </g>
      ))}
    </g>
  )
}

function Gas({ c }: { c: Ctx }) {
  const { P } = c
  return (
    <g>
      <rect x={60} y={160} width={210} height={120} fill={P.wall} />
      <rect x={84} y={190} width={120} height={50} fill={P.window} opacity={0.35} />
      <text x={144} y={182} textAnchor="middle" fontSize={11} fontWeight={700} letterSpacing={2} style={MONO} fill="#b8a27a" opacity={0.7}>SHOP</text>
      <path d="M10 130 L320 130 L380 280 L-50 280 Z" fill={`url(#${c.id}-canopy)`} />
      <rect x={0} y={96} width={330} height={32} fill="#1d2126" />
      <rect x={0} y={110} width={330} height={6} fill="#a92b42" />
      <rect x={10} y={126} width={310} height={3} fill="#e8f4ff" opacity={0.85} />
      <rect x={36} y={128} width={12} height={152} fill={P.trim} />
      <rect x={282} y={128} width={12} height={152} fill={P.trim} />
      {[120, 200].map((x) => (
        <g key={x}>
          <rect x={x} y={208} width={30} height={72} rx={3} fill="#2b2f33" />
          <rect x={x + 6} y={216} width={18} height={10} fill="#8fe3c0" opacity={0.7} />
          <path d={`M${x + 30} 230 q12 6 6 30`} stroke="#111" strokeWidth={3} fill="none" />
        </g>
      ))}
      <rect x={352} y={60} width={8} height={220} fill={P.trim} />
      <rect x={316} y={2} width={80} height={72} rx={3} fill="#0a0b0d" stroke={P.trim} strokeWidth={2} />
      <text x={356} y={22} textAnchor="middle" fontSize={11} fontWeight={700} letterSpacing={1} style={SANS} fill="#e9dfc8">DIESEL</text>
      <text x={356} y={58} textAnchor="middle" fontSize={26} fontWeight={700} style={MONO} fill={P.neonBar} filter={`url(#${c.id}-glow)`}>3.99</text>
    </g>
  )
}

function Truck({ c }: { c: Ctx }) {
  return (
    <g>
      <rect x={0} y={10} width={208} height={86} fill="#1a1b20" />
      <rect x={0} y={52} width={208} height={6} fill="#a92b42" opacity={0.6} />
      <Halftone c={c} x={0} y={10} w={208} h={86} o={0.35} />
      <path d="M212 96 L212 34 Q214 24 226 24 L262 24 L290 54 L300 60 L300 96 Z" fill="#23262c" />
      <path d="M232 32 L258 32 L280 56 L232 56 Z" fill="#0b0e12" />
      {[30, 70, 150, 190, 240, 280].map((x) => (
        <circle key={x} cx={x} cy={104} r={13} fill="#08080a" />
      ))}
      <circle cx={4} cy={14} r={3} fill="#ff9a3d" filter={`url(#${c.id}-glow)`} />
      <circle cx={204} cy={14} r={3} fill="#ff9a3d" filter={`url(#${c.id}-glow)`} />
    </g>
  )
}

function Lamp({ c }: { c: Ctx }) {
  return (
    <g>
      <path d="M40 22 L64 22 L150 300 L-40 300 Z" fill={`url(#${c.id}-cone)`} className="st-motion st-lamp" />
      <ellipse cx={52} cy={300} rx={120} ry={16} fill={`url(#${c.id}-pool)`} />
      <rect x={26} y={14} width={6} height={286} fill="#1d1a1c" />
      <path d="M29 16 Q40 4 56 12" stroke="#1d1a1c" strokeWidth={5} fill="none" />
      <ellipse cx={54} cy={17} rx={10} ry={4} fill={c.P.lamp} filter={`url(#${c.id}-glow)`} />
    </g>
  )
}

function Car({ c }: { c: Ctx }) {
  const asleep = c.state.car
  return (
    <g>
      <ellipse cx={85} cy={62} rx={84} ry={5} fill="#000" opacity={0.6} />
      <path d="M6 52 L6 38 Q10 32 30 30 L50 13 Q56 9 66 9 L112 9 Q122 9 128 15 L146 30 Q164 32 166 40 L166 52 Z" fill="#253540" />
      <path d="M56 16 L66 13 L84 13 L84 30 L44 30 Z M90 13 L110 13 Q118 13 122 18 L134 30 L90 30 Z" fill={asleep ? '#ffcf87' : '#0b0e12'} opacity={asleep ? 0.55 : 1} />
      <path d="M8 40 H164" stroke="#9aa4ab" strokeWidth={1.5} opacity={0.6} />
      <rect x={160} y={40} width={6} height={5} fill="#a92b42" />
      {[36, 134].map((x) => (
        <g key={x}>
          <circle cx={x} cy={52} r={11} fill="#0a0a0a" />
          <circle cx={x} cy={52} r={4} fill="#555" />
        </g>
      ))}
    </g>
  )
}

function RoadSign({ c }: { c: Ctx }) {
  const on = c.state.roadOpen
  const name = (c.state.nextCity ?? 'THE ROAD').toUpperCase()
  return (
    <g>
      <rect x={26} y={88} width={6} height={132} fill="#3a3f44" />
      <rect x={118} y={88} width={6} height={132} fill="#3a3f44" />
      <rect x={0} y={0} width={150} height={90} rx={6} fill={on ? c.P.roadSign : '#111a16'} stroke={on ? '#e8efe9' : '#2b3a33'} strokeWidth={3} filter={on ? `url(#${c.id}-glowSoft)` : undefined} />
      <text x={75} y={32} textAnchor="middle" fontSize={14} fontWeight={800} textLength={Math.min(130, name.length * 9.5)} lengthAdjust="spacingAndGlyphs" style={SANS} fill={on ? '#f4f8f4' : '#3e4c45'}>
        {name}
      </text>
      <path d="M40 58 H104 M92 46 L106 58 L92 70" stroke={on ? '#f4f8f4' : '#3e4c45'} strokeWidth={6} fill="none" strokeLinecap="round" strokeLinejoin="round" />
      {on && <path d="M20 -4 L75 96 L130 -4" fill={c.P.lamp} opacity={0.06} />}
    </g>
  )
}

function Block({ c, piece }: { c: Ctx; piece: ScenePiece }) {
  const w = piece.w ?? 200
  const h = piece.h ?? 300
  const cols = Math.max(2, Math.floor((w - 30) / 34))
  const rows = Math.max(2, Math.floor((h - 60) / 44))
  return (
    <g transform={`translate(0 ${300 - h})`}>
      <rect x={0} y={0} width={w} height={h} fill={c.P.wall} />
      <rect x={-4} y={-8} width={w + 8} height={10} fill={c.P.roof} />
      <Windows c={c} x={20} y={24} cols={cols} rows={rows} w={18} h={26} gx={34} gy={44} seed={piece.seed ?? 1} />
      <Halftone c={c} x={w * 0.6} y={0} w={w * 0.4} h={h} o={0.45} />
    </g>
  )
}

const DRAW: Record<PieceKind, (c: Ctx, p: ScenePiece) => ReactNode> = {
  gas: (c) => <Gas c={c} />,
  motel: (c) => <Motel c={c} />,
  motelSign: (c) => <MotelSign c={c} />,
  truckWash: (c) => <TruckWash c={c} />,
  cups: (c) => <Cups c={c} />,
  casino: (c) => <Casino c={c} />,
  backroom: (c) => <Backroom c={c} />,
  lamp: (c) => <Lamp c={c} />,
  car: (c) => <Car c={c} />,
  roadSign: (c) => <RoadSign c={c} />,
  block: (c, p) => <Block c={c} piece={p} />,
  truck: (c) => <Truck c={c} />,
}

function mesaPath(from: number, to: number, base: number, top: number, seed: number): string {
  const rng = createRng(seed)
  let x = from
  let d = `M${from} ${base + 40} L${from} ${base}`
  while (x < to) {
    const gap = 60 + rng() * 160
    const rise = 30 + rng() * 40
    const flat = 80 + rng() * 220
    const h = top * (0.45 + rng() * 0.55)
    d += ` L${x + gap} ${base} L${x + gap + rise} ${base - h} L${x + gap + rise + flat} ${base - h} L${x + gap + rise * 2 + flat} ${base}`
    x += gap + rise * 2 + flat
  }
  return `${d} L${x} ${base + 40} Z`
}

function Stars({ w, top, horizon, seed }: { w: number; top: number; horizon: number; seed: number }) {
  const rng = createRng(seed)
  const out: ReactNode[] = []
  for (let i = 0; i < 140; i++) {
    const x = -900 + rng() * (w + 1800)
    const y = top + rng() * (horizon - 160 - top)
    const r = 0.6 + rng() * 1.3
    const tw = i % 9 === 0
    out.push(
      <circle key={i} cx={x} cy={y} r={r} fill="#f4f1ea" opacity={0.2 + rng() * 0.6} className={tw ? 'st-motion st-twinkle' : undefined} style={tw ? { animationDelay: `${(i % 7) * 0.7}s` } : undefined} />,
    )
  }
  return <>{out}</>
}

/** The whole street for one layout. Pure: same props, same picture. */
export const SceneArt = memo(function SceneArt({
  config,
  layout,
  state,
  idPrefix,
  headlights = true,
}: {
  config: CitySceneConfig
  layout: SceneLayout
  state: SceneArtState
  idPrefix: string
  headlights?: boolean
}) {
  const P = config.palette
  const v = config.view[layout]
  const c: Ctx = { P, id: idPrefix, state, config }
  const id = idPrefix
  const placed = (front: boolean) =>
    config.pieces
      .filter((p) => !!p.front === front && p[layout])
      .map((p) => {
        const pl = p[layout]!
        return (
          <g key={p.id} transform={`translate(${pl.x} ${pl.y}) scale(${pl.s})`}>
            {DRAW[p.kind](c, p)}
          </g>
        )
      })
  const moon: [number, number] = layout === 'wide' ? [1330, 130] : [470, 110]
  const bottom = v.y0 + v.h
  const lane = v.road + (bottom - v.road) * 0.52
  return (
    <svg viewBox={`0 ${v.y0} ${v.w} ${v.h}`} width="100%" height="100%" overflow="visible" aria-hidden focusable="false" className="block">
      <defs>
        <linearGradient id={`${id}-sky`} gradientUnits="userSpaceOnUse" x1="0" y1={-200} x2="0" y2={v.horizon}>
          <stop offset="0" stopColor={P.skyTop} />
          <stop offset="0.65" stopColor={P.skyMid} />
          <stop offset="1" stopColor={P.haze} />
        </linearGradient>
        <linearGradient id={`${id}-lot`} gradientUnits="userSpaceOnUse" x1="0" y1={v.horizon} x2="0" y2={v.road}>
          <stop offset="0" stopColor="#1d1714" />
          <stop offset="1" stopColor={P.lot} />
        </linearGradient>
        <radialGradient id={`${id}-pool`}>
          <stop offset="0" stopColor={P.lamp} stopOpacity="0.38" />
          <stop offset="1" stopColor={P.lamp} stopOpacity="0" />
        </radialGradient>
        <linearGradient id={`${id}-cone`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor={P.lamp} stopOpacity="0.2" />
          <stop offset="1" stopColor={P.lamp} stopOpacity="0" />
        </linearGradient>
        <linearGradient id={`${id}-canopy`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#dff0ff" stopOpacity="0.22" />
          <stop offset="1" stopColor="#dff0ff" stopOpacity="0" />
        </linearGradient>
        <linearGradient id={`${id}-door`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#ffd58f" />
          <stop offset="1" stopColor="#b8642a" />
        </linearGradient>
        <linearGradient id={`${id}-beam`} x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor="#fff4d6" stopOpacity="0.5" />
          <stop offset="1" stopColor="#fff4d6" stopOpacity="0" />
        </linearGradient>
        <pattern id={`${id}-dots`} width="6" height="6" patternUnits="userSpaceOnUse">
          <circle cx="3" cy="3" r="1.5" fill={P.shade} />
        </pattern>
        <filter id={`${id}-glow`} x="-50%" y="-50%" width="200%" height="200%">
          <feGaussianBlur stdDeviation="3.5" result="b" />
          <feMerge>
            <feMergeNode in="b" />
            <feMergeNode in="b" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
        <filter id={`${id}-glowSoft`} x="-30%" y="-30%" width="160%" height="160%">
          <feGaussianBlur stdDeviation="6" result="b" />
          <feMerge>
            <feMergeNode in="b" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>

      {/* sky, stars, moon */}
      <rect x={-3000} y={-3000} width={v.w + 6000} height={3000 + v.horizon} fill={`url(#${id}-sky)`} />
      <Stars w={v.w} top={-600} horizon={v.horizon} seed={layout === 'wide' ? 5 : 9} />
      <circle cx={moon[0]} cy={moon[1]} r={30} fill="#efe6d2" opacity={0.9} filter={`url(#${id}-glowSoft)`} />
      <circle cx={moon[0] + 12} cy={moon[1] - 6} r={27} fill={P.skyTop} opacity={0.92} />

      {/* desert: far and near mesas */}
      <path d={mesaPath(-2400, v.w + 2400, v.horizon, 120, 21)} fill={P.mesaFar} />
      <path d={mesaPath(-2400, v.w + 2400, v.horizon + 6, 70, 33)} fill={P.mesa} />

      {/* the lot and the road */}
      <rect x={-3000} y={v.horizon} width={v.w + 6000} height={v.road - v.horizon} fill={`url(#${id}-lot)`} />
      <rect x={-3000} y={v.road} width={v.w + 6000} height={3000} fill={P.road} />
      <rect x={-3000} y={v.road - 3} width={v.w + 6000} height={6} fill={P.curb} />
      <path d={`M-3000 ${lane} H${v.w + 3000}`} stroke={P.roadLine} strokeWidth={4} strokeDasharray="38 34" opacity={0.55} />

      {placed(false)}

      {headlights && (
        <g className="st-motion st-headlight" style={{ ['--st-road' as string]: `${v.w + 1400}px` }}>
          <g transform={`translate(-700 ${lane + (bottom - lane) * 0.35})`}>
            <path d="M0 -10 L320 -50 L320 40 L0 6 Z" fill={`url(#${id}-beam)`} />
            <rect x={-150} y={-24} width={150} height={34} rx={10} fill="#07080a" />
            <circle cx={-2} cy={-2} r={4} fill="#fff4d6" />
            <rect x={-150} y={-10} width={4} height={6} fill="#ff4d5e" />
          </g>
        </g>
      )}

      {placed(true)}
    </svg>
  )
})
