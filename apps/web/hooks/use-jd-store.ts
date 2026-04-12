import { create } from 'zustand';
import type { TemplateSection, EvaluationResult, FieldScore, EscoMatch, HonestReview } from '@jd-suite/types';
import type { JDData } from '@/lib/jd-helpers';
import { compScore } from '@/lib/jd-helpers';

export interface EndSessionResult {
  sessionSummary: string;
  completedWell: string[];
  mustComplete: Array<{ field: string; why: string }>;
  questionsForNextSession: string[];
  aiEnhancements: string[];
  estimatedQualityGain: string;
}

interface JDStore {
  // JD state
  jdId: string | null;
  jd: JDData;
  templateSections: TemplateSection[];
  activeSectionId: string;
  dqsScore: number;
  ersScore: number | null;

  // Quality state
  fieldScores: Record<string, FieldScore>;
  escoMatch: EscoMatch | null;
  evalResult: EvaluationResult | null;
  evalLoading: boolean;

  // UI state
  showHighlights: boolean;
  aiLoadingField: string | null;
  saving: boolean;
  lastSavedAt: number | null;
  saveError: string | null;

  // Modal state — Honest Review
  showHonestReview: boolean;
  honestReview: HonestReview | null;
  honestReviewLoading: boolean;
  honestReviewError: string | null;

  // Modal state — End for Now
  showEndSession: boolean;
  endSessionLoading: boolean;
  endSessionResult: EndSessionResult | null;
  endSessionError: string | null;

  // Modal state — Export
  showExport: boolean;

  // Modal state — Version History
  showVersionHistory: boolean;

  // Actions
  setJd: (jd: JDData) => void;
  updateField: (fieldId: string, value: string) => void;
  setJdId: (id: string | null) => void;
  setTemplateSections: (sections: TemplateSection[]) => void;
  setActiveSectionId: (id: string) => void;
  setFieldScores: (scores: Record<string, FieldScore>) => void;
  setEscoMatch: (match: EscoMatch | null) => void;
  setErsScore: (score: number | null) => void;
  setEvalResult: (result: EvaluationResult | null) => void;
  setEvalLoading: (loading: boolean) => void;
  setShowHighlights: (show: boolean) => void;
  setAiLoadingField: (fieldId: string | null) => void;
  setSaving: (saving: boolean) => void;
  setLastSavedAt: (ts: number) => void;
  setSaveError: (error: string | null) => void;

  setShowHonestReview: (show: boolean) => void;
  setHonestReview: (review: HonestReview | null) => void;
  setHonestReviewLoading: (loading: boolean) => void;
  setHonestReviewError: (error: string | null) => void;

  setShowEndSession: (show: boolean) => void;
  setEndSessionLoading: (loading: boolean) => void;
  setEndSessionResult: (result: EndSessionResult | null) => void;
  setEndSessionError: (error: string | null) => void;

  setShowExport: (show: boolean) => void;
  setShowVersionHistory: (show: boolean) => void;

  reset: () => void;
}

const initialState = {
  jdId: null as string | null,
  jd: {} as JDData,
  templateSections: [] as TemplateSection[],
  activeSectionId: 'A',
  dqsScore: 0,
  ersScore: null as number | null,
  fieldScores: {} as Record<string, FieldScore>,
  escoMatch: null as EscoMatch | null,
  evalResult: null as EvaluationResult | null,
  evalLoading: false,
  showHighlights: true,
  aiLoadingField: null as string | null,
  saving: false,
  lastSavedAt: null as number | null,
  saveError: null as string | null,
  showHonestReview: false,
  honestReview: null as HonestReview | null,
  honestReviewLoading: false,
  honestReviewError: null as string | null,
  showEndSession: false,
  endSessionLoading: false,
  endSessionResult: null as EndSessionResult | null,
  endSessionError: null as string | null,
  showExport: false,
  showVersionHistory: false,
};

export const useJDStore = create<JDStore>((set, get) => ({
  ...initialState,

  setJd: (jd) => {
    const sections = get().templateSections;
    set({ jd, dqsScore: sections.length > 0 ? compScore(jd, sections) : 0 });
  },

  updateField: (fieldId, value) => {
    const jd = { ...get().jd, [fieldId]: value };
    set({ jd, dqsScore: compScore(jd, get().templateSections) });
  },

  setJdId: (id) => set({ jdId: id }),
  setTemplateSections: (sections) => {
    const jd = get().jd;
    set({ templateSections: sections, dqsScore: compScore(jd, sections) });
  },
  setActiveSectionId: (id) => set({ activeSectionId: id }),
  setFieldScores: (scores) => set({ fieldScores: scores }),
  setEscoMatch: (match) => set({ escoMatch: match }),
  setErsScore: (score) => set({ ersScore: score }),
  setEvalResult: (result) => set({ evalResult: result }),
  setEvalLoading: (loading) => set({ evalLoading: loading }),
  setShowHighlights: (show) => set({ showHighlights: show }),
  setAiLoadingField: (fieldId) => set({ aiLoadingField: fieldId }),
  setSaving: (saving) => set({ saving }),
  setLastSavedAt: (ts) => set({ lastSavedAt: ts }),
  setSaveError: (error) => set({ saveError: error }),

  setShowHonestReview: (show) => set({ showHonestReview: show }),
  setHonestReview: (review) => set({ honestReview: review }),
  setHonestReviewLoading: (loading) => set({ honestReviewLoading: loading }),
  setHonestReviewError: (error) => set({ honestReviewError: error }),

  setShowEndSession: (show) => set({ showEndSession: show }),
  setEndSessionLoading: (loading) => set({ endSessionLoading: loading }),
  setEndSessionResult: (result) => set({ endSessionResult: result }),
  setEndSessionError: (error) => set({ endSessionError: error }),

  setShowExport: (show) => set({ showExport: show }),
  setShowVersionHistory: (show) => set({ showVersionHistory: show }),

  reset: () => set(initialState),
}));
