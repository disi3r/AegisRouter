// ─────────────────────────────────────────────────────────────
// AEGIS Router — Type Definitions
// Advanced Engineered Governance & Intelligence System
// ─────────────────────────────────────────────────────────────

/**
 * The four execution tiers that AEGIS maps prompts to.
 * Each tier corresponds to a class of models optimized for
 * different levels of task complexity.
 */
export enum AegisTier {
    /** Fast, low-cost models for simple queries and heartbeats */
    EFFICIENT = 'EFFICIENT',
    /** Mid-range models for code generation and technical tasks */
    BALANCED = 'BALANCED',
    /** High-capability models for complex analysis */
    ADVANCED = 'ADVANCED',
    /** Maximum intelligence for deep reasoning chains */
    REASONING = 'REASONING',
}

/**
 * Routing Profiles for cost vs performance tuning.
 */
export enum RoutingProfile {
    /** Aggressive cost-saving, higher thresholds for advanced tiers */
    ECO = 'ECO',
    /** Standard balanced behavior (default) */
    BALANCED = 'BALANCED',
    /** Lower thresholds for advanced tiers to maximize intelligence */
    PERFORMANCE = 'PERFORMANCE',
}

/**
 * Individual dimension score from the 15-dimensional analyzer.
 */
export interface DimensionResult {
    /** Name of the dimension */
    name: string;
    /** Raw activation value (0.0 - 1.0) */
    activation: number;
    /** Weight of this dimension in the final score */
    weight: number;
    /** Weighted contribution to the final score */
    contribution: number;
    /** Tokens or patterns that triggered this dimension */
    triggers: string[];
}

/**
 * Complete analysis result from the AEGIS Sensory Cortex.
 */
export interface AegisAnalysis {
    /** Raw weighted sum before sigmoid normalization */
    rawScore: number;
    /** Normalized confidence (0.0 - 1.0) after sigmoid calibration */
    confidence: number;
    /** The determined execution tier */
    tier: AegisTier;
    /** Breakdown of all 15 dimension scores */
    dimensions: DimensionResult[];
    /** Whether a special override rule was applied */
    override: string | null;
    /** Timestamp of the analysis */
    timestamp: number;
    /** Analysis duration in milliseconds */
    latencyMs: number;
}

/**
 * Model configuration for a single tier.
 */
export interface TierModelConfig {
    /** Primary model identifier (e.g., "gemini-3-flash") */
    primary: string;
    /** Ordered fallback chain if primary fails */
    fallback: string[];
    /** Maximum context window size (tokens) */
    maxContext?: number;
    /** Estimated cost per million tokens (input) for auditing */
    costPerM?: number;
}

/**
 * Routing decision output from the AEGIS Dispatcher.
 */
export interface AegisRoutingDecision {
    /** The selected model identifier */
    model: string;
    /** The tier that was selected */
    tier: AegisTier;
    /** Confidence score that led to this decision */
    confidence: number;
    /** Available fallback models in order */
    fallbacks: string[];
    /** Human-readable reason for the routing decision */
    reason: string;
    /** The full analysis that produced this decision */
    analysis: AegisAnalysis;
    /** Cost savings analysis if applicable */
    costAnalysis?: {
        /** The model that WOULD have been picked in default settings */
        defaultModel: string;
        /** Estimated savings in dollars (if positive) or cost increase (if negative) */
        estimatedSavings: number;
    };
    /** Profile active during this decision */
    profile: RoutingProfile;
}

/**
 * Configuration for a single scoring dimension.
 */
export interface DimensionConfig {
    /** Weight of this dimension (all weights should sum to 1.0) */
    weight: number;
    /** Keywords or patterns that activate this dimension */
    keywords: string[];
    /** Regex patterns for complex detection */
    patterns?: string[];
}

/**
 * Sigmoid calibration parameters.
 */
export interface CalibrationConfig {
    /** Steepness of the sigmoid curve */
    k: number;
    /** Score at which confidence = 50% */
    midpoint: number;
}

/**
 * Tier threshold boundaries.
 */
export interface ThresholdConfig {
    /** Below this → EFFICIENT */
    efficient: number;
    /** Below this → BALANCED */
    balanced: number;
    /** Below this → ADVANCED, above → REASONING */
    advanced: number;
    /** Below this → REASONING (for strictness) */
    reasoning?: number;
}

/**
 * Complete AEGIS configuration schema.
 */
export interface AegisConfig {
    /** AEGIS version identifier */
    version: string;
    /** Logging verbosity */
    logLevel: 'debug' | 'info' | 'warn' | 'error';
    /** Output format for logs */
    logFormat: 'pretty' | 'json';
    /** Sigmoid calibration parameters */
    calibration: CalibrationConfig;
    /** Tier confidence thresholds */
    thresholds: ThresholdConfig;
    /** Active routing profile */
    activeProfile: RoutingProfile;
    /** Per-tier model mappings */
    tiers: Record<AegisTier, TierModelConfig>;
    /** 15-dimensional scoring configuration */
    dimensions: Record<string, DimensionConfig>;
    /** Session pinning: keep same model for multi-turn */
    sessionPinning: boolean;
    /** Auto-escalation: 2+ reasoning markers override */
    autoEscalation: boolean;
    /** Number of reasoning markers required for auto-escalation */
    escalationThreshold: number;
}

/**
 * Context passed to the AEGIS middleware from OpenClaw.
 */
export interface AegisContext {
    /** The user's prompt message */
    prompt: string;
    /** Optional system prompt / persona instructions */
    systemPrompt?: string;
    /** Session identifier for multi-turn pinning */
    sessionId?: string;
    /** Agent identifier in a swarm context */
    agentId?: string;
    /** Conversation history length (for context estimation) */
    historyLength?: number;
    /** Optional per-agent model override from swarm config */
    modelOverride?: string;
    /** Additional metadata from the OpenClaw gateway */
    metadata?: Record<string, unknown>;
}

/**
 * Result of the AEGIS middleware intercept.
 */
export interface AegisInterceptResult {
    /** The routing decision made */
    decision: AegisRoutingDecision;
    /** Whether the model was changed from the session default */
    modelChanged: boolean;
    /** Whether session pinning was applied */
    pinned: boolean;
    /** Processing time of the full intercept in ms */
    processingMs: number;
}
