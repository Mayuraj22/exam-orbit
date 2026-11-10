# ExamOrbit

An online exam platform. Admins create exams, add multiple-choice and typed-answer questions,
invite candidates, and grade their submissions.

> **Status:** the admin side is complete. Admin login, secure candidate login and the
> candidate exam-taking screen are the next milestones (see [Roadmap](#roadmap)).

## Features

**Exams**

- Create, edit, duplicate, publish/unpublish and delete exams
- Search, filter (published/draft) and sort, with filters kept in the URL
- Exam detail page with Questions, Candidates, Results and Settings tabs

**Questions**

- Multiple choice (correct option picked with a radio button) and typed-answer ("Input") questions
- Edit in place; reorder by drag and drop or with the arrow buttons

**Candidates**

- Add one at a time (username and passcode generated) or import a CSV file with a validated preview
- Copy login details, reset an attempt, export to CSV

**Results and grading**

- Per-exam summary (average, highest, lowest, needs grading) and CSV export
- Grading dialog: MCQ answers are marked automatically; typed answers are marked by the admin,
  with exact matches suggested

**App**

- Dashboard with totals, "needs grading" and recent submissions
- Light, dark or system theme; responsive down to phone width; keyboard and screen-reader friendly

## Tech stack

| Area      | Choice                                                                         |
| --------- | ------------------------------------------------------------------------------ |
| Framework | Angular 21 (standalone components, signals, new control flow), SSR enabled     |
| State     | NgRx Store, Effects and Entity                                                 |
| UI        | Angular Material 3 + CDK (drag and drop, clipboard, layout)                    |
| Backend   | Supabase (Postgres + REST)                                                     |
| Quality   | ESLint (angular-eslint), Prettier, Husky + lint-staged, Vitest, GitHub Actions |

## Getting started

Requirements: Node.js 22+ and npm.

```bash
npm install
npm start
```

Open http://localhost:4200. The Supabase URL and publishable key are in
`src/environments/environment*.ts`.

### Scripts

| Command          | What it does                                                |
| ---------------- | ----------------------------------------------------------- |
| `npm start`      | Dev server with live reload                                 |
| `npm run build`  | Production build (output in `dist/`)                        |
| `npm test`       | Unit tests in watch mode (`npm run test:ci` runs them once) |
| `npm run lint`   | ESLint on TypeScript and templates                          |
| `npm run format` | Format the code with Prettier (`format:check` only checks)  |

A pre-commit hook runs ESLint and Prettier on the files being committed.
CI (`.github/workflows/ci.yml`) runs format check, lint, tests and the build on every push and pull request.

## Project structure

```
src/app/
├── core/                 App-wide pieces
│   ├── layout/shell/     Toolbar + sidebar layout
│   ├── pages/            404 page
│   ├── services/         Supabase, notifications (toasts), theme
│   └── global-error-handler.ts
├── features/
│   ├── admin/
│   │   ├── store/        NgRx actions, reducer, effects, selectors (+ toast effects)
│   │   ├── components/   Exam list/detail, forms, dialogs, candidates, results, pages
│   │   ├── grading.ts    Pure grading logic (unit tested)
│   │   └── admin.routes.ts  Lazy-loaded routes; registers the store slice
│   └── auth/             Candidate auth store (work in progress)
└── shared/
    ├── components/       Confirm dialog
    ├── models/           Exam, Question, Candidate, Result
    └── utils/            CSV and credential helpers (unit tested)
```

### How a change flows

```
Component ──dispatch──▶ Action ──▶ Effect ──▶ SupabaseService ──▶ Supabase
    ▲                                 │
    └──── selectSignal ◀── Reducer ◀──┘ Success / Failure action ──▶ toast
```

Components never call Supabase directly. Every save dispatches an action; an effect performs the
request and dispatches a success or failure action; the reducer updates the store; a separate
effect shows the toast.

## Database (Supabase)

| Table        | Key columns                                                                                                            |
| ------------ | ---------------------------------------------------------------------------------------------------------------------- |
| `exams`      | `id`, `title`, `description`, `duration_minutes`, `is_published`, `created_at`                                         |
| `questions`  | `id`, `exam_id`, `question_text`, `question_type` (`mcq`/`input`), `options` (JSON), `correct_answer`, `order_index`   |
| `candidates` | `id`, `exam_id`, `name`, `username`, `passcode`, `has_attempted`                                                       |
| `results`    | `id`, `candidate_id`, `exam_id`, `answers` (JSON), `score`, `graded_answers` (JSON), `is_fully_graded`, `submitted_at` |

For MCQ questions, `correct_answer` stores the correct option's `id` (older rows may store its text;
both are supported).

## Roadmap

- [x] Phase 1: Code cleanup and bug fixes
- [x] Phase 2: Angular Material UI foundation
- [x] Phase 3: Exam management (detail page, editing, reordering, duplicate)
- [x] Phase 4: Candidates, results and grading
- [x] Phase 5: Dashboard, theming, responsive layout, linting, tests and CI
- [ ] Phase 6: Database upgrade (constraints, migrations) and exam settings (pass mark, shuffle)
- [ ] Phase 7: Security: admin login, hashed candidate passcodes, row-level security
- [ ] Phase 8: Candidate exam-taking screen

## Known limitations

These are planned for Phases 6–7:

- No admin login yet, so anyone who can open the app can use the admin pages.
- Candidate passcodes are stored in plain text.
- Usernames are checked for uniqueness in the app only, not by the database.
- Scores and grading are saved from the browser; they should move to server-side functions.
