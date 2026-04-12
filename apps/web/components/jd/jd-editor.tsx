'use client';

import { useEffect } from 'react';
import { useJDStore } from '@/hooks/use-jd-store';
import { useAutoSave } from '@/hooks/use-autosave';
import { JDSidebar } from './jd-sidebar';
import { JDForm } from './jd-form';
import { QualityPanel } from './quality-panel';
import { HonestReviewModal } from '@/components/modals/honest-review-modal';
import { EndSessionModal } from '@/components/modals/end-session-modal';
import { ExportModal } from '@/components/modals/export-modal';
import { VersionHistoryPanel } from '@/components/jd/version-history-panel';
import type { TemplateSection } from '@jd-suite/types';
import type { JDData } from '@/lib/jd-helpers';

interface JDEditorProps {
  jdId: string;
  initialData: JDData;
  templateSections: TemplateSection[];
  initialFieldScores?: Record<string, any>;
}

export function JDEditor({ jdId, initialData, templateSections, initialFieldScores }: JDEditorProps) {
  const { setJdId, setJd, setTemplateSections, setFieldScores, setActiveSectionId } = useJDStore();

  useEffect(() => {
    setJdId(jdId);
    setTemplateSections(templateSections); // Set sections FIRST so score calculates correctly
    setJd(initialData);                    // Then set JD data (triggers score recalc)
    setActiveSectionId(templateSections[0]?.id || 'A');
    if (initialFieldScores) {
      setFieldScores(initialFieldScores);
    }
  }, [jdId, initialData, templateSections, initialFieldScores, setJdId, setJd, setTemplateSections, setActiveSectionId, setFieldScores]);

  useAutoSave();

  return (
    <>
      {/* Main editor layout */}
      <div className="flex flex-1 overflow-hidden">
        <JDSidebar />
        <div className="flex-1 overflow-y-auto bg-surface-page p-[28px_36px]">
          {/* data-export-target allows ExportModal PNG/JPG to capture this region */}
          <div data-export-target="jd-form">
            <JDForm />
          </div>
        </div>
        <QualityPanel />
      </div>

      {/* Modal layer — always mounted, conditionally visible via store state */}
      <HonestReviewModal />
      <EndSessionModal />
      <ExportModal />
      <VersionHistoryPanel jdId={jdId} />
    </>
  );
}
