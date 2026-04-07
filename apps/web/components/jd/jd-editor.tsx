'use client';

import { useEffect } from 'react';
import { useJDStore } from '@/hooks/use-jd-store';
import { useAutoSave } from '@/hooks/use-autosave';
import { JDSidebar } from './jd-sidebar';
import { JDForm } from './jd-form';
import { QualityPanel } from './quality-panel';
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
    setJd(initialData);
    setTemplateSections(templateSections);
    setActiveSectionId(templateSections[0]?.id || 'A');
    if (initialFieldScores) {
      setFieldScores(initialFieldScores);
    }
  }, [jdId, initialData, templateSections, initialFieldScores, setJdId, setJd, setTemplateSections, setActiveSectionId, setFieldScores]);

  useAutoSave();

  return (
    <div className="flex flex-1 overflow-hidden">
      <JDSidebar />
      <div className="flex-1 overflow-y-auto bg-surface-page p-[28px_36px]">
        <JDForm />
      </div>
      <QualityPanel />
    </div>
  );
}
