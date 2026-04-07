# JD Suite v3.6 — Feature Inventory (Phase 0)

Extracted from `JDSuite-v3.6-1.html` (7,090 lines, single-file React prototype).

---

## 1. Architecture Overview (Prototype)

- **Runtime**: React 18.3.1 via CDN (UMD), Babel standalone for JSX transpilation
- **State**: All in-memory React state (`useState`), persisted to `localStorage`
- **Styling**: Inline styles only, no CSS framework
- **Fonts**: Google Fonts — `Playfair Display` (display) + `DM Sans` (body)
- **Libraries**: mammoth.js (DOCX parsing), SheetJS/xlsx (Excel parsing)
- **AI**: Direct browser-to-Anthropic API calls with `anthropic-dangerous-direct-browser-access` header
- **Model**: `claude-sonnet-4-20250514` (main), `claude-haiku-4-5-20251001` (job scraper fallback)
- **No routing**: Single `App` component with `screen` state variable for navigation
- **No auth**: API key stored in localStorage, entered via modal on first load

---

## 2. Navigation & Screens

### 2.1 Top-Level Layout
- **Header** (54px, dark #1A1A1A): Quadrance JD Suite branding, DC/ERS scores, action buttons (Preview, Honest Review, End for Now, Evaluate), Change Key
- **Left sidebar (WorkspaceNav)** (214px, dark #141410): Navigation to Workspace, Company Profile, External Sources, Process Intelligence, Workforce Planning + Workflow shortcuts (JD Builder, JD Analyser, Template Builder)
- **Content area**: Fills remaining space

### 2.2 Screen States
| Screen Key | Component | Description |
|---|---|---|
| `workspace` | `Workspace` | Home dashboard — JD list, search, filters, KPIs |
| `company` | `CompanyView` | Organisation profile form |
| `sources` | `SourcesView` | External job scraper |
| `apqc` | `APQCView` | RASCI process mapping |
| `swp` | `SWPView` | Strategic Workforce Planning dashboard |
| `import` | `ImportStep` | Import content (paste/file/URL) — shared by Builder & Analyser |
| `template-select` | `TemplateSelector` | Choose/upload template before editing |
| `template-builder` | `TemplateBuilder` | Full template editor with drag-and-drop |
| `form` | `JDForm` + `Sidebar` + `QualityPanel` | Main JD editing view |
| `preview` | `Preview` + `Sidebar` | Read-only JD preview with export options |

---

## 3. Data Model (Prototype — localStorage)

### 3.1 JD Data (`jdsuite-v3-current`)
- Flat object: `{ jobTitle, jobCode, orgUnit, jobFamily, revisionDate, approvalDate, preparedBy, approvedBy, status, jobPurpose, positionType, minEducation, minExperience, keyKnowledge, languageReqs, responsibilities, problemComplexity, planningScope, internalStakeholders, externalContacts, communicationMode, systems, physicalSkills, peopleManagement, budgetAuthority, impactScope, workLocation, travelReqs, workingConditions, benchmarkRefs, proposedGrade }`

### 3.2 Drafts (`jdsuite-v3-drafts`)
- Array of: `{ id, timestamp, jd, dqsScore, evalResult, status, templateId }`

### 3.3 Templates (`jdsuite-v3-templates`)
- Array of template objects (custom only; default hardcoded)

### 3.4 Company Profile (`jdsuite-company`)
- `{ name, country, size, fte, industry, prevEval, prevMethod, prevYear, goal }`

### 3.5 External Sources (`jdsuite-sources`)
- Array of: `{ id, name, url, jobs[], lastFetched, error }`

### 3.6 RASCI Data (`jdsuite-apqc`, `jdsuite-apqc-roles`, `jdsuite-apqc-notes`)
- Processes: `{ id, step, rasci: { [role]: "R"|"A"|"S"|"C"|"I" }, confirmed }`
- Roles: string array
- Notes: `{ [processId]: "note text" }`

### 3.7 API Key (`jdsuite-apikey`)
- Raw string in localStorage

---

## 4. Template System

### 4.1 Default Template (10 Sections, 30+ Fields)
| Section | Title | Fields (count) | Required |
|---|---|---|---|
| A | Identification | 9 (jobTitle, jobCode, orgUnit, jobFamily, revisionDate, approvalDate, preparedBy, approvedBy, status) | Yes |
| B | Job Purpose | 2 (jobPurpose[ai], positionType) | Yes |
| C | Knowledge, Qualifications & Experience | 4 (minEducation, minExperience, keyKnowledge[ai], languageReqs) | Yes |
| D | Key Responsibilities | 1 (responsibilities[ai]) | Yes |
| E | Problem Complexity & Planning | 2 (problemComplexity[ai], planningScope[ai]) | Yes |
| F | Communication & Stakeholder Engagement | 3 (internalStakeholders[ai], externalContacts, communicationMode[ai]) | Yes |
| G | Tools, Systems & Digital Skills | 2 (systems, physicalSkills) | Yes |
| H | Responsibility - People, Budget & Impact | 3 (peopleManagement, budgetAuthority, impactScope) | Yes |
| I | Working Conditions & Environment | 3 (workLocation, travelReqs, workingConditions[ai]) | Yes |
| J | Grading Context | 2 (benchmarkRefs, proposedGrade) | No |

### 4.2 Field Types
- `text` — single-line input
- `textarea` — multi-line (rows configurable, 2-12)
- `select` — dropdown (e.g., Status: Draft/Under Revision/Approved/Archived)
- `radio` — radio buttons (e.g., Position Type: Individual Contributor/People Manager)
- `date` — date picker

### 4.3 Field Properties
- `id`, `label`, `type`, `required`, `hint`, `priority` (must/helpful/nice)
- `ai: true` — enables AI Draft button on textarea fields
- `opts` — options array for select/radio
- `rows` — textarea row count

### 4.4 Template Purposes
- General Purpose, Job Evaluation, Recruitment, Career Paths, Skills Mapping, Custom

### 4.5 Template Builder
- Drag-and-drop sections and fields
- Toggle required/optional per field and section
- Add custom fields and sections
- Save as new template (never overwrites default)
- Start from any existing template

### 4.6 Template Uploader
- Upload .docx/.xlsx/.csv/.txt files
- Claude parses file content into structured template JSON
- Preview & edit parsed template before saving
- Edit section titles, field labels, types, priority, required, AI-assist flags

---

## 5. JD Builder Flow

1. **Import Step** (optional): Paste text / Upload file (.txt .md .csv .docx .pdf .xlsx) / Fetch URL
   - URL fetch via `api.allorigins.win` CORS proxy
   - File parsing: mammoth.js for .docx, SheetJS for .xlsx/.xls, FileReader for text
   - Content sent to Claude for analysis → extracts field values, scores, ESCO/ISCO match
2. **Template Selection**: Choose from available templates or upload new one
3. **Form Editing**: Section-by-section editing with:
   - Left sidebar: DC score, ERS score, section navigation with completion rings, EIGE/ILO 16-criteria grid, actions
   - Center: Form fields with hints, priority badges, quality badges
   - Right panel: Quality Panel (DC tab: field-level badges, ESCO match) or 16-Criteria Evaluation tab
4. **AI Draft**: Per-field AI generation via Claude (textarea fields with `ai: true`)
5. **Auto-save**: JD state saved to localStorage on every update
6. **End for Now**: Saves draft + generates session summary via Claude (must-complete, questions, AI enhancements)

---

## 6. JD Analyser

- Same import step as Builder
- After import: shows Analysis Panel (right side) with:
  - DC Score + ERS Score gauges
  - ESCO/ISCO classification (code, title, confidence)
  - Summary sections: What is good / Key gaps / Next steps
  - Ready for evaluation indicator
- Continue to Builder form for editing

---

## 7. AI API Calls (6 Distinct Endpoints)

| Function | Purpose | System Prompt | Max Tokens |
|---|---|---|---|
| `apiAnalyseInput` | Parse imported text → extract fields, scores, ESCO/ISCO | JD_SYSTEM | 5000 |
| `apiGenerateField` | AI draft for single field | JD_SYSTEM | 600 |
| `apiEvaluate` | 16-criteria pay equity evaluation | Pay equity specialist | 4000 |
| `apiHonestReview` | Candid JD quality assessment | JD_SYSTEM | 3000 |
| `apiEndForNow` | Session summary + next steps | JD_SYSTEM | 2000 |
| `callClaude` (chat) | Conversational gap-filling for specific criteria | HR specialist | 800 |

### System Prompt (JD_SYSTEM)
- Role: "GPTs-JD-Suite_v4, specialist assistant for JD Suite by Quadrance"
- Scope: JD creation, normalisation, assessment, comparison, structuring
- Out of scope: Job evaluation engine, grading, compensation, pay banding
- Principles: Human decides always, AI proposes/analyses, no AI-generated content presented as final, plain text only

---

## 8. Scoring & Evaluation

### 8.1 Document Completeness Score (DC/DQS)
- Percentage of required fields that are non-empty
- Calculated client-side via `compScore()` function
- Per-section scores via `secScore()`

### 8.2 Evaluation Readiness Score (ERS)
- Returned by Claude during import analysis
- 0-100 scale

### 8.3 16-Criteria Pay Equity Evaluation (Axiomera)
4 categories, 16 criteria with max levels:
| Category | Criteria | Max Level |
|---|---|---|
| Knowledge and Skills | 1. Knowledge & Experience (9), 2. Finding Solutions (7), 3. Planning & Organisation (6), 4. Communication & Inclusion (6), 5. Practical Skills (5) | — |
| Effort | 6. Physical Effort (5), 7. Mental Effort (5), 8. Emotional Effort (6), 9. Initiative & Independence (8) | — |
| Responsibility | 10. Welfare of People (6), 11. Management (7), 12. Information & Confidentiality (5), 13. Physical & Financial Resources (5), 14. Strategic Planning (6), 15. Equality & Inclusion (5) | — |
| Work Environment | 16. Working Conditions (5) | — |

Each criterion assessed as: **sufficient** / **partial** / **insufficient** with gaps and follow-up questions.

### 8.4 Honest Review
- Verdict: Ready / Needs Work / Not Ready
- Drives decision today: yes / no / conditional
- Top weaknesses with field, issue, fix
- Auditor objections
- Top priority fix
- Overall narrative

---

## 9. UI Components

### 9.1 Reusable Components
- `Ring` — SVG completion ring (section sidebar)
- `QBadge` — Quality badge (good/needs-work/missing)
- `ScoreGauge` — Circular score display (sm/lg)
- `Btn` — Button with variants (pri/sec/gold/teal/danger/ghost/purple)
- `Spinner` — Loading spinner
- `FieldComp` — Smart field renderer (text/textarea/select/radio/date with AI draft)

### 9.2 Modals
- `ApiKeyDialog` — Initial API key entry
- `UpdateKeyModal` — Re-enter key on auth failure
- `HonestReviewModal` — AI review results
- `EndForNowModal` — Session summary with export
- `TemplateUploader` — Upload & parse template files

### 9.3 Panels
- `QualityPanel` — Right sidebar with DC scores + 16-criteria evaluation
- `AnalysisPanel` — Analysis results after import
- `ChatDrawerEl` — Floating chat for criteria gap-filling (bottom-right, 360px wide)

---

## 10. Workspace / Dashboard

- JD card grid with: status badge, title, org unit, date, DC gauge, 16-criteria summary
- Search by job title
- Tabs: All JDs / No JD (compliance risk) / Templates
- "No JD" tab: Mock data showing roles without JDs (risk scores, FTE, days without JD)
- New JD / Analyse JD buttons
- Delete draft (per card)
- KPI strip: total JDs, roles without JD, DC >=75% compliance rate

---

## 11. Company Profile

- Organisation identity: name, country, industry, FTE, size (micro/small/medium/large)
- Evaluation history: previous evaluation checkbox, methodology, year
- Project goal: EU Directive compliance / Pay equity audit / Restructuring / New system / Other
- EIGE Pathway display based on org size
- Saved to localStorage

---

## 12. External Sources (Job Scraper)

- Add careers website URLs with labels
- Fetch job listings via `api.allorigins.win` CORS proxy
- 3-strategy extraction: JSON-LD structured data → `<a>` link parsing → heading scanning
- Claude Haiku fallback when HTML parsing finds nothing
- Import individual jobs into Analyser flow
- Full-text fetch for individual job postings

---

## 13. Process Intelligence (RASCI)

- Add roles (columns) and process steps (rows)
- Click cells to cycle: R → A → S → C → I → empty
- Confirm/hypothesis toggle per step
- Notes per process step
- Gap detection: steps missing Accountable (A)
- KPI cards: total steps, confirmed, missing A
- Guide panel explaining RASCI methodology
- Persistent to localStorage

---

## 14. Strategic Workforce Planning (SWP)

- Dashboard view of all evaluated JDs
- KPIs: JDs evaluated, avg criteria gaps, avg partial criteria, avg DC
- Role readiness table with per-JD evaluation summary
- Requires JDs to have 16-criteria evaluation run first

---

## 15. Export Capabilities (Prototype)

- **Download .txt**: Plain text with all filled fields, evaluation summary, Quadrance branding
- **Download .md**: Markdown format with sections and bold labels
- **Copy to clipboard**: Plain text
- **Print**: `window.print()`
- **End for Now .txt**: Session summary with must-complete, questions, AI enhancements

---

## 16. Design System Tokens (Extracted)

### Colors
| Token | Value | Usage |
|---|---|---|
| Background | `#F6F4EF` | Page background |
| Surface | `#fff` | Cards, panels |
| Border | `#DDD8CC` | Default borders |
| Text primary | `#1A1A1A` | Headings, body |
| Text secondary | `#555047` | Descriptions |
| Text muted | `#8A8070` | Hints, labels |
| Brand gold | `#8A7560` | Primary accent, active states |
| Brand gold hover | `#E8E1D8` | Active backgrounds |
| Teal | `#2E7D88` | Knowledge/Skills, Evaluate |
| Purple | `#6B3FA0` | Effort category |
| Orange | `#C05A0A` | Responsibility category |
| Blue | `#1B5E86` | Work Environment, info |
| Success | `#2E7A3C` | Good/sufficient |
| Warning | `#8A6800` | Needs work/partial |
| Danger | `#C0350A` | Missing/insufficient |
| Dark nav bg | `#141410` | Left sidebar |
| Dark header | `#1A1A1A` | Top header, primary buttons |

### Typography
- Display: `'Playfair Display', Georgia, serif` — headings, scores, branding
- Body: `'DM Sans', -apple-system, sans-serif` — everything else
- Base font size: 14px

### Spacing
- Card padding: 16-22px
- Section gap: 12-16px
- Border radius: 7-10px (cards), 4-8px (badges/buttons)

---

## 17. Prototype Limitations (to resolve in production)

1. **No authentication** — API key in localStorage, no user accounts
2. **No data isolation** — all data in single browser localStorage
3. **No server-side** — all logic client-side, API key exposed to browser
4. **No persistence** — localStorage only, no database
5. **No collaboration** — single-user, no sharing or guest access
6. **No audit trail** — no change history beyond draft snapshots
7. **No i18n** — English only, hardcoded strings throughout
8. **Limited export** — .txt and .md only, no PDF/DOCX
9. **No batch operations** — single JD export only
10. **No error recovery** — basic try/catch with alerts
11. **No tests** — zero test coverage
12. **No accessibility** — no ARIA labels, keyboard nav incomplete
13. **No mobile** — desktop layout only (sidebar-dependent)
14. **CORS dependency** — uses `api.allorigins.win` for URL fetching
15. **No rate limiting** — unlimited API calls
16. **No input validation** — minimal Zod/schema validation
