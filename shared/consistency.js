// Kriteeriumide ja mockup'i kooskõla vihjed (L23), ühine serverile ja brauserile.
// NB: need on KONTROLLIMIST VAJAVAD HOIATUSED, mitte semantilised otsused. Kood võrdleb viiteid ja
// sõnatüvesid; ta ei tea, kas element tegelikult näitab seda, mida kriteerium nõuab.
//
// Kriteeriumi viide (ref): { kind: 'element' | 'no_view' | null, index, version, source: 'ai' | 'user' }.
// Hoiatuse kõrvaldab ainult KASUTAJA enda seos (source 'user'); AI seos või AI hinnang "ei puuduta vaadet"
// on nähtav, aga hoiatust ei kustuta.

// Üldsõnad, mis ei kirjelda konkreetset elementi (ainult siin ühes kohas).
export const STOP_WORDS = new Set([
  'kasutaja', 'kasutajale', 'näeb', 'näha', 'kuvatakse', 'kuvab', 'pärast', 'enne', 'juures', 'juurde', 'lehel', 'lehele',
  'vaates', 'olemas', 'saab', 'peab', 'vajutamist', 'vajutades', 'vajutab', 'klõpsab', 'sisestusväli', 'sisestusvälja',
  'väli', 'välja', 'väljal', 'nupp', 'nuppu', 'nupu', 'nupule', 'nupud', 'tekst', 'teksti', 'märge', 'märget', 'mille',
  'kõik', 'iga', 'ühe', 'kaks', 'kolm', 'selle', 'need', 'kus', 'kui', 'kas', 'või', 'ning', 'ja', 'ei', 'on', 'see',
]);
const BUTTON_WORDS = /\bnupp\w*|\bnupu\w*|\bnupud\w*/iu;
const INTERACTIVE = new Set(['button', 'input', 'list']);
const TYPE_LABELS = { heading: 'pealkiri', text: 'tekst', button: 'nupp', input: 'sisestusväli', list: 'loend', image: 'pilt', card: 'kaart' };

const words = (text) => String(text ?? '').toLocaleLowerCase('et').split(/[^\p{L}\p{N}-]+/u).filter(Boolean);
// Lihtne tüvi: pikemalt sõnalt lõigatakse lõpp (käänded), vähemalt 5 tähte jääb alles.
export const stem = (w) => (w.length <= 5 ? w : w.slice(0, Math.max(5, w.length - 3)));
export const contentStems = (text) => [...new Set(words(text).filter((w) => w.length >= 4 && !STOP_WORDS.has(w)).map(stem))];
const stemsMatch = (a, b) => a.startsWith(b) || b.startsWith(a);
const componentText = (c) => [c.text, ...(c.items ?? [])].join(' ');

export const componentLabel = (c, i) => `${i + 1}. ${TYPE_LABELS[c.type] ?? c.type}: ${c.text}`;

// criteria = [{ text, ref }], mockup = { version, components } | null
export function analyzeConsistency(criteria, mockup) {
  const components = mockup?.components ?? [];
  const componentStems = components.map((c) => contentStems(componentText(c)));
  const allStems = componentStems.flat();
  const linkedBy = components.map(() => []);

  const criteriaResult = criteria.map((c, ci) => {
    const ref = c.ref ?? {};
    const warnings = [];
    let link = null;
    const stale = ref.kind === 'element' && (!mockup || ref.version !== mockup.version || ref.index < 0 || ref.index >= components.length);
    if (ref.kind === 'element' && !stale) {
      link = { kind: 'element', index: ref.index, label: componentLabel(components[ref.index], ref.index), source: ref.source };
      linkedBy[ref.index].push(ci + 1);
    } else if (ref.kind === 'no_view') {
      link = { kind: 'no_view', label: 'ei puuduta vaadet', source: ref.source };
    }
    if (stale) warnings.push({ code: 'stale_ref', message: 'Viide on mõne teise mockup\'i versiooni elemendile – seo kriteerium uuesti.' });

    const userDecided = ref.source === 'user' && !stale && (ref.kind === 'element' || ref.kind === 'no_view');
    if (mockup && !userDecided) {
      const missing = contentStems(c.text).filter((s) => !allStems.some((m) => stemsMatch(s, m)));
      if (missing.length) {
        const shown = words(c.text).filter((w) => missing.includes(stem(w)) && !STOP_WORDS.has(w)).slice(0, 4);
        const note = ref.kind === 'no_view' ? ' AI hinnangul ei puuduta kriteerium vaadet – kinnita või seo ise.' : '';
        warnings.push({ code: 'no_match', message: `Pole vastet: sõnadele „${shown.join('“, „')}“ ei leitud mockup'is vastet.${note}` });
      }
    }
    // Nuppu nimetav kriteerium peab viitama nupule – välja arvatud juhul, kui kriteerium nimetab ka seotud elementi ennast
    // (nt "Pärast nupu vajutamist kuvatakse kinnitusteade" on õigesti seotud kinnitusteatega).
    if (link?.kind === 'element' && BUTTON_WORDS.test(c.text) && components[link.index].type !== 'button') {
      const namesLinked = contentStems(c.text).some((s) => componentStems[link.index].some((m) => stemsMatch(s, m)));
      if (!namesLinked) warnings.push({ code: 'button_type', message: 'Kriteerium nimetab nuppu, kuid on seotud elemendiga, mis ei ole nupp.' });
    }
    return { number: ci + 1, link, warnings };
  });

  const componentsResult = components.map((c, i) => {
    const warnings = [];
    const mentioned = criteria.some((cr) => contentStems(cr.text).some((s) => componentStems[i].some((m) => stemsMatch(s, m))));
    if (INTERACTIVE.has(c.type) && linkedBy[i].length === 0 && !mentioned) {
      warnings.push({ code: 'unjustified', message: 'Põhjendamata: ükski kriteerium ei viita sellele elemendile ega nimeta seda.' });
    }
    return { index: i, label: componentLabel(c, i), linkedBy: linkedBy[i], warnings };
  });

  const warningCount = criteriaResult.reduce((n, c) => n + c.warnings.length, 0) + componentsResult.reduce((n, c) => n + c.warnings.length, 0);
  return { criteria: criteriaResult, components: componentsResult, warningCount };
}

// Ülevaatuse kinnituse "sõrmejälg": muutub, kui kriteeriumid, viited või mockup'i versioon muutuvad.
export function reviewFingerprint(criteria, mockup) {
  return JSON.stringify({
    v: mockup?.version ?? null,
    c: criteria.map((c) => [c.text, c.ref?.kind ?? null, c.ref?.index ?? null, c.ref?.version ?? null]),
  });
}
