# Content Repurposing Engine

**Module:** 07 — AI Engine
**Document:** 02 — Content Repurposing Engine
**Version:** 1.0.0
**Last Updated:** 2026-07-22

---

## Table of Contents

1. [Architecture Overview](#1-architecture-overview)
2. [Supported Transformations](#2-supported-transformations)
3. [Content Extraction](#3-content-extraction)
4. [Format Adaptation Rules](#4-format-adaptation-rules)
5. [Pipeline Design](#5-pipeline-design)
6. [Quality Control](#6-quality-control)
7. [Repurposing Templates](#7-repurposing-templates)
8. [Batch Processing](#8-batch-processing)
9. [Human-in-the-Loop](#9-human-in-the-loop)

---

## 1. Architecture Overview

### 1.1 System Diagram

```
┌─────────────────────────────────────────────────────────────┐
│                    INGESTION LAYER                           │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌────────────┐  │
│  │ URL Grab │  │ PDF Parser│  │ Transcript│  │ Manual Paste│  │
│  └────┬─────┘  └────┬─────┘  └────┬─────┘  └──────┬──────┘  │
│       │              │              │               │         │
│       └──────────────┴──────────────┴───────────────┘         │
│                              │                                │
│                      ┌───────▼────────┐                      │
│                      │ Source Normalizer│                     │
│                      │ (strip, dedupe, │                      │
│                      │  classify type) │                      │
│                      └───────┬────────┘                      │
└──────────────────────────────┼──────────────────────────────┘
                               │
                               ▼
┌─────────────────────────────────────────────────────────────┐
│                    TRANSFORMATION LAYER                       │
│                                                                │
│  ┌──────────────────────────────────────────────────────┐     │
│  │              Pipeline Orchestrator                    │     │
│  │  (Selects template, resolves dependencies, queues ops)│     │
│  └───────────────────┬──────────────────────────────────┘     │
│                      │                                        │
│         ┌────────────┼────────────┐                           │
│         ▼            ▼            ▼                           │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐                    │
│  │ LLM Call  │  │ LLM Call │  │ LLM Call │  ... (parallel)   │
│  │ (Type A)  │  │ (Type B) │  │ (Type C) │                    │
│  └────┬─────┘  └────┬─────┘  └────┬─────┘                    │
│       │              │              │                         │
│       └──────────────┴──────────────┘                         │
│                      │                                        │
│                      ▼                                        │
│              ┌───────────────┐                                │
│              │ Cache Layer    │                                │
│              │ (intermediate  │                                │
│              │  results)      │                                │
│              └───────┬───────┘                                │
└──────────────────────┼────────────────────────────────────────┘
                       │
                       ▼
┌─────────────────────────────────────────────────────────────┐
│                    QUALITY CONTROL LAYER                      │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌────────────┐  │
│  │ Character │  │ Link     │  │ Media    │  │ Tone       │  │
│  │ Limit     │  │ Preserve │  │ Match    │  │ Check      │  │
│  └────┬─────┘  └────┬─────┘  └────┬─────┘  └──────┬──────┘  │
│       │              │              │               │         │
│       └──────────────┴──────────────┴───────────────┘         │
│                              │                                │
│                      ┌───────▼────────┐                      │
│                      │ Output Assembly │                     │
│                      └───────┬────────┘                      │
└──────────────────────────────┼────────────────────────────────┘
                               │
                               ▼
┌─────────────────────────────────────────────────────────────┐
│                    OUTPUT LAYER                               │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌────────────┐  │
│  │ Save to  │  │ Schedule │  │ Review   │  │ Export to  │  │
│  │ Drafts   │  │ for Post │  │ Queue    │  │ Platform   │  │
│  └──────────┘  └──────────┘  └──────────┘  └────────────┘  │
└─────────────────────────────────────────────────────────────┘
```

### 1.2 Core Design Principles

1. **Source-Normalized Architecture** — Every source is normalized to a canonical intermediate format before transformation. Transformations never read raw sources directly.
2. **Pipeline-as-Data** — Each repurposing job is a directed acyclic graph (DAG) of transformation steps, serialized as JSON.
3. **Idempotent Transformations** — Running the same transformation twice with identical inputs produces identical outputs (temperature=0 for repurposing).
4. **Cascade-Aware** — The system tracks which content is derived from which source. Updates to a source can trigger cascading regeneration.
5. **Cost-Optimized Model Selection** — Each transformation step uses the cheapest model capable of the required quality.

### 1.3 Canonical Intermediate Format (CIF)

Every source is normalized into a CIF document before transformation:

```json
{
  "cif_version": "1.0",
  "source_type": "blog_post",
  "source_url": "https://example.com/blog/post",
  "extracted_at": "2026-07-22T10:30:00Z",
  "metadata": {
    "title": "10 Email Marketing Tips",
    "author": "Jane Doe",
    "publish_date": "2026-07-20",
    "word_count": 1450,
    "reading_time_minutes": 6,
    "language": "en",
    "estimated_grade_level": 8
  },
  "content": {
    "title": "10 Email Marketing Tips for 2026",
    "subtitle": "What actually works this year",
    "sections": [
      {
        "heading": "Introduction",
        "body": "Email marketing has changed...",
        "type": "text"
      },
      {
        "heading": "Tip 1: Personalize Beyond Names",
        "body": "Most marketers stop at first names...",
        "type": "text",
        "bullets": ["Use behavioral data", "Segment by purchase history"]
      }
    ],
    "key_points": [
      "Personalization beyond names increases CTR by 41%",
      "Send timing depends on audience behavior"
    ],
    "statistics": [
      {"value": "41%", "context": "CTR increase from behavioral personalization"}
    ],
    "quotes": [
      {"text": "Email is dead? Tell that to the \$4.2B annual revenue it drives.", "speaker": "Author"}
    ],
    "tone_characteristics": {
      "formality": 6,
      "humor": 3,
      "authority": 7
    }
  },
  "media": {
    "images": [
      {"url": "https://example.com/img/chart1.png", "alt_text": "CTR comparison chart", "type": "chart"}
    ],
    "embeds": [],
    "featured_image": "https://example.com/img/hero.png"
  },
  "links": {
    "internal": ["https://example.com/related-post"],
    "external": ["https://reference.com/study"]
  }
}
```

---

## 2. Supported Transformations

### 2.1 Transformation Matrix

| Source ↓ / Target → | LinkedIn Post | Twitter Thread | IG Caption | IG Carousel | TikTok Script | YT Shorts | Newsletter | Pinterest Pins | Blog Post |
|---|---|---|---|---|---|---|---|---|---|
| **Blog Post** | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | — |
| **LinkedIn Post** | — | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| **Twitter Thread** | ✅ | — | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| **IG Caption** | ✅ | ✅ | — | ✅ | ✅ | ✅ | ✅ | ✅ | — |
| **IG Carousel** | ✅ | ✅ | ✅ | — | ✅ | ✅ | ✅ | ✅ | ✅ |
| **TikTok Script** | ✅ | ✅ | ✅ | ✅ | — | ✅ | ✅ | ✅ | ✅ |
| **Video Transcript** | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| **Podcast Transcript** | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| **Newsletter** | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | — | ✅ | ✅ |
| **URL/Web Page** | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| **PDF Document** | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |

### 2.2 Transformation Rules Detail

#### 2.2.1 Blog Post → LinkedIn Post

| Rule | Specification |
|---|---|
| **Max length** | 1,200 characters (LinkedIn optimal) |
| **Structure** | Hook → personal take → key insight → supporting point → discussion question → hashtags |
| **Tone shift** | More personal, opinionated, conversational |
| **Hashtags** | 3-5 industry hashtags |
| **Link handling** | Include link to full blog post in "I wrote more here" format |
| **Paragraphs** | 2-3 sentences max per paragraph |
| **Opening** | Question, bold statement, or personal story |
| **Closing** | Discussion question to drive comments |
| **Media** | Suggest one relevant image/graphic from blog |

#### 2.2.2 Blog Post → Twitter Thread

| Rule | Specification |
|---|---|
| **Tweets per thread** | 5-10 (configurable) |
| **Characters per tweet** | 280 max (measured post-rendering) |
| **Tweet 1** | Hook — most surprising/valuable claim from blog |
| **Tweet 2-N-1** | One insight per tweet |
| **Last tweet** | CTA to read full blog post |
| **Numbering** | Every tweet numbered (1/8, 2/8...) |
| **Thread indicators** | 🧵 or 👇 in first tweet |
| **Link placement** | Only in last tweet |
| **Hashtags** | 1 per tweet max, 0 recommended for high-value threads |
| **Quote handling** | Pull quotes as standalone tweets |
| **Visuals** | Suggest which blog images to attach per tweet |

#### 2.2.3 Blog Post → Instagram Caption

| Rule | Specification |
|---|---|
| **Max length** | 150-300 characters (caption); rest in first comment |
| **First line** | Under 25 characters, hard hook |
| **Emojis** | 2-4 |
| **Line breaks** | 3-4 line breaks for scannability |
| **Hashtags in caption** | 3-5 |
| **Hashtags in first comment** | 20-30 (maximum) |
| **CTA** | Save, share, comment, or link in bio |
| **Link handling** | "Link in bio" (Instagram does not support clickable links in captions) |
| **Visual suggestion** | Extract or suggest graphic from blog |
| **Tone** | More casual, inspirational, or educational |

#### 2.2.4 Blog Post → Instagram Carousel

| Rule | Specification |
|---|---|
| **Slide count** | 5-10 slides recommended |
| **Slide 1 (Cover)** | Under 10 words, makes them swipe |
| **Content slides** | One idea per slide, under 60 characters |
| **Slide N-1** | CTA slide |
| **Slide N** | About/bio slide |
| **Visual per slide** | Describe visual concept for each slide |
| **Font/typography** | Bold primary text, smaller secondary text |
| **Color scheme** | Suggest brand-compatible palette per carousel |
| **Caption for carousel** | Separate caption (see IG Caption rules) |

#### 2.2.5 Blog Post → TikTok Script

| Rule | Specification |
|---|---|
| **Duration** | 15, 30, or 60 seconds |
| **Hook** | First 2 seconds — visual + audio + text |
| **Pacing** | New visual every 2-3 seconds |
| **Text overlay** | 3-5 words per frame, bold, high contrast |
| **Script structure** | Hook → Body (problem, solution, proof) → CTA |
| **Tone** | Raw, authentic, conversational |
| **Hashtags** | 2-3 in caption |
| **Audio suggestion** | Trending sound or original audio recommendation |
| **Format suggestion** | Green screen, text-on-screen, transition, or POV |

#### 2.2.6 Blog Post → Newsletter

| Rule | Specification |
|---|---|
| **Subject line** | Under 60 characters, creates curiosity |
| **Preview text** | Under 100 characters, completes subject |
| **Structure** | Greeting → hook → key insight → actionable takeaway → deeper dive link → sign-off |
| **Length** | 300-500 words |
| **Personalization** | {{first_name}} or audience greeting |
| **Links** | Full blog URL, related resources |
| **CTA** | Single primary action |
| **P.S.** | Personal touch or additional resource (highest read section) |
| **Footer** | Unsubscribe, social links, address (required by CAN-SPAM) |

#### 2.2.7 Blog Post → Pinterest Pins

| Rule | Specification |
|---|---|
| **Pins per blog** | 3-5 (different angles) |
| **Pin title** | Under 100 characters, keyword-rich |
| **Pin description** | 200-400 characters with URL + 2-5 hashtags |
| **Aspect ratio** | 2:3 vertical (1000x1500px recommended) |
| **Text overlay** | Bold, readable, includes title |
| **Keywords** | Front-load description with SEO keywords |
| **Angles** | How-to, list, problem-solution, resource, inspiration |

#### 2.2.8 Video Transcript → Blog Post

| Rule | Specification |
|---|---|
| **Filler removal** | Strip um, uh, you know, like, basically, actually |
| **Written conversion** | Convert spoken grammar to written grammar |
| **Structure** | Title → meta description → intro → sections with H2 → key quotes → conclusion → CTA |
| **Word count** | 800-2,000 words (configurable) |
| **Pull quotes** | Extract 2-3 quotable moments |
| **Data sourcing** | Add citations where statistics are mentioned |
| **Timestamps** | Remove timestamps from body; include in metadata |
| **SEO** | Generate title and meta description from transcript content |

---

## 3. Content Extraction

### 3.1 Extraction Pipeline

```
Raw Source → Content Extractor → Cleaner → CIF Builder → CIF Document
```

### 3.2 Extraction Methods

#### 3.2.1 URL Scraping

| Component | Technology | Config |
|---|---|---|
| HTTP fetcher | Playwright (JS-rendered) / native fetch | Timeout: 15s, retries: 3 |
| HTML parser | Readability algorithm / Mozilla Readability | Strip scripts, styles, nav |
| Metadata extractor | Open Graph tags, JSON-LD, meta tags | Title, description, image, author, date |
| Content cleaner | Custom rules | Remove ads, related posts, comments, footers |
| Image extractor | src attribute analyzer | Download? configurable, max 5 images |

```json
{
  "url_extraction_config": {
    "fetch": {
      "timeout_ms": 15000,
      "retries": 3,
      "user_agent": "SocialMediaOS/1.0 ContentRepurposer",
      "javascript_enabled": true,
      "wait_for_selector": "article, main, .post-content, .entry-content",
      "screenshot": false
    },
    "extraction": {
      "selectors": {
        "article_content": "article, [role='main'], .post-content, .entry-content",
        "title_selectors": "h1, meta[property='og:title'], .entry-title",
        "date_selectors": "time, meta[property='article:published_time'], .post-date",
        "author_selectors": ".author, meta[name='author'], .byline"
      },
      "exclude_selectors": [
        ".advertisement", ".related-posts", ".comments", 
        ".social-share", "nav", ".sidebar", "footer", "header"
      ]
    },
    "storage": {
      "cache_html": true,
      "cache_ttl_hours": 24,
      "extract_images": true,
      "image_max_count": 5,
      "image_min_width": 400
    }
  }
}
```

#### 3.2.2 PDF Parsing

| Component | Technology | Config |
|---|---|---|
| PDF extractor | pdf.js (Mozilla) / pdf-parse | Extract text layer |
| Structure analysis | Heading detection via font size/weight | Map to CIF sections |
| Table detection | PDF table parser | Convert to markdown tables |
| Image extraction | pdf.js image layer | Extract images with metadata |
| Metadata | PDF info fields | Title, author, subject, keywords |

```json
{
  "pdf_extraction_config": {
    "engine": "pdfjs",
    "options": {
      "extract_text": true,
      "extract_images": true,
      "extract_tables": true,
      "preserve_layout": false,
      "heading_threshold_ratio": 1.3,
      "max_pages": 50
    }
  }
}
```

#### 3.2.3 Video Transcript Extraction (YouTube)

| Component | Technology | Config |
|---|---|---|
| Transcript fetch | YouTube Data API v3 / youtube-transcript | Auto-generated or manual captions |
| Timestamp parsing | Regex HH:MM:SS,mmm | Clean to CIF format |
| Speaker detection | ML model (if multi-speaker) | Speaker diarization |
| Segment grouping | Topic segmentation algorithm | Group by section |

```json
{
  "youtube_transcript_config": {
    "api": "youtube_transcript_api",
    "preferred_caption_tracks": ["en", "en-US", "en-GB"],
    "fallback_to_auto_generated": true,
    "include_timestamps": false,
    "segment_by_topic": true,
    "max_duration_minutes": 120
  }
}
```

#### 3.2.4 Audio Transcription (Whisper)

| Component | Technology | Config |
|---|---|---|
| File format support | mp3, wav, m4a, ogg, flac, aac, wma | Convert to 16kHz WAV internally |
| Transcription engine | Whisper (local) / Whisper API | Tiny, base, small, medium, large-v3 |
| Language detection | Whisper auto-detect | Fallback to specified |
| Speaker diarization | pyannote-audio (optional) | Enable for multi-speaker |
| Punctuation restoration | Whisper + custom model | Automatic |
| Chunking | Voice activity detection | Chunk at silence boundaries |

```json
{
  "whisper_config": {
    "model_size": "large-v3",
    "device": "auto", 
    "compute_type": "float16",
    "language": null,
    "beam_size": 5,
    "best_of": 5,
    "temperature": 0.0,
    "condition_on_previous_text": true,
    "compression_ratio_threshold": 2.4,
    "logprob_threshold": -1.0,
    "no_speech_threshold": 0.6
  },
  "diarization": {
    "enabled": false,
    "min_speakers": 1,
    "max_speakers": 10
  }
}
```

### 3.3 CIF Builder Rules

The CIF Builder assembles the canonical document from extracted content:

```typescript
interface CIFBuilderConfig {
  rules: {
    deduplicate_paragraphs: boolean;
    merge_consecutive_headings: boolean;
    preserve_ordered_lists: boolean;
    bullet_to_section_threshold: number; // if 3+ consecutive bullets, create sections array
    statistic_patterns: RegExp[]; // patterns like /\d+%/, /\$\d+(\.\d+)?[MBK]/
    quote_patterns: RegExp[]; // patterns for blockquotes, "text" attribution
    tone_analysis: boolean; // run tone classifier on content
    max_sections: number; // truncate to 20 max
  };
  enrichments: {
    extract_key_points: boolean; // use LLM to extract key points
    generate_summary: boolean; // generate 1-2 sentence summary
    estimate_reading_time: boolean; // words / 200
    grade_level_detection: boolean; // Flesch-Kincaid on sample
  };
}
```

---

## 4. Format Adaptation Rules

### 4.1 Platform Profiles

Each platform is defined by a configuration object that drives adaptation:

```json
{
  "instagram": {
    "display_name": "Instagram",
    "type": "visual_social",
    "content_types": ["image", "video", "carousel", "story", "reel"],
    "constraints": {
      "caption_max_chars": 2200,
      "caption_optimal_chars": {"min": 100, "max": 300},
      "first_comment_max_chars": 2200,
      "hashtags_max": 30,
      "hashtags_in_caption_optimal": 5,
      "image_aspect_ratios": ["1:1", "4:5", "16:9"],
      "video_max_duration_seconds": 90,
      "video_max_size_mb": 650,
      "carousel_max_slides": 10,
      "bio_max_chars": 150
    },
    "tone": {
      "default": "inspirational_educational",
      "allowed_range": {"formality": [2, 7], "humor": [2, 8], "emotion": [5, 10]}
    },
    "emoji_density": {"min": 1, "max": 5, "optimal": 3},
    "link_support": "bio_only",
    "algorithm_factors": [
      "saves_weighted_highly",
      "shares_to_dms",
      "dwell_time",
      "completion_rate_for_video",
      "recency"
    ],
    "best_practices": [
      "First line of caption must hook within 25 chars",
      "Use line breaks every 2-3 sentences",
      "Place bulk hashtags in first comment",
      "Post carousels for maximum reach",
      "Reply to comments within 1 hour for algorithmic boost",
      "Use location tags when relevant"
    ]
  },
  "linkedin": {
    "display_name": "LinkedIn",
    "type": "professional_network",
    "content_types": ["text", "image", "video", "article", "poll", "document"],
    "constraints": {
      "post_max_chars": 3000,
      "post_optimal_chars": {"min": 900, "max": 1200},
      "hashtags_max": 30,
      "hashtags_optimal": 5,
      "image_aspect_ratios": ["1:1", "4:5", "16:9"],
      "video_max_duration_seconds": 600,
      "video_max_size_mb": 75,
      "article_max_chars": 125000,
      "headline_max_chars": 220
    },
    "tone": {
      "default": "professional_insightful",
      "allowed_range": {"formality": [5, 9], "humor": [1, 4], "authority": [6, 10]}
    },
    "emoji_density": {"min": 0, "max": 2, "optimal": 1},
    "link_support": "inline_url",
    "algorithm_factors": [
      "early_engagement_rate",
      "dwell_time",
      "comment_quality",
      "post_shared_as_pdf",
      "author_credibility_signals"
    ],
    "best_practices": [
      "Open with a question or bold statement",
      "Short paragraphs of 2-3 sentences",
      "Share personal stories and professional lessons",
      "Use line breaks generously",
      "End with a discussion question",
      "Tag relevant people and companies (but don't over-tag)"
    ]
  },
  "x_twitter": {
    "display_name": "X (Twitter)",
    "type": "microblogging",
    "content_types": ["text", "image", "video", "poll", "thread"],
    "constraints": {
      "post_max_chars": 280,
      "premium_post_max_chars": 25000,
      "thread_max_tweets": 50,
      "hashtags_max": 30,
      "hashtags_optimal": 1,
      "image_max_count": 4,
      "video_max_duration_seconds": 140,
      "video_max_size_mb": 512
    },
    "tone": {
      "default": "conversational_witty",
      "allowed_range": {"formality": [1, 5], "humor": [3, 9], "emotion": [3, 8]}
    },
    "emoji_density": {"min": 0, "max": 2, "optimal": 1},
    "link_support": "inline_url (auto-shortened)",
    "algorithm_factors": [
      "engagement_to_follower_ratio",
      "recency_weighted_highly",
      "reply_engagement",
      "verified_status_boost",
      "media_attachments_boost"
    ],
    "best_practices": [
      "Front-load value in first 50 characters",
      "Every word must earn its place",
      "Thread for long-form content",
      "Use polls for quick engagement",
      "Tag relevant accounts for amplification",
      "Include media for 3x engagement boost"
    ]
  },
  "tiktok": {
    "display_name": "TikTok",
    "type": "short_form_video",
    "content_types": ["video", "photo_mode", "story"],
    "constraints": {
      "caption_max_chars": 2200,
      "caption_optimal_chars": {"min": 100, "max": 200},
      "hashtags_max": 30,
      "hashtags_optimal": 3,
      "video_max_duration_seconds": 600,
      "video_optimal_duration_seconds": {"min": 15, "max": 60},
      "video_aspect_ratio": "9:16"
    },
    "tone": {
      "default": "authentic_casual",
      "allowed_range": {"formality": [1, 3], "humor": [4, 10], "emotion": [4, 9]}
    },
    "emoji_density": {"min": 2, "max": 6, "optimal": 4},
    "link_support": "bio_and_live_only",
    "algorithm_factors": [
      "completion_rate",
      "rewatches",
      "shares",
      "follows_from_video",
      "trending_sound_usage",
      "text_overlay_engagement"
    ],
    "best_practices": [
      "First 2 seconds must hook immediately",
      "Fast visual pacing — new frame every 2-3 seconds",
      "Use trending sounds and effects",
      "Text overlay for silent viewing",
      "Authenticity over production value",
      "End with continuation CTA ('follow for part 2')"
    ]
  },
  "youtube_shorts": {
    "display_name": "YouTube Shorts",
    "type": "short_form_video",
    "content_types": ["video"],
    "constraints": {
      "caption_max_chars": 500,
      "hashtags_max": 15,
      "hashtags_optimal": 3,
      "video_max_duration_seconds": 60,
      "video_aspect_ratio": "9:16",
      "shorts_title_max_chars": 100
    },
    "tone": {
      "default": "educational_entertaining",
      "allowed_range": {"formality": [2, 5], "humor": [3, 8], "authority": [4, 7]}
    },
    "emoji_density": {"min": 1, "max": 4, "optimal": 2},
    "link_support": "description_and_endscreen",
    "algorithm_factors": [
      "session_time",
      "swipe_away_rate",
      "like_to_view_ratio",
      "subscribe_conversion",
      "shorts_shelf_performance"
    ],
    "best_practices": [
      "Loop-friendly (end connects to beginning)",
      "Captions on screen at all times",
      "Fast cuts — new visual every 2-3 seconds",
      "Bold hooks in first 3 seconds",
      "Series/playlist for binge-watching",
      "#Shorts in title or description"
    ]
  },
  "pinterest": {
    "display_name": "Pinterest",
    "type": "visual_discovery",
    "content_types": ["pin", "video_pin", "story_pin", "carousel_pin"],
    "constraints": {
      "description_max_chars": 500,
      "description_optimal_chars": {"min": 200, "max": 400},
      "title_max_chars": 100,
      "hashtags_max": 20,
      "hashtags_optimal": 5,
      "image_aspect_ratios": ["2:3", "1:1"],
      "video_max_duration_seconds": 600,
      "board_max_pins": 500000
    },
    "tone": {
      "default": "aspirational_informational",
      "allowed_range": {"formality": [2, 6], "humor": [2, 7], "emotion": [3, 8]}
    },
    "emoji_density": {"min": 0, "max": 3, "optimal": 1},
    "link_support": "required_clicable_link",
    "algorithm_factors": [
      "pin_recency",
      "board_relevance",
      "click_through_rate",
      "save_rate",
      "domain_authority",
      "creator_quality_score"
    ],
    "best_practices": [
      "Vertical pins perform 2x better than square",
      "Text overlay on images is essential",
      "Front-load description with keywords",
      "Rich pins (product, recipe, article) get priority",
      "Fresh pins weekly recommended",
      "Group in relevant, keyword-optimized boards"
    ]
  },
  "threads": {
    "display_name": "Threads",
    "type": "microblogging",
    "content_types": ["text", "image", "video"],
    "constraints": {
      "post_max_chars": 500,
      "hashtags_max": 10,
      "hashtags_optimal": 2,
      "image_max_count": 10,
      "video_max_duration_seconds": 300
    },
    "tone": {
      "default": "casual_conversational",
      "allowed_range": {"formality": [1, 4], "humor": [4, 9], "emotion": [3, 8]}
    },
    "emoji_density": {"min": 1, "max": 4, "optimal": 2},
    "link_support": "inline_url",
    "best_practices": [
      "Casual, conversational tone",
      "Cross-reference Instagram aesthetic",
      "Use reply-bait (questions, hot takes, polls)",
      "Shorter than Twitter threads",
      "Engage in trending conversations",
      "Don't over-post — quality over frequency"
    ]
  }
}
```

### 4.2 Tone Adaptation Profiles

Each transformation includes a tone adaptation step that adjusts the source's natural tone to the target platform's expected tone:

| Platform | Default Tone | Formality | Humor | Emotion | Authority |
|---|---|---|---|---|---|
| Instagram | Inspirational/Educational | 4/10 | 5/10 | 7/10 | 5/10 |
| LinkedIn | Professional/Insightful | 7/10 | 2/10 | 5/10 | 8/10 |
| X/Twitter | Conversational/Witty | 3/10 | 7/10 | 6/10 | 4/10 |
| TikTok | Authentic/Casual | 2/10 | 8/10 | 7/10 | 3/10 |
| YouTube Shorts | Educational/Entertaining | 4/10 | 6/10 | 6/10 | 6/10 |
| Pinterest | Aspirational/Informational | 4/10 | 4/10 | 6/10 | 5/10 |
| Threads | Casual/Conversational | 3/10 | 7/10 | 6/10 | 3/10 |
| Newsletter | Direct/Personal | 5/10 | 4/10 | 5/10 | 6/10 |

---

## 5. Pipeline Design

### 5.1 Pipeline DAG Architecture

Each repurposing job is a directed acyclic graph (DAG) of transformation steps:

```json
{
  "job_id": "repurpose_abc123",
  "source_cif_id": "cif_def456",
  "source_type": "blog_post",
  "targets": ["linkedin", "twitter_thread", "instagram_caption"],
  "pipeline": {
    "nodes": [
      {
        "id": "extract_key_points",
        "type": "llm_extraction",
        "model": "gpt-4o-mini",
        "depends_on": [],
        "config": { "extraction_type": "key_points", "max_points": 5 }
      },
      {
        "id": "generate_summary",
        "type": "llm_generation",
        "model": "gpt-4o-mini",
        "depends_on": ["extract_key_points"],
        "config": { "target_length": "50_words" }
      },
      {
        "id": "linkedin_post",
        "type": "transformation",
        "model": "gpt-4o",
        "depends_on": ["extract_key_points", "generate_summary"],
        "config": { "target": "linkedin", "template": "blog_to_linkedin" }
      },
      {
        "id": "twitter_thread",
        "type": "transformation",
        "model": "gpt-4o",
        "depends_on": ["extract_key_points"],
        "config": { "target": "twitter_thread", "tweet_count": 8 }
      },
      {
        "id": "instagram_caption",
        "type": "transformation",
        "model": "gpt-4o-mini",
        "depends_on": ["generate_summary"],
        "config": { "target": "instagram_caption", "hashtag_count": 25 }
      }
    ],
    "execution_order": ["parallel", "sequential"]
  }
}
```

### 5.2 Execution Strategies

#### 5.2.1 Sequential Execution

Use when outputs depend on previous steps (e.g., thread build-up, carousel slides that reference each other):

```
Step 1 → Step 2 → Step 3 → Step 4
```

Best for:
- Threads (each tweet references previous)
- Carousels (each slide builds on previous)
- Storytelling sequences

#### 5.2.2 Parallel Execution

Use when outputs are independent:

```
Step 1 ─┬→ Step 2
         ├→ Step 3
         └→ Step 4
```

Best for:
- Same source to multiple platforms
- Multiple hashtag sets
- Multiple tone variations

#### 5.2.3 Hybrid (DAG) Execution

The default — shared intermediate steps execute once, platform-specific steps execute in parallel:

```
          ┌→ LinkedIn Post
Source ──→┤→ Twitter Thread
          ├→ IG Caption
          └→ Newsletter
```

### 5.3 Dependency Graph Resolution

```typescript
interface PipelineStep {
  id: string;
  type: 'extraction' | 'transformation' | 'validation' | 'post_processing';
  model: string;
  depends_on: string[];
  config: Record<string, any>;
}

class PipelineOrchestrator {
  resolve(dag: PipelineStep[]): ExecutionPlan {
    // 1. Topological sort to determine order
    // 2. Group independent steps for parallel execution
    // 3. Assign models based on cost + quality requirements
    // 4. Estimate token usage and cost
    // 5. Return ExecutablePlan
  }
  
  execute(plan: ExecutionPlan): PipelineResult {
    // 1. Execute steps in dependency order
    // 2. Cache intermediate results keyed by (source_hash + step_config)
    // 3. On failure: retry (3 attempts), then fail gracefully
    // 4. Track costs per step
    // 5. Return results + metadata
  }
}
```

### 5.4 Caching Strategy

| Cache Level | Key | TTL | Storage |
|---|---|---|---|
| Source normalization | `sha256(raw_content)` | 7 days | Redis/disk |
| LLM extraction | `sha256(cif_document + extraction_config)` | 24 hours | Redis |
| Transformation | `sha256(cif_document + target + platform_config)` | 12 hours | Redis |
| Validation | `sha256(output + validation_rules)` | No cache | — |

Cache invalidation:
- Manual: User clicks "Regenerate"
- Automatic: Source updated (webhook or re-scrape)
- TTL expiry: Configurable per transformation type

### 5.5 Cost Optimization

| Source Complexity | Recommended Model | Cost per 1K Transformations |
|---|---|---|
| Simple (under 500 words, one topic) | GPT-4o-mini | ~$0.50 |
| Medium (500-2000 words, multiple sections) | GPT-4o | ~$3.00 |
| Complex (2000+ words, data, quotes, structure) | Claude 3.5 Sonnet | ~$5.00 |
| Extract-only (no generation, just parse) | GPT-4o-mini | ~$0.15 |
| Hashtag generation | GPT-4o-mini | ~$0.05 |

---

## 6. Quality Control

### 6.1 Validation Pipeline

```
Raw Output → Character Limit Check → Link Preservation → Media Match → Tone Check → Structure Validation → Score
```

### 6.2 Character Limit Enforcement

```typescript
interface CharacterLimitValidator {
  platform: string;
  max_chars: number;
  optimal_min: number;
  optimal_max: number;
  
  validate(output: string): ValidationResult {
    const length = [...output].length; // Unicode-aware length
    const isWithinLimit = length <= this.max_chars;
    const isWithinOptimal = length >= this.optimal_min && length <= this.optimal_max;
    
    return {
      passed: isWithinLimit,
      length,
      warnings: isWithinOptimal ? [] : [`Length ${length} outside optimal range ${this.optimal_min}-${this.optimal_max}`]
    };
  }
  
  // Auto-truncation with intelligence:
  // - Forced truncation: Cut at last complete sentence within limit
  // - Smart truncation: Remove lowest-value paragraph/section to fit
  truncate(output: string, strategy: 'force' | 'smart'): string;
}
```

### 6.3 Link Preservation Rules

| Source Content | Target Requirement | Action |
|---|---|---|
| Blog URL | LinkedIn post | Include as inline link with "I wrote more here" |
| Blog URL | Instagram caption | Convert to "Link in bio" + add to bio bookmark |
| Blog URL | Twitter thread | Include only in last tweet |
| Blog URL | TikTok script | Only mention if relevant, no direct link |
| External references | All platforms | Preserve URLs; convert to short links if needed |
| Internal cross-links | All platforms | Keep, route through tracking parameters |

### 6.4 Media Matching

```typescript
interface MediaMatchRule {
  sourceMedia: MediaAsset[];
  targetPlatform: string;
  targetContent: string; // the generated text
  
  // Match algorithm:
  // 1. Extract topics/keywords from generated content
  // 2. Score each source media asset for relevance
  // 3. Rank by relevance score
  // 4. Recommend top 1-3 media items
  // 5. If no good match, suggest stock photo keywords
  
  match(): MediaSuggestion[];
}

interface MediaSuggestion {
  sourceUrl: string;
  relevanceScore: number; // 0-1
  matchReason: string;
  platformRequirements: { aspectRatio?: string; maxSize?: number };
  fallbackKeywords: string[]; // for stock photo search
}
```

### 6.5 Tone Consistency Check

```typescript
interface ToneValidator {
  brandVoice: BrandVoiceProfile;
  targetPlatformTone: PlatformToneProfile;
  threshold: number; // minimum consistency score 0-1
  
  check(output: string): ToneResult {
    // 1. Extract tone features from output
    // 2. Compare against brand voice (weighted 70%)
    // 3. Compare against platform tone (weighted 30%)
    // 4. Compute overall consistency score
    // 5. Flag specific phrases that deviate
    // 6. Return result
  }
  
  suggestFixes(deviations: ToneDeviation[]): string[];
}
```

### 6.6 Structure Validation

Each target has a required structure that is validated:

| Target | Required Structure Elements |
|---|---|
| LinkedIn post | Hook, paragraph breaks, line spacing, question, hashtags |
| Twitter thread | Numbered tweets, hook in tweet 1, CTA in last tweet |
| Instagram caption | Hook, line breaks, emojis, CTA, hashtags |
| Instagram carousel | Slide titles, visual descriptions, cover slide, CTA slide |
| TikTok script | Timestamps, visual cues, audio cues, text overlays |
| Newsletter | Subject line, preview text, greeting, body, sign-off, footer |

### 6.7 Quality Score

```
Quality Score = w1 * CharacterLimitScore + w2 * LinkPreservationScore 
              + w3 * ToneConsistencyScore + w4 * StructureScore
              + w5 * ReadabilityScore + w6 * BrandVoiceAdherenceScore

Weights: w1=0.15, w2=0.10, w3=0.25, w4=0.15, w5=0.10, w6=0.25
Threshold: >= 0.8 for auto-publish, >= 0.6 for review queue, < 0.6 for rejection
```

---

## 7. Repurposing Templates

### 7.1 Template: Blog Post to Social Media Blitz

**Use case:** Repurpose a single blog post across all major platforms in one operation.

```json
{
  "template_id": "blog_to_social_blitz",
  "name": "Blog Post → Social Media Blitz",
  "description": "Transform a blog post into content for every major social platform",
  "source_type": "blog_post",
  "targets": [
    {"platform": "linkedin", "type": "post"},
    {"platform": "x_twitter", "type": "thread", "tweet_count": 8},
    {"platform": "instagram", "type": "caption"},
    {"platform": "instagram", "type": "carousel", "slide_count": 8},
    {"platform": "tiktok", "type": "script", "duration_seconds": 30},
    {"platform": "youtube_shorts", "type": "script", "duration_seconds": 45},
    {"platform": "newsletter", "type": "email"},
    {"platform": "pinterest", "type": "pins", "pin_count": 4}
  ],
  "pipeline_config": {
    "extraction_steps": [
      {"id": "key_points", "model": "gpt-4o-mini"},
      {"id": "summary", "model": "gpt-4o-mini"},
      {"id": "quotes", "model": "gpt-4o-mini"},
      {"id": "statistics", "model": "gpt-4o-mini"}
    ],
    "execution_plan": "hybrid",
    "quality_threshold": 0.7,
    "cost_optimization": true,
    "batch_size": 4
  },
  "estimated_run_time_seconds": 45,
  "estimated_cost_usd": 0.35,
  "output_format": "individual_drafts"
}
```

### 7.2 Template: Single Source to Same Platform Multi-Format

**Use case:** Create multiple content formats from one source for a single platform.

```json
{
  "template_id": "single_platform_multi_format",
  "name": "Single Platform Multi-Format",
  "description": "Create multiple content formats for one platform from a single source",
  "source_type": "any",
  "targets": [
    {"platform": "instagram", "type": "caption"},
    {"platform": "instagram", "type": "carousel", "slide_count": 6},
    {"platform": "instagram", "type": "story_script", "story_count": 3},
    {"platform": "instagram", "type": "reel_script", "duration_seconds": 15}
  ],
  "pipeline_config": {
    "extraction_steps": [
      {"id": "key_points", "model": "gpt-4o-mini"},
      {"id": "visual_suggestions", "model": "gpt-4o-mini"}
    ],
    "execution_plan": "sequential",
    "quality_threshold": 0.8,
    "cost_optimization": false
  },
  "estimated_run_time_seconds": 30,
  "estimated_cost_usd": 0.25
}
```

### 7.3 Template: Video to All Text Formats

**Use case:** Maximize a video's reach by converting it to text-based content.

```json
{
  "template_id": "video_to_text",
  "name": "Video → All Text Formats",
  "description": "Transform a video transcript into blog posts, social posts, and newsletters",
  "source_type": "video_transcript",
  "targets": [
    {"platform": "blog", "type": "article", "word_count": 1200},
    {"platform": "linkedin", "type": "post"},
    {"platform": "x_twitter", "type": "thread", "tweet_count": 10},
    {"platform": "instagram", "type": "caption"},
    {"platform": "newsletter", "type": "email"},
    {"platform": "linkedin", "type": "article", "word_count": 800}
  ],
  "pipeline_config": {
    "preprocessing": {
      "remove_fillers": true,
      "speaker_diarize": true,
      "segment_by_topic": true
    },
    "extraction_steps": [
      {"id": "transcript_clean", "model": "gpt-4o-mini"},
      {"id": "key_moments", "model": "gpt-4o"},
      {"id": "quotes_extraction", "model": "gpt-4o-mini"}
    ],
    "execution_plan": "hybrid",
    "quality_threshold": 0.7,
    "cost_optimization": true
  },
  "estimated_run_time_seconds": 60,
  "estimated_cost_usd": 0.50
}
```

### 7.4 Template: Podcast to Social Clips Kit

**Use case:** Extract shareable moments from a podcast episode.

```json
{
  "template_id": "podcast_to_clips",
  "name": "Podcast → Social Clips Kit",
  "description": "Extract shareable moments from a podcast episode and format for each platform",
  "source_type": "podcast_transcript",
  "targets": [
    {"platform": "x_twitter", "type": "quote_post", "clip_count": 3},
    {"platform": "linkedin", "type": "post"},
    {"platform": "instagram", "type": "reel_script", "duration_seconds": 30},
    {"platform": "tiktok", "type": "script", "duration_seconds": 30},
    {"platform": "newsletter", "type": "episode_summary"}
  ],
  "pipeline_config": {
    "preprocessing": {
      "speaker_diarize": true,
      "remove_fillers": true,
      "timestamp_segment": true
    },
    "extraction_steps": [
      {"id": "clip_candidates", "model": "gpt-4o", "config": {"min_clips": 5}},
      {"id": "guest_info", "model": "gpt-4o-mini"},
      {"id": "episode_summary", "model": "gpt-4o-mini"}
    ],
    "execution_plan": "hybrid",
    "quality_threshold": 0.75,
    "cost_optimization": true
  },
  "estimated_run_time_seconds": 50,
  "estimated_cost_usd": 0.40
}
```

### 7.5 Template: Newsletter from Multiple Sources

**Use case:** Curate content from multiple sources into a single newsletter.

```json
{
  "template_id": "curated_newsletter",
  "name": "Curated Newsletter from Multiple Sources",
  "description": "Combine multiple content pieces into a curated newsletter edition",
  "source_type": "multi_source",
  "targets": [
    {"platform": "newsletter", "type": "email"}
  ],
  "source_config": {
    "max_sources": 8,
    "source_types": ["blog_post", "video_transcript", "social_post", "url"],
    "curation_style": "editorial_picks"
  },
  "pipeline_config": {
    "preprocessing": {
      "deduplicate": true,
      "relevance_rank": true
    },
    "extraction_steps": [
      {"id": "per_source_summary", "model": "gpt-4o-mini"},
      {"id": "curation_theme", "model": "gpt-4o"},
      {"id": "entropy_ranking", "model": "claude-3-haiku"}
    ],
    "structure": {
      "greeting": "personalized",
      "featured_section": {"source_count": 1, "style": "deep_dive"},
      "quick_hits": {"source_count": 3, "style": "bullets"},
      "closing": "curated_picks"
    },
    "execution_plan": "sequential",
    "quality_threshold": 0.8,
    "cost_optimization": false
  },
  "estimated_run_time_seconds": 40,
  "estimated_cost_usd": 0.45
}
```

---

## 8. Batch Processing

### 8.1 Queue Architecture

```
┌─────────────┐    ┌─────────────┐    ┌─────────────┐
│  Job Queue    │───▶│ Worker Pool   │───▶│ Result Store │
│  (Redis)      │    │ (4-8 workers) │    │ (Postgres)   │
└─────────────┘    └─────────────┘    └─────────────┘
       │                                      │
       │                              ┌───────▼───────┐
       │                              │ Progress Store │
       │                              │ (Redis + PG)   │
       │                              └───────────────┘
       │
       ▼
┌─────────────┐
│ WebSocket    │
│ (Real-time   │
│  progress)   │
└─────────────┘
```

### 8.2 Job Lifecycle

```
CREATED → QUEUED → PROCESSING → COMPLETED
                     │               │
                     ├→ FAILED       ├→ PARTIAL
                     │               │
                     └→ CANCELLED    └→ ALL_FAILED
```

### 8.3 Queue Management

```typescript
interface BatchJob {
  job_id: string;
  status: 'queued' | 'processing' | 'completed' | 'failed' | 'cancelled' | 'partial';
  workspace_id: string;
  created_at: string;
  priority: 1 | 2 | 3; // 1 = highest
  source: SourceConfig;
  targets: TargetConfig[];
  template_id?: string;
  
  progress: {
    total_steps: number;
    completed_steps: number;
    failed_steps: number;
    current_step: string;
    estimated_time_remaining_seconds: number;
  };
  
  results: {
    successful: TransformationResult[];
    failed: TransformationError[];
    partial: {
      step_id: string;
      partial_output: string;
      error: string;
    }[];
  };
  
  cost_tracking: {
    total_tokens_used: number;
    estimated_cost_usd: number;
    per_model: Record<string, { tokens: number; cost: number }>;
  };
  
  cancellation: {
    requested_at?: string;
    cancelled_at?: string;
    cancelled_by?: string;
    reason?: string;
  };
}
```

### 8.4 Progress Tracking

Events emitted via WebSocket at each state change:

```json
{
  "event": "job.progress",
  "job_id": "batch_abc123",
  "data": {
    "completed_steps": 4,
    "total_steps": 12,
    "current_step": "linkedin_post",
    "percent": 33,
    "estimated_remaining_seconds": 25,
    "recent_outputs": [
      {"step": "key_points", "status": "completed", "tokens_used": 350},
      {"step": "twitter_thread", "status": "completed", "tokens_used": 890}
    ]
  }
}
```

### 8.5 Cancellation

```typescript
interface CancellationHandler {
  cancel(job_id: string): CancelResult;
  
  // Strategy:
  // 1. Mark job as cancelled in queue
  // 2. If currently processing:
  //    a. Complete current LLM call (cannot interrupt mid-generation)
  //    b. Skip remaining steps
  // 3. Return partial results for completed steps
  //    (never discard work already done)
  // 4. Log cancellation reason
  // 5. Credit back any unused prepaid credits
}
```

### 8.6 Partial Results

When a job fails or is cancelled mid-execution, partial results are preserved:

```json
{
  "job_id": "batch_abc123",
  "status": "partial",
  "completed_outputs": [
    {
      "target": "linkedin",
      "type": "post",
      "content": "Full LinkedIn post content...",
      "completed_at": "2026-07-22T10:32:15Z"
    },
    {
      "target": "x_twitter",
      "type": "thread",
      "content": "Full thread content...",
      "completed_at": "2026-07-22T10:32:45Z"
    }
  ],
  "remaining_targets": [
    "instagram_caption",
    "newsletter"
  ],
  "resume_token": "resume_abc123_20260722T103300"
}
```

Partial results can be:
- Published as-is (user approves individual items)
- Merged with a future batch when the failing source is fixed
- Discarded and retried

---

## 9. Human-in-the-Loop

### 9.1 Review Workflow

```
Transformation Complete
        │
        ▼
  ┌──────────┐
  │ Quality   │── Auto-Pass (score >= 0.8, brand-compliant, no issues)
  │ Gate      │── Auto-Fail (score < 0.6 or critical rule violation)
  └──────────┘
        │
    Needs Review
        │
        ▼
  ┌──────────┐
  │  Review   │── Approve → Queue for Publishing
  │  Queue    │── Edit → Modified Draft → Re-submit to QC
  └──────────┘── Reject → Discard / Send Feedback
```

### 9.2 Approval Workflow Integration

```typescript
interface ApprovalWorkflow {
  stages: ApprovalStage[];
  current_stage: number;
  required_approvers: string[];
  optional_approvers?: string[];
  
  // Stage Types:
  // 'single' — any one approver can approve
  // 'all' — all approvers must approve
  // 'chain' — sequential approvals required
  
  advance(stage_result: 'approve' | 'edit' | 'reject'): void;
  
  // On approval:
  // → Move to next stage or mark as fully approved
  // → Send to publishing queue with scheduled time
  
  // On edit:
  // → Return to user with inline editing interface
  // → Re-run QC after edit
  // → Return to review queue
  
  // On reject:
  // → Move to rejected list
  // → Notify creator with reason
  // → Offer regenerate with feedback option
}
```

### 9.3 Editing Interface

The human-in-the-loop editing step provides:

1. **Side-by-side view** — Original source content next to generated output
2. **Inline editing** — Click-to-edit any generated text
3. **Tone adjustment slider** — Modify tone (more/less formal, more/less humorous)
4. **Length adjustment** — Extend or shorten content
5. **Platform preview** — See how content will render on target platform
6. **Version comparison** — Compare edited version with original generation
7. **One-click approve** — Accept all changes and move to publishing

### 9.4 Feedback Loop

User actions in the review queue feed back into the AI:

```typescript
interface FeedbackEvent {
  transformation_id: string;
  action: 'approved' | 'edited' | 'rejected';
  edits?: {
    original_text: string;
    edited_text: string;
    edit_type: 'tone' | 'length' | 'structure' | 'factual' | 'other';
  };
  rejection_reason?: string;
  timestamp: string;
  user_id: string;
}

// Feedback is used to:
// 1. Fine-tune prompt templates per user/workspace
// 2. Adjust model parameters (temperature, top_p)
// 3. Update brand voice profile (if specific tone edits repeat)
// 4. Train a lightweight adapter model (for enterprise tier)
// 5. Improve quality scoring weights
```

### 9.5 Schedule & Publish Integration

```
Approved Content
    │
    ▼
┌─────────────────────┐
│  Publishing Queue    │
│  ┌─────────────────┐ │
│  │ Scheduled: 3    │ │
│  │ Drafts: 5       │ │
│  │ Publishing: 1   │ │
│  └─────────────────┘ │
└─────────────────────┘
    │
    ├──→ Immediate publish
    ├──→ Schedule for date/time
    ├──→ Save as draft (platform native)
    └──→ Export as CSV/JSON
```

### 9.6 Notification Events

| Event | Trigger | Channel |
|---|---|---|
| Transformation complete | Job finished | In-app, email |
| Review needed | QC score 0.6-0.8 | In-app, push |
| Approved | User approved | In-app |
| Edited | User made changes | Log only |
| Rejected | User rejected | In-app, optional email to creator |
| Published | Content went live | In-app, platform notification |
| Failed | Job error | In-app, email |
| Cancelled | User cancelled | In-app |
