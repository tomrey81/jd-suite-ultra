// Inlined lexicon CSVs. The source-of-truth lives in lib/bias/lexicon/*.csv
// (kept for human review and customer-admin override UI). This module is
// what runs at request time, so server bundling on Vercel never breaks.
//
// To regenerate: run `pnpm tsx scripts/inline-lexicons.ts` (TODO add script).
// For now this file is hand-mirrored.

export const LEXICON_DATA: Record<string, Record<string, string>> = {
  en: {
    agentic: `language,code_type,pattern_type,pattern,severity,notes,source,version,added_by,added_at
en,agentic,word,active,low,Gaucher 2011 seed,Gaucher2011,1.0,trey,2026-04-29
en,agentic,word,adventurous,low,Gaucher 2011 seed,Gaucher2011,1.0,trey,2026-04-29
en,agentic,word,aggressive,medium,Gaucher 2011 seed,Gaucher2011,1.0,trey,2026-04-29
en,agentic,word,ambitious,low,Gaucher 2011 seed,Gaucher2011,1.0,trey,2026-04-29
en,agentic,word,analytical,low,Gaucher 2011 seed,Gaucher2011,1.0,trey,2026-04-29
en,agentic,word,assertive,medium,Gaucher 2011 seed,Gaucher2011,1.0,trey,2026-04-29
en,agentic,word,athletic,medium,Matfield decoder,Matfield,1.0,trey,2026-04-29
en,agentic,word,autonomous,low,Gaucher 2011 seed,Gaucher2011,1.0,trey,2026-04-29
en,agentic,word,boast,medium,Gaucher 2011 seed,Gaucher2011,1.0,trey,2026-04-29
en,agentic,word,challenging,low,Gaucher 2011 seed,Gaucher2011,1.0,trey,2026-04-29
en,agentic,word,competitive,medium,Gaucher 2011 seed,Gaucher2011,1.0,trey,2026-04-29
en,agentic,word,confident,low,Gaucher 2011 seed,Gaucher2011,1.0,trey,2026-04-29
en,agentic,word,courageous,low,Gaucher 2011 seed,Gaucher2011,1.0,trey,2026-04-29
en,agentic,word,decisive,low,Gaucher 2011 seed,Gaucher2011,1.0,trey,2026-04-29
en,agentic,word,decide,low,Gaucher 2011 seed,Gaucher2011,1.0,trey,2026-04-29
en,agentic,word,determined,low,Gaucher 2011 seed,Gaucher2011,1.0,trey,2026-04-29
en,agentic,word,dominant,medium,Gaucher 2011 seed,Gaucher2011,1.0,trey,2026-04-29
en,agentic,word,driven,low,Matfield decoder,Matfield,1.0,trey,2026-04-29
en,agentic,word,fearless,low,Gaucher 2011 seed,Gaucher2011,1.0,trey,2026-04-29
en,agentic,word,fight,medium,Gaucher 2011 seed,Gaucher2011,1.0,trey,2026-04-29
en,agentic,word,force,low,Gaucher 2011 seed,Gaucher2011,1.0,trey,2026-04-29
en,agentic,word,greedy,medium,Gaucher 2011 seed,Gaucher2011,1.0,trey,2026-04-29
en,agentic,word,headstrong,medium,Gaucher 2011 seed,Gaucher2011,1.0,trey,2026-04-29
en,agentic,word,hierarchical,medium,Matfield decoder,Matfield,1.0,trey,2026-04-29
en,agentic,word,hostile,medium,Gaucher 2011 seed,Gaucher2011,1.0,trey,2026-04-29
en,agentic,word,impulsive,low,Gaucher 2011 seed,Gaucher2011,1.0,trey,2026-04-29
en,agentic,word,independent,low,Gaucher 2011 seed,Gaucher2011,1.0,trey,2026-04-29
en,agentic,word,individual,low,Gaucher 2011 seed,Gaucher2011,1.0,trey,2026-04-29
en,agentic,word,intellectual,low,Gaucher 2011 seed,Gaucher2011,1.0,trey,2026-04-29
en,agentic,word,leader,low,Gaucher 2011 seed,Gaucher2011,1.0,trey,2026-04-29
en,agentic,word,logic,low,Gaucher 2011 seed,Gaucher2011,1.0,trey,2026-04-29
en,agentic,word,objective,low,Gaucher 2011 seed,Gaucher2011,1.0,trey,2026-04-29
en,agentic,word,opinion,low,Gaucher 2011 seed,Gaucher2011,1.0,trey,2026-04-29
en,agentic,word,outspoken,low,Gaucher 2011 seed,Gaucher2011,1.0,trey,2026-04-29
en,agentic,word,persist,low,Gaucher 2011 seed,Gaucher2011,1.0,trey,2026-04-29
en,agentic,word,principled,low,Gaucher 2011 seed,Gaucher2011,1.0,trey,2026-04-29
en,agentic,word,reckless,medium,Gaucher 2011 seed,Gaucher2011,1.0,trey,2026-04-29
en,agentic,word,rockstar,medium,Matfield decoder,Matfield,1.0,trey,2026-04-29
en,agentic,word,ninja,medium,Matfield decoder,Matfield,1.0,trey,2026-04-29
en,agentic,word,self-confident,low,Gaucher 2011 seed,Gaucher2011,1.0,trey,2026-04-29
en,agentic,word,self-reliant,low,Gaucher 2011 seed,Gaucher2011,1.0,trey,2026-04-29
en,agentic,word,self-sufficient,low,Gaucher 2011 seed,Gaucher2011,1.0,trey,2026-04-29
en,agentic,word,stubborn,medium,Gaucher 2011 seed,Gaucher2011,1.0,trey,2026-04-29
en,agentic,word,superior,low,Gaucher 2011 seed,Gaucher2011,1.0,trey,2026-04-29
en,agentic,word,unreasonable,medium,Gaucher 2011 seed,Gaucher2011,1.0,trey,2026-04-29`,
    communal: `language,code_type,pattern_type,pattern,severity,notes,source,version,added_by,added_at
en,communal,word,affectionate,low,Gaucher 2011 seed,Gaucher2011,1.0,trey,2026-04-29
en,communal,word,collaborate,low,Gaucher 2011 seed,Gaucher2011,1.0,trey,2026-04-29
en,communal,word,collaborative,low,Gaucher 2011 seed,Gaucher2011,1.0,trey,2026-04-29
en,communal,word,committed,low,Gaucher 2011 seed,Gaucher2011,1.0,trey,2026-04-29
en,communal,word,communal,low,Gaucher 2011 seed,Gaucher2011,1.0,trey,2026-04-29
en,communal,word,compassionate,low,Gaucher 2011 seed,Gaucher2011,1.0,trey,2026-04-29
en,communal,word,connect,low,Gaucher 2011 seed,Gaucher2011,1.0,trey,2026-04-29
en,communal,word,considerate,low,Gaucher 2011 seed,Gaucher2011,1.0,trey,2026-04-29
en,communal,word,cooperate,low,Gaucher 2011 seed,Gaucher2011,1.0,trey,2026-04-29
en,communal,word,depend,low,Gaucher 2011 seed,Gaucher2011,1.0,trey,2026-04-29
en,communal,word,emotional,low,Gaucher 2011 seed,Gaucher2011,1.0,trey,2026-04-29
en,communal,word,empath,low,Gaucher 2011 seed,Gaucher2011,1.0,trey,2026-04-29
en,communal,word,empathic,low,Gaucher 2011 seed,Gaucher2011,1.0,trey,2026-04-29
en,communal,word,empathetic,low,Gaucher 2011 seed,Gaucher2011,1.0,trey,2026-04-29
en,communal,word,feel,low,Gaucher 2011 seed,Gaucher2011,1.0,trey,2026-04-29
en,communal,word,gentle,low,Gaucher 2011 seed,Gaucher2011,1.0,trey,2026-04-29
en,communal,word,honest,low,Gaucher 2011 seed,Gaucher2011,1.0,trey,2026-04-29
en,communal,word,interpersonal,low,Gaucher 2011 seed,Gaucher2011,1.0,trey,2026-04-29
en,communal,word,interdependent,low,Gaucher 2011 seed,Gaucher2011,1.0,trey,2026-04-29
en,communal,word,kind,low,Gaucher 2011 seed,Gaucher2011,1.0,trey,2026-04-29
en,communal,word,loyal,low,Gaucher 2011 seed,Gaucher2011,1.0,trey,2026-04-29
en,communal,word,modest,low,Gaucher 2011 seed,Gaucher2011,1.0,trey,2026-04-29
en,communal,word,nurture,low,Gaucher 2011 seed,Gaucher2011,1.0,trey,2026-04-29
en,communal,word,patient,low,Gaucher 2011 seed,Gaucher2011,1.0,trey,2026-04-29
en,communal,word,pleasant,low,Gaucher 2011 seed,Gaucher2011,1.0,trey,2026-04-29
en,communal,word,polite,low,Gaucher 2011 seed,Gaucher2011,1.0,trey,2026-04-29
en,communal,word,quiet,low,Gaucher 2011 seed,Gaucher2011,1.0,trey,2026-04-29
en,communal,word,respond,low,Gaucher 2011 seed,Gaucher2011,1.0,trey,2026-04-29
en,communal,word,sensitive,low,Gaucher 2011 seed,Gaucher2011,1.0,trey,2026-04-29
en,communal,word,submissive,low,Gaucher 2011 seed,Gaucher2011,1.0,trey,2026-04-29
en,communal,word,support,low,Gaucher 2011 seed,Gaucher2011,1.0,trey,2026-04-29
en,communal,word,sympathetic,low,Gaucher 2011 seed,Gaucher2011,1.0,trey,2026-04-29
en,communal,word,team,low,Gaucher 2011 seed,Gaucher2011,1.0,trey,2026-04-29
en,communal,word,together,low,Gaucher 2011 seed,Gaucher2011,1.0,trey,2026-04-29
en,communal,word,trust,low,Gaucher 2011 seed,Gaucher2011,1.0,trey,2026-04-29
en,communal,word,understand,low,Gaucher 2011 seed,Gaucher2011,1.0,trey,2026-04-29
en,communal,word,warm,low,Gaucher 2011 seed,Gaucher2011,1.0,trey,2026-04-29
en,communal,word,yield,low,Gaucher 2011 seed,Gaucher2011,1.0,trey,2026-04-29`,
    title_pairs: '',
  },
  pl: {
    agentic: `language,code_type,pattern_type,pattern,severity,notes,source,version,added_by,added_at
pl,agentic,regex,\\b(rywalizacj\\w*|rywal\\w+)\\b,medium,competitive/competition stem,internal,1.0,trey,2026-04-29
pl,agentic,regex,\\b(konkurencyjn\\w*|konkurencj\\w*)\\b,medium,competitive stem,internal,1.0,trey,2026-04-29
pl,agentic,regex,\\b(agresywn\\w*|agresj\\w*)\\b,medium,aggressive stem,internal,1.0,trey,2026-04-29
pl,agentic,regex,\\b(asertywn\\w*)\\b,medium,assertive stem,internal,1.0,trey,2026-04-29
pl,agentic,regex,\\b(bezkompromisow\\w*)\\b,medium,uncompromising stem,internal,1.0,trey,2026-04-29
pl,agentic,regex,\\b(dominacj\\w*|dominuj\\w*|dominant\\w*)\\b,medium,dominance stem,internal,1.0,trey,2026-04-29
pl,agentic,regex,\\b(zdecydowan\\w*)\\b,low,decisive stem,internal,1.0,trey,2026-04-29
pl,agentic,regex,\\b(ambitn\\w*|ambicj\\w*)\\b,low,ambitious stem,internal,1.0,trey,2026-04-29
pl,agentic,regex,\\b(samodzieln\\w*|samodzielnoś\\w*)\\b,low,self-reliant stem,internal,1.0,trey,2026-04-29
pl,agentic,regex,\\b(nieustępliw\\w*)\\b,medium,relentless stem,internal,1.0,trey,2026-04-29
pl,agentic,regex,\\b(walcz\\w+|walk\\w+|zawalcz\\w+)\\b,medium,fight stem,internal,1.0,trey,2026-04-29
pl,agentic,regex,\\b(zwyci[eę]ż\\w*|zwyci[eę]stw\\w*)\\b,medium,victory stem,internal,1.0,trey,2026-04-29
pl,agentic,regex,\\b(odważn\\w*|odwag\\w*)\\b,low,brave stem,internal,1.0,trey,2026-04-29
pl,agentic,regex,\\b(niezależn\\w*|niezależnoś\\w*)\\b,low,independent stem,internal,1.0,trey,2026-04-29
pl,agentic,regex,\\b(rezultat\\w*|wynik\\w*-driven|nastawion\\w+ na rezultat\\w*)\\b,low,results-driven idiom,internal,1.0,trey,2026-04-29
pl,agentic,regex,\\b(lider\\w*)\\b,low,leader stem,internal,1.0,trey,2026-04-29
pl,agentic,regex,\\b(pewn\\w+ siebie|pewność siebie)\\b,low,self-confident phrase,internal,1.0,trey,2026-04-29
pl,agentic,regex,\\b(ekspansywn\\w*|ekspansj\\w*)\\b,medium,expansive stem,internal,1.0,trey,2026-04-29
pl,agentic,regex,\\b(młody\\w*|młodzi|młodej?|młod\\w+)\\b,medium,young — demographic proxy (H-E-06),internal,1.0,trey,2026-04-29`,
    communal: `language,code_type,pattern_type,pattern,severity,notes,source,version,added_by,added_at
pl,communal,regex,\\b(współprac\\w*|współpracown\\w*)\\b,low,cooperate stem,internal,1.0,trey,2026-04-29
pl,communal,regex,\\b(zespołow\\w*|zespół\\w*|zespole)\\b,low,team stem,internal,1.0,trey,2026-04-29
pl,communal,regex,\\b(relacyjn\\w*|relacj\\w*)\\b,low,relational stem,internal,1.0,trey,2026-04-29
pl,communal,regex,\\b(empati\\w*|empat[yi]czn\\w*)\\b,low,empathy stem,internal,1.0,trey,2026-04-29
pl,communal,regex,\\b(cierpliw\\w*|cierpliwoś\\w*)\\b,low,patience stem,internal,1.0,trey,2026-04-29
pl,communal,regex,\\b(wspiera\\w+|wsparci\\w*)\\b,low,support stem,internal,1.0,trey,2026-04-29
pl,communal,regex,\\b(troskliw\\w*|troszcz\\w+|troska)\\b,low,caring stem,internal,1.0,trey,2026-04-29
pl,communal,regex,\\b(opiekuń\\w*|opiek\\w+)\\b,low,caring stem,internal,1.0,trey,2026-04-29
pl,communal,regex,\\b(uważ\\w+|uważnoś\\w*)\\b,low,attentive stem,internal,1.0,trey,2026-04-29
pl,communal,regex,\\b(życzliw\\w*|życzliwoś\\w*)\\b,low,kind stem,internal,1.0,trey,2026-04-29
pl,communal,regex,\\b(uprzejm\\w*|grzeczn\\w*)\\b,low,polite stem,internal,1.0,trey,2026-04-29
pl,communal,regex,\\b(wyrozumiał\\w*|wyrozumiałoś\\w*)\\b,low,understanding stem,internal,1.0,trey,2026-04-29
pl,communal,regex,\\b(serdeczn\\w*|serdeczność)\\b,low,warm stem,internal,1.0,trey,2026-04-29
pl,communal,regex,\\b(komunikatywn\\w*|komunikacj\\w*)\\b,low,communicative stem,internal,1.0,trey,2026-04-29
pl,communal,regex,\\b(otwartoś\\w+|otwart\\w+ na)\\b,low,openness phrase,internal,1.0,trey,2026-04-29
pl,communal,regex,\\b(słuch\\w+|wysłuchać|wysłuchiw\\w*)\\b,low,listening stem,internal,1.0,trey,2026-04-29
pl,communal,regex,\\b(razem|wspólnie)\\b,low,together adverbs,internal,1.0,trey,2026-04-29
pl,communal,regex,\\b(pomocn\\w+|pomag\\w+|pomoc\\w*)\\b,low,helpful stem,internal,1.0,trey,2026-04-29
pl,communal,regex,\\b(zaangażowan\\w*|zaangażowani\\w*)\\b,low,engaged stem,internal,1.0,trey,2026-04-29`,
    title_pairs: `language,masculine,feminine,neutral,severity_if_singular,notes
pl,specjalista,specjalistka,osoba na stanowisku specjalisty,medium,common pair (pracuj.pl)
pl,kierownik,kierowniczka,osoba kierująca,medium,common pair
pl,dyrektor,dyrektorka,osoba zarządzająca,medium,common pair
pl,prezes,prezeska,osoba pełniąca funkcję prezesa,medium,common pair
pl,konsultant,konsultantka,osoba konsultująca,medium,common pair
pl,analityk,analityczka,osoba analizująca,medium,common pair
pl,programista,programistka,osoba programująca,medium,common pair
pl,inżynier,inżynierka,osoba inżynierska,medium,common pair
pl,prawnik,prawniczka,osoba pełniąca rolę prawnika,medium,common pair
pl,nauczyciel,nauczycielka,osoba nauczająca,medium,common pair
pl,doradca,doradczyni,osoba doradzająca,medium,common pair
pl,redaktor,redaktorka,osoba redagująca,medium,common pair
pl,księgowy,księgowa,osoba prowadząca księgowość,medium,common pair
pl,manager,managerka,osoba zarządzająca,medium,anglicism
pl,lider,liderka,osoba lidera,medium,common pair
pl,projektant,projektantka,osoba projektująca,medium,common pair
pl,architekt,architektka,osoba architekta,medium,common pair
pl,pracownik,pracownica,osoba zatrudniona,low,common pair
pl,asystent,asystentka,osoba asystenta,medium,common pair
pl,koordynator,koordynatorka,osoba koordynująca,medium,common pair
pl,handlowiec,handlowczyni,osoba handlowca,medium,common pair
pl,sprzedawca,sprzedawczyni,osoba sprzedająca,medium,common pair
pl,monter,monterka,osoba montująca,medium,Iceland 2024 §11 — elektromonter trap
pl,elektromonter,elektromonterka,osoba montująca elektrycznie,high,Iceland 2024 §11 trap
pl,kasjer,kasjerka,osoba kasująca,low,common pair
pl,recepcjonista,recepcjonistka,osoba recepcji,low,common pair`,
  },
};
