/**
 * Export a DOM node (typically a ReactFlow canvas, architecture matrix, or
 * any other visual block) to PNG / JPG / PDF, sized to a chosen page format.
 *
 * Approach:
 *   1. Use html-to-image to render the node to a high-DPI dataURL.
 *   2. For PNG/JPG: trigger a download of that dataURL directly.
 *   3. For PDF: embed the image into a jsPDF page sized to the chosen format
 *      and trigger a download. Multi-page paging is handled by scaling-to-fit
 *      (the entire canvas lands on one page); for very large org maps we let
 *      the user pick A2/A3/Tabloid which gives more room.
 *
 * All downloads are filename-suffixed with a timestamp, matching the project
 * convention (artefact isolation).
 */

import * as htmlToImage from 'html-to-image';
import jsPDF from 'jspdf';
import { getPageSize, type PageFormat, type Orientation, DEFAULT_MARGIN_MM } from './page-format';

export type CanvasExportFormat = 'png' | 'jpg' | 'pdf';

export interface CanvasExportOptions {
  /** The DOM node to capture */
  node: HTMLElement;
  /** Output format */
  format: CanvasExportFormat;
  /** Page size (only used for PDF; PNG/JPG use raw canvas DPI) */
  pageFormat?: PageFormat;
  /** Page orientation (only used for PDF) */
  orientation?: Orientation;
  /** File name (no extension); a timestamp is appended automatically */
  fileName?: string;
  /** PNG/JPG output DPI — defaults to 300 for print quality */
  dpi?: 96 | 150 | 300;
  /** Background color (for transparent canvases) */
  backgroundColor?: string;
}

function timestamp(): string {
  const d = new Date();
  return d.toISOString().replace(/[:.]/g, '-').slice(0, 19);
}

function triggerDownload(dataUrl: string, filename: string) {
  const a = document.createElement('a');
  a.href = dataUrl;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
}

async function nodeToDataUrl(node: HTMLElement, format: 'png' | 'jpg', dpi: number, bg: string) {
  // html-to-image's pixelRatio multiplies CSS px → output px.
  // 96 DPI is the CSS baseline. So pixelRatio = dpi / 96.
  const pixelRatio = Math.max(1, dpi / 96);
  const opts = {
    pixelRatio,
    cacheBust: true,
    backgroundColor: bg,
    style: {
      // Let html-to-image know the node fills its current size
    },
  };
  if (format === 'jpg') {
    return htmlToImage.toJpeg(node, { ...opts, quality: 0.92 });
  }
  return htmlToImage.toPng(node, opts);
}

export async function exportCanvas(opts: CanvasExportOptions): Promise<void> {
  const {
    node,
    format,
    pageFormat = 'A4',
    orientation = 'landscape',
    fileName = 'jd-suite-export',
    dpi = 300,
    backgroundColor = '#FAF7F2',
  } = opts;

  if (!node) throw new Error('No node provided to exportCanvas');

  const ts = timestamp();

  if (format === 'png' || format === 'jpg') {
    const dataUrl = await nodeToDataUrl(node, format, dpi, backgroundColor);
    triggerDownload(dataUrl, `${fileName}-${ts}.${format}`);
    return;
  }

  // PDF — capture as PNG first, then embed in a sized page
  const dataUrl = await nodeToDataUrl(node, 'png', dpi, backgroundColor);
  const page = getPageSize(pageFormat, orientation);
  const pdf = new jsPDF({
    unit: 'mm',
    orientation,
    format: pageFormat === 'A4' || pageFormat === 'A3' || pageFormat === 'A2' || pageFormat === 'Letter' || pageFormat === 'Legal'
      ? pageFormat.toLowerCase()
      : [page.widthMm, page.heightMm], // Tabloid: pass numeric size
  });

  // Compute draw area inside margins
  const drawW = page.widthMm - DEFAULT_MARGIN_MM * 2;
  const drawH = page.heightMm - DEFAULT_MARGIN_MM * 2;

  // Determine image native pixel size to preserve aspect
  // We can read the underlying image by creating an Image; jspdf addImage also accepts width/height directly.
  const img = new Image();
  await new Promise<void>((resolve, reject) => {
    img.onload = () => resolve();
    img.onerror = () => reject(new Error('Failed to load captured image'));
    img.src = dataUrl;
  });

  // Scale image to fit within drawW x drawH while preserving aspect
  const imgRatio = img.width / img.height;
  const drawRatio = drawW / drawH;
  let renderW: number;
  let renderH: number;
  if (imgRatio > drawRatio) {
    // image wider than draw area → fit width
    renderW = drawW;
    renderH = drawW / imgRatio;
  } else {
    renderH = drawH;
    renderW = drawH * imgRatio;
  }
  const offsetX = DEFAULT_MARGIN_MM + (drawW - renderW) / 2;
  const offsetY = DEFAULT_MARGIN_MM + (drawH - renderH) / 2;

  pdf.addImage(dataUrl, 'PNG', offsetX, offsetY, renderW, renderH, undefined, 'FAST');

  // Footer: filename + timestamp
  pdf.setFontSize(8);
  pdf.setTextColor(120, 120, 120);
  pdf.text(`${fileName}  ·  ${ts}`, DEFAULT_MARGIN_MM, page.heightMm - 4);

  pdf.save(`${fileName}-${ts}.pdf`);
}
