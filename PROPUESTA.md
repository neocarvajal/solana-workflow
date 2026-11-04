````md
# Solana Workflow × ZeroClaw
## Proposal for the ZeroClaw Solana Bounty

> **Tagline**
>
> **A Visual AI Workflow Builder powered by a Self-Hosted Autonomous Runtime for Solana.**

---

# Vision

Current AI agents can answer questions.

They can even generate transactions.

But they usually forget everything after the conversation ends.

They don't continuously monitor blockchain conditions.

They don't execute long-running workflows.

They don't operate autonomously for days or weeks.

This project combines two complementary systems:

- **Solana Workflow** → Visual AI Workflow Builder
- **ZeroClaw** → Autonomous Self-Hosted Runtime

Together they allow users to create persistent Solana automations using natural language or a visual editor while ZeroClaw executes them continuously.

---

# The Idea

Instead of building another chatbot, we build an autonomous workflow platform.

Users describe what they want.

Example:

> Buy 25 USDC worth of SOL every Friday if SOL is below $180.

The system:

1. Understands the request
2. Generates a workflow
3. Validates it
4. Stores it
5. Executes it autonomously
6. Requests approval when needed
7. Reports the result

---

# Architecture

```
                        User
                          │
        ┌─────────────────┴─────────────────┐
        │                                   │
 Natural Language                     Visual Builder
        │                                   │
        └──────────────┬────────────────────┘
                       ▼
             Solana Workflow
          AI Workflow Compiler
                       │
             Workflow JSON
                       │
                       ▼
                ZeroClaw Runtime
      ┌─────────────────────────────────┐
      │                                 │
      │ Cron Scheduler                  │
      │ SOP Engine                      │
      │ Memory                          │
      │ Human Approvals                 │
      │ Multi-channel Communication     │
      └─────────────────────────────────┘
                       │
                       ▼
               Solana Blockchain
```

---

# Separation of Responsibilities

## Solana Workflow

Responsible for reasoning.

- Natural language understanding
- AI workflow generation
- Workflow validation
- Workflow optimization
- Simulation
- Visual editing
- Workflow persistence

It does **NOT** execute workflows.

It compiles them.

Think of it as:

> AI Workflow Compiler

---

## ZeroClaw

Responsible for execution.

- Workflow scheduling
- Cron execution
- Long-running tasks
- Memory
- Human approval checkpoints
- Notifications
- Multi-channel communication
- Polling blockchain state

Think of it as:

> Autonomous Runtime

---

# Example

User writes:

> Every Friday buy 20 USDC of SOL if price is below $180.

↓

Solana Workflow generates:

```json
{
  "trigger": {
    "type": "cron",
    "schedule": "0 10 * * FRI"
  },
  "conditions": [
    {
      "price": {
        "asset": "SOL",
        "lt": 180
      }
    }
  ],
  "steps": [
    {
      "action": "generateBlink"
    },
    {
      "action": "approval"
    },
    {
      "action": "notify"
    }
  ]
}
```

↓

ZeroClaw stores the workflow.

↓

Every Friday:

- checks SOL price
- evaluates conditions
- generates transaction
- waits for approval
- completes execution

---

# Why ZeroClaw?

Instead of relying on cloud cron jobs, ZeroClaw becomes the autonomous execution engine.

Current architecture:

```
Frontend

↓

Supabase Edge Functions

↓

Cron

↓

Workflow Runner

↓

RPC
```

New architecture:

```
Frontend

↓

Solana Workflow

↓

Workflow JSON

↓

ZeroClaw Runtime

↓

Cron

↓

Execution

↓

RPC
```

---

# What Changes?

## Edge Functions Removed

These responsibilities move to ZeroClaw:

- Workflow scheduling
- Cron execution
- Notifications
- Polling
- Retry logic
- Human approval
- Long-running execution

---

## Edge Functions Remaining

Solana Workflow still provides:

- Generate Workflow
- Validate Workflow
- Optimize Workflow
- Simulate Workflow

The AI remains independent from the runtime.

---

# Why This Is Better

The frontend no longer needs to stay online.

The user can close the browser.

The workflow continues running indefinitely.

ZeroClaw owns execution.

Solana Workflow owns intelligence.

---

# Visual Interface

This project is **not** a terminal application.

The UI remains one of its strongest features.

Users interact with a modern visual workflow builder.

```
┌──────────────────────────────┐
│ IF SOL < 180                 │
├──────────────────────────────┤
│        ▼                     │
│ Swap 20 USDC                 │
├──────────────────────────────┤
│        ▼                     │
│ Send Telegram Notification   │
└──────────────────────────────┘
```

ZeroClaw operates behind the scenes.

The runtime becomes invisible infrastructure.

---

# Demo (3 Minutes)

## Part 1

Open Solana Workflow.

Create a workflow visually.

Natural language:

> Buy SOL every Friday if price is below $180.

Workflow generated.

Saved.

---

## Part 2

Open ZeroClaw.

Show:

```
Workflow #21

Loaded

Waiting for Friday...
```

---

## Part 3

Change market conditions.

ZeroClaw:

```
Condition satisfied.

Generating Blink...

Waiting approval...

Transaction completed.
```

Telegram receives:

```
Swap completed successfully.
```

---

# Why This Fits The Bounty

The bounty emphasizes:

- Real use cases
- Self-hosting
- Long-running agents
- Human approvals
- Reproducibility
- Safe execution
- Tier 1 custody

This proposal satisfies all of them.

No private keys.

No autonomous fund movement.

ZeroClaw generates transactions or Blinks.

The user signs.

---

# Custody Tier

Tier 1

No private keys stored.

ZeroClaw:

- creates unsigned transactions
- generates Solana Pay URLs
- generates Blinks
- requests approval

The wallet signs externally.

---

# Future Roadmap

## Phase 1

Visual Workflow Builder

AI Compiler

ZeroClaw Runtime

Cron

Blinks

Notifications

---

## Phase 2

Marketplace of reusable workflows.

---

## Phase 3

Workflow sharing.

---

## Phase 4

On-chain workflow registry.

---

## Phase 5

Autonomous agent collaboration.

---

# Positioning

Instead of saying:

> We built another AI Agent.

We position it as:

> Solana Workflow is the AI Workflow Compiler.

> ZeroClaw is the Autonomous Runtime.

Together they enable persistent, self-hosted, safe automations on Solana.

---

# Six-Day Development Plan

## Day 1

- Install ZeroClaw
- Configure Telegram or WhatsApp
- Connect Solana Workflow API

---

## Day 2

- Implement Generate Workflow API
- Save workflow definitions

---

## Day 3

- Workflow executor
- Cron integration

---

## Day 4

- Solana Pay
- Blink generation
- RPC integration

---

## Day 5

- Human approvals
- Notifications
- Workflow persistence

---

## Day 6

- Record showcase video
- Documentation
- GitHub cleanup
- Deployment
- Submission

---

# Final Pitch

**Solana Workflow** enables anyone to design Solana automations using natural language or a visual interface.

**ZeroClaw** transforms those automations into persistent, self-hosted autonomous workflows that safely execute on Solana without relying on cloud infrastructure.

Instead of building another chatbot, we build a complete automation platform where AI designs workflows and ZeroClaw brings them to life.
````
