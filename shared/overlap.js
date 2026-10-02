// Võimaliku kattuvuse vihje (L28): kas jagamisel tekkiv lugu sarnaneb mõne olemasoleva looga.
// Ainult hoiatus, mitte keeld ega kindel tõend – võrreldakse sama rolli lugude tegevuse sõnu.
// Eesti keele käänete tõttu võrreldakse sõnade algusi (4 tähte: „hindu“ ja „hindadega“ → „hind“), lühikesi ja üldisi sõnu ei arvestata.
// Teadlik kompromiss: tõelised kordused tulevad välja, kuid sama algusega sõnad (nt „liik…“) võivad anda valehoiatuse.

// Sidesõnad ja üldised tegusõnad (näha, vaadata …), mis esinevad paljudes lugudes ega näita sisulist kattuvust.
const STOP = new Set(['ja', 'ning', 'või', 'et', 'oma', 'kõik', 'kõiki', 'mis', 'see', 'seda', 'kus', 'kui', 'ka', 'ühes', 'uusi', 'uued',
  'näha', 'vaadata', 'saada', 'saaksin', 'teha', 'lisada', 'muuta', 'kasutada', 'nende', 'koos', 'selle', 'need', 'pärast', 'enne']);
const STEM = 4;
export const OVERLAP_MIN = 0.5;

const stems = (text) => new Set(String(text ?? '').toLocaleLowerCase('et').split(/[^\p{L}\p{N}]+/u)
  .filter((w) => w.length >= 3 && !STOP.has(w)).map((w) => w.slice(0, STEM)));

export function overlapScore(a, b) {
  const x = stems(a);
  const y = stems(b);
  if (!x.size || !y.size) return 0;
  // Ühiste sõnade osa lühemast tegevusest. Üks ühine sõna (nt „liik…“) ei piisa, välja arvatud siis, kui lühemas
  // tegevuses ongi ainult üks sisuline sõna – muidu annaks iga sama algusega sõna valehoiatuse.
  const common = [...x].filter((w) => y.has(w)).length;
  const shorter = Math.min(x.size, y.size);
  if (common < Math.min(2, shorter)) return 0;
  return common / shorter;
}

// part = { role, want }, stories = backlog'i lood ({ id, role, want }), excludeIds = jagatav lugu ise.
// Tagastab [{ id, number }] – number on loo koht backlog'is (1-põhine).
export function findOverlaps(part, stories, excludeIds = []) {
  if (!part?.want?.trim()) return [];
  return stories
    .map((s, i) => ({ s, number: i + 1 }))
    .filter(({ s }) => !excludeIds.includes(s.id) && s.role === part.role && overlapScore(part.want, s.want) >= OVERLAP_MIN)
    .map(({ s, number }) => ({ id: s.id, number }));
}
