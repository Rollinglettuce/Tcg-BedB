export enum CardType {
  MINION = "Minion",
  SPELL = "Spell",
  WEAPON = "Weapon",
  ARTIFACT = "Artifact",
  PILLAR = "Pillar",
  SUMMONING = "Summoning",
  CASTING = "Casting",
  RUNE = "Rune",
  SHIELD = "Shield"
}

export enum CardRarity {
  COMMON = "Common",
  RARE = "Rare",
  EPIC = "Epic",
  LEGENDARY = "Legendary"
}

export interface Card {
  id: string;
  name: string;
  cost: number;
  attack: number | null;
  health: number | null;
  type: CardType;
  rarity: CardRarity;
  ability: string;
  imageUrl: string;
  createdAt: string;
  element?: string;
}

export interface Player {
  id: string;
  username: string;
  level: number;
  xp: number;
  status: 'offline' | 'online' | 'queuing' | 'in-game';
  currentMatchId: string | null;
  rating: number; // MMR rating
  lastSyncAt: string;
}

export interface InventoryItem {
  cardId: string;
  quantity: number;
  acquiredAt: string;
}

export interface Deck {
  id: string;
  playerId: string;
  name: string;
  cardIds: string[];
  isActive: boolean;
  createdAt: string;
}

export interface MatchmakingTicket {
  playerId: string;
  username: string;
  deckId: string;
  rating: number;
  enteredAt: string;
}

export interface Match {
  id: string;
  player1Id: string;
  player1Username: string;
  player2Id: string;
  player2Username: string;
  status: 'waiting' | 'playing' | 'finished';
  winnerId: string | null;
  turn: number;
  updatedAt: string;
  createdAt: string;
  boardState?: {
    player1Health?: number;
    player2Health?: number;
    log?: string[];
  };
}

export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write'
}

export interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
  };
}
