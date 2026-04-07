import { create } from 'zustand';
import type { TemplateSection, EvaluationResult, FieldScore, EscoMatch } from '@jd-suite/types';
import type { JDData } from '@/lib/jd-helpers';
import { compScore } from '@/lib/jd-helpers';

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
};

export const useJDStore = create<JDStore>((set, get) => ({
  ...initialState,

  setJd: (jd) => set({ jd, dqsScore: compScore(jd, get().templateSections) }),

  updateField: (fieldId, value) => {
    const jd = { ...get().jd, [fieldId]: value };
    set({ jd, dqsScore: compScore(jd, get().templateSections) });
  },

  setJdId: (id) => set({ jdId: id }),
  setTemplateSections: (sections) => set({ templateSections: sections }),
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

  reset: () => set(initialState),
}));
