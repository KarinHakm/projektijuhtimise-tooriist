// Vestluse vaate loogika ilma Reactita, et seda saaks testida Node'i testidega.

export const emptyDraft = () => ({ selected: [], otherOpen: false, other: '', skipped: false });

// Variandi valimine. Üksikvalikus asendab valik eelmise (ja sulgeb "Muu"); mitmikvalikus lülitab.
export function toggleOption(question, draft, option) {
  if (!question.multiSelect) {
    const same = draft.selected.length === 1 && draft.selected[0] === option;
    return { selected: same ? [] : [option], otherOpen: false, other: '', skipped: false };
  }
  const selected = draft.selected.includes(option) ? draft.selected.filter((o) => o !== option) : [...draft.selected, option];
  return { ...draft, selected, skipped: false };
}

// "Muu (kirjutan ise)". Üksikvalikus tühistab see teised valikud.
export function toggleOther(question, draft) {
  const otherOpen = !draft.otherOpen;
  return {
    selected: otherOpen && !question.multiSelect ? [] : draft.selected,
    otherOpen,
    other: otherOpen ? draft.other : '',
    skipped: false,
  };
}

export const setOther = (draft, other) => ({ ...draft, other });

// "Jäta vahele" tühistab kõik valikud; uuesti vajutamine võtab vahelejätmise tagasi.
export const toggleSkip = (draft) => (draft.skipped ? emptyDraft() : { ...emptyDraft(), skipped: true });

export function isAnswered(draft) {
  return draft.skipped || draft.selected.length > 0 || (draft.otherOpen && draft.other.trim().length > 0);
}

export const allAnswered = (questions, drafts) => questions.every((q) => isAnswered(drafts[q.id] ?? emptyDraft()));

// Serverile saadetav kuju. Valikud on samas järjekorras kui küsimuse variandid.
export function buildAnswers(questions, drafts) {
  return questions.map((q) => {
    const d = drafts[q.id] ?? emptyDraft();
    if (d.skipped) return { questionId: q.id, selected: [], other: null, skipped: true };
    const other = d.otherOpen && d.other.trim() ? d.other.trim() : null;
    return { questionId: q.id, selected: q.options.filter((o) => d.selected.includes(o)), other, skipped: false };
  });
}

// Vestluse olek viimase sõnumi järgi:
// empty – idee sisestamata; waiting – AI töötab; unanswered – AI vastus jäi saamata;
// questions – ootab kasutaja vastuseid; done – kokkuvõte olemas.
export function conversationPhase(messages, aiRunning) {
  const last = messages.at(-1);
  if (!last) return 'empty';
  if (last.role === 'user') return aiRunning ? 'waiting' : 'unanswered';
  if (last.kind === 'questions') return 'questions';
  return 'done';
}

// Vastuse inimloetav kuju vestluse ajaloos.
export function describeAnswer(question, answer) {
  if (answer.skipped) return 'jäetud vahele';
  const parts = [...answer.selected];
  if (answer.other) parts.push(`muu: ${answer.other}`);
  return parts.join(', ');
}
