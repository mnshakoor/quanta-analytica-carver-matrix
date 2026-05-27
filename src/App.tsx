import React, { ChangeEvent, FormEvent, useEffect, useMemo, useRef, useState } from 'react';

type CriterionKey = 'C' | 'A' | 'R' | 'V' | 'E' | 'Rg';
type RiskBand = 'Critical' | 'High' | 'Medium' | 'Low';
type Theme = 'light' | 'dark';
type TabKey = 'overview' | 'matrix' | 'assets' | 'audit';
type ScoreMode = 'classic' | 'continuity';
type AssessmentStatus = 'Draft' | 'Complete';

interface CriterionDefinition {
  key: CriterionKey;
  label: string;
  shortLabel: string;
  description: string;
  anchor: string;
}

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

interface AuditEntry {
  id: string;
  timestamp: string;
  action: string;
  entityId: string;
  summary: string;
  before?: string;
  after?: string;
}

interface RiskThresholds {
  critical: number;
  high: number;
  medium: number;
}

interface Assessment {
  id: string;
  name: string;
  organization: string;
  analyst: string;
  scope: string;
  notes: string;
  status: AssessmentStatus;
  date: string;
  thresholds: RiskThresholds;
  dbts: DBTReference[];
  assets: AssetRecord[];
  auditTrail: AuditEntry[];
  createdAt: string;
  updatedAt: string;
}

interface FlatMatrixRow {
  assetId: string;
  assetName: string;
  sector: string;
  type: string;
  location: string;
  dbtTitle: string;
  mode: ScoreMode;
  total: number;
  pa: number;
  band: RiskBand;
  complete: boolean;
  incompleteReasons: string[];
  scores: Record<CriterionKey, number | null>;
}

const STORAGE_KEY = 'qa-carver-matrix-builder-v1';
const THEME_KEY = 'qa-carver-theme-v1';

const CRITERIA: CriterionDefinition[] = [
  {
    key: 'C',
    label: 'Criticality',
    shortLabel: 'C',
    description: 'Degree of importance to the system and consequence of asset loss or disruption.',
    anchor: 'Score high when loss creates a single point of failure, mission collapse, or cascading operational disruption.'
  },
  {
    key: 'A',
    label: 'Accessibility',
    shortLabel: 'A',
    description: 'Ease with which the defined threat can reach, influence, or act on the asset.',
    anchor: 'Score high when exposure, access patterns, or protective limitations make contact with the asset easier.'
  },
  {
    key: 'R',
    label: 'Recuperability',
    shortLabel: 'R',
    description: 'Time, effort, cost, and operational difficulty required to restore function after disruption.',
    anchor: 'Score high when recovery is slow, expensive, dependent on scarce resources, or requires external authorization.'
  },
  {
    key: 'V',
    label: 'Vulnerability',
    shortLabel: 'V',
    description: 'Degree of exploitable weakness against the defined Design Basis Threat.',
    anchor: 'Score high when the DBT has capability, access, or knowledge that can defeat existing controls.'
  },
  {
    key: 'E',
    label: 'Effect',
    shortLabel: 'E',
    description: 'Scope and magnitude of adverse consequences from successful disruption.',
    anchor: 'Score high when downstream consequences affect people, continuity, reputation, politics, or mission delivery.'
  },
  {
    key: 'Rg',
    label: 'Recognizability',
    shortLabel: 'Rg',
    description: 'Ease with which the defined threat can identify the asset and understand its importance.',
    anchor: 'Score high when branding, location, routine, public reporting, or local knowledge makes the asset obvious.'
  }
];

const RUBRIC: Record<CriterionKey, string[]> = {
  C: [
    '1 - Minimal mission impact. Redundancy exists and disruption is easily absorbed.',
    '2 - Limited disruption. Some dependent processes affected, but core mission continues.',
    '3 - Moderate disruption. Important function impaired and workarounds are required.',
    '4 - Major disruption. Asset loss damages core operations or creates serious cascading effects.',
    '5 - Mission critical. Asset loss causes system failure, severe public impact, or halt of essential service.'
  ],
  A: [
    '1 - Very difficult to reach or influence. Strong access controls and limited exposure.',
    '2 - Limited access. Several protective layers or procedural barriers exist.',
    '3 - Moderate access. Threat may reach the asset with planning or insider knowledge.',
    '4 - High access. Regular exposure, predictable access points, or limited protective posture.',
    '5 - Direct access. Asset is exposed, predictable, or reachable with minimal difficulty.'
  ],
  R: [
    '1 - Rapid recovery. Redundancy and restoration resources are already in place.',
    '2 - Manageable recovery. Restoration can occur with limited disruption and routine resources.',
    '3 - Moderate recovery burden. Recovery requires coordination, cost, or temporary service loss.',
    '4 - Difficult recovery. Long lead times, scarce suppliers, or major approvals are needed.',
    '5 - Severe recovery challenge. Recovery is slow, uncertain, externally dependent, or strategically damaging.'
  ],
  V: [
    '1 - Low exploitability. Current controls are well matched to the DBT capability.',
    '2 - Minor weaknesses. Exploitation requires unusual capability or favorable conditions.',
    '3 - Moderate weakness. Exploitation is plausible with planning, access, or timing.',
    '4 - High weakness. Controls are insufficient against a credible DBT pathway.',
    '5 - Severe weakness. DBT capability clearly exceeds protective controls.'
  ],
  E: [
    '1 - Minimal adverse effect beyond the immediate asset.',
    '2 - Limited effect. Localized disruption with low strategic consequence.',
    '3 - Moderate effect. Measurable impact on operations, stakeholders, or continuity.',
    '4 - Major effect. Serious mission, public safety, humanitarian, financial, or reputational consequences.',
    '5 - Severe effect. Catastrophic consequence, strategic disruption, or existential operational impact.'
  ],
  Rg: [
    '1 - Hard to identify. Asset importance is not obvious to an external actor.',
    '2 - Limited recognizability. Significance requires specialized knowledge.',
    '3 - Moderate recognizability. Importance can be inferred through observation or reporting.',
    '4 - High recognizability. Branding, routine, or visible function signals importance.',
    '5 - Obvious target significance. Asset is unmistakably critical and easy to distinguish.'
  ]
};

const nowIso = () => new Date().toISOString();
const today = () => new Date().toISOString().slice(0, 10);
const uid = () => (typeof crypto !== 'undefined' && 'randomUUID' in crypto ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(16).slice(2)}`);

const emptyCriterionScore = (): CriterionScore => ({
  score: null,
  rationale: '',
  evidence: '',
  updatedAt: nowIso()
});

const emptyCriteria = (): Record<CriterionKey, CriterionScore> => ({
  C: emptyCriterionScore(),
  A: emptyCriterionScore(),
  R: emptyCriterionScore(),
  V: emptyCriterionScore(),
  E: emptyCriterionScore(),
  Rg: emptyCriterionScore()
});

const createScoreSession = (dbtId: string, mode: ScoreMode): ScoreSession => ({
  id: uid(),
  dbtId,
  mode,
  criteria: emptyCriteria(),
  updatedAt: nowIso()
});

const makeAudit = (action: string, entityId: string, summary: string, before?: string, after?: string): AuditEntry => ({
  id: uid(),
  timestamp: nowIso(),
  action,
  entityId,
  summary,
  before,
  after
});

const defaultDbt = (): DBTReference => ({
  id: uid(),
  title: 'Baseline DBT Reference',
  adversaryType: 'Structured threat model',
  confidence: 'Medium',
  description: 'General defensive assessment reference for asset prioritization. Replace with a full DBT from the DBT wizard when available.',
  goals: 'Disruption, exploitation, or coercive leverage against mission critical assets.',
  sourceNotes: 'Initial placeholder for defensive assessment planning.',
  createdAt: nowIso(),
  updatedAt: nowIso()
});

const blankAsset = (dbtId: string, mode: ScoreMode): AssetRecord => ({
  id: uid(),
  name: 'New Asset',
  sector: 'Unassigned',
  type: 'Asset',
  location: 'TBD',
  owner: 'TBD',
  status: 'Draft',
  notes: '',
  scoreSessions: [createScoreSession(dbtId, mode)],
  createdAt: nowIso(),
  updatedAt: nowIso()
});

const sampleAssessment = (): Assessment => {
  const dbt1: DBTReference = {
    id: uid(),
    title: 'Armed Spoiler - Aid Corridor Disruption',
    adversaryType: 'Armed non-state actor',
    confidence: 'Medium',
    description: 'Small mobile group with local route knowledge and coercive influence at checkpoints. Used for defensive logistics prioritization only.',
    goals: 'Disrupt aid movement, divert commodities, and create political leverage through control of access routes.',
    sourceNotes: 'Derived from sample NGO security risk management scenario.',
    createdAt: nowIso(),
    updatedAt: nowIso()
  };
  const dbt2: DBTReference = {
    id: uid(),
    title: 'Insider Diversion Risk',
    adversaryType: 'Insider',
    confidence: 'Low',
    description: 'Authorized access holder with knowledge of beneficiary lists, distribution schedule, and reporting requirements.',
    goals: 'Commodity diversion, false registration, or manipulation of access processes.',
    sourceNotes: 'Sample DBT for comparing internal and external vulnerability profiles.',
    createdAt: nowIso(),
    updatedAt: nowIso()
  };

  const makeAsset = (
    name: string,
    sector: string,
    type: string,
    location: string,
    scores: Record<CriterionKey, number>,
    rationaleSeed: string
  ): AssetRecord => ({
    id: uid(),
    name,
    sector,
    type,
    location,
    owner: 'Field Operations',
    status: 'Active',
    notes: 'Sample record. Replace with validated field data before production use.',
    scoreSessions: [
      {
        id: uid(),
        dbtId: dbt1.id,
        mode: 'classic',
        criteria: Object.fromEntries(
          CRITERIA.map((criterion) => [
            criterion.key,
            {
              score: scores[criterion.key],
              rationale: `${rationaleSeed} ${criterion.label} is scored ${scores[criterion.key]} because this asset has documented relevance to the sample DBT profile.`,
              evidence: 'Sample evidence note for demonstration.',
              updatedAt: nowIso()
            }
          ])
        ) as Record<CriterionKey, CriterionScore>,
        completedAt: nowIso(),
        updatedAt: nowIso()
      }
    ],
    createdAt: nowIso(),
    updatedAt: nowIso()
  });

  const assessment: Assessment = {
    id: uid(),
    name: 'Demo CARVER Matrix - Humanitarian Logistics',
    organization: 'Quanta Analytica / MNS Consulting',
    analyst: 'Demo Analyst',
    scope: 'Defensive asset prioritization for humanitarian delivery nodes.',
    notes: 'Sample dataset for demonstration. Toggle off or reset before real assessments.',
    status: 'Draft',
    date: today(),
    thresholds: { critical: 0.8, high: 0.7, medium: 0.5 },
    dbts: [dbt1, dbt2],
    assets: [
      makeAsset('Primary Border Crossing', 'Humanitarian Logistics', 'Access Node', 'Northern corridor', { C: 5, A: 4, R: 5, V: 4, E: 5, Rg: 5 }, 'The border crossing is a single access point.'),
      makeAsset('Main Food Warehouse', 'Humanitarian Logistics', 'Storage', 'Regional hub', { C: 5, A: 3, R: 4, V: 3, E: 4, Rg: 4 }, 'The warehouse supports continuity of distribution.'),
      makeAsset('Beneficiary Registry Database', 'Information Asset', 'Data System', 'Cloud and field devices', { C: 4, A: 3, R: 4, V: 4, E: 4, Rg: 3 }, 'The registry enables targeting accuracy.'),
      makeAsset('Alternate Distribution Point', 'Humanitarian Logistics', 'Distribution Site', 'Southern district', { C: 3, A: 2, R: 2, V: 2, E: 3, Rg: 3 }, 'The alternate site provides redundancy.')
    ],
    auditTrail: [makeAudit('Sample loaded', 'assessment', 'Demo assessment created.')],
    createdAt: nowIso(),
    updatedAt: nowIso()
  };
  return assessment;
};

const newAssessment = (): Assessment => {
  const dbt = defaultDbt();
  return {
    id: uid(),
    name: 'Untitled CARVER Assessment',
    organization: '',
    analyst: '',
    scope: '',
    notes: '',
    status: 'Draft',
    date: today(),
    thresholds: { critical: 0.8, high: 0.7, medium: 0.5 },
    dbts: [dbt],
    assets: [],
    auditTrail: [makeAudit('Assessment created', 'assessment', 'New blank assessment created.')],
    createdAt: nowIso(),
    updatedAt: nowIso()
  };
};

const totalScore = (session: ScoreSession): number => CRITERIA.reduce((sum, criterion) => sum + (session.criteria[criterion.key].score ?? 0), 0);
const paScore = (session: ScoreSession): number => totalScore(session) / 30;

const riskBand = (pa: number, thresholds: RiskThresholds): RiskBand => {
  if (pa >= thresholds.critical) return 'Critical';
  if (pa >= thresholds.high) return 'High';
  if (pa >= thresholds.medium) return 'Medium';
  return 'Low';
};

const isSessionComplete = (session: ScoreSession): boolean =>
  CRITERIA.every((criterion) => {
    const item = session.criteria[criterion.key];
    return item.score !== null && item.score >= 1 && item.score <= 5 && item.rationale.trim().length >= 12;
  });

const incompleteReasons = (session: ScoreSession): string[] =>
  CRITERIA.flatMap((criterion) => {
    const item = session.criteria[criterion.key];
    const reasons: string[] = [];
    if (item.score === null || item.score < 1 || item.score > 5) reasons.push(`${criterion.shortLabel}: missing score`);
    if (item.rationale.trim().length < 12) reasons.push(`${criterion.shortLabel}: rationale too short`);
    return reasons;
  });

const bandClasses: Record<RiskBand, string> = {
  Critical: 'bg-red-700 text-white border-red-500',
  High: 'bg-orange-600 text-white border-orange-400',
  Medium: 'bg-amber-500 text-slate-950 border-amber-300',
  Low: 'bg-emerald-600 text-white border-emerald-400'
};

const scoreColor = (score: number | null) => {
  if (score === null) return 'bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400';
  if (score <= 2) return 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-200';
  if (score === 3) return 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-200';
  return 'bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-200';
};

const formatPa = (pa: number) => pa.toFixed(2);

const escapeCsv = (value: string | number | null | undefined) => {
  const safe = value === null || value === undefined ? '' : String(value);
  return `"${safe.replaceAll('"', '""')}"`;
};

const downloadText = (filename: string, text: string, mime: string) => {
  const blob = new Blob([text], { type: mime });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
};

const getSession = (asset: AssetRecord, dbtId: string, mode: ScoreMode) =>
  asset.scoreSessions.find((session) => session.dbtId === dbtId && session.mode === mode);

const sanitizeImport = (candidate: Assessment): Assessment => {
  if (!candidate || typeof candidate !== 'object') throw new Error('Imported file does not contain an assessment object.');
  if (!Array.isArray(candidate.assets) || !Array.isArray(candidate.dbts)) throw new Error('Imported assessment is missing assets or DBT references.');
  const fallback = newAssessment();
  return {
    ...fallback,
    ...candidate,
    thresholds: candidate.thresholds ?? fallback.thresholds,
    dbts: candidate.dbts.length ? candidate.dbts : fallback.dbts,
    assets: candidate.assets.map((asset) => ({
      ...blankAsset(candidate.dbts[0]?.id ?? fallback.dbts[0].id, 'classic'),
      ...asset,
      scoreSessions: Array.isArray(asset.scoreSessions) ? asset.scoreSessions : []
    })),
    auditTrail: Array.isArray(candidate.auditTrail) ? candidate.auditTrail : [],
    updatedAt: nowIso()
  };
};

function App() {
  const [theme, setTheme] = useState<Theme>(() => (localStorage.getItem(THEME_KEY) as Theme) || 'dark');
  const [assessment, setAssessment] = useState<Assessment>(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (!saved) return sampleAssessment();
    try {
      return sanitizeImport(JSON.parse(saved));
    } catch {
      return sampleAssessment();
    }
  });
  const [activeTab, setActiveTab] = useState<TabKey>(() => (new URLSearchParams(window.location.search).get('tab') as TabKey) || 'overview');
  const [activeDbtId, setActiveDbtId] = useState<string>(() => new URLSearchParams(window.location.search).get('dbt') || '');
  const [mode, setMode] = useState<ScoreMode>('classic');
  const [search, setSearch] = useState(() => new URLSearchParams(window.location.search).get('search') || '');
  const [sectorFilter, setSectorFilter] = useState('All');
  const [riskFilter, setRiskFilter] = useState<RiskBand | 'All'>('All');
  const [selectedAssetId, setSelectedAssetId] = useState('');
  const [rubricKey, setRubricKey] = useState<CriterionKey | null>(null);
  const [alert, setAlert] = useState<{ type: 'error' | 'success' | 'info'; message: string } | null>(null);
  const [dbtDraft, setDbtDraft] = useState({ title: '', adversaryType: '', confidence: 'Medium' as DBTReference['confidence'], description: '', goals: '', sourceNotes: '' });
  const chartRef = useRef<SVGSVGElement | null>(null);

  useEffect(() => {
    document.documentElement.classList.toggle('dark', theme === 'dark');
    localStorage.setItem(THEME_KEY, theme);
  }, [theme]);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(assessment));
  }, [assessment]);

  useEffect(() => {
    if (!activeDbtId && assessment.dbts[0]) setActiveDbtId(assessment.dbts[0].id);
    if (!selectedAssetId && assessment.assets[0]) setSelectedAssetId(assessment.assets[0].id);
  }, [assessment.dbts, assessment.assets, activeDbtId, selectedAssetId]);

  useEffect(() => {
    const params = new URLSearchParams();
    params.set('tab', activeTab);
    if (activeDbtId) params.set('dbt', activeDbtId);
    if (search) params.set('search', search);
    const url = `${window.location.pathname}?${params.toString()}`;
    window.history.replaceState(null, '', url);
  }, [activeTab, activeDbtId, search]);

  const activeDbt = assessment.dbts.find((dbt) => dbt.id === activeDbtId) ?? assessment.dbts[0];
  const selectedAsset = assessment.assets.find((asset) => asset.id === selectedAssetId) ?? assessment.assets[0];

  const updateAssessment = (recipe: (draft: Assessment) => Assessment) => {
    setAssessment((prev) => ({ ...recipe(prev), updatedAt: nowIso(), status: 'Draft' }));
  };

  const flatRows = useMemo<FlatMatrixRow[]>(() => {
    return assessment.assets.flatMap((asset) =>
      asset.scoreSessions.map((session) => {
        const dbt = assessment.dbts.find((item) => item.id === session.dbtId);
        const pa = paScore(session);
        return {
          assetId: asset.id,
          assetName: asset.name,
          sector: asset.sector,
          type: asset.type,
          location: asset.location,
          dbtTitle: dbt?.title ?? 'Unknown DBT',
          mode: session.mode,
          total: totalScore(session),
          pa,
          band: riskBand(pa, assessment.thresholds),
          complete: isSessionComplete(session),
          incompleteReasons: incompleteReasons(session),
          scores: Object.fromEntries(CRITERIA.map((criterion) => [criterion.key, session.criteria[criterion.key].score])) as Record<CriterionKey, number | null>
        };
      })
    );
  }, [assessment]);

  const visibleRows = useMemo(() => {
    return flatRows
      .filter((row) => row.mode === mode)
      .filter((row) => !activeDbt || row.dbtTitle === activeDbt.title)
      .filter((row) => (sectorFilter === 'All' ? true : row.sector === sectorFilter))
      .filter((row) => (riskFilter === 'All' ? true : row.band === riskFilter))
      .filter((row) => `${row.assetName} ${row.sector} ${row.type} ${row.location}`.toLowerCase().includes(search.toLowerCase()))
      .sort((a, b) => b.pa - a.pa || b.total - a.total);
  }, [flatRows, mode, activeDbt, sectorFilter, riskFilter, search]);

  const topTen = useMemo(() => [...flatRows].filter((row) => row.complete).sort((a, b) => b.pa - a.pa).slice(0, 10), [flatRows]);
  const incompleteCount = flatRows.filter((row) => !row.complete).length;
  const completeCount = flatRows.filter((row) => row.complete).length;
  const avgPa = completeCount ? flatRows.filter((row) => row.complete).reduce((sum, row) => sum + row.pa, 0) / completeCount : 0;
  const highestPa = topTen[0]?.pa ?? 0;
  const sectors = ['All', ...Array.from(new Set(assessment.assets.map((asset) => asset.sector).filter(Boolean)))] as string[];

  const ensureSessionForAsset = (asset: AssetRecord, dbtId: string, scoreMode: ScoreMode): AssetRecord => {
    if (getSession(asset, dbtId, scoreMode)) return asset;
    return {
      ...asset,
      scoreSessions: [...asset.scoreSessions, createScoreSession(dbtId, scoreMode)],
      updatedAt: nowIso()
    };
  };

  const updateAssetField = (assetId: string, field: keyof AssetRecord, value: string) => {
    updateAssessment((prev) => ({
      ...prev,
      assets: prev.assets.map((asset) => (asset.id === assetId ? { ...asset, [field]: value, updatedAt: nowIso() } : asset)),
      auditTrail: [makeAudit('Asset updated', assetId, `Updated ${String(field)} for asset.`), ...prev.auditTrail]
    }));
  };

  const updateAssessmentField = (field: keyof Assessment, value: string) => {
    updateAssessment((prev) => ({
      ...prev,
      [field]: value,
      auditTrail: [makeAudit('Assessment metadata updated', 'assessment', `Updated ${String(field)}.`), ...prev.auditTrail]
    }));
  };

  const addAsset = () => {
    if (!activeDbt) return;
    const asset = blankAsset(activeDbt.id, mode);
    updateAssessment((prev) => ({
      ...prev,
      assets: [asset, ...prev.assets],
      auditTrail: [makeAudit('Asset added', asset.id, `Added asset ${asset.name}.`), ...prev.auditTrail]
    }));
    setSelectedAssetId(asset.id);
    setActiveTab('assets');
  };

  const duplicateAsset = (assetId: string) => {
    const original = assessment.assets.find((asset) => asset.id === assetId);
    if (!original) return;
    const copy: AssetRecord = {
      ...original,
      id: uid(),
      name: `${original.name} Copy`,
      scoreSessions: original.scoreSessions.map((session) => ({ ...session, id: uid() })),
      createdAt: nowIso(),
      updatedAt: nowIso()
    };
    updateAssessment((prev) => ({
      ...prev,
      assets: [copy, ...prev.assets],
      auditTrail: [makeAudit('Asset duplicated', copy.id, `Duplicated ${original.name}.`), ...prev.auditTrail]
    }));
    setSelectedAssetId(copy.id);
  };

  const deleteAsset = (assetId: string) => {
    const asset = assessment.assets.find((item) => item.id === assetId);
    if (!asset) return;
    if (!confirm(`Delete asset ${asset.name}? This cannot be undone.`)) return;
    updateAssessment((prev) => ({
      ...prev,
      assets: prev.assets.filter((item) => item.id !== assetId),
      auditTrail: [makeAudit('Asset deleted', assetId, `Deleted ${asset.name}.`), ...prev.auditTrail]
    }));
    setSelectedAssetId('');
  };

  const addDbt = (event: FormEvent) => {
    event.preventDefault();
    if (!dbtDraft.title.trim()) {
      setAlert({ type: 'error', message: 'DBT title is required.' });
      return;
    }
    const dbt: DBTReference = {
      id: uid(),
      title: dbtDraft.title.trim(),
      adversaryType: dbtDraft.adversaryType.trim() || 'Unspecified',
      confidence: dbtDraft.confidence,
      description: dbtDraft.description.trim(),
      goals: dbtDraft.goals.trim(),
      sourceNotes: dbtDraft.sourceNotes.trim(),
      createdAt: nowIso(),
      updatedAt: nowIso()
    };
    updateAssessment((prev) => ({
      ...prev,
      dbts: [...prev.dbts, dbt],
      assets: prev.assets.map((asset) => ensureSessionForAsset(asset, dbt.id, mode)),
      auditTrail: [makeAudit('DBT added', dbt.id, `Added DBT ${dbt.title}.`), ...prev.auditTrail]
    }));
    setActiveDbtId(dbt.id);
    setDbtDraft({ title: '', adversaryType: '', confidence: 'Medium', description: '', goals: '', sourceNotes: '' });
    setAlert({ type: 'success', message: 'DBT reference added and linked to existing assets.' });
  };

  const removeDbt = (dbtId: string) => {
    if (assessment.dbts.length <= 1) {
      setAlert({ type: 'error', message: 'At least one DBT reference is required.' });
      return;
    }
    const dbt = assessment.dbts.find((item) => item.id === dbtId);
    if (!dbt) return;
    if (!confirm(`Remove DBT ${dbt.title}? Scores tied only to this DBT will also be removed.`)) return;
    updateAssessment((prev) => ({
      ...prev,
      dbts: prev.dbts.filter((item) => item.id !== dbtId),
      assets: prev.assets.map((asset) => ({ ...asset, scoreSessions: asset.scoreSessions.filter((session) => session.dbtId !== dbtId) })),
      auditTrail: [makeAudit('DBT removed', dbtId, `Removed DBT ${dbt.title}.`), ...prev.auditTrail]
    }));
    setActiveDbtId(assessment.dbts.find((item) => item.id !== dbtId)?.id ?? '');
  };

  const ensureAllAssetsForView = () => {
    if (!activeDbt) return;
    updateAssessment((prev) => ({
      ...prev,
      assets: prev.assets.map((asset) => ensureSessionForAsset(asset, activeDbt.id, mode)),
      auditTrail: [makeAudit('Scoring sessions prepared', activeDbt.id, `Prepared ${mode} scoring sessions for active DBT.`), ...prev.auditTrail]
    }));
  };

  const updateScore = (assetId: string, dbtId: string, scoreMode: ScoreMode, criterionKey: CriterionKey, patch: Partial<CriterionScore>) => {
    updateAssessment((prev) => {
      let auditSummary = '';
      let before = '';
      let after = '';
      const assets = prev.assets.map((asset) => {
        if (asset.id !== assetId) return asset;
        const prepared = ensureSessionForAsset(asset, dbtId, scoreMode);
        return {
          ...prepared,
          scoreSessions: prepared.scoreSessions.map((session) => {
            if (session.dbtId !== dbtId || session.mode !== scoreMode) return session;
            const current = session.criteria[criterionKey];
            const nextScore = { ...current, ...patch, updatedAt: nowIso() };
            before = JSON.stringify({ score: current.score, rationale: current.rationale, evidence: current.evidence });
            after = JSON.stringify({ score: nextScore.score, rationale: nextScore.rationale, evidence: nextScore.evidence });
            auditSummary = `Updated ${criterionKey} score evidence for ${asset.name}.`;
            const updatedSession = {
              ...session,
              criteria: { ...session.criteria, [criterionKey]: nextScore },
              updatedAt: nowIso()
            };
            return isSessionComplete(updatedSession) ? { ...updatedSession, completedAt: updatedSession.completedAt ?? nowIso() } : { ...updatedSession, completedAt: undefined };
          }),
          updatedAt: nowIso()
        };
      });
      return {
        ...prev,
        assets,
        auditTrail: auditSummary ? [makeAudit('Score updated', assetId, auditSummary, before, after), ...prev.auditTrail] : prev.auditTrail
      };
    });
  };

  const validateForFinalExport = (): string[] => {
    if (!assessment.assets.length) return ['No assets have been added.'];
    if (!assessment.dbts.length) return ['At least one DBT reference is required.'];
    const incomplete = flatRows.filter((row) => !row.complete);
    if (incomplete.length) {
      return incomplete.slice(0, 8).map((row) => `${row.assetName} / ${row.dbtTitle}: ${row.incompleteReasons.join('; ')}`);
    }
    return [];
  };

  const markComplete = () => {
    const errors = validateForFinalExport();
    if (errors.length) {
      setAlert({ type: 'error', message: `Cannot mark complete. ${errors[0]}` });
      return;
    }
    setAssessment((prev) => ({
      ...prev,
      status: 'Complete',
      updatedAt: nowIso(),
      auditTrail: [makeAudit('Assessment completed', 'assessment', 'All score sessions validated and assessment marked complete.'), ...prev.auditTrail]
    }));
    setAlert({ type: 'success', message: 'Assessment marked complete.' });
  };

  const exportRows = () => flatRows.map((row) => ({
    Assessment: assessment.name,
    Date: assessment.date,
    DBT: row.dbtTitle,
    Mode: row.mode,
    Asset: row.assetName,
    Sector: row.sector,
    Type: row.type,
    Location: row.location,
    Criticality: row.scores.C,
    Accessibility: row.scores.A,
    Recuperability: row.scores.R,
    Vulnerability: row.scores.V,
    Effect: row.scores.E,
    Recognizability: row.scores.Rg,
    Total: row.total,
    Pa: formatPa(row.pa),
    Band: row.band,
    Complete: row.complete ? 'Yes' : 'No'
  }));

  const requireValidExport = () => {
    const errors = validateForFinalExport();
    if (errors.length) {
      setAlert({ type: 'error', message: `Final export blocked until scores and rationales are complete. ${errors[0]}` });
      return false;
    }
    return true;
  };

  const exportJson = () => {
    if (!requireValidExport()) return;
    downloadText(`${assessment.name.replaceAll(' ', '_')}_CARVER.json`, JSON.stringify({ ...assessment, exportedAt: nowIso() }, null, 2), 'application/json');
    setAlert({ type: 'success', message: 'JSON export created.' });
  };

  const exportDraftBackup = () => {
    downloadText(`${assessment.name.replaceAll(' ', '_')}_draft_backup.json`, JSON.stringify({ ...assessment, draftBackup: true, exportedAt: nowIso() }, null, 2), 'application/json');
    setAlert({ type: 'info', message: 'Draft backup exported. Final matrix exports still require complete rationales.' });
  };

  const exportCsv = () => {
    if (!requireValidExport()) return;
    const rows = exportRows();
    const headers = Object.keys(rows[0] ?? {});
    const csv = [headers.map(escapeCsv).join(','), ...rows.map((row) => headers.map((header) => escapeCsv(row[header as keyof typeof row])).join(','))].join('\n');
    downloadText(`${assessment.name.replaceAll(' ', '_')}_CARVER.csv`, csv, 'text/csv;charset=utf-8');
    setAlert({ type: 'success', message: 'CSV export created.' });
  };

  const exportExcel = () => {
    if (!requireValidExport()) return;
    const rows = exportRows();
    const headers = Object.keys(rows[0] ?? {});
    const html = `
      <html><head><meta charset="UTF-8"></head><body>
      <table border="1"><thead><tr>${headers.map((h) => `<th>${h}</th>`).join('')}</tr></thead>
      <tbody>${rows.map((row) => `<tr>${headers.map((header) => `<td>${String(row[header as keyof typeof row] ?? '')}</td>`).join('')}</tr>`).join('')}</tbody></table>
      </body></html>`;
    downloadText(`${assessment.name.replaceAll(' ', '_')}_CARVER.xls`, html, 'application/vnd.ms-excel;charset=utf-8');
    setAlert({ type: 'success', message: 'Excel-compatible export created.' });
  };

  const exportPng = () => {
    if (!requireValidExport()) return;
    if (!chartRef.current) {
      setAlert({ type: 'error', message: 'No chart is available to export.' });
      return;
    }
    const serializer = new XMLSerializer();
    const svg = serializer.serializeToString(chartRef.current);
    const svgBlob = new Blob([svg], { type: 'image/svg+xml;charset=utf-8' });
    const url = URL.createObjectURL(svgBlob);
    const image = new Image();
    image.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = 1200;
      canvas.height = 720;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;
      ctx.fillStyle = theme === 'dark' ? '#0A0C10' : '#F4F1EA';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(image, 0, 0, canvas.width, canvas.height);
      canvas.toBlob((blob) => {
        if (!blob) return;
        const pngUrl = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = pngUrl;
        link.download = `${assessment.name.replaceAll(' ', '_')}_Top10.png`;
        link.click();
        URL.revokeObjectURL(pngUrl);
      });
      URL.revokeObjectURL(url);
    };
    image.src = url;
  };

  const printPdf = () => {
    if (!requireValidExport()) return;
    window.print();
  };

  const importJson = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const imported = sanitizeImport(JSON.parse(String(reader.result)));
        imported.auditTrail = [makeAudit('Assessment imported', imported.id, `Imported from ${file.name}.`), ...imported.auditTrail];
        setAssessment(imported);
        setActiveDbtId(imported.dbts[0]?.id ?? '');
        setSelectedAssetId(imported.assets[0]?.id ?? '');
        setAlert({ type: 'success', message: 'Assessment imported.' });
      } catch (error) {
        setAlert({ type: 'error', message: error instanceof Error ? error.message : 'Import failed.' });
      }
    };
    reader.readAsText(file);
    event.target.value = '';
  };

  const resetAssessment = () => {
    if (!confirm('Reset the assessment and clear local saved data?')) return;
    const next = newAssessment();
    setAssessment(next);
    setActiveDbtId(next.dbts[0].id);
    setSelectedAssetId('');
    setAlert({ type: 'info', message: 'Assessment reset.' });
  };

  const loadSample = () => {
    if (!confirm('Load sample data? Current local assessment will be replaced.')) return;
    const next = sampleAssessment();
    setAssessment(next);
    setActiveDbtId(next.dbts[0].id);
    setSelectedAssetId(next.assets[0]?.id ?? '');
    setAlert({ type: 'success', message: 'Sample data loaded.' });
  };

  const copyShareUrl = async () => {
    try {
      await navigator.clipboard.writeText(window.location.href);
      setAlert({ type: 'success', message: 'Shareable view URL copied. Data remains local to this browser.' });
    } catch {
      setAlert({ type: 'error', message: 'Could not copy URL.' });
    }
  };

  const currentSession = selectedAsset && activeDbt ? getSession(selectedAsset, activeDbt.id, mode) ?? createScoreSession(activeDbt.id, mode) : null;

  return (
    <div className="min-h-screen bg-sand text-slate-950 dark:bg-obsidian dark:text-slate-100">
      <div className="no-print border-b border-slate-200 bg-white/90 backdrop-blur dark:border-slate-800 dark:bg-slate-950/85">
        <div className="mx-auto flex max-w-[1600px] flex-col gap-4 px-4 py-4 lg:flex-row lg:items-center lg:justify-between lg:px-6">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.32em] text-gold">Quanta Analytica CARVER Tool</p>
            <h1 className="mt-1 text-2xl font-black tracking-tight sm:text-3xl">Interactive CARVER Matrix Builder</h1>
            <p className="mt-1 max-w-3xl text-sm text-slate-600 dark:text-slate-300">
              Defensive asset prioritization for security risk management, humanitarian operations, critical infrastructure protection, and management decision support.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')} label={theme === 'dark' ? 'Light Mode' : 'Dark Mode'} />
            <Button onClick={copyShareUrl} label="Copy View URL" />
            <Button onClick={markComplete} label="Mark Complete" variant="primary" />
          </div>
        </div>
      </div>

      <main className="mx-auto grid max-w-[1600px] gap-4 px-4 py-4 lg:grid-cols-[360px_1fr] lg:px-6">
        <aside className="no-print space-y-4 lg:sticky lg:top-4 lg:h-[calc(100vh-2rem)] lg:overflow-y-auto">
          <Panel title="Assessment Controls">
            <div className="space-y-3">
              <Input label="Assessment name" value={assessment.name} onChange={(value) => updateAssessmentField('name', value)} />
              <Input label="Organization" value={assessment.organization} onChange={(value) => updateAssessmentField('organization', value)} />
              <Input label="Analyst" value={assessment.analyst} onChange={(value) => updateAssessmentField('analyst', value)} />
              <Input label="Date" type="date" value={assessment.date} onChange={(value) => updateAssessmentField('date', value)} />
              <Textarea label="Scope" value={assessment.scope} onChange={(value) => updateAssessmentField('scope', value)} />
              <div className="rounded-xl border border-slate-200 p-3 text-xs dark:border-slate-800">
                <div className="flex items-center justify-between">
                  <span>Status</span>
                  <span className={`rounded-full px-2 py-1 font-semibold ${assessment.status === 'Complete' ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-200' : 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-200'}`}>{assessment.status}</span>
                </div>
                <p className="mt-2 text-slate-500 dark:text-slate-400">Drafts auto-save locally. Final exports require complete scores and rationales.</p>
              </div>
            </div>
          </Panel>

          <Panel title="DBT and View Settings">
            <div className="space-y-3">
              <label className="block text-xs font-bold uppercase tracking-wide text-slate-500 dark:text-slate-400" htmlFor="dbt-select">Active DBT</label>
              <select id="dbt-select" className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm dark:border-slate-800 dark:bg-slate-900" value={activeDbt?.id ?? ''} onChange={(event) => setActiveDbtId(event.target.value)}>
                {assessment.dbts.map((dbt) => <option key={dbt.id} value={dbt.id}>{dbt.title}</option>)}
              </select>
              <label className="block text-xs font-bold uppercase tracking-wide text-slate-500 dark:text-slate-400" htmlFor="mode-select">Scoring view</label>
              <select id="mode-select" className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm dark:border-slate-800 dark:bg-slate-900" value={mode} onChange={(event) => setMode(event.target.value as ScoreMode)}>
                <option value="classic">Classic threat view</option>
                <option value="continuity">Continuity view</option>
              </select>
              <Button onClick={ensureAllAssetsForView} label="Prepare Sessions for View" full />
              {activeDbt && (
                <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 text-xs dark:border-slate-800 dark:bg-slate-900">
                  <div className="font-bold text-gold">{activeDbt.adversaryType}</div>
                  <p className="mt-1 text-slate-600 dark:text-slate-300">{activeDbt.description || 'No DBT description entered.'}</p>
                  <p className="mt-2 text-slate-500 dark:text-slate-400">Confidence: {activeDbt.confidence}</p>
                </div>
              )}
            </div>
          </Panel>

          <Panel title="Add DBT Reference">
            <form className="space-y-3" onSubmit={addDbt}>
              <Input label="DBT title" value={dbtDraft.title} onChange={(value) => setDbtDraft((prev) => ({ ...prev, title: value }))} />
              <Input label="Adversary type" value={dbtDraft.adversaryType} onChange={(value) => setDbtDraft((prev) => ({ ...prev, adversaryType: value }))} />
              <label className="block text-xs font-bold uppercase tracking-wide text-slate-500 dark:text-slate-400" htmlFor="confidence-select">Confidence</label>
              <select id="confidence-select" className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm dark:border-slate-800 dark:bg-slate-900" value={dbtDraft.confidence} onChange={(event) => setDbtDraft((prev) => ({ ...prev, confidence: event.target.value as DBTReference['confidence'] }))}>
                <option>Low</option>
                <option>Medium</option>
                <option>High</option>
              </select>
              <Textarea label="Description" value={dbtDraft.description} onChange={(value) => setDbtDraft((prev) => ({ ...prev, description: value }))} />
              <Textarea label="Goals and source notes" value={dbtDraft.goals} onChange={(value) => setDbtDraft((prev) => ({ ...prev, goals: value }))} />
              <Button type="submit" label="Add DBT" variant="primary" full />
            </form>
          </Panel>

          <Panel title="Import and Export">
            <div className="grid grid-cols-2 gap-2">
              <label className="cursor-pointer rounded-xl border border-slate-200 bg-white px-3 py-2 text-center text-sm font-semibold hover:border-gold dark:border-slate-800 dark:bg-slate-900">
                Import JSON
                <input className="sr-only" type="file" accept="application/json,.json" onChange={importJson} />
              </label>
              <Button onClick={exportDraftBackup} label="Draft Backup" />
              <Button onClick={exportJson} label="JSON" />
              <Button onClick={exportCsv} label="CSV" />
              <Button onClick={exportExcel} label="Excel" />
              <Button onClick={printPdf} label="PDF/Print" />
              <Button onClick={exportPng} label="PNG Chart" />
              <Button onClick={loadSample} label="Sample Data" />
              <Button onClick={resetAssessment} label="Reset" variant="danger" />
            </div>
            <p className="mt-3 text-xs text-slate-500 dark:text-slate-400">Final exports are blocked until every criterion has a score and a rationale. Draft backup is available for continuity.</p>
          </Panel>
        </aside>

        <section className="min-w-0 space-y-4">
          {alert && (
            <div className={`no-print rounded-2xl border px-4 py-3 text-sm ${alert.type === 'error' ? 'border-red-300 bg-red-50 text-red-800 dark:border-red-800 dark:bg-red-950 dark:text-red-100' : alert.type === 'success' ? 'border-emerald-300 bg-emerald-50 text-emerald-800 dark:border-emerald-800 dark:bg-emerald-950 dark:text-emerald-100' : 'border-blue-300 bg-blue-50 text-blue-800 dark:border-blue-800 dark:bg-blue-950 dark:text-blue-100'}`}>
              <div className="flex items-center justify-between gap-3">
                <span>{alert.message}</span>
                <button className="font-bold" onClick={() => setAlert(null)} aria-label="Dismiss alert">Close</button>
              </div>
            </div>
          )}

          <div className="print-only mb-4">
            <h1>{assessment.name}</h1>
            <p>{assessment.organization} | {assessment.analyst} | {assessment.date}</p>
          </div>

          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
            <Metric label="Assets" value={assessment.assets.length} sub="records" />
            <Metric label="DBTs" value={assessment.dbts.length} sub="references" />
            <Metric label="Complete" value={completeCount} sub="score sessions" />
            <Metric label="Average Pa" value={formatPa(avgPa)} sub="completed only" />
            <Metric label="Highest Pa" value={formatPa(highestPa)} sub={topTen[0]?.band ?? 'No complete row'} />
          </div>

          <nav className="no-print flex flex-wrap gap-2 rounded-2xl border border-slate-200 bg-white p-2 shadow-card dark:border-slate-800 dark:bg-slate-950">
            {(['overview', 'matrix', 'assets', 'audit'] as TabKey[]).map((tab) => (
              <button key={tab} onClick={() => setActiveTab(tab)} className={`rounded-xl px-4 py-2 text-sm font-bold capitalize ${activeTab === tab ? 'bg-navy text-white dark:bg-gold dark:text-slate-950' : 'bg-slate-100 text-slate-700 hover:bg-slate-200 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800'}`}>{tab}</button>
            ))}
          </nav>

          {activeTab === 'overview' && (
            <Overview
              assessment={assessment}
              topTen={topTen}
              chartRef={chartRef}
              incompleteCount={incompleteCount}
              activeDbt={activeDbt}
              removeDbt={removeDbt}
            />
          )}

          {activeTab === 'matrix' && (
            <MatrixView
              rows={visibleRows}
              search={search}
              setSearch={setSearch}
              sectorFilter={sectorFilter}
              setSectorFilter={setSectorFilter}
              riskFilter={riskFilter}
              setRiskFilter={setRiskFilter}
              sectors={sectors}
              setSelectedAssetId={setSelectedAssetId}
              setActiveTab={setActiveTab}
              setRubricKey={setRubricKey}
            />
          )}

          {activeTab === 'assets' && (
            <AssetEditor
              assets={assessment.assets}
              selectedAsset={selectedAsset}
              activeDbt={activeDbt}
              currentSession={currentSession}
              mode={mode}
              updateAssetField={updateAssetField}
              updateScore={updateScore}
              addAsset={addAsset}
              duplicateAsset={duplicateAsset}
              deleteAsset={deleteAsset}
              setSelectedAssetId={setSelectedAssetId}
              setRubricKey={setRubricKey}
              thresholds={assessment.thresholds}
            />
          )}

          {activeTab === 'audit' && <AuditView entries={assessment.auditTrail} />}
        </section>
      </main>

      {rubricKey && <RubricDrawer criterionKey={rubricKey} onClose={() => setRubricKey(null)} />}
    </div>
  );
}

function Button({ label, onClick, type = 'button', variant = 'default', full = false }: { label: string; onClick?: () => void; type?: 'button' | 'submit'; variant?: 'default' | 'primary' | 'danger'; full?: boolean }) {
  const classes = variant === 'primary'
    ? 'border-gold bg-gold text-slate-950 hover:bg-[#d9bd84]'
    : variant === 'danger'
      ? 'border-red-300 bg-red-50 text-red-700 hover:bg-red-100 dark:border-red-800 dark:bg-red-950 dark:text-red-100 dark:hover:bg-red-900'
      : 'border-slate-200 bg-white text-slate-800 hover:border-gold hover:text-slate-950 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-100 dark:hover:border-gold';
  return <button type={type} onClick={onClick} className={`${full ? 'w-full' : ''} rounded-xl border px-3 py-2 text-sm font-bold transition ${classes}`}>{label}</button>;
}

function Panel({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-card dark:border-slate-800 dark:bg-slate-950">
      <h2 className="mb-3 text-sm font-black uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400">{title}</h2>
      {children}
    </section>
  );
}

function Input({ label, value, onChange, type = 'text' }: { label: string; value: string; onChange: (value: string) => void; type?: string }) {
  const id = label.toLowerCase().replaceAll(' ', '-');
  return (
    <label className="block" htmlFor={id}>
      <span className="mb-1 block text-xs font-bold uppercase tracking-wide text-slate-500 dark:text-slate-400">{label}</span>
      <input id={id} type={type} value={value} onChange={(event) => onChange(event.target.value)} className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-gold dark:border-slate-800 dark:bg-slate-900" />
    </label>
  );
}

function Textarea({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) {
  const id = label.toLowerCase().replaceAll(' ', '-');
  return (
    <label className="block" htmlFor={id}>
      <span className="mb-1 block text-xs font-bold uppercase tracking-wide text-slate-500 dark:text-slate-400">{label}</span>
      <textarea id={id} value={value} onChange={(event) => onChange(event.target.value)} rows={3} className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-gold dark:border-slate-800 dark:bg-slate-900" />
    </label>
  );
}

function Metric({ label, value, sub }: { label: string; value: string | number; sub: string }) {
  return (
    <div className="print-card rounded-2xl border border-slate-200 bg-white p-4 shadow-card dark:border-slate-800 dark:bg-slate-950">
      <p className="text-xs font-bold uppercase tracking-wide text-slate-500 dark:text-slate-400">{label}</p>
      <p className="mt-2 text-3xl font-black text-navy dark:text-gold">{value}</p>
      <p className="text-xs text-slate-500 dark:text-slate-400">{sub}</p>
    </div>
  );
}

function Overview({ assessment, topTen, chartRef, incompleteCount, activeDbt, removeDbt }: { assessment: Assessment; topTen: FlatMatrixRow[]; chartRef: React.RefObject<SVGSVGElement | null>; incompleteCount: number; activeDbt?: DBTReference; removeDbt: (dbtId: string) => void }) {
  const maxPa = Math.max(1, ...topTen.map((row) => row.pa));
  return (
    <div className="grid gap-4 xl:grid-cols-[1.25fr_0.75fr]">
      <Panel title="Top 10 Highest-Risk Assets">
        {topTen.length ? (
          <div className="overflow-x-auto">
            <svg ref={chartRef} viewBox="0 0 1200 720" role="img" aria-label="Top ten CARVER risk chart" className="min-h-[360px] w-full rounded-2xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-950">
              <rect x="0" y="0" width="1200" height="720" fill="currentColor" className="text-white dark:text-slate-950" />
              <text x="48" y="58" className="fill-slate-950 text-3xl font-black dark:fill-slate-100">Top 10 CARVER Pa Scores</text>
              <text x="48" y="92" className="fill-slate-500 text-sm dark:fill-slate-400">Completed score sessions only. Pa = total CARVER score / 30.</text>
              {topTen.map((row, index) => {
                const y = 130 + index * 52;
                const width = Math.max(12, (row.pa / maxPa) * 720);
                return (
                  <g key={`${row.assetId}-${row.dbtTitle}-${row.mode}`}>
                    <text x="48" y={y + 22} className="fill-slate-700 text-sm font-bold dark:fill-slate-200">{index + 1}. {row.assetName.slice(0, 38)}</text>
                    <rect x="410" y={y} width="720" height="28" rx="10" className="fill-slate-100 dark:fill-slate-800" />
                    <rect x="410" y={y} width={width} height="28" rx="10" className={row.band === 'Critical' ? 'fill-red-700' : row.band === 'High' ? 'fill-orange-600' : row.band === 'Medium' ? 'fill-amber-500' : 'fill-emerald-600'} />
                    <text x="1148" y={y + 20} textAnchor="end" className="fill-slate-700 text-sm font-black dark:fill-slate-100">{formatPa(row.pa)} {row.band}</text>
                  </g>
                );
              })}
            </svg>
          </div>
        ) : (
          <EmptyState title="No complete rows yet" message="Complete all six criteria and rationales for at least one scoring session to populate the top-10 view." />
        )}
      </Panel>

      <div className="space-y-4">
        <Panel title="Assessment Summary">
          <div className="space-y-3 text-sm text-slate-600 dark:text-slate-300">
            <p><span className="font-bold text-slate-900 dark:text-slate-100">Name:</span> {assessment.name}</p>
            <p><span className="font-bold text-slate-900 dark:text-slate-100">Scope:</span> {assessment.scope || 'No scope entered.'}</p>
            <p><span className="font-bold text-slate-900 dark:text-slate-100">Active DBT:</span> {activeDbt?.title ?? 'None'}</p>
            <p><span className="font-bold text-slate-900 dark:text-slate-100">Incomplete sessions:</span> {incompleteCount}</p>
            <p><span className="font-bold text-slate-900 dark:text-slate-100">Final export rule:</span> Every criterion must have a 1 to 5 score and a written rationale.</p>
          </div>
        </Panel>
        <Panel title="DBT References">
          <div className="space-y-3">
            {assessment.dbts.map((dbt) => (
              <div key={dbt.id} className="rounded-xl border border-slate-200 p-3 dark:border-slate-800">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="font-black">{dbt.title}</p>
                    <p className="text-xs uppercase tracking-wide text-gold">{dbt.adversaryType} | {dbt.confidence} confidence</p>
                    <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">{dbt.description || 'No description entered.'}</p>
                  </div>
                  <button className="no-print text-xs font-bold text-red-600 dark:text-red-300" onClick={() => removeDbt(dbt.id)}>Remove</button>
                </div>
              </div>
            ))}
          </div>
        </Panel>
      </div>
    </div>
  );
}

function MatrixView({ rows, search, setSearch, sectorFilter, setSectorFilter, riskFilter, setRiskFilter, sectors, setSelectedAssetId, setActiveTab, setRubricKey }: { rows: FlatMatrixRow[]; search: string; setSearch: (value: string) => void; sectorFilter: string; setSectorFilter: (value: string) => void; riskFilter: RiskBand | 'All'; setRiskFilter: (value: RiskBand | 'All') => void; sectors: string[]; setSelectedAssetId: (value: string) => void; setActiveTab: (value: TabKey) => void; setRubricKey: (key: CriterionKey) => void }) {
  return (
    <Panel title="CARVER Matrix">
      <div className="no-print mb-4 grid gap-3 lg:grid-cols-[1fr_180px_180px]">
        <Input label="Search assets" value={search} onChange={setSearch} />
        <label className="block">
          <span className="mb-1 block text-xs font-bold uppercase tracking-wide text-slate-500 dark:text-slate-400">Sector</span>
          <select value={sectorFilter} onChange={(event) => setSectorFilter(event.target.value)} className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm dark:border-slate-800 dark:bg-slate-900">
            {sectors.map((sector) => <option key={sector}>{sector}</option>)}
          </select>
        </label>
        <label className="block">
          <span className="mb-1 block text-xs font-bold uppercase tracking-wide text-slate-500 dark:text-slate-400">Risk band</span>
          <select value={riskFilter} onChange={(event) => setRiskFilter(event.target.value as RiskBand | 'All')} className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm dark:border-slate-800 dark:bg-slate-900">
            {['All', 'Critical', 'High', 'Medium', 'Low'].map((band) => <option key={band}>{band}</option>)}
          </select>
        </label>
      </div>
      <div className="no-print mb-3 flex flex-wrap gap-2">
        {CRITERIA.map((criterion) => <Button key={criterion.key} label={`${criterion.shortLabel} Rubric`} onClick={() => setRubricKey(criterion.key)} />)}
      </div>
      {rows.length ? (
        <div className="overflow-x-auto rounded-2xl border border-slate-200 dark:border-slate-800">
          <table className="min-w-[1050px] w-full border-collapse text-left text-sm">
            <thead className="bg-navy text-white dark:bg-slate-900">
              <tr>
                <th className="px-3 py-3">Asset</th>
                <th className="px-3 py-3">DBT</th>
                {CRITERIA.map((criterion) => <th key={criterion.key} className="px-3 py-3 text-center">{criterion.shortLabel}</th>)}
                <th className="px-3 py-3 text-center">Total</th>
                <th className="px-3 py-3 text-center">Pa</th>
                <th className="px-3 py-3">Band</th>
                <th className="px-3 py-3">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
              {rows.map((row) => (
                <tr key={`${row.assetId}-${row.dbtTitle}-${row.mode}`} className="bg-white hover:bg-slate-50 dark:bg-slate-950 dark:hover:bg-slate-900">
                  <td className="px-3 py-3">
                    <button className="text-left font-bold text-navy underline-offset-2 hover:underline dark:text-gold" onClick={() => { setSelectedAssetId(row.assetId); setActiveTab('assets'); }}>{row.assetName}</button>
                    <div className="text-xs text-slate-500">{row.sector} | {row.type} | {row.location}</div>
                  </td>
                  <td className="px-3 py-3 text-xs text-slate-600 dark:text-slate-300">{row.dbtTitle}</td>
                  {CRITERIA.map((criterion) => <td key={criterion.key} className="px-3 py-3 text-center"><span className={`inline-flex h-8 w-8 items-center justify-center rounded-full font-black ${scoreColor(row.scores[criterion.key])}`}>{row.scores[criterion.key] ?? '-'}</span></td>)}
                  <td className="px-3 py-3 text-center font-black">{row.total}</td>
                  <td className="px-3 py-3 text-center font-black">{formatPa(row.pa)}</td>
                  <td className="px-3 py-3"><span className={`rounded-full border px-2 py-1 text-xs font-black ${bandClasses[row.band]}`}>{row.band}</span></td>
                  <td className="px-3 py-3 text-xs">
                    {row.complete ? <span className="font-bold text-emerald-700 dark:text-emerald-300">Complete</span> : <span className="font-bold text-amber-700 dark:text-amber-300" title={row.incompleteReasons.join('\n')}>Draft</span>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <EmptyState title="No matrix rows found" message="Add assets, prepare scoring sessions for the active DBT, or adjust your filters." />
      )}
    </Panel>
  );
}

function AssetEditor({ assets, selectedAsset, activeDbt, currentSession, mode, updateAssetField, updateScore, addAsset, duplicateAsset, deleteAsset, setSelectedAssetId, setRubricKey, thresholds }: { assets: AssetRecord[]; selectedAsset?: AssetRecord; activeDbt?: DBTReference; currentSession: ScoreSession | null; mode: ScoreMode; updateAssetField: (assetId: string, field: keyof AssetRecord, value: string) => void; updateScore: (assetId: string, dbtId: string, scoreMode: ScoreMode, criterionKey: CriterionKey, patch: Partial<CriterionScore>) => void; addAsset: () => void; duplicateAsset: (assetId: string) => void; deleteAsset: (assetId: string) => void; setSelectedAssetId: (value: string) => void; setRubricKey: (key: CriterionKey) => void; thresholds: RiskThresholds }) {
  if (!selectedAsset || !activeDbt) {
    return (
      <Panel title="Asset Editor">
        <EmptyState title="No asset selected" message="Add an asset to begin scoring." />
        <div className="mt-4"><Button onClick={addAsset} label="Add Asset" variant="primary" /></div>
      </Panel>
    );
  }

  const session = currentSession ?? createScoreSession(activeDbt.id, mode);
  const total = totalScore(session);
  const pa = paScore(session);
  const band = riskBand(pa, thresholds);
  const complete = isSessionComplete(session);

  return (
    <div className="grid gap-4 xl:grid-cols-[320px_1fr]">
      <Panel title="Asset List">
        <Button onClick={addAsset} label="Add Asset" variant="primary" full />
        <div className="mt-3 max-h-[500px] space-y-2 overflow-y-auto pr-1">
          {assets.map((asset) => (
            <button key={asset.id} onClick={() => setSelectedAssetId(asset.id)} className={`w-full rounded-xl border p-3 text-left text-sm ${asset.id === selectedAsset.id ? 'border-gold bg-gold/10' : 'border-slate-200 bg-white hover:border-gold dark:border-slate-800 dark:bg-slate-900'}`}>
              <span className="block font-black">{asset.name}</span>
              <span className="text-xs text-slate-500 dark:text-slate-400">{asset.sector} | {asset.type}</span>
            </button>
          ))}
        </div>
      </Panel>

      <Panel title="Asset Details and CARVER Scoring">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-900">
          <div>
            <p className="text-xs font-bold uppercase tracking-wide text-slate-500 dark:text-slate-400">Active score session</p>
            <p className="text-xl font-black">Total {total} / 30 | Pa {formatPa(pa)} | <span className={`rounded-full border px-2 py-1 text-xs ${bandClasses[band]}`}>{band}</span></p>
            <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">Status: {complete ? 'Complete' : incompleteReasons(session).join('; ')}</p>
          </div>
          <div className="flex gap-2">
            <Button onClick={() => duplicateAsset(selectedAsset.id)} label="Duplicate" />
            <Button onClick={() => deleteAsset(selectedAsset.id)} label="Delete" variant="danger" />
          </div>
        </div>

        <div className="mb-6 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          <Input label="Asset name" value={selectedAsset.name} onChange={(value) => updateAssetField(selectedAsset.id, 'name', value)} />
          <Input label="Sector" value={selectedAsset.sector} onChange={(value) => updateAssetField(selectedAsset.id, 'sector', value)} />
          <Input label="Type" value={selectedAsset.type} onChange={(value) => updateAssetField(selectedAsset.id, 'type', value)} />
          <Input label="Location" value={selectedAsset.location} onChange={(value) => updateAssetField(selectedAsset.id, 'location', value)} />
          <Input label="Owner" value={selectedAsset.owner} onChange={(value) => updateAssetField(selectedAsset.id, 'owner', value)} />
          <Input label="Status" value={selectedAsset.status} onChange={(value) => updateAssetField(selectedAsset.id, 'status', value)} />
          <div className="md:col-span-2 xl:col-span-3"><Textarea label="Asset notes" value={selectedAsset.notes} onChange={(value) => updateAssetField(selectedAsset.id, 'notes', value)} /></div>
        </div>

        <div className="grid gap-4">
          {CRITERIA.map((criterion) => {
            const score = session.criteria[criterion.key];
            return (
              <div key={criterion.key} className="print-card rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-950">
                <div className="mb-3 flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <h3 className="text-lg font-black">{criterion.shortLabel} - {criterion.label}</h3>
                    <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">{criterion.description}</p>
                    <p className="mt-1 text-xs text-gold">{criterion.anchor}</p>
                  </div>
                  <Button label="Open Rubric" onClick={() => setRubricKey(criterion.key)} />
                </div>
                <div className="grid gap-3 lg:grid-cols-[160px_1fr_1fr]">
                  <label className="block">
                    <span className="mb-1 block text-xs font-bold uppercase tracking-wide text-slate-500 dark:text-slate-400">Score 1 to 5</span>
                    <select value={score.score ?? ''} onChange={(event) => updateScore(selectedAsset.id, activeDbt.id, mode, criterion.key, { score: event.target.value ? Number(event.target.value) : null })} className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm dark:border-slate-800 dark:bg-slate-900">
                      <option value="">Select</option>
                      {[1, 2, 3, 4, 5].map((value) => <option key={value} value={value}>{value}</option>)}
                    </select>
                  </label>
                  <Textarea label="Required rationale" value={score.rationale} onChange={(value) => updateScore(selectedAsset.id, activeDbt.id, mode, criterion.key, { rationale: value })} />
                  <Textarea label="Evidence notes" value={score.evidence} onChange={(value) => updateScore(selectedAsset.id, activeDbt.id, mode, criterion.key, { evidence: value })} />
                </div>
              </div>
            );
          })}
        </div>
      </Panel>
    </div>
  );
}

function AuditView({ entries }: { entries: AuditEntry[] }) {
  return (
    <Panel title="Audit Trail">
      {entries.length ? (
        <div className="space-y-3">
          {entries.slice(0, 250).map((entry) => (
            <div key={entry.id} className="rounded-2xl border border-slate-200 bg-white p-4 text-sm dark:border-slate-800 dark:bg-slate-950">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="font-black">{entry.action}</p>
                <p className="text-xs text-slate-500 dark:text-slate-400">{new Date(entry.timestamp).toLocaleString()}</p>
              </div>
              <p className="mt-1 text-slate-600 dark:text-slate-300">{entry.summary}</p>
              {entry.before && entry.after && (
                <details className="mt-2 text-xs">
                  <summary className="cursor-pointer font-bold text-gold">View change details</summary>
                  <div className="mt-2 grid gap-2 lg:grid-cols-2">
                    <pre className="overflow-auto rounded-xl bg-slate-100 p-3 dark:bg-slate-900">{entry.before}</pre>
                    <pre className="overflow-auto rounded-xl bg-slate-100 p-3 dark:bg-slate-900">{entry.after}</pre>
                  </div>
                </details>
              )}
            </div>
          ))}
        </div>
      ) : <EmptyState title="No audit events" message="Changes to scoring, assets, DBTs, and assessment status will appear here." />}
    </Panel>
  );
}

function RubricDrawer({ criterionKey, onClose }: { criterionKey: CriterionKey; onClose: () => void }) {
  const criterion = CRITERIA.find((item) => item.key === criterionKey)!;
  return (
    <div className="no-print fixed inset-0 z-50 flex justify-end bg-black/50" role="dialog" aria-modal="true" aria-label={`${criterion.label} scoring rubric`}>
      <div className="h-full w-full max-w-xl overflow-y-auto bg-white p-6 shadow-2xl dark:bg-slate-950">
        <div className="mb-5 flex items-start justify-between gap-4">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.2em] text-gold">Scoring Rubric</p>
            <h2 className="mt-1 text-2xl font-black">{criterion.shortLabel} - {criterion.label}</h2>
            <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">{criterion.description}</p>
          </div>
          <button onClick={onClose} className="rounded-full border border-slate-200 px-3 py-2 text-sm font-bold dark:border-slate-800">Close</button>
        </div>
        <div className="space-y-3">
          {RUBRIC[criterionKey].map((item) => (
            <div key={item} className="rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm dark:border-slate-800 dark:bg-slate-900">{item}</div>
          ))}
        </div>
        <div className="mt-5 rounded-2xl border border-gold bg-gold/10 p-4 text-sm">
          <p className="font-black text-gold">Rationale rule</p>
          <p className="mt-1 text-slate-700 dark:text-slate-200">A score is not complete until the rationale explains why the selected value fits the asset, DBT, evidence, and assessment scope.</p>
        </div>
      </div>
    </div>
  );
}

function EmptyState({ title, message }: { title: string; message: string }) {
  return (
    <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-8 text-center dark:border-slate-700 dark:bg-slate-900">
      <p className="text-lg font-black">{title}</p>
      <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">{message}</p>
    </div>
  );
}

export default App;
