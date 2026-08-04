import type { ConjuringCard } from '@essence/card-schema';

export const COST_TIERS = [
  { minCost: 1, maxCost: 2, tier: 'Minor', attack: [1, 3], health: [3, 6] },
  { minCost: 3, maxCost: 4, tier: 'Early', attack: [3, 6], health: [6, 10] },
  { minCost: 5, maxCost: 6, tier: 'Mid', attack: [6, 9], health: [10, 15] },
  { minCost: 7, maxCost: 8, tier: 'Strong', attack: [9, 12], health: [14, 20] },
  { minCost: 9, maxCost: 10, tier: 'Elite', attack: [12, 15], health: [18, 25] },
  { minCost: 11, maxCost: 12, tier: 'Finisher', attack: [15, 18], health: [23, 31] },
  { minCost: 13, maxCost: 15, tier: 'Ultimate', attack: [18, 22], health: [28, 38] },
] as const;

export function getCostTier(cost: number) {
  return COST_TIERS.find((tier) => cost >= tier.minCost && cost <= tier.maxCost);
}

export function validateConjuring(card: Pick<ConjuringCard, 'name' | 'essenceCost' | 'attack' | 'health'>): string[] {
  const warnings: string[] = [];
  if (!card.name.trim()) warnings.push('Card name is required.');
  if (!Number.isInteger(card.essenceCost) || card.essenceCost < 1 || card.essenceCost > 15) {
    warnings.push('Conjuring Essence cost must be a whole number from 1 to 15.');
    return warnings;
  }

  const tier = getCostTier(card.essenceCost);
  if (!tier) return warnings;
  if (card.attack < tier.attack[0] || card.attack > tier.attack[1]) {
    warnings.push(`Attack is outside the ${tier.tier} baseline of ${tier.attack[0]}–${tier.attack[1]}.`);
  }
  if (card.health < tier.health[0] || card.health > tier.health[1]) {
    warnings.push(`Health is outside the ${tier.tier} baseline of ${tier.health[0]}–${tier.health[1]}.`);
  }
  return warnings;
}
