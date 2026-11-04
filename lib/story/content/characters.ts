import type { Character } from '../types'

/** Every character, recurring and local. Ids are stable (saves and scenes refer to them). */
export const CHARACTERS: Character[] = [
  // Recurring
  { id: 'jo', name: 'Jo', note: "Dealt at your grandfather's club for twenty years. Travels with you, says what you're thinking. Runs a cashier's drill with you in every town.", city: null, chip: '#2f7a5a', minigame: 'chip-count' },
  { id: 'sloane', name: 'Sloane', note: "Vale's protégée. Fast, proud, keeps turning up one city ahead.", city: null, chip: '#b83a50' },
  { id: 'vale', name: 'Vale', note: "Head of the Syndicate. Won your grandfather's Gilded Floor in one hand, and half the circuit's houses pay Vale rent. Only plays champions: beat all twelve and Vale owes you a seat at the Summit.", city: null, chip: '#1b1a1f' },
  { id: 'notary', name: 'The Notary', note: 'Lends to anyone, forgets nothing. Polite to the point of menace.', city: null, chip: '#6b5a8a' },

  // Dustwater
  { id: 'marta', name: 'Marta', note: 'Runs the Starlite Motel and its diner bar. Has seen every kind of broke.', city: 'dustwater', chip: '#d9a441', minigame: 'last-orders' },
  { id: 'pike', name: 'Pike', note: 'Street hustler with a folding table and three cups. Knows every back room in town.', city: 'dustwater', chip: '#4a7fb5', minigame: 'shuffle-tracker' },
  { id: 'cutter', name: 'Cutter Hale', note: "Dustwater's Liar's Dice champion. Never blinks, never forgets a bluff.", city: 'dustwater', chip: '#8a5a2b' },
]

export const CHARACTER_BY_ID = new Map(CHARACTERS.map((c) => [c.id, c]))
