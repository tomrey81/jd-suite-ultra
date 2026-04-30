// PMOA module schema. Direct SQL for safety (pnpm db push refuses to drop legacy `photos` table).
// Idempotent — safe to re-run.
import pg from 'pg';
const { Client } = pg;

const client = new Client({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });
await client.connect();

const stmts = [
  // Documents — parsed source materials with validity tagging
  `CREATE TABLE IF NOT EXISTS pmoa_documents (
    id TEXT PRIMARY KEY,
    "orgId" TEXT NOT NULL,
    "uploaderId" TEXT,
    name TEXT NOT NULL,
    mime TEXT,
    "sizeBytes" INTEGER,
    fingerprint TEXT,                                  -- SHA-256 of bytes
    "rawText" TEXT,
    pages INTEGER,
    "validityFlag" TEXT NOT NULL DEFAULT 'recent',     -- recent | partially_valid | outdated
    "validityNote" TEXT,
    "documentOwnerId" TEXT,
    "parseStatus" TEXT NOT NULL DEFAULT 'parsing',     -- queued | parsing | done | failed
    "parseError" TEXT,
    "ocrConfidence" DOUBLE PRECISION,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT NOW(),
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT NOW(),
    CONSTRAINT pmoa_documents_orgId_fkey FOREIGN KEY ("orgId") REFERENCES organisations(id) ON DELETE CASCADE,
    CONSTRAINT pmoa_documents_uploaderId_fkey FOREIGN KEY ("uploaderId") REFERENCES users(id) ON DELETE SET NULL
  )`,
  `CREATE INDEX IF NOT EXISTS pmoa_documents_orgId_idx ON pmoa_documents("orgId")`,
  `CREATE INDEX IF NOT EXISTS pmoa_documents_validity_idx ON pmoa_documents("validityFlag")`,

  // Departments
  `CREATE TABLE IF NOT EXISTS pmoa_departments (
    id TEXT PRIMARY KEY,
    "orgId" TEXT NOT NULL,
    name TEXT NOT NULL,
    "parentId" TEXT,
    "headPositionId" TEXT,
    "sourceDocumentIds" TEXT[] NOT NULL DEFAULT '{}',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT NOW(),
    CONSTRAINT pmoa_departments_orgId_fkey FOREIGN KEY ("orgId") REFERENCES organisations(id) ON DELETE CASCADE
  )`,
  `CREATE INDEX IF NOT EXISTS pmoa_departments_orgId_idx ON pmoa_departments("orgId")`,

  // Positions (org boxes)
  `CREATE TABLE IF NOT EXISTS pmoa_positions (
    id TEXT PRIMARY KEY,
    "orgId" TEXT NOT NULL,
    "departmentId" TEXT,
    name TEXT NOT NULL,
    "positionNumber" TEXT,
    "reportsToId" TEXT,                                -- self-FK, drives the org map edges
    "currentHolderName" TEXT,
    vacancy BOOLEAN NOT NULL DEFAULT false,
    "spanOfControl" INTEGER NOT NULL DEFAULT 0,
    "linkedJdId" TEXT,                                 -- → job_descriptions.id
    "sourceDocumentIds" TEXT[] NOT NULL DEFAULT '{}',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT NOW(),
    CONSTRAINT pmoa_positions_orgId_fkey FOREIGN KEY ("orgId") REFERENCES organisations(id) ON DELETE CASCADE
  )`,
  `CREATE INDEX IF NOT EXISTS pmoa_positions_orgId_idx ON pmoa_positions("orgId")`,
  `CREATE INDEX IF NOT EXISTS pmoa_positions_reportsTo_idx ON pmoa_positions("reportsToId")`,
  `CREATE INDEX IF NOT EXISTS pmoa_positions_dept_idx ON pmoa_positions("departmentId")`,

  // Assignments (permanent / acting / split)
  `CREATE TABLE IF NOT EXISTS pmoa_assignments (
    id TEXT PRIMARY KEY,
    "orgId" TEXT NOT NULL,
    "positionId" TEXT NOT NULL,
    "personName" TEXT NOT NULL,
    kind TEXT NOT NULL DEFAULT 'permanent',             -- permanent | acting | split
    "splitAllocations" JSONB,                            -- [{ positionId, pct }] for split kind
    "validFrom" DATE,
    "validUntil" DATE,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT NOW(),
    CONSTRAINT pmoa_assignments_orgId_fkey FOREIGN KEY ("orgId") REFERENCES organisations(id) ON DELETE CASCADE
  )`,
  `CREATE INDEX IF NOT EXISTS pmoa_assignments_position_idx ON pmoa_assignments("positionId")`,

  // PMOA processes (separate from legacy `processes` table — keeps backward compat)
  `CREATE TABLE IF NOT EXISTS pmoa_processes (
    id TEXT PRIMARY KEY,
    "orgId" TEXT NOT NULL,
    name TEXT NOT NULL,
    description TEXT,
    "ownerPositionId" TEXT,
    "validityFlag" TEXT NOT NULL DEFAULT 'recent',     -- inherits worst-case from sources
    "sourceDocumentIds" TEXT[] NOT NULL DEFAULT '{}',
    bpmn JSONB,                                          -- BPMN tree if available
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT NOW(),
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT NOW(),
    CONSTRAINT pmoa_processes_orgId_fkey FOREIGN KEY ("orgId") REFERENCES organisations(id) ON DELETE CASCADE
  )`,
  `CREATE INDEX IF NOT EXISTS pmoa_processes_orgId_idx ON pmoa_processes("orgId")`,

  // Process steps
  `CREATE TABLE IF NOT EXISTS pmoa_process_steps (
    id TEXT PRIMARY KEY,
    "processId" TEXT NOT NULL,
    "stepOrder" INTEGER NOT NULL DEFAULT 0,
    name TEXT NOT NULL,
    kind TEXT NOT NULL DEFAULT 'task',                  -- task | decision | handoff | event
    "actorPositionId" TEXT,
    "actorRoleName" TEXT,                                -- free text when no formal position
    "slaDescription" TEXT,
    "sourceDocumentId" TEXT,
    "sourcePage" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT NOW(),
    CONSTRAINT pmoa_steps_process_fkey FOREIGN KEY ("processId") REFERENCES pmoa_processes(id) ON DELETE CASCADE
  )`,
  `CREATE INDEX IF NOT EXISTS pmoa_steps_process_idx ON pmoa_process_steps("processId")`,

  // RASCI cells (process step × actor) — sparse table, denormalised role label for free-text positions
  `CREATE TABLE IF NOT EXISTS pmoa_rasci_cells (
    id TEXT PRIMARY KEY,
    "stepId" TEXT NOT NULL,
    "positionId" TEXT,                                  -- null = free-text role
    "roleName" TEXT,                                    -- denormalised
    letter TEXT NOT NULL,                               -- R | A | S | C | I
    "manualOverride" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT NOW(),
    CONSTRAINT pmoa_rasci_step_fkey FOREIGN KEY ("stepId") REFERENCES pmoa_process_steps(id) ON DELETE CASCADE
  )`,
  `CREATE INDEX IF NOT EXISTS pmoa_rasci_step_idx ON pmoa_rasci_cells("stepId")`,

  // Issues (gap / duplication / bottleneck flags)
  `CREATE TABLE IF NOT EXISTS pmoa_issues (
    id TEXT PRIMARY KEY,
    "orgId" TEXT NOT NULL,
    severity TEXT NOT NULL,                             -- low | medium | high
    kind TEXT NOT NULL,                                 -- org_gap | process_gap | duplication | bottleneck | drift
    title TEXT NOT NULL,
    rationale TEXT,
    "suggestedAction" TEXT,
    "affectedNodeIds" JSONB,                             -- [{ kind, id }]
    status TEXT NOT NULL DEFAULT 'open',                -- open | accepted | dismissed | in_progress
    "statusReason" TEXT,
    "assigneeId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT NOW(),
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT NOW(),
    CONSTRAINT pmoa_issues_orgId_fkey FOREIGN KEY ("orgId") REFERENCES organisations(id) ON DELETE CASCADE
  )`,
  `CREATE INDEX IF NOT EXISTS pmoa_issues_orgId_idx ON pmoa_issues("orgId")`,
  `CREATE INDEX IF NOT EXISTS pmoa_issues_status_idx ON pmoa_issues(status)`,
];

for (const sql of stmts) {
  await client.query(sql);
  console.log('  ✓', sql.replace(/\s+/g, ' ').slice(0, 75) + '…');
}

await client.end();
console.log('PMOA schema applied.');
