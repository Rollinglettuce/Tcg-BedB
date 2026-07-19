import { doc, writeBatch } from 'firebase/firestore';
import { db } from '../firebase';
import {
  attackAdjustments,
  balancingProcedure,
  conjuringStatTiers,
  essenceIdentities,
  healthAdjustments,
  prototypeBalanceConfig,
} from '../data/essenceDesignData';

/**
 * Writes canonical design-reference data into Firestore.
 *
 * Collections created:
 * - game_design/config
 * - essence_identities/{essenceId}
 * - conjuring_stat_tiers/{tierId}
 * - stat_adjustments/{adjustmentId}
 *
 * This is design/configuration data, not player-owned data.
 */
export async function seedEssenceDesignData(): Promise<void> {
  const batch = writeBatch(db);
  const seededAt = new Date().toISOString();

  batch.set(
    doc(db, 'game_design', 'config'),
    {
      ...prototypeBalanceConfig,
      balancingProcedure: [...balancingProcedure],
      seededAt,
    },
    { merge: true },
  );

  essenceIdentities.forEach((essence) => {
    batch.set(
      doc(db, 'essence_identities', essence.id),
      { ...essence, updatedAt: seededAt },
      { merge: true },
    );
  });

  conjuringStatTiers.forEach((tier) => {
    batch.set(
      doc(db, 'conjuring_stat_tiers', tier.id),
      { ...tier, updatedAt: seededAt },
      { merge: true },
    );
  });

  attackAdjustments.forEach((adjustment) => {
    batch.set(
      doc(db, 'stat_adjustments', `attack_${adjustment.id}`),
      { category: 'attack', ...adjustment, updatedAt: seededAt },
      { merge: true },
    );
  });

  healthAdjustments.forEach((adjustment) => {
    batch.set(
      doc(db, 'stat_adjustments', `health_${adjustment.id}`),
      { category: 'health', ...adjustment, updatedAt: seededAt },
      { merge: true },
    );
  });

  await batch.commit();
}
