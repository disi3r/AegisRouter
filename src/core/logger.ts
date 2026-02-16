// ─────────────────────────────────────────────────────────────
// AEGIS Router — Branded Logger
// All output carries the 🛡️ [AEGIS] prefix
// ─────────────────────────────────────────────────────────────

import type { AegisRoutingDecision } from './types.js';

type LogLevel = 'debug' | 'info' | 'warn' | 'error';

const LOG_LEVELS: Record<LogLevel, number> = {
    debug: 0,
    info: 1,
    warn: 2,
    error: 3,
};

const LEVEL_COLORS: Record<LogLevel, string> = {
    debug: '\x1b[90m',  // gray
    info: '\x1b[36m',   // cyan
    warn: '\x1b[33m',   // yellow
    error: '\x1b[31m',  // red
};

const RESET = '\x1b[0m';
const BOLD = '\x1b[1m';
const PREFIX = '🛡️ [AEGIS]';

/**
 * AEGIS Branded Logger
 * 
 * All console output is prefixed with 🛡️ [AEGIS] and includes
 * structured decision logging for routing audit trails.
 */
export class AegisLogger {
    private level: LogLevel;
    private format: 'pretty' | 'json';

    constructor(level: LogLevel = 'info', format: 'pretty' | 'json' = 'pretty') {
        this.level = level;
        this.format = format;
    }

    /** Update the minimum log level */
    setLevel(level: LogLevel): void {
        this.level = level;
    }

    /** Update the log format */
    setFormat(format: 'pretty' | 'json'): void {
        this.format = format;
    }

    /** Check if a given level is enabled */
    isEnabled(level: LogLevel): boolean {
        return LOG_LEVELS[level] >= LOG_LEVELS[this.level];
    }

    /** Debug-level message (gray) */
    debug(message: string, data?: Record<string, unknown>): void {
        this.log('debug', message, data);
    }

    /** Info-level message (cyan) */
    info(message: string, data?: Record<string, unknown>): void {
        this.log('info', message, data);
    }

    /** Warning-level message (yellow) */
    warn(message: string, data?: Record<string, unknown>): void {
        this.log('warn', message, data);
    }

    /** Error-level message (red) */
    error(message: string, data?: Record<string, unknown>): void {
        this.log('error', message, data);
    }

    /**
     * Structured routing decision log.
     * Outputs a formatted block showing the full decision chain.
     */
    decision(decision: AegisRoutingDecision): void {
        if (!this.isEnabled('info')) return;

        if (this.format === 'json') {
            console.log(JSON.stringify({
                level: 'info',
                event: 'routing_decision',
                timestamp: new Date().toISOString(),
                ...decision
            }));
            return;
        }

        const { model, tier, confidence, reason, analysis, costAnalysis, profile } = decision;
        const topDimensions = analysis.dimensions
            .filter(d => d.activation > 0)
            .sort((a, b) => b.contribution - a.contribution)
            .slice(0, 5);

        const lines = [
            `${BOLD}${PREFIX} ── Routing Decision ──${RESET}`,
            `${PREFIX}   Profile:    ${BOLD}${profile}${RESET}`,
            `${PREFIX}   Tier:       ${BOLD}${tier}${RESET}`,
            `${PREFIX}   Model:      ${BOLD}${model}${RESET}`,
            `${PREFIX}   Confidence: ${(confidence * 100).toFixed(1)}%`,
            `${PREFIX}   Reason:     ${reason}`,
            `${PREFIX}   Latency:    ${analysis.latencyMs.toFixed(2)}ms`,
        ];

        if (costAnalysis) {
            const savings = costAnalysis.estimatedSavings;
            const color = savings >= 0 ? '\x1b[32m' : '\x1b[31m'; // Green if saved, red if spent more
            const sign = savings >= 0 ? '+' : '';
            lines.push(`${PREFIX}   Cost Delta: ${color}${sign}$${savings.toFixed(4)}${RESET} (vs ${costAnalysis.defaultModel})`);
        }

        if (analysis.override) {
            lines.push(`${PREFIX}   Override:   ⚡ ${analysis.override}`);
        }

        if (topDimensions.length > 0) {
            lines.push(`${PREFIX}   Top signals:`);
            for (const dim of topDimensions) {
                const bar = '█'.repeat(Math.round(dim.activation * 10));
                const pad = '░'.repeat(10 - Math.round(dim.activation * 10));
                lines.push(
                    `${PREFIX}     ${dim.name.padEnd(22)} ${bar}${pad} ${(dim.activation * 100).toFixed(0)}%`
                );
            }
        }

        lines.push(`${BOLD}${PREFIX} ─────────────────────${RESET}`);
        console.log(lines.join('\n'));
    }

    /**
     * Log the AEGIS startup banner.
     */
    banner(version: string): void {
        if (this.format === 'json') return;

        const lines = [
            '',
            `${BOLD}  🛡️  A E G I S   R O U T E R${RESET}`,
            `  Advanced Engineered Governance & Intelligence System`,
            `  Version ${version} — Neural Routing Engine for OpenClaw`,
            `  ─────────────────────────────────────────────────────`,
            '',
        ];
        console.log(lines.join('\n'));
    }

    /** Internal log dispatcher */
    private log(level: LogLevel, message: string, data?: Record<string, unknown>): void {
        if (!this.isEnabled(level)) return;

        if (this.format === 'json') {
            console.log(JSON.stringify({
                level,
                message,
                timestamp: new Date().toISOString(),
                ...data
            }));
            return;
        }

        const color = LEVEL_COLORS[level];
        const tag = level.toUpperCase().padEnd(5);
        const timestamp = new Date().toISOString().slice(11, 23);

        let output = `${color}${PREFIX} [${tag}] ${timestamp}${RESET} ${message}`;

        if (data && Object.keys(data).length > 0) {
            output += ` ${LEVEL_COLORS.debug}${JSON.stringify(data)}${RESET}`;
        }

        if (level === 'error') {
            console.error(output);
        } else if (level === 'warn') {
            console.warn(output);
        } else {
            console.log(output);
        }
    }
}

/** Singleton logger instance */
export const logger = new AegisLogger('info', 'pretty');
