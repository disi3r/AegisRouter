// ─────────────────────────────────────────────────────────────
// AEGIS Router — Configuration Loader
// Strongly typed config with Zod validation
// ─────────────────────────────────────────────────────────────

import { readFileSync, existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parse as parseYaml } from 'yaml';
import { z } from 'zod';
import { AegisTier, RoutingProfile } from './types.js';
import type { AegisConfig } from './types.js';
import { logger } from './logger.js';

// ── Zod Schemas ──────────────────────────────────────────────

const DimensionSchema = z.object({
    weight: z.number().min(0).max(1),
    keywords: z.array(z.string()).default([]),
    patterns: z.array(z.string()).optional(),
});

const TierModelSchema = z.object({
    primary: z.string(),
    fallback: z.array(z.string()).default([]),
    maxContext: z.number().positive().optional(),
    costPerM: z.number().min(0).optional(),
});

const AegisConfigSchema = z.object({
    version: z.string().default('1.0.0'),
    logLevel: z.enum(['debug', 'info', 'warn', 'error']).default('info'),
    logFormat: z.enum(['pretty', 'json']).default('pretty'),
    calibration: z.object({
        k: z.number().default(8),
        midpoint: z.number().default(0.5),
    }).default({}),
    thresholds: z.object({
        efficient: z.number().default(0.30),
        balanced: z.number().default(0.55),
        advanced: z.number().default(0.78),
        reasoning: z.number().default(0.90),
    }).default({}),
    activeProfile: z.nativeEnum(RoutingProfile).default(RoutingProfile.BALANCED),
    tiers: z.object({
        [AegisTier.EFFICIENT]: TierModelSchema,
        [AegisTier.BALANCED]: TierModelSchema,
        [AegisTier.ADVANCED]: TierModelSchema,
        [AegisTier.REASONING]: TierModelSchema,
    }),
    dimensions: z.record(z.string(), DimensionSchema),
    sessionPinning: z.boolean().default(true),
    autoEscalation: z.boolean().default(true),
    escalationThreshold: z.number().int().min(1).default(2),
});

// ── Default Config Path ──────────────────────────────────────

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const DEFAULT_CONFIG_PATH = resolve(__dirname, '..', '..', 'aegis.config.yaml');

// ── Loader ───────────────────────────────────────────────────

/**
 * Load and validate the AEGIS configuration.
 *
 * Resolution order:
 * 1. Explicit path argument
 * 2. AEGIS_CONFIG_PATH environment variable
 * 3. Default: <project_root>/aegis.config.yaml
 *
 * @param configPath - Optional explicit path to config file
 * @returns Validated AegisConfig object
 * @throws Error if config file is missing or invalid
 */
export function loadConfig(configPath?: string): AegisConfig {
    const resolvedPath = configPath
        ?? process.env['AEGIS_CONFIG_PATH']
        ?? DEFAULT_CONFIG_PATH;

    if (!existsSync(resolvedPath)) {
        throw new Error(
            `🛡️ [AEGIS] Configuration file not found: ${resolvedPath}\n` +
            `  Create an aegis.config.yaml or set AEGIS_CONFIG_PATH env var.`
        );
    }

    logger.debug(`Loading configuration from: ${resolvedPath}`);

    const rawYaml = readFileSync(resolvedPath, 'utf-8');
    const parsed: unknown = parseYaml(rawYaml);

    const result = AegisConfigSchema.safeParse(parsed);

    if (!result.success) {
        const issues = result.error.issues
            .map(i => `  → ${i.path.join('.')}: ${i.message}`)
            .join('\n');
        throw new Error(
            `🛡️ [AEGIS] Invalid configuration:\n${issues}`
        );
    }

    const config = result.data as AegisConfig;

    // Validate dimension weights sum to ~1.0
    const weightSum = Object.values(config.dimensions)
        .reduce((sum, dim) => sum + dim.weight, 0);

    if (Math.abs(weightSum - 1.0) > 0.01) {
        logger.warn(
            `Dimension weights sum to ${weightSum.toFixed(3)} (expected 1.0). ` +
            `Results may be miscalibrated.`
        );
    }

    logger.info(`Configuration loaded successfully`, {
        version: config.version,
        dimensions: Object.keys(config.dimensions).length,
        tiers: Object.keys(config.tiers).length,
    });

    return config;
}
