import type { GroundTruthNode } from '../types';

/**
 * Acceptance fixture for the PGE org chart PDF dated 2024/03/05.
 * Source: Zał.2/E do REGL 00001/U Regulamin Organizacyjny PGE Polska Grupa Energetyczna S.A.
 *
 * 38 nodes total: 1 root, 2 sub-board members, 6 pions, 28 departments, 6 offices,
 * 1 branch (CWIR). Parent links use codes where available, names elsewhere.
 *
 * Used by the org-structure extraction acceptance test in
 * lib/org-structure/extract.test.ts.
 */
export const PGE_GROUND_TRUTH: GroundTruthNode[] = [
  // ─── Root ─────────────────────────────────────────────────────────────────
  { code: null, name: 'Prezes Zarządu',                        type: 'PRESIDENT',     parentCode: null },

  // ─── Top-level board ──────────────────────────────────────────────────────
  { code: null, name: 'Wiceprezes Zarządu ds. Operacyjnych',   type: 'VICE_PRESIDENT', parentCode: 'Prezes Zarządu' },
  { code: null, name: 'Członek Zarządu',                       type: 'BOARD_MEMBER',   parentCode: 'Prezes Zarządu' },

  // ─── PION WSPARCIA (under Wiceprezes Operacyjnych) ────────────────────────
  { code: null, name: 'PION WSPARCIA', type: 'PION', parentCode: 'Wiceprezes Zarządu ds. Operacyjnych' },
  { code: 'DAD',  name: 'Departament Administracji',                                                  type: 'DEPARTMENT', parentCode: 'PION WSPARCIA' },
  { code: 'DKLK', name: 'Departament Zarządzania Kapitałem Ludzkim i Kulturą Organizacji',           type: 'DEPARTMENT', parentCode: 'PION WSPARCIA' },
  { code: 'CWIR', name: 'Oddział Centrum Wiedzy i Rozwoju Grupy PGE',                                type: 'BRANCH',     parentCode: 'DKLK' },
  { code: 'DZ',   name: 'Departament Zakupów',                                                       type: 'DEPARTMENT', parentCode: 'PION WSPARCIA' },
  { code: 'BHP',  name: 'Biuro ds. Bezpieczeństwa i Higieny Pracy',                                  type: 'OFFICE',     parentCode: 'PION WSPARCIA' },
  { code: 'DDRS', name: 'Departament Dialogu i Relacji Społecznych',                                 type: 'DEPARTMENT', parentCode: 'PION WSPARCIA' },
  { code: 'DC',   name: 'Departament Compliance',                                                    type: 'DEPARTMENT', parentCode: 'PION WSPARCIA' },

  // ─── PION OPERACYJNY (under Wiceprezes Operacyjnych) ──────────────────────
  { code: null, name: 'PION OPERACYJNY', type: 'PION', parentCode: 'Wiceprezes Zarządu ds. Operacyjnych' },
  { code: 'DZOI', name: 'Departament Zarządzania Operacyjnego i Inwestycji', type: 'DEPARTMENT', parentCode: 'PION OPERACYJNY' },
  { code: 'DDSP', name: 'Departament Dostaw Surowców Produkcyjnych',         type: 'DEPARTMENT', parentCode: 'PION OPERACYJNY' },
  { code: 'DSEK', name: 'Departament Surowców Energii Konwencjonalnej',      type: 'DEPARTMENT', parentCode: 'PION OPERACYJNY' },
  { code: 'DH',   name: 'Departament Handlu',                                type: 'DEPARTMENT', parentCode: 'PION OPERACYJNY' },
  { code: 'DHEK', name: 'Departament Handlu Energią Konwencjonalną',         type: 'DEPARTMENT', parentCode: 'PION OPERACYJNY' },

  // ─── PION ENERGETYKI MORSKIEJ I NISKOEMISYJNEJ (under Wiceprezes Op.) ─────
  { code: null, name: 'PION ENERGETYKI MORSKIEJ I NISKOEMISYJNEJ', type: 'PION', parentCode: 'Wiceprezes Zarządu ds. Operacyjnych' },
  { code: 'DEM', name: 'Departament Energetyki Morskiej', type: 'DEPARTMENT', parentCode: 'PION ENERGETYKI MORSKIEJ I NISKOEMISYJNEJ' },

  // ─── Direct units under Prezes Zarządu ────────────────────────────────────
  { code: 'DB',  name: 'Departament Bezpieczeństwa',     type: 'DEPARTMENT', parentCode: 'Prezes Zarządu' },
  { code: 'DNW', name: 'Departament Nadzoru Wewnętrznego', type: 'DEPARTMENT', parentCode: 'Prezes Zarządu' },

  // ─── PION KOMUNIKACJI KORPORACYJNEJ I MARKETINGU (under Prezes) ──────────
  { code: null, name: 'PION KOMUNIKACJI KORPORACYJNEJ I MARKETINGU', type: 'PION', parentCode: 'Prezes Zarządu' },
  { code: 'DRIE', name: 'Departament Relacji Inwestorskich i ESG', type: 'DEPARTMENT', parentCode: 'PION KOMUNIKACJI KORPORACYJNEJ I MARKETINGU' },
  { code: 'DMR',  name: 'Departament Marketingu i Reklamy',         type: 'DEPARTMENT', parentCode: 'PION KOMUNIKACJI KORPORACYJNEJ I MARKETINGU' },
  { code: 'DKK',  name: 'Departament Komunikacji Korporacyjnej',    type: 'DEPARTMENT', parentCode: 'PION KOMUNIKACJI KORPORACYJNEJ I MARKETINGU' },
  { code: 'BDC',  name: 'Biuro ds. Ciepła',                         type: 'OFFICE',     parentCode: 'PION KOMUNIKACJI KORPORACYJNEJ I MARKETINGU' },
  { code: 'BOZE', name: 'Biuro ds. OZE',                            type: 'OFFICE',     parentCode: 'PION KOMUNIKACJI KORPORACYJNEJ I MARKETINGU' },
  { code: 'BDD',  name: 'Biuro ds. Dystrybucji',                    type: 'OFFICE',     parentCode: 'PION KOMUNIKACJI KORPORACYJNEJ I MARKETINGU' },
  { code: 'BDO',  name: 'Biuro ds. Obrotu',                         type: 'OFFICE',     parentCode: 'PION KOMUNIKACJI KORPORACYJNEJ I MARKETINGU' },
  { code: 'BEK',  name: 'Biuro ds. Energetyki Kolejowej',           type: 'OFFICE',     parentCode: 'PION KOMUNIKACJI KORPORACYJNEJ I MARKETINGU' },

  // ─── PION PRAWA I ZARZĄDZANIA GRUPĄ KAPITAŁOWĄ (under Prezes) ────────────
  { code: null, name: 'PION PRAWA I ZARZĄDZANIA GRUPĄ KAPITAŁOWĄ', type: 'PION', parentCode: 'Prezes Zarządu' },
  { code: 'DPZK', name: 'Departament Prawa i Zarządzania Korporacyjnego', type: 'DEPARTMENT', parentCode: 'PION PRAWA I ZARZĄDZANIA GRUPĄ KAPITAŁOWĄ' },
  { code: 'DOS',  name: 'Departament Obsługi Władz Spółki',              type: 'DEPARTMENT', parentCode: 'PION PRAWA I ZARZĄDZANIA GRUPĄ KAPITAŁOWĄ' },

  // ─── PION FINANSÓW (under Prezes) ─────────────────────────────────────────
  { code: null, name: 'PION FINANSÓW', type: 'PION', parentCode: 'Prezes Zarządu' },
  { code: 'DK',   name: 'Departament Kontrolingu',                 type: 'DEPARTMENT', parentCode: 'PION FINANSÓW' },
  { code: 'DSP',  name: 'Departament Sprawozdawczości i Podatków', type: 'DEPARTMENT', parentCode: 'PION FINANSÓW' },
  { code: 'DRU',  name: 'Departament Ryzyka i Ubezpieczeń',        type: 'DEPARTMENT', parentCode: 'PION FINANSÓW' },
  { code: 'DTR',  name: 'Departament Skarbu',                      type: 'DEPARTMENT', parentCode: 'PION FINANSÓW' },
  { code: 'DSIT', name: 'Departament Strategii IT',                type: 'DEPARTMENT', parentCode: 'PION FINANSÓW' },
  { code: 'DA',   name: 'Departament Audytu',                      type: 'DEPARTMENT', parentCode: 'PION FINANSÓW' },
  { code: 'DFP',  name: 'Departament Fuzji i Przejęć',             type: 'DEPARTMENT', parentCode: 'PION FINANSÓW' },
  { code: 'DAR',  name: 'Departament Analiz Rynkowych',            type: 'DEPARTMENT', parentCode: 'PION FINANSÓW' },
  { code: 'BAML', name: 'Biuro ds. AML',                           type: 'OFFICE',     parentCode: 'PION FINANSÓW' },

  // ─── Direct departments under Członek Zarządu ─────────────────────────────
  { code: 'DSRK', name: 'Departament Sprzedaży i Relacji z Klientami',     type: 'DEPARTMENT', parentCode: 'Członek Zarządu' },
  { code: 'DEJ',  name: 'Departament Energetyki Jądrowej',                 type: 'DEPARTMENT', parentCode: 'Członek Zarządu' },
  { code: 'DIDW', name: 'Departament Integracji i Doradztwa Wewnętrznego', type: 'DEPARTMENT', parentCode: 'Członek Zarządu' },
  { code: 'DRI',  name: 'Departament Rozwoju i Innowacji',                 type: 'DEPARTMENT', parentCode: 'Członek Zarządu' },
  { code: 'DGOZ', name: 'Departament Gospodarki Obiegu Zamkniętego',       type: 'DEPARTMENT', parentCode: 'Członek Zarządu' },

  // ─── PION REGULACJI (under Członek Zarządu) ───────────────────────────────
  { code: null, name: 'PION REGULACJI', type: 'PION', parentCode: 'Członek Zarządu' },
  { code: 'DER', name: 'Departament Regulacji',                  type: 'DEPARTMENT', parentCode: 'PION REGULACJI' },
  { code: 'BIP', name: 'Biuro ds. Instrumentów Pomocowych',      type: 'OFFICE',     parentCode: 'PION REGULACJI' },
  { code: 'DRM', name: 'Departament Relacji Międzynarodowych',   type: 'DEPARTMENT', parentCode: 'PION REGULACJI' },
];

/** Total node count for sanity check. */
export const PGE_GROUND_TRUTH_COUNT = PGE_GROUND_TRUTH.length;
