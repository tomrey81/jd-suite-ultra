/**
 * Page formats for exporting JD Suite content (org maps, architecture matrix,
 * process maps, JD detail). Sizes are ISO 216 (A series) and US Letter at 1:1.
 *
 * — `mm` is the physical size (used by jspdf which works in mm by default).
 * — `pxAt96Dpi` is the screen pixel size, useful as a hint for html-to-image
 *   when we want canvas content to fit a page (1 inch = 96 px on screen).
 * — `pxAt300Dpi` is the print pixel size at 300 DPI for high-quality PNG output.
 *
 * 1 inch = 25.4 mm. 96 dpi = 96 px per inch ≈ 3.7795 px/mm.
 */

export type PageFormat = 'A4' | 'A3' | 'A2' | 'Letter' | 'Legal' | 'Tabloid';
export type Orientation = 'portrait' | 'landscape';

export interface PageDimensions {
  /** Width in millimetres (always portrait) */
  widthMm: number;
  /** Height in millimetres (always portrait) */
  heightMm: number;
  /** Width in pixels at 96 DPI (always portrait) */
  pxAt96Dpi: { w: number; h: number };
  /** Width in pixels at 300 DPI (always portrait) */
  pxAt300Dpi: { w: number; h: number };
  /** Human-readable label */
  label: string;
}

const MM_PER_INCH = 25.4;

const mmToPx = (mm: number, dpi: number) => Math.round((mm / MM_PER_INCH) * dpi);

function build(label: string, widthMm: number, heightMm: number): PageDimensions {
  return {
    widthMm,
    heightMm,
    label,
    pxAt96Dpi: { w: mmToPx(widthMm, 96), h: mmToPx(heightMm, 96) },
    pxAt300Dpi: { w: mmToPx(widthMm, 300), h: mmToPx(heightMm, 300) },
  };
}

export const PAGE_FORMATS: Record<PageFormat, PageDimensions> = {
  A4:      build('A4',      210, 297),
  A3:      build('A3',      297, 420),
  A2:      build('A2',      420, 594),
  Letter:  build('Letter',  215.9, 279.4),
  Legal:   build('Legal',   215.9, 355.6),
  Tabloid: build('Tabloid', 279.4, 431.8),
};

/** Resolve dimensions for a given format + orientation, swapping w/h as needed. */
export function getPageSize(format: PageFormat, orientation: Orientation): PageDimensions {
  const base = PAGE_FORMATS[format];
  if (orientation === 'portrait') return base;
  return {
    label: `${base.label} (landscape)`,
    widthMm: base.heightMm,
    heightMm: base.widthMm,
    pxAt96Dpi: { w: base.pxAt96Dpi.h, h: base.pxAt96Dpi.w },
    pxAt300Dpi: { w: base.pxAt300Dpi.h, h: base.pxAt300Dpi.w },
  };
}

/** Default safe margin in mm — 10 mm all around. */
export const DEFAULT_MARGIN_MM = 10;

export const ALL_FORMATS: PageFormat[] = ['A4', 'A3', 'A2', 'Letter', 'Legal', 'Tabloid'];
