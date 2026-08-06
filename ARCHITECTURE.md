# Code-UP — Architecture & Implementation Guide

## Project Overview

Code-UP is a premium Egyptian EdTech platform targeting secondary students (4th Primary → 3rd Secondary) with an Arabic-first, dark-native UI, AI-powered educational intelligence, multi-provider secure video delivery, and an access-code enrollment model managed by teachers and a superadmin.

> **Last updated:** 2026-08-02. This document reflects the full platform including **AI Engine Milestones 1–6**, **Sha7nawy Mobile Wallet Payment Gateway (Vodafone Cash, Orange Cash, Etisalat Cash with 2% tax processing & white-labeled UI)**, **Platform Balance Payments**, and **Teacher Panel Subscription Plan Access Code Generation**.

---

## System Architecture Overview

```
┌─────────────────────────────────────────────────────────────────────────┐
│                         Code-UP Platform                                │
│                                                                         │
│  ┌──────────────┐   ┌──────────────────────────────────────────────┐   │
│  │   Next.js    │   │               AI Engine Layer                │   │
│  │  App Router  │◄──┤                                              │   │
│  │  (React 19)  │   │  AIGateway → ProviderManager → Providers    │   │
│  │              │   │       ↓              ↓                       
│  │  /app        │   │  ToolFramework  GeminiPoolManager            │   │
│  │  /api        │   │  ContextBuilder  BudgetManager               
 
│  │  /components │   │  PromptBuilder   ProviderMonitor             │   │
│  └──────┬───────┘   │  RAG / Memory    AlertCenter                 │  
             └──────────────────────────────────────────────┘   │
│  ┌──────────────┐                      │                                │
│  │  Prisma ORM  │◄─────────────────────┘                               │
│  │  SQLite(dev) │   (AI Engine reads platform data through Tools only) │
│  └──────────────┘                                                       │
└─────────────────────────────────────────────────────────────────────────┘
```

**Core Rule:** The AI Engine **never** queries Prisma directly. Every platform capability is exposed as a Tool. The `BudgetManager` runs a pre-flight cost check on every request before it reaches a provider.

---

## Tech Stack

### Frontend
- **Framework**: Next.js 16 App Router (React 19)
- **Styling**: Tailwind CSS 4 with a CSS-variable design-token layer (`--bg / --surface / --card / --border / --ink / --ink-muted / --accent`, plus a semantic z-index scale)
- **Animations**: Framer Motion ^12.40
- **Charts**: hand-rolled dependency-free SVG charts (`src/components/admin/Charts.tsx`)
- **Language**: TypeScript
- **Direction**: RTL (Arabic primary), `Cairo` font family

### Backend
- **Runtime**: Node.js + Next.js API Routes
- **Database**: SQLite (dev) via Prisma ORM. Client generated to `src/generated/prisma`
- **Authentication**: JWT-based via `jose`, HTTP-only cookie (`auth_token`), 7-day expiry
- **Password Hashing**: bcryptjs
- **Encryption**: AES-256-GCM for AI provider API keys (`CONFIG_ENCRYPTION_KEY`)

### Video Delivery — Multi-Provider
- **VdoCipher** — server-side OTP (strongest DRM)
- **Bunny Stream** — SHA256-signed embed token
- **YouTube** — unlisted via `youtube-nocookie.com` (domain + referrer protection)

Dispatcher: `src/lib/video-provider.ts` → `resolveEmbedUrl(video)` + `validateProviderId()`.

---

## Database Schema

### Core Models

| Model | Purpose |
|---|---|
| `User` | Multi-role (student / teacher / superadmin). `isOwner`, `isVirtual`, soft-delete via `isActive` |
| `Course` | Teacher-created. `isVirtual` for demo data |
| `Folder` | Hierarchical organization within courses. Sortable via `order` |
| `Video` | Multi-provider: `videoProvider` + `providerVideoId`. `durationMinutes` + `maxWatchesPerUser` |
| `VideoWatchSession` | 4-hour session token; consumes one watch slot per video |
| `Progress` | `(studentId, videoId)` unique; `watched` + `watchedAt` |
| `Quiz` | Multiple-choice (A/B/C/D), time limit, question ordering |
| `AccessCode` | Unique per course; deactivatable; tracks usage |
| `DailyStudyPlan` | JSON plan content; status: pending → in_progress → completed |
| `PlatformConfig` | Editable platform constants with 60-second in-memory cache |
| `AIProvider` | Superadmin-managed providers; AES-256-GCM encrypted API keys |
| `AppSetting` | Key-value store for maintenance mode, site text, etc. |
| `BulkDeletionRequest` | Scheduled or instant bulk account deletion with 7-day cancel window |
| `SupportTicket` | Student-filed tickets surfaced in the teacher issues feed |
| `StudentFeedback` | Unresolved feedback surfaced in the issues feed |
| `ClientError` | Platform error reports surfaced in the issues feed |

---

## AI Engine — Complete Layer Map

The AI Engine lives entirely in `src/ai/` and is organized into subsystems. The platform → AI dependency always flows **down** through the Tool layer.

```
src/ai/
├── AIEngine.ts                  # Orchestrator — assembles all subsystems
├── index.ts                     # Barrel export
│
├── tools/                       # Every platform capability as a Tool
│   ├── ToolRegistry.ts          # Registers and looks up all tools
│   ├── ToolExecutor.ts          # Safe execution with validation + health
│   └── [domain tools]           # StudentTool, CourseTool, QuizTool, HomeworkTool, TeacherTool…
│
├── providers/                   # AI provider adapters
│   ├── BaseProvider.ts          # Abstract base: generate(), stream(), capabilities
│   ├── ProviderManager.ts       # Selects provider: priority → fallback → mock
│   ├── GeminiProvider.ts        # Gemini via GeminiPoolManager
│   ├── DeepSeekV4FlashProvider.ts  # DeepSeek V4 Flash
│   └── MockProvider.ts          # Deterministic offline provider for tests
│
├── gateway/
│   └── GeminiPoolManager.ts     # Multi-key Gemini pool: score-based selection,
│                                #   429/401/5xx handling, no secret key exposure
│
├── context/                     # Request context assembly
│   ├── ContextBuilder.ts        # Assembles student + course + lesson context
│   └── SessionContext.ts        # Per-request session tracking
│
├── prompts/                     # Prompt engineering layer
│   ├── PromptBuilder.ts         # Builds system + user prompts from templates
│   └── PromptTemplates.ts       # Per-action Arabic prompt templates
│
├── knowledge/                   # RAG & knowledge loading
│   ├── KnowledgeLoader.ts       # Subject-aware knowledge injection
│   └── SubjectKnowledge.ts      # Domain knowledge per subject
│
├── rag/                         # Retrieval-augmented generation
│   ├── RAGPipeline.ts           # Retrieval → augmentation → generation
│   └── SimilarQuestionDetector.ts  # Arabic-normalized deduplication
│
├── state_machine/               # Educational progress tracking
│   ├── EducationalStateMachine.ts   # Student state: onboarding → active → mastery
│   └── StateTransitions.ts          # Transition rules per action
│
├── memory/                      # Conversation & student memory
│   ├── ConversationMemory.ts    # Per-session rolling context
│   └── StudentMemory.ts         # Long-term student profile memory
│
├── router/                      # AI action routing
│   └── AIRouter.ts              # Routes intents to the correct handler
│
├── intent/                      # Intent classification
│   └── IntentClassifier.ts      # Detects what the student is trying to do
│
├── actions/                     # Domain-specific AI actions
│   └── [Explain, Quiz, Plan, Homework, Exam, Report…]
│
├── modes/                       # Operating mode guards
│   └── AIMode.ts                # Development / Testing / Sandbox / Staging / Production
│
├── telemetry/                   # Request lifecycle telemetry
│   └── AITelemetry.ts           # Records every request, latency, token count
│
├── config/                      # AI engine runtime config
│   └── AIConfig.ts              # Feature flags, limits, toggles
│
└── admin/                       # AI Operations Platform (Milestone 6)
    ├── budget/
    │   ├── BudgetPolicies.ts    # Per-dimension limit configs
    │   ├── BudgetTracker.ts     # Incremental per-dimension spending accumulators
    │   ├── BudgetAlerts.ts      # Threshold alerts: Warning/Economy/Degraded/Critical/Emergency
    │   └── BudgetManager.ts     # Pre-flight cost checks + auto cost reduction
    │
    ├── monitoring/
    │   ├── ProviderMonitor.ts         # 28 independent stats per provider
    │   └── GeminiClusterDashboard.ts  # Safe Gemini pool overview (no keys exposed)
    │
    ├── explorer/
    │   └── AIRequestExplorer.ts  # 10K-record searchable request log
    │
    ├── dashboard/
    │   └── LiveAIDashboard.ts    # Cards + hourly graphs + heatmaps
    │
    ├── optimizer/
    │   └── BudgetOptimizer.ts    # Nightly analysis + AIFinancialAdvisor midnight reports
    │
    ├── routing/
    │   └── RoutingAnalytics.ts   # Explains every provider selection with reasons + confidence
    │
    ├── analytics/
    │   └── AIAnalytics.ts        # StudentAIAnalytics · TeacherAnalytics · ParentAnalytics
    │                             # CacheAnalytics · ProviderComparison
    │
    ├── alerts/
    │   └── AlertCenter.ts        # Superadmin alert hub (budget/provider/security/abuse)
    │
    ├── config/
    │   └── AIOperationsConfig.ts # Full runtime control — all changes auto-audited
    │
    └── audit_logging/
        ├── AIAuditSystem.ts      # 5K-ring audit trail (who · ip · prev · new · reason)
        └── AILogger.ts           # Structured AI request logger
```

---

## AI Engine — Milestone Summary

### Milestone 1 — Foundation
Establishes the core AI engine scaffolding:
- `AIEngine.ts` orchestrator
- `BaseProvider` abstract class with `generate()`, `stream()`, `capabilities`
- `MockProvider` for deterministic offline development
- `ProviderManager` with priority → fallback chain
- `AITelemetry` recording every request lifecycle
- Feature flag system for instant enable/disable

### Milestone 2 — Educational Intelligence
- **EducationalStateMachine**: onboarding → active learning → mastery state transitions per student
- **IntentClassifier**: detects student intent (explain / quiz / plan / help)
- **ContextBuilder**: assembles full educational context (student profile, current lesson, course progress)
- **PromptBuilder + PromptTemplates**: Arabic-first per-action prompt engineering
- **KnowledgeLoader + SubjectKnowledge**: domain knowledge injection per Egyptian curriculum subject
- **ConversationMemory + StudentMemory**: session-level and long-term student memory

### Milestone 3 — Universal Tool Framework
The AI never touches Prisma. Every platform capability is a Tool:

| Tool | Operations |
|---|---|
| `StudentTool` | GetStudentProfile, GetWeeklyStats, GetStudyStreak |
| `CourseTool` | GetCurrentCourse, GetLesson, GetLessonObjectives, GetCourseProgress, GetLockedLessons |
| `QuizTool` | GenerateQuiz, StartQuiz, SubmitQuiz, GradeQuiz, AnalyzeQuiz, RetryIncorrectQuestions |
| `HomeworkTool` | GetHomework, SubmitHomework, AnalyzeHomework, GenerateHomework |
| `TeacherTool` | TeacherAnalytics |

Every Tool implements: `name()` · `description()` · `parameters()` · `execute()` · `validate()` · `health()`

### Milestone 4 — AI Administration, Personalization & Memory
- **AI Administration Dashboard** inside `/adminpanel/superadmin`
- **AIAuditSystem** for every AI configuration change (who / when / prev / new / reason / IP)
- **CostManager** tracking cost per provider / subject / action
- **AIHealthDashboard** exposing provider health, error rates, and latency
- **Feature Flag system** — every AI capability can be disabled instantly from the panel

### Milestone 5 — Production Infrastructure
- **Deployment modes**: Development / Testing / Sandbox / Staging / Production / Maintenance / Emergency
- **Multi-provider orchestration**: unlimited providers, health-weighted selection
- **RAG Pipeline**: `KnowledgeLoader` → `SimilarQuestionDetector` (Arabic normalization) → vector retrieval
- **Prompt safety layer**: injection detection, jailbreak guards, student safety filters
- **DeepSeek V4 Flash Provider**: integrated as the first production provider

### Milestone 6 — AI Operations Platform (Full Observability)

#### Budget Manager
- **Pre-flight cost check** before every request: estimates cost → allow / reject / redirect / use-cheaper
- **7 tracking dimensions**: Global · Provider · Subject · Grade · Student · Teacher · Action
- **Automatic cost reduction tiers**:

  | Budget Used | Mode | Automatic Action |
  |---|---|---|
  | ≥ 50% | Warning | Superadmin notified |
  | ≥ 75% | Economy | Prefer cheaper provider, increase cache TTL |
  | ≥ 90% | Degraded | Reduce response length, prefer Gemini Lite |
  | ≥ 95% | Critical | Disable EXAM, PLAN, long reports |
  | ≥ 100% | Emergency | Policy: reject / deepseek / gemini / cache_only |

#### Provider Monitor
Tracks **28 stats per provider** in rolling minute + hour windows:
- Requests/tokens (daily / hourly / per-minute), latency, success rate, error breakdown (429 / 401 / 5xx / timeout), cache hit rate, fallback count, estimated cost

#### Gemini Pool Manager
- Scores every API key: `(Quota×35%) + (Health×25%) + (Latency×15%) + (MinuteUsage×15%) + (DailyUsage×10%)`
- Always selects highest-scoring active key
- 429 → `CoolingDown` until `retry-after` expires
- 401 → permanent `Disabled`
- 5xx → temporary score penalty (self-healing)
- **Zero secret key exposure** — `getAllAccountStats()` uses `Omit<..., "secretKey">`

#### AI Request Explorer
- Stores up to **10,000 requests** in a ring buffer
- Multi-field search: student · teacher · provider · action · subject · grade · date · cost · tokens · latency · cacheHit · fallback

#### Live AI Dashboard
- **Cards**: Requests Today · Tokens Today · Cost Today · Avg Latency · Budget Level
- **Hourly graphs**: requests / tokens / cost / errors (last 24 h)
- **Heatmaps**: most expensive subjects & actions
- **Provider distribution** chart

#### Budget Optimizer + AI Financial Advisor
Nightly analysis across 4 recommendation categories:
- `cache` — increase cache TTL, serve repeated prompts from cache
- `prompt_compression` — reduce oversized contexts
- `provider_routing` — route simple requests to cheaper providers
- `action_disable` — disable expensive actions in economy mode

**AI Financial Advisor** generates an Arabic midnight report:
```
📊 تقرير المستشار المالي للذكاء الاصطناعي — 2026-07-23
💰 تكلفة أمس: $3.42
💡 توفير محتمل: $1.08 (31%)
📋 الأسباب:
  1. 241 طلب متكرر كان يمكن تقديمه من التخزين المؤقت.
  2. متوسط الـ prompt كان 34% أكبر من اللازم.
✅ التوصيات:
  1. زيادة مدة التخزين المؤقت
  2. توجيه الطلبات البسيطة إلى Gemini
```

#### Routing Analytics
Explains every provider selection:
```
Student Question → Gemini
Reasons:
  • معدل نجاح مرتفع (100%)        High health
  • متوسط استجابة ممتاز (212ms)   Fastest latency
  • أعلى نتيجة في المجموعة (97/100) Available quota
Confidence: 99%
```

#### Analytics Suite (`AIAnalytics.ts`)
- **StudentAIAnalytics**: questions asked, AI dependency score, favorite subject, cost per student
- **TeacherAnalytics**: students helped, reports generated, feature usage, cost
- **ParentAnalytics**: reports generated, read rate, improvement tracking
- **CacheAnalytics**: hits/misses/saved tokens per tier (PromptCache / RAGCache / ResponseCache / MemoryCache)
- **ProviderComparison**: ranked table — requests · latency · cost · success · errors · fallbacks · avg tokens

#### Alert Center
Superadmin notification hub with severity (Info / Warning / Error / Critical) and categories:
- **Budget**: 50%/75%/90%/95%/100% threshold events
- **Provider**: offline, degraded health
- **Quota**: 429 spike detection
- **Auth**: 401 → key auto-disabled notification
- **Latency**: high response time warning
- **Security**: prompt injection + jailbreak attempt detection
- **Abuse**: student sending too many requests in a short window

#### AI Operations Config
Full runtime control surface — everything configurable without code changes:
- Daily/monthly budget limits
- Provider mode: Economy / Balanced / Quality
- Token limits, context size, cache TTL, max retries
- Enable/disable: specific providers, actions, subjects, grades
- Provider priority order
- **Every change is automatically written to the Audit Trail**

#### Audit Trail (`AIAuditSystem`)
- **5,000-record ring buffer** (up from 1K)
- Every entry records: `who · ip · action · previousValue · newValue · reason · timestamp`
- `filterByWho(admin)` and `filterByAction(prefix)` for panel queries

---

## Parent Follow-up System (متابعة ولي الأمر)

Implemented as a **platform feature** — not an AI feature. Statistics come entirely from platform data; AI is only optionally used for summary sentences.

```
src/services/parent/
├── ParentService.ts          # Parent profiles, student linking, retrieval by student ID
├── ParentStatsCalculator.ts  # All weekly metrics from DB (lessons, videos, homework, quizzes, streak)
├── WeeklyReportGenerator.ts  # Formatted Friday evening report (Arabic) + SMS-friendly version
└── index.ts                  # Barrel export
```

Every Friday the report includes: per-subject scores, homework submitted/total, quiz performance, study time, current streak, weak topics, strong topics, and a next-week recommendation.

---

## Platform Control, Settings & Security

All superadmin controls live under `/adminpanel/superadmin` with matching routes under `/api/admin/superadmin/*`.

### Superadmin Accounts
- **Four named superadmins** seeded via `scripts/seed-superadmins.mjs`: Ahmed (owner), Mohamed, Adham, Yassen. `User.isOwner` marks the single owner.
- DB-backed bcrypt login OR env master password (`SUPERADMIN_MASTER_PASSWORD`) as break-glass.
- **Three passwords, one job each**: `SUPERADMIN_MASTER_PASSWORD` (break-glass), `SUPERADMIN_ACTION_PASSWORD` (sensitive action confirmation), `BULK_DELETE_PASSWORD` (Danger Zone gate + instant deletion).

### Maintenance Mode
- Toggle + editable message in `AppSetting`. Public visitors see `MaintenanceScreen`. Superadmins always bypass. Gated in `layout.tsx`.

### Bulk Account Deletion (Danger Zone)
- Three scopes: all / students / teachers. Scheduled (7-day, cancellable) or instant (env-password). Soft-deletes then permanently purges after `trash_purge_days` (≥1 day, default 30).

### PlatformConfig (Advanced Settings)
- `lib/config.ts` with `getConfig / getConfigNumber / getConfigBool / setConfig` and 60-second in-memory cache.
- Config-driven values: JWT expiry, watch-session hours, default `maxWatchesPerUser`, mark-complete %, max videos per folder, AI max tokens, trash-purge days.

### AI Providers (Encrypted)
- `AIProvider` model: name, slug, base URL, models, encrypted API key (AES-256-GCM).
- Keys **never returned** to the client — only `hasKey: boolean`. Decryption is server-side only.
- `/api/ai/study-plan` reads primary → backup → static default from DB.

---

## Environment Variables

```env
# Database
DATABASE_URL=file:./prisma/dev.db

# JWT
JWT_SECRET=your-secret-key

# Encryption (≥32 chars, STABLE — changing breaks saved AI keys)
CONFIG_ENCRYPTION_KEY=your-32-char-minimum-encryption-key

# Video providers
VDOCIPHER_API_SECRET=...
BUNNY_LIBRARY_ID=...
BUNNY_API_KEY=...
BUNNY_TOKEN_AUTHENTICATION_KEY=...
BUNNY_CDN_HOSTNAME=iframe.mediadelivery.net

# Admin passwords
SUPERADMIN_MASTER_PASSWORD=...
SUPERADMIN_ACTION_PASSWORD=...
BULK_DELETE_PASSWORD=...

# AI Providers — Gemini Pool
GEMINI_KEY_1=your-first-gemini-api-key
GEMINI_KEY_2=your-second-gemini-api-key
GEMINI_KEY_3=your-third-gemini-api-key
# Add GEMINI_KEY_4, GEMINI_KEY_5… for additional pool accounts

# AI Providers — Other
DEEPSEEK_API_KEY=...
DEEPSEEK_BASE_URL=https://api.deepseek.com
DEEPSEEK_MODEL=deepseek-chat

# Site
NEXT_PUBLIC_APP_NAME=Code-UP
NEXT_PUBLIC_SITE_URL=http://localhost:3000
NEXT_PUBLIC_PAYMENT_ACCESS_PASSWORD=+20XXXXXXXXXX
```

---

## File Structure (Key Paths)

```
j:/crispy-octo-doodle-1/
├── src/
│   ├── app/
│   │   ├── layout.tsx                  # Root layout, dark mode, maintenance gate
│   │   ├── page.tsx                    # Home (server-rendered, reads AppSetting)
│   │   ├── courses/[id]/learn/         # TOFAS-style inline learn experience
│   │   ├── adminpanel/
│   │   │   ├── teacher/               # Teacher dashboard
│   │   │   └── superadmin/            # Superadmin dashboard + AI Operations
│   │   └── api/
│   │       ├── auth/                  # Signup / login / logout / me
│   │       ├── courses/               # Course CRUD + watch sessions
│   │       ├── videos/                # Watch session, secure URL, complete
│   │       ├── quizzes/               # Quiz CRUD + submit
│   │       ├── codes/                 # Access code redemption
│   │       ├── progress/              # Progress tracking
│   │       ├── ai/                    # Study plans
│   │       ├── admin/                 # Teacher routes + analytics
│   │       └── admin/superadmin/      # Superadmin routes (maintenance, bulk-delete…)
│   │
│   ├── ai/                            # ── AI ENGINE ──
│   │   ├── AIEngine.ts                # Orchestrator
│   │   ├── providers/                 # BaseProvider, ProviderManager, Gemini, DeepSeek, Mock
│   │   ├── gateway/                   # GeminiPoolManager
│   │   ├── tools/                     # ToolRegistry, ToolExecutor, domain tools
│   │   ├── context/                   # ContextBuilder, SessionContext
│   │   ├── prompts/                   # PromptBuilder, PromptTemplates
│   │   ├── knowledge/                 # KnowledgeLoader, SubjectKnowledge
│   │   ├── rag/                       # RAGPipeline, SimilarQuestionDetector
│   │   ├── state_machine/             # EducationalStateMachine, StateTransitions
│   │   ├── memory/                    # ConversationMemory, StudentMemory
│   │   ├── router/                    # AIRouter
│   │   ├── intent/                    # IntentClassifier
│   │   ├── actions/                   # Domain action handlers
│   │   ├── modes/                     # AIMode (deployment modes)
│   │   ├── telemetry/                 # AITelemetry
│   │   └── admin/                     # ── AI OPERATIONS ──
│   │       ├── budget/                # BudgetPolicies, BudgetTracker, BudgetAlerts, BudgetManager
│   │       ├── monitoring/            # ProviderMonitor, GeminiClusterDashboard
│   │       ├── explorer/              # AIRequestExplorer
│   │       ├── dashboard/             # LiveAIDashboard
│   │       ├── optimizer/             # BudgetOptimizer, AIFinancialAdvisor
│   │       ├── routing/               # RoutingAnalytics
│   │       ├── analytics/             # AIAnalytics (Student, Teacher, Parent, Cache, Comparison)
│   │       ├── alerts/                # AlertCenter
│   │       ├── config/                # AIOperationsConfig
│   │       └── audit_logging/         # AIAuditSystem, AILogger
│   │
│   ├── services/
│   │   └── parent/                    # ParentService, ParentStatsCalculator, WeeklyReportGenerator
│   │
│   ├── components/
│   │   ├── admin/                     # AdminSidebar, AdminIcons, Charts, TeacherOverview…
│   │   ├── ai/                        # StudyPlanCard, StudyPlanChat, PlanGenerator
│   │   ├── ui/                        # Navbar, Footer, DarkModeToggle, Skeleton, Button
│   │   ├── courses/                   # CourseCard, CourseFilters, AccessCodeInput
│   │   └── quiz/                      # QuizContainer, QuestionCard, AnswerSelector, TimerDisplay, ResultsDisplay
│   │
│   ├── lib/
│   │   ├── auth.ts                    # JWT utilities + getSession
│   │   ├── prisma.ts                  # DB client
│   │   ├── video-provider.ts          # resolveEmbedUrl + validateProviderId
│   │   ├── bunny.ts                   # Bunny signed embed URL
│   │   ├── youtube.ts                 # YouTube nocookie embed
│   │   ├── ai-provider.ts             # DB-backed encrypted AI provider config
│   │   ├── config.ts                  # PlatformConfig with 60s cache
│   │   ├── settings.ts                # AppSetting helpers (maintenance, site text)
│   │   └── site-text.ts               # Editable homepage copy
│   │
│   └── generated/prisma/              # Generated Prisma client
│
├── scripts/
│   ├── seed-superadmins.mjs           # Seeds four named superadmin accounts
│   ├── test-gemini-parent-features.ts # Verifies Gemini pool + parent system (27 tests)
│   └── test-milestone6-operations.ts  # Verifies AI Operations Platform (60 tests)
│
├── prisma/
│   ├── schema.prisma                  # Database schema (SQLite)
│   └── migrations/                    # Database migrations
├── .env                               # Environment variables
├── next.config.ts
├── tailwind.config.ts
└── ARCHITECTURE.md                    # This file
```

---

## API Endpoints Reference

### Authentication
| Method | Route | Description |
|---|---|---|
| POST | `/api/auth/signup` | Create student account |
| POST | `/api/auth/login` | Login |
| POST | `/api/auth/logout` | Clear session cookie |
| GET | `/api/auth/me` | Current user info |

### Courses & Content
| Method | Route | Description |
|---|---|---|
| GET | `/api/courses` | List courses (with filters) |
| GET | `/api/courses/[id]` | Course details with content |
| POST | `/api/admin/courses` | Create course (teacher) |
| PUT | `/api/admin/courses/[id]` | Update course (teacher) |
| DELETE | `/api/admin/courses/[id]` | Delete course (teacher) |
| GET/POST | `/api/admin/courses/[id]/folders` | List / create folders |
| DELETE | `/api/admin/courses/[id]/folders` | Delete folder + cascade |

### Videos & Watch Sessions
| Method | Route | Description |
|---|---|---|
| POST | `/api/videos/[id]/watch` | Open/reuse 4h watch session (returns embedUrl) |
| POST | `/api/videos/[id]/complete` | Mark video watched |
| GET | `/api/videos/[id]/secure-url` | Resolve provider embed URL |
| GET | `/api/courses/[id]/watch-count` | Remaining watches summary |
| POST | `/api/admin/folders/[id]/videos` | Add video (provider, id, duration, limit) |
| PATCH | `/api/admin/videos/[id]` | Update `maxWatchesPerUser` / `durationMinutes` |

### Quizzes & Access Codes
| Method | Route | Description |
|---|---|---|
| GET | `/api/quizzes/[id]` | Quiz questions |
| POST | `/api/quizzes/[id]/submit` | Submit answers |
| POST | `/api/admin/folders/[id]/quizzes` | Create quiz (teacher) |
| POST | `/api/codes` | Redeem access code (student) |
| POST | `/api/admin/codes` | Generate codes (teacher) |
| PUT | `/api/admin/codes/[id]` | Deactivate code |

### Analytics
| Method | Route | Description |
|---|---|---|
| GET | `/api/admin/analytics?period=7d\|30d\|90d\|all&courseId=` | Teacher analytics (KPIs, charts, issues feed) |
| GET | `/api/progress` | Student progress summary |

### Superadmin
| Method | Route | Description |
|---|---|---|
| GET/PATCH | `/api/admin/config` | Platform config |
| GET/POST/PATCH/DELETE | `/api/admin/ai-providers[/[id]]` | AI provider management |
| GET/POST | `/api/admin/superadmin/maintenance` | Maintenance mode |
| GET/POST | `/api/admin/superadmin/site-text` | Editable homepage copy |
| GET/POST/PATCH/DELETE | `/api/admin/superadmin/superadmins[/[id]]` | Superadmin accounts |
| GET/POST/DELETE | `/api/admin/superadmin/bulk-deletion[/[id]]` | Bulk account deletion |
| GET/POST | `/api/admin/superadmin/virtual-data` | Demo data generation |
| POST | `/api/admin/superadmin/access-gate` | Password gate for Danger Zone |
| GET | `/api/site-text` | Public site text read |

### AI Study Plans
| Method | Route | Description |
|---|---|---|
| GET | `/api/ai/study-plan?date=YYYY-MM-DD` | Get daily plan |
| POST | `/api/ai/study-plan` | Generate new plan |
| PUT | `/api/ai/study-plan/[id]` | Update plan status |

---

## Security Architecture

| Layer | Mechanism |
|---|---|
| Authentication | JWT in HTTP-only cookie; bcrypt hashing |
| AI Keys | AES-256-GCM encryption; never returned to client |
| Gemini Pool | Secret keys never logged, `Omit<..., "secretKey">` enforced at type level |
| Watch Sessions | Quota slot consumption in DB transaction (Serializable / SQLite-serial) |
| Superadmin Gate | Three separate passwords with dedicated scopes |
| AI Safety | Prompt injection detection, jailbreak guards, student safety filters in `AlertCenter` |
| Audit | Every AI config change and superadmin action logged with who/ip/prev/new/reason |
| Provider Keys | 401 from any provider → auto-disabled, superadmin alerted immediately |

---

## Payment Gateway & Mobile Wallet Architecture

### Overview
Code-UP provides full Egyptian mobile wallet integration (Vodafone Cash, Orange Cash, Etisalat Cash) via the **Sha7nawy Gateway SDK** (`src/lib/sha7nawy.ts`), along with platform account balance payments, WhatsApp assistance, and access code redemption.

### Key Components & Capabilities
1. **Sha7nawy Gateway SDK (`src/lib/sha7nawy.ts`)**:
   - **Supported Carriers**: Vodafone Cash (`vf_cash`), Orange Cash (`or_cash`), Etisalat Cash (`et_cash`).
   - **White-Labeled UI**: Student-facing interfaces, instructions, and error messages remain fully white-labeled without third-party provider names.
   - **2% Tax & Processing Fee Engine**: `calculateAmountWithTax(baseAmount)` calculates `baseAmount * 1.02` with transparent itemized price breakdowns across all checkout components.
   - **Orange Cash Maintenance Guard**: Displays a reassuring notice for Orange Cash under maintenance while guiding users to Vodafone or Etisalat Cash.

2. **API Routes**:
   - `POST /api/payments/sha7nawy/create`: Validates inputs, computes 2% tax, blocks Orange Cash with maintenance note, and dispatches transaction requests.
   - `POST /api/payments/sha7nawy/webhook`: Receives `transaction.updated` events (`completed` / `rejected`), validates secret keys, ensures idempotency, and credits student balance/enrollments.
   - `POST /api/payments/sha7nawy/confirm`: Frontend live transaction verification via `ref_code`.
   - `POST /api/teacher/subscribe-balance`: Deducts student balance atomically for teacher subscriptions.
3. **Unified Multi-Payment UI**:
   - Integrated 4-tab selector (`📱 محفظة`, `💰 بالرصيد`, `💬 واتساب`, `🔑 كود`) across Student Wallet (`src/app/(clerk)/account/page.tsx`), Course Product Page (`src/app/courses/[id]/page.tsx`), Study Plan Product Page (`src/app/plans/[id]/page.tsx`), and Teacher Landing Booking Modal (`src/components/teacher/BookingModal.tsx`).

---

## Teacher Panel Access Code System

### Access Code Management & Bulk Generation
Teachers can manage and generate access codes directly from their Teacher Dashboard (`src/app/adminpanel/teacher/page.tsx`):
1. **Category Switcher**:
   - **📚 Course Codes (`AccessCode`)**: Access codes bound to specific courses, folders, or lessons.
   - **🎓 Study Plan / Subscription Codes (`PlanAccessCode`)**: Activation codes for platform study and subscription plans.
2. **Bulk Code Generator & CSV Export**:
   - Teachers can generate 1, 5, 10, or custom N codes (up to 200 codes per batch) with custom prefixes (e.g. `MATH-XXXX`, `SUB-XXXX`) and download CSV files instantly for printing and distribution.
3. **Backend Support**:
   - Updated `/api/admin/codes` and `/api/admin/codes/bulk` to handle `PlanAccessCode` models alongside course `AccessCode`s for teacher roles.

---

## Performance Design

| Concern | Solution |
|---|---|
| Dashboard load | All analytics computed incrementally; no full-table scans |
| Config reads | 60-second in-memory cache (`PlatformConfig`) |
| Provider selection | O(n) score calculation on pool size; not on request volume |
| Budget tracking | Additive accumulators (no aggregation query on hot path) |
| Request explorer | 10K ring buffer in memory; no DB query for search |
| Budget optimizer | Runs as a background job at night, not on each request |
| AI Financial Advisor | Midnight report; precomputed from existing in-memory data |
| Provider windows | Rolling minute + hour windows reset lazily (no cron) |
| Audit trail | 5K ring buffer; writes are O(1) |

---

## Verification Tests

| Script | Tests | Coverage |
|---|---|---|
| `scripts/test-gemini-parent-features.ts` | 27 | Gemini pool (key discovery, scoring, 429/401/5xx, GeminiProvider), ParentService, ParentStatsCalculator, WeeklyReportGenerator |
| `scripts/test-milestone6-operations.ts` | 60 | BudgetManager, ProviderMonitor, GeminiClusterDashboard, AIRequestExplorer, LiveAIDashboard, BudgetOptimizer, AIFinancialAdvisor, RoutingAnalytics, Student/Teacher/Parent Analytics, CacheAnalytics, ProviderComparison, AlertCenter, AIOperationsConfig, AIAuditSystem |

Both scripts pass with `npx tsc --noEmit` → **0 TypeScript errors**.

---

## Implementation Checklist

- [x] Database schema with all models
- [x] Dark mode infrastructure (CSS-variable tokens)
- [x] Landing page (server-rendered, editable copy)
- [x] Courses page with access code input
- [x] Multi-provider secure video playback (VdoCipher / Bunny / YouTube)
- [x] Per-video watch quotas + 4h session tokens
- [x] TOFAS-style inline learn experience with sequential lock
- [x] Mark-complete flow (≥80% time gate + YouTube auto-complete)
- [x] Quiz interface (A/B/C/D, timer, instant score)
- [x] Teacher admin panel (analytics + tabbed course editor)
- [x] Teacher analytics (KPIs, SVG charts, period filter, issues feed)
- [x] Superadmin panel (accounts, maintenance, site text, bulk delete, virtual data)
- [x] Platform config (AI max tokens, JWT expiry, watch limits — all config-driven)
- [x] AI provider management (encrypted keys, primary + backup)
- [x] **AI Engine Milestone 1**: Foundation (AIEngine, BaseProvider, MockProvider, ProviderManager, Telemetry)
- [x] **AI Engine Milestone 2**: Educational intelligence (StateMachine, IntentClassifier, ContextBuilder, PromptBuilder, KnowledgeLoader, Memory)
- [x] **AI Engine Milestone 3**: Universal Tool Framework (ToolRegistry, ToolExecutor, Student/Course/Quiz/Homework/Teacher tools)
- [x] **AI Engine Milestone 4**: AI Administration (AIAuditSystem, CostManager, FeatureFlags, AIHealthDashboard)
- [x] **AI Engine Milestone 5**: Production infrastructure (RAGPipeline, SimilarQuestionDetector Arabic normalization, DeepSeekV4FlashProvider, deployment modes)
- [x] **AI Engine Milestone 6**: AI Operations Platform (BudgetManager, ProviderMonitor, GeminiClusterDashboard, AIRequestExplorer, LiveAIDashboard, BudgetOptimizer, AIFinancialAdvisor, RoutingAnalytics, AIAnalytics suite, AlertCenter, AIOperationsConfig, extended AIAuditSystem)
- [x] **Gemini Account Pool**: GeminiPoolManager (score-based selection, 429/401/5xx handling, zero secret exposure)
- [x] **Parent Follow-up System**: ParentService, ParentStatsCalculator, WeeklyReportGenerator (platform-native, no AI required)
- [x] **Payment Gateway & Mobile Wallets**: Sha7nawy SDK (Vodafone Cash, Orange Cash, Etisalat Cash), Webhook handler, Real-time confirmation, 2% Tax Processing, White-Labeled UI, Platform Balance payments
- [x] **Teacher Panel Access Codes**: Category switcher for Course Codes (`AccessCode`) and Subscription Plan Codes (`PlanAccessCode`), bulk generation (up to 200), custom prefixing, CSV export
- [x] Responsive mobile design (admin drawer)
- [x] Arabic/RTL support throughout
- [ ] Connect AI Operations dashboard to Next.js admin panel pages
- [ ] Real-time provider health polling via WebSocket or SSE
- [ ] Persistent analytics to DB (currently in-memory ring buffers)
- [ ] Mobile app (React Native)

---

## Development Commands

```bash
# Start dev server
npm run dev              # http://localhost:3000

# Database
npx prisma db push       # Apply schema changes
npx prisma generate      # Regenerate Prisma client
npm run db:migrate       # Run migrations
npm run db:seed          # Seed database

# Superadmin accounts
node --import dotenv/config scripts/seed-superadmins.mjs

# AI Engine verification
npx tsx scripts/test-gemini-parent-features.ts   # 27 tests
npx tsx scripts/test-milestone6-operations.ts    # 60 tests

# TypeScript
npx tsc --noEmit         # Full type check (0 errors expected)

# Production build
npm run build && npm start
```

---

## Future Roadmap

1. **Real-time notifications** — Socket.io or SSE for live provider health in dashboard
2. **Persistent AI analytics** — Move in-memory ring buffers to DB with ISM (Incremental Summary Model)
3. **Teacher-student messaging** — Direct inbox inside the platform
4. **Payment integration** — Fawry / HyperPay for course purchases
5. **Mobile app** — React Native with same AI Engine
6. **Certificate generation** — On course completion
7. **Gamification** — Badges, leaderboards, study streaks on the platform
8. **Multi-language** — English option alongside Arabic
9. **Group study sessions** — Real-time collaborative rooms
10. **Video transcripts & AI notes** — Auto-generated per lesson
