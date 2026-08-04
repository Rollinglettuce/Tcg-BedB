export const ESSENCE_ELEMENTS = [
  'Fire',
  'Water',
  'Earth',
  'Wind',
  'Life',
  'Death',
  'Time',
  'Space',
] as const;

export const CARD_TYPES = [
  'Conjuring',
  'Pillar',
  'Rune',
  'Casting',
  'Shield',
] as const;

export const CONJURING_SUBTYPES = [
  'Beast',
  'Spirit',
  'Warrior',
  'Elemental',
  'Dragon',
  'Undead',
  'Construct',
  'Avatar',
  'Mage',
  'Guardian',
] as const;

export const TURN_PHASES = [
  'Start',
  'Essence',
  'Draw',
  'Main',
  'Battle',
  'End',
] as const;

export const GAME_RULES = {
  deckSize: 40,
  startingHand: 7,
  cardsDrawnPerTurn: 2,
  firstPlayerFirstTurnDraw: 1,
  mulligans: 1,
  namedCardCopyLimit: 3,
  pillarPlayLimitPerTurn: 1,
  essencePerActivePillar: 1,
  essencePersistsUntilSpent: true,
  pillarsCanBeAttacked: false,
} as const;

export type EssenceElement = (typeof ESSENCE_ELEMENTS)[number];
export type CardType = (typeof CARD_TYPES)[number];
export type ConjuringSubtype = (typeof CONJURING_SUBTYPES)[number];
export type TurnPhase = (typeof TURN_PHASES)[number];
