// Unified PMOA data model. Mirrors the DB schema (camelCase fields).

export type ValidityFlag = 'recent' | 'partially_valid' | 'outdated';
export type ParseStatus = 'queued' | 'parsing' | 'done' | 'failed';
export type AssignmentKind = 'permanent' | 'acting' | 'split';
export type StepKind = 'task' | 'decision' | 'handoff' | 'event';
export type RasciLetter = 'R' | 'A' | 'S' | 'C' | 'I';
export type IssueSeverity = 'low' | 'medium' | 'high';
export type IssueKind = 'org_gap' | 'process_gap' | 'duplication' | 'bottleneck' | 'drift';
export type IssueStatus = 'open' | 'accepted' | 'dismissed' | 'in_progress';

export interface PmoaDocumentDTO {
  id: string;
  name: string;
  mime: string | null;
  sizeBytes: number | null;
  fingerprint: string | null;
  pages: number | null;
  validityFlag: ValidityFlag;
  validityNote: string | null;
  documentOwnerId: string | null;
  parseStatus: ParseStatus;
  parseError: string | null;
  ocrConfidence: number | null;
  createdAt: string;
}

export interface PositionDTO {
  id: string;
  name: string;
  positionNumber: string | null;
  reportsToId: string | null;
  departmentId: string | null;
  currentHolderName: string | null;
  vacancy: boolean;
  spanOfControl: number;
  linkedJdId: string | null;
  sourceDocumentIds: string[];
}

export interface DepartmentDTO {
  id: string;
  name: string;
  parentId: string | null;
  headPositionId: string | null;
}

export interface ProcessDTO {
  id: string;
  name: string;
  description: string | null;
  ownerPositionId: string | null;
  validityFlag: ValidityFlag;
  sourceDocumentIds: string[];
  steps: ProcessStepDTO[];
}

export interface ProcessStepDTO {
  id: string;
  stepOrder: number;
  name: string;
  kind: StepKind;
  actorPositionId: string | null;
  actorRoleName: string | null;
  slaDescription: string | null;
  sourceDocumentId: string | null;
  sourcePage: number | null;
}

export interface IssueDTO {
  id: string;
  severity: IssueSeverity;
  kind: IssueKind;
  title: string;
  rationale: string | null;
  suggestedAction: string | null;
  status: IssueStatus;
  affectedNodeIds: Array<{ kind: string; id: string }>;
  createdAt: string;
}

export const SUPPORTED_UPLOAD_MIME = [
  'application/pdf',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'text/plain',
  'text/csv',
  'application/json',
  'image/png',
  'image/jpeg',
  'image/webp',
  'image/gif',
];

export const STALENESS_DEFAULTS = {
  sop_months: 12,
  jd_months: 6,
  regulation_months: 24,
};
