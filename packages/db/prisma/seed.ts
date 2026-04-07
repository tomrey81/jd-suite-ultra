import { PrismaClient } from '@prisma/client';
import { hash } from 'bcryptjs';

const prisma = new PrismaClient();

const DEFAULT_TEMPLATE_SECTIONS = [
  {
    id: 'A', title: 'Identification', desc: 'Job title and organisational unit. Core administrative data.', required: true,
    fields: [
      { id: 'jobTitle', label: 'Job Title', type: 'text', required: true, hint: 'Official title from org chart.', priority: 'must' },
      { id: 'jobCode', label: 'Job Code', type: 'text', required: false, hint: 'Internal reference code.', priority: 'nice' },
      { id: 'orgUnit', label: 'Organisational Unit', type: 'text', required: true, hint: 'Match the exact hierarchy path.', priority: 'must' },
      { id: 'jobFamily', label: 'Job Function / Family', type: 'text', required: false, hint: '', priority: 'helpful' },
      { id: 'revisionDate', label: 'Revision Date', type: 'date', required: false, hint: '', priority: 'nice' },
      { id: 'approvalDate', label: 'Approval Date', type: 'date', required: false, hint: '', priority: 'nice' },
      { id: 'preparedBy', label: 'Prepared By', type: 'text', required: false, hint: '', priority: 'nice' },
      { id: 'approvedBy', label: 'Approved By', type: 'text', required: false, hint: '', priority: 'nice' },
      { id: 'status', label: 'Status', type: 'select', required: true, opts: ['Draft', 'Under Revision', 'Approved', 'Archived'], hint: '', priority: 'must' },
    ],
  },
  {
    id: 'B', title: 'Job Purpose', desc: 'What the job exists to do, for whom, and why.', required: true,
    fields: [
      { id: 'jobPurpose', label: 'Job Purpose', type: 'textarea', rows: 6, required: true, ai: true, hint: '2-3 sentences: what, for whom, why. No task lists.', priority: 'must' },
      { id: 'positionType', label: 'Position Type', type: 'radio', required: true, opts: ['Individual Contributor', 'People Manager'], hint: '', priority: 'must' },
    ],
  },
  {
    id: 'C', title: 'Knowledge, Qualifications & Experience', desc: 'Minimum requirements only.', required: true,
    fields: [
      { id: 'minEducation', label: 'Minimum Education / Qualifications', type: 'textarea', rows: 4, required: true, hint: 'State EQF level if known.', priority: 'must' },
      { id: 'minExperience', label: 'Minimum Years of Experience', type: 'textarea', rows: 3, required: true, hint: 'Give a range.', priority: 'must' },
      { id: 'keyKnowledge', label: 'Key Knowledge Domains', type: 'textarea', rows: 6, required: true, ai: true, hint: 'Domain knowledge only.', priority: 'must' },
      { id: 'languageReqs', label: 'Language Requirements', type: 'textarea', rows: 3, required: false, hint: 'Use CEFR levels (A1-C2).', priority: 'helpful' },
    ],
  },
  {
    id: 'D', title: 'Key Responsibilities', desc: 'Core accountabilities of the role.', required: true,
    fields: [
      { id: 'responsibilities', label: 'Key Responsibilities', type: 'textarea', rows: 12, required: true, ai: true, hint: 'Active verbs. 6-10 items.', priority: 'must' },
    ],
  },
  {
    id: 'E', title: 'Problem Complexity & Planning', desc: 'How the role thinks and plans.', required: true,
    fields: [
      { id: 'problemComplexity', label: 'Typical Problems Solved', type: 'textarea', rows: 5, required: true, ai: true, hint: 'Routine / defined / novel / strategic.', priority: 'must' },
      { id: 'planningScope', label: 'Planning Horizon & Scope', type: 'textarea', rows: 4, required: true, ai: true, hint: 'Own week, or multi-team projects?', priority: 'must' },
    ],
  },
  {
    id: 'F', title: 'Communication & Stakeholder Engagement', desc: 'Who the role interacts with and why.', required: true,
    fields: [
      { id: 'internalStakeholders', label: 'Internal Stakeholders & Purpose', type: 'textarea', rows: 7, required: true, ai: true, hint: 'List role + count.', priority: 'must' },
      { id: 'externalContacts', label: 'External Contacts & Purpose', type: 'textarea', rows: 4, required: false, hint: '', priority: 'helpful' },
      { id: 'communicationMode', label: 'Highest Communication Mode', type: 'textarea', rows: 4, required: true, ai: true, hint: 'Exchange / persuasion / negotiation / conflict / strategic.', priority: 'must' },
    ],
  },
  {
    id: 'G', title: 'Tools, Systems & Digital Skills', desc: 'Required technology and physical skills.', required: true,
    fields: [
      { id: 'systems', label: 'Required Systems / Software', type: 'textarea', rows: 7, required: true, hint: 'Mark R=Required, P=Preferred.', priority: 'must' },
      { id: 'physicalSkills', label: 'Physical / Manual Skills', type: 'textarea', rows: 2, required: false, hint: 'Only if genuine.', priority: 'nice' },
    ],
  },
  {
    id: 'H', title: 'Responsibility - People, Budget & Impact', desc: 'Accountability scope and financial authority.', required: true,
    fields: [
      { id: 'peopleManagement', label: 'People Management', type: 'textarea', rows: 4, required: true, hint: 'Direct AND indirect.', priority: 'must' },
      { id: 'budgetAuthority', label: 'Budget / Financial Authority', type: 'textarea', rows: 4, required: true, hint: 'What can this role approve?', priority: 'must' },
      { id: 'impactScope', label: 'Impact Scope', type: 'textarea', rows: 3, required: true, hint: 'People count or value.', priority: 'must' },
    ],
  },
  {
    id: 'I', title: 'Working Conditions & Environment', desc: 'Required by EU Pay Transparency Directive 2023/970.', required: true,
    fields: [
      { id: 'workLocation', label: 'Work Location / Arrangement', type: 'textarea', rows: 3, required: true, hint: '', priority: 'must' },
      { id: 'travelReqs', label: 'Travel Requirements', type: 'textarea', rows: 2, required: false, hint: '', priority: 'helpful' },
      { id: 'workingConditions', label: 'Specific Working Conditions', type: 'textarea', rows: 6, required: true, ai: true, hint: 'Deadline pressure, emotional demands, confidentiality.', priority: 'must' },
    ],
  },
  {
    id: 'J', title: 'Grading Context', desc: 'For HR and Axiomera use.', required: false,
    fields: [
      { id: 'benchmarkRefs', label: 'Comparable Roles / Benchmark References', type: 'textarea', rows: 4, required: false, hint: '1-2 similar roles.', priority: 'helpful' },
      { id: 'proposedGrade', label: 'Proposed Grade / Band (HR only)', type: 'textarea', rows: 1, required: false, hint: 'HR completes after evaluation.', priority: 'nice' },
    ],
  },
];

async function main() {
  console.log('Seeding database...');

  // Create default template
  const existingTemplate = await prisma.template.findFirst({
    where: { isDefault: true, orgId: null },
  });

  if (!existingTemplate) {
    await prisma.template.create({
      data: {
        name: 'JD Suite Default',
        purpose: 'general',
        description: 'Standard 10-section JD template aligned to EU Pay Transparency Directive 2023/970.',
        sections: DEFAULT_TEMPLATE_SECTIONS,
        isDefault: true,
        orgId: null,
      },
    });
    console.log('Created default template');
  }

  // Create demo user + org (only in development)
  if (process.env.NODE_ENV !== 'production') {
    const existingUser = await prisma.user.findUnique({
      where: { email: 'demo@quadrance.app' },
    });

    if (!existingUser) {
      const passwordHash = await hash('DemoPassword123!', 12);
      const user = await prisma.user.create({
        data: {
          email: 'demo@quadrance.app',
          name: 'Demo User',
          passwordHash,
        },
      });

      const org = await prisma.organisation.create({
        data: { name: 'Quadrance Demo' },
      });

      await prisma.membership.create({
        data: {
          userId: user.id,
          orgId: org.id,
          role: 'ADMIN',
        },
      });

      console.log('Created demo user: demo@quadrance.app / DemoPassword123!');
    }
  }

  console.log('Seed complete');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
