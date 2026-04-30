'use client';

/**
 * QR code component — renders a QR for a URL with copy / download / share actions.
 *
 * Uses the `qrcode` package which generates a PNG dataURL and an SVG string.
 * No network calls, no external services — fully client-side.
 */

import { useEffect, useState } from 'react';
import QRCode from 'qrcode';
import { buildShareLinks } from '@/lib/qr/links';
import { cn } from '@/lib/utils';

interface Props {
  /** The URL to encode */
  url: string;
  /** Title shown above the QR + used in share text */
  title?: string;
  /** QR pixel size (default 192) */
  size?: number;
  /** Filename used when downloading the PNG (without extension) */
  fileName?: string;
  /** Hide the share menu — show only the QR + URL */
  minimal?: boolean;
  className?: string;
}

export function QRCodeBlock({ url, title, size = 192, fileName = 'qr', minimal, className }: Props) {
  const [pngDataUrl, setPngDataUrl] = useState<string>('');
  const [svgMarkup, setSvgMarkup] = useState<string>('');
  const [copied, setCopied] = useState<'url' | 'png' | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    if (!url) return;
    Promise.all([
      QRCode.toDataURL(url, { width: size, margin: 1, errorCorrectionLevel: 'M' }),
      QRCode.toString(url, { type: 'svg', margin: 1, errorCorrectionLevel: 'M' }),
    ])
      .then(([png, svg]) => {
        if (cancelled) return;
        setPngDataUrl(png);
        setSvgMarkup(svg);
        setError(null);
      })
      .catch((e: unknown) => {
        if (!cancelled) setError(e instanceof Error ? e.message : 'QR generation failed');
      });
    return () => {
      cancelled = true;
    };
  }, [url, size]);

  const copyUrl = async () => {
    try {
      await navigator.clipboard.writeText(url);
      setCopied('url');
      setTimeout(() => setCopied(null), 1500);
    } catch {
      setError('Could not copy to clipboard.');
    }
  };

  const downloadPng = () => {
    if (!pngDataUrl) return;
    const a = document.createElement('a');
    a.href = pngDataUrl;
    a.download = `${fileName}.png`;
    document.body.appendChild(a);
    a.click();
    a.remove();
  };

  const downloadSvg = () => {
    if (!svgMarkup) return;
    const blob = new Blob([svgMarkup], { type: 'image/svg+xml' });
    const blobUrl = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = blobUrl;
    a.download = `${fileName}.svg`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(blobUrl);
  };

  const links = buildShareLinks(url, title || 'Open in JD Suite');

  return (
    <div className={cn('inline-flex flex-col items-stretch gap-2 rounded-lg border border-border-default bg-white p-3', className)}>
      {title && <div className="text-[11px] font-medium text-text-primary">{title}</div>}
      <div className="flex items-start gap-3">
        <div
          className="shrink-0 rounded-md border border-border-default bg-white p-1"
          style={{ width: size + 8, height: size + 8 }}
        >
          {pngDataUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={pngDataUrl} alt={`QR code for ${url}`} width={size} height={size} />
          ) : (
            <div className="flex h-full w-full items-center justify-center text-[9px] text-text-muted">
              {error || 'Generating…'}
            </div>
          )}
        </div>
        <div className="flex min-w-0 flex-1 flex-col gap-1.5">
          <div className="break-all rounded-md border border-border-default bg-surface-page px-2 py-1 text-[10px] text-text-secondary" title={url}>
            {url}
          </div>
          <button
            onClick={copyUrl}
            className="rounded-md border border-border-default bg-white px-2.5 py-1 text-[10px] font-medium text-text-secondary transition-colors hover:border-brand-gold hover:text-brand-gold"
          >
            {copied === 'url' ? 'Copied!' : 'Copy link'}
          </button>
          <button
            onClick={downloadPng}
            disabled={!pngDataUrl}
            className="rounded-md border border-border-default bg-white px-2.5 py-1 text-[10px] font-medium text-text-secondary transition-colors hover:border-brand-gold hover:text-brand-gold disabled:opacity-40"
          >
            Download PNG
          </button>
          <button
            onClick={downloadSvg}
            disabled={!svgMarkup}
            className="rounded-md border border-border-default bg-white px-2.5 py-1 text-[10px] font-medium text-text-secondary transition-colors hover:border-brand-gold hover:text-brand-gold disabled:opacity-40"
          >
            Download SVG
          </button>
          {!minimal && (
            <div className="mt-1 flex flex-wrap gap-1">
              <a
                href={links.email}
                className="rounded-full border border-border-default bg-white px-2 py-0.5 text-[9px] font-medium text-text-secondary hover:border-brand-gold hover:text-brand-gold"
                title="Email link"
              >
                Email
              </a>
              <a
                href={links.teams}
                target="_blank"
                rel="noopener noreferrer"
                className="rounded-full border border-border-default bg-white px-2 py-0.5 text-[9px] font-medium text-text-secondary hover:border-brand-gold hover:text-brand-gold"
                title="Share to Teams"
              >
                Teams
              </a>
              <a
                href={links.slack}
                target="_blank"
                rel="noopener noreferrer"
                className="rounded-full border border-border-default bg-white px-2 py-0.5 text-[9px] font-medium text-text-secondary hover:border-brand-gold hover:text-brand-gold"
                title="Share to Slack"
              >
                Slack
              </a>
              <a
                href={links.whatsapp}
                target="_blank"
                rel="noopener noreferrer"
                className="rounded-full border border-border-default bg-white px-2 py-0.5 text-[9px] font-medium text-text-secondary hover:border-brand-gold hover:text-brand-gold"
                title="Share to WhatsApp"
              >
                WhatsApp
              </a>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
