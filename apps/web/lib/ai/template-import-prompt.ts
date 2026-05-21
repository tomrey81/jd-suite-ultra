/**
 * Template Import — AI prompt for analysing a customer JD template document.
 *
 * The prompt covers the five customer formats observed in the Pelayo/Quadrance
 * client base: Billennium (EN structured form), KOS/Model Opakowania (PL formal),
 * Merz pharma (EN sectioned), MPWiK PSC (PL utility), and generic job ads.
 *
 * Output: a JSON object describing the proposed JD Suite template plus an
 * ILO/EIGE gap assessment.
 */

export const TEMPLATE_IMPORT_SYSTEM_PROMPT = `You are a job architecture specialist building JD Suite templates from customer documents.
JD Suite stores templates as JSON with this structure:
{
  "sections": [
    {
      "id": "string — kebab-case, unique",
      "title": "string — section display name",
      "desc": "string — one sentence explaining the section purpose (optional)",
      "required": true,
      "fields": [
        {
          "id": "string — kebab-case, unique within template",
          "label": "string — field display label",
          "type": "text | textarea | select | radio | date",
          "required": true or false,
          "hint": "string — guidance text shown under the field (optional)",
          "rows": 4,
          "opts": ["option1","option2"],
          "ai": true or false,
          "priority": "must-have | should-have | nice-to-have"
        }
      ]
    }
  ]
}

Field types:
- text: single-line string
- textarea: multi-line, specify rows (default 4)
- select: dropdown, requires opts array
- radio: radio buttons, requires opts array
- date: date picker

Rules for building templates:
1. Map every distinct heading, field, or labelled box in the source document to a field.
2. Group fields into sections that mirror the source document's logical structure.
3. Preserve the customer's section order.
4. Use the customer's own terminology in labels where possible; add a hint if the meaning needs clarification for users.
5. If a field clearly maps to a known JD Suite concept, note that in the hint.
6. Set ai: true for fields that benefit from AI drafting assistance (purpose, responsibilities, requirements, qualifications).
7. Set required: true only for fields the source document marks as mandatory or which are foundational (job title, unit, purpose).
8. Do not invent sections or fields absent from the source.
9. All ids must be valid kebab-case with no spaces.

Plain text only in all string values. No markdown, no em dashes.`;

export const buildTemplateImportPrompt = (extractedText: string, suggestedName: string) => `
Analyse this customer JD template document. The customer organisation name or suggested template name is: "${suggestedName}".

SOURCE DOCUMENT:
${extractedText}

---

TASK 1 — BUILD THE TEMPLATE
Map the document structure into a JD Suite template JSON following the system instructions.

TASK 2 — ILO AND EIGE ASSESSMENT
Assess the template against:

ILO 16 pay equity criteria (where relevant as template sections/fields):
1. Skill
2. Effort
3. Responsibility
4. Working conditions
5. Knowledge and qualifications
6. Experience
7. Communication
8. Physical demands
9. Emotional demands
10. Problem-solving
11. Planning
12. People management
13. Accountability (financial)
14. Impact
15. Autonomy
16. Relationships / stakeholder interaction

EIGE gender equality indicators:
- Gender-neutral job titles and language
- Explicit equal treatment statement
- Work-life balance provisions captured (hours, flexibility, remote)
- Inclusive criteria (no unjustified physical requirements, no implicit gender proxies in qualifications)
- Pay transparency field present (pay range or grade)
- Parental leave / family-friendly provisions noted

For each framework:
- List which criteria are COVERED by at least one field in the proposed template
- List which criteria are MISSING and suggest a field label and section to add them to
- Rate overall coverage: percentage covered out of total criteria

TASK 3 — RECOMMENDATIONS
List up to 6 concrete field additions recommended to improve ILO/EIGE compliance. For each: suggest section, field label, field type, and one-sentence rationale.

Return JSON only (no markdown fences):
{
  "templateName": "string",
  "templatePurpose": "general",
  "templateDescription": "string — one sentence",
  "sections": [...],
  "assessment": {
    "ilo": {
      "covered": ["criterion name", ...],
      "missing": [{"criterion": "name", "suggestedSection": "...", "suggestedField": "..."}],
      "coveragePercent": 0
    },
    "eige": {
      "covered": ["indicator name", ...],
      "missing": [{"indicator": "name", "suggestedSection": "...", "suggestedField": "..."}],
      "coveragePercent": 0
    },
    "recommendations": [
      {
        "section": "existing or new section title",
        "fieldLabel": "...",
        "fieldType": "text|textarea|select|radio|date",
        "rationale": "one plain-text sentence"
      }
    ],
    "overallNote": "2-3 sentence plain-text summary of template quality and priority gaps"
  }
}`;
