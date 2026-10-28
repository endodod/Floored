// One drawn icon per Case Battles item, keyed by item name. Every item has its own
// object (no shape is reused across cases); the body is painted in the item's
// rarity colour (currentColor), details in a dark ink and a light highlight.
import type { ReactNode } from 'react'

const INK = { stroke: '#000', strokeOpacity: 0.42, fill: 'none', strokeLinecap: 'round', strokeLinejoin: 'round' } as const
const HI = { fill: '#fff', opacity: 0.28 } as const

const ICONS: Record<string, ReactNode> = {
  // Bronze
  'Worn Glove': (
    <>
      <path d="M7.5 19.5v-3.8L4.6 12.6a1.4 1.4 0 0 1 2.1-1.8L8.4 12.4V5.2a1.3 1.3 0 0 1 2.6 0v5.6V3.9a1.3 1.3 0 0 1 2.6 0v6.9V4.8a1.3 1.3 0 0 1 2.6 0v6.6V7a1.3 1.3 0 0 1 2.6 0v8c0 2-.9 3.4-2 4.5z" fill="currentColor" />
      <rect x="7" y="19" width="10.4" height="3.2" rx="1" fill="currentColor" />
      <path d="M7 20.6h10.4M11 10.8v3M13.6 10.8v3M16.2 11.4v2.6" {...INK} strokeWidth="0.9" />
      <circle cx="12.2" cy="16" r="0.9" fill="#000" opacity="0.45" />
    </>
  ),
  'Cracked Lens': (
    <>
      <circle cx="12" cy="12" r="8.6" fill="currentColor" />
      <circle cx="12" cy="12" r="6.4" fill="#000" opacity="0.38" />
      <path d="M8.2 8.6a5 5 0 0 1 4.4-2.2" stroke="#fff" strokeOpacity="0.5" strokeWidth="1.2" fill="none" strokeLinecap="round" />
      <path d="M13.5 6.2l-1.6 3.6 2.4 1.4-2.8 3.6 1 3.6M11.9 9.8 8.4 11M14.3 11.2l3.2.2" stroke="#fff" strokeOpacity="0.75" strokeWidth="0.8" fill="none" strokeLinejoin="round" />
      <circle cx="12" cy="3.4" r="1.2" fill="currentColor" />
    </>
  ),
  'Steel Pipe': (
    <g transform="rotate(-35 12 12)">
      <rect x="3" y="9.2" width="18" height="5.6" rx="0.6" fill="currentColor" />
      <rect x="1.6" y="7.6" width="3" height="8.8" rx="0.8" fill="currentColor" />
      <rect x="19.4" y="7.6" width="3" height="8.8" rx="0.8" fill="currentColor" />
      <path d="M4.6 10.4h14.8" stroke="#fff" strokeOpacity="0.35" strokeWidth="1" />
      <path d="M4.6 7.6v8.8M19.4 7.6v8.8M11 9.2v5.6" {...INK} strokeWidth="0.8" />
    </g>
  ),
  'Hunter Coat': (
    <>
      <path d="M8.6 3 5 4.6 2.6 15.4l2.8.8L7 10.4V21h10V10.4l1.6 5.8 2.8-.8L19 4.6 15.4 3 12 7.4z" fill="currentColor" />
      <path d="M8.6 3 12 7.4 15.4 3M12 7.4V21M7 10.4l2.4-2M17 10.4l-2.4-2" {...INK} strokeWidth="0.9" />
      <circle cx="13.2" cy="11" r="0.7" fill="#000" opacity="0.5" />
      <circle cx="13.2" cy="14.4" r="0.7" fill="#000" opacity="0.5" />
      <path d="M8.4 16.2h2.2M13.4 16.2h2.2" {...INK} strokeWidth="0.9" />
    </>
  ),
  'Shadow Fang': (
    <>
      <path d="M6 3.2c3.8-.8 8.4-.6 12 .4-.4 6.6-3.6 13.2-8.6 17.6 1.8-5.2 1.4-11-3.4-18z" fill="currentColor" />
      <path d="M8.6 4.2c2.6 4 3.4 8.2 2.6 12.8" stroke="#fff" strokeOpacity="0.35" strokeWidth="1.1" fill="none" strokeLinecap="round" />
      <path d="M6 3.2c3.8-.8 8.4-.6 12 .4" {...INK} strokeWidth="1.1" />
    </>
  ),
  'Cursed Relic': (
    <>
      <path d="M12 2.6c-4.8 0-8 3.2-8 7.6 0 2.6 1.2 4.4 2.8 5.4V19h10.4v-3.4c1.6-1 2.8-2.8 2.8-5.4 0-4.4-3.2-7.6-8-7.6z" fill="currentColor" />
      <rect x="8" y="18.4" width="8" height="3.2" rx="0.8" fill="currentColor" />
      <path d="M10 18.4v3.2M12 18.4v3.2M14 18.4v3.2" {...INK} strokeWidth="0.8" />
      <ellipse cx="9" cy="11" rx="2" ry="2.3" fill="#000" opacity="0.6" />
      <ellipse cx="15" cy="11" rx="2" ry="2.3" fill="#000" opacity="0.6" />
      <path d="M12 13.4l-1.1 2.4h2.2z" fill="#000" opacity="0.55" />
    </>
  ),

  // Silver
  'Frayed Rope': (
    <>
      <ellipse cx="11" cy="6.4" rx="7.4" ry="3" fill="none" stroke="currentColor" strokeWidth="2.4" />
      <ellipse cx="11" cy="11.4" rx="7.4" ry="3" fill="none" stroke="currentColor" strokeWidth="2.4" />
      <ellipse cx="11" cy="16.4" rx="7.4" ry="3" fill="none" stroke="currentColor" strokeWidth="2.4" />
      <path d="M18.4 16.4c1.6 1 2.2 2.4 2.2 4" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" fill="none" />
      <path d="M20.6 20.4l-1 2.2M20.6 20.4l.2 2.4M20.6 20.4l1.4 1.8" stroke="currentColor" strokeWidth="0.8" strokeLinecap="round" />
      <path d="M6 5l1 2.6M10 4.4l1 2.8M14.6 4.6l1 2.6M6 10l1 2.6M10 9.4l1 2.8M14.6 9.6l1 2.6M6 15l1 2.6M10 14.4l1 2.8M14.6 14.6l1 2.6" {...INK} strokeWidth="0.7" />
    </>
  ),
  'Basic Grenade': (
    <>
      <ellipse cx="11.4" cy="14.6" rx="6.4" ry="7" fill="currentColor" />
      <rect x="8.8" y="5.4" width="5.2" height="3" rx="0.6" fill="currentColor" />
      <path d="M14 6.2h3.4l2 3.4" stroke="currentColor" strokeWidth="1.6" fill="none" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx="18.4" cy="4.4" r="1.9" fill="none" stroke="currentColor" strokeWidth="1.2" />
      <path d="M5.4 12.4h12M5.2 16.6h12.4M9.4 8.2v13.2M13.4 8.2v13.2" {...INK} strokeWidth="0.9" />
    </>
  ),
  'Combat Knife': (
    <>
      <path d="M1.6 12.6C4 9.6 8 8.8 13.6 8.8v5.4H4.4c-1.4 0-2.4-.6-2.8-1.6z" fill="currentColor" />
      <path d="M6 8.9l.8-1 .8 1 .8-1 .8 1 .8-1 .8 1 .8-1 .8 1" stroke="currentColor" strokeWidth="0.9" fill="none" strokeLinejoin="round" />
      <rect x="13.6" y="6.6" width="1.8" height="9.8" rx="0.6" fill="currentColor" />
      <rect x="15.4" y="9.2" width="7" height="4.6" rx="1.6" fill="currentColor" />
      <path d="M4 12.4h9.4" stroke="#fff" strokeOpacity="0.35" strokeWidth="0.9" />
      <path d="M17.6 9.4v4.2M19.8 9.4v4.2" {...INK} strokeWidth="0.8" />
    </>
  ),
  'Tactical Vest': (
    <>
      <path d="M7 2.8h3.2c.4 1.6 1 2.4 1.8 2.4s1.4-.8 1.8-2.4H17l1.6 4.2-1 2.8V21H6.4V9.8l-1-2.8z" fill="currentColor" />
      <rect x="7.6" y="12" width="3.6" height="3.4" rx="0.5" fill="#000" opacity="0.32" />
      <rect x="12.8" y="12" width="3.6" height="3.4" rx="0.5" fill="#000" opacity="0.32" />
      <rect x="7.6" y="16.6" width="3.6" height="3" rx="0.5" fill="#000" opacity="0.32" />
      <rect x="12.8" y="16.6" width="3.6" height="3" rx="0.5" fill="#000" opacity="0.32" />
      <path d="M12 7.4V21" {...INK} strokeWidth="0.9" />
    </>
  ),
  'Elite Scope': (
    <>
      <circle cx="12" cy="12" r="8.4" fill="none" stroke="currentColor" strokeWidth="2.4" />
      <circle cx="12" cy="12" r="4" fill="none" stroke="currentColor" strokeWidth="1.4" />
      <path d="M12 1.6v6M12 16.4v6M1.6 12h6M16.4 12h6" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
      <circle cx="12" cy="12" r="1.3" fill="currentColor" />
    </>
  ),
  'Phantom Blade': (
    <g transform="rotate(45 12 12)">
      <path d="M12 1 13.8 4v11.2h-3.6V4z" fill="currentColor" />
      <path d="M6.8 15.2h10.4l-1 1.8H7.8z" fill="currentColor" />
      <rect x="11" y="17" width="2" height="4" fill="currentColor" />
      <circle cx="12" cy="22" r="1.3" fill="currentColor" />
      <path d="M12 3v12" {...INK} strokeWidth="0.8" />
    </g>
  ),

  // Gold
  'Iron Shield': (
    <>
      <path d="M12 2.4 4 5v6.4c0 5 3.4 8.6 8 10.4 4.6-1.8 8-5.4 8-10.4V5z" fill="currentColor" />
      <path d="M12 5 6.4 6.8v4.6c0 3.6 2.4 6.2 5.6 7.6 3.2-1.4 5.6-4 5.6-7.6V6.8z" fill="none" stroke="#000" strokeOpacity="0.35" strokeWidth="0.9" />
      <path d="M12 5v14M6.4 11h11.2" {...INK} strokeWidth="1.1" />
      <path d="M5.4 6.2 12 4" stroke="#fff" strokeOpacity="0.4" strokeWidth="0.9" strokeLinecap="round" />
    </>
  ),
  'Precision Rifle': (
    <>
      <path d="M1.6 11.2h14.6l1.4-1h4.8v3.4l-3.2 4.8h-2.6l1.2-3.6H9.6l-.8 2.4H6.4l.8-2.4H1.6z" fill="currentColor" />
      <rect x="7.4" y="6.6" width="7" height="2.2" rx="1.1" fill="currentColor" />
      <path d="M9.2 8.8v2.4M12.6 8.8v2.4" stroke="currentColor" strokeWidth="1" />
      <path d="M2 12.4h13.6" {...INK} strokeWidth="0.8" />
      <circle cx="14.4" cy="7.7" r="0.6" fill="#fff" opacity="0.6" />
    </>
  ),
  'Battle Armor': (
    <>
      <path d="M12 2.4c-4.6 0-7.6 3.4-7.6 8V18l3.4 3.4h8.4l3.4-3.4v-7.6c0-4.6-3-8-7.6-8z" fill="currentColor" />
      <path d="M6.4 11.4h11.2v1.8H6.4z" fill="#000" opacity="0.6" />
      <path d="M12 2.6v8.6M12 13.4v7.8M9 15.4v3.4M15 15.4v3.4" {...INK} strokeWidth="0.9" />
      <path d="M7.2 8.2c.6-2 2-3.4 4-3.8" stroke="#fff" strokeOpacity="0.4" strokeWidth="1" fill="none" strokeLinecap="round" />
    </>
  ),
  "Dragon's Eye": (
    <>
      <path d="M1.6 12C4.4 6.8 8 4.6 12 4.6s7.6 2.2 10.4 7.4C19.6 17.2 16 19.4 12 19.4S4.4 17.2 1.6 12z" fill="currentColor" />
      <circle cx="12" cy="12" r="5" fill="#000" opacity="0.28" />
      <path d="M12 7.2c-1.2 1.4-1.6 3-1.6 4.8s.4 3.4 1.6 4.8c1.2-1.4 1.6-3 1.6-4.8s-.4-3.4-1.6-4.8z" fill="#000" opacity="0.75" />
      <circle cx="14" cy="9.6" r="1" fill="#fff" opacity="0.7" />
    </>
  ),
  'Void Cannon': (
    <>
      <path d="M3.4 13.6 17.6 5.4a2.2 2.2 0 0 1 2.2 3.8L5.6 17.4z" fill="currentColor" />
      <rect x="18.4" y="4.2" width="2.6" height="5.4" rx="0.8" transform="rotate(-30 19.7 6.9)" fill="currentColor" />
      <circle cx="8.4" cy="17" r="4.6" fill="currentColor" />
      <circle cx="8.4" cy="17" r="2.6" fill="none" stroke="#000" strokeOpacity="0.45" strokeWidth="0.9" />
      <path d="M8.4 12.4v9.2M3.8 17h9.2" {...INK} strokeWidth="0.8" />
      <circle cx="8.4" cy="17" r="0.9" fill="#000" opacity="0.55" />
    </>
  ),
  'Mythic Greaves': (
    <>
      <path d="M7 2.4h6.4v9.8l5.4 3.4c1.4.8 2 2 2 3.4v1.4H7.8L6 18.2z" fill="currentColor" />
      <path d="M7 6.4h6.4M7 9.6h6.4M6.6 16.6h6.8M7.8 20.4h13" {...INK} strokeWidth="0.9" />
      <path d="M13.4 4.4c3-.2 5.6.8 7.4 3-2.4-.2-4.6.4-7.4 2.2" fill="currentColor" opacity="0.75" />
      <path d="M13.6 6.6c2-.2 3.6.2 5 1" {...INK} strokeWidth="0.7" />
    </>
  ),

  // Diamond
  'Dark Crystal': (
    <>
      <path d="M12 1.6 15 5v13l-3 4-3-4V5z" fill="currentColor" />
      <path d="M6 8.4 8.2 10.4V19L6 21.4 3.8 19v-8.6z" fill="currentColor" />
      <path d="M18 7.4l2.2 2.2V18L18 20.6 15.8 18V9.6z" fill="currentColor" />
      <path d="M12 1.6V22M6 8.4v13M18 7.4v13.2" {...INK} strokeWidth="0.8" />
      <path d="M10.4 4.6 12 2.8" stroke="#fff" strokeOpacity="0.6" strokeWidth="0.9" strokeLinecap="round" />
    </>
  ),
  'Inferno Blade': (
    <>
      <path d="M12 1.6c.8 2.6 3.6 4 3.6 7.6 0 1.4-.6 2.6-1.4 3.4.2-1.4-.4-2.4-1.2-3 .2 2-1 3-1 4.8h-.2c-1.4-1-2.8-2.8-2.8-5.2 0-3.4 3-4.6 3-7.6z" fill="currentColor" />
      <rect x="11" y="13.8" width="2" height="2.6" fill="currentColor" />
      <path d="M6.6 16.4h10.8l-1.2 1.6H7.8z" fill="currentColor" />
      <rect x="10.8" y="18" width="2.4" height="3.2" rx="0.6" fill="currentColor" />
      <path d="M12 6.6c-.8 1.2-1.2 2.4-.8 4" {...INK} strokeWidth="0.9" />
    </>
  ),
  'War Machine': (
    <>
      <path d="M10.4 1.8h3.2l.5 2.6 2 .9 2.2-1.5 2.3 2.3-1.5 2.2.9 2 2.6.5v3.2l-2.6.5-.9 2 1.5 2.2-2.3 2.3-2.2-1.5-2 .9-.5 2.6h-3.2l-.5-2.6-2-.9-2.2 1.5-2.3-2.3 1.5-2.2-.9-2-2.6-.5v-3.2l2.6-.5.9-2-1.5-2.2 2.3-2.3 2.2 1.5 2-.9z" fill="currentColor" />
      <circle cx="12" cy="12" r="3.4" fill="#000" opacity="0.5" />
      <circle cx="12" cy="12" r="5.8" fill="none" stroke="#000" strokeOpacity="0.3" strokeWidth="0.8" />
    </>
  ),
  'Thunder Fist': (
    <>
      <path d="M5 9.4c0-1 .8-1.8 1.8-1.8h10c1.6 0 2.8 1.2 2.8 2.8v5c0 3-2.4 5.4-5.4 5.4H10c-2.8 0-5-2.2-5-5z" fill="currentColor" />
      <path d="M5 11.4c-1.6 0-2.4 1-2.4 2.2s1 2 2.4 2" fill="currentColor" />
      <path d="M9 7.6v4M12.2 7.6v4M15.4 7.6v4M5 11.6h14.6" {...INK} strokeWidth="0.9" />
      <path d="M13.4 13.2 10.6 17h2.2l-1 3 3-4h-2.2z" fill="#fff" opacity="0.75" />
      <path d="M17.6 2.4 15.6 5.6h1.8L16 8" stroke="currentColor" strokeWidth="1.2" fill="none" strokeLinecap="round" strokeLinejoin="round" />
    </>
  ),
  'Cosmic Dagger': (
    <>
      <path d="M14.6 2.6A9.6 9.6 0 1 0 21.4 15 7.8 7.8 0 0 1 14.6 2.6z" fill="currentColor" />
      <path d="M7.4 7.6a7 7 0 0 0 1 10" stroke="#fff" strokeOpacity="0.35" strokeWidth="1.1" fill="none" strokeLinecap="round" />
      <circle cx="9.6" cy="10" r="1.1" fill="#000" opacity="0.35" />
      <circle cx="12.6" cy="16" r="1.5" fill="#000" opacity="0.35" />
      <circle cx="7.8" cy="15" r="0.7" fill="#000" opacity="0.35" />
    </>
  ),
  'Eternal Aegis': (
    <>
      <circle cx="12" cy="12" r="9.6" fill="currentColor" />
      <circle cx="12" cy="12" r="7.6" fill="none" stroke="#000" strokeOpacity="0.38" strokeWidth="0.9" />
      <path d="M12 12c0-1 .9-1.6 1.8-1.4 1.4.3 1.9 1.8 1.4 3-.7 1.8-2.8 2.4-4.4 1.6-2.2-1-2.8-3.8-1.6-5.8 1.4-2.4 4.6-3 6.8-1.6" {...INK} strokeWidth="1.2" />
      <circle cx="12" cy="2.4" r="0.6" fill="#000" opacity="0.4" />
      <circle cx="21.6" cy="12" r="0.6" fill="#000" opacity="0.4" />
      <circle cx="12" cy="21.6" r="0.6" fill="#000" opacity="0.4" />
      <circle cx="2.4" cy="12" r="0.6" fill="#000" opacity="0.4" />
    </>
  ),

  // Crown
  'Storm Rune': (
    <>
      <path d="M7 3.2c3.4-1 7.4-.8 10.4.6l1.4 13.4c-2.6 2.8-10.8 3.4-14 .6z" fill="currentColor" />
      <path d="M12 5.6v12M12 8.4l3-2M12 11.4l-3-2.2M12 13.4l3 2.4" {...INK} strokeWidth="1.3" />
      <path d="M7.8 5c1.6-.4 3-.5 4.4-.5" stroke="#fff" strokeOpacity="0.35" strokeWidth="0.9" strokeLinecap="round" />
    </>
  ),
  'Chaos Engine': (
    <>
      <path d="M2.8 4h18.4M4.4 7.8h15M6.6 11.6h10.6M8.4 15.4h6.8M10 19.2h3.6" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" />
      <path d="M11.6 21.2l.6 1.4" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
      <path d="M17 4c1 1.2 1 2.6 0 3.8M15 11.6c.6.8.6 2.6 0 3.8" {...INK} strokeWidth="0.8" />
    </>
  ),
  'Celestial Bow': (
    <>
      <path d="M6.2 2.2c7 2 11 5.8 11 9.8s-4 7.8-11 9.8" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" />
      <path d="M6.2 2.2v19.6" stroke="currentColor" strokeWidth="0.8" strokeOpacity="0.8" />
      <path d="M3 12h17" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
      <path d="M22 12l-3.2-1.8v3.6z" fill="currentColor" />
      <path d="M3 12l-1.2-1.4M3 12l-1.2 1.4M4.6 12l-1.2-1.4M4.6 12l-1.2 1.4" stroke="currentColor" strokeWidth="0.9" strokeLinecap="round" />
    </>
  ),
  "God's Anvil": (
    <>
      <path d="M2 7h14.4c0 2.4 2 3.6 5.6 3.6-1.4 2.2-4 3.2-7.4 3.2l1.2 3H8.2l1.2-3C5 13.8 2.6 11.4 2 7z" fill="currentColor" />
      <rect x="5.6" y="17.8" width="12.4" height="3.4" rx="0.8" fill="currentColor" />
      <path d="M2.4 8.6h13.8M9.4 13.8h5.4" {...INK} strokeWidth="0.9" />
      <path d="M3.6 7.6h11" stroke="#fff" strokeOpacity="0.4" strokeWidth="0.8" strokeLinecap="round" />
    </>
  ),
  'Reality Shard': (
    <>
      <path d="M12 1.4l2.4 7.4L22.6 12l-8.2 3.2L12 22.6l-2.4-7.4L1.4 12l8.2-3.2z" fill="currentColor" />
      <path d="M12 1.4v21.2M1.4 12h21.2" {...INK} strokeWidth="0.8" />
      <path d="M18.4 3.4l.6 1.6 1.6.6-1.6.6-.6 1.6-.6-1.6-1.6-.6 1.6-.6z" fill="currentColor" />
      <path d="M10.6 9.4 12 3.4" stroke="#fff" strokeOpacity="0.5" strokeWidth="0.9" strokeLinecap="round" />
    </>
  ),
  'Omega Crown': (
    <>
      <path d="M2.4 7.4l4.4 3.4L9.2 4 12 9.4 14.8 4l2.4 6.8 4.4-3.4-1.8 10.4H4.2z" fill="currentColor" />
      <rect x="4" y="18.4" width="16" height="2.8" rx="0.8" fill="currentColor" />
      <circle cx="2.4" cy="7.2" r="1.2" fill="currentColor" />
      <circle cx="21.6" cy="7.2" r="1.2" fill="currentColor" />
      <circle cx="9.2" cy="3.6" r="1" fill="currentColor" />
      <circle cx="14.8" cy="3.6" r="1" fill="currentColor" />
      <circle cx="12" cy="14.4" r="1.6" fill="#000" opacity="0.45" />
      <circle cx="7.6" cy="15" r="1" fill="#000" opacity="0.35" />
      <circle cx="16.4" cy="15" r="1" fill="#000" opacity="0.35" />
      <path d="M4 19.8h16" {...INK} strokeWidth="0.8" />
    </>
  ),
}

export function ItemIcon({ name, className = '' }: { name: string; className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={`cb-gem ${className}`} aria-hidden>
      {ICONS[name] ?? <path d="M7 4h10l4 5-9 11.5L3 9z" fill="currentColor" />}
      {!ICONS[name] && <path d="M7 4h10l-2.5 5h-5z" {...HI} />}
    </svg>
  )
}
