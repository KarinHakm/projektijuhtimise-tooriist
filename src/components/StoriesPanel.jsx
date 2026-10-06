import { useCallback, useEffect, useState } from 'react';
import { applyStories, getStories, proposeStories } from '../api.js';
import { buildApply, fromProposal, rejectStory, saveEdit, toggleChecked } from '../stories/selection.js';
import AiError from './AiError.jsx';
import AiWait from './AiWait.jsx';
import NoteField from './NoteField.jsx';
import StoriesProposal from './StoriesProposal.jsx';

const POLL_MS = 3000;

// Lood (L06): AI ettepanek kaartidena → kasutaja valik → backlog. rolesVersion muutub, kui rolle kinnitatakse, backlogVersion backlog'i muutusel.
// Backlog ise on eraldi paneelis (L07); onBacklogChanged annab sellele teada, et lugusid lisati.
export default function StoriesPanel({ projectId, rolesVersion, backlogVersion, onBacklogChanged }) {
  const [data, setData] = useState(null); // { stories, proposal, roles, aiRunning }
  const [loadError, setLoadError] = useState('');
  const [items, setItems] = useState([]);
  const [busy, setBusy] = useState(null); // 'propose' | 'replace' | 'apply-all' | 'apply-selected' | null
  const [aiError, setAiError] = useState(null); // esimese ettepaneku viga
  const [replaceError, setReplaceError] = useState(null); // "Paku teistsuguseid" viga
  const [error, setError] = useState('');

  const refresh = useCallback(async () => {
    try {
      setData(await getStories(projectId));
      setLoadError('');
    } catch (e) {
      setLoadError(e.message);
    }
  }, [projectId]);

  useEffect(() => { refresh(); }, [refresh, rolesVersion, backlogVersion]); // backlogVersion: nt tagasivõtmine taastas ettepaneku

  // Uus ettepanek → uus valikuloend. Sama ettepaneku puhul (nt ebaõnnestunud "Paku teistsuguseid")
  // jäävad kasutaja valikud alles.
  const proposalId = data?.proposal?.id;
  useEffect(() => {
    setItems(data?.proposal ? fromProposal(data.proposal) : []);
    setError('');
  }, [proposalId]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!data?.aiRunning || busy) return undefined;
    const timer = setTimeout(refresh, POLL_MS);
    return () => clearTimeout(timer);
  }, [data, busy, refresh]);

  // note = vabatekst (ootel ettepaneku korral asendab selle nagu „Paku teistsuguseid“); tagastab true, kui ettepanek tuli.
  async function propose(replace, note) {
    setBusy(replace ? 'replace' : 'propose');
    setAiError(null);
    setReplaceError(null);
    try {
      setData(await proposeStories(projectId, replace ? proposalId : undefined, note));
      return true;
    } catch (e) {
      if (e.code !== 'in_progress') (replace ? setReplaceError : setAiError)(e);
      if (e.code === 'stale_proposal') setReplaceError(null);
      await refresh();
      return false;
    } finally {
      setBusy(null);
    }
  }

  async function add(mode) {
    setBusy(mode === 'all' ? 'apply-all' : 'apply-selected');
    setError('');
    setReplaceError(null);
    try {
      setData(await applyStories(projectId, proposalId, buildApply(items, mode)));
      onBacklogChanged?.();
    } catch (e) {
      setError(e.message);
      if (e.code === 'already_decided' || e.code === 'not_found') await refresh();
    } finally {
      setBusy(null);
    }
  }

  function save(index, fields) {
    const result = saveEdit(items, index, fields, data.roles);
    if (result.items) setItems(result.items);
    return result;
  }

  if (loadError) return <p className="error">Lugusid ei saanud laadida: {loadError}</p>;
  if (!data) return <p className="muted">Laadin lugusid…</p>;

  const { stories, proposal, roles } = data;
  const waiting = busy === 'propose' || busy === 'replace' || data.aiRunning;

  return (
    <div className="stories">
      {proposal && (
        <StoriesProposal
          proposal={proposal}
          items={items}
          roles={roles}
          busy={busy}
          error={error}
          replaceError={replaceError}
          onToggle={(i) => setItems((all) => toggleChecked(all, i))}
          onReject={(i) => setItems((all) => rejectStory(all, i))}
          onSave={save}
          onAddAll={() => add('all')}
          onAddSelected={() => add('selected')}
          onReplace={() => propose(true)}
        />
      )}

      {!proposal && roles.length === 0 && <p className="muted">Lugusid saab pakkuda pärast rollide kinnitamist.</p>}
      {!proposal && roles.length > 0 && !waiting && (
        <button type="button" data-step="stories-propose" onClick={() => propose(false)} disabled={Boolean(busy)}>
          {stories.length ? 'Paku veel lugusid' : 'Paku lugusid'}
        </button>
      )}
      {roles.length > 0 && !waiting && (
        <NoteField card="stories" replaces={Boolean(proposal)} disabled={Boolean(busy)} onSend={(note) => propose(Boolean(proposal), note)} />
      )}
      {waiting && <AiWait label={busy === 'replace' ? 'AI koostab teistsuguseid lugusid' : 'AI koostab lugusid'} />}
      {!waiting && !proposal && aiError && <AiError error={aiError} onRetry={() => propose(false)} retrying={busy === 'propose'} />}
    </div>
  );
}
