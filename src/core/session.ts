// ─────────────────────────────────────────────────────────────
// AEGIS Router — Session Manager
// Handles interaction state and model pinning
// ─────────────────────────────────────────────────────────────

import { LRUCache } from 'lru-cache';
import type { AegisRoutingDecision } from './types.js';
import { logger } from './logger.js';

// Cache options: Max 10k sessions, 1 hour TTL standard
const cacheOptions = {
    max: 10000,
    ttl: 1000 * 60 * 60, // 1 hour
    updateAgeOnGet: true,
};

export class SessionManager {
    private cache: LRUCache<string, AegisRoutingDecision>;

    constructor() {
        this.cache = new LRUCache(cacheOptions);
    }

    /**
     * Retrieve the pinned decision for a session.
     */
    getSession(sessionId: string): AegisRoutingDecision | undefined {
        return this.cache.get(sessionId);
    }

    /**
     * Pin a decision to a session.
     */
    setSession(sessionId: string, decision: AegisRoutingDecision): void {
        this.cache.set(sessionId, decision);
        logger.debug(`Session pinned`, { sessionId, model: decision.model });
    }

    /**
     * Clear a session (e.g. on manual reset or end).
     */
    clearSession(sessionId: string): void {
        if (this.cache.has(sessionId)) {
            this.cache.delete(sessionId);
            logger.debug(`Session cleared`, { sessionId });
        }
    }

    /**
     * Get active session count.
     */
    getStats() {
        return {
            activeSessions: this.cache.size,
        };
    }
}
