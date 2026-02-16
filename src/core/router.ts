import type {
    AegisConfig,
    AegisAnalysis,
    AegisRoutingDecision,
    TierModelConfig,
} from './types.js';
import { AegisTier } from './types.js';
import { logger } from './logger.js';
import { SessionManager } from './session.js';
import { ProfileManager } from './profiles.js';

/**
 * AEGIS Dispatcher
 *
 * Translates analysis results from the Sensory Cortex into
 * concrete model routing decisions. Supports per-agent overrides,
 * session pinning, profile-based tuning, and automatic fallback chains.
 */
export class AegisRouter {
    private readonly config: AegisConfig;
    private readonly sessionManager: SessionManager;

    constructor(config: AegisConfig) {
        this.config = config;
        this.sessionManager = new SessionManager();

        // Initialize logger format from config
        logger.setFormat(config.logFormat);
    }

    /**
     * Route an analysis result to a specific model.
     *
     * @param analysis - The output from the AegisAnalyzer
     * @param sessionId - Optional session ID for pinning
     * @param agentModelOverride - Optional per-agent model lock
     * @returns A complete routing decision
     */
    route(
        analysis: AegisAnalysis,
        sessionId?: string,
        agentModelOverride?: string
    ): AegisRoutingDecision {
        const profile = this.config.activeProfile;

        // ── 1. Agent Override Check ────────────────────────
        if (agentModelOverride) {
            logger.debug(`Agent model override active: ${agentModelOverride}`);
            return {
                model: agentModelOverride,
                tier: analysis.tier,
                confidence: analysis.confidence,
                fallbacks: [],
                reason: `Agent-level model override: ${agentModelOverride}`,
                analysis,
                profile,
            };
        }

        // ── 2. Session Pinning Check ───────────────────────
        if (this.config.sessionPinning && sessionId) {
            const pinned = this.sessionManager.getSession(sessionId);
            if (pinned) {
                // We might want to re-evaluate if the new prompt is RADICALLY different,
                // but for "sticky routing" we generally trust the existing session tier
                // unless it was an override.
                // For now, simple pinning: if you started with a model, stick with it.
                // UNLESS auto-escalation triggers.

                const isAutoEscalation = analysis.override?.includes('Auto-escalation');

                if (!isAutoEscalation) {
                    logger.debug(`Session pinned`, { sessionId, model: pinned.model });
                    return {
                        ...pinned,
                        reason: `Session pinned: ${pinned.model}`,
                        analysis, // Update with latest analysis even if model is pinned
                    };
                } else {
                    logger.info(`Session pinning overridden by Auto-Escalation`, { sessionId });
                }
            }
        }

        // ── 3. Profile-Based Tier Resolution ───────────────
        // Adjust thresholds based on active profile (ECO/PERF/BALANCED)
        // Note: The analyzer gives us a tier based on *static* thresholds.
        // We might want to re-classify here if we want dynamic thresholds 
        // effectively applied at routing time.

        // However, analysis.tier is already computed. 
        // To strictly follow the profile logic, we should probably have passed 
        // the profile to analysis, OR re-evaluate the confidence against adjusted thresholds here.
        // Let's re-evaluate tier based on confidence using adjusted thresholds.

        const adjustedThresholds = ProfileManager.apply(this.config.thresholds, profile);

        let effectiveTier: AegisTier;

        // CRITICAL: If the analysis contains an override (e.g. Auto-Escalation),
        // we must respect the tier explicitly set by the analyzer.
        if (analysis.override) {
            effectiveTier = analysis.tier;
        } else {
            // Otherwise, re-classify based on confidence and profile-adjusted thresholds
            effectiveTier = this.classifyTier(analysis.confidence, adjustedThresholds);
        }

        // ── 4. Model Selection & Cost Analysis ─────────────
        const tierConfig = this.getTierConfig(effectiveTier);
        const reason = this.buildReason(analysis, effectiveTier);

        const costAnalysis = ProfileManager.analyzeCost(effectiveTier, this.config.tiers);

        const decision: AegisRoutingDecision = {
            model: tierConfig.primary,
            tier: effectiveTier,
            confidence: analysis.confidence,
            fallbacks: tierConfig.fallback,
            reason,
            analysis,
            costAnalysis,
            profile,
        };

        // ── 5. Persistence ─────────────────────────────────
        if (this.config.sessionPinning && sessionId) {
            this.sessionManager.setSession(sessionId, decision);
        }

        logger.decision(decision);
        return decision;
    }

    /**
     * Attempt to select a fallback model for a given tier.
     */
    getFallback(tier: AegisTier, failedModels: Set<string>): string | null {
        const tierConfig = this.getTierConfig(tier);
        const allModels = [tierConfig.primary, ...tierConfig.fallback];

        for (const model of allModels) {
            if (!failedModels.has(model)) {
                logger.info(`Fallback selected: ${model} (${failedModels.size} models failed)`);
                return model;
            }
        }

        const downgrade = this.downgradeTier(tier);
        if (downgrade) {
            logger.warn(`All ${tier} models exhausted. Downgrading to ${downgrade}.`);
            return this.getFallback(downgrade, failedModels);
        }

        logger.error('All models exhausted across all tiers. No fallback available.');
        return null;
    }

    private classifyTier(confidence: number, thresholds: typeof this.config.thresholds): AegisTier {
        if (confidence < thresholds.efficient) return AegisTier.EFFICIENT;
        if (confidence < thresholds.balanced) return AegisTier.BALANCED;
        if (confidence < thresholds.advanced) return AegisTier.ADVANCED;
        return AegisTier.REASONING;
    }

    private getTierConfig(tier: AegisTier): TierModelConfig {
        return this.config.tiers[tier];
    }

    private downgradeTier(tier: AegisTier): AegisTier | null {
        const hierarchy: AegisTier[] = [
            AegisTier.REASONING,
            AegisTier.ADVANCED,
            AegisTier.BALANCED,
            AegisTier.EFFICIENT,
        ];

        const currentIndex = hierarchy.indexOf(tier);
        if (currentIndex < hierarchy.length - 1) {
            return hierarchy[currentIndex + 1];
        }
        return null;
    }

    private buildReason(analysis: AegisAnalysis, effectiveTier: AegisTier): string {
        if (analysis.override) {
            return analysis.override;
        }

        const topDims = analysis.dimensions
            .filter(d => d.activation > 0)
            .sort((a, b) => b.contribution - a.contribution)
            .slice(0, 3)
            .map(d => d.name);

        const confPct = (analysis.confidence * 100).toFixed(1);

        if (topDims.length === 0) {
            return `Confidence ${confPct}% — No significant signals detected → ${effectiveTier}`;
        }

        return `Confidence ${confPct}% — Primary signals: ${topDims.join(', ')} → ${effectiveTier}`;
    }
}
