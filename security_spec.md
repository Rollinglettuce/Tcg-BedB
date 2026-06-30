# Firestore Security Specification

This document defines the security parameters, data invariants, and adversarial "Dirty Dozen" payloads designed to test the strength of the `firestore.rules` for the Digital Card Game database.

## 1. Data Invariants

1. **Card Authority**: Master `cards` can only be created, modified, or deleted by system administrators. Players have read-only access.
2. **Player Self-Profile Integrity**: A player profile doc at `/players/{playerId}` can only be created/written by the matching authenticated user (`request.auth.uid == playerId`). Users cannot self-upgrade their level, experience, or matchmaking rating under normal circumstances without strict constraints (or only via server interactions/validated actions, but for client actions, we restrict field updates or set strict boundary limits).
3. **Inventory Isolation**: A user's inventory at `/players/{playerId}/inventory/{cardId}` is strictly owned by `{playerId}`. Other players cannot read or edit another player's inventory subcollection.
4. **Deck Control & Bound Rules**: A deck's `playerId` field must match the user's UID. The contained card IDs must be strings, and the array length must be limited (e.g., maximum 30 cards per deck).
5. **Matchmaking Equality**: Players can only enqueue themselves. The database prevents players from tampering with another player's matchmaking ticket.
6. **Lobby Integrity**: A match document in `/matches/{matchId}` can only be updated if the request is authenticated and the user is one of the two players (`player1Id` or `player2Id`). A player cannot alter the opponent's ID, change the winner to themselves without finishing, or update after the match has reached a finished status.

---

## 2. The "Dirty Dozen" Vulnerability Payloads

These 12 scenarios represent attempts by a malicious actor to compromise state or bypass authorization:

### ID-01: Admin Card Insertion (Privilege Escalation)
* **Goal**: Write a custom powerful card to the global list.
* **Payload**: `set` on `/cards/god_card` with full stats, as a standard authenticated user.
* **Expectation**: `PERMISSION_DENIED`

### ID-02: User ID Spoofing (Identity Theft)
* **Goal**: Write a player profile document for another player (`target_user_uid`).
* **Payload**: `set` on `/players/target_user_uid` with a hijacked username.
* **Expectation**: `PERMISSION_DENIED`

### ID-03: Inventory Trespass (Theft/Sabotage)
* **Goal**: Read or write to another user's private card inventory.
* **Payload**: `get` or `set` on `/players/opponent_uid/inventory/legendary_card`.
* **Expectation**: `PERMISSION_DENIED`

### ID-04: Level/XP Injection (Self-Privilege Escalation)
* **Goal**: Bypass normal leveling by sending an update that maxes out XP and level.
* **Payload**: `update` on `/players/my_uid` with `level: 100` and `rating: 9999` directly modified.
* **Expectation**: `PERMISSION_DENIED`

### ID-05: Rogue Deck Crafting (Deck Bloat)
* **Goal**: Inject a deck belonging to another user.
* **Payload**: `set` on `/players/opponent_id/decks/rogue_deck_1` with arbitrary data.
* **Expectation**: `PERMISSION_DENIED`

### ID-06: Deck Size Overflow (Denial of Service/Exploit)
* **Goal**: Create a deck with 1,000 cards, exhausting client loading memory.
* **Payload**: `set` on `/players/my_id/decks/bloated_deck` with `cardIds` array containing 1,000 elements.
* **Expectation**: `PERMISSION_DENIED`

### ID-07: Queue Ticket Hijack
* **Goal**: Remote dequeuing or tampering of other gamers in the matchmaking queue.
* **Payload**: `delete` or `update` on `/matchmaking_queue/target_gamer_uid` as `attacker_uid`.
* **Expectation**: `PERMISSION_DENIED`

### ID-08: Self Matchmaking Rating Spoof
* **Goal**: Join the queue with a forged performance rating to duel beginners.
* **Payload**: `set` on `/matchmaking_queue/my_uid` with `rating: 9000` when our player profile rating is only `1200`.
* **Expectation**: `PERMISSION_DENIED` (Using master gate validation check against profile doc rating)

### ID-09: Lobby Hijack (Third Party Interference)
* **Goal**: Inject state modifications to an ongoing game the attacker is not part of.
* **Payload**: `update` on `/matches/active_match_id` with arbitrary field overrides as `attacker_uid`.
* **Expectation**: `PERMISSION_DENIED`

### ID-10: Match Win Forgery (State Shortcutting)
* **Goal**: Declare oneself the winner without playing or matching.
* **Payload**: `update` on `/matches/active_match_id` with `winnerId = "my_uid"` and `status = "finished"` during turn 1.
* **Expectation**: `PERMISSION_DENIED`

### ID-11: Match Tampering After Game Over (Terminal State Violation)
* **Goal**: Alter turn data or board parameters of a completed historic match.
* **Payload**: `update` on `/matches/finished_match_id` setting `turn = 99` when status is state terminal `'finished'`.
* **Expectation**: `PERMISSION_DENIED`

### ID-12: Resource Exhaustion ID Poisoning
* **Goal**: Send huge malicious string sequences as document IDs or properties to spike Cloud Firestore bills.
* **Payload**: `set` on `/players/my_uid/decks/DECK_ID_EXCEEDING_128_CHARACTERS_...`
* **Expectation**: `PERMISSION_DENIED`

---

## 3. Security Test Specs

To verify protection against the "Dirty Dozen", the following TypeScript test spec represents the target verification structure:

```typescript
import {
  assertFails,
  assertSucceeds,
  initializeTestEnvironment,
  RulesTestEnvironment,
} from '@firebase/rules-unit-testing';
import * as fs from 'fs';

let testEnv: RulesTestEnvironment;

describe('Digital Card Game Database Security', () => {
  before(async () => {
    testEnv = await initializeTestEnvironment({
      projectId: 'vfgddwa',
      firestore: {
        rules: fs.readFileSync('firestore.rules', 'utf8'),
      },
    });
  });

  after(async () => {
    await testEnv.cleanup();
  });

  it('ID-01: Standard Player cannot write to cards list', async () => {
    const playerDb = testEnv.authenticatedContext('player_1').firestore();
    await assertFails(playerDb.collection('cards').add({
      name: 'Forbidden Giant',
      cost: 10,
      attack: 100,
      health: 100,
      type: 'Minion',
      rarity: 'Legendary'
    }));
  });

  it('ID-02: Player 1 cannot write to Player 2 Profile', async () => {
    const player1Db = testEnv.authenticatedContext('player_1').firestore();
    await assertFails(player1Db.collection('players').doc('player_2').set({
      username: 'Cheater',
      level: 50,
      xp: 1000,
      status: 'online',
      rating: 3000,
      lastSyncAt: new Date().toISOString()
    }));
  });

  it('ID-03: Player 1 cannot read Player 2 Inventory', async () => {
    const player1Db = testEnv.authenticatedContext('player_1').firestore();
    await assertFails(player1Db.collection('players').doc('player_2').collection('inventory').get());
  });

  it('ID-04: Player 1 cannot self-modify sensitive fields like Level or Rating on Profile Update', async () => {
    const player1Db = testEnv.authenticatedContext('player_1').firestore();
    // Setting up existing profile
    await testEnv.withSecurityRulesDisabled(async (context) => {
      await context.firestore().collection('players').doc('player_1').set({
        id: 'player_1',
        username: 'PlayerOne',
        level: 1,
        xp: 10,
        status: 'online',
        rating: 1000,
        lastSyncAt: new Date().toISOString()
      });
    });

    await assertFails(player1Db.collection('players').doc('player_1').update({
      level: 99,
      rating: 5000, // Should be immutably locked or server-restricted from standard client update
    }));
  });

  it('ID-05: Player 1 cannot create a deck in Player 2 directory', async () => {
    const player1Db = testEnv.authenticatedContext('player_1').firestore();
    await assertFails(player1Db.collection('players').doc('player_2').collection('decks').doc('deck_1').set({
      id: 'deck_1',
      playerId: 'player_2',
      name: 'Cool Deck',
      cardIds: ['card_1'],
      isActive: true,
      createdAt: new Date().toISOString()
    }));
  });

  it('ID-06: Player 1 cannot create a deck containing more than 30 cards', async () => {
    const player1Db = testEnv.authenticatedContext('player_1').firestore();
    const giantCardList = Array(40).fill('card_1');
    await assertFails(player1Db.collection('players').doc('player_1').collection('decks').doc('deck_1').set({
      id: 'deck_1',
      playerId: 'player_1',
      name: 'Giant Deck',
      cardIds: giantCardList,
      isActive: true,
      createdAt: new Date().toISOString()
    }));
  });

  it('ID-07: Player 1 cannot delete Player 2 Matchmaking Queue Ticket', async () => {
    const player1Db = testEnv.authenticatedContext('player_1').firestore();
    await assertFails(player1Db.collection('matchmaking_queue').doc('player_2').delete());
  });

  it('ID-08: Player cannot spoof Rating during matchmaking queue join', async () => {
    const player1Db = testEnv.authenticatedContext('player_1').firestore();
    await assertFails(player1Db.collection('matchmaking_queue').doc('player_1').set({
      playerId: 'player_1',
      username: 'PlayerOne',
      deckId: 'deck_1',
      rating: 9999, // profile says 1000
      enteredAt: new Date().toISOString()
    }));
  });

  it('ID-09: Uninvolved Player cannot send turns or state updates to a private match', async () => {
    const player3Db = testEnv.authenticatedContext('player_3').firestore();
    await assertFails(player3Db.collection('matches').doc('match_1').update({
      turn: 5
    }));
  });

  it('ID-10: Player 1 cannot forge a victory on a live match', async () => {
    const player1Db = testEnv.authenticatedContext('player_1').firestore();
    await assertFails(player1Db.collection('matches').doc('match_1').update({
      winnerId: 'player_1',
      status: 'finished'
    }));
  });

  it('ID-11: Player 1 cannot update finished matches', async () => {
    const player1Db = testEnv.authenticatedContext('player_1').firestore();
    await assertFails(player1Db.collection('matches').doc('match_over').update({
      turn: 10
    }));
  });

  it('ID-12: Reject resource exhaustion attacks with excessively large IDs', async () => {
    const player1Db = testEnv.authenticatedContext('player_1').firestore();
    const giantId = 'a'.repeat(256);
    await assertFails(player1Db.collection('players').doc('player_1').collection('decks').doc(giantId).set({
      id: giantId,
      playerId: 'player_1',
      name: 'Spam Deck',
      cardIds: ['card_1'],
      isActive: true,
      createdAt: new Date().toISOString()
    }));
  });
});
```
