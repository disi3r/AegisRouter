---
name: aegis-router
description: "AEGIS — Neural Routing Engine for OpenClaw Agent Swarms. Dynamically routes prompts to optimal model tiers using 15-dimensional analysis."
version: 1.0.0
author: DisierTECH
tags:
  - routing
  - model-selection
  - middleware
  - agent-swarm
  - optimization
requires:
  bins: []
  env: []
---

# 🛡️ AEGIS Router

**Advanced Engineered Governance & Intelligence System**

AEGIS is the neural routing cortex for your OpenClaw Agent Swarm. It analyzes every prompt across **15 cognitive dimensions** in real-time and routes it to the optimal model tier from your local infrastructure — all in under 1ms with zero external API calls.

## Philosophy

> *"The most powerful intelligence isn't the one that knows the most — it's the one that knows which intelligence to summon."*

AEGIS embodies the principle of **intelligent delegation**. In a world where dozens of AI models exist with different strengths, costs, and specializations, blindly routing every request to the most expensive model is wasteful. AEGIS acts as the strategic command layer — a triage system that ensures:

- **Simple greetings** don't waste premium compute
- **Code generation** goes to models optimized for structured output
- **Deep reasoning** tasks activate the most capable minds in your arsenal
- **Cost is optimized** without sacrificing quality

## Execution Tiers

| Tier | Name | Models | Use Case |
|------|------|--------|----------|
| 🟢 T1 | **EFFICIENT** | Gemini 3 Flash | Greetings, quick lookups, heartbeats |
| 🔵 T2 | **BALANCED** | Qwen3 Coder, Llama 4 Scout | Code generation, technical Q&A |
| 🟠 T3 | **ADVANCED** | Claude 4.5 Opus | Complex analysis, architecture design |
| 🔴 T4 | **REASONING** | Kimi K2.5 | Multi-step reasoning, proofs, deep logic |

## Integration

### As OpenClaw Middleware

AEGIS is designed to intercept messages before the agent processes them:

```typescript
import { createAegis } from '@disier/aegis-router';

const aegis = createAegis();

// In your OpenClaw gateway middleware:
function onMessage(context) {
  const result = aegis.intercept({
    prompt: context.message,
    sessionId: context.session.id,
    agentId: context.agent.id,
  });

  // Apply the routing decision
  context.session.model = result.decision.model;
  
  console.log(result.decision.reason);
}
```

### Standalone Usage

```typescript
import { createAegis } from '@disier/aegis-router';

const aegis = createAegis();

// Analyze a prompt
const result = aegis.intercept({
  prompt: "Prove that the halting problem is undecidable using a diagonal argument",
});

// result.decision.tier → REASONING
// result.decision.model → "kimi-k2.5"
// result.decision.confidence → 0.97
```

## Configuration

Edit `aegis.config.yaml` to customize:

- **Model mappings** — Point tiers to your available models
- **Scoring weights** — Tune the 15 dimensions to your workload
- **Thresholds** — Adjust where tier boundaries fall
- **Session pinning** — Enable/disable model consistency per conversation
- **Auto-escalation** — Control reasoning marker escalation

## Swarm Compatibility

AEGIS is designed to work within an OpenClaw Agent Swarm. In a multi-agent setup, each agent can have its own model override in the swarm config. AEGIS will respect agent-level overrides while still performing analysis (for logging and metrics).

Pass `agentId` and optional `modelOverride` in the context:

```typescript
const result = aegis.intercept({
  prompt: userMessage,
  sessionId: session.id,
  agentId: 'code-specialist',
  modelOverride: 'qwen3-coder', // Hard lock for this agent
});
```
