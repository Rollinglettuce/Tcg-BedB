import { Card, CardType, CardRarity, Player } from './types';

export const INITIAL_CARDS: Omit<Card, 'id' | 'createdAt'>[] = [
  {
    name: "Solar Sentinel",
    cost: 2,
    attack: 2,
    health: 3,
    type: CardType.MINION,
    rarity: CardRarity.COMMON,
    ability: "Battlecry: Give adjacent cyber-allies +1 Shield.",
    imageUrl: "https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=150&auto=format&fit=crop&q=80",
    element: "Fire"
  },
  {
    name: "Aether Flare",
    cost: 3,
    attack: 4,
    health: 1,
    type: CardType.SPELL,
    rarity: CardRarity.RARE,
    ability: "Deal 4 damage to any specific combat target.",
    imageUrl: "https://images.unsplash.com/photo-1541701494587-cb58502866ab?w=150&auto=format&fit=crop&q=80",
    element: "Space"
  },
  {
    name: "Void Reaper",
    cost: 5,
    attack: 5,
    health: 4,
    type: CardType.MINION,
    rarity: CardRarity.EPIC,
    ability: "Reap: Destroy a damaged enemy droid minion.",
    imageUrl: "https://images.unsplash.com/photo-1614741118887-7a4ee193a5fa?w=150&auto=format&fit=crop&q=80",
    element: "Death"
  },
  {
    name: "Pillar of Earth",
    cost: 0,
    attack: null,
    health: null,
    type: CardType.PILLAR,
    rarity: CardRarity.COMMON,
    ability: "Resource: Generates 1 Earth essence per turn. Cannot combat trade.",
    imageUrl: "https://images.unsplash.com/photo-1518005020951-eccb494ad742?w=150&auto=format&fit=crop&q=80",
    element: "Earth"
  },
  {
    name: "Tidal Wave Casting",
    cost: 4,
    attack: null,
    health: null,
    type: CardType.CASTING,
    rarity: CardRarity.RARE,
    ability: "Slows all enemy summonings. Deal 3 damage to all non-Water droids.",
    imageUrl: "https://images.unsplash.com/photo-1505118380757-91f5f5632de0?w=150&auto=format&fit=crop&q=80",
    element: "Water"
  },
  {
    name: "Zephyr Summoning",
    cost: 3,
    attack: 3,
    health: 2,
    type: CardType.SUMMONING,
    rarity: CardRarity.EPIC,
    ability: "Evasive. Moves to safety after delivering damage.",
    imageUrl: "https://images.unsplash.com/photo-1470071459604-3b5ec3a7fe05?w=150&auto=format&fit=crop&q=80",
    element: "Wind"
  },
  {
    name: "Time Ripple Shield",
    cost: 2,
    attack: null,
    health: null,
    type: CardType.SHIELD,
    rarity: CardRarity.LEGENDARY,
    ability: "Absorbs up to 10 incoming elemental damage points. Rewinds card state if broken.",
    imageUrl: "https://images.unsplash.com/photo-1506318137071-a8e063b4bec0?w=150&auto=format&fit=crop&q=80",
    element: "Time"
  },
  {
    name: "Bloom Warden Rune",
    cost: 1,
    attack: 1,
    health: 2,
    type: CardType.RUNE,
    rarity: CardRarity.COMMON,
    ability: "Heals player by 2 points at end of turn.",
    imageUrl: "https://images.unsplash.com/photo-1517411032315-54ef2cb783bb?w=150&auto=format&fit=crop&q=80",
    element: "Life"
  }
];

export const INITIAL_PLAYERS: Omit<Player, 'id' | 'lastSyncAt'>[] = [
  {
    username: "NeoGamer",
    level: 5,
    xp: 320,
    status: "online",
    currentMatchId: null,
    rating: 1200
  },
  {
    username: "VortexQueen",
    level: 14,
    xp: 1450,
    status: "online",
    currentMatchId: null,
    rating: 1750
  },
  {
    username: "PixelPaladin",
    level: 3,
    xp: 110,
    status: "online",
    currentMatchId: null,
    rating: 950
  },
  {
    username: "ShadowDrifter",
    level: 8,
    xp: 850,
    status: "online",
    currentMatchId: null,
    rating: 1400
  }
];
