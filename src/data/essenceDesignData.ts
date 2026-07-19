export type EssenceName =
  | 'Fire'
  | 'Water'
  | 'Earth'
  | 'Wind'
  | 'Life'
  | 'Death'
  | 'Time'
  | 'Space';

export type ConjuringProfile = 'aggressive' | 'balanced' | 'defensive';

export interface StatLine {
  attack: number;
  health: number;
}

export interface EssenceIdentity {
  id: Lowercase<EssenceName>;
  name: EssenceName;
  signatureType: string;
  topFits: [string, string, string];
}

export interface StatTier {
  id: string;
  costMin: number;
  costMax: number;
  tier: string;
  attackMin: number;
  attackMax: number;
  healthMin: number;
  healthMax: number;
  standard: StatLine;
  averageAttack: number;
  averageHealth: number;
  durabilityGuidance: string;
  profiles: Record<ConjuringProfile, StatLine>;
}

export interface StatAdjustment {
  id: string;
  feature: string;
  attackAdjustment?: string;
  healthAdjustment?: string;
  designReason: string;
}

export const prototypeBalanceConfig = {
  version: '0.4.2-design-data',
  prototypeHealth: 50,
  releaseHealthTarget: 100,
  deckSize: 40,
  combatModel: 'attacker-only damage',
  resourceSource: 'Basic Pillars',
  baselineHealthToAttackRatio: { min: 1.5, max: 1.75 },
  tankHealthToAttackRatio: { min: 1.8, max: 2.1 },
  coreGoal:
    'Comparable same-tier Conjurings should usually survive one hit and fall to the second unless deliberately built as tanks.',
} as const;

export const essenceIdentities: EssenceIdentity[] = [
  { id: 'fire', name: 'Fire', signatureType: 'Phoenix', topFits: ['Phoenix', 'Dragon', 'Abyssal'] },
  { id: 'water', name: 'Water', signatureType: 'Hydra', topFits: ['Leviathan', 'Hydra', 'Dragon'] },
  { id: 'earth', name: 'Earth', signatureType: 'Behemoth', topFits: ['Behemoth', 'Effigy', 'Elephant'] },
  { id: 'wind', name: 'Wind', signatureType: 'Pegasus', topFits: ['Pegasus', 'Raiju', 'Griffin'] },
  { id: 'life', name: 'Life', signatureType: 'Dryad', topFits: ['Dryad', 'Phoenix', 'Hydra'] },
  { id: 'death', name: 'Death', signatureType: 'Abyssal', topFits: ['Abyssal', 'Corvane', 'Effigy'] },
  { id: 'time', name: 'Time', signatureType: 'Sphinx', topFits: ['Sphinx', 'Phoenix', 'Celestial'] },
  { id: 'space', name: 'Space', signatureType: 'Celestial', topFits: ['Celestial', 'Abyssal', 'Dragon'] },
];

export const conjuringStatTiers: StatTier[] = [
  {
    id: 'minor', costMin: 1, costMax: 2, tier: 'Minor',
    attackMin: 1, attackMax: 3, healthMin: 3, healthMax: 6,
    standard: { attack: 2, health: 4 }, averageAttack: 2, averageHealth: 4.5,
    durabilityGuidance: 'Usually survives 1 comparable hit.',
    profiles: {
      aggressive: { attack: 3, health: 3 }, balanced: { attack: 2, health: 4 }, defensive: { attack: 1, health: 6 },
    },
  },
  {
    id: 'early', costMin: 3, costMax: 4, tier: 'Early',
    attackMin: 3, attackMax: 6, healthMin: 6, healthMax: 10,
    standard: { attack: 5, health: 8 }, averageAttack: 4.5, averageHealth: 8,
    durabilityGuidance: 'Usually survives 1 comparable hit.',
    profiles: {
      aggressive: { attack: 6, health: 6 }, balanced: { attack: 5, health: 8 }, defensive: { attack: 3, health: 10 },
    },
  },
  {
    id: 'mid', costMin: 5, costMax: 6, tier: 'Mid',
    attackMin: 6, attackMax: 9, healthMin: 10, healthMax: 15,
    standard: { attack: 8, health: 12 }, averageAttack: 7.5, averageHealth: 12.5,
    durabilityGuidance: 'Falls in about 2 comparable hits.',
    profiles: {
      aggressive: { attack: 9, health: 10 }, balanced: { attack: 8, health: 12 }, defensive: { attack: 6, health: 15 },
    },
  },
  {
    id: 'strong', costMin: 7, costMax: 8, tier: 'Strong',
    attackMin: 9, attackMax: 12, healthMin: 14, healthMax: 20,
    standard: { attack: 11, health: 17 }, averageAttack: 10.5, averageHealth: 17,
    durabilityGuidance: 'Falls in about 2 comparable hits.',
    profiles: {
      aggressive: { attack: 12, health: 14 }, balanced: { attack: 10, health: 17 }, defensive: { attack: 9, health: 20 },
    },
  },
  {
    id: 'elite', costMin: 9, costMax: 10, tier: 'Elite',
    attackMin: 12, attackMax: 15, healthMin: 18, healthMax: 25,
    standard: { attack: 14, health: 22 }, averageAttack: 13.5, averageHealth: 21.5,
    durabilityGuidance: 'Falls in about 2 comparable hits.',
    profiles: {
      aggressive: { attack: 15, health: 18 }, balanced: { attack: 14, health: 22 }, defensive: { attack: 12, health: 25 },
    },
  },
  {
    id: 'finisher', costMin: 11, costMax: 12, tier: 'Finisher',
    attackMin: 15, attackMax: 18, healthMin: 23, healthMax: 31,
    standard: { attack: 17, health: 27 }, averageAttack: 16.5, averageHealth: 27,
    durabilityGuidance: 'Falls in about 2 comparable hits.',
    profiles: {
      aggressive: { attack: 18, health: 23 }, balanced: { attack: 17, health: 27 }, defensive: { attack: 15, health: 31 },
    },
  },
  {
    id: 'ultimate', costMin: 13, costMax: 15, tier: 'Ultimate',
    attackMin: 18, attackMax: 22, healthMin: 28, healthMax: 38,
    standard: { attack: 20, health: 34 }, averageAttack: 20, averageHealth: 33,
    durabilityGuidance: 'Usually needs 2 strong comparable hits.',
    profiles: {
      aggressive: { attack: 22, health: 28 }, balanced: { attack: 20, health: 34 }, defensive: { attack: 18, health: 38 },
    },
  },
];

export const attackAdjustments: StatAdjustment[] = [
  { id: 'strong-summon', feature: 'Strong summon ability', attackAdjustment: '-2 to -4', designReason: "Immediate value replaces part of the card's offensive stat budget." },
  { id: 'swift-repeat', feature: 'Swift or repeated attacks', attackAdjustment: '-2 to -3', designReason: 'Earlier or additional attacks increase total damage output.' },
  { id: 'defensive-value', feature: 'Guard, Armor, or very high Health', attackAdjustment: '-1 to -3', designReason: 'Defensive utility increases battlefield value.' },
  { id: 'drawback', feature: 'Significant drawback', attackAdjustment: '+1 to +3', designReason: 'Risk or restriction can justify more pressure.' },
  { id: 'plain', feature: 'No ability or utility', attackAdjustment: 'Use upper end', designReason: 'A plain Conjuring must earn its cost through printed stats.' },
];

export const healthAdjustments: StatAdjustment[] = [
  { id: 'strong-summon', feature: 'Strong summon effect', healthAdjustment: '-2 to -5', designReason: 'Immediate value should reduce permanent battlefield durability.' },
  { id: 'swift', feature: 'Swift', healthAdjustment: '-1 to -3', designReason: 'Tempo before opponents can prepare is part of the card budget.' },
  { id: 'high-attack', feature: 'High Attack for its tier', healthAdjustment: 'Use lower Health', designReason: 'Avoid combining the best attacker with the best survivor.' },
  { id: 'guard', feature: 'Guard', healthAdjustment: '-1 to -4', designReason: 'Forced targeting is already a major defensive benefit.' },
  { id: 'armor', feature: 'Armor', healthAdjustment: '-2 to -6', designReason: 'Repeated damage reduction raises effective Health across multiple hits.' },
  { id: 'barrier', feature: 'Barrier', healthAdjustment: '-3 to -6', designReason: 'Negating an entire damage event can exceed several points of printed Health.' },
  { id: 'recovery', feature: 'Healing or regeneration', healthAdjustment: '-2 to -5', designReason: 'Repeatable recovery extends time on the battlefield.' },
  { id: 'drawback', feature: 'Significant drawback', healthAdjustment: '+2 to +5', designReason: 'A real restriction can justify extra printed durability.' },
  { id: 'plain', feature: 'No ability', healthAdjustment: 'Use upper half', designReason: 'A vanilla Conjuring depends on printed stat efficiency.' },
];

export const balancingProcedure = [
  'Choose the card’s Essence-cost tier.',
  'Choose an aggressive, balanced, or defensive profile.',
  'Apply Attack adjustments for abilities, speed, and drawbacks.',
  'Apply Health adjustments for Guard, Armor, Barrier, healing, and drawbacks.',
  'Check same-tier combat: a standard card should survive one comparable hit and usually fall to the second.',
  'Playtest against cards one tier below and one tier above.',
] as const;
