/**
 * Org-structure extraction types.
 *
 * The extractor returns a tree of OrgNode objects with explicit node-type
 * taxonomy preserved from the source document. Confidence is reported per
 * edge (parent-child relationship) since that's the most error-prone part of
 * any visual extraction.
 */

export type OrgNodeType =
  | 'ROOT'              // synthetic root if multiple top-level boards exist
  | 'PRESIDENT'         // Prezes Zarządu / CEO
  | 'VICE_PRESIDENT'    // Wiceprezes Zarządu
  | 'BOARD_MEMBER'      // Członek Zarządu
  | 'PION'              // Polish "pion" — vertical division grouping departments
  | 'DEPARTMENT'        // Departament
  | 'OFFICE'            // Biuro
  | 'BRANCH'            // Oddział
  | 'TEAM'              // generic team
  | 'UNKNOWN';

export type ReportingLine =
  | 'SOLID'             // direct line on the chart
  | 'DOTTED'            // dotted/matrix line
  | 'VISUAL_GROUPING'   // boxed grouping (e.g. a Pion's children inside its frame)
  | 'INFERRED'          // inferred from layout but no explicit connector
  | 'MANUAL';           // set by a human reviewer

export interface OrgNode {
  /** Stable id assigned by the extractor (uuid or slug). */
  id: string;
  /** Parent node id, or null for the root. */
  parentId: string | null;
  /** Department/office abbreviation as printed (e.g. "DKLK", "BHP", "CWIR"). */
  code: string | null;
  /** Display name (e.g. "Departament Zarządzania Kapitałem Ludzkim i Kulturą Organizacji"). */
  name: string;
  /** Strong type from the document taxonomy. */
  type: OrgNodeType;
  /** Depth from root (root = 0). Filled in post-extraction. */
  level: number;
  /** Source page (1-based) where this node was found. */
  sourcePage: number | null;
  /** Reporting line type for the parent-child edge. */
  reportingLine: ReportingLine;
  /**
   * Confidence (0..1) the extractor assigns to this node's parent link.
   * Anything < 0.85 should be flagged for manual review.
   */
  confidence: number;
  /** Free-text rationale: what visual evidence the extractor used. */
  evidence: string | null;
  /**
   * Was this node manually added or its parent manually changed?
   * If so, the extractor must not overwrite it on re-run.
   */
  manuallyEdited: boolean;
}

export interface OrgChart {
  /** Stable id (uuid). */
  id: string;
  /** Display name (often the source filename or document title). */
  name: string;
  /** Source document filename. */
  sourceFile: string;
  /** Effective date if printed on the chart (ISO yyyy-mm-dd). */
  effectiveDate: string | null;
  /** Document reference number / regulation id, free text. */
  documentReference: string | null;
  /** Company / organisation name. */
  companyName: string | null;
  /** Overall extraction confidence (0..1) — average of node confidences. */
  extractionConfidence: number;
  /** All nodes in the tree, parent-first. */
  nodes: OrgNode[];
  /** Open questions the extractor surfaced for the user. */
  clarifications: string[];
  /** ISO timestamp of extraction. */
  extractedAt: string;
}

/** Compact ground-truth shape used by acceptance tests. */
export interface GroundTruthNode {
  code: string | null;
  name: string;
  type: OrgNodeType;
  parentCode: string | null; // matched against extracted code, falls back to name
}
