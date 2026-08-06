# منصة التعليم المصرية - Egyptian EdTech Platform

A comprehensive, modern EdTech platform targeting Egyptian students (6th Primary to 3rd Secondary). Built with Next.js 16, Tailwind CSS, Framer Motion, and Prisma ORM.

## Tech Stack

- **Frontend:** Next.js 16 (App Router), Tailwind CSS 4, Framer Motion
- **Backend:** Next.js API Routes (Node.js)
- **Database:** SQLite via Prisma ORM + libsql adapter
- **Auth:** JWT with jose, bcrypt password hashing
- **Language Support:** Arabic (RTL) first

## Features

### Student Features
- 📝 **Sign Up / Login** with name, email, password, phone, age & educational stage
- 🏠 **Landing Page** with hero section, features, animated stats
- 📚 **Courses Page** with filters (stage, subject, teacher) + access code entry
- 📖 **My Library** — enrolled courses with folders, Bunny CDN video player, quizzes
- 🤖 **AI Study Assistant** with daily plan generation & chat, auto-fallback (OpenAI → Gemini → static)
- 👤 **Account Page** — read-only profile dashboard
- 🌙 **Dark Mode** toggle
- ⚡ **Skeleton Loaders** on data-fetching pages

### Admin Panel (`/adminpanel`)
- **Superadmin** — Create/manage teacher accounts, system overview
- **Teacher Dashboard** — Analytics, course/content management
  - Create courses with thumbnails
  - Organize content into folders (محاضرات)
  - Add Bunny CDN videos (by Bunny ID — no raw MP4 uploads)
  - Add multiple-choice quizzes with correct answers
  - Generate & deactivate student access codes

## Database Schema

| Model | Description |
|-------|-------------|
| `User` | Students, Teachers, Superadmin (role-based) |
| `Course` | Courses with teacher, stage, subject |
| `Folder` | Lecture folders within a course |
| `Video` | Bunny CDN videos in folders |
| `Quiz` | Quizzes within folders |
| `QuizQuestion` | Multiple-choice questions (A/B/C/D) |
| `AccessCode` | Unique codes for student course access |
| `Progress` | Student video watch progress |
| `QuizResult` | Student quiz scores |

## Getting Started

### 1. Install dependencies
```bash
npm install
```

### 2. Configure environment
Create a `.env.local` file:
```env
DATABASE_URL="file:./dev.db"
JWT_SECRET="your-secret-key"
SUPERADMIN_MASTER_PASSWORD="your-superadmin-password"
NEXT_PUBLIC_APP_URL="http://localhost:3000"
OPENAI_API_KEY=""     # optional — for AI study assistant
GEMINI_API_KEY=""     # optional — fallback AI
```

### 3. Run database migrations
```bash
npx prisma migrate deploy
```

### 4. Start dev server
```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000)

## Folder Structure

```
src/
├── app/
│   ├── page.tsx                    # Home/Landing page
│   ├── signup/page.tsx             # Student sign-up
│   ├── login/page.tsx              # Student login
│   ├── courses/page.tsx            # Courses browser + access code
│   ├── library/page.tsx            # My Library + AI assistant
│   ├── account/page.tsx            # Profile dashboard
│   ├── adminpanel/
│   │   ├── page.tsx                # Admin login portal
│   │   ├── superadmin/page.tsx     # Superadmin dashboard
│   │   └── teacher/page.tsx        # Teacher dashboard
│   └── api/
│       ├── auth/                   # signup, login, logout, me
│       ├── courses/                # public course listing
│       ├── codes/                  # apply access code
│       ├── progress/               # library & video progress
│       ├── ai/                     # AI study assistant
│       └── admin/                  # teacher-only & superadmin APIs
├── components/
│   ├── home/                       # HeroSection, Features, Stats
│   ├── courses/                    # CourseCard
│   ├── player/                     # BunnyPlayer (branded)
│   ├── admin/                      # AdminSidebar
│   └── ui/                         # Navbar, Footer, DarkModeToggle, Skeleton
├── lib/
│   ├── auth.ts                     # JWT helpers, session management
│   └── prisma.ts                   # Prisma client singleton
└── types/
    └── index.ts                    # TypeScript type definitions
```

## API Reference

### Auth
- `POST /api/auth/signup` — register student
- `POST /api/auth/login` — student login
- `POST /api/auth/logout` — logout
- `GET  /api/auth/me` — current user info

### Courses
- `GET  /api/courses` — list all courses (with filters)
- `GET  /api/courses/[id]` — course detail with folders/videos/quizzes
- `POST /api/codes` — apply access code

### Library
- `GET  /api/progress` — enrolled courses with progress
- `POST /api/progress` — mark video as watched

### AI
- `POST /api/ai` — AI study assistant (OpenAI → Gemini → fallback)

### Admin (Teacher)
- `POST /api/admin/login` — admin/teacher login
- `GET/POST /api/admin/courses` — list/create courses
- `DELETE /api/admin/courses/[id]` — delete course
- `POST /api/admin/courses/[id]/folders` — add folder
- `POST /api/admin/folders/[id]/videos` — add Bunny video
- `POST /api/admin/folders/[id]/quizzes` — add quiz
- `GET/POST /api/admin/codes` — list/generate access codes

### Admin (Superadmin only)
- `GET/POST /api/admin/teachers` — list/create teacher accounts
