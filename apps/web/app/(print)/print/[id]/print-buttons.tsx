'use client';

import { useState } from 'react';

export function PrintButtons({ format, fileName }: { format: string; fileName: string }) {
  const [capturing, setCapturing] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const handlePng = async () => {
    const root = document.getElementById('jd-doc');
    if (!root) return;
    setCapturing(true);
    setErr(null);
    try {
      const { toPng, toJpeg } = await import('html-to-image').catch(() => {
        throw new Error('Image library not loaded — try refreshing');
      });
      const fn = format === 'jpg' ? toJpeg : toPng;
      const dataUrl = await fn(root, {
        backgroundColor: '#F6F4EF',
        quality: format === 'jpg' ? 0.92 : 1,
        pixelRatio: 2,
        // Capture full scrollable content
        width: root.scrollWidth,
        height: root.scrollHeight,
        style: { transform: 'none' },
      });
      const a = document.createElement('a');
      a.href = dataUrl;
      a.download = `${fileName}.${format}`;
      a.click();
    } catch (e: any) {
      setErr(e.message);
    } finally {
      setCapturing(false);
    }
  };

  return (
    <>
      {err && (
        <div style={{
          position: 'fixed', bottom: 90, right: 28, background: '#FEF0EF',
          border: '1px solid #F5B4B0', borderRadius: 8, padding: '8px 14px',
          fontSize: 11, color: '#9E2B1D', maxWidth: 260, zIndex: 9999,
        }}>
          {err}
        </div>
      )}
      <button
        style={{
          position: 'fixed', bottom: 28, right: 180,
          display: 'flex', alignItems: 'center', gap: 8,
          background: '#8A7560', color: '#fff',
          border: 'none', borderRadius: 10, padding: '12px 22px',
          fontSize: 13, fontWeight: 600, cursor: capturing ? 'wait' : 'pointer',
          fontFamily: 'inherit', boxShadow: '0 4px 20px rgba(0,0,0,.25)',
          opacity: capturing ? 0.6 : 1,
          zIndex: 9999,
        }}
        className="no-print"
        onClick={handlePng}
        disabled={capturing}
      >
        {capturing ? '⏳ Capturing…' : `↓ Save as ${format.toUpperCase()}`}
      </button>
      <button
        style={{
          position: 'fixed', bottom: 28, right: 28,
          display: 'flex', alignItems: 'center', gap: 8,
          background: '#1A1A1A', color: '#F6F4EF',
          border: 'none', borderRadius: 10, padding: '12px 22px',
          fontSize: 13, fontWeight: 600, cursor: 'pointer',
          fontFamily: 'inherit', boxShadow: '0 4px 20px rgba(0,0,0,.35)',
          zIndex: 9999,
        }}
        className="no-print"
        onClick={() => window.print()}
      >
        ↓ Save as PDF
      </button>
    </>
  );
}
