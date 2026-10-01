// Kliendi täpsustuse eelvaade (L11) arvutatakse koodis: enne → pärast, mitte AI kirjelduse põhjal.
// Kooskõla vihjed on failis shared/consistency.js (L23).
// Ühine serverile ja brauserile.

const norm = (t) => String(t ?? '').replace(/\s+/g, ' ').trim();

// before = [{ text, origin? }], after = [{ from, text }]; from = varasema kriteeriumi indeks või -1 (uus).
// Tulemus: { items: [{ status, text, oldText? }], removed: [text] }.
// status: 'added' | 'modified' | 'unchanged'. Kui AI viitab kriteeriumile, aga tekst on sama, on see 'unchanged'.
export function diffCriteria(before, after) {
  const used = new Set();
  const items = after.map((c) => {
    if (c.from >= 0 && c.from < before.length && !used.has(c.from)) {
      used.add(c.from);
      const oldText = before[c.from].text;
      return norm(oldText) === norm(c.text) ? { status: 'unchanged', text: c.text } : { status: 'modified', text: c.text, oldText };
    }
    return { status: 'added', text: c.text };
  });
  const removed = before.filter((_, i) => !used.has(i)).map((c) => c.text);
  return { items, removed };
}

const componentKey = (c) => `${c.type}|${norm(c.text)}|${(c.items ?? []).map(norm).join(';')}`;

// Märgib uue mockup'i lisandunud komponendid ja vanast eemaldatud komponendid (võrdlus tüübi ja teksti järgi).
export function diffMockup(before, after) {
  const count = (list) => list.reduce((m, c) => m.set(componentKey(c), (m.get(componentKey(c)) ?? 0) + 1), new Map());
  const mark = (list, otherCounts) => {
    const left = new Map(otherCounts);
    return list.map((c) => {
      const k = componentKey(c);
      if ((left.get(k) ?? 0) > 0) { left.set(k, left.get(k) - 1); return false; }
      return true;
    });
  };
  const beforeList = before?.components ?? [];
  const afterList = after?.components ?? [];
  return { added: mark(afterList, count(beforeList)), removed: mark(beforeList, count(afterList)) };
}
