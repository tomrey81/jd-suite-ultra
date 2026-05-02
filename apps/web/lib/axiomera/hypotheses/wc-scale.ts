/**
 * Axiomera WC (Working Conditions) scoring — EWCS 2024 ISCO_2 mapping
 * Source: Axiomera Whitepaper v2 (April 2026), Tables 22, 23
 *
 * WC is treated as a pay correction (kompensata), not a grade driver.
 * Points range 50–350; formula:
 *   WC_pkt = ((wc_isco2 − min) / (max − min)) × 300 + 50
 * Levels W1..W5 follow thresholds from Table 22.
 */

export type WCLevel = 'W1' | 'W2' | 'W3' | 'W4' | 'W5';

export interface WCThreshold {
  level: WCLevel;
  min: number;
  max: number;
  label_pl: string;
  label_en: string;
  label_de: string;
}

export const WC_THRESHOLDS: WCThreshold[] = [
  { level: 'W1', min: 50,  max: 110, label_pl: 'Środowisko biurowe / profesjonalne. Minimalna ekspozycja.', label_en: 'Office / professional environment. Minimal exposure.',       label_de: 'Büro-/Berufsumfeld. Minimale Exposition.' },
  { level: 'W2', min: 111, max: 170, label_pl: 'Częściowa ekspozycja. Terenowa, usługi, sprzedaż.',         label_en: 'Partial exposure. Fieldwork, services, sales.',              label_de: 'Teilweise Exposition. Außendienst, Dienstleistungen, Vertrieb.' },
  { level: 'W3', min: 171, max: 230, label_pl: 'Regularna ekspozycja. Zdrowie, usługi osobiste.',           label_en: 'Regular exposure. Healthcare, personal services.',           label_de: 'Regelmäßige Exposition. Gesundheitswesen, persönliche Dienstleistungen.' },
  { level: 'W4', min: 231, max: 290, label_pl: 'Znaczące wymagania fizyczne. Rzemiosło, kierowcy, monterzy.', label_en: 'Significant physical demands. Crafts, drivers, assemblers.', label_de: 'Erhebliche körperliche Anforderungen. Handwerk, Fahrer, Monteure.' },
  { level: 'W5', min: 291, max: 350, label_pl: 'Ekstremalne warunki. Budownictwo, metalurgia, maszyny.',    label_en: 'Extreme conditions. Construction, metallurgy, machinery.',   label_de: 'Extreme Bedingungen. Bau, Metallurgie, Maschinen.' },
];

/**
 * Table 23 — WC_pkt per ISCO-08 2-digit group (42 occupational families).
 */
export const WC_BY_ISCO2: Record<number, { wc_pkt: number; level: WCLevel; name_pl: string }> = {
  1:  { wc_pkt: 160, level: 'W2', name_pl: 'Oficerowie sił zbrojnych' },
  2:  { wc_pkt: 169, level: 'W2', name_pl: 'Podoficerowie sił zbrojnych' },
  3:  { wc_pkt: 202, level: 'W3', name_pl: 'Pozostałe zawody sił zbrojnych' },
  11: { wc_pkt: 64,  level: 'W1', name_pl: 'Wyżsi urzędnicy i dyrektorzy generalni' },
  12: { wc_pkt: 55,  level: 'W1', name_pl: 'Kierownicy ds. administracyjnych i handlowych' },
  13: { wc_pkt: 100, level: 'W1', name_pl: 'Kierownicy produkcji i usług specjalistycznych' },
  14: { wc_pkt: 122, level: 'W2', name_pl: 'Kierownicy usług hotelarskich, handlowych i pokrewnych' },
  21: { wc_pkt: 101, level: 'W1', name_pl: 'Specjaliści nauk przyrodniczych i technicznych' },
  22: { wc_pkt: 210, level: 'W3', name_pl: 'Specjaliści ochrony zdrowia' },
  23: { wc_pkt: 69,  level: 'W1', name_pl: 'Specjaliści nauczania i wychowania' },
  24: { wc_pkt: 50,  level: 'W1', name_pl: 'Specjaliści ds. ekonomicznych i zarządzania' },
  25: { wc_pkt: 50,  level: 'W1', name_pl: 'Specjaliści ds. technologii informacyjno-komunikacyjnych' },
  26: { wc_pkt: 63,  level: 'W1', name_pl: 'Specjaliści prawa, dziedzin społecznych i kultury' },
  31: { wc_pkt: 173, level: 'W3', name_pl: 'Średni personel nauk przyrodniczych i technicznych' },
  32: { wc_pkt: 202, level: 'W3', name_pl: 'Średni personel ochrony zdrowia' },
  33: { wc_pkt: 57,  level: 'W1', name_pl: 'Średni personel ds. ekonomicznych i zarządzania' },
  34: { wc_pkt: 125, level: 'W2', name_pl: 'Średni personel prawa, spraw społecznych i kultury' },
  35: { wc_pkt: 86,  level: 'W1', name_pl: 'Technicy informatycy' },
  41: { wc_pkt: 57,  level: 'W1', name_pl: 'Pracownicy biurowi ogólni' },
  42: { wc_pkt: 70,  level: 'W1', name_pl: 'Pracownicy obsługi klienta' },
  43: { wc_pkt: 107, level: 'W1', name_pl: 'Pracownicy ds. numerycznych i ewidencji materiałowej' },
  44: { wc_pkt: 108, level: 'W1', name_pl: 'Inni pracownicy obsługi biurowej' },
  51: { wc_pkt: 197, level: 'W3', name_pl: 'Pracownicy usług osobistych' },
  52: { wc_pkt: 133, level: 'W2', name_pl: 'Sprzedawcy' },
  53: { wc_pkt: 190, level: 'W3', name_pl: 'Pracownicy opieki osobistej' },
  54: { wc_pkt: 138, level: 'W2', name_pl: 'Pracownicy ochrony i służb pokrewnych' },
  61: { wc_pkt: 258, level: 'W4', name_pl: 'Rolnicy i hodowcy rynkowi' },
  62: { wc_pkt: 253, level: 'W4', name_pl: 'Leśnicy, rybacy i myśliwi rynkowi' },
  71: { wc_pkt: 350, level: 'W5', name_pl: 'Robotnicy budowlani i pokrewni' },
  72: { wc_pkt: 318, level: 'W5', name_pl: 'Robotnicy obróbki metali i mechanicy' },
  73: { wc_pkt: 246, level: 'W4', name_pl: 'Rzemieślnicy i poligrafowie' },
  74: { wc_pkt: 233, level: 'W4', name_pl: 'Elektrycy i elektronicy' },
  75: { wc_pkt: 248, level: 'W4', name_pl: 'Robotnicy przetwórstwa spożywczego, drewna i odzieży' },
  81: { wc_pkt: 299, level: 'W5', name_pl: 'Operatorzy maszyn i urządzeń stacjonarnych' },
  82: { wc_pkt: 273, level: 'W4', name_pl: 'Monterzy' },
  83: { wc_pkt: 233, level: 'W4', name_pl: 'Kierowcy i operatorzy ruchomych maszyn' },
  91: { wc_pkt: 209, level: 'W3', name_pl: 'Czyściciele i pomoce domowe' },
  92: { wc_pkt: 235, level: 'W4', name_pl: 'Robotnicy rolni i leśni' },
  93: { wc_pkt: 286, level: 'W4', name_pl: 'Robotnicy pomocniczy w górnictwie, budownictwie i przemyśle' },
  94: { wc_pkt: 206, level: 'W3', name_pl: 'Pomocnicy przygotowania żywności' },
  95: { wc_pkt: 212, level: 'W3', name_pl: 'Pracownicy uliczni i pokrewni' },
  96: { wc_pkt: 221, level: 'W3', name_pl: 'Pracownicy zbierania odpadów i pokrewni' },
};

export function wcLevelFromPoints(wc_pkt: number): WCLevel {
  const hit = WC_THRESHOLDS.find((t) => wc_pkt >= t.min && wc_pkt <= t.max);
  return hit?.level ?? 'W1';
}

export function wcPointsFromIsco2(isco2: number): number {
  return WC_BY_ISCO2[isco2]?.wc_pkt ?? 50;
}
