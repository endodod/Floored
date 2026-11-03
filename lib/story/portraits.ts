/**
 * Story portraits: the "warm noir" treatment (mix 1) from `.md/story/portrait-styles.html`,
 * ported to a pure string generator. Round friendly faces, a single lamp from the left (shadow side
 * with halftone dots), a gold rim light on the lit edge, set inside a poker chip in the
 * character's colour. Pure: no React, no DOM.
 */
import { CHARACTER_BY_ID } from './content/characters'

export type PortraitLook = 'jo' | 'sloane' | 'vale' | 'notary' | 'marta' | 'pike' | 'cutter'
export type Expression = 'neutral' | 'pleased' | 'angry'

export const PORTRAIT_LOOKS: PortraitLook[] = ['jo', 'sloane', 'vale', 'notary', 'marta', 'pike', 'cutter']
export const PORTRAIT_EXPRESSIONS: Expression[] = ['neutral', 'pleased', 'angry']

// Shared geometry (viewBox 0 0 200 240). Every look draws the same face plan.
const FACE: Record<PortraitLook, string> = {
  jo: 'M56,98 C56,60 76,46 100,46 C124,46 144,60 144,98 C144,130 130,160 100,166 C70,160 56,130 56,98 Z',
  sloane: 'M58,96 C58,58 78,44 100,44 C122,44 142,58 142,96 C142,128 126,158 100,168 C74,158 58,128 58,96 Z',
  vale: 'M56,96 C56,56 78,42 100,42 C122,42 144,56 144,96 C144,134 132,164 100,172 C68,164 56,134 56,96 Z',
  notary: 'M55,98 C55,58 76,44 100,44 C124,44 145,58 145,98 C145,132 130,162 100,168 C70,162 55,132 55,98 Z',
  marta: 'M57,98 C57,60 77,46 100,46 C123,46 143,60 143,98 C143,130 128,160 100,166 C72,160 57,130 57,98 Z',
  pike: 'M57,96 C57,58 77,44 100,44 C123,44 143,58 143,96 C143,132 130,162 100,168 C70,162 57,132 57,96 Z',
  cutter: 'M55,96 C55,56 77,42 100,42 C123,42 145,56 145,96 C145,134 132,166 100,172 C68,166 55,134 55,96 Z',
}
const SHADE = 'M106,36 C128,62 146,104 128,180 L170,180 L170,36 Z'

interface Pal {
  id: string
  hair: string
  hairShade: string
  cloth: string
  clothShade: string
  shirt: string
  accent: string
  skinShade: string
  visor: string
}

interface Char {
  skin: string
  skinShade: string
  hair: string
  hairShade: string
  cloth: string
  clothShade: string
  shirt: string
  accent: string
  chip: string
  hairBack: (P: Pal) => string
  hairFront: (P: Pal) => string
  extra: (P: Pal) => string
  clothes: (P: Pal) => string
}

const SHOULDERS = 'M18,240 C22,202 50,186 84,182 L116,182 C150,186 178,202 182,240 Z'

const CHARS: Record<PortraitLook, Char> = {
  jo: {
    skin: '#8d5a3b', skinShade: '#6a3f27', hair: '#1f1612', hairShade: '#0d0907',
    cloth: '#16181a', clothShade: '#0b0c0d', shirt: '#ece6d8', accent: '#d9a441', chip: '#2f7a5a',
    hairBack: () =>
      [[64, 76, 17], [80, 60, 19], [100, 54, 20], [120, 60, 19], [136, 76, 17], [58, 94, 11], [142, 94, 11], [72, 66, 14], [128, 66, 14]]
        .map(([x, y, r]) => `<circle cx="${x}" cy="${y}" r="${r}"/>`).join(''),
    hairFront: () => '',
    extra: (P) => `
        <path d="M52,82 Q100,62 148,82 L150,90 Q100,72 50,90 Z" fill="${P.visor}" opacity="0.95"/>
        <path d="M44,88 Q100,68 156,88 Q162,98 150,100 Q100,82 50,100 Q38,98 44,88 Z" fill="${P.visor}" opacity="0.7"/>`,
    clothes: (P) => `
        <path d="${SHOULDERS}" fill="${P.cloth}"/>
        <path d="M84,182 L100,214 L116,182 Z" fill="${P.shirt}"/>
        <path d="M86,196 L100,204 L86,212 Z M114,196 L100,204 L114,212 Z" fill="${P.accent}"/>
        <circle cx="100" cy="204" r="4" fill="${P.accent}"/>`,
  },
  sloane: {
    skin: '#ecc8a8', skinShade: '#c99c7c', hair: '#2a1416', hairShade: '#150a0b',
    cloth: '#a8323f', clothShade: '#6e1f29', shirt: '#151315', accent: '#d9a441', chip: '#b83a50',
    hairBack: () => '<path d="M48,104 C44,54 72,34 100,34 C130,34 156,54 152,104 L156,160 L132,160 C138,124 136,98 132,82 L68,82 C64,98 62,124 68,160 L44,160 Z"/>',
    hairFront: (P) => `<path d="M58,90 C60,56 78,42 102,42 C126,42 142,56 142,82 C128,70 108,64 92,60 C82,70 70,82 58,90 Z" fill="${P.hair}"/>`,
    extra: (P) => `<circle cx="57" cy="128" r="6" fill="none" stroke="${P.accent}" stroke-width="2.6"/><circle cx="143" cy="128" r="6" fill="none" stroke="${P.accent}" stroke-width="2.6"/>`,
    clothes: (P) => `
        <path d="${SHOULDERS}" fill="${P.cloth}"/>
        <path d="M84,182 L100,226 L116,182 Z" fill="${P.shirt}"/>
        <path d="M84,182 L70,196 L92,226 L100,226 Z M116,182 L130,196 L108,226 L100,226 Z" fill="${P.clothShade}"/>`,
  },
  vale: {
    skin: '#dcbca2', skinShade: '#b4917a', hair: '#c9c6bf', hairShade: '#8e8b85',
    cloth: '#0f1011', clothShade: '#050506', shirt: '#f1ede4', accent: '#d9a441', chip: '#1b1a1f',
    hairBack: () => '<path d="M54,104 C50,58 74,38 100,38 C128,38 152,58 146,104 C142,84 140,72 132,66 L68,66 C60,72 58,84 54,104 Z"/>',
    hairFront: (P) => `<path d="M56,90 C56,56 78,40 102,40 C130,40 146,58 144,88 C136,70 120,58 100,58 C86,58 70,68 56,90 Z" fill="${P.hair}"/>
        <path d="M70,62 C86,52 112,50 132,60" fill="none" stroke="${P.hairShade}" stroke-width="2" opacity="0.7"/>`,
    extra: (P) => `<path d="M84,134 Q100,126 116,134 Q108,139 100,135 Q92,139 84,134 Z" fill="${P.hair}"/>
        <path d="M70,128 Q72,142 80,150 M130,128 Q128,142 120,150" fill="none" stroke="${P.skinShade}" stroke-width="1.6" opacity="0.8"/>`,
    clothes: (P) => `
        <path d="${SHOULDERS}" fill="${P.cloth}"/>
        <path d="M86,182 L100,236 L114,182 Z" fill="${P.shirt}"/>
        <path d="M88,190 L100,196 L88,202 Z M112,190 L100,196 L112,202 Z" fill="${P.cloth}"/>
        <circle cx="136" cy="212" r="7" fill="${P.accent}"/><circle cx="136" cy="212" r="3.2" fill="${P.cloth}"/>`,
  },
  // The Notary: bald, round glasses, dark suit, purple tie to match the chip.
  notary: {
    skin: '#d8b89a', skinShade: '#b08f74', hair: '#8e8b85', hairShade: '#8e8b85',
    cloth: '#25222c', clothShade: '#121016', shirt: '#ece6d8', accent: '#6b5a8a', chip: '#6b5a8a',
    hairBack: () =>
      '<path d="M54,108 C52,92 56,84 62,82 L66,112 Z"/><path d="M146,108 C148,92 144,84 138,82 L134,112 Z"/>',
    hairFront: () => '',
    extra: () => `
        <circle cx="80" cy="104" r="12.5" fill="rgba(255,255,255,0.08)" stroke="#d9a441" stroke-width="2.4"/>
        <circle cx="120" cy="104" r="12.5" fill="rgba(255,255,255,0.08)" stroke="#d9a441" stroke-width="2.4"/>
        <path d="M92.5,103 Q100,98 107.5,103" fill="none" stroke="#d9a441" stroke-width="2.2"/>
        <path d="M67.5,102 L58,98 M132.5,102 L142,98" fill="none" stroke="#d9a441" stroke-width="2"/>
        <path d="M70,128 Q72,140 78,146 M130,128 Q128,140 122,146" fill="none" stroke="#b08f74" stroke-width="1.4" opacity="0.7"/>`,
    clothes: (P) => `
        <path d="${SHOULDERS}" fill="${P.cloth}"/>
        <path d="M86,182 L100,230 L114,182 Z" fill="${P.shirt}"/>
        <path d="M88,190 L100,198 L88,206 Z M112,190 L100,198 L112,206 Z" fill="${P.clothShade}"/>
        <path d="M95,196 L105,196 L108,232 L100,238 L92,232 Z" fill="${P.accent}"/>
        <path d="M95,196 L105,196 L102,204 L98,204 Z" fill="${P.clothShade}" opacity="0.5"/>`,
  },
  // Marta: older woman, grey-streaked bun, apron over a blouse.
  marta: {
    skin: '#c99572', skinShade: '#9f6f50', hair: '#5d5754', hairShade: '#3a3533',
    cloth: '#7a4a3a', clothShade: '#52301f', shirt: '#ece6d8', accent: '#d9a441', chip: '#d9a441',
    hairBack: () =>
      '<circle cx="100" cy="30" r="17"/><path d="M52,104 C48,56 72,38 100,38 C128,38 152,56 148,104 C146,84 142,72 134,66 L66,66 C58,72 54,84 52,104 Z"/>',
    hairFront: (P) => `<path d="M57,92 C56,58 78,42 102,42 C128,42 144,58 143,90 C136,70 120,58 100,58 C84,58 68,70 57,92 Z" fill="${P.hair}"/>
        <path d="M74,60 C86,52 100,50 112,52 M84,56 C96,52 108,54 120,60" fill="none" stroke="#d8d4cc" stroke-width="2.6" stroke-linecap="round"/>
        <path d="M90,24 C98,20 106,20 112,26" fill="none" stroke="#d8d4cc" stroke-width="2.2" stroke-linecap="round" opacity="0.9"/>`,
    extra: (P) => `<path d="M72,126 Q74,140 82,148 M128,126 Q126,140 118,148" fill="none" stroke="${P.skinShade}" stroke-width="1.4" opacity="0.8"/>
        <path d="M70,98 L64,96 M130,98 L136,96" fill="none" stroke="${P.skinShade}" stroke-width="1.2" opacity="0.7"/>
        <circle cx="58" cy="122" r="3.4" fill="${P.accent}"/><circle cx="142" cy="122" r="3.4" fill="${P.accent}"/>`,
    clothes: (P) => `
        <path d="${SHOULDERS}" fill="${P.cloth}"/>
        <path d="M84,182 Q100,198 116,182 L112,190 Q100,202 88,190 Z" fill="${P.shirt}"/>
        <path d="M60,240 L68,206 Q84,198 100,200 Q116,198 132,206 L140,240 Z" fill="${P.shirt}"/>
        <path d="M70,200 L76,186 L84,190 L80,204 Z M130,200 L124,186 L116,190 L120,204 Z" fill="${P.shirt}"/>
        <path d="M72,236 L76,214 M128,236 L124,214" fill="none" stroke="${P.accent}" stroke-width="2.4" stroke-linecap="round"/>
        <rect x="86" y="220" width="28" height="14" rx="3" fill="none" stroke="${P.accent}" stroke-width="2"/>`,
  },
  // Pike: beanie, stubble, zip jacket.
  pike: {
    skin: '#b88a64', skinShade: '#8f6542', hair: '#2a1d18', hairShade: '#1a120e',
    cloth: '#3d4652', clothShade: '#242a32', shirt: '#cfc8b8', accent: '#d9a441', chip: '#4a7fb5',
    hairBack: () => '<path d="M54,104 C52,76 60,64 70,60 L130,60 C140,64 148,76 146,104 L140,100 L60,100 Z"/>',
    hairFront: () => `<path d="M53,86 C50,48 74,32 100,32 C128,32 152,48 147,86 Q100,74 53,86 Z" fill="#35597f"/>
        <path d="M52,76 Q100,62 148,76 L149,88 Q100,76 51,88 Z" fill="#4a7fb5"/>
        <path d="M60,80 L60,72 M72,76 L72,68 M84,73 L84,65 M96,72 L96,64 M108,72 L108,64 M120,73 L120,65 M132,76 L132,68 M144,80 L144,72" stroke="#2c4a6b" stroke-width="2" stroke-linecap="round" opacity="0.7"/>
        <circle cx="100" cy="30" r="6" fill="#4a7fb5"/>`,
    extra: (P) => `
        <defs><pattern id="stubble-${P.id}" width="4" height="4" patternUnits="userSpaceOnUse"><circle cx="1" cy="1" r="0.7" fill="#1a120e"/><circle cx="3" cy="3" r="0.7" fill="#1a120e"/></pattern></defs>
        <path d="M60,118 C64,152 84,166 100,168 C116,166 136,152 140,118 C130,140 116,146 100,146 C84,146 70,140 60,118 Z" fill="url(#stubble-${P.id})" opacity="0.85"/>
        <path d="M86,136 Q100,130 114,136" fill="none" stroke="#1a120e" stroke-width="1.2" opacity="0.45"/>`,
    clothes: (P) => `
        <path d="${SHOULDERS}" fill="${P.cloth}"/>
        <path d="M84,182 L100,206 L116,182 Z" fill="${P.shirt}"/>
        <path d="M84,182 L72,198 L94,214 L100,206 Z M116,182 L128,198 L106,214 L100,206 Z" fill="${P.clothShade}"/>
        <path d="M100,206 L100,240" stroke="${P.accent}" stroke-width="2.6"/>
        <rect x="50" y="216" width="22" height="8" rx="2" fill="${P.clothShade}"/>`,
  },
  // Cutter Hale: hat brim, moustache, leather vest.
  cutter: {
    skin: '#d2a27c', skinShade: '#a77a58', hair: '#3a2a1e', hairShade: '#241810',
    cloth: '#6a4326', clothShade: '#432913', shirt: '#e6dcc4', accent: '#d9a441', chip: '#8a5a2b',
    hairBack: () => '<path d="M54,108 C52,86 58,76 66,72 L72,112 Z"/><path d="M146,108 C148,86 142,76 134,72 L128,112 Z"/>',
    hairFront: () => `<path d="M60,78 C58,40 78,26 100,26 C124,26 142,40 140,78 Z" fill="#4a3320"/>
        <path d="M59,70 Q100,80 141,70 L141,78 Q100,88 59,78 Z" fill="#241810"/>
        <path d="M34,78 Q100,60 166,78 Q168,84 160,84 Q100,74 40,84 Q32,84 34,78 Z" fill="#4a3320"/>
        <path d="M40,84 Q100,74 160,84" fill="none" stroke="#241810" stroke-width="1.6" opacity="0.7"/>`,
    extra: (P) => `<path d="M80,132 Q92,124 100,131 Q108,124 120,132 Q112,140 100,136 Q88,140 80,132 Z" fill="${P.hair}"/>`,
    clothes: (P) => `
        <path d="${SHOULDERS}" fill="${P.shirt}"/>
        <path d="M30,240 C32,208 54,192 84,186 L96,240 Z M170,240 C168,208 146,192 116,186 L104,240 Z" fill="${P.cloth}"/>
        <path d="M84,182 L100,206 L116,182 Z" fill="${P.shirt}" opacity="0"/>
        <path d="M84,186 L96,240 L90,240 L78,192 Z M116,186 L104,240 L110,240 L122,192 Z" fill="${P.clothShade}"/>
        <circle cx="84" cy="214" r="3" fill="${P.accent}"/><circle cx="116" cy="214" r="3" fill="${P.accent}"/>`,
  },
}

// Treatment constants for mix 1 (Ds.treat + noirLight(1) + Cs.treat.rim).
const T = {
  line: '#2a1d18', lineW: 1.8, white: '#fffaf2', eyeRx: 8, eyeRy: 8.4, eye: '#241815',
  mouthLine: '#4a2a22', mouthFill: '#7d2a2a', noseLine: '#a0705a', browW: 3.6,
  cheeks: 'rgba(229,86,111,0.18)', visor: '#2f7a5a',
}

function lighten(hex: string, amt: number): string {
  const n = parseInt(hex.slice(1), 16)
  const ch = (v: number) => Math.round(v + (255 - v) * amt).toString(16).padStart(2, '0')
  return `#${ch((n >> 16) & 255)}${ch((n >> 8) & 255)}${ch(n & 255)}`
}

function brows(e: Expression, color: string): string {
  const s = `fill="none" stroke="${color}" stroke-width="${T.browW}" stroke-linecap="round"`
  if (e === 'angry') return `<path d="M70,86 L91,95" ${s}/><path d="M109,95 L130,86" ${s}/>`
  if (e === 'pleased') return `<path d="M70,88 Q80,80 90,86" ${s}/><path d="M110,86 Q120,80 130,88" ${s}/>`
  return `<path d="M70,90 Q80,86 90,90" ${s}/><path d="M110,90 Q120,86 130,90" ${s}/>`
}

function eyes(e: Expression): string {
  if (e === 'pleased') {
    const s = `fill="none" stroke="${T.eye}" stroke-width="${T.lineW + 0.6}" stroke-linecap="round"`
    return `<path d="M73,106 Q80,99 87,106" ${s}/><path d="M113,106 Q120,99 127,106" ${s}/>`
  }
  const ry = e === 'angry' ? T.eyeRy * 0.62 : T.eyeRy
  const one = (x: number) =>
    `<ellipse cx="${x}" cy="104" rx="${T.eyeRx}" ry="${ry}" fill="${T.white}" stroke="${T.line}" stroke-width="${T.lineW * 0.6}"/>
         <circle cx="${x + 1}" cy="104" r="${Math.min(ry, T.eyeRx) * 0.62}" fill="${T.eye}"/>
         <circle cx="${x + 2.6}" cy="102" r="1.4" fill="#fff"/>`
  return one(80) + one(120)
}

function mouth(e: Expression, who: PortraitLook): string {
  const s = `stroke="${T.mouthLine}" stroke-width="${T.lineW}" stroke-linecap="round" stroke-linejoin="round"`
  const y = who === 'vale' ? 4 : 0
  if (e === 'pleased') {
    if (who === 'vale') return `<path d="M88,${142 + y} Q104,${150 + y} 116,${138 + y}" fill="none" ${s}/>`
    return `<path d="M84,138 Q100,156 116,138 Q100,144 84,138 Z" fill="${T.mouthFill}" ${s}/>`
  }
  if (e === 'angry') return `<path d="M87,${146 + y} Q100,${137 + y} 113,${146 + y}" fill="none" ${s}/>`
  return `<path d="M88,${141 + y} Q100,${144 + y} 112,${141 + y}" fill="none" ${s}/>`
}

const nose = () =>
  `<path d="M100,106 Q95,121 99,126 Q103,128 107,124" fill="none" stroke="${T.noseLine}" stroke-width="${T.lineW * 0.8}" stroke-linecap="round"/>`

function figure(who: PortraitLook, e: Expression, id: string): string {
  const c = CHARS[who]
  const pal: Pal = {
    id, hair: c.hair, hairShade: c.hairShade, cloth: c.cloth, clothShade: c.clothShade,
    shirt: c.shirt, accent: c.accent, skinShade: c.skinShade, visor: T.visor,
  }
  const skin = `url(#skin-${id})`
  const outline = `stroke="${T.line}" stroke-width="${T.lineW}" stroke-linejoin="round"`
  const browColor = c.hairShade === '#8e8b85' ? '#8e8b85' : '#2a1d18'
  const defs =
    `<radialGradient id="skin-${id}" cx="0.42" cy="0.4" r="0.7"><stop offset="0" stop-color="${lighten(c.skin, 0.16)}"/><stop offset="1" stop-color="${c.skin}"/></radialGradient>` +
    `<pattern id="dots-${id}" width="4.4" height="4.4" patternUnits="userSpaceOnUse"><circle cx="2.2" cy="2.2" r="1.25" fill="#0b0c0b"/></pattern>
          <linearGradient id="lamp-${id}" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#fff" stop-opacity="0.18"/><stop offset="0.55" stop-color="#fff" stop-opacity="0"/></linearGradient>`
  const shade =
    `<path d="${SHADE}" fill="#141210" opacity="0.55"/>` +
    `<path d="M94,36 C118,66 134,104 120,180 L170,180 L170,36 Z" fill="url(#dots-${id})" opacity="0.5"/>` +
    `<rect x="40" y="30" width="80" height="160" fill="url(#lamp-${id})"/>`
  const rim = `<path d="${FACE[who]}" fill="none" stroke="#d9a441" stroke-width="2.4" stroke-dasharray="0 0" clip-path="url(#rimclip-${id})"/>
          <defs><clipPath id="rimclip-${id}"><rect x="0" y="0" width="78" height="240"/></clipPath></defs>`
  return `
      <defs>
        <clipPath id="face-${id}"><path d="${FACE[who]}"/></clipPath>
        ${defs}
      </defs>
      <g fill="${pal.hair}" ${outline}>${c.hairBack(pal)}</g>
      <g ${outline}>${c.clothes(pal)}</g>
      <path d="M86,150 L86,186 Q100,192 114,186 L114,150 Z" fill="${skin}" ${outline}/>
      <path d="M86,170 Q100,180 114,170 L114,186 Q100,192 86,186 Z" fill="${pal.skinShade}" opacity="0.55"/>
      <ellipse cx="${who === 'sloane' ? 59 : 57}" cy="106" rx="7" ry="11" fill="${skin}" ${outline}/>
      <ellipse cx="${who === 'sloane' ? 141 : 143}" cy="106" rx="7" ry="11" fill="${skin}" ${outline}/>
      <path d="${FACE[who]}" fill="${skin}" ${outline}/>
      <g clip-path="url(#face-${id})">${shade}</g>
      <ellipse cx="74" cy="124" rx="9" ry="5" fill="${T.cheeks}"/><ellipse cx="126" cy="124" rx="9" ry="5" fill="${T.cheeks}"/>
      ${c.hairFront(pal)}
      ${brows(e, browColor)}
      ${eyes(e)}
      ${nose()}
      ${mouth(e, who)}
      ${c.extra(pal)}
      ${rim}`
}

function chipFrame(inner: string, chip: string, id: string): string {
  const dashes = Array.from({ length: 8 }, (_, k) => `<rect x="94" y="22" width="12" height="20" rx="2" fill="#f3ead8" transform="rotate(${k * 45} 100 116)"/>`).join('')
  return `
      <defs><radialGradient id="spot-${id}" cx="0.36" cy="0.3" r="0.8"><stop offset="0" stop-color="#3a3528"/><stop offset="1" stop-color="#0b0d0c"/></radialGradient></defs>
      <circle cx="100" cy="116" r="94" fill="${chip}" stroke="#d9a441" stroke-width="2"/>
      ${dashes}
      <circle cx="100" cy="116" r="74" fill="#f3ead8"/>
      <circle cx="100" cy="116" r="70" fill="url(#spot-${id})"/>
      <g clip-path="url(#frame-${id})"><g transform="translate(100 120) scale(0.74) translate(-100 -112)">${inner}</g></g>
      <circle cx="100" cy="116" r="70" fill="none" stroke="#d9a441" stroke-width="2"/>
      <defs><clipPath id="frame-${id}"><circle cx="100" cy="116" r="70"/></clipPath></defs>`
}

/** A full SVG string for one portrait. Ids are prefixed so many portraits can share a page. */
export function portraitSvg(
  look: PortraitLook,
  expression: Expression,
  opts: { size?: number; idPrefix?: string } = {},
): string {
  const id = (opts.idPrefix ?? `pt-${look}-${expression}`).replace(/[^A-Za-z0-9_-]/g, '-')
  const chip = CHARACTER_BY_ID.get(look)?.chip ?? CHARS[look].chip
  const dim = opts.size ? ` width="${opts.size}" height="${Math.round((opts.size * 240) / 200)}"` : ''
  const body = chipFrame(figure(look, expression, id), chip, id)
  return `<svg viewBox="0 0 200 240"${dim} xmlns="http://www.w3.org/2000/svg" aria-hidden="true" focusable="false">${body}</svg>`
}
