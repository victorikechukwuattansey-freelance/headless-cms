# AI Memory & Brand Knowledge System

**Module:** 07 — AI Engine
**Document:** 03 — AI Memory & Brand Knowledge System
**Version:** 1.0.0
**Last Updated:** 2026-07-22

---

## Table of Contents

1. [System Overview](#1-system-overview)
2. [Brand Knowledge Base](#2-brand-knowledge-base)
3. [Memory Architecture](#3-memory-architecture)
4. [Vector Store Schema](#4-vector-store-schema)
5. [Knowledge Retrieval (RAG)](#5-knowledge-retrieval-rag)
6. [Learning Loop](#6-learning-loop)
7. [Content Scoring](#7-content-scoring)
8. [Personalization](#8-personalization)
9. [Privacy & Data Control](#9-privacy--data-control)
10. [Implementation Guide](#10-implementation-guide)

---

## 1. System Overview

### 1.1 What This System Does

The AI Memory & Brand Knowledge System is the persistent intelligence layer of the Social Media OS. It:

- **Remembers** everything about a brand — voice, audience, past content, performance data
- **Learns** from user interactions — which content was approved, rejected, or edited
- **Scores** content against brand guidelines before generation
- **Personalizes** AI output per workspace without retraining the base model
- **Evolves** automatically as new content is created and performance data flows in

### 1.2 Layered Architecture

```
┌──────────────────────────────────────────────────────────────────┐
│                        APPLICATION LAYER                          │
│  (Content Generator, Repurposing Engine, Analytics, Strategy)    │
└────────────────────────────────┬─────────────────────────────────┘
                                 │
                                 ▼
┌──────────────────────────────────────────────────────────────────┐
│                     KNOWLEDGE RETRIEVAL LAYER                     │
│  ┌─────────────┐  ┌─────────────┐  ┌────────────────────────┐  │
│  │ RAG Pipeline │  │ Hybrid      │  │ Context Window        │  │
│  │ (Query →     │  │ Search      │  │ Manager               │  │
│  │  Retrieve →  │  │ (Semantic + │  │ (Selects most relevant│  │
│  │  Generate)   │  │  Keyword)   │  │  knowledge for prompt)│  │
│  └─────────────┘  └─────────────┘  └────────────────────────┘  │
└────────────────────────────────┬─────────────────────────────────┘
                                 │
                                 ▼
┌──────────────────────────────────────────────────────────────────┐
│                        MEMORY LAYER                               │
│  ┌────────────────┐  ┌───────────────┐  ┌───────────────────┐  │
│  │ Short-Term     │  │ Long-Term     │  │ Episodic          │  │
│  │ (Session       │  │ (Vector Store)│  │ (Interaction      │  │
│  │  Context)      │  │               │  │  History)         │  │
│  └────────────────┘  └───────┬───────┘  └───────────────────┘  │
└──────────────────────────────┼──────────────────────────────────┘
                               │
                               ▼
┌──────────────────────────────────────────────────────────────────┐
│                      STORAGE LAYER                                │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌────────────────┐  │
│  │ pgvector │  │ Redis    │  │ Postgres │  │ Object Store   │  │
│  │ (Embed-  │  │ (Session │  │ (Tables) │  │ (Content       │  │
│  │  dings)  │  │  Cache)  │  │          │  │  Assets)       │  │
│  └──────────┘  └──────────┘  └──────────┘  └────────────────┘  │
└──────────────────────────────────────────────────────────────────┘
```

### 1.3 Data Flow

```
User creates content → Content is scored against brand voice → Published
      │                                                                
      └── Performance metrics come back from platform analytics       
              │                                                       
              ▼                                                        
      Pattern extraction (what worked, what didn't)                     
              │                                                       
              ▼                                                        
      Brand knowledge update (tone tweaks, audience insights)          
              │                                                       
              ▼                                                        
      Next content generation is informed by updated knowledge          
```

### 1.4 Core Data Model

```typescript
interface WorkspaceMemory {
  workspace_id: string;
  
  // Brand Knowledge
  brand: BrandProfile;
  
  // Session Context (short-term)
  session: {
    current_session_id: string;
    recent_history: SessionEvent[];
    active_context: string[];
    pending_decisions: DecisionPoint[];
  };
  
  // Long-term Memory
  knowledge_base: {
    content_library: ContentRecord[];
    vector_store: VectorIndex;
  };
  
  // Episodic Memory
  episodes: {
    interactions: InteractionRecord[];
    decisions: DecisionRecord[];
    performance_history: PerformanceSnapshot[];
  };
  
  // Learning State
  learning: {
    approved_patterns: Pattern[];
    rejected_patterns: Pattern[];
    personalization_model: PersonalizationProfile;
  };
}
```

---

## 2. Brand Knowledge Base

### 2.1 Brand Profile Schema

```json
{
  "brand_profile": {
    "version": "1.0",
    "last_updated": "2026-07-22T10:00:00Z",
    
    "identity": {
      "brand_name": "Brand Name",
      "tagline": "Short tagline",
      "mission_statement": "Our mission is...",
      "brand_archetype": "Creator / Sage / Outlaw / Hero / Caregiver / Explorer / Everyman / Jester / Innocent / Lover / Magician / Ruler",
      "year_founded": 2020,
      "headquarters": "City, Country",
      "industry": "Industry",
      "niche": "Specific niche within industry"
    },
    
    "voice": {
      "personality_traits": ["Innovative", "Trustworthy", "Approachable"],
      "tone_spectrum": {
        "formality": 5,
        "humor": 6,
        "emotion": 7,
        "authority": 6,
        "inclusivity": 8
      },
      "voice_dimensions": {
        "sentence_structure": "Mix of short and medium sentences",
        "vocabulary_level": "Conversational with occasional industry terms",
        "pronoun_preference": "First person plural ('we', 'our')",
        "contraction_use": "Yes — contractions are encouraged",
        "exclamation_frequency": "Moderate — 1 per 2-3 posts"
      }
    },
    
    "audience": {
      "primary_demographic": {
        "age_range": [25, 44],
        "gender": "all",
        "location": "Global, primarily English-speaking",
        "income_bracket": "$50K-$150K",
        "occupation": ["Marketers", "Entrepreneurs", "Creators"]
      },
      "psychographics": {
        "values": ["Efficiency", "Creativity", "Growth", "Community"],
        "pain_points": ["Content burnout", "Inconsistent branding", "Low engagement"],
        "aspirations": ["Build a recognizable brand", "Grow audience", "Save time"],
        "content_preferences": ["Educational", "Behind-the-scenes", "User-generated"]
      },
      "platform_presence": {
        "instagram": "Primary — 85% of audience",
        "linkedin": "Secondary — professional segment",
        "x_twitter": "Tertiary — real-time engagement",
        "tiktok": "Experimental — growing segment",
        "youtube": "Planned",
        "pinterest": "Minimal"
      }
    },
    
    "visual_identity": {
      "primary_colors": ["#2D6BE4", "#1A1A2E", "#E94560"],
      "secondary_colors": ["#F5F5F5", "#16213E", "#0F3460"],
      "fonts": {
        "heading": "Inter Bold",
        "body": "Inter Regular",
        "accent": "Playfair Display"
      },
      "logo_url": "https://cdn.brand.com/logo.png",
      "logo_variants": ["horizontal", "square", "icon"],
      "image_style": "Clean, high-contrast, minimal",
      "photo_filters": ["Warm tones", "Slight desaturation", "High clarity"]
    },
    
    "language_rules": {
      "approved_terminology": {
        "preferred_term": "creator",
        "avoid_term": "influencer",
        "reason": "Inclusivity — everyone can create"
      },
      "forbidden_words": [
        {"word": "crushing it", "reason": "Overused, inauthentic"},
        {"word": "synergy", "reason": "Corporate jargon"},
        {"word": "game-changer", "reason": "Hyperbolic, overused"},
        {"word": "hack", "reason": "Implies shortcuts"}
      ],
      "mandatory_inclusions": {
        "cta_required": true,
        "brand_hashtag_required": true,
        "disclosure_required": false
      }
    },
    
    "competitors": [
      {"name": "Competitor A", "positioning": "Premium", "differences": "More expensive, less accessible"},
      {"name": "Competitor B", "positioning": "Free tier", "differences": "Fewer features, better marketing"}
    ],
    
    "content_strategy": {
      "pillars": [
        {"name": "Education", "percentage": 40},
        {"name": "Inspiration", "percentage": 25},
        {"name": "Community", "percentage": 20},
        {"name": "Promotion", "percentage": 15}
      ],
      "optimal_posting_frequency": {
        "instagram": "5-7x/week",
        "linkedin": "3-5x/week",
        "x_twitter": "3-5x/day",
        "tiktok": "3-5x/week"
      },
      "best_posting_times": {
        "instagram": "9AM, 12PM, 6PM EST",
        "linkedin": "8AM, 12PM, 5PM EST",
        "x_twitter": "8AM, 12PM, 8PM EST",
        "tiktok": "7AM, 11AM, 7PM EST"
      }
    }
  }
}
```

### 2.2 Brand Knowledge Management API

```typescript
interface BrandKnowledgeAPI {
  // Read
  getBrandProfile(workspace_id: string): BrandProfile;
  getVoiceGuidelines(workspace_id: string): VoiceGuidelines;
  getAudienceProfile(workspace_id: string): AudienceProfile;
  getForbiddenWords(workspace_id: string): ForbiddenWord[];
  getApprovedTerminology(workspace_id: string): TerminologyMap;
  getContentPillars(workspace_id: string): ContentPillar[];
  
  // Write
  updateBrandVoice(workspace_id: string, updates: Partial<VoiceGuidelines>): void;
  addForbiddenWord(workspace_id: string, word: string, reason: string): void;
  removeForbiddenWord(workspace_id: string, word: string): void;
  addApprovedTerm(workspace_id: string, preferred: string, avoid: string): void;
  updateAudienceInsight(workspace_id: string, insight: AudienceInsight): void;
  
  // Bulk
  importBrandProfile(workspace_id: string, profile: BrandProfileInput): void;
  exportBrandProfile(workspace_id: string): BrandProfile;
  resetBrandKnowledge(workspace_id: string): void;
  
  // Validation
  validateContentAgainstBrand(content: string): BrandValidationResult;
  suggestBrandImprovements(content: string): BrandSuggestion[];
}
```

### 2.3 Brand Validation Result

```typescript
interface BrandValidationResult {
  overall_brand_score: number; // 0-1
  category_scores: {
    voice_consistency: number;
    terminology_compliance: number;
    forbidden_word_check: { passed: boolean; violations: string[] };
    tone_alignment: number;
    visual_alignment: number;
    platform_best_practices: number;
  };
  violations: BrandViolation[];
  warnings: BrandWarning[];
  suggestions: BrandSuggestion[];
  passed: boolean; // true if all critical checks pass
}

interface BrandViolation {
  severity: 'critical' | 'major' | 'minor';
  category: 'forbidden_word' | 'tone_mismatch' | 'terminology' | 'visual' | 'structure';
  message: string;
  location?: { start: number; end: number };
  suggested_fix: string;
}

interface BrandWarning {
  category: string;
  message: string;
  impact: 'engagement' | 'brand_perception' | 'algorithm';
}

interface BrandSuggestion {
  category: string;
  suggestion: string;
  expected_impact: string;
  confidence: number; // 0-1
}
```

---

## 3. Memory Architecture

### 3.1 Memory Classification

| Memory Type | Duration | Storage | Capacity | Purpose |
|---|---|---|---|---|
| **Short-term (Working)** | Session lifetime | Redis | A few KB | Current context, recent history, active decisions |
| **Long-term (Semantic)** | Persistent | pgvector | Unlimited | Brand voice, patterns, preferences, content library |
| **Episodic** | 90 days (rolling) | Postgres | 100K events | Interaction history, decisions made, performance snapshots |
| **Procedural** | Persistent | Config files | Static | Transformation templates, pipeline definitions |
| **Reflexive** | Immediate | Application state | Current request | API calls, cache lookups, quick validations |

### 3.2 Short-Term Memory (Session Context)

```typescript
interface SessionMemory {
  session_id: string;
  workspace_id: string;
  created_at: string;
  expires_at: string; // TTL: 24 hours from last activity
  
  // Active Context
  current_operation: {
    type: 'content_generation' | 'repurposing' | 'analysis' | 'strategy';
    step: string;
    input_hash: string;
    started_at: string;
  };
  
  // Recent Events (last 50)
  recent_events: SessionEvent[];
  
  // Current Decision Queue
  pending_decisions: DecisionPoint[];
  
  // Retrieved Knowledge (cached)
  active_knowledge: {
    brand_profile: BrandProfile;
    recent_content: ContentRecord[];
    retrieved_embeddings: VectorRecord[];
    context_window: string; // assembled prompt context
  };
  
  // Usage Metrics
  tokens_used_this_session: number;
  api_calls_this_session: number;
  estimated_cost_this_session: number;
}

interface SessionEvent {
  type: 'content_viewed' | 'content_generated' | 'content_edited' | 'content_approved' | 'content_rejected' | 'knowledge_retrieved';
  timestamp: string;
  data: Record<string, any>;
}
```

### 3.3 Long-Term Memory (Vector Store)

Long-term memory is stored as vector embeddings in pgvector. Each memory type has a distinct embedding namespace.

| Memory Class | Namespace | Embedding Model | Dimensions | Chunk Strategy |
|---|---|---|---|---|
| `brand_knowledge` | `bk_` | text-embedding-3-small | 1536 | Full document (under 8K tokens) |
| `past_content` | `pc_` | text-embedding-3-small | 1536 | Post-level |
| `successful_content` | `sc_` | text-embedding-3-small | 1536 | Post-level + engagement metadata |
| `user_preferences` | `up_` | text-embedding-3-small | 1536 | Preference statement-level |
| `approved_patterns` | `ap_` | text-embedding-3-small | 1536 | Pattern description |
| `rejected_patterns` | `rp_` | text-embedding-3-small | 1536 | Pattern description |
| `audience_insights` | `ai_` | text-embedding-3-small | 1536 | Insight statement-level |
| `performance_patterns` | `pp_` | text-embedding-3-small | 1536 | Pattern + metric delta |

### 3.4 Episodic Memory (Interaction History)

```typescript
interface EpisodicMemory {
  workspace_id: string;
  episodes: InteractionRecord[];
  
  // Retention: 90 days rolling
  // Aggregation: Daily snapshots kept for 1 year
}

interface InteractionRecord {
  episode_id: string;
  timestamp: string;
  type: 'generation' | 'edit' | 'approval' | 'rejection' | 'publish' | 'performance_update';
  
  context: {
    operation: string;
    model_used: string;
    tokens_used: number;
    latency_ms: number;
    source_content_id?: string;
  };
  
  input: {
    prompt_template: string;
    variables: Record<string, any>;
  };
  
  output: {
    generated_content: string;
    alternative_version?: string;
    selected_version_id?: string;
  };
  
  user_action: {
    action_taken: 'approved' | 'edited' | 'rejected' | 'regenerated';
    edit_diff?: string; // unified diff format
    rejection_reason?: string;
    user_feedback?: string;
  };
  
  performance: {
    engagement_rate?: number;
    impressions?: number;
    likes?: number;
    comments?: number;
    shares?: number;
    saves?: number;
    clicks?: number;
  };
}

interface DecisionRecord {
  decision_id: string;
  timestamp: string;
  type: 'content_approval' | 'strategy_choice' | 'tone_selection' | 'platform_selection';
  options: any[];
  chosen_option: any;
  rationale?: string;
  outcome_metrics?: Record<string, number>;
}
```

---

## 4. Vector Store Schema

### 4.1 pgvector Schema

```sql
-- Enable pgvector extension
CREATE EXTENSION IF NOT EXISTS vector;

-- Main embeddings table
CREATE TABLE embeddings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Metadata
  workspace_id VARCHAR(64) NOT NULL,
  namespace VARCHAR(8) NOT NULL, -- 'bk_', 'pc_', 'sc_', etc.
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  source_content_id UUID, -- FK to content_library
  user_id VARCHAR(64),
  
  -- Embedding
  embedding VECTOR(1536) NOT NULL,
  
  -- Text
  chunk_text TEXT NOT NULL,
  chunk_hash VARCHAR(64), -- SHA-256 for dedup
  
  -- Metrics for ranking
  relevance_score FLOAT DEFAULT 0.0,
  engagement_score FLOAT DEFAULT 0.0,
  recency_factor FLOAT DEFAULT 1.0,
  user_signal_score FLOAT DEFAULT 0.0, -- boosted by user interactions
  
  -- JSON metadata (flexible)
  metadata JSONB DEFAULT '{}'::jsonb,
  
  -- Indexes
  -- Created below
);

-- HNSW index for fast similarity search
CREATE INDEX idx_embeddings_hnsw ON embeddings 
  USING hnsw (embedding vector_cosine_ops)
  WITH (m = 16, ef_construction = 200);

-- Filtered indexes per workspace+namespace
CREATE INDEX idx_embeddings_lookup ON embeddings (workspace_id, namespace);
CREATE INDEX idx_embeddings_content ON embeddings (source_content_id);
CREATE INDEX idx_embeddings_user ON embeddings (user_id) WHERE user_id IS NOT NULL;
CREATE INDEX idx_embeddings_metadata ON embeddings USING gin (metadata);

-- Content library table
CREATE TABLE content_library (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id VARCHAR(64) NOT NULL,
  
  -- Content
  title TEXT,
  content TEXT NOT NULL,
  content_type VARCHAR(32), -- 'blog', 'social_post', 'video_script', etc.
  platform VARCHAR(32), -- 'instagram', 'linkedin', etc.
  format VARCHAR(32), -- 'caption', 'carousel', 'thread', 'script'
  
  -- Status
  status VARCHAR(16) DEFAULT 'draft', -- 'draft', 'published', 'archived'
  published_at TIMESTAMP WITH TIME ZONE,
  
  -- Performance (populated after publish)
  impressions INTEGER DEFAULT 0,
  engagement_count INTEGER DEFAULT 0,
  engagement_rate FLOAT DEFAULT 0.0,
  likes INTEGER DEFAULT 0,
  comments INTEGER DEFAULT 0,
  shares INTEGER DEFAULT 0,
  saves INTEGER DEFAULT 0,
  clicks INTEGER DEFAULT 0,
  
  -- Metadata
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  generated_by VARCHAR(64), -- prompt template ID
  model_used VARCHAR(64),
  tokens_used INTEGER,
  score FLOAT, -- content quality score
  
  -- Indexes
  CONSTRAINT fk_workspace FOREIGN KEY (workspace_id) REFERENCES workspaces(id)
);

CREATE INDEX idx_content_workspace ON content_library (workspace_id, status);
CREATE INDEX idx_content_published ON content_library (workspace_id, published_at);
CREATE INDEX idx_content_performance ON content_library (workspace_id, engagement_rate DESC);

-- Brand profile table
CREATE TABLE brand_profiles (
  workspace_id VARCHAR(64) PRIMARY KEY,
  profile JSONB NOT NULL,
  version VARCHAR(16) DEFAULT '1.0',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Audience insights table
CREATE TABLE audience_insights (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id VARCHAR(64) NOT NULL,
  insight_text TEXT NOT NULL,
  category VARCHAR(32), -- 'demographic', 'behavioral', 'preference', 'trend'
  confidence FLOAT DEFAULT 0.0,
  source VARCHAR(32), -- 'manual', 'automated_analysis', 'platform_api'
  valid_from TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  valid_until TIMESTAMP WITH TIME ZONE,
  metadata JSONB DEFAULT '{}'::jsonb
);

CREATE INDEX idx_insights_workspace ON audience_insights (workspace_id, category);

-- Learning events table (for the learning loop)
CREATE TABLE learning_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id VARCHAR(64) NOT NULL,
  event_type VARCHAR(32) NOT NULL, -- 'approval', 'rejection', 'edit', 'performance'
  content_id UUID REFERENCES content_library(id),
  pattern_extracted TEXT,
  pattern_confidence FLOAT DEFAULT 0.0,
  applied_to_brand_knowledge BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_learning_workspace ON learning_events (workspace_id, event_type);
```

### 4.2 Vector Record Structure

```typescript
interface VectorRecord {
  id: string;
  workspace_id: string;
  namespace: string;
  embedding: number[]; // 1536 floats
  chunk_text: string;
  chunk_hash: string;
  source_content_id?: string;
  user_id?: string;
  
  // Ranking factors
  relevance_score: number; // base relevance (0-1)
  engagement_score: number; // how well this content performed (0-1)
  recency_factor: number; // decay over time (0-1, 1 = just now)
  user_signal_score: number; // boosted by user interactions (0-1)
  
  // Computed at query time
  combined_score: number; // weighted combination of above
  
  metadata: Record<string, any>;
  
  created_at: string;
  updated_at: string;
}

interface ChunkMetadata {
  content_type: string;
  platform?: string;
  format?: string;
  word_count?: number;
  has_cta?: boolean;
  has_emojis?: boolean;
  tone_tags?: string[]; // ['professional', 'humorous']
  topic_tags?: string[];
  engagement_rate_range?: 'high' | 'medium' | 'low';
  was_approved?: boolean;
}
```

### 4.3 Scoring Functions

The combined score used for retrieval ranking:

```sql
-- PostgreSQL function for hybrid scoring
CREATE OR REPLACE FUNCTION calculate_combined_score(
  relevance FLOAT,
  engagement FLOAT,
  recency FLOAT,
  user_signal FLOAT
) RETURNS FLOAT AS $$
BEGIN
  -- Weights: relevance 0.40, engagement 0.25, recency 0.20, user_signal 0.15
  RETURN (relevance * 0.40) + (engagement * 0.25) + (recency * 0.20) + (user_signal * 0.15);
END;
$$ LANGUAGE plpgsql;
```

```typescript
// TypeScript equivalent
function calculateCombinedScore(factors: ScoreFactors): number {
  const weights = {
    relevance: 0.40,
    engagement: 0.25,
    recency: 0.20,
    userSignal: 0.15
  };
  
  return (
    factors.relevance * weights.relevance +
    factors.engagement * weights.engagement +
    factors.recency * weights.recency +
    factors.userSignal * weights.userSignal
  );
}
```

---

## 5. Knowledge Retrieval (RAG)

### 5.1 RAG Pipeline

```
User Query / Content Context
        │
        ▼
┌─────────────────────┐
│  Query Processor     │
│  - Extract intent    │
│  - Expand keywords   │
│  - Detect platform   │
│  - Detect content type│
└──────────┬──────────┘
           │
           ▼
┌─────────────────────┐
│  Retriever           │
│  ┌───────────────┐  │
│  │ Vector Search  │  │ ← Semantic similarity (cosine)
│  │ (top-K=20)    │  │
│  └───────┬───────┘  │
│  ┌───────────────┐  │
│  │ Keyword Search │  │ ← BM25 / tsvector
│  │ (top-K=10)    │  │
│  └───────┬───────┘  │
│  ┌───────────────┐  │
│  │ Hybrid Fuser   │  │ ← Reciprocal Rank Fusion
│  └───────┬───────┘  │
└──────────┬──────────┘
           │
           ▼
┌─────────────────────┐
│  Re-ranker          │
│  - Cross-encoder    │
│  - Brand relevance  │
│  - Recency boost    │
│  - User signal boost│
└──────────┬──────────┘
           │
           ▼
┌─────────────────────┐
│  Context Window     │
│  Manager             │
│  - Select top-K=5   │
│  - Fit to token     │
│    budget            │
│  - Format for prompt │
└──────────┬──────────┘
           │
           ▼
┌─────────────────────┐
│  Generation          │
│  (LLM + retrieved    │
│   context)           │
└─────────────────────┘
```

### 5.2 Hybrid Search Implementation

```typescript
interface HybridSearchConfig {
  vector: {
    enabled: boolean;
    top_k: number; // 20
    min_score: number; // 0.6
    model: string; // 'text-embedding-3-small'
    dimensions: number; // 1536
    index_type: 'hnsw' | 'ivfflat'; // hnsw
  };
  
  keyword: {
    enabled: boolean;
    top_k: number; // 10
    min_score: number; // 0.3
    engine: 'bm25' | 'tsvector'; // tsvector
    weights: {
      title: number; // 2.0
      content: number; // 1.0
      metadata: number; // 0.5
    };
  };
  
  fusion: {
    strategy: 'rrf' | 'weighted_sum'; // rrf
    rrf_k: number; // 60 (Reciprocal Rank Fusion constant)
    weights: {
      vector: number; // 0.6
      keyword: number; // 0.4
    };
  };
  
  rerank: {
    enabled: boolean;
    top_k: number; // 5
    model: string; // 'cross-encoder/ms-marco-MiniLM-L-6-v2'
  };
}

class HybridRetriever {
  private config: HybridSearchConfig;
  private vectorStore: pgvectorClient;
  private keywordStore: tsvectorClient;
  
  async search(query: string, filter: SearchFilter): Promise<VectorRecord[]> {
    // 1. Vector search
    const vectorResults = await this.vectorStore.similaritySearch(
      query, 
      this.config.vector.top_k,
      filter
    );
    
    // 2. Keyword search
    const keywordResults = await this.keywordStore.search(
      query,
      this.config.keyword.top_k,
      filter
    );
    
    // 3. Reciprocal Rank Fusion
    const fused = reciprocalRankFusion(
      vectorResults.map(r => ({ id: r.id, score: r.similarity })),
      keywordResults.map(r => ({ id: r.id, score: r.relevance })),
      this.config.fusion.rrf_k
    );
    
    // 4. Score adjustment
    const scored = fused.map(item => {
      const record = this.findRecord(item.id, vectorResults, keywordResults);
      return {
        ...record,
        combined_score: calculateCombinedScore({
          relevance: item.score,
          engagement: record.engagement_score,
          recency: record.recency_factor,
          userSignal: record.user_signal_score
        })
      };
    });
    
    // 5. Re-rank using cross-encoder (if enabled)
    if (this.config.rerank.enabled) {
      return this.reranker.rerank(query, scored, this.config.rerank.top_k);
    }
    
    // 6. Sort by combined score, return top K
    return scored
      .sort((a, b) => b.combined_score - a.combined_score)
      .slice(0, this.config.rerank.enabled ? this.config.rerank.top_k : 5);
  }
}

function reciprocalRankFusion(
  vector: { id: string; score: number }[],
  keyword: { id: string; score: number }[],
  k: number = 60
): { id: string; score: number }[] {
  const scores = new Map<string, number>();
  
  vector.forEach((item, rank) => {
    scores.set(item.id, (scores.get(item.id) || 0) + 1 / (k + rank));
  });
  
  keyword.forEach((item, rank) => {
    scores.set(item.id, (scores.get(item.id) || 0) + 1 / (k + rank));
  });
  
  return Array.from(scores.entries())
    .map(([id, score]) => ({ id, score }))
    .sort((a, b) => b.score - a.score);
}
```

### 5.3 Context Window Management

```typescript
interface ContextWindowConfig {
  max_tokens: number; // 4000 (leaves room for prompt + generation)
  min_tokens: number; // 500 (minimum useful context)
  strategy: 'truncate' | 'summarize' | 'ranked_truncate'; // ranked_truncate
  
  // Per content type token budgets
  budgets: {
    brand_knowledge: { max: 1000, priority: 1 };
    recent_content: { max: 800, priority: 2 };
    successful_patterns: { max: 600, priority: 3 };
    audience_insights: { max: 600, priority: 4 };
    rejected_patterns: { max: 500, priority: 5 };
    performance_data: { max: 500, priority: 6 };
  };
}

class ContextWindowManager {
  private config: ContextWindowConfig;
  
  async assembleContext(
    workspace_id: string,
    query: string,
    filter: SearchFilter
  ): Promise<AssembledContext> {
    // 1. Retrieve all relevant knowledge
    const retrieved = await this.retriever.search(query, filter);
    
    // 2. Categorize by memory class
    const categorized = this.categorizeResults(retrieved);
    
    // 3. Allocate token budget per category
    const allocated = this.allocateBudget(categorized);
    
    // 4. Format for prompt injection
    const formatted = this.formatForPrompt(allocated);
    
    return {
      context_string: formatted,
      used_tokens: this.countTokens(formatted),
      budget_remaining: this.config.max_tokens - this.countTokens(formatted),
      sources: retrieved.map(r => ({
        id: r.id,
        namespace: r.namespace,
        relevance: r.combined_score
      }))
    };
  }
  
  private allocateBudget(
    categorized: CategorizedResults
  ): AllocatedContext[] {
    // Priority-based allocation:
    // Higher priority categories get their max budget first
    // Lower priority categories get remaining budget
    
    const priorities = Object.entries(this.config.budgets)
      .sort(([, a], [, b]) => a.priority - b.priority);
    
    let remaining = this.config.max_tokens;
    const allocated: AllocatedContext[] = [];
    
    for (const [category, budget] of priorities) {
      const items = categorized[category] || [];
      if (items.length === 0) continue;
      
      const tokensForCategory = Math.min(budget.max, remaining * 0.8);
      const itemBudget = Math.floor(tokensForCategory / items.length);
      
      allocated.push({
        category,
        items: items.slice(0, Math.ceil(tokensForCategory / itemBudget)),
        allocated_tokens: tokensForCategory
      });
      
      remaining -= tokensForCategory;
      if (remaining < this.config.min_tokens) break;
    }
    
    return allocated;
  }
  
  private formatForPrompt(allocated: AllocatedContext[]): string {
    const sections: string[] = [];
    
    for (const group of allocated) {
      if (group.items.length === 0) continue;
      
      const sectionHeader = this.getSectionHeader(group.category);
      const itemTexts = group.items.map(item => item.chunk_text);
      
      sections.push(`## ${sectionHeader}\n${itemTexts.join('\n\n')}`);
    }
    
    return sections.join('\n\n');
  }
}
```

### 5.4 Relevance Scoring

```typescript
interface RelevanceScoreConfig {
  semantic_weight: number; // 0.5
  keyword_match_weight: number; // 0.2
  recency_weight: number; // 0.15
  engagement_weight: number; // 0.1
  brand_alignment_weight: number; // 0.05
  
  recency_decay_days: number; // 30 — half-life
  engagement_max_reference: number; // 0.1 — top 10% engagement rate
}

function scoreRelevance(
  query: string,
  record: VectorRecord,
  config: RelevanceScoreConfig
): number {
  const semantic = record.relevance_score; // from vector similarity
  const keyword = keywordMatchScore(query, record.chunk_text); // BM25
  const recency = recencyScore(record.created_at, config.recency_decay_days);
  const engagement = engagementScore(record.engagement_score);
  const brandAlignment = record.metadata.brand_alignment || 0.5;
  
  return (
    semantic * config.semantic_weight +
    keyword * config.keyword_match_weight +
    recency * config.recency_weight +
    engagement * config.engagement_weight +
    brandAlignment * config.brand_alignment_weight
  );
}

function recencyScore(createdAt: string, halfLifeDays: number): number {
  const ageDays = (Date.now() - new Date(createdAt).getTime()) / (1000 * 60 * 60 * 24);
  return Math.pow(0.5, ageDays / halfLifeDays);
}

function engagementScore(engagementRate: number): number {
  // Scale: 0.1 engagement rate → score of 1.0
  // Cap at 1.0
  return Math.min(1.0, engagementRate / 0.1);
}
```

---

## 6. Learning Loop

### 6.1 The Loop

```
                    ┌─────────────────────────┐
                    │  Content is Published    │
                    └──────────┬──────────────┘
                               │
                               ▼
                    ┌─────────────────────────┐
                    │  Performance Data        │
                    │  Collected (24-72h)      │
                    └──────────┬──────────────┘
                               │
                               ▼
                    ┌─────────────────────────┐
                    │  Pattern Extraction      │
                    │  (What worked? Why?)     │
                    └──────────┬──────────────┘
                               │
                    ┌──────────┴──────────┐
                    │                     │
                    ▼                     ▼
        ┌──────────────────┐  ┌──────────────────┐
        │ High Performance │  │ Low Performance   │
        │ → Extract        │  │ → Extract         │
        │   Winning Pattern│  │   Avoidance       │
        │ → Boost in       │  │   Pattern         │
        │   Retrieval      │  │ → Deprioritize    │
        └────────┬─────────┘  └────────┬─────────┘
                 │                     │
                 └──────────┬──────────┘
                            │
                            ▼
                 ┌─────────────────────────┐
                 │  Brand Knowledge Update  │
                 │  (Tone, Topics,          │
                 │   Format Preferences)    │
                 └──────────┬──────────────┘
                            │
                            ▼
                 ┌─────────────────────────┐
                 │  Next Content Generation │
                 │  Informed by Updated     │
                 │  Knowledge               │
                 └─────────────────────────┘
```

### 6.2 Pattern Extraction

```typescript
interface PatternExtractor {
  extract(content: ContentRecord, metrics: PerformanceMetrics): ExtractedPattern;
  
  // Analysis dimensions:
  // 1. Length pattern — optimal character count range
  // 2. Tone pattern — which tones drive engagement
  // 3. Topic pattern — which topics perform best
  // 4. Format pattern — image vs video vs carousel vs text
  // 5. CTA pattern — which CTAs drive clicks
  // 6. Hook pattern — which hook types get attention
  // 7. Timing pattern — best posting times
  // 8. Hashtag pattern — hashtag count and type optimal
  // 9. Emoji pattern — emoji density optimal
  // 10. Sentiment pattern — positive/neutral/negative performance
}

interface ExtractedPattern {
  pattern_id: string;
  category: PatternCategory;
  description: string;
  dimension: string;
  value: any;
  confidence: number; // 0-1
  sample_size: number;
  metric_delta: {
    engagement_rate_change: number; // percentage points
    impression_change: number;
    click_change: number;
  };
  applied: boolean;
  applied_at?: string;
}

type PatternCategory = 
  | 'length_optimal'
  | 'tone_preference'
  | 'topic_performance'
  | 'format_preference'
  | 'cta_effectiveness'
  | 'hook_type_performance'
  | 'timing_optimal'
  | 'hashtag_strategy'
  | 'emoji_strategy'
  | 'sentiment_performance'
  | 'content_structure'
  | 'visual_preference'
  | 'audience_behavior';
```

### 6.3 Pattern Application

```typescript
class BrandKnowledgeUpdater {
  private min_confidence_threshold: number = 0.7;
  private min_sample_size: number = 10;
  
  async evaluateAndApply(pattern: ExtractedPattern): Promise<UpdateResult> {
    // 1. Check confidence threshold
    if (pattern.confidence < this.min_confidence_threshold) {
      return { applied: false, reason: 'confidence_below_threshold' };
    }
    
    // 2. Check sample size
    if (pattern.sample_size < this.min_sample_size) {
      return { applied: false, reason: 'insufficient_sample' };
    }
    
    // 3. Check metric delta significance
    if (Math.abs(pattern.metric_delta.engagement_rate_change) < 0.01) {
      return { applied: false, reason: 'delta_insignificant' };
    }
    
    // 4. Apply to brand knowledge
    switch (pattern.category) {
      case 'tone_preference':
        await this.updateTonePreferences(pattern);
        break;
      case 'topic_performance':
        await this.updateContentPillars(pattern);
        break;
      case 'format_preference':
        await this.updateFormatWeights(pattern);
        break;
      case 'timing_optimal':
        await this.updatePostingTimes(pattern);
        break;
      case 'hashtag_strategy':
        await this.updateHashtagStrategy(pattern);
        break;
      case 'emoji_strategy':
        await this.updateEmojiGuidelines(pattern);
        break;
      case 'length_optimal':
        await this.updateLengthGuidelines(pattern);
        break;
      case 'hook_type_performance':
        await this.updateHookPreferences(pattern);
        break;
      case 'cta_effectiveness':
        await this.updateCTAStrategy(pattern);
        break;
    }
    
    // 5. Log application
    await this.logApplication(pattern);
    
    return { applied: true, changes: pattern };
  }
  
  private async updateTonePreferences(pattern: ExtractedPattern): Promise<void> {
    // Adjust tone spectrum values based on performance data
    const { value, metric_delta } = pattern;
    
    if (metric_delta.engagement_rate_change > 0) {
      // This tone is working well — shift spectrum toward it
      await this.db.query(`
        UPDATE brand_profiles
        SET profile = jsonb_set(
          profile,
          '{voice,tone_spectrum}',
          (profile->'voice'->'tone_spectrum' || $1::jsonb)
        )
        WHERE workspace_id = $2
      `, [JSON.stringify(value), pattern.workspace_id]);
    }
  }
}
```

### 6.4 Learning Event Categories

| Event | Trigger | Extraction | Application |
|---|---|---|---|
| Content approved (user) | User clicks Approve | Extract approved content patterns | Boost similar future content in generation |
| Content edited (user) | User edits generated text | Compare diff, extract preference signals | Adjust tone/template preferences |
| Content rejected (user) | User clicks Reject with reason | Extract rejection pattern | Add to rejection embeddings, deprioritize |
| High engagement | Performance > 90th percentile | Extract winning patterns (hook, length, tone) | Boost pattern weight, update guidelines |
| Low engagement | Performance < 10th percentile | Extract underperforming patterns | Demote pattern weight |
| Best posting time | Time-series analysis of performance | Compute optimal time windows | Update brand profile posting times |
| Format trend | Format-level performance comparison | Determine best-performing format | Adjust content strategy format mix |
| Audience shift | Demographic/psychographic changes | Detect audience composition changes | Update audience profile |

### 6.5 Feedback Strength

```typescript
interface FeedbackStrength {
  // How strongly a single event affects the knowledge base
  
  // Direct user feedback (strong)
  manual_approval: 0.3;
  manual_edit: 0.4;
  manual_rejection_with_reason: 0.5;
  manual_rejection_no_reason: 0.1;
  
  // Performance-based feedback (moderate)
  high_engagement: 0.2;
  low_engagement: 0.15;
  
  // Accumulated feedback (weak per event, strong over many)
  consistent_pattern: 0.05; // per event, accumulates
  trend_confirmation: 0.1; // when 3+ events agree
}
```

---

## 7. Content Scoring

### 7.1 Scoring Architecture

Every piece of generated content is scored before presentation to the user:

```typescript
interface ContentScore {
  overall: number; // 0-1, weighted combination
  
  components: {
    brand_voice_consistency: number; // 0-1
    engagement_prediction: number; // 0-1 (predicted engagement rate)
    quality_metrics: QualityMetrics;
    platform_optimization: number; // 0-1
    originality: number; // 0-1 (vs existing content)
    readability: number; // 0-1
  };
  
  weights: {
    brand_voice_consistency: 0.25;
    engagement_prediction: 0.25;
    quality_metrics: 0.20;
    platform_optimization: 0.15;
    originality: 0.10;
    readability: 0.05;
  };
  
  metadata: {
    model_used: string;
    tokens_used: number;
    scoring_version: string;
    scored_at: string;
  };
}

interface QualityMetrics {
  grammar_score: number; // 0-1 (grammar check passed)
  cliche_count: number; // number of detected cliches
  filler_word_count: number;
  sentence_length_variety: number; // 0-1 (higher = more varied)
  active_voice_percentage: number; // 0-1
  transition_word_density: number; // transitions per sentence
  paragraph_length_consistency: number; // 0-1
}
```

### 7.2 Brand Voice Consistency Scoring

```typescript
class BrandVoiceScorer {
  async score(content: string, brandVoice: VoiceGuidelines): Promise<VoiceScore> {
    const features = await this.extractToneFeatures(content);
    
    return {
      formality: this.scoreDimension(features.formality, brandVoice.tone_spectrum.formality),
      humor: this.scoreDimension(features.humor, brandVoice.tone_spectrum.humor),
      emotion: this.scoreDimension(features.emotion, brandVoice.tone_spectrum.emotion),
      authority: this.scoreDimension(features.authority, brandVoice.tone_spectrum.authority),
      inclusivity: this.scoreDimension(features.inclusivity, brandVoice.tone_spectrum.inclusivity),
      overall: this.computeOverall(features, brandVoice)
    };
  }
  
  private scoreDimension(actual: number, target: number): number {
    // Score = 1 - |actual - target| / 10
    // Example: target=5, actual=6 → score = 1 - 1/10 = 0.9
    return Math.max(0, 1 - Math.abs(actual - target) / 10);
  }
}
```

### 7.3 Engagement Prediction Model

```typescript
interface EngagementPredictor {
  model: GradientBoostingRegressor | LightGBM;
  features: string[];
  
  predict(content: ContentRecord, context: PredictionContext): EngagementPrediction;
  
  // Features used for prediction:
  features: [
    'word_count',
    'sentence_count',
    'avg_word_length',
    'emoji_count',
    'hashtag_count',
    'question_count',
    'exclamation_count',
    'first_word_is_hook_type',
    'has_cta',
    'cta_position_ratio',
    'tone_formality_score',
    'tone_humor_score',
    'tone_authority_score',
    'weekday',
    'hour_of_day',
    'days_since_last_post',
    'follower_count',
    'account_avg_engagement_rate',
    'platform',
    'content_type_encoded',
    'media_count',
    'is_carousel',
    'contains_link',
    'brand_voice_score',
    'topic_embedding_0_to_10', // PCA-reduced topic features
    'recency_score',
    'competition_level' // how many similar posts around same time
  ];
}

interface EngagementPrediction {
  predicted_engagement_rate: number; // percentage
  confidence_interval: [number, number]; // 95% CI
  prediction_quality: 'high' | 'medium' | 'low'; // based on model confidence
  top_contributing_features: { feature: string; importance: number }[];
  suggested_improvements: string[];
}
```

### 7.4 Scoring at Generation Time

```typescript
class ContentScorer {
  async scoreGeneratedContent(
    content: string,
    context: ScoringContext
  ): Promise<ScoredContent> {
    // Parallel scoring
    const [
      brandScore,
      qualityScore,
      platformScore,
      originalityScore,
      readabilityScore
    ] = await Promise.all([
      this.brandVoiceScorer.score(content, context.brandVoice),
      this.qualityScorer.score(content),
      this.platformScorer.score(content, context.platform),
      this.originalityScorer.score(content, context.recentContent),
      this.readabilityScorer.score(content)
    ]);
    
    // Engagement prediction (sequential, depends on brand + quality scores)
    const engagementPrediction = await this.engagementPredictor.predict({
      content,
      brandScore,
      qualityScore,
      ...context
    });
    
    // Composite score
    const overall = this.computeWeightedScore({
      brand: brandScore.overall,
      engagement: engagementPrediction.predicted_engagement_rate / 0.1, // normalize to 0-1
      quality: qualityScore.overall,
      platform: platformScore,
      originality: originalityScore,
      readability: readabilityScore
    });
    
    return {
      overall,
      components: {
        brand_voice_consistency: brandScore.overall,
        engagement_prediction: engagementPrediction.predicted_engagement_rate,
        quality_metrics: qualityScore,
        platform_optimization: platformScore,
        originality: originalityScore,
        readability: readabilityScore
      },
      engagement_prediction: engagementPrediction,
      generated_at: new Date().toISOString()
    };
  }
}
```

---

## 8. Personalization

### 8.1 Per-Workspace AI Tuning

Each workspace has a `PersonalizationProfile` that adjusts AI behavior without modifying the base model:

```typescript
interface PersonalizationProfile {
  workspace_id: string;
  version: number;
  
  // Model selection preferences
  model_preferences: {
    content_generation: string; // default model for generation
    repurposing: string; // default model for repurposing
    analysis: string; // default model for analytics
    cost_sensitivity: 'low' | 'medium' | 'high'; // affects model choice
  };
  
  // Temperature preferences (per task type)
  temperature: {
    content_generation: number; // default: 0.7
    repurposing: number; // default: 0.3 (fidelity matters)
    hashtag_generation: number; // default: 0.5
    hook_generation: number; // default: 0.8 (creativity matters)
    analysis: number; // default: 0.0 (deterministic)
  };
  
  // Template overrides
  template_customizations: {
    template_id: string;
    modifications: {
      additional_instructions?: string;
      tone_override?: Partial<ToneSpectrum>;
      length_override?: { min: number; max: number };
      custom_examples?: string[];
    };
  }[];
  
  // Learned preferences
  learned: {
    preferred_hook_types: { type: string; weight: number }[];
    preferred_cta_types: { type: string; weight: number }[];
    preferred_hashtag_count: { min: number; max: number; optimal: number };
    preferred_emoji_density: { min: number; max: number; optimal: number };
    preferred_content_length: Record<string, { min: number; max: number; optimal: number }>;
    preferred_posting_times: Record<string, string[]>;
    preferred_formats: Record<string, { format: string; weight: number }[]>;
    
    // Rejected patterns (negative weights)
    avoided_hook_types: string[];
    avoided_topics: string[];
    avoided_formats: string[];
    avoided_cta_phrases: string[];
  };
  
  // Feature flags
  features: {
    auto_hashtags: boolean;
    auto_emoji: boolean;
    auto_format: boolean;
    suggest_improvements: boolean;
    show_engagement_prediction: boolean;
    show_brand_score: boolean;
  };
}
```

### 8.2 Learning from Approved/Rejected AI Suggestions

```typescript
class PreferenceLearner {
  private min_events_for_pattern: number = 5;
  
  async recordInteraction(interaction: InteractionRecord): Promise<void> {
    // Store in episodic memory
    await this.storeInteraction(interaction);
    
    // Extract signal
    switch (interaction.user_action.action_taken) {
      case 'approved':
        await this.learnApproved(interaction);
        break;
      case 'rejected':
        await this.learnRejected(interaction);
        break;
      case 'edited':
        await this.learnFromEdit(interaction);
        break;
    }
    
    // Periodically consolidate patterns
    await this.consolidatePatterns(interaction.workspace_id);
  }
  
  private async learnApproved(interaction: InteractionRecord): Promise<void> {
    const features = this.extractFeatures(interaction.output.generated_content);
    
    // Increment approved pattern weights
    for (const [feature, value] of Object.entries(features)) {
      await this.incrementWeight(
        interaction.workspace_id,
        feature,
        value,
        0.1 // small increment per approval
      );
    }
    
    // Store as successful content embedding
    await this.vectorStore.insert({
      namespace: 'sc_',
      text: interaction.output.generated_content,
      metadata: {
        source: 'user_approval',
        platform: interaction.context.platform,
        approved_at: interaction.timestamp
      }
    });
  }
  
  private async learnRejected(interaction: InteractionRecord): Promise<void> {
    const reason = interaction.user_action.rejection_reason;
    const features = this.extractFeatures(interaction.output.generated_content);
    
    if (reason === 'tone_wrong') {
      // Adjust tone preferences away from detected tone
      const detectedTone = this.detectTone(interaction.output.generated_content);
      await this.adjustToneAway(interaction.workspace_id, detectedTone, 0.05);
    } else if (reason === 'too_long') {
      await this.adjustLengthPreference(
        interaction.workspace_id,
        'decrease',
        0.1
      );
    } else if (reason === 'too_short') {
      await this.adjustLengthPreference(
        interaction.workspace_id,
        'increase',
        0.1
      );
    }
    
    // Store as rejected pattern
    await this.vectorStore.insert({
      namespace: 'rp_',
      text: interaction.output.generated_content,
      metadata: {
        reason,
        rejected_at: interaction.timestamp
      }
    });
  }
  
  private async learnFromEdit(interaction: InteractionRecord): Promise<void> {
    const diff = this.parseDiff(interaction.user_action.edit_diff);
    
    for (const change of diff.changes) {
      // Detect what the user changed
      switch (change.type) {
        case 'tone_adjustment':
          await this.adjustToneToward(interaction.workspace_id, change.newTone, 0.15);
          break;
        case 'length_reduction':
          await this.adjustLengthPreference(interaction.workspace_id, 'decrease', 0.05);
          break;
        case 'cta_replacement':
          await this.boostCtaPattern(interaction.workspace_id, change.newCtaType, 0.2);
          break;
        case 'emoji_addition':
          await this.adjustEmojiDensity(interaction.workspace_id, 'increase', 0.05);
          break;
        case 'emoji_removal':
          await this.adjustEmojiDensity(interaction.workspace_id, 'decrease', 0.05);
          break;
        case 'hashtag_change':
          await this.adjustHashtagStrategy(interaction.workspace_id, change, 0.1);
          break;
        case 'structural_change':
          await this.boostContentStructure(interaction.workspace_id, change.newStructure, 0.1);
          break;
      }
    }
  }
}
```

### 8.3 Preference Decay

Preferences decay over time if not reinforced:

```typescript
// Decay function applied every 7 days
function decayPreferences(profile: PersonalizationProfile): PersonalizationProfile {
  const decay_rate = 0.95; // 5% decay per week
  
  for (const key of Object.keys(profile.learned.preferred_hook_types)) {
    profile.learned.preferred_hook_types[key].weight *= decay_rate;
  }
  
  // Remove preferences below threshold
  profile.learned.preferred_hook_types = profile.learned.preferred_hook_types
    .filter(h => h.weight > 0.1);
  
  return profile;
}
```

---

## 9. Privacy & Data Control

### 9.1 Data Classification

| Data Category | Examples | Sensitivity | Retention |
|---|---|---|---|
| **Workspace metadata** | Workspace ID, name, created date | Low | Until workspace deletion |
| **Brand profile** | Brand name, voice, visual identity | Medium | Until workspace deletion |
| **Content** | Generated posts, drafts, published content | Medium | Configurable (default: 2 years) |
| **Performance data** | Engagement metrics, impressions, clicks | Low | 90 days rolling |
| **User interactions** | Approvals, rejections, edits | Medium | 90 days (aggregated: 2 years) |
| **User account data** | Email, name, login | High | Until account deletion |
| **Usage patterns** | Feature usage, model preferences | Low | 13 months (GDPR) |
| **Raw content from external sources** | Scraped URLs, transcripts | Medium | Deleted after processing (7 days cache) |
| **Vector embeddings** | All embedded knowledge | Same as source | Same as source data |

### 9.2 Data Retention Policies

```typescript
interface DataRetentionPolicy {
  workspace_id: string;
  policies: RetentionRule[];
  default_policy: RetentionRule;
}

interface RetentionRule {
  data_category: string;
  retention_duration_days: number;
  aggregation_strategy: 'delete' | 'anonymize' | 'aggregate';
  on_expiry: 'auto_delete' | 'notify_user' | 'archive';
}

// Default retention policies
const DEFAULT_RETENTION: Record<string, RetentionRule> = {
  raw_content_cache: {
    data_category: 'raw_content_cache',
    retention_duration_days: 7,
    aggregation_strategy: 'delete',
    on_expiry: 'auto_delete'
  },
  episodic_interactions: {
    data_category: 'episodic_interactions',
    retention_duration_days: 90,
    aggregation_strategy: 'aggregate', // keep pattern-level, delete raw
    on_expiry: 'auto_delete'
  },
  performance_data: {
    data_category: 'performance_data',
    retention_duration_days: 90,
    aggregation_strategy: 'aggregate', // keep monthly averages
    on_expiry: 'auto_delete'
  },
  generated_content: {
    data_category: 'generated_content',
    retention_duration_days: 730, // 2 years
    aggregation_strategy: 'delete',
    on_expiry: 'notify_user'
  },
  vector_embeddings: {
    data_category: 'vector_embeddings',
    retention_duration_days: 730,
    aggregation_strategy: 'delete',
    on_expiry: 'notify_user'
  }
};
```

### 9.3 Data Deletion

```typescript
interface DataDeletionRequest {
  type: 'workspace' | 'account' | 'content' | 'interactions' | 'embeddings';
  target_id: string;
  reason?: string;
  requested_by: string;
  verified: boolean; // must be verified for full deletion
}

class DataDeletionHandler {
  async delete(request: DataDeletionRequest): Promise<DeletionResult> {
    switch (request.type) {
      case 'workspace':
        // Delete ALL data for workspace
        await this.deleteWorkspaceData(request.target_id);
        break;
      case 'account':
        // Delete user account + personal data
        // Keep workspace data (anonymized)
        await this.deleteUserAccount(request.target_id);
        break;
      case 'content':
        // Delete specific content + its embeddings
        await this.deleteContent(request.target_id);
        break;
      case 'interactions':
        // Delete interaction history (keep aggregated patterns)
        await this.deleteInteractions(request.target_id);
        break;
      case 'embeddings':
        // Delete all vector embeddings
        await this.deleteEmbeddings(request.target_id);
        break;
    }
    
    await this.logDeletion(request);
    
    return {
      deleted: true,
      deleted_at: new Date().toISOString(),
      categories_affected: [request.type],
      data_remaining: this.verifyDeletion(request)
    };
  }
  
  private async deleteWorkspaceData(workspace_id: string): Promise<void> {
    await Promise.all([
      this.db.query('DELETE FROM embeddings WHERE workspace_id = $1', [workspace_id]),
      this.db.query('DELETE FROM content_library WHERE workspace_id = $1', [workspace_id]),
      this.db.query('DELETE FROM brand_profiles WHERE workspace_id = $1', [workspace_id]),
      this.db.query('DELETE FROM audience_insights WHERE workspace_id = $1', [workspace_id]),
      this.db.query('DELETE FROM learning_events WHERE workspace_id = $1', [workspace_id]),
      this.db.query('DELETE FROM workspaces WHERE id = $1', [workspace_id])
    ]);
  }
}
```

### 9.4 Opt-Out Controls

| Control | Effect | Implementation |
|---|---|---|
| Opt out of learning | Stop personalization from interactions | Set `learning_enabled = false` in workspace |
| Opt out of performance tracking | Stop collecting engagement data | Disable analytics connection |
| Export all data | Download all workspace data | Generate JSON export |
| Delete AI history | Remove all generated content and embeddings | Trigger deletion per retention policy |
| Disable AI suggestions | Turn off AI content generation | Feature flag |
| Limit data retention | Custom retention period | Override in workspace settings |

### 9.5 Model Training Opt-In

```typescript
interface ModelTrainingOptIn {
  workspace_id: string;
  opted_in: boolean;
  opted_in_at?: string;
  scope: 'none' | 'anonymized_only' | 'full_with_attribution';
  data_types_allowed: ('content' | 'interactions' | 'performance' | 'brand_profile')[];
  revocable: boolean; // always true by design
  revoked_at?: string;
}

// Default: ALL workspaces are opted OUT of model training
const DEFAULT_TRAINING_OPT_IN: ModelTrainingOptIn = {
  workspace_id: '',
  opted_in: false,
  scope: 'none',
  data_types_allowed: [],
  revocable: true
};
```

---

## 10. Implementation Guide

### 10.1 Technology Stack

| Component | Technology | Version | Notes |
|---|---|---|---|
| Vector database | pgvector | 0.7+ | PostgreSQL extension |
| PostgreSQL | PostgreSQL | 15+ | Primary database |
| Embedding model | text-embedding-3-small | Latest | OpenAI — 1536 dimensions, $0.02/1M tokens |
| Alternative embedding | text-embedding-3-large | Latest | 3072 dimensions, higher accuracy, $0.13/1M tokens |
| Self-hosted embedding | BGE-M3 | Latest | BAAI, free, 1024 dimensions |
| Session cache | Redis | 7+ | TTL-based expiry |
| Cross-encoder re-ranker | ms-marco-MiniLM-L-6-v2 | Latest | Local, fast re-ranking |
| ORM | Drizzle ORM / Prisma | Latest | Type-safe database access |
| Queue system | BullMQ / Redis | Latest | Batch processing |
| Object storage | S3-compatible | — | Content assets |
| Monitoring | Prometheus + Grafana | Latest | Performance observability |

### 10.2 pgvector Setup

```bash
# 1. Install pgvector extension
# On Ubuntu/Debian:
sudo apt install postgresql-15-pgvector

# On Mac:
brew install pgvector

# On Docker:
# Add to Dockerfile: RUN apt-get install -y postgresql-15-pgvector

# 2. Enable extension
psql -d yourdb -c "CREATE EXTENSION vector;"

# 3. Verify
psql -d yourdb -c "SELECT extname, extversion FROM pg_extension WHERE extname = 'vector';"

# Output:
#  extname | extversion
# ---------+------------
#  vector  | 0.7.0
```

### 10.3 Indexing Strategy

```sql
-- HNSW Index (Recommended)
-- Best for: Most workloads
-- Pros: Fast query, high recall, no training required
-- Cons: Slower index build, more memory

CREATE INDEX idx_embeddings_hnsw ON embeddings
  USING hnsw (embedding vector_cosine_ops)
  WITH (m = 16, ef_construction = 200);

-- Parameter tuning:
-- m = 16: Default, good balance (range: 4-100)
-- ef_construction = 200: Higher = better recall, slower build (range: 100-800)

-- Query-time ef_search (set per connection):
SET hnsw.ef_search = 100; -- Higher = better recall, slower (default: 40)


-- IVFFlat Index (Alternative, for very large datasets)
-- Best for: 1M+ vectors, memory-constrained
-- Pros: Lower memory, faster build
-- Cons: Requires training, lower recall than HNSW

-- Step 1: Create index with probes parameter
CREATE INDEX idx_embeddings_ivfflat ON embeddings
  USING ivfflat (embedding vector_cosine_ops)
  WITH (lists = 100);

-- Step 2: Set query-time probes
SET ivfflat.probes = 10; -- Higher = better recall, slower (default: 1)
```

### 10.4 Embedding Generation Pipeline

```typescript
class EmbeddingPipeline {
  private client: OpenAIClient;
  private batch_size: number = 20; // API max batch
  
  async generateEmbedding(text: string, model: string = 'text-embedding-3-small'): Promise<number[]> {
    const response = await this.client.embeddings.create({
      model,
      input: text,
      dimensions: 1536
    });
    
    return response.data[0].embedding;
  }
  
  async batchGenerate(texts: string[], model: string = 'text-embedding-3-small'): Promise<number[][]> {
    // Process in batches of 20 (OpenAI API limit)
    const batches = this.chunkArray(texts, this.batch_size);
    const results: number[][] = [];
    
    for (const batch of batches) {
      const response = await this.client.embeddings.create({
        model,
        input: batch,
        dimensions: 1536
      });
      
      results.push(...response.data.map(d => d.embedding));
      
      // Rate limit: 5000 RPM for text-embedding-3-small
      await this.sleep(0.05); // 50ms between batches
    }
    
    return results;
  }
  
  // Chunking strategy for long documents
  chunkContent(content: string, strategy: ChunkConfig): Chunk[] {
    switch (strategy.strategy) {
      case 'fixed_size':
        return this.fixedSizeChunks(content, strategy.chunk_size, strategy.overlap);
      case 'sentence':
        return this.sentenceChunks(content, strategy.max_chunk_size);
      case 'semantic':
        return this.semanticChunks(content, strategy);
      case 'heading':
        return this.headingChunks(content);
    }
  }
  
  // Default chunk configuration for different content types
  getChunkConfig(contentType: string): ChunkConfig {
    const configs: Record<string, ChunkConfig> = {
      'blog_post': { strategy: 'heading', max_chunk_size: 512 },
      'social_post': { strategy: 'sentence', max_chunk_size: 256 },
      'video_transcript': { strategy: 'semantic', max_chunk_size: 512, min_chunk_size: 128 },
      'brand_profile': { strategy: 'fixed_size', chunk_size: 512, overlap: 50 },
      'audience_insight': { strategy: 'sentence', max_chunk_size: 128 }
    };
    
    return configs[contentType] || configs.blog_post;
  }
}
```

### 10.5 Batch Update Pipeline

```typescript
class BatchUpdatePipeline {
  private batchSize: number = 50;
  private concurrency: number = 4;
  
  async processBackfill(workspace_id: string): Promise<BackfillResult> {
    // 1. Load all existing content
    const content = await this.loadAllContent(workspace_id);
    
    // 2. Check what's already embedded
    const embedded = await this.getEmbeddedContentIds(workspace_id);
    const toProcess = content.filter(c => !embedded.has(c.id));
    
    // 3. Process in batches
    const batches = this.chunkArray(toProcess, this.batchSize);
    let processed = 0;
    let failed = 0;
    
    for (const batch of batches) {
      try {
        // Generate embeddings
        const texts = batch.map(c => c.content);
        const embeddings = await this.embeddingPipeline.batchGenerate(texts);
        
        // Insert into vector store
        const records = batch.map((c, i) => ({
          workspace_id,
          namespace: this.getNamespace(c),
          embedding: embeddings[i],
          chunk_text: c.content,
          chunk_hash: this.hashContent(c.content),
          source_content_id: c.id,
          metadata: {
            content_type: c.content_type,
            platform: c.platform,
            engagement_rate: c.engagement_rate
          }
        }));
        
        await this.vectorStore.batchInsert(records);
        processed += batch.length;
      } catch (error) {
        failed += batch.length;
        await this.logError(workspace_id, batch, error);
      }
    }
    
    return { processed, failed, total: content.length };
  }
  
  async incrementalUpdate(workspace_id: string): Promise<void> {
    // Run every 5 minutes (cron job)
    
    // 1. Find new content since last run
    const lastRun = await this.getLastRunTime(workspace_id);
    const newContent = await this.getContentSince(workspace_id, lastRun);
    
    if (newContent.length === 0) return;
    
    // 2. Generate and store embeddings
    const embeddings = await this.embeddingPipeline.batchGenerate(
      newContent.map(c => c.content)
    );
    
    const records = newContent.map((c, i) => ({
      workspace_id,
      namespace: this.getNamespace(c),
      embedding: embeddings[i],
      chunk_text: c.content,
      chunk_hash: this.hashContent(c.content),
      source_content_id: c.id,
      metadata: {
        content_type: c.content_type,
        platform: c.platform,
        created_at: c.created_at
      },
      recency_factor: 1.0 // new content gets max recency
    }));
    
    await this.vectorStore.batchInsert(records);
    
    // 3. Update last run time
    await this.setLastRunTime(workspace_id, new Date());
  }
  
  async updatePerformanceScores(workspace_id: string): Promise<void> {
    // Update engagement scores on existing embeddings
    // Run hourly
    
    const highPerfContent = await this.getHighPerformanceContent(workspace_id, 0.05);
    const lowPerfContent = await this.getLowPerformanceContent(workspace_id, 0.005);
    
    // Boost high-performing content embeddings
    for (const content of highPerfContent) {
      await this.vectorStore.updateScore(content.id, {
        engagement_score: Math.min(1.0, content.engagement_rate / 0.1)
      });
    }
    
    // Reduce low-performing content embeddings
    for (const content of lowPerfContent) {
      await this.vectorStore.updateScore(content.id, {
        engagement_score: content.engagement_rate / 0.1
      });
    }
  }
}
```

### 10.6 Redis Session Schema

```redis
# Session Memory Keys

# Session data (hash)
HSET session:{session_id}
  workspace_id "{workspace_id}"
  created_at "{iso_timestamp}"
  expires_at "{iso_timestamp}"
  tokens_used "{count}"
  api_calls "{count}"
  estimated_cost "{usd}"

# Session events (sorted set by timestamp)
ZADD session:{session_id}:events
  {timestamp} "{event_json}"

# Active context (string, JSON blob)
SET session:{session_id}:context "{json_context}" EX 3600

# Pending decisions (list)
RPUSH session:{session_id}:decisions "{decision_json}"

# Cached brand profile (string, JSON blob)
SET cache:brand:{workspace_id} "{json_profile}" EX 300
```

### 10.7 Monitoring & Observability

```typescript
interface MemorySystemMetrics {
  // Retrieval performance
  retrieval_p50_ms: number;
  retrieval_p95_ms: number;
  retrieval_p99_ms: number;
  retrieval_cache_hit_rate: number;
  retrieval_recall_at_5: number;
  retrieval_recall_at_10: number;
  
  // Embedding pipeline
  embedding_throughput_per_minute: number;
  embedding_latency_p50_ms: number;
  embedding_error_rate: number;
  embedding_cost_per_day_usd: number;
  
  // Database
  vector_db_query_time_p50_ms: number;
  vector_db_index_size_mb: number;
  vector_db_total_vectors: number;
  vector_db_namespace_sizes: Record<string, number>;
  
  // Learning loop
  patterns_extracted_per_day: number;
  patterns_applied_per_day: number;
  approval_rate: number; // user approval rate
  edit_rate: number; // how often users edit generated content
  
  // Storage
  total_storage_mb: number;
  embeddings_storage_mb: number;
  content_library_size: number;
  episodic_memory_size: number;
}
```

### 10.8 Quick Start Deployment

```bash
# 1. PostgreSQL + pgvector
docker run -d \
  --name postgres-pgvector \
  -e POSTGRES_PASSWORD=password \
  -e POSTGRES_DB=socialos \
  -p 5432:5432 \
  pgvector/pgvector:pg15

# 2. Redis
docker run -d \
  --name redis \
  -p 6379:6379 \
  redis:7-alpine

# 3. Run migrations
npm run db:migrate

# 4. Initialize embeddings schema
psql -h localhost -U postgres -d socialos -f schema.sql

# 5. Set OpenAI API key
export OPENAI_API_KEY="sk-..."

# 6. Start the application
npm run dev

# 7. Verify everything is connected
curl http://localhost:3000/api/v1/health
# Expected: { "status": "ok", "vector_store": "connected", "redis": "connected", "db": "connected" }
```

### 10.9 Embedding Model Comparison

| Model | Dimensions | Cost / 1M tokens | Quality | Latency | Self-Hostable | Use Case |
|---|---|---|---|---|---|---|
| text-embedding-3-small | 1536 | $0.02 | High | Fast | No | Default, general purpose |
| text-embedding-3-large | 3072 | $0.13 | Highest | Fast | No | High-accuracy, enterprise |
| BGE-M3 | 1024 | Free | High | Fast | Yes | Self-hosted, privacy-first |
| ada-002 (legacy) | 1536 | $0.10 | Medium | Fast | No | Migration only |
| Cohere embed-english-v3 | 1024 | $0.10 | High | Fast | No | Enterprise |
| jina-embeddings-v3 | 1024 | Free | High | Medium | Yes | Self-hosted |
| instructor-xl | 768 | Free | High | Slow | Yes | Research, academic |

**Recommendation:** Start with `text-embedding-3-small` for production. If budget allows and accuracy requirements increase, switch to `text-embedding-3-large`. For privacy-sensitive deployments, use `BGE-M3` self-hosted.
