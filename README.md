# Interactive CARVER Matrix Builder

A Vercel-ready React, TypeScript, Tailwind CSS application for defensive CARVER asset prioritization and vulnerability assessment support.

## 1. Product Definition

**App name:** Interactive CARVER Matrix Builder

**Purpose:** Help analysts create a defensible CARVER matrix by linking assets to Design Basis Threat references, scoring each asset across the six CARVER criteria, and requiring a written rationale for each score.

**Primary users:** Security risk analysts, NGO security managers, critical infrastructure assessors, humanitarian operations teams, and management decision support staff.

**Core decision problem:** Which assets present the highest vulnerability or mission-continuity concern under a defined threat model, and where should management attention and mitigation planning be prioritized?

**Main outputs:**

- CARVER scoring matrix
- Total CARVER score out of 30
- Pa score, calculated as total / 30
- Risk band classification
- Top-10 highest-risk asset view
- JSON, CSV, Excel-compatible, PDF/print, and PNG chart exports
- Local audit trail of score and asset changes

## 2. Feature Specification

### Must-have features

- Create and edit an assessment
- Add assets
- Add DBT references
- Score assets across Criticality, Accessibility, Recuperability, Vulnerability, Effect, and Recognizability
- Require numeric score and rationale for each criterion
- Calculate total score and Pa automatically
- Apply visual risk banding
- Compare assets in a matrix view
- Support multiple DBT references
- Save drafts to localStorage
- Import and export JSON
- Export CSV, Excel-compatible file, PDF/print, and PNG chart
- Show top-10 highest-risk assets
- Include scoring rubric drawer
- Include audit trail

### Should-have features included

- Dark/light theme toggle
- Search and filters
- Sample dataset toggle
- Reset with confirmation
- Shareable URL state for current view
- Print-friendly output
- Accessible labels and keyboard-friendly controls

### Future enhancements

- Backend persistence with user authentication
- Multi-user review workflow
- Evidence attachment uploads
- Weighted CARVER variants
- Formal DBT wizard integration
- SSE integration and treatment recommendation workflow
- Client-facing report dashboard

## 3. Data Model

### TypeScript interfaces

The application defines these major interfaces in `src/App.tsx`:

```ts
type CriterionKey = 'C' | 'A' | 'R' | 'V' | 'E' | 'Rg';
type ScoreMode = 'classic' | 'continuity';

interface CriterionScore {
  score: number | null;
  rationale: string;
  evidence: string;
  updatedAt: string;
}

interface ScoreSession {
  id: string;
  dbtId: string;
  mode: ScoreMode;
  criteria: Record<CriterionKey, CriterionScore>;
  completedAt?: string;
  updatedAt: string;
}

interface AssetRecord {
  id: string;
  name: string;
  sector: string;
  type: string;
  location: string;
  owner: string;
  status: string;
  notes: string;
  scoreSessions: ScoreSession[];
  createdAt: string;
  updatedAt: string;
}

interface DBTReference {
  id: string;
  title: string;
  adversaryType: string;
  confidence: 'Low' | 'Medium' | 'High';
  description: string;
  goals: string;
  sourceNotes: string;
  createdAt: string;
  updatedAt: string;
}

interface Assessment {
  id: string;
  name: string;
  organization: string;
  analyst: string;
  scope: string;
  notes: string;
  status: 'Draft' | 'Complete';
  date: string;
  thresholds: { critical: number; high: number; medium: number };
  dbts: DBTReference[];
  assets: AssetRecord[];
  auditTrail: AuditEntry[];
  createdAt: string;
  updatedAt: string;
}
```

### JSON schema-style example

```json
{
  "id": "assessment-uuid",
  "name": "CARVER Assessment",
  "organization": "MNS Consulting",
  "analyst": "Analyst Name",
  "scope": "Defensive assessment scope",
  "status": "Draft",
  "thresholds": {
    "critical": 0.8,
    "high": 0.7,
    "medium": 0.5
  },
  "dbts": [
    {
      "id": "dbt-uuid",
      "title": "Baseline DBT Reference",
      "adversaryType": "Structured threat model",
      "confidence": "Medium",
      "description": "Defensive threat reference",
      "goals": "Disruption or exploitation",
      "sourceNotes": "Source notes"
    }
  ],
  "assets": [
    {
      "id": "asset-uuid",
      "name": "Primary Asset",
      "sector": "Critical Infrastructure",
      "type": "Facility",
      "location": "Region",
      "scoreSessions": [
        {
          "id": "session-uuid",
          "dbtId": "dbt-uuid",
          "mode": "classic",
          "criteria": {
            "C": { "score": 5, "rationale": "Required rationale", "evidence": "Evidence note" },
            "A": { "score": 3, "rationale": "Required rationale", "evidence": "Evidence note" },
            "R": { "score": 4, "rationale": "Required rationale", "evidence": "Evidence note" },
            "V": { "score": 4, "rationale": "Required rationale", "evidence": "Evidence note" },
            "E": { "score": 5, "rationale": "Required rationale", "evidence": "Evidence note" },
            "Rg": { "score": 4, "rationale": "Required rationale", "evidence": "Evidence note" }
          }
        }
      ]
    }
  ]
}
```

### Local storage structure

- Assessment data: `qa-carver-matrix-builder-v1`
- Theme preference: `qa-carver-theme-v1`

## 4. UX Workflow

### Screen 1: Assessment controls

User enters assessment name, organization, analyst, date, and scope. Drafts auto-save locally.

### Screen 2: DBT settings

User selects the active DBT and scoring mode, either classic threat view or continuity view. User may add additional DBT references.

### Screen 3: Asset editor

User adds or selects an asset, enters metadata, scores each CARVER criterion, and writes rationale and evidence notes.

### Screen 4: Matrix view

The app displays sortable and filterable rows for asset, DBT, score mode, six CARVER scores, total, Pa, band, and completion status.

### Screen 5: Overview

The app displays KPIs and a top-10 completed asset chart.

### Screen 6: Audit trail

The app records changes to metadata, assets, DBTs, scores, and completion status.

## 5. Calculation Logic

### Scoring formula

```text
Total CARVER Score = C + A + R + V + E + Rg
Maximum score = 30
Pa = Total CARVER Score / 30
```

### Default risk bands

```text
0.80 to 1.00 = Critical
0.70 to 0.79 = High
0.50 to 0.69 = Medium
0.00 to 0.49 = Low
```

### Validation rules

- Each criterion must have a score from 1 to 5.
- Each criterion must have a rationale of at least 12 characters.
- Final export is blocked when any score session is incomplete.
- Draft backup export is allowed and labeled as a draft backup.

### Export formatting logic

- JSON exports the full assessment object.
- CSV flattens one row per asset, DBT, and mode.
- Excel uses an HTML table saved with `.xls` extension for Excel compatibility.
- PDF uses the browser print engine.
- PNG exports the top-10 chart.

## 6. Full Application Code

The full working application is included in this project folder:

```text
src/App.tsx
src/main.tsx
src/styles.css
index.html
package.json
tailwind.config.js
postcss.config.js
vite.config.ts
tsconfig.json
```

## 7. QA Checklist

### Functional tests

- Create a new assessment.
- Add a DBT reference.
- Add, edit, duplicate, and delete an asset.
- Switch between classic and continuity scoring views.
- Prepare scoring sessions for active DBT.
- Search and filter matrix rows.
- Open and close each rubric drawer.

### Scoring tests

- Enter scores 1 to 5 for all six criteria.
- Confirm total equals the sum of all six values.
- Confirm Pa equals total / 30.
- Confirm correct band assignment at 0.80, 0.70, and 0.50 thresholds.
- Confirm high Recuperability score means harder recovery and lower resilience.

### Export tests

- Try final export with missing rationale. It should be blocked.
- Complete all rationale fields. Final export should proceed.
- Test JSON, CSV, Excel-compatible, PDF/print, and PNG chart exports.
- Test draft backup export with incomplete scores.

### Mobile responsiveness tests

- Verify layout on mobile width under 480 px.
- Verify asset editor fields stack correctly.
- Verify matrix scrolls horizontally without layout breakage.
- Verify buttons remain tappable.

### Data persistence tests

- Enter data and refresh browser.
- Confirm assessment reloads from localStorage.
- Reset assessment and confirm local data is cleared.
- Import a valid exported JSON file.

## 8. Deployment Notes

### Run locally

```bash
npm install
npm run dev
```

Open the local Vite URL shown in the terminal.

### Build for production

```bash
npm run build
npm run preview
```

### Deploy on Vercel

1. Push the folder to a GitHub repository.
2. Open Vercel and import the repository.
3. Use the defaults:
   - Framework preset: Vite
   - Build command: `npm run build`
   - Output directory: `dist`
4. Deploy.

### Deploy on Netlify

1. Import the repository into Netlify.
2. Set build command to `npm run build`.
3. Set publish directory to `dist`.
4. Deploy.

## Dependencies

- React
- TypeScript
- Vite
- Tailwind CSS
- PostCSS
- Autoprefixer

No backend is required. Data persists in the browser through localStorage.
