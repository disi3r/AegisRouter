// ─────────────────────────────────────────────────────────────
// AEGIS Router — Routing Profiles
// Dynamic threshold adjustment based on active profile
// ─────────────────────────────────────────────────────────────

import { RoutingProfile, AegisTier } from './types.js';
import type { ThresholdConfig, TierModelConfig } from './types.js';

/**
 * Profile-based threshold adjustments.
 * 
 * ECO:
 * - Harder to reach Advanced/Reasoning tiers.
 * - Promotes usage of Efficient/Balanced models.
 * 
 * PERFORMANCE:
 * - Easier to reach Advanced/Reasoning tiers.
 * - Promotes usage of capable models even for mid-complexity tasks.
 */
export class ProfileManager {
    static apply(
        baseThresholds: ThresholdConfig,
        profile: RoutingProfile
    ): ThresholdConfig {
        if (profile === RoutingProfile.BALANCED) {
            return baseThresholds;
        }

        const adjusted = { ...baseThresholds };

        if (profile === RoutingProfile.ECO) {
            // Harder to upgrade
            adjusted.efficient += 0.10; // e.g. 0.30 -> 0.40 (More stuff falls into Efficient)
            adjusted.balanced += 0.10;  // e.g. 0.55 -> 0.65 (More stuff falls into Balanced)
            adjusted.advanced += 0.05;  // e.g. 0.78 -> 0.83 (Harder to reach Reasoning)
        } else if (profile === RoutingProfile.PERFORMANCE) {
            // Easier to upgrade
            adjusted.efficient -= 0.10; // e.g. 0.30 -> 0.20 (Less stuff stays in Efficient)
            adjusted.balanced -= 0.10;  // e.g. 0.55 -> 0.45 (Easier to reach Advanced)
            adjusted.advanced -= 0.05;  // e.g. 0.78 -> 0.73 (Easier to reach Reasoning)
        }

        return adjusted;
    }

    /**
     * Calculate estimated cost savings for a decision.
     * Compares the selected model cost vs the default (Balanced) model cost.
     */
    static analyzeCost(
        tier: AegisTier,
        configTiers: Record<AegisTier, TierModelConfig>
    ): { defaultModel: string; estimatedSavings: number } {
        // We assume BALANCED tier's primary model is the "standard" baseline.
        const defaultTierConfig = configTiers[AegisTier.BALANCED];
        const selectedTierConfig = configTiers[tier];

        const defaultCost = defaultTierConfig.costPerM ?? 0;
        const selectedCost = selectedTierConfig.costPerM ?? 0;

        // Savings = Cost of Default - Cost of Selected
        // If we picked Efficient (cheap) instead of Balanced (mid), savings is positive.
        // If we picked Reasoning (expensive), savings is negative (cost increase).
        const estimatedSavings = defaultCost - selectedCost;

        return {
            defaultModel: defaultTierConfig.primary,
            estimatedSavings,
        };
    }
}
