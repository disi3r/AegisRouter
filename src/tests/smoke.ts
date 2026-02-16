// ─────────────────────────────────────────────────────────────
// AEGIS Router — Smoke Test Suite
// Validates analysis, routing, session persistence, and profiles
// ─────────────────────────────────────────────────────────────

import { createAegis } from '../index.js';
import { AegisTier } from '../core/types.js';

const aegis = createAegis();
let passed = 0;
let failed = 0;

function assert(name: string, condition: boolean, message: string) {
    if (condition) {
        console.log(`  ✅ ${name}`);
        passed++;
    } else {
        console.log(`  ❌ ${name}: ${message}`);
        failed++;
    }
}

console.log('\n🛡️ [AEGIS] Advanced Smoke Test Suite\n');

// ── 1. Basic Routing ─────────────────────────────────────────
console.log('── 1. Basic Routing ──');
const res1 = aegis.intercept({ prompt: "Hello!", sessionId: "temp-1" });
assert('Greeting -> EFFICIENT', res1.decision.tier === AegisTier.EFFICIENT, `Got ${res1.decision.tier}`);

const res2 = aegis.intercept({ prompt: "Write a TypeScript function to fetch data from API", sessionId: "temp-2" });
assert('Code -> BALANCED', res2.decision.tier === AegisTier.BALANCED, `Got ${res2.decision.tier}`);

// ── 2. Session Pinning ───────────────────────────────────────
console.log('\n── 2. Session Pinning ──');
const sid = "session-persistent-1";
// Start with a hard task -> REASONING/ADVANCED
const res3 = aegis.intercept({
    prompt: "Prove step by step that P=NP is unlikely.",
    sessionId: sid
});
const initialTier = res3.decision.tier;
assert('Complex Task -> High Tier', initialTier === AegisTier.REASONING || initialTier === AegisTier.ADVANCED, `Got ${initialTier}`);

// Follow up with simple task -> Should stay PINNED (unless it was auto-escalation that forced the first one)
// Note: If the first one was "Auto-escalation", pinning might be ignored if the logic says "auto-escalation overrides".
// But let's see. Our logic: if pinned exists, use it UNLESS new prompt triggers auto-escalation.
// A simple "thanks" should NOT trigger auto-escalation, so it should stay pinned to the high model.
const res4 = aegis.intercept({
    prompt: "Thanks, that was helpful.",
    sessionId: sid
});
assert(
    `Pinning: Simple follow-up stays ${initialTier}`,
    res4.decision.tier === initialTier && res4.decision.model === res3.decision.model,
    `Expected ${initialTier}/${res3.decision.model}, got ${res4.decision.tier}/${res4.decision.model}`
);

// ── 3. Cost Analysis ─────────────────────────────────────────
console.log('\n── 3. Cost Analysis ──');
// EFFICIENT tier should show savings vs BALANCED
const res5 = aegis.intercept({ prompt: "Hi there", sessionId: "cost-test" });
if (res5.decision.costAnalysis) {
    assert(
        'Cost Savings Calculated',
        res5.decision.costAnalysis.estimatedSavings > 0,
        `Expected positive savings, got ${res5.decision.costAnalysis.estimatedSavings}`
    );
} else {
    assert('Cost Analysis Present', false, 'Missing costAnalysis object');
}

console.log(`\n  Results: ${passed} passed, ${failed} failed\n`);

if (failed > 0) {
    process.exit(1);
}
