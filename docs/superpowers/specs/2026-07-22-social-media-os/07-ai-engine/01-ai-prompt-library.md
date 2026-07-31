# AI Prompt Library

**Module:** 07 — AI Engine
**Document:** 01 — AI Prompt Library
**Version:** 1.0.0
**Last Updated:** 2026-07-22

---

## Table of Contents

1. [Prompt Architecture](#1-prompt-architecture)
2. [Content Generation Prompts](#2-content-generation-prompts)
3. [Content Improvement Prompts](#3-content-improvement-prompts)
4. [Content Repurposing Prompts](#4-content-repurposing-prompts)
5. [Analytics & Insights Prompts](#5-analytics--insights-prompts)
6. [Brand & Strategy Prompts](#6-brand--strategy-prompts)
7. [Engagement Prompts](#7-engagement-prompts)

---

## 1. Prompt Architecture

### 1.1 Template System

All prompts use Handlebars-style `{{variable}}` injection with typed parameters. The template engine resolves variables at runtime before sending to the LLM.

```
template: "write a {{tone}} caption about {{topic}} for {{platform}}"
resolved: "write a humorous caption about coffee brewing for Instagram"
```

### 1.2 Variable Types

| Type | Prefix | Example | Validation |
|---|---|---|---|
| String | `s_` | `{{s_topic}}` | Non-empty, trimmed |
| Number | `n_` | `{{n_max_length}}` | Integer or float |
| Boolean | `b_` | `{{b_include_cta}}` | true/false |
| Enum | `e_` | `{{e_platform}}` | Must match allowed values |
| Array | `a_` | `{{a_keywords}}` | Comma-joined at render |
| Object | `o_` | `{{o_brand_voice}}` | JSON-serialized |

### 1.3 Model-Specific Formatting

The system includes a model adapter layer that reformats prompts per model family:

| Model Family | Format | System Prompt | Max Tokens | Temperature Range |
|---|---|---|---|---|
| GPT-4o | ChatML with `system`/`user` roles | Supported | 128K | 0.0-1.0 |
| GPT-4o-mini | ChatML with `system`/`user` roles | Supported | 128K | 0.0-1.0 |
| Claude 3.5 Sonnet | Messages API | Supported | 200K | 0.0-1.0 |
| Claude 3 Haiku | Messages API | Supported | 200K | 0.0-1.0 |
| Gemini 1.5 Pro | Google chat format | Supported | 1M | 0.0-1.0 |
| Llama 3 70B | Llama chat template | Via system | 8K | 0.0-0.8 |

Adapter responsibilities:
- Wrap content in correct message roles
- Strip unsupported parameters
- Translate system prompts to model-native format
- Enforce per-model token limits
- Apply temperature and top_p constraints

### 1.4 Versioning

Each prompt carries a semantic version:

```
v2.3.1
├── major: breaking changes to output structure
├── minor: new features, non-breaking additions
└── patch: fixes, refinements, token optimization
```

Prompts are stored in a versioned registry:

```
/prompts/
  content-generation/
    short-caption/
      v1.0.0.json
      v1.1.0.json
      v2.0.0.json
      latest -> v2.0.0.json
  content-improvement/
    ...
```

### 1.5 Execution Pipeline

```
User Request
  → Template Selection (version pinned or latest)
  → Variable Injection
  → Model Adapter Format
  → LLM Call
  → Output Parser
  → Validation (schema, length, platform rules)
  → Return to caller
```

### 1.6 Output Parsing

Each prompt template declares an output schema:

```json
{
  "output_schema": {
    "type": "object",
    "properties": {
      "caption": { "type": "string" },
      "hashtags": { "type": "array", "items": { "type": "string" } },
      "cta": { "type": "string" }
    },
    "required": ["caption"]
  }
}
```

The parser extracts structured data using:
- JSON mode (when model supports it)
- Regex extraction (fallback)
- Schema validation before returning

---

## 2. Content Generation Prompts

### 2.1 Short Caption Generator

**Purpose:** Generate platform-optimized short-form captions for Instagram, Facebook, and X/Twitter.

**Model Compatibility:** All models (optimized for GPT-4o-mini / Claude 3 Haiku for cost efficiency)

**Template:**

```
You are an expert social media copywriter. Write {{n_variations}} short caption{{#if b_include_hashtags}} with hashtags{{/if}} for {{e_platform}}.

Topic: {{s_topic}}
Tone: {{e_tone}}
Target audience: {{s_audience}}
Max characters: {{n_max_chars}}
Key message: {{s_key_message}}
{{#if a_emojis}}Preferred emojis: {{a_emojis}}{{/if}}

Platform requirements for {{e_platform}}:
{{platform_requirements e_platform}}

Brand voice guidelines:
{{o_brand_voice}}

Return each variation as a numbered list. For each variation include:
1. The caption text
2. {{#if b_include_hashtags}}3-5 hashtags{{/if}}
{{#if b_include_cta}}3. A call to action{{/if}}
```

**Example Output:**

Instagram, tone=inspirational, topic="morning routine"

```
1. ✨ Your morning routine isn't a checklist — it's a ceremony. How you start sets the tone for everything that follows. What's one ritual you never skip? 🧘‍♀️

   #MorningRoutine #MindfulLiving #SelfCareDaily #Rituals #WellnessJourney

   CTA: Double-tap if your mornings are sacred. 💫

2. The first hour of your day is the foundation of everything else. Build it intentionally. What's your non-negotiable morning practice? ☀️

   #MorningWins #DailyRituals #IntentionalLiving #MorningMagic #StartStrong

   CTA: Save this for morning inspiration.
```

**Platform-Specific Instructions:**

| Platform | Max Chars | Hashtag Count | Emoji Usage |
|---|---|---|---|
| Instagram | 2,200 | 20-30 (in caption or first comment) | Moderate |
| Facebook | 63,206 | 1-3 | Moderate |
| X/Twitter | 280 (free) / 25,000 (Premium) | 1-2 | Light |
| Threads | 500 | 1-3 | Moderate |
| TikTok (caption) | 2,200 | 3-5 | Heavy |

---

### 2.2 Long-Form Post (LinkedIn, Blog)

**Purpose:** Generate structured long-form posts optimized for LinkedIn publishing or blog articles.

**Model Compatibility:** GPT-4o, Claude 3.5 Sonnet (preferred for depth and coherence)

**Template:**

```
You are a content strategist specializing in {{e_platform}} long-form content. Write a complete {{e_content_type}} on the following topic.

TOPIC: {{s_topic}}
ANGLE: {{s_angle}}
TONE: {{e_tone}}
TARGET READER: {{s_audience}}
KEY POINTS: {{a_key_points}}
WORD COUNT TARGET: {{n_word_count}}
{{#if s_seo_keyword}}PRIMARY SEO KEYWORD: {{s_seo_keyword}}{{/if}}
{{#if a_call_to_action}}DESIRED CTA: {{a_call_to_action}}{{/if}}

STRUCTURE REQUIREMENTS:
- Hook (first 2 lines must grab attention)
- Context / Problem statement (2-3 paragraphs)
- Solution / Insights (3-5 paragraphs with subheadings)
- Evidence / Examples (1-2 paragraphs)
- Conclusion with call to action

{{#if e_platform '===' 'linkedin'}}
LinkedIn best practices:
- Use line breaks generously (short paragraphs of 2-3 sentences)
- Open with a question or bold statement
- Include a personal story element
- End with a discussion question to drive comments
- Add 3-5 relevant hashtags at the bottom
- Keep paragraphs scannable
{{/if}}

{{#if e_platform '===' 'blog'}}
Blog best practices:
- Include an H1 title at the top
- Use H2 and H3 subheadings throughout
- Include a meta description (under 160 characters)
- Add a table of contents for posts over 1500 words
- Use bullet points and numbered lists
- Include a "key takeaways" summary section
{{/if}}

BRAND VOICE:
{{o_brand_voice}}
```

**Example Output:**

```
LinkedIn post, tone=thought-leadership, topic="remote team culture"

---

The 4-day workweek isn't about working less. It's about working *smarter*.

I spent 18 months running experiments with our 47-person distributed team. The results surprised me.

**What we tested:**
→ 4-day workweek (Monday-Thursday)
→ 4.5-day (Friday until noon)
→ 5-day with Wednesday as "deep work only"
→ Async-first with no meeting Wednesdays

**The winner surprised everyone...**
```

---

### 2.3 Thread Generator (X/Twitter)

**Purpose:** Create multi-tweet threads optimized for X/Twitter engagement.

**Model Compatibility:** GPT-4o, Claude 3.5 Sonnet

**Template:**

```
You are a Twitter thread expert. Create a thread of {{n_tweet_count}} tweets on the topic below.

TOPIC: {{s_topic}}
ANGLE: {{s_angle}}
TONE: {{e_tone}}
TARGET AUDIENCE: {{s_audience}}
KEY POINTS TO COVER: {{a_key_points}}
{{#if s_hook}}HOOK IDEA: {{s_hook}}{{/if}}

RULES:
- Each tweet must be under 280 characters
- Tweet 1 must be a powerful hook
- Tweets 2 through {{subtract n_tweet_count 1}} build the argument/story
- Last tweet must include a CTA
- Number each tweet (1/7, 2/7, etc.)
- Include 1-2 relevant hashtags
- Add engaging questions to drive replies
- Space out the thread naturally — don't cram all info into first 3 tweets
- Each tweet should make people want to read the next one

THREAD STRUCTURE:
1/ Hook (provocative question, surprising stat, bold claim)
2/ Context (why this matters now)
3-{{subtract n_tweet_count 3}}/ Body (evidence, examples, data points)
{{subtract n_tweet_count 2}}/ Counterpoint or objection handling
{{subtract n_tweet_count 1}}/ Summary of key insight
{{n_tweet_count}}/ CTA (retweet, reply, follow, link)

{{#if o_brand_voice}}BRAND VOICE: {{o_brand_voice}}{{/if}}
```

**Example Output:**

Topic: "Building in public", 7 tweets

```
1/7
Most founders hide their failures.

The ones who share them build unstoppable audiences.

Here's why "building in public" is the smartest marketing you'll ever do: 🧵

2/7
The old playbook:
→ Launch quietly
→ Hope people notice
→ Spend $10k on ads

The new playbook:
→ Share the messy middle
→ Let people root for you
→ Your audience becomes your distribution

3/7
When I started sharing revenue numbers publicly:
→ Trust went up
→ Inbound DMs went up 10x
→ People started offering to help for free

Transparency compounds.
```

---

### 2.4 Carousel Copy (Instagram Carousel)

**Purpose:** Generate slide-by-slide copy for Instagram carousel posts.

**Model Compatibility:** GPT-4o, Claude 3.5 Sonnet, Gemini 1.5 Pro

**Template:**

```
You are a top-performing Instagram carousel copywriter. Create copy for a {{n_slide_count}}-slide carousel post.

TOPIC: {{s_topic}}
FORMAT TYPE: {{e_carousel_format}} (options: educational, listicle, storytelling, comparison, before/after, step-by-step)
TONE: {{e_tone}}
TARGET AUDIENCE: {{s_audience}}
KEY MESSAGE: {{s_key_message}}
CTA GOAL: {{s_cta_goal}}

SLIDE STRUCTURE:
Slide 1 — Cover slide (title + hook, no more than 10 words)
Slide 2 — Problem statement or context
Slide 3-{{subtract n_slide_count 3}} — Core content (one idea per slide)
Slide {{subtract n_slide_count 2}} — Key insight or main takeaway
Slide {{subtract n_slide_count 1}} — CTA slide
Slide {{n_slide_count}} — About us / bio slide (optional)

RULES:
- Each slide copy must be under 80 characters (leave room for visuals)
- Slide 1 must make them swipe
- Every slide should work as a standalone visual
- Use numbers, stats, and specific data points
- End every slide mid-thought to encourage the next swipe
- Include emoji markers for visual hierarchy

For educational format: use "Myth vs Fact" or "Did You Know" framing
For listicle format: number each item
For storytelling format: each slide advances the narrative
For comparison format: use clear before/after or option A/B
For step-by-step: number each step clearly

BRAND VOICE:
{{o_brand_voice}}
```

**Example Output:**

Educational carousel, 8 slides, topic="email marketing"

```
Slide 1: 5 Email Myths Costing You Sales 💸
Slide 2: Myth 1: "Email is dead" 📧
→ Reality: $36 ROI for every $1 spent
Slide 3: Myth 2: "Long emails don't work" 📝
→ Reality: 3-minute reads get 72% higher CTR
Slide 4: Myth 3: "Send at 10 AM Tuesday" ⏰
→ Reality: Best time depends on YOUR audience
Slide 5: Myth 4: "More emails = more sales" 📊
→ Reality: Quality over quantity — 2x/week max
Slide 6: Myth 5: "Subject lines don't matter" 🎯
→ Reality: 47% of opens depend on subject lines
Slide 7: The Real Strategy 🧠
→ Test everything. Trust data. Write for humans.
Slide 8: Follow for more email tips 🔔
```

---

### 2.5 Video Script (TikTok, Reels, Shorts)

**Purpose:** Generate short-form vertical video scripts optimized for platform-specific engagement patterns.

**Model Compatibility:** GPT-4o, Claude 3.5 Sonnet

**Template:**

```
You are a viral video scriptwriter for {{e_platform}}. Write a {{s_duration}}-second video script.

TOPIC: {{s_topic}}
HOOK STYLE: {{e_hook_style}} (question, statement, stat, controversy, curiosity gap)
TONE: {{e_tone}}
TARGET AUDIENCE: {{s_audience}}
CTA: {{s_cta}}

{{#if e_platform '===' 'tiktok'}}
TikTok best practices:
- First 2 seconds must hook
- Fast pacing, energetic delivery
- Text overlay on screen (3-5 words max per frame)
- Trending audio reference if applicable: {{s_trending_audio}}
- Use popular format: green screen, stitch, POV, transition
- Caption should complement, not repeat, the video
{{/if}}

{{#if e_platform '===' 'instagram_reels'}}
Reels best practices:
- First 2 seconds: visual hook
- Clean, aesthetic visual style
- Text overlays with captions for accessibility
- Aspect ratio 9:16
- 15-30 seconds optimal for reach
- Use trending Reels audio
{{/if}}

{{#if e_platform '===' 'youtube_shorts'}}
Shorts best practices:
- First 2-3 seconds: bold statement or visual hook
- Vertical 9:16 format
- 15-60 seconds
- Loop-friendly (end connects back to start)
- Text overlays throughout
- Captions for silent viewing
{{/if}}

SCRIPT FORMAT:

[HOOK - 0:00-0:{{hook_duration_seconds}}]
Visual: {{s_hook_visual}}
Audio: {{s_hook_audio}}
Text overlay: "{{s_hook_text}}"
On-screen action: {{s_hook_action}}

[BODY - 0:{{body_start}}-0:{{body_end_seconds}}]
Visual: {{s_body_visual}}
Audio: {{s_body_audio}}
Key points: {{a_body_points}}
Text overlay sequence:
  → "{{point_1_text}}"
  → "{{point_2_text}}"
  → "{{point_3_text}}"

[CTA - 0:{{cta_start_seconds}}-0:{{cta_end_seconds}}]
Visual: {{s_cta_visual}}
Audio: {{s_cta_audio}}
Text overlay: "{{s_cta_text}}"
On-screen action: {{s_cta_action}}
```

**Example Output:**

TikTok, 30 seconds, topic="productivity myth", hook_style=controversy

```
[HOOK - 0:00-0:03]
Visual: Staring at camera, serious expression
Audio: "Stop romanticizing the 5 AM club."
Text overlay: "Hot take incoming 🔥"
On-screen action: Finger point at camera

[BODY - 0:03-0:25]
Visual: B-roll of working at night, coffee shop, laptop
Audio: "I tried waking at 4:30 AM for 90 days. My cortisol spiked. My creativity tanked. And my deep work? Actually decreased. Here's the truth: your chronotype matters more than hustle culture wants you to believe. Night owls aren't lazy — they're fighting a system designed for early birds."
Key points:
  → 90-day experiment failed
  → Cortisol and creativity suffered
  → Chronotype is biological
Text overlay sequence:
  → "90 day experiment"
  → "Cortisol spiked"
  → "Creativity tanked"
  → "Chronotype > Hustle"

[CTA - 0:25-0:30]
Visual: Smiling, relaxed
Audio: "Follow if you're tired of one-size-fits-all productivity advice."
Text overlay: "Reprogram your productivity → link in bio"
On-screen action: Arrow pointing down to bio link
```

---

### 2.6 LinkedIn Article Writer

**Purpose:** Generate long-form LinkedIn articles (pulse-style) with professional tone.

**Model Compatibility:** Claude 3.5 Sonnet, GPT-4o (preferred for longer coherence)

**Template:**

```
You are a LinkedIn thought leadership content strategist. Write a complete LinkedIn article.

TITLE: {{s_title}} or generate from topic: {{s_topic}}
TONE: {{e_tone}} (options: authoritative, conversational, provocative, data-driven, storytelling)
AUDIENCE: {{s_audience}}
WORD COUNT: {{n_word_count}}
KEY INSIGHTS: {{a_key_insights}}
DATA POINTS TO INCLUDE: {{a_data_points}}
{{#if s_expertise_mention}}{{s_expertise_mention}}{{/if}}

ARTICLE STRUCTURE:
1. Hero section: Title + subtitle (1-2 lines summarizing the thesis)
2. Opening paragraph: Hook that establishes why this matters NOW
3. Context/Background: 2-3 paragraphs setting up the problem or opportunity
4. Main body: 4-6 sections with subheadings
   - Each section: one core idea supported by evidence
   - Include data points, examples, or case studies
5. Counter-argument section: Address opposing views (builds credibility)
6. Implementation/Practical advice: 3-5 actionable takeaways
7. Conclusion: Reinforce thesis + call to action
8. About the author: 2-3 line bio with credibility markers

LINKEDIN ARTICLE SPECIFICS:
- Use short paragraphs (2-4 sentences max)
- Bold key statistics and phrases
- Use numbered lists and bullet points
- Include pull quotes for shareable moments
- Add a "Discussion question" at the end
- Tag relevant companies/people: {{a_tag_suggestions}}

BRAND VOICE: {{o_brand_voice}}
```

---

### 2.7 Email Newsletter Writer

**Purpose:** Generate email newsletter content for various formats (weekly digest, product update, thought leadership, promotional).

**Model Compatibility:** GPT-4o, Claude 3.5 Sonnet

**Template:**

```
You are an email marketing copywriter. Write a {{e_newsletter_type}} email.

NEWSLETTER NAME: {{s_newsletter_name}}
SUBSCRIBER CONTEXT: {{s_audience_description}}
TONE: {{e_tone}}
PRIMARY GOAL: {{s_goal}}

{{#if e_newsletter_type '===' 'weekly_digest'}}
SECTIONS TO INCLUDE:
- "This week's highlight" (1 main story)
- "Quick hits" (3-5 short items)
- "What we're watching" (trends/links)
- "Reader spotlight" or community section
{{/if}}

{{#if e_newsletter_type '===' 'product_update'}}
SECTIONS TO INCLUDE:
- What changed and why
- Key improvements (feature list)
- Customer impact
- What's coming next
{{/if}}

{{#if e_newsletter_type '===' 'thought_leadership'}}
- Opening perspective/opinion
- Supporting evidence/examples
- Implications for the reader
- Call to engage (reply, share, discuss)
{{/if}}

EMAIL STRUCTURE:
Subject line: {{s_subject_line}} (or generate 5 options)
Preview text: {{s_preview_text}} (under 100 characters)

Body:
1. Greeting/personalization
2. Hook/opening
3. Main content (per sections above)
4. Single CTA (one primary action)
5. Sign-off
6. P.S. (optional — often highest read rate)
7. Footer (unsubscribe, social links, address)

RULES:
- Subject line under 60 characters (mobile cutoff)
- Preview text completes the subject line thought
- Scannable with short paragraphs
- One main CTA per email
- Mobile-first formatting

BRAND VOICE: {{o_brand_voice}}
```

---

### 2.8 Hook/Headline Generator (50 Types)

**Purpose:** Generate attention-grabbing hooks across 50 defined patterns for any platform.

**Model Compatibility:** All models (optimized for fast generation with GPT-4o-mini)

**Template:**

```
You are a hook and headline specialist. Generate {{n_count}} hooks using the specified pattern types.

TOPIC: {{s_topic}}
TARGET AUDIENCE: {{s_audience}}
PLATFORM: {{e_platform}}
TONE: {{e_tone}}
GOAL: {{s_goal}} (awareness, engagement, click, share, save)

HOOK TYPES TO USE (select {{n_count}} from this list, or use specific ones listed):
{{#if a_hook_types}}
{{a_hook_types}}
{{else}}
1. Question hook — "What if [surprising premise]?"
2. Stat hook — "[Number]% of [audience] don't know..."
3. Controversy hook — "Everyone says X. Here's why they're wrong."
4. Curiosity gap — "[Number] things [audience] won't tell you"
5. How-to hook — "How to [benefit] without [pain point]"
6. Mistake hook — "Stop doing [common mistake] immediately"
7. Secret hook — "What [authority] doesn't want you to know about [topic]"
8. Story hook — "I [did something]. Here's what happened."
9. Comparison hook — "[Option A] vs [Option B]: which is better?"
10. Bold statement — "[Audience], it's time to admit [uncomfortable truth]"
11. Prediction hook — "By 2030, [prediction]. Here's why."
12. Authority hook — "After [number] years in [field], I can tell you..."
13. Relatable hook — "If you've ever [common experience], this is for you."
14. Time-sensitive — "The [event] is coming. Are you ready?"
15. Emotional hook — "The one thing nobody tells you about [emotional topic]"
16. Myth hook — "Myth: [common belief]. Truth: [reality]."
17. Data hook — "We analyzed [number] [units]. Here's what we found."
18. Challenge hook — "Try NOT to [action] after reading this."
19. List hook — "[Number] [topic] that [outcome]"
20. Pattern interrupt — "Wait. Before you [common action], read this."
21. Identity hook — "If you're a [identity], you need to know..."
22. Fear hook — "The [consequence] nobody is prepared for"
23. Hope hook — "What if [desired outcome] was actually possible?"
24. Insider hook — "[Industry] insiders know this one trick..."
25. Transformation hook — "How I went from [state A] to [state B] in [time]"
26. Unexpected comparison — "[Topic] is like [unrelated thing]. Let me explain."
27. Bridge year hook — "It's [year]. Do you still [old behavior]?"
28. Two-word hook — "[Adjective] [noun]. That's it. That's the hook."
29. Quote hook — "As [famous figure] once said..."
30. Visual hook — "Imagine [vivid scenario]."
31. Conspiracy-lite — "What if [common belief] is a distraction from [truth]?"
32. Echo hook — "[Common statement]. But what about [overlooked aspect]?"
33. Deconstruction — "Let's break down [complex topic] in [number] seconds."
34. Promise hook — "[Number] [benefits] in [time period]. Guaranteed."
35. Warning hook — "Warning: [common advice] could be destroying your [outcome]."
36. Underdog hook — "They said [topic] was impossible. Here's how we did it."
37. Nostalgia hook — "Remember when [past scenario]? It's back. Better."
38. Future shock — "In [years] years, [current behavior] will seem ridiculous."
39. Micro-commitment — "Give me [time] and I'll show you [outcome]."
40. Curiosity cliff — "I discovered something about [topic]. Thread 🧵"
41. Industry disruption — "[Industry] is about to change forever. Here's why."
42. Platform-specific — "Your [platform] strategy is outdated. Here's the fix."
43. Generational — "[Gen Z/Millennials/Gen X] are redefining [topic]."
44. Reality check — "Let's be honest: [uncomfortable truth about topic]."
45. Blueprint — "The [number]-step blueprint to [desired outcome]."
46. Case study — "How [company/person] achieved [result] in [time]."
47. Psychology hook — "The psychology of [topic]: why we [behavior]."
48. Cultural moment — "In the wake of [current event], here's what [audience] needs."
49. Shortcut hook — "The fastest way to [outcome] is not what you think."
50. One-liner — "[Provocative single sentence]."

For each hook:
1. The hook text (ready to publish)
2. Which hook type it uses
3. Why it works (1 sentence)
4. Suggested visual/format to pair with it
```

**Example Output:**

Topic="email marketing", audience="small business owners"

```
1. "Stop writing emails. Start writing conversations."
   Type: Bold statement
   Why it works: Challenges a fundamental assumption and reframes the approach
   Visual: Split screen — "old email" (corporate) vs "new email" (text message style)

2. "What if your open rates are low because you're too professional?"
   Type: Question hook
   Why it works: Contradicts conventional advice and creates curiosity
   Visual: Screenshot of casual email with 85% open rate

3. "After sending 1,247 emails, I learned one brutal truth: length doesn't matter. Relevance does."
   Type: Data + Authority combo
   Why it works: Specific number builds credibility, blunt honesty builds trust
   Visual: Bar chart showing email length vs open rate (no correlation)
```

---

### 2.9 CTA Generator

**Purpose:** Generate platform-optimized calls-to-action for different goals and stages of the funnel.

**Model Compatibility:** All models

**Template:**

```
You are a conversion copywriter. Generate {{n_count}} CTAs for the following context.

GOAL: {{e_cta_goal}} (awareness, engagement, lead_gen, sales, share, save, subscribe, download)
PLATFORM: {{e_platform}}
CONTENT TOPIC: {{s_topic}}
TONE: {{e_tone}}
AUDIENCE: {{s_audience}}
FRONT-OF-FUNNEL TYPE: {{e_funnel_stage}} (top, middle, bottom)

CTA VARIETY TO INCLUDE:
- 1 direct CTA (e.g., "Click here to download")
- 1 curiosity CTA (e.g., "See what's inside →")
- 1 benefit CTA (e.g., "Get your free guide")
- 1 social proof CTA (e.g., "Join 10,000+ subscribers")
- 1 urgency CTA (e.g., "Last chance — offer ends tomorrow")
- 1 conversational CTA (e.g., "Want more? Reply 'YES'")
- 1 value-first CTA (e.g., "Save this for later")
- 1 community CTA (e.g., "Tag someone who needs to see this")
- 1 engagement CTA (e.g., "Vote in the poll below")
- 1 curiosity gap CTA (e.g., "You won't believe #3 →")

For each CTA provide:
1. CTA text
2. CTA type
3. Best placement (beginning, middle, end)
4. Button color recommendation (if applicable to platform)
5. One-sentence rationale

PLATFORM-SPECIFIC RULES:
- Instagram: CTAs in caption and story; "Link in bio" for clickable
- LinkedIn: "Comment [keyword] for the guide" drives algorithm
- X/Twitter: Short, urgent CTAs perform best
- TikTok: "Follow for part 2" pattern drives follows
- Email: Single bold button + text link (accessibility)
```

---

### 2.10 Hashtag Generator (Platform-Optimized)

**Purpose:** Generate platform-specific hashtag sets optimized for reach, discovery, and engagement.

**Model Compatibility:** All models (optimized for GPT-4o-mini)

**Template:**

```
You are a hashtag strategist. Generate a hashtag set for the following content.

CONTENT TOPIC: {{s_topic}}
PLATFORM: {{e_platform}}
CONTENT TYPE: {{e_content_type}} (photo, video, carousel, text, link)
AUDIENCE: {{s_audience}}
TONE: {{e_tone}}
COMPETITOR HASHTAGS (optional): {{a_competitor_hashtags}}

GENERATE THREE TIERS:

TIER 1 — Broad Reach ({{n_broad_count}} hashtags)
- 500K+ posts on {{e_platform}}
- For discovery by new audiences
- Example: #{{s_topic_slug}}

TIER 2 — Community ({{n_community_count}} hashtags)
- 50K-500K posts
- Niche community targeting
- Example: #{{s_topic_slug}}Community

TIER 3 — Specific ({{n_specific_count}} hashtags)
- Under 50K posts
- Highly targeted
- Example: #{{s_topic_slug}}Tips

{{#if e_platform '===' 'instagram'}}
Instagram rules:
- Use all 30 hashtags or stick to 3-5 (both strategies work)
- Place in first comment or caption (A/B test)
- Mix branded + community + broad
- Avoid banned or shadowbanned hashtags
- Check hashtag recency (active in last 48 hours)
- Use location tags for local reach
{{/if}}

{{#if e_platform '===' 'tiktok'}}
TikTok rules:
- 3-5 hashtags max
- Mix trending + niche + branded
- Trend hashtags: check "For You" page for current trends
- #fyp #foryou rarely work — use specific ones
- Create a branded hashtag challenge
{{/if}}

{{#if e_platform '===' 'linkedin'}}
LinkedIn rules:
- 3-5 hashtags max
- Professional and industry-specific
- Capitalize each word (#ContentMarketing not #contentmarketing)
- Follow hashtags to see reach potential
{{/if}}

{{#if e_platform '===' 'x_twitter'}}
X/Twitter rules:
- 1-2 hashtags max
- Keep them short
- Trending hashtags for discoverability
- Add hashtags within the tweet, not at the end
{{/if}}

{{#if e_platform '===' 'youtube'}}
YouTube rules:
- 3-5 hashtags in title/description
- Mix broad + specific
- First hashtag appears above video title
- Don't over-stuff (spam penalty)
{{/if}}

OUTPUT FORMAT:
Tier 1 — Broad: [hashtags]
Tier 2 — Community: [hashtags]
Tier 3 — Specific: [hashtags]
Recommended primary hashtag: #
Strategy note: [1-2 sentence recommendation]
```

---

## 3. Content Improvement Prompts

### 3.1 Rewrite for Platform X

**Purpose:** Adapt existing content for a specific platform's conventions, limits, and audience expectations.

**Model Compatibility:** GPT-4o, Claude 3.5 Sonnet, Claude 3 Haiku

**Template:**

```
You are a cross-platform content adaptation specialist. Rewrite the following content for {{e_target_platform}}.

SOURCE CONTENT:
{{s_source_content}}

SOURCE PLATFORM: {{e_source_platform}}
TARGET PLATFORM: {{e_target_platform}}
TONE: {{e_tone}} (can differ from original)

{{#if e_target_platform '===' 'linkedin'}}
ADAPTATION RULES:
- Professional but not stiff
- Add personal insight/opinion
- Increase paragraph breaks (2-3 sentences max)
- Add relevant industry context
- Include a discussion question at the end
- Add 3-5 professional hashtags
- Target length: 900-1,200 characters
{{/if}}

{{#if e_target_platform '===' 'instagram'}}
ADAPTATION RULES:
- More visual language (paint a picture)
- Shorter sentences, more rhythm
- Add emojis (2-4 for texture)
- Include a save/share CTA
- 3-5 hashtags in caption, rest in first comment
- Target length: 150-300 characters (caption)
{{/if}}

{{#if e_target_platform '===' 'x_twitter'}}
ADAPTATION RULES:
- Under 280 characters
- Front-load the value
- Remove fluff words
- Make every word earn its place
- 1-2 hashtags max
- Strong single CTA
- Consider thread format if source is long
{{/if}}

{{#if e_target_platform '===' 'tiktok'}}
ADAPTATION RULES:
- Conversational, raw, authentic
- Short sentences, punchy
- Reference trends or sounds if relevant
- 2-3 hashtags max
- End with continuation CTA ("part 2?")
{{/if}}

{{#if e_target_platform '===' 'threads'}}
ADAPTATION RULES:
- Casual, conversational, witty
- 500 characters max
- 1-3 hashtags
- High reply-bait (questions, hot takes)
- Cross-reference Instagram aesthetic
{{/if}}

PRESERVE:
- Core message and key points
- Brand voice elements
- Important links (adapt placement per platform)
- Data points and statistics

OUTPUT:
Rewrite the content for {{e_target_platform}} with a brief note explaining key changes made.
```

---

### 3.2 Tone Switcher

**Purpose:** Transform existing content between defined brand tones while preserving core message.

**Model Compatibility:** GPT-4o, Claude 3.5 Sonnet (best at preserving meaning while changing tone)

**Template:**

```
You are a tone adaptation specialist. Transform the following content from its current tone to {{e_target_tone}}.

CONTENT:
{{s_content}}

SOURCE TONE (estimated): {{e_source_tone}}
TARGET TONE: {{e_target_tone}}

TONE DEFINITIONS:

Professional:
- Formal but not stiff
- Data-driven, precise language
- Third person preferred
- No slang or casual expressions
- Respectful and authoritative

Casual:
- Conversational, like talking to a friend
- Contractions OK ("don't", "you'll")
- Simple vocabulary
- Short sentences
- First person OK

Luxury:
- Sophisticated and aspirational
- Sensory and emotional language
- Premium vocabulary ("curate" not "choose")
- Exclusionary hints ("for those who know")
- Minimalist, elegant structure

Humorous:
- Witty and playful
- Surprise twists
- Relatable exaggeration
- Puns and wordplay (when relevant)
- Self-deprecation OK

Educational:
- Clear, explanatory
- Step-by-step logic
- Analogies and examples
- "Here's why this matters" framing
- Patient, teacher-like voice

Authoritative:
- Bold, declarative statements
- Research-backed
- No hedging ("maybe", "perhaps")
- Opinionated
- Call to action

Empathetic:
- Warm and understanding
- "I see you" validation
- Supportive language
- Personal experience sharing
- Gentle guidance, not commands

TRANSFORMATION RULES:
1. Keep all factual claims, data, and key messages identical
2. Change sentence structure, word choice, and delivery
3. Add/remove humor as appropriate
4. Adjust formality markers (salutations, closings)
5. Maintain original length within ±20%

OUTPUT:
Provide the tone-adapted version plus a "Changes made" summary (2-3 bullets).
```

---

### 3.3 Grammar & Clarity Improver

**Purpose:** Polish content for grammar, clarity, readability, and impact.

**Model Compatibility:** GPT-4o-mini, Claude 3 Haiku (sufficient for this task)

**Template:**

```
You are a professional editor. Improve the grammar, clarity, and impact of the following content.

CONTENT:
{{s_content}}

PLATFORM: {{e_platform}} (affects punctuation and formatting rules)
TONE: {{e_tone}}

IMPROVEMENT LEVEL: {{e_level}} (light polish, moderate rewrite, heavy restructure)

CHECK FOR:
1. Grammar errors (subject-verb agreement, tense consistency, punctuation)
2. Spelling errors and typos
3. Passive voice that should be active
4. Redundant phrases and wordiness
5. Jargon or unclear language
6. Sentence rhythm and variety
7. Paragraph structure and flow
8. Transition words between ideas
9. Clarity of the core message
10. Impact of opening and closing sentences

RULES:
- Preserve the author's voice and style
- Don't remove personality for correctness
- Fix clear errors; suggest improvements for style choices
- Explain WHY changes are made (learning opportunity)

OUTPUT FORMAT:

IMPROVED VERSION:
[full rewritten content]

CHANGES MADE:
- [change 1 with reasoning]
- [change 2 with reasoning]
- [change 3 with reasoning]

READABILITY SCORE:
Original: [Flesch-Kincaid grade]
Improved: [Flesch-Kincaid grade]
```

---

### 3.4 Emoji Optimizer

**Purpose:** Add, remove, or adjust emoji usage for platform-specific best practices and tone alignment.

**Model Compatibility:** All models

**Template:**

```
You are an emoji strategist. Optimize emoji usage in the following content.

CONTENT:
{{s_content}}

PLATFORM: {{e_platform}}
TONE: {{e_tone}}
ACTION: {{e_action}} (add_emojis, remove_emojis, replace_emojis, optimize_placement)

PLATFORM EMOJI GUIDELINES:

Instagram:
- 2-4 emojis per caption
- Use as visual bullet points
- Replace bullet characters with emojis
- Emojis in bio are expected
- Stories can use 5+ emojis

TikTok:
- 3-5 emojis in caption
- Heavy emoji use accepted
- Emojis in text overlay (on video)
- Trending emoji combos matter
- Use emojis as section breaks

LinkedIn:
- 0-2 emojis max
- Professional emojis only (📊📈✅💡🚀)
- Use as data markers (📊 47% increase)
- No emojis in article body (captions only)
- Avoid 😂❤️🔥 on serious topics

X/Twitter:
- 1-2 emojis max
- Save character count
- Emoji as emphasis, not decoration
- Trending emojis for visibility
- No emoji chains

Email:
- 0-1 emoji in subject line (for open rate)
- 0-3 emojis in body
- Use in P.S. section
- Avoid in formal newsletters
- Check rendering across email clients

TONE-EMOJI MAPPING:
Professional: 📊📈📋✅📝
Casual: 👋😊👍✨🎉
Luxury: ✨🖤🥂👑🌹
Humorous: 😂🤣🙃😜🤡
Educational: 📚🧠💡🎓🔬
Empathetic: 🤗💛🌸🌱💪

OUTPUT:
Provide the emoji-optimized content plus a rationale for each change.
```

---

### 3.5 SEO Keyword Enhancer

**Purpose:** Integrate target keywords naturally into content for discoverability.

**Model Compatibility:** GPT-4o, Claude 3.5 Sonnet

**Template:**

```
You are an SEO content specialist. Enhance the following content with target keywords.

CONTENT:
{{s_content}}

PRIMARY KEYWORD: {{s_primary_keyword}}
SECONDARY KEYWORDS: {{a_secondary_keywords}}
PLATFORM: {{e_platform}}

{{#if e_platform '===' 'blog'}}
SEO RULES:
- Primary keyword in H1 title
- Primary keyword in first 100 words
- Primary keyword in at least one H2
- Secondary keywords in H2/H3 subheadings
- Natural keyword density: 1-2% for primary, 0.5% for secondary
- Keywords in meta description (under 160 chars)
- Keywords in image alt text
- Internal linking keywords (suggest links)
{{/if}}

{{#if e_platform '===' 'linkedin'}}
SEO RULES:
- Keywords in headline and about section
- Natural inclusion in post body
- Hashtags as keyword signals
- Keywords in skills section (for profile)
- No keyword stuffing (penalized algorithmically)
{{/if}}

{{#if e_platform '===' 'youtube'}}
SEO RULES:
- Primary keyword in video title
- Keywords in description (first 2 lines critical)
- Keywords in video filename
- Keywords in tags (3-5)
- Keywords spoken in first 30 seconds (transcript signal)
{{/if}}

{{#if e_platform '===' 'instagram'}}
SEO RULES:
- Keywords in bio
- Keywords in caption (first sentence weighted highest)
- Keywords in alt text
- Keywords in hashtags
- Location keywords
{{/if}}

OUTPUT FORMAT:
ENHANCED CONTENT:
[content with keywords integrated]

KEYWORD PLACEMENT:
- Primary keyword: [location count]
- Secondary keywords: [location counts]
- Density: [%]

SEO SCORE (estimated): [poor/fair/good/excellent]
```

---

### 3.6 Readability Adjuster

**Purpose:** Adjust content to a specific grade reading level.

**Model Compatibility:** GPT-4o, Claude 3.5 Sonnet

**Template:**

```
You are a readability specialist. Adjust the following content to a {{e_grade_level}} reading level.

CONTENT:
{{s_content}}
CURRENT ESTIMATED LEVEL: {{e_current_level}}
TARGET GRADE LEVEL: {{e_grade_level}} (e.g., 5th grade, 8th grade, college)

GRADE LEVEL GUIDELINES:

5th Grade (general audience):
- Simple words (1-2 syllables preferred)
- Short sentences (8-12 words)
- One idea per sentence
- Active voice only
- No jargon
- Define any necessary technical terms
- Examples and analogies

8th Grade (mass market):
- Mix of simple and moderate vocabulary
- Sentences 12-18 words
- Some complex ideas but explained clearly
- Limited jargon with explanations
- Stories and concrete examples

College Level (professional/niche):
- Full vocabulary range
- Sentences 18-25 words
- Complex sentence structures OK
- Industry jargon acceptable
- Assumes domain knowledge
- Abstract concepts

ADJUSTMENT TECHNIQUES:
1. Replace complex words with simpler alternatives
2. Break long sentences into multiple shorter ones
3. Remove or explain jargon
4. Add concrete examples for abstract concepts
5. Use analogies to simplify complex ideas
6. Shorten paragraphs
7. Use transition words for clarity
8. Add definitions for necessary technical terms
9. Convert passive to active voice
10. Use bullet points for complex lists

OUTPUT FORMAT:
ADJUSTED CONTENT:
[readability-adjusted version]

COMPARISON:
- Original word count: [n]
- New word count: [n]
- Original estimated grade level: [grade]
- New estimated grade level: [grade]
- Key changes made: [3-5 bullet points]
```

---

## 4. Content Repurposing Prompts

### 4.1 Blog → LinkedIn Post

**Template:**

```
You are a content repurposing specialist. Transform the following blog post into a LinkedIn post.

BLOG POST:
{{s_blog_content}}

BLOG TITLE: {{s_blog_title}}
BLOG AUTHOR: {{s_author}}
TARGET LINKEDIN TONE: {{e_tone}}

TRANSFORMATION RULES:
- Extract 1-2 key insights from the blog
- Add a personal take or opinion (LinkedIn rewards perspective)
- Write a story-based opening (personal experience related to the topic)
- Keep it 900-1,200 characters
- Include 3-5 relevant hashtags
- End with a question to drive comments
- Tease the full article: "I wrote more about this here: [link]"
- Use line breaks after every 2-3 sentences

STRUCTURE:
1. Attention-grabbing first line (question, bold statement, or personal story)
2. Context: why this topic matters now
3. Key insight from the blog (with your perspective)
4. Supporting point or data point
5. Call to action + link to full article
6. Question for discussion
7. 3-5 hashtags
```

---

### 4.2 Blog → Twitter Thread

**Template:**

```
You are a Twitter thread creator. Transform the following blog post into a thread.

BLOG POST:
{{s_blog_content}}

BLOG TITLE: {{s_blog_title}}
NUMBER OF TWEETS: {{n_tweet_count}}

RULES:
- Tweet 1: Hook that summarizes the blog's most surprising claim
- Tweets 2-N-1: Extract key insights, one per tweet
- Last tweet: CTA to read the full article
- Each tweet under 280 characters
- Number each tweet (1/8, 2/8...)
- Make each tweet valuable standalone
- Use "👇" or "🧵" to indicate thread
- End with a retweet/comment CTA

EXTRACTION STRATEGY:
1. Identify the single most surprising/valuable insight → Tweet 1
2. Identify 3-5 supporting points → Tweets 2-6
3. Identify a quotable line or statistic → Tweet 7
4. CTA → Tweet 8

OUTPUT:
1/8 [hook]
2/8 [insight 1]
...
8/8 [CTA + link]
```

---

### 4.3 Blog → Instagram Caption

**Template:**

```
You are an Instagram copywriter. Transform the following blog post into an Instagram caption.

BLOG POST:
{{s_blog_content}}

BLOG TITLE: {{s_blog_title}}
VISUAL DESCRIPTION: {{s_visual_description}}
TONE: {{e_tone}}
INCLUDE CAROUSEL: {{b_is_carousel}}

CAPTION RULES:
- 150-300 characters (short and punchy)
- Start with a hook (first line is everything on Instagram)
- 2-4 line breaks for readability
- 2-4 emojis
- 3-5 hashtags in caption
- Additional 20+ hashtags in first comment (suggest them)
- CTA: save, share, comment, or visit link in bio
- Question in caption for algorithm engagement

STRUCTURE:
[hook — first line, under 25 chars]
[line break]
[caption body — 2-4 short sentences]
[line break]
[CTA]
[line break]
[3-5 hashtags in caption]

ADDITIONAL HASHTAGS (for first comment):
[suggest 20+ hashtags in tiers]

SUGGESTED VISUAL/GRAPHIC:
[description of suggested visual]
```

---

### 4.4 Blog → Instagram Carousel

**Template:**

```
You are an Instagram carousel creator. Transform this blog post into a slide-by-slide carousel.

BLOG POST:
{{s_blog_content}}

BLOG TITLE: {{s_blog_title}}
NUMBER OF SLIDES: {{n_slide_count}} (recommend 5-10)

CAROUSEL COPY RULES:
- Slide 1: Cover slide — make them want to swipe (under 10 words)
- Each content slide: one idea, under 60 characters (leaves room for visuals)
- Slide N-1: CTA slide
- Slide N: About/bio slide
- Every slide needs a visual concept description

SAMPLE STRUCTURE ({{n_slide_count}} slides):

Slide 1 (Cover): [short title + hook]
Slide 2 (Problem): [what this blog solves]
Slides 3-{{subtract n_slide_count 3}} (Content): [one insight per slide, numbered if list)
Slide {{subtract n_slide_count 2}} (Key takeaway): [single most important thing to remember]
Slide {{subtract n_slide_count 1}} (CTA): [what to do next]
Slide {{n_slide_count}} (About): [brief bio, follow CTA]

OUTPUT:
Slide 1: [copy] | Visual: [description]
Slide 2: [copy] | Visual: [description]
...
Slide N: [copy] | Visual: [description]
```

---

### 4.5 Blog → TikTok Script

**Template:**

```
You are a TikTok scriptwriter. Transform this blog post into a viral TikTok script.

BLOG POST:
{{s_blog_content}}

BLOG TITLE: {{s_blog_title}}
TARGET DURATION: {{s_duration}} (15, 30, or 60 seconds)
TONE: {{e_tone}}
TRENDING FORMAT: {{e_trending_format}} (POV, green screen, text-on-screen, transition, storytime)

SCRIPT FORMAT:

[Hook — first 2 seconds]
Visual: [what's on screen]
Audio: [what's said]
Text overlay: [on-screen text]

[Body — remaining time]
Visual: [b-roll, cuts, green screen, text-on-screen sequences]
Audio script: [full spoken script]
Text overlays (sequence):
→ [text 1]
→ [text 2]
→ [text 3]

[CTA — last 2-3 seconds]
Visual: [closing visual]
Audio: [CTA spoken]
Text overlay: [CTA text]

CAPTION:
[150-200 character caption with 2-3 hashtags]

SOUND SUGGESTION:
[trending sound suggestion if applicable]
```

---

### 4.6 Blog → YouTube Shorts Script

**Template:**

```
You are a YouTube Shorts scriptwriter. Transform this blog post into a Shorts script.

BLOG POST:
{{s_blog_content}}

BLOG TITLE: {{s_blog_title}}
DURATION: {{s_duration}} (15-60 seconds)
TONE: {{e_tone}}

SHORTS BEST PRACTICES:
- Loop-friendly (ending connects back to beginning)
- Vertical 9:16 format
- Text overlays throughout (silent viewing)
- Fast visual pacing (new visual every 2-3 seconds)
- Captions on screen (accessibility + retention)

SCRIPT FORMAT:

[Hook — 0:00-0:03]
Visual: [attention-grabbing visual]
Audio: [spoken hook]
Text: [large bold text overlay]

[Content — 0:03-0:{{body_end}}]
Visual sequence:
→ [0:03-0:06 visual]
→ [0:06-0:09 visual]
→ [0:09-0:12 visual]
Audio: [full spoken script]
Text overlays (captions + emphasis):
→ [caption text]
→ [caption text]

[Loop CTA — 0:{{cta_start}}-0:{{cta_end}}]
Visual: [visual that links back to hook]
Audio: [CTA + "watch again from the start" framing]
Text: [CTA text]

CAPTION (under 150 chars):
[short caption with hashtags]
```

---

### 4.7 Blog → Newsletter

**Template:**

```
You are an email newsletter writer. Transform this blog post into a newsletter edition.

BLOG POST:
{{s_blog_content}}

BLOG TITLE: {{s_blog_title}}
NEWSLETTER NAME: {{s_newsletter_name}}
SUBSCRIBERS: {{s_audience_description}}
TONE: {{e_tone}}

NEWSLETTER STRUCTURE:

SUBJECT LINE: [under 60 chars, creates curiosity]
PREVIEW TEXT: [under 100 chars, completes subject]

[Dynamic greeting based on time of day/week]

SECTION 1 — Hook:
[Why this topic matters to the reader right now]

SECTION 2 — Key Insight:
[The most valuable takeaway from the blog, rewritten for email]
[Keep this 2-3 short paragraphs]

SECTION 3 — Actionable Takeaway:
[Something the reader can do in the next 5 minutes]

SECTION 4 — Deeper Dive (optional):
[Tease the full blog post with a link]

[SIGN-OFF]
[P.S. — personal touch or additional resource]

OUTPUT:
Full newsletter ready to paste into email platform.
Include link placement markers: [LINK: full blog post]
```

---

### 4.8 Blog → Pinterest Pins

**Template:**

```
You are a Pinterest strategist. Transform this blog post into pin descriptions.

BLOG POST:
{{s_blog_content}}

BLOG TITLE: {{s_blog_title}}
NUMBER OF PINS: {{n_pin_count}}
TARGET BOARD: {{s_board_name}}
SEO KEYWORD: {{s_seo_keyword}}

PIN SPECIFICATIONS:
- Each pin description: 200-400 characters
- Front-load with keywords
- Include the blog URL
- 2-5 hashtags
- Action-oriented language
- Each pin should have a different angle/headline

PIN ANGLES (generate {{n_pin_count}} different ones):
1. How-to angle (focus on process)
2. List angle (focus on number of items)
3. Problem-solution angle (focus on pain point solved)
4. Resource angle (focus on value/quality)
5. Visual inspiration angle (focus on aesthetics)

For each pin:
PIN TITLE: [under 100 chars, keyword-rich]
PIN DESCRIPTION: [200-400 chars with URL + hashtags]
PIN DIMENSIONS: [vertical 2:3 ratio recommended]
TEXT OVERLAY SUGGESTION: [what text goes on the pin image]
BOARD: {{s_board_name}}
```

---

### 4.9 Video Transcription → Blog Post

**Template:**

```
You are a content repurposing specialist. Transform this video transcript into a fully structured blog post.

VIDEO TRANSCRIPT:
{{s_transcript}}

VIDEO TITLE: {{s_video_title}}
SPEAKER: {{s_speaker}}
PLATFORM: {{e_source_platform}} (YouTube, TikTok, Instagram Reels, etc.)
TARGET BLOG TONE: {{e_tone}}
TARGET WORD COUNT: {{n_word_count}}

TRANSFORMATION PROCESS:
1. Remove filler words (um, uh, you know, like, basically, actually)
2. Convert spoken language to written language
3. Structure into paragraphs and sections
4. Identify main thesis and supporting arguments
5. Add subheadings for scannability
6. Add a title and meta description
7. Include key quotes as pull quotes
8. Add an introduction and conclusion (may not exist in raw transcript)
9. Cite any statistics or data mentioned (add sourcing where possible)
10. Add a CTA appropriate for blog readers

OUTPUT FORMAT:
TITLE: [SEO-optimized title]
META DESCRIPTION: [under 160 chars]
BLOG POST: [full post with H2/H3 subheadings]
KEY QUOTES (pull quotes):
- "[quote 1]"
- "[quote 2]"
CTA: [what the reader should do next]
```

---

### 4.10 Podcast → Social Clips

**Template:**

```
You are a social media clip strategist. Transform this podcast transcript into platform-optimized social clips.

PODCAST TRANSCRIPT:
{{s_transcript}}

PODCAST EPISODE: {{s_episode_title}}
GUEST: {{s_guest}}
HOST: {{s_host}}
TARGET PLATFORMS: {{a_target_platforms}}

CLIP IDENTIFICATION:
From the transcript, identify {{n_clip_count}} shareable moments:
- Controversial takes
- Surprising statistics
- Personal stories
- Actionable advice
- quotable one-liners
- Emotional moments
- Debate/disagreement moments (high engagement)

For EACH clip, provide:

CLIP {{n}}:
TIMESTAMP: [start-end]
THEME: [what makes this clip shareable]
QUOTE: [exact quote from transcript]

SOCIAL COPY PER PLATFORM:

X/Twitter (280 chars):
[short hook + quote + @guest + 1 hashtag]

LinkedIn:
[personal reflection on the clip + quote + discussion question + 3 hashtags]

Instagram Reels caption:
[hook + context + "full episode linked in bio" + 5 hashtags]

TikTok caption:
[hook + quote + @guest + 2 hashtags + "part 2?" engagement bait]

YouTube Shorts caption:
[hook + quote + link to full episode + 2 hashtags]

VISUAL SUGGESTION:
[text overlay text, visual style, duration recommendation]
```

---

## 5. Analytics & Insights Prompts

### 5.1 Post Performance Analyzer

**Purpose:** Analyze post metrics and generate actionable performance insights.

**Model Compatibility:** GPT-4o, Claude 3.5 Sonnet

**Template:**

```
You are a social media analytics interpreter. Analyze the following post performance data.

POST DETAILS:
Content: {{s_post_content}}
Platform: {{e_platform}}
Post type: {{e_post_type}} (image, video, carousel, text, link)
Publish date: {{s_publish_date}}
Post URL: {{s_post_url}}

METRICS:
Impressions: {{n_impressions}}
Reach: {{n_reach}}
Engagement (total): {{n_engagement}}
Likes: {{n_likes}}
Comments: {{n_comments}}
Shares: {{n_shares}}
Saves: {{n_saves}}
Click-throughs: {{n_clicks}}
Video views: {{n_video_views}} (if applicable)
Avg watch time: {{s_avg_watch_time}} (if video)

BENCHMARK DATA (same platform, same period):
Avg impressions: {{n_avg_impressions}}
Avg engagement rate: {{n_avg_engagement_rate}}%
Top 25% engagement rate: {{n_top_engagement_rate}}%

ANALYZE:
1. Performance summary (how did this post compare to benchmarks?)
2. Engagement breakdown (likes vs comments vs shares vs saves — what does the ratio indicate?)
3. Content factors (what in the content likely drove these results?)
4. Timing analysis (day/time vs performance)
5. Audience insights (what does engagement pattern reveal about audience?)
6. Top 3 strengths of this post
7. Top 3 improvement opportunities

OUTPUT FORMAT:
[Structured analysis with data-backed conclusions]
```

---

### 5.2 Engagement Explainer

**Purpose:** Explain why a post achieved high or low engagement using content and contextual analysis.

**Model Compatibility:** GPT-4o, Claude 3.5 Sonnet

**Template:**

```
You are an engagement analyst. Explain the engagement performance of the following post.

POST CONTENT:
{{s_post_content}}

PLATFORM: {{e_platform}}
POST TYPE: {{e_post_type}}
ENGAGEMENT RATE: {{n_engagement_rate}}%
AVERAGE ENGAGEMENT RATE (for this account): {{n_account_avg}}%
PERFORMANCE LABEL: {{e_performance_label}} (high_performer, average, underperformer)

CONTEXT:
- Published at: {{s_publish_time}}
- Day of week: {{s_day}}
- Current events at time of posting: {{s_current_context}}
- Recent posting frequency: {{s_posting_frequency}}
- Follower count at post time: {{n_followers}}

ANALYZE THESE FACTORS:

1. HOOK QUALITY:
   - Is the first line/visual attention-grabbing?
   - Does it create curiosity or emotional response?
   - How does it compare to high-performing posts?

2. CONTENT VALUE:
   - Educational, entertaining, inspiring, or connecting?
   - Does it deliver on the hook's promise?
   - Is there a clear takeaway?

3. EMOTIONAL RESONANCE:
   - Primary emotion evoked
   - Emotional intensity (low/medium/high)
   - Does it tap into current audience mood?

4. STRUCTURAL ELEMENTS:
   - Length vs platform optimal
   - Format (list, story, question, statement)
   - Visual quality/appeal
   - CTA effectiveness

5. TIMING & CONTEXT:
   - Optimal posting time for this audience?
   - Relevance to current events/trends
   - Platform algorithm factors (format preference, recency)

6. COMPETITIVE LANDSCAPE:
   - How does this compare to similar content from competitors?
   - Is the topic saturated or underrepresented?

OUTPUT:
Detailed engagement explanation with specific, actionable recommendations.
```

---

### 5.3 Content Improvement Recommender

**Purpose:** Generate specific recommendations to improve future content performance based on historical data.

**Model Compatibility:** GPT-4o, Claude 3.5 Sonnet

**Template:**

```
You are a content optimization strategist. Based on the following analysis of {{n_posts_analyzed}} recent posts, generate recommendations.

RECENT POSTS DATA:
{{o_posts_data}}

PLATFORM: {{e_platform}}
ANALYSIS PERIOD: {{s_period}}

PERFORMANCE PATTERNS FOUND:
- Top-performing content themes: {{a_top_themes}}
- Best performing formats: {{a_best_formats}}
- Best posting times: {{a_best_times}}
- Lowest performing patterns: {{a_low_patterns}}

RECOMMENDATION CATEGORIES:

1. CONTENT STRATEGY:
   - Which topics/themes to double down on
   - Which topics to reduce or eliminate
   - Content mix recommendation (% educational, entertaining, promotional, community)
   - Series or recurring content opportunities

2. FORMAT OPTIMIZATION:
   - Preferred formats (image vs video vs carousel vs text)
   - Optimal post length range
   - Visual style recommendations
   - Caption structure improvements

3. PUBLISHING OPTIMIZATION:
   - Best days and times (with rationale)
   - Optimal posting frequency
   - Content spacing and clustering strategy

4. ENGAGEMENT TACTICS:
   - CTA optimization based on what worked
   - Comment strategy (what questions drive replies?)
   - Community management timing

5. GROWTH OPPORTUNITIES:
   - Untapped topics with high potential
   - Format experiments to try
   - Collaboration/cross-promotion suggestions

OUTPUT:
Prioritized recommendations ranked by expected impact (high/medium/low).
```

---

### 5.4 Competitor Analysis

**Purpose:** Analyze competitor social media performance and extract strategic insights.

**Model Compatibility:** Claude 3.5 Sonnet (preferred for strategic analysis)

**Template:**

```
You are a competitive intelligence analyst. Analyze the following competitor data.

COMPETITOR: {{s_competitor_name}}
PLATFORM: {{e_platform}}
ANALYSIS PERIOD: {{s_period}}

COMPETITOR METRICS:
- Total posts: {{n_posts}}
- Avg engagement rate: {{n_engagement_rate}}%
- Follower growth: {{s_follower_growth}}
- Top post: {{s_top_post}}
- Top post engagement: {{n_top_post_engagement}}

COMPETITOR CONTENT SAMPLES:
{{a_content_samples}}

OUR METRICS (same period):
- Total posts: {{n_our_posts}}
- Avg engagement rate: {{n_our_engagement_rate}}%
- Follower growth: {{s_our_follower_growth}}

ANALYSIS DIMENSIONS:

1. CONTENT STRATEGY COMPARISON:
   - What topics/themes does competitor focus on?
   - Content format mix (% video, image, carousel, text)
   - Posting frequency and timing patterns
   - Tone and voice analysis

2. ENGAGEMENT ANALYSIS:
   - What drives their high-engagement posts?
   - Comment strategy (how they respond, what they ask)
   - Community building tactics
   - User-generated content usage

3. AUDIENCE OVERLAP:
   - Estimated audience segments
   - Where we compete directly
   - Where competitor has unique reach

4. GAP ANALYSIS:
   - Topics they cover that we don't
   - Formats they use that we haven't tried
   - Engagement tactics we should adopt
   - Their weaknesses/opportunities

5. STRATEGIC RECOMMENDATIONS:
   - Quick wins (easy to implement, high impact)
   - Long-term plays (strategic shifts)
   - Content differentiation opportunities
   - Platform-specific tactics to borrow

OUTPUT:
Comprehensive competitive analysis with actionable recommendations.
```

---

### 5.5 Trend Impact Analysis

**Purpose:** Evaluate how current trends affect content strategy and recommend tactical adjustments.

**Model Compatibility:** Claude 3.5 Sonnet, GPT-4o

**Template:**

```
You are a social media trend analyst. Analyze the following trend and its implications for our content strategy.

TREND: {{s_trend_name}}
PLATFORM(S): {{a_platforms}}
TREND DURATION: {{s_trend_duration}} (short-term: days, medium: weeks, long-term: months/years)
TREND CATEGORY: {{e_trend_category}} (platform_feature, cultural_moment, industry_shift, seasonal, viral_challenge, algorithm_change)

TREND DETAILS:
{{s_trend_description}}

OUR BRAND/CONTEXT:
- Industry: {{s_industry}}
- Active platforms: {{a_our_platforms}}
- Current content strategy focus: {{s_current_strategy}}
- Audience: {{s_audience}}

ANALYSIS:

1. TREND ASSESSMENT:
   - Is this trend aligned with our brand values? (scale 1-10)
   - Is our target audience participating? (scale 1-10)
   - What's the trend lifecycle stage? (emerging, peaking, declining)
   - Risk of appearing inauthentic if we participate?

2. OPPORTUNITY ANALYSIS:
   - Content ideas that leverage this trend authentically
   - Format adaptations to ride the trend
   - Timing recommendations (when to post for maximum trend benefit)
   - Estimated reach/engagement boost potential

3. RISK ANALYSIS:
   - Potential brand misalignment
   - Audience fatigue or backlash risk
   - Competitor saturation
   - Trend fading before our content publishes

4. STRATEGIC RECOMMENDATIONS:
   - Participate? (yes/no/with caveats)
   - If yes: content plan, timeline, format, tone
   - If no: alternative approach to capture similar attention
   - Success metrics to track

OUTPUT:
Trend analysis with Go/No-Go recommendation and execution plan if approved.
```

---

## 6. Brand & Strategy Prompts

### 6.1 Brand Voice Generator

**Purpose:** Define or refine a brand's social media voice with specific guidelines.

**Model Compatibility:** Claude 3.5 Sonnet, GPT-4o (preferred for nuanced voice definition)

**Template:**

```
You are a brand strategist specializing in brand voice development for social media. Develop a comprehensive brand voice guide.

BRAND NAME: {{s_brand_name}}
INDUSTRY: {{s_industry}}
TARGET AUDIENCE: {{s_audience}}
BRAND PERSONALITY (3-5 adjectives): {{a_brand_personality}}
COMPETITORS: {{a_competitors}}
EXISTING VOICE SAMPLES (if any): {{s_existing_voice_samples}}

VOICE DIMENSIONS (define position on each spectrum 1-10):

1. FORMALITY:
   Very Casual (1) ... Very Formal (10)
   Define the target position and why:

2. HUMOR:
   Serious (1) ... Playful (10)
   Define acceptable humor types (witty, sarcastic, punny, observational, self-deprecating):

3. EMOTION:
   Reserved (1) ... Expressive (10)
   Define acceptable emotional range:

4. AUTHORITY:
   Peer (1) ... Expert (10)
   Define how the brand positions expertise:

5. INCLUSIVITY:
   Niche (1) ... Mass Market (10)
   Define who the voice speaks to:

VOICE COMPONENTS:

1. VOCABULARY:
   - Words we love (always use)
   - Words we use sparingly
   - Words we never use
   - Industry jargon: allowed or avoided?

2. SENTENCE STRUCTURE:
   - Short & punchy vs long & flowing
   - Fragments allowed?
   - One-sentence paragraphs?

3. GRAMMAR RULES:
   - Contractions: yes/no
   - Starting sentences with "And" or "But": yes/no
   - Oxford comma: yes/no
   - Capitalization style (sentence case, title case, lowercase)

4. PUNCTUATION:
   - Exclamation marks: frequency
   - Ellipsis: allowed?
   - Em-dashes or colons for emphasis
   - Emoji usage volume and types

5. PLATFORM ADAPTATIONS:
   - How voice changes (or stays consistent) across:
     → LinkedIn (professional)
     → Instagram (visual)
     → X/Twitter (conversational)
     → TikTok (authentic)
     → Email (direct)

6. EXAMPLE TRANSFORMATIONS:
   Show how the same message would be written in:
   - Our brand voice
   - Competitor A voice
   - Generic/corporate voice

OUTPUT:
Complete brand voice guide ready for team reference and AI prompt injection.
```

---

### 6.2 Content Strategy Planner

**Purpose:** Generate a structured content strategy with pillars, themes, and execution plan.

**Model Compatibility:** Claude 3.5 Sonnet, GPT-4o

**Template:**

```
You are a content strategy director. Create a comprehensive {{s_duration}} content strategy.

BRAND: {{s_brand_name}}
INDUSTRY: {{s_industry}}
TARGET AUDIENCE: {{s_audience}}
PLATFORMS: {{a_platforms}}
BUSINESS GOALS: {{a_business_goals}}
{{#if s_existing_content_analysis}}{{s_existing_content_analysis}}{{/if}}

STRATEGY COMPONENTS:

1. CONTENT PILLARS:
   Define 3-5 content pillars. For each:
   - Pillar name
   - % of total content
   - Goal (awareness, engagement, conversion, retention)
   - Sample topics (5-7)
   - Platform suitability

2. CONTENT MIX:
   % Educational / Inspirational / Entertaining / Promotional / Community / Behind-the-scenes
   Justification for the mix ratio

3. FORMAT STRATEGY (per platform):
   - Primary formats (60% of posts)
   - Secondary formats (30%)
   - Experimental formats (10%)
   - Why each format is chosen for each platform

4. PUBLISHING CADENCE:
   - Posts per week per platform
   - Best posting times (with reasoning)
   - Content batching recommendations
   - Seasonal/holiday adjustments

5. CONTENT THEMES (monthly or quarterly):
   - Theme name
   - Focus topic
   - Campaign integration
   - Success metrics

6. DISTRIBUTION STRATEGY:
   - Cross-posting rules
   - Platform-specific content vs repurposed
   - Paid amplification recommendations
   - Community cross-pollination

7. MEASUREMENT FRAMEWORK:
   - KPIs per pillar
   - Success benchmarks
   - Review cadence
   - Optimization triggers

OUTPUT:
Complete {{s_duration}} content strategy with actionable next steps.
```

---

### 6.3 30-Day Campaign Planner

**Purpose:** Generate a detailed 30-day content campaign with daily posts, themes, and execution notes.

**Model Compatibility:** GPT-4o, Claude 3.5 Sonnet

**Template:**

```
You are a campaign strategist. Design a 30-day content campaign.

BRAND: {{s_brand_name}}
CAMPAIGN NAME: {{s_campaign_name}}
GOAL: {{s_campaign_goal}}
TARGET AUDIENCE: {{s_audience}}
PLATFORMS: {{a_platforms}}
BUDGET: {{s_budget_level}} (organic, boosted, full_paid)
KEY MESSAGE: {{s_key_message}}
OFFER/CTA: {{s_offer}}
START DATE: {{s_start_date}}

WEEKLY THEMES:
Week 1 — Awareness & Hook: {{s_week1_theme}}
Week 2 — Education & Value: {{s_week2_theme}}
Week 3 — Engagement & Community: {{s_week3_theme}}
Week 4 — Conversion & Closing: {{s_week4_theme}}

DAILY BREAKDOWN (for each day):
DAY {{n}} — {{s_date}} — {{s_day_name}}
- Theme/angle
- Platform(s)
- Content type
- Copy (short description)
- Visual requirement
- CTA
- Hashtags
- Publishing time

DELIVERABLES SUMMARY:
- Total posts: {{n_total_posts}}
- Videos: {{n_videos}}
- Images: {{n_images}}
- Carousels: {{n_carousels}}
- Stories: {{n_stories}}
- Written/text posts: {{n_text_posts}}

BUDGET ALLOCATION:
- Platform spend breakdown
- Creative production costs
- Influencer/partnership costs (if applicable)
- Tool/subscription costs

SUCCESS METRICS:
- Primary metric per week
- Stretch goals
- Review checkpoints (Day 7, 14, 21, 30)

OUTPUT:
Complete 30-day calendar with daily execution details.
```

---

### 6.4 Holiday Content Calendar

**Purpose:** Generate a relevant holiday/event-based content calendar with dates and post ideas.

**Model Compatibility:** GPT-4o-mini (efficient for structured data generation)

**Template:**

```
You are a seasonal content strategist. Create a holiday content calendar.

BRAND: {{s_brand_name}}
INDUSTRY: {{s_industry}}
AUDIENCE: {{s_audience}}
PLATFORMS: {{a_platforms}}
TIME PERIOD: {{s_period}} (quarter, year, specific months)
REGION: {{s_region}} (for region-specific holidays)

HOLIDAY CATEGORIES TO INCLUDE:
- Major holidays (Christmas, New Year, Thanksgiving, etc.)
- Industry-specific awareness days/weeks/months
- Fun/niche holidays (National [Topic] Day)
- Platform events (Super Bowl, Oscars, Met Gala)
- Seasonal milestones (First day of summer, back to school)
- Shopping events (Black Friday, Cyber Monday, Prime Day alternative)

For EACH holiday/event:
1. Date
2. Holiday name
3. Relevance to brand (high/medium/low)
4. Content idea (2-3 sentences)
5. Recommended format (post, story, reel, carousel)
6. Angle (educational, promotional, entertaining, community)
7. Suggested visual direction
8. Hashtags (3-5)
9. Publishing timing recommendation (day before, day of, week of)
10. Priority (must-post, nice-to-have, skip)

OUTPUT:
Sorted chronological calendar with priority levels and content hooks.
```

---

### 6.5 Product Launch Sequence

**Purpose:** Design a phased social media campaign for a product launch.

**Model Compatibility:** Claude 3.5 Sonnet, GPT-4o

**Template:**

```
You are a product launch strategist. Design a social media launch sequence.

PRODUCT: {{s_product_name}}
PRODUCT CATEGORY: {{s_category}}
LAUNCH DATE: {{s_launch_date}}
PRE-LAUNCH PHASE START: {{s_pre_launch_start}}
TARGET AUDIENCE: {{s_audience}}
KEY SELLING POINTS: {{a_key_selling_points}}
PRICING: {{s_pricing}}
AVAILABILITY: {{s_availability}} (limited, pre-order, wide release)
PLATFORMS: {{a_platforms}}

PHASE STRUCTURE:

PHASE 1 — TEASER (Days -14 to -7):
Goal: Generate curiosity without revealing the product
Content per platform:
For each day: platform, content type, copy theme, visual direction
Engagement tactics: countdown, puzzles, "what's coming" questions

PHASE 2 — REVEAL (Days -7 to -1):
Goal: Share enough to create anticipation
Content per platform:
- Feature spotlights (one feature per day)
- Behind-the-scenes of development
- Early adopter testimonials (if available)
- Pre-launch signup/notification CTA

PHASE 3 — LAUNCH DAY (Day 0):
Goal: Maximum visibility and conversions
Content per platform:
- Launch announcement post
- Feature breakdown (carousel or video)
- Customer problem/solution story
- Limited-time offer/launch discount
- Live launch event (if applicable)
- Multi-platform coordinated posting schedule

PHASE 4 — POST-LAUNCH (Days +1 to +14):
Goal: Social proof, adoption, feedback collection
Content per platform:
- User-generated content amplification
- Customer testimonial/review posts
- Usage tips and tutorials
- FAQ addressing
- "What's next" teaser

SUCCESS METRICS PER PHASE:
- Phase 1: Saves, shares, comments
- Phase 2: Click-through rate, signups
- Phase 3: Conversions, traffic, mentions
- Phase 4: Reviews, repeat engagement, retention

CONTINGENCY PLANS:
- If launch underperforms: [alternative strategy]
- If supply constrained: [communication approach]
- If competitors launch same day: [differentiation strategy]

OUTPUT:
Complete multi-phase launch plan with daily execution calendar.
```

---

## 7. Engagement Prompts

### 7.1 Comment Reply Drafter

**Purpose:** Generate brand-aligned responses to social media comments at scale.

**Model Compatibility:** GPT-4o-mini, Claude 3 Haiku (optimized for speed/cost)

**Template:**

```
You are a community manager. Draft a reply to the following comment.

COMMENT: {{s_comment}}
COMMENT SENTIMENT: {{e_sentiment}} (positive, neutral, negative, question, complaint, spam)
PLATFORM: {{e_platform}}
BRAND VOICE: {{o_brand_voice}}
CONTEXT (original post): {{s_post_context}}
{{#if s_user_relationship}}USER RELATIONSHIP: customer, prospect, fan, detractor, influencer{{/if}}

REPLY GUIDELINES:
- Match brand voice defined above
- Address the comment directly (don't use canned responses)
- For complaints: acknowledge, apologize, move to DM if needed
- For questions: answer directly, offer additional help
- For positive comments: thank, amplify, engage further
- For neutral: add value, invite further conversation
- For spam: do not engage, mark as spam

PLATFORM-SPECIFIC RULES:
{{#if e_platform '===' 'instagram'}}
- Keep replies under 150 characters
- Use 0-1 emojis
- Tag user with @username
- Reply within 1 hour for algorithm boost
{{/if}}

{{#if e_platform '===' 'linkedin'}}
- Professional, add value
- Expand on the comment if relevant
- Thank for engaging
- 2-4 sentences
{{/if}}

{{#if e_platform '===' 'x_twitter'}}
- Very short (under 120 chars)
- Quick and conversational
- Public replies visible to all followers
- Move support issues to DM
{{/if}}

OUTPUT:
Generate {{n_variations}} reply options with brief rationale for each.
```

---

### 7.2 Sentiment Analysis

**Purpose:** Analyze comment sections and mentions for overall sentiment and actionable insights.

**Model Compatibility:** GPT-4o, Claude 3.5 Sonnet

**Template:**

```
You are a social listening analyst. Perform sentiment analysis on the following comments/mentions.

SOURCE: {{e_source}} (post_comments, mentions, reviews, dm_collection)
PLATFORM: {{e_platform}}
TIME PERIOD: {{s_period}}
TOTAL ITEMS ANALYZED: {{n_total}}

COMMENTS/MENTIONS:
{{a_comments}}

ANALYSIS FRAMEWORK:

1. OVERALL SENTIMENT DISTRIBUTION:
   - Positive: [%]
   - Neutral: [%]
   - Negative: [%]
   - Volume trend (increasing, decreasing, stable)

2. TOPIC CLUSTERING:
   - What themes appear most frequently?
   - What specific aspects are praised?
   - What specific aspects are criticized?

3. EMOTIONAL ANALYSIS:
   - Primary emotions detected (gratitude, frustration, excitement, confusion, etc.)
   - Emotional intensity (mild, moderate, strong)
   - Emotional triggers (specific features, statements, events)

4. KEY INSIGHTS:
   - Most common positive themes (top 3)
   - Most common negative themes (top 3)
   - Neutral/feedback patterns to act on
   - Emerging trends or concerns

5. ACTIONABLE RECOMMENDATIONS:
   - Quick responses needed (escalations)
   - Content opportunities (address concerns, amplify positives)
   - Product/process improvement signals
   - Community management adjustments

OUTPUT:
Structured sentiment report with visual-ready summary and action items.
```

---

### 7.3 Crisis Response Drafter

**Purpose:** Draft careful, approved responses during sensitive situations or PR crises.

**Model Compatibility:** Claude 3.5 Sonnet, GPT-4o (quality and nuance critical)

**Template:**

```
You are a crisis communication specialist. Draft a response to the following situation.

SITUATION DESCRIPTION:
{{s_situation_description}}

SEVERITY LEVEL: {{e_severity}} (1 — minor complaint, 2 — growing concern, 3 — active crisis, 4 — full-scale PR crisis)
PLATFORM(S) AFFECTED: {{a_platforms}}
PUBLIC VISIBILITY: {{s_visibility}} (low, moderate, high, trending)
BRAND VOICE: {{o_brand_voice}}
STAKEHOLDER CONCERNS: {{a_stakeholder_concerns}}
LEGAL/BRAND CONSTRAINTS: {{s_legal_constraints}}
{{#if s_statement_from_leadership}}{{s_statement_from_leadership}}{{/if}}

CRISIS RESPONSE PRINCIPLES:
1. Acknowledge promptly (speed matters more than perfection in a crisis)
2. Take responsibility where appropriate
3. Be transparent about what you know and don't know
4. Show specific actions being taken
5. Avoid defensive language
6. Don't speculate
7. Keep human tone (not corporate speak)
8. Provide channel for follow-up

RESPONSE FORMATS:

PUBLIC STATEMENT (for main feed/post):
[2-4 paragraph statement suitable for public posting]

COMMENT REPLIES (for responding to individual concerns):
[3-5 template replies that can be adapted per comment]

DM RESPONSE (for private follow-up):
[template for moving conversation to private channel]

INTERNAL COMMUNICATION (team guidance):
[what to say, what not to say, escalation protocol]

OUTPUT:
Complete crisis response package with timing recommendations and approval checkpoints.

NOTE: All responses are DRAFTS requiring legal and leadership review before publishing.
```

---

### 7.4 DM Response Generator

**Purpose:** Generate brand-appropriate direct message responses for common scenarios.

**Model Compatibility:** GPT-4o-mini, Claude 3 Haiku

**Template:**

```
You are a direct messaging specialist. Draft a DM response.

CONTEXT: {{e_dm_type}} (inquiry, complaint, collaboration_request, support_question, fan_message, spam)
MESSAGE: {{s_dm_content}}
PLATFORM: {{e_platform}}
BRAND VOICE: {{o_brand_voice}}
USER TYPE: {{e_user_type}} (customer, prospect, fan, influencer, press, partner)

DM GUIDELINES:
- More conversational than public replies
- Can be longer (DM is a private channel)
- For complaints: de-escalate, offer solution, empathize
- For support: clear steps, patience, follow-up
- For collaborations: enthusiasm, clear next steps
- For fan messages: authentic appreciation
- For spam: no response (mark as spam)
- For press: professional, direct to PR contact

PLATFORM-SPECIFIC:
- Instagram DM: casual, can use voice messages
- LinkedIn DM: professional, structured
- X/Twitter DM: concise, direct
- Facebook Messenger: friendly, can be longer
- TikTok DM: casual, platform-native language

OUTPUT:
Provide {{n_variations}} response options and recommended autoresponder (if appropriate).
```
