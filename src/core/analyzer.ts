// ─────────────────────────────────────────────────────────────
// AEGIS Router — 15-Dimensional Sensory Cortex
// The neural analysis engine at the heart of AEGIS
// ─────────────────────────────────────────────────────────────

import { AegisTier } from './types.js';
import type {
    AegisConfig,
    AegisAnalysis,
    DimensionResult,
} from './types.js';
import { logger } from './logger.js';

/**
 * AEGIS Analyzer — The Sensory Cortex
 *
 * Performs 15-dimensional prompt analysis to determine
 * the optimal execution tier. Runs entirely locally with
 * sub-millisecond latency and zero external API calls.
 *
 * Architecture:
 * ┌──────────┐    ┌────────────────────┐    ┌──────────┐
 * │  Prompt  │ →  │  15-Dim Analysis   │ →  │  Sigmoid │ →  AegisTier
 * └──────────┘    │  (Weighted Scorer) │    │  Calib.  │
 *                 └────────────────────┘    └──────────┘
 */
export class AegisAnalyzer {
    private readonly config: AegisConfig;
    private readonly dimensionDetectors: Map<string, DimensionDetector>;

    constructor(config: AegisConfig) {
        this.config = config;
        this.dimensionDetectors = this.buildDetectors();
    }

    /**
     * Analyze a prompt across all 15 dimensions.
     *
     * @param prompt - The user's input prompt
     * @param systemPrompt - Optional system/persona instructions
     * @returns Complete AegisAnalysis with tier, confidence, and breakdown
     */
    analyze(prompt: string, systemPrompt?: string): AegisAnalysis {
        const startTime = performance.now();
        const combinedText = systemPrompt
            ? `${systemPrompt}\n\n${prompt}`
            : prompt;
        const lowerText = combinedText.toLowerCase();
        const wordCount = combinedText.split(/\s+/).filter(Boolean).length;

        // ── Phase 1: Dimensional Analysis ─────────────────────
        const dimensions: DimensionResult[] = [];
        let rawScore = 0;
        let reasoningMarkerCount = 0;

        for (const [name, detector] of this.dimensionDetectors) {
            const dimConfig = this.config.dimensions[name];
            if (!dimConfig) continue;

            const result = detector(lowerText, combinedText, wordCount);
            const contribution = result.activation * dimConfig.weight;

            dimensions.push({
                name,
                activation: result.activation,
                weight: dimConfig.weight,
                contribution,
                triggers: result.triggers,
            });

            rawScore += contribution;

            // Track reasoning markers for auto-escalation
            if (name === 'cognitiveLoad') {
                reasoningMarkerCount = result.triggers.length;
            }
        }

        // ── Phase 2: Sigmoid Calibration ──────────────────────
        const { k, midpoint } = this.config.calibration;
        const confidence = sigmoid(rawScore, k, midpoint);

        // ── Phase 3: Tier Classification ──────────────────────
        let tier: AegisTier;
        let override: string | null = null;

        // Check auto-escalation first
        if (
            this.config.autoEscalation &&
            reasoningMarkerCount >= this.config.escalationThreshold
        ) {
            tier = AegisTier.REASONING;
            override = `Auto-escalation: ${reasoningMarkerCount} cognitive load markers detected (threshold: ${this.config.escalationThreshold})`;
        } else {
            tier = this.classifyTier(confidence);
        }

        const latencyMs = performance.now() - startTime;

        const analysis: AegisAnalysis = {
            rawScore,
            confidence,
            tier,
            dimensions,
            override,
            timestamp: Date.now(),
            latencyMs,
        };

        logger.debug(`Analysis complete in ${latencyMs.toFixed(2)}ms`, {
            rawScore: Number(rawScore.toFixed(4)),
            confidence: Number(confidence.toFixed(4)),
            tier,
        });

        return analysis;
    }

    /**
     * Map normalized confidence to execution tier using thresholds.
     */
    private classifyTier(confidence: number): AegisTier {
        const { efficient, balanced, advanced } = this.config.thresholds;

        if (confidence < efficient) return AegisTier.EFFICIENT;
        if (confidence < balanced) return AegisTier.BALANCED;
        if (confidence < advanced) return AegisTier.ADVANCED;
        return AegisTier.REASONING;
    }

    /**
     * Build detector functions for each configured dimension.
     * Each detector returns an activation (0-1) and trigger list.
     */
    private buildDetectors(): Map<string, DimensionDetector> {
        const detectors = new Map<string, DimensionDetector>();

        for (const [name, dimConfig] of Object.entries(this.config.dimensions)) {
            const keywords = dimConfig.keywords.map(k => k.toLowerCase());
            const regexPatterns = (dimConfig.patterns ?? [])
                .map(p => {
                    try {
                        return new RegExp(p, 'gi');
                    } catch {
                        logger.warn(`Invalid regex pattern in dimension "${name}": ${p}`);
                        return null;
                    }
                })
                .filter((r): r is RegExp => r !== null);

            // Special detectors for specific dimensions
            switch (name) {
                case 'contextualDepth':
                    detectors.set(name, createContextualDepthDetector());
                    break;
                case 'interrogativeDepth':
                    detectors.set(name, createInterrogativeDetector(keywords));
                    break;
                case 'multiTurnState':
                    detectors.set(name, createMultiTurnDetector(keywords));
                    break;
                default:
                    detectors.set(name, createKeywordDetector(keywords, regexPatterns));
                    break;
            }
        }

        return detectors;
    }
}

// ── Detector Types ───────────────────────────────────────────

type DimensionDetector = (
    lowerText: string,
    originalText: string,
    wordCount: number
) => { activation: number; triggers: string[] };

// ── Detector Factory Functions ───────────────────────────────

/**
 * Generic keyword + regex pattern detector.
 * Activation scales with the number of matches found.
 */
function createKeywordDetector(
    keywords: string[],
    patterns: RegExp[]
): DimensionDetector {
    return (lowerText: string, originalText: string) => {
        const triggers: string[] = [];

        // Keyword matching
        for (const kw of keywords) {
            if (lowerText.includes(kw)) {
                triggers.push(kw);
            }
        }

        // Regex pattern matching
        for (const pattern of patterns) {
            pattern.lastIndex = 0; // Reset for global regex
            const matches = originalText.match(pattern);
            if (matches) {
                triggers.push(...matches.slice(0, 3)); // Cap at 3 per pattern
            }
        }

        // Activation: saturates at 3 matches → 1.0
        // This ensures even short prompts with 2-3 signals
        // produce meaningful activation values.
        const activation = Math.min(triggers.length / 3, 1.0);
        return { activation, triggers };
    };
}

/**
 * Token/word count detector for contextual depth.
 * Short prompts (<50 words) → low activation.
 * Long prompts (>500 words) → high activation.
 */
function createContextualDepthDetector(): DimensionDetector {
    return (_lowerText: string, _originalText: string, wordCount: number) => {
        const triggers: string[] = [];
        let activation: number;

        if (wordCount < 20) {
            activation = 0.0;
            triggers.push(`very_short:${wordCount}w`);
        } else if (wordCount < 50) {
            activation = 0.15;
            triggers.push(`short:${wordCount}w`);
        } else if (wordCount < 150) {
            activation = 0.35;
            triggers.push(`medium:${wordCount}w`);
        } else if (wordCount < 500) {
            activation = 0.65;
            triggers.push(`long:${wordCount}w`);
        } else {
            activation = 1.0;
            triggers.push(`very_long:${wordCount}w`);
        }

        return { activation, triggers };
    };
}

/**
 * Interrogative depth detector.
 * Counts question marks and question patterns.
 */
function createInterrogativeDetector(keywords: string[]): DimensionDetector {
    return (lowerText: string) => {
        const triggers: string[] = [];

        // Count question marks
        const questionMarks = (lowerText.match(/\?/g) ?? []).length;
        if (questionMarks > 0) {
            triggers.push(`questions:${questionMarks}`);
        }

        // Check for interrogative keywords
        for (const kw of keywords) {
            if (lowerText.includes(kw)) {
                triggers.push(kw);
            }
        }

        // Nested questions (questions within questions)
        const nestedPattern = /\?[^?]*\?/g;
        const nested = lowerText.match(nestedPattern);
        if (nested) {
            triggers.push(`nested_questions:${nested.length}`);
        }

        const activation = Math.min(
            (questionMarks * 0.25 + triggers.length * 0.15),
            1.0
        );
        return { activation, triggers };
    };
}

/**
 * Multi-turn state detector.
 * Detects references to prior context, "as I said", etc.
 */
function createMultiTurnDetector(keywords: string[]): DimensionDetector {
    return (lowerText: string) => {
        const triggers: string[] = [];

        for (const kw of keywords) {
            if (lowerText.includes(kw)) {
                triggers.push(kw);
            }
        }

        // Pronouns suggesting prior context
        const contextPronouns = ['it', 'that', 'those', 'them', 'this one'];
        for (const pronoun of contextPronouns) {
            const pattern = new RegExp(`\\b${pronoun}\\b`, 'i');
            if (pattern.test(lowerText) && lowerText.length < 100) {
                triggers.push(`context_pronoun:${pronoun}`);
            }
        }

        const activation = Math.min(triggers.length / 4, 1.0);
        return { activation, triggers };
    };
}

// ── Math Utilities ───────────────────────────────────────────

/**
 * Sigmoid function for confidence calibration.
 *
 * Maps the raw weighted score to a [0, 1] confidence value.
 * Parameters `k` (steepness) and `midpoint` control the curve shape.
 *
 *   confidence = 1 / (1 + e^(-k * (score - midpoint)))
 */
function sigmoid(score: number, k: number, midpoint: number): number {
    return 1.0 / (1.0 + Math.exp(-k * (score - midpoint)));
}
