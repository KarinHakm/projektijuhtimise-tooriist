// Projekti etapid ja soovitatud järgmised sammud (L13, L14), ühine serverile ja brauserile.
// Kõik tuletatakse andmebaasi hetkeseisust (server/stage.js kogub faktid); eraldi etapivälja ei hoita.
// Samast tulemusest kuvatakse nii etappide riba kui plokk "Mida teeme edasi?" uusima AI väljundi juures.
//
// Sammud ainult kerivad olemasoleva tegevuseni – nupp ise AI-kutset ei tee. Sammu, mille eeldus puudub,
// ei pakuta. Groomimist rakenduses pole, seega seda ei soovitata ega saa valida.

// Kaartide DOM id-d projekti vaates (ProjectView kasutab sama tabelit).
export const CARDS = {
  conversation: 'kaart-vestlus',
  roles: 'kaart-rollid',
  stories: 'kaart-lood',
  priority: 'kaart-prioriteet',
  criteria: 'kaart-kriteeriumid',
  refinement: 'kaart-tapsustus',
  newView: 'kaart-uus-vaade',
  backlog: 'kaart-backlog',
};

export const MAX_STEPS = 4;

// Millise kaardi alla kuulub AI väljund (vestluse sõnum või ettepaneku liik).
export const AI_OUTPUT_CARD = {
  questions: 'conversation',
  summary: 'conversation',
  roles: 'roles',
  stories: 'stories',
  priority: 'priority',
  criteria: 'criteria',
  mockup: 'criteria',
  refinement: 'refinement',
  new_view: 'newView', // L24
};

const STAGES = [
  { key: 'idee', label: 'Idee', card: 'conversation' },
  { key: 'rollid', label: 'Rollid', card: 'roles' },
  { key: 'lood', label: 'Lood', card: 'stories' },
  { key: 'prioriteedid', label: 'Prioriteedid', card: 'priority' },
  { key: 'kriteeriumid', label: 'Kriteeriumid ja mockup', card: 'criteria' },
  { key: 'tapsustused', label: 'Täpsustused', card: 'refinement', optional: true },
  { key: 'groomimine', label: 'Groomimine', card: 'backlog' },
];
export const STAGE_KEYS = STAGES.map((s) => s.key);

// Etapp, mille andmeid järgmine etapp eeldab – lukustatud etapi põhjuse juures öeldakse, kui see jäeti vahele.
const PREREQUISITE = { rollid: 'idee', lood: 'rollid', prioriteedid: 'lood', kriteeriumid: 'prioriteedid', tapsustused: 'kriteeriumid', groomimine: 'lood' };

// facts = {
//   conversation: 'empty' | 'questions' | 'unanswered' | 'done', roles, stories (arvud), focus (kas alustamise lugu on valitud),
//   criteria (arv), mockup (bool), refinements (rakendatud täpsustuste arv) – kolm viimast alustamise loo kohta,
//   pending: { roles, stories, priority, criteria, mockup, refinement } (bool; kolm viimast alustamise loo kohta),
//   consistency: { warnings, reviewValid } | null, latestAi: { kind, at } | null,
//   skipped: [etapi võti] (kasutaja vahele jäetud), active: etapi võti | null (kus kasutaja viimati oli),
//   review: { open } | null (backlog'i ülevaatus ja selle avatud, aegumata leidude arv), conversationAiLast (bool)
// }
// Vahelejätmine (L14) ainult märgib etapi; eeldusi ega lukke see ei leevenda.
export function computeStage(facts) {
  const f = { pending: {}, ...facts };
  const p = f.pending;
  const done = {
    idee: f.conversation === 'done',
    rollid: f.roles > 0,
    lood: f.stories > 0,
    prioriteedid: f.focus,
    kriteeriumid: f.focus && f.criteria > 0 && f.mockup,
    tapsustused: f.focus && f.refinements > 0,
    groomimine: f.stories > 0 && Boolean(f.review) && f.review.open === 0,
  };
  const skipped = new Set((f.skipped ?? []).filter((k) => !done[k]));
  // Eeldus = see, mida server selle etapi tegevuseks nõuab (vt marsruutide 409 vastuseid).
  const blockedReason = {
    idee: null,
    rollid: f.conversation === 'done' ? null : 'Vestluse kokkuvõte puudub.',
    lood: f.roles > 0 ? null : 'Kinnita enne rollid.',
    prioriteedid: f.stories > 0 ? null : "Lisa enne lood backlog'i.",
    kriteeriumid: f.focus ? null : 'Vali enne alustamise lugu.',
    tapsustused: done.kriteeriumid ? null : 'Kinnita enne alustamise loole kriteeriumid ja mockup.',
    groomimine: f.stories > 0 ? null : "Lisa enne lood backlog'i.",
  };
  for (const [key, before] of Object.entries(PREREQUISITE)) {
    if (blockedReason[key] && skipped.has(before)) blockedReason[key] += ` (etapp „${STAGES.find((x) => x.key === before).label}“ jäeti vahele)`;
  }

  const lastDoneIndex = STAGES.findLastIndex((s) => done[s.key]);
  const nextIndex = STAGES.findIndex((s, i) => i > lastDoneIndex && !done[s.key] && !skipped.has(s.key) && !blockedReason[s.key]);
  const next = nextIndex >= 0 ? STAGES[nextIndex] : null;

  const stages = STAGES.map((s, i) => {
    let status;
    if (done[s.key]) status = 'done';
    else if (skipped.has(s.key)) status = 'passed';
    else if (i < lastDoneIndex) status = 'skipped';
    else if (s === next) status = 'next';
    else if (blockedReason[s.key]) status = 'blocked';
    else status = 'available';
    const reason = status === 'blocked' ? blockedReason[s.key]
      : status === 'skipped' ? 'Selle etapi andmeid pole, kuid järgmised etapid on tehtud.'
        : status === 'passed' ? `Jäeti vahele – klõpsa, et selle juurde tagasi minna.${blockedReason[s.key] ? ` Eeldus puudub: ${blockedReason[s.key]}` : ''}` : null;
    // Riba kaudu saab avada tehtud, vahele jäetud või kättesaadava etapi kaardi; eelduseta ja tegemata etappi mitte.
    const selectable = status !== 'blocked' && !(status === 'passed' && blockedReason[s.key]);
    // Vahele saab jätta ainult aktiivse või soovitatud, veel tegemata ja mitte-lukus etapi.
    const skippable = (status === 'next' || status === 'available') && (s === next || s.key === f.active);
    return { key: s.key, label: s.label, card: s.card, status, reason, selectable, skippable, optional: Boolean(s.optional) };
  });

  // Kõik sobivad sammud tähtsuse järjekorras; üldloendis on neist esimesed MAX_STEPS, kaartide plokkides kaardi omad eespool.
  const all = [];
  // Eelduseta etapi sammu ei pakuta kunagi (ka siis, kui andmetes on selle etapi ootel ettepanek).
  const add = (step) => {
    if (blockedReason[step.stage] && !done[step.stage]) return;
    if (!all.some((x) => x.id === step.id)) all.push({ ai: false, optional: false, ...step });
  };

  // 1. Pooleli otsused (AI ettepanek ootab kasutajat) etappides, mis pole veel tehtud, etappide järjekorras.
  //    Juba tehtud etapi ootel lisaettepanek (nt veel lugusid) on valikuline ja tuleb lõppu (vt 5).
  const doneStagePending = [];
  const addPending = (step) => (done[step.stage] ? doneStagePending.push(step) : add(step));
  if (f.conversation === 'questions') add({ id: 'answer-questions', stage: 'idee', label: 'Vasta AI küsimustele', card: 'conversation', focus: '.answer-form' });
  if (f.conversation === 'unanswered') add({ id: 'retry-conversation', stage: 'idee', label: 'Küsi AI vastus uuesti', card: 'conversation', focus: '.conversation', ai: true });
  if (p.roles) addPending({ id: 'review-roles', stage: 'rollid', label: 'Vaata rollide ettepanek üle', card: 'roles', focus: '.roles-proposal' });
  if (p.stories) addPending({ id: 'review-stories', stage: 'lood', label: done.lood ? "Vali lisalood backlog'i" : "Vali lood backlog'i", card: 'stories', focus: '.stories-proposal' });
  if (p.priority) addPending({ id: 'review-priority', stage: 'prioriteedid', label: 'Vaata prioriteedisoovitus üle', card: 'priority', focus: '.priority-proposal' });
  if (f.focus && p.criteria) addPending({ id: 'review-criteria', stage: 'kriteeriumid', label: 'Vaata kriteeriumid üle', card: 'criteria', focus: '.criteria-proposal' });
  if (f.focus && p.mockup) addPending({ id: 'review-mockup', stage: 'kriteeriumid', label: 'Kinnita või lükka mockup tagasi', card: 'criteria', focus: '.mockup-proposal' });
  if (f.focus && p.refinement) addPending({ id: 'review-refinement', stage: 'tapsustused', label: 'Vaata täpsustuse ettepanek üle', card: 'refinement', focus: '.refine-proposal' });
  if (f.review?.open > 0) add({ id: 'review-findings', stage: 'groomimine', label: 'Vaata ülevaatuse leiud üle', card: 'backlog', focus: '[data-step="review-findings"]' });

  // 2. Kooskõla hoiatused, mida kasutaja pole selles seisus üle vaadanud.
  if (done.kriteeriumid && f.consistency?.warnings > 0 && !f.consistency.reviewValid) {
    add({ id: 'review-consistency', stage: 'kriteeriumid', label: 'Vaata kooskõla hoiatused üle', card: 'criteria', focus: '.review-box' });
  }

  // 3. Soovitatud järgmise etapi tegevus (kui selles etapis pole juba pooleli otsust).
  const nextKey = next?.key;
  if (nextKey === 'idee' && f.conversation === 'empty') add({ id: 'write-idea', stage: 'idee', label: 'Kirjelda projekti idee', card: 'conversation', focus: '#idea', ai: true });
  if (nextKey === 'rollid' && !p.roles) add({ id: 'propose-roles', stage: 'rollid', label: 'Küsi AI-lt rollide ettepanek', card: 'roles', focus: '[data-step="roles-propose"]', ai: true });
  if (nextKey === 'lood' && !p.stories) add({ id: 'propose-stories', stage: 'lood', label: 'Küsi AI-lt lugude ettepanek', card: 'stories', focus: '[data-step="stories-propose"]', ai: true });
  if (nextKey === 'prioriteedid' && !p.priority) {
    add({ id: 'propose-priority', stage: 'prioriteedid', label: 'Küsi AI-lt prioriteedisoovitus', card: 'priority', focus: '[data-step="priority-propose"]', ai: true });
    add({ id: 'choose-priority', stage: 'prioriteedid', label: 'Vali alustamise lugu ise', card: 'priority', focus: '[data-step="priority-choose"]' });
  }
  if (nextKey === 'kriteeriumid' && !p.criteria && !p.mockup) {
    if (f.criteria === 0) add({ id: 'propose-criteria', stage: 'kriteeriumid', label: 'Küsi AI-lt kriteeriumid ja mockup', card: 'criteria', focus: '[data-step="criteria-propose"]', ai: true });
    else if (!f.mockup) add({ id: 'propose-mockup', stage: 'kriteeriumid', label: 'Küsi AI-lt mockup', card: 'criteria', focus: '[data-step="mockup-propose"]', ai: true });
  }
  if (nextKey === 'tapsustused' && !p.refinement) {
    add({ id: 'refine', stage: 'tapsustused', label: 'Sisesta kliendi täpsustus', card: 'refinement', focus: '#kliendi-tapsustus', ai: true, optional: true });
  }

  if (nextKey === 'groomimine' && !(f.review?.open > 0)) {
    add({ id: 'run-review', stage: 'groomimine', label: 'Vaata backlog üle', card: 'backlog', focus: '[data-step="review-run"]', ai: true });
  }

  // 4. Soovitatud etappi pole ja töövoog on läbitud (Groomimine või vähemalt Täpsustused tehtud): ainult valikulised sammud.
  if (!next && (done.groomimine || done.tapsustused)) {
    if (done.tapsustused && !p.refinement) add({ id: 'refine-again', stage: 'tapsustused', label: 'Sisesta uus kliendi täpsustus', card: 'refinement', focus: '#kliendi-tapsustus', ai: true, optional: true });
    if (done.groomimine) add({ id: 'view-backlog', stage: 'groomimine', label: "Vaata backlog'i uuesti üle", card: 'backlog', focus: '[data-step="review-run"]', ai: true, optional: true });
    if (f.stories > 1 && !p.priority) add({ id: 'choose-other', stage: 'prioriteedid', label: 'Vali teine alustamise lugu', card: 'priority', focus: '[data-step="priority-choose"]', optional: true });
  }

  // 5. Juba tehtud etapi ootel lisaettepanekud.
  for (const step of doneStagePending) add(step);

  const steps = all.slice(0, MAX_STEPS);
  const lastDone = lastDoneIndex >= 0 ? { key: STAGES[lastDoneIndex].key, label: STAGES[lastDoneIndex].label } : null;
  // Kõik etapid on läbitud (vahele jäetud etapid loevad läbituks).
  const allBuiltDone = !next && done.groomimine;

  // L13: iga nähtava AI väljundi kaardi lõpus 1–4 sammu – kõigepealt selle kaardi omad, siis üldised.
  // Nähtav AI väljund: uusim AI väljund, iga ootel AI ettepanek ja vestluse viimane AI sõnum.
  // Backlog'i ülevaatuse kaardil plokki ei ole (seal on leidude Rakenda/Muuda/Ignoreeri).
  const aiCards = new Set();
  if (f.latestAi && AI_OUTPUT_CARD[f.latestAi.kind]) aiCards.add(AI_OUTPUT_CARD[f.latestAi.kind]);
  if (f.conversationAiLast || !f.latestAi) aiCards.add('conversation');
  for (const [kind, on] of Object.entries(p)) if (on && AI_OUTPUT_CARD[kind]) aiCards.add(AI_OUTPUT_CARD[kind]);
  aiCards.delete('backlog');
  const stepsByCard = Object.fromEntries([...aiCards].map((card) => {
    const own = all.filter((x) => x.card === card);
    return [card, [...own, ...all.filter((x) => x.card !== card)].slice(0, MAX_STEPS)];
  }).filter(([, list]) => list.length > 0));
  return {
    stages,
    lastDone,
    next: next ? { key: next.key, label: next.label } : null,
    allBuiltDone,
    steps,
    stepsByCard,
    active: f.active && STAGE_KEYS.includes(f.active) ? f.active : null,
    skipped: [...skipped],
    storyCount: f.stories,
    latestAiCard: f.latestAi ? AI_OUTPUT_CARD[f.latestAi.kind] ?? null : null,
  };
}
