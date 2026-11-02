import type { Character } from '../types'

/** Every character, recurring and local. Ids are stable (saves and scenes refer to them). */
export const CHARACTERS: Character[] = [
  // Recurring
  { id: 'jo', name: 'Jo', note: "Dealt at your grandfather's club for twenty years. Travels with you, says what you're thinking.", city: null, chip: '#2f7a5a' },
  { id: 'sloane', name: 'Sloane', note: "Vale's protégée. Fast, proud, keeps turning up one city ahead.", city: null, chip: '#b83a50' },
  { id: 'vale', name: 'Vale', note: 'Won the club in one hand. Owns more of the circuit than anyone admits.', city: null, chip: '#1b1a1f' },
  { id: 'notary', name: 'The Notary', note: 'Lends to anyone, forgets nothing. Polite to the point of menace.', city: null, chip: '#6b5a8a' },

  // Dustwater
  { id: 'marta', name: 'Marta', note: 'Runs the Starlite Motel and its diner bar. Has seen every kind of broke.', city: 'dustwater', chip: '#d9a441', minigame: 'last-orders' },
  { id: 'pike', name: 'Pike', note: 'Street hustler with a folding table and three cups. Knows every back room in town.', city: 'dustwater', chip: '#4a7fb5', minigame: 'shuffle-tracker' },
  { id: 'cutter', name: 'Cutter Hale', note: "Dustwater's Liar's Dice champion. Never blinks, never forgets a bluff.", city: 'dustwater', chip: '#8a5a2b' },
]

export const CHARACTER_BY_ID = new Map(CHARACTERS.map((c) => [c.id, c]))
