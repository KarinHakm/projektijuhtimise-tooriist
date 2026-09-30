import { useCallback, useEffect, useState } from 'react';
import { applyRoles, getRoles, proposeRoles, rejectRoles } from '../api.js';
import { addManualRole, buildSelection, fromProposal, removeRole, toggleRole } from '../roles/selection.js';
import AiError from './AiError.jsx';
import AiWait from './AiWait.jsx';
import RolesProposalCard from './RolesProposalCard.jsx';

const POLL_MS = 3000;

// Rollid (L05): AI ettepanek → kasutaja valik → "Kinnita rollid". Kinnitatud rollid on eraldi loendis.
// ready = vestlus on jõudnud kokkuvõtteni (rolle saab pakkuda alles siis).
export default function RolesPanel({ projectId, ready, onRolesChanged }) {
  const [data, setData] = useState(null); // { roles, proposal, aiRunning }
  const [loadError, setLoadError] = useState('');
  const [items, setItems] = useState([]);
  const [newRole, setNewRole] = useState('');
  const [addError, setAddError] = useState('');
  const [busy, setBusy] = useState(null); // 'propose' | 'apply' | 'reject' | null
  const [aiError, setAiError] = useState(null);
  const [error, setError] = useState('');

  const refresh = useCallback(async () => {
    try {
      setData(await getRoles(projectId));
      setLoadError('');
    } catch (e) {
      setLoadError(e.message);
    }
  }, [projectId]);

  useEffect(() => { refresh(); }, [refresh]);

  // Uus ettepanek → uus valikuloend (valikud on ainult brauseris kuni kinnitamiseni).
  const proposalId = data?.proposal?.id;
  useEffect(() => {
    setItems(data?.proposal ? fromProposal(data.proposal) : []);
    setNewRole('');
    setAddError('');
    setError('');
  }, [proposalId]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!data?.aiRunning || busy) return undefined;
    const timer = setTimeout(refresh, POLL_MS);
    return () => clearTimeout(timer);
  }, [data, busy, refresh]);

  async function propose() {
    setBusy('propose');
    setAiError(null);
    try {
      setData(await proposeRoles(projectId));
    } catch (e) {
      if (e.code !== 'in_progress') setAiError(e);
      await refresh();
    } finally {
      setBusy(null);
    }
  }

  async function decide(kind) {
    setBusy(kind);
    setError('');
    try {
      setData(kind === 'apply' ? await applyRoles(projectId, proposalId, buildSelection(items)) : await rejectRoles(projectId, proposalId));
      if (kind === 'apply') onRolesChanged?.();
    } catch (e) {
      setError(e.message);
      if (e.code === 'already_decided' || e.code === 'not_found') await refresh();
    } finally {
      setBusy(null);
    }
  }

  function add() {
    const result = addManualRole(items, newRole);
    if (result.error) {
      setAddError(result.error);
      return;
    }
    setItems(result.items);
    setNewRole('');
    setAddError('');
  }

  if (loadError) return <p className="error">Rolle ei saanud laadida: {loadError}</p>;
  if (!data) return <p className="muted">Laadin rolle…</p>;

  const { roles, proposal } = data;
  const waiting = busy === 'propose' || data.aiRunning;

  return (
    <div className="roles">
      <h3>Kinnitatud rollid</h3>
      {roles.length === 0 ? (
        <p className="muted">Rolle pole veel kinnitatud.</p>
      ) : (
        <ul className="confirmed-roles">
          {roles.map((r) => (
            <li key={r.id}>
              {r.name}
              {r.source === 'manual' && <span className="tag">käsitsi</span>}
            </li>
          ))}
        </ul>
      )}

      {proposal && (
        <RolesProposalCard
          message={proposal.message}
          items={items}
          newRole={newRole}
          addError={addError}
          error={error}
          busy={busy}
          onToggle={(key) => setItems((all) => toggleRole(all, key))}
          onRemove={(key) => setItems((all) => removeRole(all, key))}
          onNewRoleChange={setNewRole}
          onAdd={add}
          onConfirm={() => decide('apply')}
          onReject={() => decide('reject')}
        />
      )}

      {!proposal && !ready && <p className="muted">Rolle saab pakkuda pärast vestluse kokkuvõtet.</p>}
      {!proposal && ready && !waiting && (
        <button type="button" onClick={propose} disabled={Boolean(busy)}>
          {roles.length ? 'Paku rollid uuesti' : 'Paku rollid'}
        </button>
      )}
      {waiting && <AiWait label="AI koostab rolle" />}
      {!waiting && aiError && <AiError error={aiError} onRetry={propose} retrying={busy === 'propose'} />}
    </div>
  );
}
