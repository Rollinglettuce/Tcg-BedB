# ESSENCE TCG backend design data

This branch adds canonical game-design reference data derived from the approved Essence identity and Conjuring stat tables.

## Firestore collections

### `game_design/config`

Stores global prototype anchors:

- 50 Health prototype
- 100 Health release target
- exactly 40 cards per deck
- attacker-only prototype combat
- Basic Pillars as the resource source
- normal Health baseline of roughly 1.5×–1.75× Attack
- tank Health baseline of roughly 1.8×–2.1× Attack
- the six-step balancing procedure

### `essence_identities/{essenceId}`

Stores all eight Essences and their Conjuring identity data:

| Essence | Signature | Top three fits |
|---|---|---|
| Fire | Phoenix | Phoenix, Dragon, Abyssal |
| Water | Hydra | Leviathan, Hydra, Dragon |
| Earth | Behemoth | Behemoth, Effigy, Elephant |
| Wind | Pegasus | Pegasus, Raiju, Griffin |
| Life | Dryad | Dryad, Phoenix, Hydra |
| Death | Abyssal | Abyssal, Corvane, Effigy |
| Time | Sphinx | Sphinx, Phoenix, Celestial |
| Space | Celestial | Celestial, Abyssal, Dragon |

### `conjuring_stat_tiers/{tierId}`

Stores the seven cost tiers from Minor through Ultimate. Each tier includes:

- Essence-cost minimum and maximum
- legal Attack range
- legal Health range
- standard baseline stat line
- average Attack and Health
- same-tier durability guidance
- aggressive, balanced, and defensive profile lines

### `stat_adjustments/{adjustmentId}`

Stores Attack and Health adjustments for:

- strong summon effects
- Swift or repeated attacks
- Guard
- Armor
- Barrier
- healing or regeneration
- high Attack
- drawbacks
- cards with no abilities

## Source files

- `src/data/essenceDesignData.ts` — typed canonical records
- `src/services/essenceDesignSeed.ts` — Firestore batch seeder

## Running the seeder

Import and call the function from a trusted administrator-only action:

```ts
import { seedEssenceDesignData } from './services/essenceDesignSeed';

await seedEssenceDesignData();
```

Do not expose the seed action to ordinary players. Before public deployment, replace the repository's current open Firestore rules with authenticated, role-based rules that restrict changes to design collections to administrators.
