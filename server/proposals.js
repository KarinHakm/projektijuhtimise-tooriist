import { randomUUID } from 'node:crypto';
import { txBegin, txCommit, txRollback } from './db.js';

// AI ettepanekute salvestus ja ühekordne rakendamine.
// Ettepanek salvestatakse olekuga 'pending'; backlog muutub alles siis, kui inimene selle rakendab.

export class ProposalError extends Error {
  constructor(code) {
    const defs = {
      not_found: [404, 'Ettepanekut ei leitud.'],
      already_decided: [409, 'See ettepanek on juba rakendatud või tagasi lükatud.'],
    };
    const [status, message] = defs[code];
    super(message);
    this.name = 'ProposalError';
    this.code = code;
    this.status = status;
  }
}

const COLUMNS = 'id, project_id AS projectId, kind, payload, status, created_at AS createdAt, decided_at AS decidedAt';

function toProposal(row) {
  return row ? { ...row, payload: JSON.parse(row.payload) } : undefined;
}

export function createProposal(db, { projectId, kind, payload }) {
  const row = db
    .prepare(`INSERT INTO ai_proposals (id, project_id, kind, payload) VALUES (?, ?, ?, ?) RETURNING ${COLUMNS}`)
    .get(randomUUID(), projectId, kind, JSON.stringify(payload));
  return toProposal(row);
}

export function getProposal(db, id) {
  return toProposal(db.prepare(`SELECT ${COLUMNS} FROM ai_proposals WHERE id = ?`).get(id));
}

// Projekti viimane pooleli (pending) ettepanek antud liigist või undefined.
export function findPendingProposal(db, projectId, kind) {
  return toProposal(
    db.prepare(`SELECT ${COLUMNS} FROM ai_proposals WHERE project_id = ? AND kind = ? AND status = 'pending' ORDER BY created_at DESC, rowid DESC LIMIT 1`)
      .get(projectId, kind),
  );
}

// Rakendab ettepaneku täpselt üks kord. apply(db, proposal) teeb backlog'i muudatused samas
// transaktsioonis; kui see viskab vea, jäävad nii andmed kui ettepaneku olek muutmata.
// Juba rakendatud või tagasi lükatud ettepaneku korral visatakse ProposalError('already_decided')
// ja apply't ei kutsuta. expect = { projectId, kind } kontrollib, et ettepanek kuulub õigele
// projektile ja on õiget liiki (muidu 'not_found').
export function applyProposal(db, id, apply, expect) {
  return decide(db, id, 'applied', apply, expect);
}

// Vabatekst: uus ettepanek asendab sama liigi ootel ettepaneku. Vana lükatakse tagasi (mitte ei rakendata).
// Kutsuda samas transaktsioonis uue ettepaneku loomisega.
export function rejectPending(db, projectId, kind) {
  db.prepare("UPDATE ai_proposals SET status = 'rejected', decided_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now') WHERE project_id = ? AND kind = ? AND status = 'pending'")
    .run(projectId, kind);
}

export function rejectProposal(db, id, expect) {
  return decide(db, id, 'rejected', undefined, expect);
}

function decide(db, id, status, apply, expect = {}) {
  const sp = txBegin(db);
  try {
    const proposal = getProposal(db, id);
    if (!proposal) throw new ProposalError('not_found');
    if (expect.projectId != null && proposal.projectId !== expect.projectId) throw new ProposalError('not_found');
    if (expect.kind != null && proposal.kind !== expect.kind) throw new ProposalError('not_found');
    if (proposal.status !== 'pending') throw new ProposalError('already_decided');

    const result = apply ? apply(db, proposal) : undefined;

    const { changes } = db
      .prepare("UPDATE ai_proposals SET status = ?, decided_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now') WHERE id = ? AND status = 'pending'")
      .run(status, id);
    if (changes !== 1) throw new ProposalError('already_decided');

    txCommit(db, sp);
    return { proposal: getProposal(db, id), result };
  } catch (err) {
    txRollback(db, sp);
    throw err;
  }
}
