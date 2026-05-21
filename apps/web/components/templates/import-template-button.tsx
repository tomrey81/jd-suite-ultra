'use client';

import { useState } from 'react';
import { ImportTemplateModal } from './import-template-modal';

export function ImportTemplateButton() {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="rounded-full border border-brand-gold px-4 py-2 text-xs font-medium tracking-wide text-brand-gold transition-colors hover:bg-brand-gold hover:text-white"
      >
        Import from File
      </button>
      {open && <ImportTemplateModal onClose={() => setOpen(false)} />}
    </>
  );
}
