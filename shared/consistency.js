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

// criteria = [{ text, ref }], mockups = { version, components } | null (üks vaade) või vaadete loend
// [{ viewNo, version, components }] (L22). Element-seos kehtib, kui see viitab oma vaate uusimale versioonile;
// „pole vastet“ otsitakse kõigi vaadete elementidest. Tulemuse `components` on vaate 1 (või ainsa vaate) elemendid,
// `views` kõigi vaadete elemendid. Ühe vaatega on tulemus sama mis enne L22.
export function analyzeConsistency(criteria, mockups) {
  const views = (Array.isArray(mockups) ? mockups : mockups ? [{ viewNo: 1, ...mockups }] : [])
    .map((v) => ({ ...v, viewNo: v.viewNo ?? 1, components: v.components ?? [] }));
  const multi = views.length > 1;
  const stemsOf = views.map((v) => v.components.map((c) => contentStems(componentText(c))));
  const allStems = stemsOf.flat(2);
  const linkedBy = views.map((v) => v.components.map(() => []));
  const prefix = (v) => (multi ? `Vaade ${v.viewNo} · ` : '');

  const criteriaResult = criteria.map((c, ci) => {
    const ref = c.ref ?? {};
    const warnings = [];
    let link = null;
    const vi = ref.kind === 'element' ? views.findIndex((v) => v.version === ref.version) : -1;
    const view = vi >= 0 ? views[vi] : null;
    const stale = ref.kind === 'element' && (!view || ref.index < 0 || ref.index >= view.components.length);
    if (ref.kind === 'element' && !stale) {
      link = { kind: 'element', index: ref.index, ...(multi ? { viewNo: view.viewNo } : {}), label: prefix(view) + componentLabel(view.components[ref.index], ref.index), source: ref.source };
      linkedBy[vi][ref.index].push(ci + 1);
    } else if (ref.kind === 'no_view') {
      link = { kind: 'no_view', label: 'ei puuduta vaadet', source: ref.source };
    }
    if (stale) warnings.push({ code: 'stale_ref', message: 'Viide on mõne teise mockup\'i versiooni elemendile – seo kriteerium uuesti.' });

    const userDecided = ref.source === 'user' && !stale && (ref.kind === 'element' || ref.kind === 'no_view');
    if (views.length && !userDecided) {
      const missing = contentStems(c.text).filter((s) => !allStems.some((m) => stemsMatch(s, m)));
      if (missing.length) {
        const shown = words(c.text).filter((w) => missing.includes(stem(w)) && !STOP_WORDS.has(w)).slice(0, 4);
        const note = ref.kind === 'no_view' ? ' AI hinnangul ei puuduta kriteerium vaadet – kinnita või seo ise.' : '';
        warnings.push({ code: 'no_match', message: `Pole vastet: sõnadele „${shown.join('“, „')}“ ei leitud mockup'is vastet.${note}` });
      }
    }
    // Nuppu nimetav kriteerium peab viitama nupule – välja arvatud juhul, kui kriteerium nimetab ka seotud elementi ennast
    // (nt "Pärast nupu vajutamist kuvatakse kinnitusteade" on õigesti seotud kinnitusteatega).
    const linked = link?.kind === 'element' ? view.components[link.index] : null;
    const namesLinked = linked && contentStems(c.text).some((s) => stemsOf[vi][link.index].some((m) => stemsMatch(s, m)));
    if (linked && BUTTON_WORDS.test(c.text) && linked.type !== 'button' && !namesLinked) {
      warnings.push({ code: 'button_type', message: 'Kriteerium nimetab nuppu, kuid on seotud elemendiga, mis ei ole nupp.' });
    }
    // Võimalik probleem: AI seos elemendiga, mida kriteerium ei nimeta (nt "E-posti aadress" → nupp "Esita taotlus").
    // Kasutaja enda seosele seda ei rakendata – see on inimese otsus.
    if (linked && ref.source !== 'user' && !namesLinked && !warnings.some((w) => w.code === 'button_type')) {
      warnings.push({ code: 'ai_link_unnamed', message: `Võimalik probleem: AI seos – kriteerium ei nimeta seotud elementi „${linked.text}“. Kontrolli, kas seos on õige.` });
    }
    return { number: ci + 1, link, warnings };
  });

  const viewsResult = views.map((v, vi) => ({
    viewNo: v.viewNo,
    version: v.version,
    components: v.components.map((c, i) => {
      const warnings = [];
      const mentioned = criteria.some((cr) => contentStems(cr.text).some((s) => stemsOf[vi][i].some((m) => stemsMatch(s, m))));
      if (INTERACTIVE.has(c.type) && linkedBy[vi][i].length === 0 && !mentioned) {
        warnings.push({ code: 'unjustified', message: 'Põhjendamata: ükski kriteerium ei viita sellele elemendile ega nimeta seda.' });
      }
      return { index: i, label: componentLabel(c, i), linkedBy: linkedBy[vi][i], warnings };
    }),
  }));
  const primary = viewsResult.find((v) => v.viewNo === 1) ?? viewsResult[0];
  const components = primary?.components ?? [];

  const warningCount = criteriaResult.reduce((n, c) => n + c.warnings.length, 0)
    + viewsResult.reduce((n, v) => n + v.components.reduce((m, c) => m + c.warnings.length, 0), 0);
  return { criteria: criteriaResult, components, views: viewsResult, warningCount };
}

// Ülevaatuse kinnituse "sõrmejälg": muutub, kui kriteeriumid, viited (ka nende allikas AI/kasutaja) või
// mockup'i versioon muutuvad. Nii aegub ülevaatus ka siis, kui kasutaja kinnitab AI pakutud seose.
// L22: mitme vaate korral on v kõigi vaadete versioonid (ühe vaatega sama kuju mis enne – varasemad ülevaatused ei aegu).
export function reviewFingerprint(criteria, mockups) {
  return JSON.stringify({
    v: Array.isArray(mockups) ? mockups.map((m) => m.version) : mockups?.version ?? null,
    c: criteria.map((c) => [c.text, c.ref?.kind ?? null, c.ref?.index ?? null, c.ref?.version ?? null, c.ref?.source ?? null]),
  });
}
