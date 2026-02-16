// ─────────────────────────────────────────────────────────────
// AEGIS Router — OpenClaw Middleware Interceptor
// Hooks into the Gateway's message processing pipeline
// ─────────────────────────────────────────────────────────────

import type {
    AegisConfig,
    AegisContext,
    AegisInterceptResult,
    AegisRoutingDecision,
} from './types.js';
import { AegisAnalyzer } from './analyzer.js';
import { AegisRouter } from './router.js';
import { logger } from './logger.js';

/**
 * Session state for model pinning in multi-turn conversations.
 */
interface SessionState {
    /** The model pinned for this session */
    model: string;
    /** Tier when the session was pinned */
    tier: string;
    /** Timestamp of when the session was pinned */
    pinnedAt: number;
    /** Number of messages processed in this session */
    messageCount: number;
}

/**
 * AEGIS Interceptor — The Middleware Layer
 *
 * Designed to be invoked before the OpenClaw agent processes
 * any message. It performs real-time analysis, routing, and
 * model selection, then returns the decision for the Gateway
 * to apply.
 *
 * Integration with OpenClaw:
 * ┌───────────┐    ┌────────────┐    ┌─────────────┐    ┌───────────┐
 * │  Gateway  │ →  │  AEGIS     │ →  │  Agent      │ →  │  Model    │
 * │  Message  │    │ Interceptor│    │  Runner     │    │  Provider │
 * └───────────┘    └────────────┘    └─────────────┘    └───────────┘
 *
 * The interceptor does NOT modify the message itself — it only
 * determines which model the Agent Runner should use.
 */
export class AegisInterceptor {
    private readonly analyzer: AegisAnalyzer;
    private readonly router: AegisRouter;
    private readonly config: AegisConfig;
    private readonly sessions: Map<string, SessionState>;

    constructor(config: AegisConfig) {
        this.config = config;
        this.analyzer = new AegisAnalyzer(config);
        this.router = new AegisRouter(config);
        this.sessions = new Map();
    }

    /**
     * Process an incoming message context and determine the optimal model.
     *
     * This is the primary entry point called by the OpenClaw Gateway
     * before the agent processes the message.
     *
     * @param context - The message context from OpenClaw
     * @returns The intercept result with routing decision and metadata
     */
    intercept(context: AegisContext): AegisInterceptResult {
        const startTime = performance.now();
        const { prompt, systemPrompt, sessionId, agentId, modelOverride } = context;

        // ── Phase 1: Check Agent Override ────────────────────
        // In a swarm, if the agent has a hard model override, respect it.
        if (modelOverride) {
            const analysis = this.analyzer.analyze(prompt, systemPrompt);
            const decision = this.router.route(analysis, modelOverride);

            logger.info(`Agent ${agentId ?? 'default'} has model override: ${modelOverride}`);

            return {
                decision,
                modelChanged: false,
                pinned: false,
                processingMs: performance.now() - startTime,
            };
        }

        // ── Phase 2: Check Session Pinning ───────────────────
        if (this.config.sessionPinning && sessionId) {
            const session = this.sessions.get(sessionId);

            if (session) {
                session.messageCount++;

                // Re-analyze periodically to detect conversation shifts
                // (every 5 messages, re-evaluate the tier)
                if (session.messageCount % 5 !== 0) {
                    const analysis = this.analyzer.analyze(prompt, systemPrompt);
                    const pinnedDecision: AegisRoutingDecision = {
                        model: session.model,
                        tier: analysis.tier,
                        confidence: analysis.confidence,
                        fallbacks: [],
                        reason: `Session pinned to ${session.model} (message ${session.messageCount})`,
                        analysis,
                        profile: this.config.activeProfile,
                    };

                    logger.debug(`Session ${sessionId}: pinned to ${session.model} (msg #${session.messageCount})`);

                    return {
                        decision: pinnedDecision,
                        modelChanged: false,
                        pinned: true,
                        processingMs: performance.now() - startTime,
                    };
                }

                logger.debug(`Session ${sessionId}: re-evaluating at message #${session.messageCount}`);
            }
        }

        // ── Phase 3: Full Analysis & Routing ─────────────────
        const analysis = this.analyzer.analyze(prompt, systemPrompt);
        const decision = this.router.route(analysis);

        // ── Phase 4: Update Session State ────────────────────
        let pinned = false;
        if (this.config.sessionPinning && sessionId) {
            const existingSession = this.sessions.get(sessionId);
            const modelChanged = !existingSession || existingSession.model !== decision.model;

            this.sessions.set(sessionId, {
                model: decision.model,
                tier: decision.tier,
                pinnedAt: Date.now(),
                messageCount: existingSession ? existingSession.messageCount : 1,
            });

            pinned = !modelChanged;

            if (modelChanged && existingSession) {
                logger.info(
                    `Session ${sessionId}: model changed ${existingSession.model} → ${decision.model}`
                );
            }
        }

        return {
            decision,
            modelChanged: true,
            pinned,
            processingMs: performance.now() - startTime,
        };
    }

    /**
     * Get the underlying router for advanced usage (e.g., manual fallback).
     */
    getRouter(): AegisRouter {
        return this.router;
    }

    /**
     * Get the underlying analyzer for standalone scoring.
     */
    getAnalyzer(): AegisAnalyzer {
        return this.analyzer;
    }

    /**
     * Clear all session pinning state.
     * Useful when restarting the gateway or resetting state.
     */
    clearSessions(): void {
        const count = this.sessions.size;
        this.sessions.clear();
        logger.info(`Cleared ${count} session(s) from pinning cache.`);
    }

    /**
     * Clear a specific session's pinning state.
     */
    clearSession(sessionId: string): boolean {
        const existed = this.sessions.delete(sessionId);
        if (existed) {
            logger.debug(`Session ${sessionId}: pinning cleared.`);
        }
        return existed;
    }

    /**
     * Get diagnostics about the current interceptor state.
     */
    diagnostics(): Record<string, unknown> {
        return {
            activeSessions: this.sessions.size,
            configVersion: this.config.version,
            sessionPinning: this.config.sessionPinning,
            autoEscalation: this.config.autoEscalation,
            dimensions: Object.keys(this.config.dimensions).length,
            tiers: Object.fromEntries(
                Object.entries(this.config.tiers).map(([tier, cfg]) => [
                    tier,
                    { primary: cfg.primary, fallbacks: cfg.fallback.length },
                ])
            ),
        };
    }
}
