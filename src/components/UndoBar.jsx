import { useCallback, useEffect, useState } from 'react';
import { getUndo, undoLast } from '../api.js';

// L21: „Võta tagasi viimane muudatus“. Tagasi saab võtta kõik backlog'i muudatused: käsitsi ja AI ettepanekust tehtud
// lood, kriteeriumid, mockup'id, täpsustus, staatus, küsimused, MVP joon, alustamise lugu, jagamine ja ühendamine.
// Kirjet ei tee AI ettepaneku küsimine ega tagasilükkamine (need muudavad seisu, nii et varasemat muudatust enam tagasi ei võeta).
export function UndoView({ state, busy = false, error = '', notice = '', onUndo }) {
  if (!state) return null;
  return (
    <div className="undo-bar">
      <button type="button" className="secondary" disabled={busy || !state.available} onClick={onUndo}>↶ Võta tagasi viimane muudatus</button>
      {state.label && <span className="undo-bar__label">{state.label}</span>}
      {!state.available && state.reason && <p className="muted undo-bar__reason">{state.reason}</p>}
      {notice && <p className="notice" role="status">{notice}</p>}
      {error && <p className="error" role="alert">{error}</p>}
    </div>
  );
}

// onUndone: backlog muutus – teised paneelid (prioriteet, kriteeriumid) laadivad uuesti nagu teiste backlog'i toimingute järel.
export default function UndoBar({ projectId, onUndone }) {
  const [state, setState] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const refresh = useCallback(() => getUndo(projectId).then(setState).catch(() => setState(null)), [projectId]);
  useEffect(() => { refresh(); }, [refresh]);
  // Uus muudatus: eelmise tagasivõtmise teade on aegunud (oma tagasivõtmise teade pannakse pärast seda).
  useEffect(() => {
    const onChanged = () => { setNotice(''); refresh(); };
    window.addEventListener('pjt:changed', onChanged);
    return () => window.removeEventListener('pjt:changed', onChanged);
  }, [refresh]);
  async function onUndo() {
    setBusy(true);
    setError('');
    setNotice('');
    try {
      const res = await undoLast(projectId, state.at);
      setNotice(`Muudatus „${res.undone}“ võeti tagasi.`);
      onUndone?.();
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
      refresh();
    }
  }
  return <UndoView state={state} busy={busy} error={error} notice={notice} onUndo={onUndo} />;
}
