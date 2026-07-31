# AI Agent System Design — AI Social Media OS

**Version:** 1.0.0  
**Last Updated:** 2026-07-22  
**Status:** Draft — Internal Review

---

## Table of Contents

1. [Multi-Agent Architecture Overview](#1-multi-agent-architecture-overview)
2. [Agent Lifecycle](#2-agent-lifecycle)
3. [Agent Communication Protocol](#3-agent-communication-protocol)
4. [Detailed Agent Specifications](#4-detailed-agent-specifications)
5. [LLM Provider Abstraction Layer](#5-llm-provider-abstraction-layer)
6. [Prompt Management System](#6-prompt-management-system)
7. [Agent Memory System](#7-agent-memory-system)
8. [Agent Collaboration Examples](#8-agent-collaboration-examples)
9. [Error Handling & Fallbacks](#9-error-handling--fallbacks)
10. [Monitoring & Observability](#10-monitoring--observability)

---

## 1. Multi-Agent Architecture Overview

### 1.1 Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────────┐
│                      ORCHESTRATOR LAYER                               │
│                                                                       │
│  ┌──────────────────────────────────────────────────────────────┐   │
│  │                  Agent Orchestrator                            │   │
│  │  • Task decomposition    • Agent selection    • Result fusion  │   │
│  │  • Context management    • Error handling     • Retry logic    │   │
│  └──────────────────────────────────────────────────────────────┘   │
│                                                                       │
├─────────────────────────────────────────────────────────────────────┤
│                      AGENT LAYER                                      │
│                                                                       │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐ │
│  │ Content   │ │ SEO      │ │ Trend    │ │Repurpose │ │ Image    │ │
│  │ Agent     │ │ Agent    │ │ Agent    │ │ Agent    │ │ Agent    │ │
│  └──────────┘ └──────────┘ └──────────┘ └──────────┘ └──────────┘ │
│                                                                       │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐ │
│  │Analytics │ │Publishing│ │Engagement│ │  Campaign│ │ Research │ │
│  │ Agent    │ │ Agent    │ │ Agent    │ │  Planner │ │ Agent    │ │
│  └──────────┘ └──────────┘ └──────────┘ └──────────┘ └──────────┘ │
│                                                                       │
│  ┌──────────────────────────────────────────────────────────────┐   │
│  │                  Brand Guardian Agent                           │   │
│  └──────────────────────────────────────────────────────────────┘   │
│                                                                       │
├─────────────────────────────────────────────────────────────────────┤
│                      INFRASTRUCTURE LAYER                             │
│                                                                       │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐               │
│  │ LLM Provider  │  │  Prompt      │  │  Agent       │               │
│  │ Abstraction   │  │  Management  │  │  Memory      │               │
│  │ (OpenAI,      │  │  (Templates, │  │  (Short-term, │               │
│  │  Claude, etc) │  │   Versions)  │  │  Long-term)  │               │
│  └──────────────┘  └──────────────┘  └──────────────┘               │
│                                                                       │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐               │
│  │  MCP Gateway  │  │  Workflow    │  │  Content     │               │
│  │  (tool exec)  │  │  Engine      │  │  Pipeline    │               │
│  └──────────────┘  └──────────────┘  └──────────────┘               │
└─────────────────────────────────────────────────────────────────────┘
```

### 1.2 Core Components

#### Agent Orchestrator

The orchestrator is the brain of the multi-agent system. It:

- Receives high-level tasks from users or workflows
- Decomposes tasks into sub-tasks using an LLM planner
- Assigns sub-tasks to specialized agents
- Manages context across agent calls
- Fuses results from multiple agents into a cohesive output
- Handles failures, retries, and escalation

**Orchestrator Configuration:**

```json
{
  "maxDecompositionDepth": 3,
  "maxParallelAgents": 5,
  "maxAgentCallsPerTask": 20,
  "defaultModel": "claude-sonnet-4",
  "plannerModel": "gpt-4o",
  "contextWindow": 64000,
  "enableVerification": true
}
```

#### Agent Registry

The registry maintains metadata about all available agents:

```json
{
  "content_agent": {
    "name": "Content Agent",
    "version": "2.1.0",
    "capabilities": ["generate", "rewrite", "expand", "summarize", "translate"],
    "llmRequirements": { "minTokens": 8192, "preferredModel": "claude-sonnet-4" },
    "allowedTools": ["mcp:claude", "mcp:openai"],
    "maxConcurrency": 10,
    "timeoutMs": 60000,
    "enabled": true
  },
  "seo_agent": {
    "name": "SEO Agent",
    "version": "1.3.0",
    "capabilities": ["keyword_analysis", "hashtag_optimization", "content_scoring"],
    "llmRequirements": { "minTokens": 4096, "preferredModel": "gpt-4o" },
    "allowedTools": ["mcp:google_analytics"],
    "maxConcurrency": 5,
    "timeoutMs": 30000,
    "enabled": true
  }
}
```

#### Agent Communication Bus

An internal pub/sub message bus (backed by Redis) for agent-to-agent communication:

| Channel Pattern | Description |
|---|---|
| `agent.{name}.task` | Direct task assignment |
| `agent.{name}.result` | Result delivery |
| `agent.broadcast.{event_type}` | Global broadcast |
| `agent.broadcast.content_ready` | Content generation completed |
| `agent.broadcast.trend_detected` | New trend identified |
| `agent.broadcast.analytics_ready` | Analytics report available |

#### Task Queue

BullMQ-backed queues for agent tasks:

| Queue | Priority | Description |
|---|---|---|
| `agent:content:high` | 1 | User-facing content, immediate |
| `agent:content:normal` | 2 | Scheduled content |
| `agent:content:batch` | 3 | Batch processing |
| `agent:analytics` | 2 | Analytics requests |
| `agent:research` | 3 | Background research |

### 1.3 Agent Discovery

Agents announce their capabilities on startup:

```json
{
  "type": "agent.announce",
  "agent": "content_agent",
  "capabilities": ["generate", "rewrite"],
  "status": "ready",
  "load": 0.3,
  "maxLoad": 1.0
}
```

The orchestrator uses this information to select the best agent for each sub-task, considering:

- Capability match
- Current load
- Response time history
- Success rate

---

## 2. Agent Lifecycle

### 2.1 Lifecycle States

```
                    spawn()
                       │
                       ▼
                ┌──────────────┐
                │   CREATED     │
                └──────┬───────┘
                       │ initialize()
                       ▼
                ┌──────────────┐
                │   INITIALIZED │
                └──────┬───────┘
                       │
                  assign_task()
                       │
                       ▼
                ┌──────────────┐
         ┌──────│   WORKING     │───────┐
         │      └──────┬───────┘       │
         │             │               │
    report_status()   complete()     fail()
         │             │               │
         ▼             ▼               ▼
  ┌──────────┐  ┌──────────────┐  ┌──────────┐
  │ REPORTING│  │   COMPLETED   │  │  FAILED   │
  └──────────┘  └──────┬───────┘  └──────────┘
                        │
                   sleep_or_destroy()
                        │
                   ┌────┴────┐
                   ▼         ▼
            ┌──────────┐ ┌──────────┐
            │  SLEEPING │ │ DESTROYED│
            └────┬─────┘ └──────────┘
                 │
            wake()
                 │
                 ▼
           ┌──────────────┐
           │  INITIALIZED  │
           └──────────────┘
```

### 2.2 Lifecycle Steps

#### Spawn

An agent is spawned when:

1. A task cannot be handled by existing agents
2. A new agent version is deployed
3. A manual request is made (e.g., "Create a custom agent")

Spawn involves:

```
1. Load agent definition from registry
2. Load LLM provider configuration
3. Initialize agent memory (short-term + long-term)
4. Establish connection to communication bus
5. Announce readiness to orchestrator
6. Enter INITIALIZED state
```

#### Task Assignment

```
1. Orchestrator sends task via message bus:
   {
     "type": "agent.assign_task",
     "taskId": "task_abc123",
     "agent": "content_agent",
     "input": { ... },
     "context": { ... },
     "deadline": "2026-07-22T12:05:00Z"
   }

2. Agent acknowledges within 5 seconds:
   {
     "type": "agent.task_accepted",
     "taskId": "task_abc123",
     "estimatedDurationMs": 15000
   }

3. Agent transitions to WORKING state
```

#### Reporting

During execution, the agent sends periodic status updates:

```json
{
  "type": "agent.report",
  "taskId": "task_abc123",
  "status": "in_progress",
  "progress": 0.6,
  "message": "Generating tweet variations...",
  "intermediateResult": { "drafts": 3, "tokensUsed": 1200 }
}
```

The orchestrator uses this for:
- Progress display in the dashboard
- Heartbeat detection (timeout if no report for 60s)
- Early error detection

#### Completion

```
1. Agent completes processing
2. Agent sends result:
   {
     "type": "agent.complete",
     "taskId": "task_abc123",
     "result": { ... },
     "metrics": {
       "durationMs": 12450,
       "tokensUsed": 2340,
       "costCredits": 0.12,
       "modelCalls": 3
     }
   }
3. Orchestrator acknowledges
4. Agent transitions to COMPLETED
5. Agent sleeps or waits for next task
```

#### Sleep / Destroy

- **Sleep:** Agent remains in memory but reduces resource consumption. Memory is preserved. Wakes on next task assignment.
- **Destroy:** Agent is terminated. All memory is persisted to long-term storage. State is cleaned up.

Sleep threshold: 5 minutes idle.  
Destroy threshold: 30 minutes idle.

---

## 3. Agent Communication Protocol

### 3.1 Message Types

| Type | Direction | Description |
|---|---|---|
| `agent.announce` | Agent → Bus | Presence and capabilities |
| `agent.assign_task` | Orchestrator → Agent | New task assignment |
| `agent.task_accepted` | Agent → Orchestrator | Confirm task receipt |
| `agent.task_rejected` | Agent → Orchestrator | Cannot accept (overloaded) |
| `agent.report` | Agent → Orchestrator | Progress update |
| `agent.complete` | Agent → Orchestrator | Task finished successfully |
| `agent.fail` | Agent → Orchestrator | Task failed |
| `agent.request` | Agent → Agent | Request collaboration |
| `agent.response` | Agent → Agent | Collaboration response |
| `agent.broadcast` | Any → All | Global event (trend found, etc.) |
| `orchestrator.cancel` | Orchestrator → Agent | Cancel running task |
| `orchestrator.requeue` | Orchestrator → Agent | Retry with modified input |

### 3.2 Direct Agent-to-Agent Communication

When one agent needs data from another, it sends a direct request:

```
Content Agent → SEO Agent:
{
  "type": "agent.request",
  "from": "content_agent",
  "to": "seo_agent",
  "requestId": "req_xyz789",
  "action": "optimize_hashtags",
  "payload": {
    "content": "We're launching AI-powered scheduling...",
    "platform": "instagram",
    "count": 10
  },
  "context": {
    "brandVoiceId": "bv_abc123",
    "workspaceId": "ws_5a7b3c"
  },
  "deadline": "2026-07-22T12:00:30Z"
}

SEO Agent → Content Agent:
{
  "type": "agent.response",
  "from": "seo_agent",
  "to": "content_agent",
  "requestId": "req_xyz789",
  "status": "success",
  "payload": {
    "hashtags": ["#SocialMedia", "#AITools", "#Scheduling"],
    "scores": [85, 92, 78],
    "explanation": "These hashtags have high engagement in the SaaS niche"
  },
  "metrics": {
    "durationMs": 3200,
    "tokensUsed": 500
  }
}
```

### 3.3 Pub/Sub Channels

| Channel | Pattern | Description |
|---|---|---|
| Agent commands | `agent:{name}:cmd` | Orchestrator → Specific agent |
| Agent results | `agent:{name}:result` | Agent → Orchestrator |
| Agent requests | `agent:request:{request_id}` | Agent ↔ Agent direct |
| Broadcast | `broadcast:{event_type}` | Global events |
| Workspace | `workspace:{id}:agents` | Scoped to workspace |

### 3.4 Message Delivery Guarantees

| Guarantee | Mechanism |
|---|---|
| At-least-once delivery | Redis pub/sub with acknowledgment |
| Message ordering | Sequence numbers per sender |
| Duplicate detection | Message ID deduplication (idempotency keys) |
| Dead letter queue | Messages that fail delivery after 3 retries |
| Time-to-live | Messages expire after 5 minutes |

---

## 4. Detailed Agent Specifications

### 4.1 Content Agent

**Purpose:** Generate, rewrite, expand, summarize, and translate social media content.

**Capabilities:**
| Capability | Description |
|---|---|
| `generate` | Create new content from a brief or prompt |
| `rewrite` | Rephrase existing content for clarity or tone |
| `expand` | Elaborate on a short idea into full content |
| `summarize` | Condense long content into shorter format |
| `translate` | Translate content while preserving tone |

**Triggers:**
- User request via AI compose dialog
- Workflow step (`ai_generate`, `ai_improve`)
- Collaborative request from Repurposing Agent or Campaign Planner

**Input Schema:**
```json
{
  "prompt": "Write a LinkedIn post about our new analytics feature",
  "platform": "linkedin",
  "tone": "professional",
  "brandVoiceId": "bv_abc123",
  "maxLength": 3000,
  "variations": 2,
  "includeHashtags": true,
  "referenceUrls": [],
  "referenceContent": "",
  "context": {
    "campaignId": "cmp_abc",
    "recentPosts": [],
    "audienceInsights": {}
  }
}
```

**Output Schema:**
```json
{
  "variations": [
    {
      "text": "We're excited to announce...",
      "hashtags": ["#Analytics", "#SocialMedia"],
      "characterCount": 1250,
      "score": 0.91,
      "moderationFlags": []
    }
  ],
  "metrics": {
    "model": "claude-sonnet-4",
    "promptTokens": 450,
    "completionTokens": 320,
    "costCredits": 0.08,
    "durationMs": 4500
  }
}
```

**LLM Configuration:**
```json
{
  "primaryModel": "claude-sonnet-4",
  "fallbackModel": "gpt-4o",
  "temperatureRange": [0.6, 0.9],
  "maxTokensPerCall": 4096,
  "systemPrompt": "You are a world-class social media content creator...",
  "fewShotExamples": 3
}
```

**Prompt Templates (loaded from Prompt Management System):**
- `content.generate.social_post`
- `content.generate.thread`
- `content.generate.carousel`
- `content.rewrite.for_platform`
- `content.rewrite.tone_adjustment`
- `content.expand.short_to_long`
- `content.summarize.long_to_short`
- `content.translate.preserve_tone`

---

### 4.2 SEO Agent

**Purpose:** Analyze and optimize content for search and discoverability on social platforms.

**Capabilities:**
| Capability | Description |
|---|---|
| `keyword_analysis` | Extract and score keywords from content |
| `hashtag_optimization` | Generate and rank hashtag suggestions |
| `content_scoring` | Score content for SEO and engagement potential |

**Triggers:**
- Content Agent requests hashtag optimization
- User clicks "Optimize SEO" in the editor
- Post is saved (automatic scoring)

**Input:**
```json
{
  "content": "Post content to analyze",
  "platform": "instagram",
  "targetKeywords": ["social media", "ai scheduling"],
  "currentHashtags": ["#social"],
  "maxHashtagCount": 10
}
```

**Output:**
```json
{
  "seoScore": 78,
  "keywordDensity": {
    "social media": { "count": 3, "recommended": "2-4" },
    "ai scheduling": { "count": 1, "recommended": "1-2" }
  },
  "recommendedHashtags": [
    { "hashtag": "#SocialMediaManagement", "score": 92, "volume": "high", "trending": true },
    { "hashtag": "#AIScheduling", "score": 85, "volume": "medium", "trending": true }
  ],
  "suggestions": [
    "Include the keyword 'productivity' in the first sentence",
    "Add location tag for better local discovery"
  ]
}
```

**LLM Config:** `gpt-4o`, temperature 0.3, max tokens 2048

---

### 4.3 Trend Agent

**Purpose:** Monitor trending topics, hashtags, audio tracks, and news across social platforms.

**Capabilities:**
| Capability | Description |
|---|---|
| `monitor_trends` | Watch for trending topics per platform |
| `detect_hashtag_trends` | Identify rising hashtags |
| `detect_audio_trends` | Track trending audio on TikTok/Instagram |
| `monitor_news` | Follow industry news and RSS feeds |

**Triggers:**
- Scheduled (every 15 minutes)
- Webhook from platform trend APIs
- Manual refresh

**Input:**
```json
{
  "platforms": ["twitter", "tiktok", "instagram"],
  "industries": ["technology", "saas", "ai"],
  "location": "global",
  "timeframe": "24h",
  "maxItems": 20
}
```

**Output:**
```json
{
  "trends": [
    {
      "topic": "AI Scheduling Tools",
      "platform": "twitter",
      "volume": 25000,
      "velocity": "rising",
      "sentiment": "positive",
      "relatedHashtags": ["#AITools", "#Productivity"],
      "samplePosts": ["Twitter is buzzing about new AI scheduling..."],
      "relevanceScore": 0.85,
      "recommendedAction": "Create a post highlighting your AI scheduling feature"
    }
  ],
  "audioTrends": [
    { "track": "Song Name", "artist": "Artist", "platform": "tiktok", "videosCount": 150000 }
  ],
  "newsItems": [
    { "title": "AI Social Media Market to Reach $5B", "source": "TechCrunch", "url": "..." }
  ]
}
```

**LLM Config:** `claude-haiku-3.5` (fast, cheap), temperature 0.2, max tokens 4096

**Memory:** Maintains a trend history rolling window (7 days) to detect velocity changes.

---

### 4.4 Repurposing Agent

**Purpose:** Take one piece of content and automatically adapt it for every platform format.

**Capabilities:**
| Capability | Description |
|---|---|
| `blog_to_social` | Blog post → all platform formats |
| `video_to_social` | Video transcript → social posts |
| `podcast_to_social` | Podcast → quote cards, threads |
| `social_to_social` | Cross-platform reformatting |
| `batch_repurpose` | Multiple sources → multiple targets |

**Triggers:**
- Workflow step (`ai_repurpose`)
- Content item saved with type `blog_post`, `video`, `podcast`
- User clicks "Repurpose" on any content

**Input:**
```json
{
  "sourceContent": "# 10 AI Trends in 2026\n\nThe landscape of artificial intelligence...",
  "sourceType": "blog_post",
  "sourceUrl": "https://blog.example.com/ai-trends-2026",
  "sourceMediaIds": ["media_abc", "media_def"],
  "targetPlatforms": [
    { "platform": "twitter", "format": "thread", "count": 5 },
    { "platform": "linkedin", "format": "article", "count": 1 },
    { "platform": "instagram", "format": "carousel", "slides": 5 },
    { "platform": "facebook", "format": "post", "count": 1 },
    { "platform": "tiktok", "format": "script", "duration": 60 }
  ],
  "brandVoiceId": "bv_abc123",
  "includeImages": true
}
```

**Output:**
```json
{
  "results": {
    "twitter": {
      "thread": [
        { "tweet_number": 1, "text": "🧵 10 AI Trends That Will Define 2026...", "hashtags": ["#AI"] },
        { "tweet_number": 2, "text": "1. Agentic AI: Autonomous agents..." },
        { "tweet_number": 3, "text": "2. Multimodal Models: Text + image + video..." }
      ],
      "characterCount": 1400
    },
    "linkedin": {
      "article": "The AI landscape in 2026 is transforming faster than ever...",
      "characterCount": 2800
    },
    "instagram": {
      "carouselSlides": [
        { "slide": 1, "text": "10 AI Trends in 2026", "imagePrompt": "AI technology collage" },
        { "slide": 2, "text": "1. Agentic AI is taking over...", "imagePrompt": "Robot planning" }
      ]
    },
    "tiktok": {
      "script": "Did you know AI is moving faster than ever in 2026?\n\n[Show B-roll of AI interfaces]\n\nHere are 10 trends you need to know...",
      "estimatedDuration": 60
    }
  }
}
```

**LLM Config:** `claude-sonnet-4` (reasoning), `gpt-4o` (speed), temperature 0.7, max tokens 8192

**Prompt Templates:**
- `repurpose.blog_to_twitter_thread`
- `repurpose.blog_to_linkedin_article`
- `repurpose.blog_to_instagram_carousel`
- `repurpose.blog_to_tiktok_script`
- `repurpose.transcript_to_social`

---

### 4.5 Image Agent

**Purpose:** Generate, edit, enhance, and manage images for social media content.

**Capabilities:**
| Capability | Description |
|---|---|
| `generate` | Create images from text prompts |
| `edit` | Modify existing images (inpainting, outpainting) |
| `enhance` | Upscale, denoise, color correct |
| `remove_background` | Remove or replace image backgrounds |
| `generate_variations` | Create multiple versions of an image |

**Triggers:**
- Post creation that includes media
- AI workflow step (`ai_generate_images`)
- User in media library

**Input:**
```json
{
  "action": "generate",
  "prompt": "Modern SaaS dashboard showing social media analytics, blue theme, clean design",
  "style": "photorealistic",
  "size": { "width": 1200, "height": 630 },
  "count": 3,
  "aspectRatio": "16:9",
  "referenceImages": ["media_abc123"],
  "brandColors": ["#2563EB", "#7C3AED"]
}
```

**Output:**
```json
{
  "images": [
    {
      "id": "gen_img_001",
      "url": "https://media.smos.io/gen/abc123.png",
      "thumbnailUrl": "https://media.smos.io/gen/abc123_thumb.png",
      "width": 1200,
      "height": 630,
      "altText": "SaaS analytics dashboard on a laptop",
      "modelUsed": "dall-e-3",
      "revisedPrompt": "A clean modern SaaS dashboard..."
    }
  ]
}
```

**LLM/Model Config:**
```json
{
  "primaryProvider": "openai",
  "primaryModel": "dall-e-3",
  "fallbackProvider": "gemini",
  "fallbackModel": "imagen-3",
  "safetyCheck": true,
  "maxGenerationsPerRequest": 4,
  "supportedSizes": ["1024x1024", "1200x630", "1080x1080", "1080x1920"]
}
```

---

### 4.6 Analytics Agent

**Purpose:** Analyze performance data, generate insights, and make actionable recommendations.

**Capabilities:**
| Capability | Description |
|---|---|
| `analyze_performance` | Deep dive into post and account metrics |
| `explain_insights` | Natural language explanation of data |
| `recommend_actions` | Data-driven recommendations for improvement |
| `generate_report` | Create formatted analytics reports |
| `compare_periods` | Period-over-period performance comparison |

**Triggers:**
- Scheduled weekly/monthly report generation
- User dashboard request ("Explain this data")
- Workflow step (`ai_analyze`)

**Input:**
```json
{
  "workspaceId": "ws_5a7b3c",
  "period": { "start": "2026-06-22", "end": "2026-07-22" },
  "comparisonPeriod": { "start": "2026-05-22", "end": "2026-06-22" },
  "platforms": ["twitter", "linkedin"],
  "analysisType": "deep_dive"
}
```

**Output:**
```json
{
  "summary": "Your engagement rate increased 23% this month, driven primarily by LinkedIn video content. Twitter thread engagement doubled.",
  "highlights": [
    "Best performing post: '10 AI Trends' — 12,500 impressions",
    "Top platform: LinkedIn (4.2% engagement rate)",
    "Best posting time: Tuesday 10:00 AM EST"
  ],
  "recommendations": [
    { "priority": "high", "action": "Post more LinkedIn video content (3x engagement vs text)", "expectedImpact": "+15-20% engagement" },
    { "priority": "medium", "action": "Increase Twitter thread frequency to 3x/week", "expectedImpact": "+10-15% impressions" },
    { "priority": "low", "action": "Test Instagram Reels for brand awareness", "expectedImpact": "+5-8% reach" }
  ],
  "charts": {
    "engagementTrend": { "labels": ["W1", "W2", "W3", "W4"], "values": [3.2, 3.8, 4.1, 3.9] },
    "platformBreakdown": { "twitter": 35, "linkedin": 42, "instagram": 23 }
  }
}
```

**LLM Config:** `claude-sonnet-4`, temperature 0.2, max tokens 4096

**Memory:** Can access historical analytics data via internal API (not via LLM context).

---

### 4.7 Publishing Agent

**Purpose:** Manage the publishing pipeline, queue optimization, approval flows.

**Capabilities:**
| Capability | Description |
|---|---|
| `optimize_schedule` | AI-recommended best posting times |
| `manage_queue` | Order and prioritize the publishing queue |
| `manage_approvals` | Route posts through approval workflows |
| `best_time` | Calculate optimal posting time per account |

**Triggers:**
- Post is scheduled
- Approval workflow step
- User requests best-time analysis

**Input (Schedule Optimization):**
```json
{
  "workspaceId": "ws_5a7b3c",
  "accounts": ["sa_4e5f6g", "sa_7h8i9j"],
  "existingSchedule": [],
  "postCount": 10,
  "dateRange": { "start": "2026-07-23", "end": "2026-07-30" },
  "avoidTimes": ["weekends", "midnight-6am"]
}
```

**Output:**
```json
{
  "schedule": [
    { "time": "2026-07-23T09:00:00Z", "account": "sa_4e5f6g", "platform": "twitter", "score": 92 },
    { "time": "2026-07-23T12:00:00Z", "account": "sa_7h8i9j", "platform": "linkedin", "score": 88 }
  ],
  "analysis": {
    "bestDay": "Tuesday",
    "bestTimeGeneral": "10:00 AM EST",
    "bestTimePerPlatform": {
      "twitter": "9:00 AM EST",
      "linkedin": "12:00 PM EST",
      "instagram": "7:00 PM EST"
    }
  }
}
```

**Note:** This agent is primarily logic-driven (not LLM). It uses historical analytics data and statistical models for optimization. LLM is used only for the natural language explanation of the schedule.

---

### 4.8 Engagement Agent

**Purpose:** Read, analyze sentiment, and draft replies for social media comments and messages.

**Capabilities:**
| Capability | Description |
|---|---|
| `read_comments` | Fetch and categorize incoming comments |
| `analyze_sentiment` | Determine comment sentiment (positive/negative/neutral) |
| `draft_reply` | Generate contextually appropriate draft replies |
| `flag_content` | Flag comments for human review (spam, abuse, crisis) |
| `summarize_feedback` | Aggregate comment themes and topics |

**Triggers:**
- New comment received (webhook/API poll)
- User requests draft reply
- Scheduled sentiment report

**Input:**
```json
{
  "comments": [
    {
      "id": "comment_001",
      "platform": "twitter",
      "text": "This new feature is amazing! Really helps with scheduling.",
      "authorName": "John D.",
      "authorFollowers": 1200,
      "sentimentHint": null
    },
    {
      "id": "comment_002",
      "platform": "twitter",
      "text": "UI is confusing, can't find the scheduling options",
      "authorName": "Sarah M.",
      "authorFollowers": 340,
      "sentimentHint": null
    }
  ],
  "brandVoiceId": "bv_abc123"
}
```

**Output:**
```json
{
  "analyzedComments": [
    {
      "id": "comment_001",
      "sentiment": "positive",
      "confidence": 0.97,
      "priority": "low",
      "draftReply": "Thank you John! We're thrilled you're finding the scheduling helpful 🎉",
      "requiresHumanReview": false
    },
    {
      "id": "comment_002",
      "sentiment": "negative",
      "confidence": 0.89,
      "priority": "high",
      "draftReply": "Hi Sarah, I'm sorry about the confusion! Could you let us know what exact scheduling feature you're looking for? I'll help you find it right away.",
      "requiresHumanReview": true,
      "flagReason": "Product confusion - may need escalation"
    }
  ],
  "summary": {
    "positive": 1,
    "negative": 1,
    "neutral": 0,
    "overallSentiment": "mixed",
    "commonThemes": ["feature feedback", "UI feedback"]
  }
}
```

**LLM Config:** `claude-haiku-3.5` (speed), `gpt-4o-mini` (cost), temperature 0.4, max tokens 1024

**Safety:** All replies are drafts. Auto-posting requires explicit user opt-in. Negative sentiment comments always flagged for review.

---

### 4.9 Campaign Planner

**Purpose:** Design content calendars, generate campaign ideas, and plan multi-channel campaigns.

**Capabilities:**
| Capability | Description |
|---|---|
| `generate_campaign` | Create a full campaign from a brief |
| `plan_calendar` | Generate a content calendar for a period |
| `suggest_themes` | Propose campaign themes and angles |
| `allocate_content` | Distribute content types across the calendar |

**Triggers:**
- User clicks "Generate Campaign"
- Monthly planning workflow
- Content gap detection (AI trigger)

**Input:**
```json
{
  "campaignName": "Q3 Product Launch",
  "product": "AI Scheduling Engine v2",
  "goal": "increase_signups",
  "targetAudience": {
    "industries": ["saas", "technology"],
    "painPoints": ["time-consuming scheduling", "low engagement"],
    "demographics": { "ageRange": "25-45", "roles": ["marketers", "founders"] }
  },
  "platforms": ["twitter", "linkedin", "instagram", "youtube"],
  "duration": { "start": "2026-08-01", "end": "2026-08-31" },
  "contentMix": {
    "educational": 40,
    "promotional": 25,
    "entertaining": 15,
    "social_proof": 20
  },
  "brandVoiceId": "bv_abc123"
}
```

**Output:**
```json
{
  "campaign": {
    "name": "Schedule Smarter: AI Engine v2 Launch",
    "themes": [
      { "week": "Aug 1-7", "theme": "The Problem with Manual Scheduling" },
      { "week": "Aug 8-14", "theme": "Introducing AI Engine v2" },
      { "week": "Aug 15-21", "theme": "Real Results from Early Users" },
      { "week": "Aug 22-31", "theme": "The Future of Social Media Scheduling" }
    ],
    "calendar": [
      {
        "date": "2026-08-01",
        "type": "educational",
        "platform": "twitter",
        "headline": "Did you know marketers spend 6 hrs/week on scheduling?",
        "format": "thread"
      },
      {
        "date": "2026-08-03",
        "type": "educational",
        "platform": "linkedin",
        "headline": "Why Manual Scheduling Is Killing Your Engagement",
        "format": "article"
      }
    ],
    "keyMessages": [
      "AI saves 5+ hours per week on scheduling",
      "Optimal posting times = 40% more engagement",
      "Schedule once, publish everywhere"
    ],
    "hashtagStrategy": {
      "primary": ["#AIScheduling", "#SocialMediaAutomation"],
      "secondary": ["#MarketingTips", "#Productivity"]
    },
    "contentIdeas": [
      {
        "type": "video",
        "platform": "youtube",
        "title": "How AI Scheduling Boosts Engagement by 40%",
        "format": "tutorial"
      }
    ],
    "metrics": {
      "estimatedReach": 250000,
      "estimatedEngagements": 15000,
      "estimatedClicks": 5000
    }
  }
}
```

**LLM Config:** `claude-sonnet-4`, temperature 0.8, max tokens 8192

---

### 4.10 Research Agent

**Purpose:** Conduct competitor analysis, industry research, and content discovery.

**Capabilities:**
| Capability | Description |
|---|---|
| `competitor_analysis` | Analyze competitor social media presence |
| `industry_research` | Gather industry news, stats, and trends |
| `content_discovery` | Find high-performing content in the niche |
| `audience_research` | Analyze audience interests and behavior |

**Triggers:**
- Weekly competitor monitoring schedule
- Campaign Planner requests research
- User requests competitive analysis

**Input:**
```json
{
  "type": "competitor_analysis",
  "competitors": ["Buffer", "Hootsuite", "Later"],
  "platforms": ["twitter", "linkedin", "instagram"],
  "metrics": ["posting_frequency", "engagement_rate", "content_types", "growth_rate"],
  "period": { "start": "2026-06-01", "end": "2026-07-22" }
}
```

**Output:**
```json
{
  "competitors": [
    {
      "name": "Buffer",
      "overallScore": 85,
      "analysis": {
        "postingFrequency": { "twitter": "5x/week", "linkedin": "3x/week" },
        "avgEngagementRate": { "twitter": 2.1, "linkedin": 3.5 },
        "topContentTypes": ["educational threads", "product updates", "customer stories"],
        "growthRate": "+3.2% followers/month",
        "strengths": ["Consistent posting", "Engaging threads"],
        "weaknesses": ["Low video content", "Limited Instagram presence"]
      }
    }
  ],
  "industryInsights": {
    "trendingTopics": ["AI content", "short-form video", "social commerce"],
    "benchmarks": {
      "engagementRateByPlatform": {
        "twitter": { "median": 0.9, "topQuartile": 2.5 },
        "linkedin": { "median": 2.1, "topQuartile": 4.8 }
      }
    },
    "contentGaps": [
      "None of your competitors are doing weekly AI tips threads",
      "No competitor uses interactive polls effectively"
    ]
  },
  "recommendations": [
    "Increase LinkedIn posting to 4x/week (competitors average 3x)",
    "Publish a weekly 'AI Tip Tuesday' thread — market gap identified",
    "Add more customer story content (competitors under-index here)"
  ]
}
```

**LLM Config:** `claude-sonnet-4`, temperature 0.3, max tokens 4096

**Tools:** Web search API, MCP (social platform data), internal analytics.

---

### 4.11 Brand Guardian

**Purpose:** Ensure all content is consistent with brand voice guidelines and free of forbidden content.

**Capabilities:**
| Capability | Description |
|---|---|
| `voice_check` | Verify content matches brand voice profile |
| `forbidden_word_enforcement` | Flag disallowed words and phrases |
| `consistency_score` | Rate how consistent content is with brand |
| `platform_appropriateness` | Check content is right for the target platform |

**Triggers:**
- Every content generation completes (automatic review)
- Post is about to be published
- User requests brand check

**Input:**
```json
{
  "content": "We've got the cheapest social media tool on the market! Buy now!",
  "brandVoiceId": "bv_abc123",
  "platform": "twitter",
  "checkTypes": ["voice", "forbidden_words", "platform_appropriateness"]
}
```

**Output:**
```json
{
  "overallScore": 42,
  "checks": {
    "voice_consistency": {
      "score": 35,
      "issues": [
        { "type": "tone_mismatch", "severity": "high", "message": "Brand voice is 'professional', but content uses 'cheapest' which is casual", "suggestion": "Use 'most cost-effective' instead" },
        { "type": "forbidden_word", "severity": "critical", "message": "'cheapest' is on the forbidden words list", "suggestion": "Remove 'cheapest' from the post" },
        { "type": "call_to_action", "severity": "medium", "message": "'Buy now!' is too aggressive for this brand voice", "suggestion": "Use 'Learn more' or 'Explore' instead" }
      ]
    },
    "platform_appropriateness": {
      "score": 70,
      "issues": []
    }
  },
  "approved": false,
  "modifiedVersion": "Explore our cost-effective social media tool — designed for modern teams."
}
```

**LLM Config:** `claude-haiku-3.5`, temperature 0.1, max tokens 1024

**Special behavior:** The Brand Guardian runs synchronously on every publish action. If `approved` is `false`, the publish is blocked and the user sees the issues. It can also run in "warning" mode where it suggests changes but does not block.

---

## 5. LLM Provider Abstraction Layer

### 5.1 Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    LLM Provider Interface                      │
│  (llm.generate(messages, config) → LLMResponse)               │
│  (llm.stream(messages, config) → AsyncIterator<LLMChunk>)     │
│  (llm.embed(text) → number[])                                 │
│  (llm.moderate(content) → ModerationResult)                  │
└─────────────────────────────────────────────────────────────┘
          ▲               ▲               ▲
          │               │               │
┌─────────┴────┐ ┌────────┴───────┐ ┌────┴────────────┐
│ OpenAI        │ │ Claude          │ │ Gemini          │
│ Provider      │ │ Provider        │ │ Provider         │
├───────────────┤ ├────────────────┤ ├─────────────────┤
│ gpt-4o        │ │ claude-sonnet-4 │ │ gemini-2.0-pro  │
│ gpt-4o-mini   │ │ claude-haiku-4  │ │ gemini-2.0-flash│
│ dall-e-3      │ │ claude-opus-4   │ │ imagen-3        │
│ text-embedding-3│ │               │ │ text-embedding  │
└───────────────┘ └────────────────┘ └─────────────────┘

┌─────────────────────────────────────────────────────────────┐
│                    Fallback Chain                              │
│  primary → fallback → secondary_fallback → fail               │
│  Uses circuit breaker + rate monitor per provider             │
└─────────────────────────────────────────────────────────────┘
```

### 5.2 Provider Interface

```typescript
interface LLMProvider {
  name: string;
  
  generate(
    messages: LLMMessage[],
    config: LLMGenerationConfig
  ): Promise<LLMResponse>;
  
  stream(
    messages: LLMMessage[],
    config: LLMGenerationConfig
  ): AsyncIterable<LLMChunk>;
  
  embed(
    input: string | string[]
  ): Promise<EmbeddingResponse>;
  
  moderate(
    content: string
  ): Promise<ModerationResult>;
}

interface LLMGenerationConfig {
  model: string;
  temperature?: number;       // 0.0 - 2.0
  maxTokens?: number;
  topP?: number;
  frequencyPenalty?: number;
  presencePenalty?: number;
  stop?: string[];
  responseFormat?: 'text' | 'json_object';
  tools?: ToolDefinition[];
  systemPrompt?: string;
  seed?: number;
}

interface LLMResponse {
  id: string;
  model: string;
  content: string;
  finishReason: 'stop' | 'length' | 'tool_calls';
  toolCalls?: ToolCall[];
  usage: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
  latencyMs: number;
  provider: string;
}
```

### 5.3 Provider Configuration

```json
{
  "openai": {
    "apiKey": "${OPENAI_API_KEY}",
    "organizationId": null,
    "defaultModel": "gpt-4o",
    "models": {
      "gpt-4o": { "maxTokens": 128000, "costPerMToken": { "input": 2.50, "output": 10.00 } },
      "gpt-4o-mini": { "maxTokens": 128000, "costPerMToken": { "input": 0.15, "output": 0.60 } },
      "dall-e-3": { "costPerRequest": { "1024x1024": 0.040, "1200x630": 0.080 } },
      "text-embedding-3-small": { "costPerMToken": 0.02 }
    },
    "rateLimits": { "requestsPerMin": 500, "tokensPerMin": 200000 },
    "timeoutMs": 60000
  },
  "claude": {
    "apiKey": "${ANTHROPIC_API_KEY}",
    "defaultModel": "claude-sonnet-4",
    "models": {
      "claude-sonnet-4": { "maxTokens": 200000, "costPerMToken": { "input": 3.00, "output": 15.00 } },
      "claude-haiku-3.5": { "maxTokens": 200000, "costPerMToken": { "input": 0.80, "output": 4.00 } },
      "claude-opus-4": { "maxTokens": 200000, "costPerMToken": { "input": 15.00, "output": 75.00 } }
    },
    "rateLimits": { "requestsPerMin": 200, "tokensPerMin": 80000 },
    "timeoutMs": 120000
  },
  "gemini": {
    "apiKey": "${GOOGLE_AI_API_KEY}",
    "defaultModel": "gemini-2.0-flash",
    "models": {
      "gemini-2.0-pro": { "maxTokens": 1048576, "costPerMToken": { "input": 1.25, "output": 5.00 } },
      "gemini-2.0-flash": { "maxTokens": 1048576, "costPerMToken": { "input": 0.10, "output": 0.40 } },
      "imagen-3": { "costPerRequest": 0.030 }
    },
    "rateLimits": { "requestsPerMin": 360, "tokensPerMin": 120000 },
    "timeoutMs": 60000
  },
  "ollama": {
    "baseUrl": "${OLLAMA_BASE_URL:-http://localhost:11434}",
    "defaultModel": "llama3.1-70b",
    "models": {
      "llama3.1-70b": { "maxTokens": 128000 },
      "llama3.1-8b": { "maxTokens": 128000 },
      "mistral-large": { "maxTokens": 128000 }
    },
    "rateLimits": null,
    "timeoutMs": 300000
  }
}
```

### 5.4 Fallback Chain

Each agent has a fallback chain defined in its configuration:

```json
{
  "fallbackStrategy": {
    "enabled": true,
    "providers": ["claude", "openai", "gemini"],
    "models": ["claude-sonnet-4", "gpt-4o", "gemini-2.0-pro"],
    "fallbackCondition": [
      "provider_error",
      "rate_limit",
      "timeout",
      "content_moderated"
    ],
    "maxRetries": 3,
    "circuitBreakerThreshold": 5,
    "circuitBreakerResetMs": 60000
  }
}
```

When a provider fails:
1. Record the failure in the circuit breaker.
2. If circuit is closed, retry once with same provider.
3. If circuit is open or retry failed, move to next provider in chain.
4. Log the fallback with reason and duration.
5. If all providers fail, propagate error to orchestrator.

### 5.5 Cost Tracking

Every LLM call is tracked:

```json
{
  "id": "llm_call_abc123",
  "agent": "content_agent",
  "taskId": "task_def456",
  "provider": "claude",
  "model": "claude-sonnet-4",
  "promptTokens": 450,
  "completionTokens": 320,
  "costCredits": 0.087,
  "latencyMs": 3450,
  "status": "success",
  "timestamp": "2026-07-22T12:00:00Z"
}
```

Costs are credited against the workspace's AI credit budget:

| Plan | Monthly AI Credits | Overage Cost |
|---|---|---|
| Free | 500 | N/A (hard limit) |
| Pro | 5,000 | $0.01/credit |
| Business | 50,000 | $0.008/credit |
| Enterprise | Custom | Custom |

---

## 6. Prompt Management System

### 6.1 Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                  Prompt Management System                      │
│                                                               │
│  ┌──────────────────────────────────────────────────────┐    │
│  │                   Prompt Registry                      │    │
│  │  (PostgreSQL: prompt id, version, content, metadata)   │    │
│  └──────────────────────────────────────────────────────┘    │
│                                                               │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐          │
│  │ Template     │  │ Version      │  │ A/B Test     │          │
│  │ Engine       │  │ Manager      │  │ Engine       │          │
│  │ (Handlebars) │  │ (git-like)   │  │ (split test) │          │
│  └─────────────┘  └─────────────┘  └─────────────┘          │
│                                                               │
│  ┌──────────────────────────────────────────────────────┐    │
│  │              Prompt Variables & Context               │    │
│  │     { brandVoice, platform, content, user, tone }    │    │
│  └──────────────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────────┘
```

### 6.2 Prompt Template Format

Templates use Handlebars-style variable interpolation:

```handlebars
{{! content.generate.social_post v3 }}
You are a {{tone}} social media content creator for {{brandName}}.

Brand Voice Guidelines:
- Tone: {{brandVoice.tone}}
- Vocabulary: {{join brandVoice.vocabulary ", "}}
- Forbidden words: {{join brandVoice.forbiddenWords ", "}}
- Style: {{brandVoice.style}}
- Emoji usage: {{brandVoice.emojiUsage}}

Platform: {{platform}}
Post Length: {{maxLength}} characters

Context:
{{#if referenceContent}}
Reference content to draw from:
{{referenceContent}}
{{/if}}

{{#if recentPosts}}
Recent posts (avoid repeating):
{{#each recentPosts}}
- "{{this.text}}" ({{this.platform}}, {{this.date}})
{{/each}}
{{/if}}

Now, create {{variations}} variation(s) of a social media post for the following:

Prompt: {{prompt}}

Requirements:
- Follow the brand voice guidelines strictly
- Platform-appropriate formatting for {{platform}}
{{#if includeHashtags}}
- Include relevant hashtags (max 3 for Twitter, max 10 for Instagram)
{{/if}}
- Each variation should be distinctly different in approach

Output format: Return a JSON array of variations, each with "text", "hashtags" (array), and "characterCount".
```

### 6.3 Prompt Registry Schema

```sql
CREATE TABLE prompts (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  key           VARCHAR(255) NOT NULL UNIQUE, -- e.g., "content.generate.social_post"
  name          VARCHAR(255) NOT NULL,
  description   TEXT,
  category      VARCHAR(100) NOT NULL, -- "content", "repurpose", "seo", "engagement", etc.
  current_version INTEGER NOT NULL DEFAULT 1,
  created_at    TIMESTAMPTZ DEFAULT NOW(),
  updated_at    TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE prompt_versions (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  prompt_id     UUID NOT NULL REFERENCES prompts(id) ON DELETE CASCADE,
  version       INTEGER NOT NULL,
  template      TEXT NOT NULL,
  variables     JSONB NOT NULL DEFAULT '[]', -- [{ name, type, description, required }]
  commit_message TEXT,
  author_id     UUID REFERENCES users(id),
  is_active     BOOLEAN DEFAULT false,
  created_at    TIMESTAMPTZ DEFAULT NOW(),
  
  UNIQUE(prompt_id, version)
);

CREATE TABLE prompt_ab_tests (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  prompt_key    VARCHAR(255) NOT NULL,
  variant_a     INTEGER NOT NULL REFERENCES prompt_versions(id),
  variant_b     INTEGER NOT NULL REFERENCES prompt_versions(id),
  traffic_split DECIMAL(5,2) DEFAULT 50.00, -- percentage to variant A
  status        VARCHAR(50) DEFAULT 'running', -- running, paused, completed
  winner        INTEGER REFERENCES prompt_versions(id),
  metrics       JSONB DEFAULT '{}',
  started_at    TIMESTAMPTZ DEFAULT NOW(),
  ended_at      TIMESTAMPTZ
);
```

### 6.4 A/B Testing

When an A/B test is running for a prompt:

1. 50% of calls use variant A, 50% use variant B.
2. For each call, track: task completion, user rating (thumbs up/down), engagement metrics on resulting content.
3. After statistical significance is reached (min 100 samples per variant), the system declares a winner.
4. The winning version becomes the active prompt.

**A/B Test Metrics:**
```json
{
  "totalCalls": 200,
  "variantA": {
    "calls": 103,
    "avgRating": 4.2,
    "avgEngagement": 3.8,
    "successRate": 0.97
  },
  "variantB": {
    "calls": 97,
    "avgRating": 3.9,
    "avgEngagement": 3.5,
    "successRate": 0.94
  },
  "confidence": 0.95,
  "winner": "variant_a"
}
```

### 6.5 Prompt Variables

Variables available to all prompt templates:

| Variable | Source | Description |
|---|---|---|
| `brandName` | Workspace settings | Company/brand name |
| `brandVoice` | Brand voice profile | Full voice configuration |
| `platform` | Task input | Target platform |
| `tone` | Task input | Desired tone |
| `maxLength` | Task input | Character limit |
| `prompt` | Task input | User's content brief |
| `referenceContent` | Task input | Source content to work from |
| `recentPosts` | Agent memory | Last 10 posts (avoid repetition) |
| `workspaceId` | Context | Current workspace |
| `campaignId` | Context | Current campaign (if any) |
| `audienceInsights` | Analytics agent | Audience data (if available) |
| `trends` | Trend agent | Current trends (if available) |

---

## 7. Agent Memory System

### 7.1 Memory Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                     Agent Memory System                        │
│                                                               │
│  ┌──────────────────────────────────────────────────────┐    │
│  │              Memory Router                              │    │
│  │  Routes data to appropriate store based on type + TTL  │    │
│  └────┬─────────────────┬─────────────────┬──────────────┘    │
│       │                 │                 │                    │
│       ▼                 ▼                 ▼                    │
│  ┌──────────┐    ┌──────────┐    ┌──────────────┐            │
│  │ Short-term │    │  Long-term │    │  Episodic    │            │
│  │ (Redis)    │    │ (Vector DB) │    │ (PostgreSQL) │            │
│  │ TTL: 24h   │    │ TTL: 90d   │    │ TTL: Forever  │            │
│  └──────────┘    └──────────┘    └──────────────┘            │
│                                                               │
│  ┌──────────────────────────────────────────────────────┐    │
│  │              Embedding Service                          │    │
│  │  (text-embedding-3-small for semantic search)          │    │
│  └──────────────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────────┘
```

### 7.2 Short-Term Memory (STM)

Used for current conversation context and session state.

**Storage:** Redis (hash + TTL)

**Data types:**
| Key Pattern | Example | TTL | Description |
|---|---|---|---|
| `agent:{id}:conversation:{taskId}` | `agent:content_001:conversation:task_abc` | 24h | Message history |
| `agent:{id}:context:{taskId}` | `agent:content_001:context:task_abc` | 24h | Current task context |
| `agent:{id}:state` | `agent:content_001:state` | 1h | Agent status and load |

**Conversation Window:**
```json
{
  "taskId": "task_abc123",
  "messages": [
    { "role": "system", "content": "You are a content creator...", "tokens": 450 },
    { "role": "user", "content": "Write a tweet about...", "tokens": 120 },
    { "role": "assistant", "content": "Here's your tweet...", "tokens": 80 },
    { "role": "user", "content": "Make it shorter", "tokens": 15 },
    { "role": "assistant", "content": "Shorter version...", "tokens": 60 }
  ],
  "totalTokens": 725,
  "maxTokens": 16000
}
```

When the window exceeds `maxTokens`, older messages are summarized and stored as a compressed context entry.

### 7.3 Long-Term Memory (LTM)

Used for persistent knowledge that spans sessions and agents.

**Storage:** pgvector (PostgreSQL extension) or Pinecone

**Data indexed:**
- Previous content generations
- Brand voice profiles
- Campaign strategies
- User preferences
- Learned patterns (e.g., "user prefers short tweets")

**Schema:**
```sql
CREATE TABLE agent_memory_vectors (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id  UUID NOT NULL REFERENCES workspaces(id),
  agent_id      VARCHAR(255) NOT NULL, -- which agent stored this
  memory_type   VARCHAR(100) NOT NULL, -- 'content', 'preference', 'fact', 'pattern'
  content       TEXT NOT NULL,
  embedding     vector(1536), -- OpenAI embedding dimension
  metadata      JSONB DEFAULT '{}',
  score         REAL, -- importance score (0-1), used for pruning
  created_at    TIMESTAMPTZ DEFAULT NOW(),
  expires_at    TIMESTAMPTZ -- NULL = never expires
);

CREATE INDEX idx_agent_memory_workspace ON agent_memory_vectors(workspace_id);
CREATE INDEX idx_agent_memory_type ON agent_memory_vectors(memory_type);
CREATE INDEX idx_agent_memory_embedding ON agent_memory_vectors
  USING ivfflat (embedding vector_cosine_ops) WITH (lists = 100);
```

**Memory Retrieval:**

```typescript
async function retrieveRelevantMemory(
  workspaceId: string,
  agentId: string,
  query: string,
  limit: number = 5
): Promise<MemoryItem[]> {
  const embedding = await llm.embed(query);
  
  return prisma.$queryRaw`
    SELECT content, metadata, score,
           1 - (embedding <=> ${embedding}::vector) AS similarity
    FROM agent_memory_vectors
    WHERE workspace_id = ${workspaceId}
      AND agent_id = ${agentId}
      AND (expires_at IS NULL OR expires_at > NOW())
    ORDER BY similarity DESC
    LIMIT ${limit}
  `;
}
```

### 7.4 Episodic Memory

Used for logging and recalling what happened in previous sessions.

**Storage:** PostgreSQL (structured log)

Each episode records:
```json
{
  "id": "episode_abc123",
  "sessionId": "session_xyz789",
  "agentId": "content_agent",
  "taskId": "task_def456",
  "action": "generate_social_post",
  "input": { "prompt": "...", "platform": "twitter" },
  "output": { "text": "...", "hashtags": [...] },
  "modelUsed": "claude-sonnet-4",
  "tokensUsed": 780,
  "durationMs": 4500,
  "success": true,
  "userFeedback": "thumbs_up",
  "timestamp": "2026-07-22T12:00:00Z"
}
```

This powers:
- Debugging and auditing (exact trace of what happened)
- Learning (which approaches work best for which inputs)
- Cost analysis (per-agent, per-task, per-user spend)

---

## 8. Agent Collaboration Examples

### 8.1 Example 1: Trend-Driven Content Pipeline

**Trigger:** Trend Agent detects a rising topic.

```
Trend Agent (background):
  → Monitors Twitter, TikTok, Reddit for rising topics
  → Detects: "#RemoteWork tips" trending at +340% in the SaaS niche
  → Creates a trend detection event:
    {
      type: "broadcast",
      event: "trend_detected",
      data: {
        topic: "Remote Work Productivity",
        platform: "twitter",
        volume: 45000,
        velocity: "rapidly_rising",
        relevanceScore: 0.88,
        timeframe: "next 24-48 hours"
      }
    }

Agent Orchestrator:
  → Receives broadcast
  → Evaluates relevance: score 0.88 > threshold 0.75 → proceed
  → Creates task: "Capitalize on Remote Work trend"
  → Breaks down:
    1. Research: Get top-performing content on this trend
    2. Content: Generate 5 posts around "Remote Work Productivity"
    3. SEO: Optimize hashtags for maximum reach
    4. Image: Generate on-brand visuals
    5. Publish: Draft posts with optimal timing

Research Agent:
  → Receives: "Find top remote work content from competitors"
  → Searches: competitor feeds, news, industry blogs
  → Returns: {
      trends: ["AI tools for remote work", "async communication"],
      topContent: ["How Loom replaced meetings", "Notion's remote playbook"],
      angles: ["productivity hacks", "work-life balance", "tools roundup"]
    }

Content Agent:
  → Receives: "Generate 5 Twitter posts about Remote Work Productivity"
  → Generates 5 variations with tone matching brand voice
  → Returns: [{ text: "Your remote team is only as productive..." }, ...]

SEO Agent:
  → Receives content from Content Agent
  → Adds optimized hashtags for each post
  → Returns: [{ text: "...", hashtags: ["#RemoteWork", "#Productivity", "#WFHtips"] }]

Image Agent:
  → Receives: "Generate header image for remote work post series"
  → Generates branded image matching campaign style

Publishing Agent:
  → Receives: 5 posts with content, images, hashtags
  → Calculates optimal posting times based on historical data
  → Schedules: Post 1 (today 10am), Post 2 (today 3pm), Post 3 (tomorrow 10am)...
  → Returns: schedule confirmation

Orchestrator:
  → Tracks execution
  → Reports to user:
    "🚀 Trend captured: 'Remote Work' trending +340%
     ✅ 5 posts drafted and scheduled
     📅 First post goes live today at 10:00 AM
     📈 Estimated additional reach: 50,000-75,000 impressions"
```

**Result:** From trend detection to scheduled posts in < 2 minutes, all autonomous.

---

### 8.2 Example 2: Research-Driven Campaign Launch

**Trigger:** User clicks "Generate Campaign" for Q4 product launch.

```
User:
  → Inputs: "Build a campaign for our new analytics dashboard launch"
  → Product details: real-time analytics, AI insights, custom reports
  → Target: B2B SaaS marketers, US/UK, Nov-Dec 2026

Campaign Planner:
  → Receives brief
  → Requests research from Research Agent

Research Agent:
  → Competitor analysis: Buffer, Hootsuite, Sprout Social
  → Industry research: B2B SaaS social media trends
  → Returns: {
      competitorGaps: ["No one emphasizes real-time collaboration"],
      audienceInsights: ["Marketers want data-driven content strategies"],
      contentGaps: ["Interactive analytics demo content is missing from market"]
    }

Campaign Planner (continued):
  → Combines user brief + research
  → Designs 4-week campaign:
    Week 1: "Why Real-Time Analytics Matter" (educational)
    Week 2: "Introducing Analytics Dashboard 2.0" (product launch)
    Week 3: "Customer Success Stories" (social proof)
    Week 4: "The Future of Social Analytics" (thought leadership)
  → Generates content calendar: 24 posts across 4 platforms
  → Returns: full campaign plan

Content Agent:
  → Receives Week 1 content assignments
  → Generates 6 posts: 2 Twitter threads, 2 LinkedIn articles, 1 Instagram carousel, 1 YouTube script
  → Each post follows brand voice, platform-specific formatting

Image Agent:
  → Generates images for each post: dashboard screenshots, infographics, quote cards

Brand Guardian:
  → Reviews all 6 pieces of content
  → Flags 1 post for tone inconsistency, suggests revision
  → Content Agent revises based on feedback
  → Brand Guardian approves all content

SEO Agent:
  → Adds optimized hashtags and keywords

Publishing Agent:
  → Schedules posts across the 4 weeks
  → Optimizes times per platform

Orchestrator:
  → Final report:
    "📊 Q4 Campaign: 'Analytics Dashboard 2.0 Launch'
     ✅ 24 posts created across 4 platforms
     ✅ All images generated and optimized
     ✅ Brand voice verified across all content
     ✅ Content calendar set: Nov 1 - Nov 28
     📅 First post: Nov 1 at 9:00 AM EST
     💰 AI credits used: 234 / 10,000"
```

---

## 9. Error Handling & Fallbacks

### 9.1 Error Classification

```typescript
enum AgentErrorType {
  // LLM Provider Errors
  PROVIDER_ERROR = 'provider_error',           // 5xx from provider
  PROVIDER_RATE_LIMIT = 'provider_rate_limit', // 429 from provider
  PROVIDER_TIMEOUT = 'provider_timeout',        // Request timeout
  CONTENT_MODERATED = 'content_moderated',      // Safety filter triggered
  CONTEXT_WINDOW_EXCEEDED = 'context_window_exceeded',
  
  // Agent Logic Errors
  AGENT_TIMEOUT = 'agent_timeout',              // Agent took too long
  AGENT_OVERLOADED = 'agent_overloaded',        // Too many concurrent tasks
  AGENT_INVALID_OUTPUT = 'agent_invalid_output', // Output failed schema validation
  AGENT_SELF_CORRECTION_FAILED = 'self_correction_failed',
  
  // Integration Errors
  MCP_SERVER_ERROR = 'mcp_server_error',
  MCP_SERVER_TIMEOUT = 'mcp_server_timeout',
  MCP_TOOL_NOT_FOUND = 'mcp_tool_not_found',
  INTERNAL_API_ERROR = 'internal_api_error',
  
  // Task Errors
  TASK_CANCELLED = 'task_cancelled',
  TASK_EXPIRED = 'task_expired',
  INVALID_INPUT = 'invalid_input'
}
```

### 9.2 Error Handling Strategy

| Error Type | Action | Retry? | User Facing? |
|---|---|---|---|
| `PROVIDER_ERROR` | Fallback to next provider in chain | Yes (3x) | Eventually |
| `PROVIDER_RATE_LIMIT` | Wait + retry with backoff | Yes (5x) | No |
| `PROVIDER_TIMEOUT` | Fallback to faster model | Yes (2x) | No |
| `CONTENT_MODERATED` | Return error with flag details | No | Yes |
| `AGENT_TIMEOUT` | Kill agent, respawn, retry | Yes (2x) | If all fail |
| `AGENT_INVALID_OUTPUT` | Re-prompt with stricter instructions | Yes (2x) | No |
| `MCP_SERVER_ERROR` | Circuit breaker, notify admin | Yes (3x) | Eventually |
| `TASK_CANCELLED` | Cleanup and stop | No | No |
| `INVALID_INPUT` | Return validation error | No | Yes |

### 9.3 Self-Correction Loop

When an agent produces invalid output (fails schema validation):

```
1. Agent receives validation error:
   {
     "code": "AGENT_INVALID_OUTPUT",
     "message": "Output missing required field 'hashtags'",
     "details": { "schemaViolations": ["$.hashtags: field required"] }
   }

2. Agent modifies the system prompt:
   "Previous output was invalid. The field 'hashtags' is required.
    Please ensure your response includes a 'hashtags' array."

3. Agent re-invokes LLM with corrected prompt + original context.

4a. If successful → continue with corrected output.
4b. If failed again → escalate to fallback model.
4c. If all retries exhausted → fail gracefully with partial result.
```

### 9.4 Graceful Degradation

When a critical component fails, the system degrades gracefully:

| Component Failure | Degraded Behavior |
|---|---|
| All LLM providers down | AI features disabled. Manual content creation still works. |
| One MCP server down | That integration disabled. Others continue. |
| Database replicas lagging | Read requests served from cache. Stale data warning shown. |
| Redis unavailable | Task queuing falls back to PostgreSQL. Agent memory limited. |
| Social platform API down | Publishing queued for retry. Dashboard shows warning. |

### 9.5 Content Moderation

When the LLM provider's content moderation triggers:

```
1. OpenModeration API flags content
2. Error returned: AI_CONTENT_MODERATED
3. Content is saved to a quarantine area (not posted)
4. Admin notified with details:
   {
     "category": "hate_speech",
     "confidence": 0.98,
     "flaggedText": "..." (redacted),
     "suggestion": "Reformulate to focus on [alternative approach]"
   }
5. Admin can review, edit, and approve or discard
```

---

## 10. Monitoring & Observability

### 10.1 Metrics Dashboard

#### Agent-Level Metrics

| Metric | Description | Labels |
|---|---|---|
| `agent.requests.total` | Total requests to agent | agent, task_type, status |
| `agent.requests.duration` | Request latency (p50/p95/p99) | agent, task_type |
| `agent.requests.errors` | Error count by error type | agent, error_type |
| `agent.tasks.active` | Currently active tasks | agent |
| `agent.tasks.queued` | Tasks waiting in queue | agent, priority |
| `agent.tokens.consumed` | Total tokens consumed | agent, provider, model |
| `agent.cost.total` | Cost in credits | agent, provider |
| `agent.memory.usage` | Memory store usage | agent, memory_type |
| `agent.self_correction.count` | Self-correction events | agent, correction_type |

#### Provider-Level Metrics

| Metric | Description | Labels |
|---|---|---|
| `llm.provider.requests` | Total provider requests | provider, model, status |
| `llm.provider.latency` | Provider latency | provider, model |
| `llm.provider.errors` | Provider errors | provider, error_type |
| `llm.provider.rate_limits` | Rate limit hits | provider, model |
| `llm.provider.circuit_breaker` | Circuit breaker state | provider |
| `llm.provider.cost` | Cost per provider | provider, model |

#### Orchestrator-Level Metrics

| Metric | Description | Labels |
|---|---|---|
| `orchestrator.tasks.total` | Total tasks processed | status, workflow |
| `orchestrator.tasks.duration` | End-to-end task duration | workflow_type |
| `orchestrator.decomposition.depth` | Average decomposition depth | task_complexity |
| `orchestrator.agent.calls` | Agents called per task | agent, role |
| `orchestrator.collaboration.count` | Agent-to-agent request count | from_agent, to_agent |

### 10.2 Tracing

Every agent workflow produces a distributed trace:

```
Trace: task_abc123
├── Span: orchestrator.decompose (450ms)
│   └── Sub-spans: LLM call (planner model)
├── Span: orchestrator.assign (12ms)
│   └── Sub-spans: queue push
├── Span: content_agent.generate (4.5s)
│   ├── Span: llm.claude.chat (3.2s)
│   │   └── Sub-spans: tokenization, API call, response parsing
│   ├── Span: agent.memory.retrieve (120ms)
│   │   └── Sub-spans: embedding, vector search
│   └── Span: agent.self_correction (800ms)
│       └── Sub-spans: validation, re-prompt, llm call
├── Span: seo_agent.optimize (1.2s)
│   └── Span: llm.openai.chat (1.0s)
├── Span: image_agent.generate (3.0s)
│   └── Span: llm.openai.image (2.8s)
└── Span: publishing_agent.schedule (200ms)
    └── Sub-spans: internal API call, queue push
```

Traces include:
- Parent/child span relationships
- Duration per span
- LLM token usage per span
- Error events
- Span tags (agent, model, task type)

### 10.3 Logging

**Log Levels:**
| Level | Description | Examples |
|---|---|---|
| `debug` | Detailed execution info | Prompt text (truncated), model responses |
| `info` | Normal operations | Task started/completed, agent state change |
| `warn` | Anomalies, retries | Rate limit hit (fallback), slow response |
| `error` | Recoverable failures | Provider down (failed over), MCP timeout |
| `critical` | Unrecoverable failures | All providers down, memory corruption |

**Structured Log Format:**

```json
{
  "timestamp": "2026-07-22T12:00:00.123Z",
  "level": "info",
  "service": "ai-agent-system",
  "agent": "content_agent",
  "taskId": "task_abc123",
  "traceId": "trace_xyz789",
  "spanId": "span_def456",
  "message": "Content generation completed",
  "metadata": {
    "model": "claude-sonnet-4",
    "tokensUsed": 780,
    "durationMs": 3450,
    "variations": 3
  }
}
```

### 10.4 Alerting Rules

| Rule | Condition | Severity | Notification |
|---|---|---|---|
| High error rate | Agent error rate > 10% over 5 min | Warning | Dashboard |
| Provider down | All requests failing for 2 min | Critical | PagerDuty, Slack |
| High latency | P95 latency > 30s over 5 min | Warning | Dashboard |
| Cost spike | Cost > 2x daily average in 1 hour | Warning | Email |
| Circuit breaker open | Any provider circuit open | Critical | PagerDuty |
| Queue backed up | Queue depth > 1000 for 5 min | Warning | Dashboard |
| Memory full | Agent STM > 90% capacity | Warning | Dashboard |

### 10.5 Cost Analytics

Per-workspace cost breakdown:

```
┌─────────────────────────────────────────────┐
│ AI Credit Usage — Acme Corp (ws_5a7b3c)      │
│                                              │
│ Month: July 2026                             │
│ Budget: 10,000 credits                       │
│ Used: 4,562/10,000 (45.6%)                   │
│                                              │
│ By Agent:                                    │
│ Content Agent       2,340 credits  (51.3%)   │
│ Repurposing Agent   1,100 credits  (24.1%)   │
│ Image Agent           780 credits  (17.1%)   │
│ Other                  342 credits   (7.5%)   │
│                                              │
│ By Provider:                                 │
│ Claude Sonnet 4     2,800 credits  (61.4%)   │
│ GPT-4o              1,200 credits  (26.3%)   │
│ DALL-E 3              450 credits   (9.9%)   │
│ Other                  112 credits   (2.4%)   │
│                                              │
│ Projected Month End: 6,800 credits (under)   │
└─────────────────────────────────────────────┘
```

### 10.6 Observability Stack

| Component | Technology | Purpose |
|---|---|---|
| Metrics | Prometheus + Grafana | Metrics collection and dashboards |
| Tracing | OpenTelemetry + Jaeger | Distributed tracing |
| Logging | Winston + Elasticsearch + Kibana | Centralized logging |
| Alerting | Alertmanager | Alert routing and notification |
| Cost tracking | PostgreSQL + Metabase | Cost analytics dashboard |
| Real-time | WebSocket + Redis | Live agent status in dashboard |
