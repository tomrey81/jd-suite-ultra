/**
 * JD Import Extraction Rules
 *
 * Derived from: kierowca_wroclaw.docx → JD Suite template mapping (MPK Wrocław, 2025).
 * Purpose: guide Claude when extracting structured JD fields from raw job-ad text.
 *
 * These rules govern what to keep, what to discard, and where each piece of
 * information belongs across Sections A–J of the JD Suite template.
 */

export const JD_IMPORT_RULES = `
## JD IMPORT EXTRACTION RULES

### 1. NOISE — ALWAYS DISCARD
Strip the following before extracting. Do not place this content in any field.

- GDPR / data-protection notices (keywords: RODO, rozporządzenie UE, dane osobowe, art. 13, inspektor ochrony danych, IOD, klauzula informacyjna, retention period, danych osobowych).
- Recruitment process instructions (prosimy o przesłanie, aplikuj przez, złóż CV, termin nadsyłania, etapy rekrutacji, zastrzegamy sobie prawo, skontaktujemy się z wybranymi).
- Application deadlines and contact details for recruiters.
- Employer-branding filler ("dołącz do naszego zespołu", "dynamiczne środowisko", "lider branży", "możliwości rozwoju" — unless specific and verifiable).
- "Oferujemy" items that are contract or benefits terms, NOT JD content: private healthcare, sports card, subsidy for meals, holiday fund (ZFŚS), co-financing of anything. EXCEPTION: pay structure with specific numbers → Section I.

### 2. SECTION ROUTING — WHERE EACH PIECE GOES

**Section A – Identification**
- jobTitle: document heading verbatim. Preserve gender-neutral form (X/Y or X/Xka). Do not add words.
- orgUnit: company name + department from header or intro paragraph. Format: "Department / Company". Never invent.
- jobFamily: infer from industry/function if not stated (e.g. Transport / Operacje).
- status: always "Draft" on import from external source.
- jobCode, revisionDate, approvalDate, preparedBy, approvedBy: leave blank on import.

**Section B – Job Purpose**
- Synthesise from: factual company intro paragraph + role description. Strip marketing language; keep only verifiable facts.
- Format: 2–3 complete sentences. No bullet lists. Active voice. Answer: what does the role do / for whom / why it matters.
- positionType: "Individual Contributor" if no team-management responsibility is mentioned. "People Manager" only if direct reports or hiring authority appear in source.

**Section C – Knowledge, Qualifications & Experience**
- minEducation: formal credentials only from "Wymagania": licences (prawo jazdy kat. D), professional certificates (świadectwo kwalifikacji), legal compliance declarations (art. 5c). Mark each as (wymagane) or (preferowane). Do NOT put knowledge domains or tools here.
- minExperience: years / type of experience from "Wymagania". If not stated, write "Nie określono minimalnego stażu w ogłoszeniu." — never leave blank.
- keyKnowledge: knowledge-domain items only (topografia, przepisy, znajomość tras, obsługa systemów). Do NOT put licences, tools, or physical skills here.
- languageReqs: language items from "Wymagania" with CEFR levels. If workplace is implicitly Polish-only, add: "Język roboczy: polski."

**Section D – Key Responsibilities**
- Source: "Zakres zadań" section ONLY. Every bullet in source → one active-verb sentence. Polish: verb first (Przewozi / Prowadzi / Obsługuje).
- Do not add responsibilities absent from source.
- Do not merge separate items.
- Do not reorder unless logical flow requires it.
- 6–10 items preferred; do not pad.

**Section E – Problem Complexity & Planning**
- Rarely present in job ads. Infer conservatively from role type.
- Operational / front-line role → "Problemy rutynowe i zdefiniowane. Rozwiązania opierają się na ustalonych procedurach i regulaminach wewnętrznych. Sytuacje niestandardowe eskalowane do przełożonego lub dyspozytora."
- Append: "[inferred — verify with line manager]"
- Planning: "Horyzont dzienny/zmianowy. Rola planuje własne wykonanie zadań; nie planuje pracy innych osób."
- Append: "[inferred — verify with line manager]"

**Section F – Communication & Stakeholders**
- internalStakeholders: extract roles named operationally in source. Format: "Rola (liczba) – cel interakcji." Infer missing but obvious roles (e.g. dyspozytor for transport roles) and mark [inferred].
- externalContacts: extract from source; for customer-facing roles add "Pasażerowie / klienci – obsługa, udzielanie informacji" if not stated, marked [inferred].
- communicationMode: infer from highest-intensity interaction described (exchange / persuasion / negotiation / conflict de-escalation / strategic).

**Section G – Tools, Systems & Physical Skills**
- systems: extract tools/systems/equipment named in "Wymagania" or implied by role. Mark R (required day 1) or P (preferred).
- physicalSkills: extract explicitly stated physical requirements (sprawność psychoruchowa, sprawność wzroku i słuchu). Do not invent. Leave blank if not mentioned.

**Section H – People, Budget & Impact**
- peopleManagement: if no management mentioned → "Brak bezpośrednich podwładnych. Rola indywidualna bez uprawnień kierowniczych." Never leave blank.
- budgetAuthority: if not mentioned → "Brak uprawnień budżetowych." Never leave blank.
- impactScope: infer from operational scale. Front-line / high-volume roles: state the population affected (hundreds of passengers per day, X transactions per month, etc.).

**Section I – Working Conditions**
- workLocation: extract from "Miejsce pracy" field verbatim.
- travelReqs: if not mentioned → "Nie dotyczy / brak delegacji."
- workingConditions: extract shift patterns, working hours, physical environment, stress factors. Compensation with specific numbers from "Oferujemy" goes here — this is the ONLY permitted location for salary data. Format: "Wynagrodzenie: X zł brutto (składniki: ...)."

**Section J – Grading Context**
- benchmarkRefs: leave blank on import; add only if comparable roles are explicitly named in source.
- proposedGrade: always blank on import. Never assign a grade from a job ad.

### 3. GENERAL RULES

1. Extract what is there. Do not invent. Do not embellish.
2. Mark all inferred content with [inferred — verify with line manager].
3. Mark all AI-proposed wording with [AI-proposed — verify].
4. Compensation details belong in Section I only. Never duplicate to other sections.
5. Physical requirements belong in Section G only (not Section C).
6. Tools and systems named in "Wymagania" belong in Section G, not Section C.
7. GDPR notices are not part of the JD. Discard entirely.
8. Gender-neutral job titles: preserve the source format (X/Y). Do not pick one gender form.
9. If "Oferujemy" contains only umowa o pracę + pay details: put pay in Section I, discard contract type (it is not JD content).
10. If a section cannot be populated from source, use the prescribed placeholder text from rules above — never leave a must-have field empty.
`;
