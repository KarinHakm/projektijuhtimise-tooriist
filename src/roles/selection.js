// Rollide valiku loogika ilma Reactita (testitav Node'i testidega).
// Reeglid on samad mis serveris (server/roles.js): nimi 1–40 märki, kuni 10 rolli, kordusi ei tohi olla.

export const ROLE_NAME_MAX = 40;
export const ROLES_MAX = 10;

export const roleKey = (name) => name.trim().toLocaleLowerCase('et');

// AI ettepanekust valikuloend: kõik pakutud rollid on vaikimisi märgitud.
export function fromProposal(proposal) {
  return proposal.roles.map((r) => ({ key: roleKey(r.name), name: r.name, description: r.description, source: 'ai', checked: true }));
}

export const toggleRole = (items, key) => items.map((i) => (i.key === key ? { ...i, checked: !i.checked } : i));

export const removeRole = (items, key) => items.filter((i) => i.key !== key);

// Lisab käsitsi rolli. Tagastab { items } või { error }.
export function addManualRole(items, rawName) {
  const name = rawName.trim();
  if (!name) return { error: 'Kirjuta rolli nimi.' };
  if (name.length > ROLE_NAME_MAX) return { error: `Rolli nimi võib olla kuni ${ROLE_NAME_MAX} märki.` };
  const key = roleKey(name);
  if (items.some((i) => i.key === key)) return { error: `Roll „${name}“ on juba loendis.` };
  return { items: [...items, { key, name, description: '', source: 'manual', checked: true }] };
}

export const selectedCount = (items) => items.filter((i) => i.checked).length;

export const canConfirm = (items) => selectedCount(items) >= 1 && selectedCount(items) <= ROLES_MAX;

// Serverile saadetav kuju (POST roles/apply).
export const buildSelection = (items) => items.filter((i) => i.checked).map((i) => ({ name: i.name, source: i.source }));
