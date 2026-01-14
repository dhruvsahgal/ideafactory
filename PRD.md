# IdeaFactory: Product Requirements Document

**Version:** 1.0  
**Author:** Dhruv  
**Last Updated:** January 2026  
**Status:** Draft for Review

---

## 1. Executive Summary

IdeaFactory is a personal idea capture and management system delivered through a Telegram bot interface with a companion web dashboard. Users submit ideas via voice notes or text messages, which are automatically transcribed, categorized by AI, and stored for later retrieval and pattern analysis.

**Core Value Proposition:** Capture fleeting ideas instantly through the messaging app you already use, with zero friction and intelligent organization you don't have to think about.

**Target Launch:** MVP in 8-10 weeks (solo development)

**Business Model:** Freemium with paid tier at $3-5/month (revised from initial $1/month due to unit economics constraints documented in Section 9).

---

## 2. Problem Statement

**The Problem:**  
High-velocity thinkers, founders, and creative professionals generate dozens of ideas daily. Most are lost because capture tools require too much friction (opening apps, choosing categories, typing) or because ideas arrive at inconvenient moments (driving, walking, falling asleep).

**Current Alternatives and Their Failures:**

| Solution | Failure Mode |
|----------|--------------|
| Notes apps (Apple Notes, Notion) | Requires unlocking phone, opening app, typing. High friction kills capture rate. |
| Voice memo apps | Creates audio graveyard. No transcription, no organization, no retrieval. |
| Dedicated idea apps (Mymind, Napkin) | Yet another app to remember to open. Not embedded in daily workflow. |
| Messaging self (WhatsApp, Telegram) | Unstructured chaos. No categorization. Impossible to retrieve or analyze. |

**Why Telegram:**  
Telegram is already running. Users already send voice notes. The bot lives where the behavior already exists.

---

## 3. User Personas

### Primary Persona: "The Overwhelmed Builder"

**Demographics:** Founder, PM, or creative professional. 28-45. Manages multiple projects simultaneously.

**Behaviors:**
- Generates 5-15 ideas per day across different domains
- Currently loses 80%+ of ideas because capture is inconvenient
- Has tried multiple note-taking systems, abandoned all of them
- Already uses Telegram daily for work or personal communication

**Pain Points:**
- "I had a great idea in the shower and forgot it by the time I dried off"
- "My notes are a graveyard of unorganized thoughts I never look at again"
- "I know I've had this idea before but I can't find where I wrote it down"

**Success Criteria:**
- Capture time under 10 seconds
- Can find any idea within 30 seconds
- Sees patterns in their thinking they didn't notice before

### Secondary Persona: "The Systematic Thinker"

**Demographics:** Researcher, writer, consultant. Needs to track ideas across long time horizons for synthesis.

**Behaviors:**
- Fewer ideas per day (2-5) but higher complexity
- Wants to see connections between ideas over months/years
- Values export and integration with other tools

**Pain Points:**
- "I need to connect ideas from 6 months ago to what I'm thinking now"
- "My ideas are scattered across 4 different apps"

---

## 4. Solution Overview

### 4.1 System Components

```
┌─────────────────┐      ┌─────────────────┐      ┌─────────────────┐
│   Telegram Bot  │ ──── │   Railway API   │ ──── │    Supabase     │
│   (Input Layer) │      │  (Processing)   │      │   (Persistence) │
└─────────────────┘      └─────────────────┘      └─────────────────┘
                                │
                                │
                         ┌──────┴──────┐
                         │             │
                    ┌────▼────┐   ┌────▼────┐
                    │  Groq   │   │ OpenAI  │
                    │(Primary)│   │(Fallback)│
                    └─────────┘   └─────────┘
                    
┌─────────────────┐
│   Svelte Web    │ ──── (reads from Supabase directly via client SDK)
│   Dashboard     │
└─────────────────┘
```

### 4.2 User Flow

**Capture Flow:**
1. User opens Telegram, finds IdeaFactory bot
2. User sends voice note OR text message
3. Bot acknowledges receipt immediately ("Got it, processing...")
4. System transcribes (if voice), categorizes, extracts metadata
5. Bot confirms with summary: "Saved: [truncated idea]. Category: Product. Tags: #pricing #saas"
6. Idea stored in Supabase with full metadata

**Retrieval Flow:**
1. User can query bot directly: "/search pricing" or "/category product"
2. User can open web dashboard for full table view, editing, and insights

---

## 5. Technical Architecture

### 5.1 Technology Stack

| Component | Technology | Rationale |
|-----------|------------|-----------|
| Bot Platform | Telegram Bot API | Ubiquitous, supports voice, excellent API |
| API Server | Node.js on Railway | Fast deployment, good free tier, scales easily |
| Database | Supabase (PostgreSQL) | Managed Postgres, built-in auth, real-time subscriptions, generous free tier |
| Transcription | Groq Whisper API (primary), OpenAI Whisper (fallback) | Groq is free/fast, OpenAI is reliable fallback |
| Categorization | Groq LLaMA (primary), OpenAI GPT-4o-mini (fallback) | Cost-effective, fast inference |
| Web Frontend | SvelteKit | Lightweight, fast, excellent DX for solo dev |
| Hosting (Web) | Vercel or Railway | Simple deployment, good free tier |
| Auth | Supabase Auth | Integrated with DB, supports magic link and OAuth |

### 5.2 AI Provider Abstraction

**Critical Architectural Decision:** Abstract AI providers behind a unified interface to enable seamless fallback and future provider swaps.

```typescript
interface AIProvider {
  transcribe(audioBuffer: Buffer): Promise<string>;
  categorize(text: string, existingCategories: string[]): Promise<CategoryResult>;
  generateInsights(ideas: Idea[]): Promise<InsightResult>;
}

class GroqProvider implements AIProvider { ... }
class OpenAIProvider implements AIProvider { ... }

// Usage with automatic fallback
const aiService = new AIServiceWithFallback([
  new GroqProvider(),
  new OpenAIProvider()
]);
```

### 5.3 Database Schema

```sql
-- Users table (managed by Supabase Auth, extended)
create table public.profiles (
  id uuid references auth.users primary key,
  telegram_user_id bigint unique not null,
  telegram_username text,
  display_name text,
  subscription_tier text default 'free',
  ideas_this_month integer default 0,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- Ideas table
create table public.ideas (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.profiles(id) on delete cascade,
  original_input_type text not null check (original_input_type in ('voice', 'text')),
  transcript text not null,
  transcript_edited text, -- user corrections
  category text not null,
  category_edited text, -- user override
  confidence_score numeric(3,2), -- AI confidence in categorization
  tags text[], -- AI-extracted tags
  source_context text, -- optional: what prompted this idea
  is_archived boolean default false,
  is_starred boolean default false,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- Categories table (for learning user's category preferences)
create table public.categories (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.profiles(id) on delete cascade,
  name text not null,
  description text,
  color text, -- hex color for UI
  idea_count integer default 0,
  created_at timestamptz default now(),
  unique(user_id, name)
);

-- Insights table (cached insights for performance)
create table public.insights (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.profiles(id) on delete cascade,
  insight_type text not null, -- 'pattern', 'trend', 'suggestion'
  content jsonb not null,
  generated_at timestamptz default now(),
  expires_at timestamptz
);

-- Indexes for query performance
create index ideas_user_id_idx on public.ideas(user_id);
create index ideas_category_idx on public.ideas(category);
create index ideas_created_at_idx on public.ideas(created_at);
create index ideas_tags_idx on public.ideas using gin(tags);
```

### 5.4 API Endpoints

**Telegram Webhook Handler:**
```
POST /api/telegram/webhook
- Receives all Telegram updates
- Validates webhook secret
- Routes to appropriate handler (voice, text, command)
```

**Internal API (for web dashboard):**
```
GET    /api/ideas              - List ideas (paginated, filterable)
GET    /api/ideas/:id          - Get single idea
PATCH  /api/ideas/:id          - Update idea (transcript, category)
DELETE /api/ideas/:id          - Soft delete (archive) idea
GET    /api/categories         - List user's categories with counts
GET    /api/insights           - Get current insights
POST   /api/insights/generate  - Force regenerate insights
GET    /api/stats              - Usage statistics
```

**Authentication:**  
All API endpoints (except Telegram webhook) require Supabase JWT. Web dashboard uses Supabase client SDK for auth.

---

## 6. Feature Specification: MVP (v1.0)

### 6.1 Telegram Bot Features

**F1: Voice Note Capture**
- Accept voice notes up to 5 minutes (configurable)
- Transcribe using Groq Whisper, fallback to OpenAI
- Respond within 10 seconds with confirmation
- Handle failures gracefully: "Couldn't process that voice note. Try again or send as text."

**F2: Text Message Capture**
- Accept text messages of any length
- No processing delay beyond categorization
- Same confirmation format as voice

**F3: AI Categorization**
- Infer category from content using LLM
- Start with seed categories: Product, Business, Personal, Creative, Technical, Learning
- Learn new categories from user corrections over time
- Include confidence score in database (not shown to user unless low)

**F4: Tag Extraction**
- Extract 1-5 relevant tags from each idea
- Tags are lowercase, alphanumeric
- Common tags should merge (e.g., "AI" and "artificial intelligence" become "ai")

**F5: Bot Commands**
```
/start       - Onboarding flow, links Telegram to account
/help        - Command reference
/recent      - Last 5 ideas
/search X    - Search ideas containing X
/category X  - List ideas in category X
/stats       - Quick stats (total ideas, top categories)
/web         - Link to web dashboard
```

**F6: Quick Actions (Inline Keyboards)**  
After saving an idea, offer inline buttons:
- "✏️ Edit" → prompts user to send corrected text
- "🏷️ Recategorize" → shows category options
- "⭐ Star" → marks as important

### 6.2 Web Dashboard Features

**F7: Ideas Table View**
- Sortable columns: Date, Category, Preview (truncated transcript)
- Filter by: Category, Date range, Tags, Starred, Archived
- Search across all transcripts (full-text search via Supabase)
- Pagination: 50 ideas per page default

**F8: Idea Detail/Edit Modal**
- View full transcript
- Edit transcript (saves to transcript_edited, preserves original)
- Change category (dropdown of existing + "Create new")
- Add/remove tags
- Star/unstar
- Archive/delete

**F9: Category Management**
- View all categories with idea counts
- Rename categories (updates all associated ideas)
- Merge categories
- Assign colors for visual distinction

**F10: Insights Panel (MVP)**
- Top 3 categories by volume (last 30 days)
- Ideas per week trend (simple line chart)
- Most common tags (tag cloud or list)
- "You've captured X ideas this month, Y more than last month"

**F11: Authentication**
- Magic link login (email)
- Telegram deep-link for connecting bot to web account
- Session management

### 6.3 Non-Functional Requirements

| Requirement | Target | Measurement |
|-------------|--------|-------------|
| Voice transcription latency | < 8 seconds for 60s audio | P95 latency |
| Bot response time | < 3 seconds for text | P95 latency |
| Dashboard load time | < 2 seconds | Lighthouse |
| Uptime | 99.5% | Monthly |
| Data retention | Indefinite | Policy |

---

## 7. Insights Engine: Detailed Specification

Since insights are MVP, here's the detailed approach:

### 7.1 Insight Types

**Type 1: Volume Patterns**
- Ideas per day/week/month trends
- Comparison to previous periods
- Peak capture times (hour of day, day of week)

**Type 2: Category Distribution**
- Category breakdown (pie/bar chart)
- Category trends over time
- Emerging categories (new category gaining volume)

**Type 3: Tag Analysis**
- Most frequent tags
- Tag co-occurrence (which tags appear together)
- Rising tags (increasing frequency)

**Type 4: Content Patterns (LLM-Generated)**
- Recurring themes across ideas
- "You keep thinking about X" summaries
- Suggested connections between ideas

### 7.2 Generation Strategy

Insights are expensive to compute (especially LLM-based). Strategy:

1. **Scheduled generation:** Regenerate insights daily at 3 AM UTC
2. **On-demand generation:** User can force refresh (rate limited: 1/hour)
3. **Caching:** Store in insights table with expiration
4. **Incremental updates:** Volume/category stats can update in real-time; LLM insights are batched

### 7.3 Prompt Engineering for Insights

```
System: You are an analyst helping a user understand patterns in their idea log.

Given the following ideas from the past 30 days, provide:
1. Three recurring themes you notice
2. Any interesting connections between seemingly unrelated ideas
3. One observation about their thinking patterns

Be specific. Reference actual ideas by quoting key phrases. Keep total response under 200 words.

Ideas:
{ideas_json}
```

---

## 8. User Onboarding Flow

### 8.1 Telegram-First Onboarding

```
User finds bot → /start

Bot: "Welcome to IdeaFactory! 🧠

I capture and organize your ideas so you never lose a good thought again.

Send me a voice note or text message with any idea, and I'll:
✓ Transcribe it (if voice)
✓ Automatically categorize it
✓ Store it for easy retrieval

Try it now—send me your first idea!"

[User sends idea]

Bot: "Got it! Here's what I captured:

💡 [Truncated transcript]
📁 Category: [Category]
🏷️ Tags: #tag1 #tag2

Want to see all your ideas? Set up your web dashboard:
[Button: Create Web Account]

Or just keep sending ideas—I'll save them to your Telegram account until you're ready."
```

### 8.2 Account Linking

Two paths to link Telegram to web account:

**Path A: Telegram → Web**
1. User clicks "Create Web Account" in bot
2. Bot generates unique token, sends magic link
3. User clicks link, lands on web with token in URL
4. Web creates Supabase account, links to Telegram user ID
5. User sets email for future logins

**Path B: Web → Telegram**
1. User signs up on web
2. Web shows "Connect Telegram" with deep link
3. User clicks, opens Telegram, starts bot
4. Bot detects existing web account via token, links

---

## 9. Monetization Strategy (v2)

### 9.1 Unit Economics Reality Check

**Initial assumption:** $1/month  
**Problem:** Stripe fees are ~$0.30 + 2.9% per transaction

| Price Point | Stripe Fee | Net Revenue | Users for $1K/mo |
|-------------|------------|-------------|------------------|
| $1/month | $0.33 | $0.67 | 1,493 |
| $3/month | $0.39 | $2.61 | 384 |
| $5/month | $0.45 | $4.55 | 220 |
| $10/year | $0.59 | $9.41 | 1,275/year |

**Recommendation:** $5/month or $36/year (25% discount for annual).

### 9.2 Tier Structure

**Free Tier (Forever)**
- 50 ideas per month
- AI categorization
- Basic web dashboard (table view, edit, search)
- 30-day insight history
- Single device Telegram

**Pro Tier ($5/month or $36/year)**
- Unlimited ideas
- Full insight history (all time)
- Advanced insights (LLM-generated patterns)
- Bulk export (JSON, CSV, Markdown)
- API access for integrations
- Priority transcription (skip queue during peak)
- Multiple Telegram accounts linked

### 9.3 Upsell Triggers

**In-bot:**
- At 40 ideas: "You've captured 40 ideas this month. Upgrade to Pro for unlimited."
- When insights are limited: "Upgrade to Pro for full pattern analysis."

**In-web:**
- Soft paywall on advanced insights tab
- Export button shows "Pro" badge, modal on click

### 9.4 Payment Implementation

- Stripe Checkout for payment
- Stripe Customer Portal for subscription management
- Webhook handler for subscription events (created, updated, canceled)
- Supabase stores subscription_tier and stripe_customer_id

---

## 10. Security and Privacy

### 10.1 Data Security

| Concern | Mitigation |
|---------|------------|
| Ideas contain sensitive thoughts | All data encrypted at rest (Supabase default). HTTPS everywhere. |
| Telegram user ID exposure | Never expose raw Telegram IDs in web UI or API responses |
| AI provider sees content | Accepted risk for functionality. Can add on-device processing in v3. |
| Account takeover | Supabase Auth handles session security. Magic link preferred over password. |

### 10.2 Privacy Policy Requirements

Document and display:
- What data is collected (transcripts, metadata, Telegram ID)
- How AI providers process data (Groq/OpenAI privacy policies)
- Data retention policy (indefinite unless user deletes)
- User rights (export, delete account, GDPR compliance)

### 10.3 Data Deletion Flow

- User can delete individual ideas (soft delete, then hard delete after 30 days)
- User can delete account (cascades to all data)
- Implement `/deleteaccount` command in bot with confirmation

---

## 11. Success Metrics

### 11.1 North Star Metric

**Ideas captured per active user per week**

Target: 10+ ideas/week average indicates habit formation.

### 11.2 Supporting Metrics

| Metric | Target (Month 3) | Why It Matters |
|--------|------------------|----------------|
| Weekly Active Users | 500 | Growth baseline |
| Ideas/WAU/Week | 10 | Engagement depth |
| Voice vs Text ratio | 40/60 | Voice = lower friction = healthy |
| Web dashboard usage | 30% of users | Indicates retrieval value |
| Day 7 retention | 40% | Habit formation |
| Free → Pro conversion | 5% | Monetization viability |

### 11.3 Instrumentation Plan

Track via Supabase + simple analytics (Plausible or PostHog free tier):
- Bot events: idea_captured, command_used, error_occurred
- Web events: page_view, idea_edited, category_changed, insight_viewed
- Funnel: signup → first_idea → day_7_return → pro_conversion

---

## 12. Risks and Mitigations

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| Groq discontinues free tier | High | High | Provider abstraction already built; OpenAI fallback ready |
| Telegram rate limits bot | Medium | High | Implement queue with backoff; cache responses |
| AI miscategorizes consistently | Medium | Medium | User corrections feed back into prompt; manual override always available |
| Users don't return after capture | High | High | Insights and retrieval must demonstrate value; email digest feature in v2 |
| Low conversion at $5/month | Medium | Medium | Test $3/month; emphasize annual discount; consider lifetime deal for early users |
| Transcription quality issues (accents, noise) | Medium | Medium | Allow transcript editing; show original audio in v2 if needed |

---

## 13. Out of Scope for MVP

Explicitly not building in v1:
- Audio storage (transcript only)
- Mobile app (web is mobile-responsive)
- Collaboration/sharing ideas
- Integrations (Notion, Obsidian, etc.)
- Offline support
- Multi-language support (English-first)
- Desktop app

These are candidates for v2/v3 based on user feedback.

---

## 14. Development Roadmap

### Phase 1: Foundation (Weeks 1-3)
- Supabase project setup, schema deployed
- Railway project, basic Express/Fastify server
- Telegram bot skeleton (receives messages, replies)
- AI provider abstraction layer

### Phase 2: Core Capture (Weeks 4-5)
- Voice transcription integration (Groq + fallback)
- AI categorization implementation
- Idea storage with full metadata
- Bot command handlers

### Phase 3: Web Dashboard (Weeks 6-8)
- SvelteKit project setup
- Supabase Auth integration
- Ideas table with sort/filter
- Edit modal
- Category management

### Phase 4: Insights + Polish (Weeks 9-10)
- Insights panel (volume, categories, tags)
- LLM-generated pattern insights
- Onboarding flow refinement
- Error handling and edge cases
- Performance optimization

### Phase 5: Launch Prep (Week 11)
- Documentation (privacy policy, help docs)
- Landing page
- Beta user recruitment
- Monitoring and alerting setup

---

## 15. Open Questions for Review

1. **Category seeding:** Should new users start with predefined categories, or should the system learn from scratch? Predefined reduces cold-start problem but may not fit user's mental model.

2. **Duplicate detection:** Should the system flag potential duplicate ideas? Adds complexity but prevents clutter.

3. **Time zone handling:** Ideas stored in UTC. Web dashboard should display in user's local time. Need to capture/store user timezone preference.

4. **Notification strategy:** Should the bot ever proactively message users? (Weekly summary, "You haven't captured ideas in 7 days"). Can increase engagement but risks being annoying.

5. **Public vs self-hosted:** Is there appetite for a self-hosted option (Docker image) for privacy-conscious users? Would impact architecture decisions.

---

## Appendix A: Competitive Landscape

| Product | Strength | Weakness | Differentiation |
|---------|----------|----------|-----------------|
| Notion | Flexible, powerful | Too much friction for quick capture | IdeaFactory is capture-first |
| Apple Notes | Native, fast | No AI, no categorization | IdeaFactory adds intelligence |
| Otter.ai | Great transcription | Meeting-focused, not idea-focused | IdeaFactory is for fragments |
| Mymind | Beautiful, AI-powered | Separate app, paid only | IdeaFactory lives in Telegram |
| Mem.ai | AI-native notes | Complex, expensive | IdeaFactory is simple, cheap |

---

## Appendix B: Example User Interactions

**Voice Note Capture:**
```
User: [Sends 45-second voice note about a pricing idea]

Bot: "Got it! Here's what I captured:

💡 "What if we did usage-based pricing for the API tier? 
    Charge per 1000 requests after a free threshold. 
    Need to research what Stripe charges for metered billing..."

📁 Category: Business
🏷️ Tags: #pricing #api #stripe

[Edit] [Recategorize] [Star]"
```

**Search Retrieval:**
```
User: /search stripe

Bot: "Found 3 ideas mentioning 'stripe':

1. [Dec 15] Business: Usage-based pricing for API...
2. [Dec 3] Technical: Stripe webhook handling for...
3. [Nov 28] Business: Payment flow for onboarding...

[View in Dashboard]"
```

---

## Document History

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0 | Jan 2026 | Dhruv | Initial draft |

---

*End of document.*
