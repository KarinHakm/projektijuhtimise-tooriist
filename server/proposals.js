import { randomUUID } from 'node:crypto';

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

// Rakendab ettepaneku täpselt üks kord. apply(db, proposal) teeb backlog'i muudatused samas
// transaktsioonis; kui see viskab vea, jäävad nii andmed kui ettepaneku olek muutmata.
// Juba rakendatud või tagasi lükatud ettepaneku korral visatakse ProposalError('already_decided')
// ja apply't ei kutsuta.
export function applyProposal(db, id, apply) {
  return decide(db, id, 'applied', apply);
}

export function rejectProposal(db, id) {
  return decide(db, id, 'rejected');
}

function decide(db, id, status, apply) {
  db.exec('BEGIN IMMEDIATE');
  try {
    const proposal = getProposal(db, id);
    if (!proposal) throw new ProposalError('not_found');
    if (proposal.status !== 'pending') throw new ProposalError('already_decided');

    const result = apply ? apply(db, proposal) : undefined;

    const { changes } = db
      .prepare("UPDATE ai_proposals SET status = ?, decided_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now') WHERE id = ? AND status = 'pending'")
      .run(status, id);
    if (changes !== 1) throw new ProposalError('already_decided');

    db.exec('COMMIT');
    return { proposal: getProposal(db, id), result };
  } catch (err) {
    db.exec('ROLLBACK');
    throw err;
  }
}
