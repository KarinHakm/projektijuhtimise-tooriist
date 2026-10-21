// Juhitud vestlus ühes voos (L37): millised sammud on vestluses näha ja kuhu läheb vestluse alla kirjutatud tekst.
// Kõik tuletatakse serveri etapiseisust (shared/stage.js); siin ei tehta päringuid.

// Vestluse plokid etappide järjekorras. Groomimine on backlog'i veerus, uus vaade avatakse backlog'i nupust.
export const FLOW_CARDS = ['roles', 'stories', 'priority', 'criteria', 'refinement'];
const STAGE_OF_CARD = { roles: 'rollid', stories: 'lood', priority: 'prioriteedid', criteria: 'kriteeriumid', refinement: 'tapsustused' };

// Kuhu tekst võib minna. 'next' = „Mida teeme edasi?“: AI soovitab lubatud sammu, andmeid ei muudeta.
export const TARGET_LABELS = {
  conversation: 'idee',
  roles: 'rollid',
  stories: 'lood',
  priority: 'prioriteet',
  criteria: 'kriteeriumid ja mockup',
  refinement: 'kliendi täpsustus',
  next: 'mida teeme edasi (AI soovitab sammu)',
};

// Plokk ilmub vestlusesse alles siis, kui selle etapini on jõutud (eeldus täidetud); lukus etappe ei näidata.
export function visibleBlocks(stage) {
  if (!stage) return [];
  return FLOW_CARDS.filter((card) => {
    const s = stage.stages.find((x) => x.key === STAGE_OF_CARD[card]);
    return Boolean(s) && s.status !== 'blocked';
  });
}

// Vestluse praegune koht: esimene soovitatud samm (pooleli otsus või järgmise etapi tegevus).
// Idee etapis läheb tekst ideeks; küsimustele vastatakse küsimuse enda nuppudega (sihtkohta pole).
export function preferredTarget(stage, phase) {
  if (phase === 'empty') return 'conversation';
  if (phase !== 'done') return null;
  const card = stage?.steps?.[0]?.card;
  return FLOW_CARDS.includes(card) ? card : 'next';
}

// Kui eelistatud samm teksti praegu vastu ei võta (nt kinnitatud kriteeriume muudab ainult täpsustus), proovitakse järgmist.
export function pickTarget(preferred, available) {
  if (!preferred) return null;
  const chain = [preferred];
  if (preferred === 'criteria') chain.push('refinement');
  if (preferred !== 'conversation') chain.push('next');
  return chain.find((c) => c === 'next' || available.has(c)) ?? null;
}

// „Mida teeme edasi?“ ploki all: samm, mis viib sama ploki juba nähtava otsuse juurde (nt „Vali lood backlog'i“,
// „Vasta AI küsimustele“), on vestluses üleliigne – otsuse nupud on kohe selle kohal. Alles jäävad sammud edasi või mujale.
const IN_BLOCK = new Set(['answer-questions', 'retry-conversation']);
export function stepsForBlock(card, steps) {
  return (steps ?? []).filter((s) => !(s.card === card && (s.id.startsWith('review-') || IN_BLOCK.has(s.id))));
}

// Ploki algusnupp (nt „Paku lugusid“), mille sama sammu („Küsi AI-lt lugude ettepanek“) pakub juba mõne teise ploki
// „Mida teeme edasi?“ – vestluses on see topelt, seega ploki nupp peidetakse. shownSteps = { card: [nähtavad sammud] }.
// Tagastab { card: [peidetava nupu data-step nimed] }.
export function startsOfferedAbove(shownSteps) {
  const hidden = {};
  for (const [from, steps] of Object.entries(shownSteps)) {
    for (const s of steps ?? []) {
      const name = s.ai && s.card !== from ? s.focus?.match(/^\[data-step="([\w-]+-propose)"\]$/)?.[1] : null;
      if (name) hidden[s.card] = [...new Set([...(hidden[s.card] ?? []), name])];
    }
  }
  return hidden;
}
