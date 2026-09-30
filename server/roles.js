// Projekti kinnitatud rollid (L05). Siia jõuavad rollid ainult AI ettepaneku kinnitamisel.

export const ROLE_NAME_MAX = 40;
export const ROLES_MAX = 10;

// Tõstutundetu võti rollide võrdlemiseks (ka täpitähtedega, nt "Õpetaja" = "õpetaja").
export const roleKey = (name) => name.trim().toLocaleLowerCase('et');

export function listRoles(db, projectId) {
  return db
    .prepare('SELECT id, name, source, position FROM project_roles WHERE project_id = ? ORDER BY position')
    .all(projectId)
    .map((r) => ({ ...r }));
}

// Asendab projekti rollid. Kutsuda transaktsiooni sees (applyProposal).
export function replaceRoles(db, projectId, roles) {
  db.prepare('DELETE FROM project_roles WHERE project_id = ?').run(projectId);
  const insert = db.prepare('INSERT INTO project_roles (project_id, name, name_key, source, position) VALUES (?, ?, ?, ?, ?)');
  roles.forEach((r, i) => insert.run(projectId, r.name, roleKey(r.name), r.source, i + 1));
}

// Kontrollib kasutaja valitud rolle ettepaneku vastu. Tagastab { roles } või { error }.
// "ai" rollid peavad olema ettepanekus; "manual" rollid lisas kasutaja ise.
export function validateRoleSelection(raw, proposedRoles) {
  if (!Array.isArray(raw) || raw.length === 0) return { error: 'Vali või lisa vähemalt üks roll.' };
  if (raw.length > ROLES_MAX) return { error: `Rolle võib olla kuni ${ROLES_MAX}.` };
  const proposed = new Map(proposedRoles.map((r) => [roleKey(r.name), r.name]));
  const seen = new Set();
  const roles = [];
  for (const r of raw) {
    const name = typeof r?.name === 'string' ? r.name.trim() : '';
    if (!name) return { error: 'Rolli nimi ei tohi olla tühi.' };
    if (name.length > ROLE_NAME_MAX) return { error: `Rolli nimi võib olla kuni ${ROLE_NAME_MAX} märki.` };
    if (r.source !== 'ai' && r.source !== 'manual') return { error: 'Rolli päritolu on vigane.' };
    const key = roleKey(name);
    if (seen.has(key)) return { error: `Roll „${name}“ on topelt.` };
    if (r.source === 'ai' && !proposed.has(key)) return { error: `Rolli „${name}“ ei olnud AI ettepanekus.` };
    seen.add(key);
    roles.push({ name: r.source === 'ai' ? proposed.get(key) : name, source: r.source });
  }
  return { roles };
}

// Tagastab nimed, mis ei ole projekti kinnitatud rollide seas (kasutab L06 lugude kontroll).
export function unconfirmedRoles(db, projectId, names) {
  const confirmed = new Set(listRoles(db, projectId).map((r) => roleKey(r.name)));
  return names.filter((n) => !confirmed.has(roleKey(n)));
}
