// ─────────────────────────────────────────────────────────────
// AEGIS Router — Main Entry Point
// Advanced Engineered Governance & Intelligence System
// ─────────────────────────────────────────────────────────────

export { AegisTier } from './core/types.js';
export type {
    AegisConfig,
    AegisAnalysis,
    AegisRoutingDecision,
    AegisContext,
    AegisInterceptResult,
    DimensionResult,
    TierModelConfig,
    DimensionConfig,
    CalibrationConfig,
    ThresholdConfig,
} from './core/types.js';

export { AegisAnalyzer } from './core/analyzer.js';
export { AegisRouter } from './core/router.js';
export { AegisInterceptor } from './core/middleware.js';
export { loadConfig } from './core/config.js';
export { AegisLogger, logger } from './core/logger.js';

import { loadConfig } from './core/config.js';
import { AegisInterceptor } from './core/middleware.js';
import { logger } from './core/logger.js';
import type { AegisConfig } from './core/types.js';

/**
 * Create a fully configured AEGIS Interceptor instance.
 *
 * This is the recommended way to instantiate AEGIS for
 * integration with the OpenClaw Gateway.
 *
 * @example
 * ```ts
 * import { createAegis } from '@disier/aegis-router';
 *
 * const aegis = createAegis();
 *
 * // In your OpenClaw middleware hook:
 * const result = aegis.intercept({
 *   prompt: userMessage,
 *   sessionId: session.id,
 *   agentId: agent.id,
 * });
 *
 * // Apply the routing decision
 * session.model = result.decision.model;
 * ```
 *
 * @param configPath - Optional path to aegis.config.yaml
 * @returns Configured AegisInterceptor instance
 */
export function createAegis(configPath?: string): AegisInterceptor {
    const config = loadConfig(configPath);
    logger.setLevel(config.logLevel);
    logger.banner(config.version);
    logger.info('AEGIS Interceptor initialized and ready.');
    return new AegisInterceptor(config);
}

/**
 * Create an AEGIS Interceptor from an in-memory config object.
 * Useful for testing or programmatic configuration.
 *
 * @param config - Complete AegisConfig object
 * @returns Configured AegisInterceptor instance
 */
export function createAegisFromConfig(config: AegisConfig): AegisInterceptor {
    logger.setLevel(config.logLevel);
    logger.banner(config.version);
    logger.info('AEGIS Interceptor initialized from in-memory config.');
    return new AegisInterceptor(config);
}
