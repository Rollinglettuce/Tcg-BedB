import type { ConjuringSubtype, EssenceElement } from '@essence/game-rules';

export interface CardAuditFields {
  createdAt: string;
  updatedAt: string;
  createdBy?: string;
  updatedBy?: string;
}

export interface ConjuringCard extends CardAuditFields {
  id: string;
  schemaVersion: '1.0';
  calculationVersion: string;
  name: string;
  cardType: 'Conjuring';
  element: EssenceElement;
  subtype: ConjuringSubtype;
  essenceCost: number;
  attack: number;
  health: number;
  rulesText: string;
  flavorText?: string;
  keywords: string[];
  imageUrl?: string;
  balanceWarnings: string[];
  archived: boolean;
}

export type NewConjuringCard = Omit<
  ConjuringCard,
  'id' | 'createdAt' | 'updatedAt' | 'balanceWarnings' | 'archived'
>;
