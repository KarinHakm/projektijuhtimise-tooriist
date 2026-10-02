import { useCallback, useEffect, useState } from 'react';
import { getUndo, undoLast } from '../api.js';

// L21: „Võta tagasi viimane toetatud muudatus“. Toetatud on käsitsi loo- ja kriteeriumimuudatused, kattuvusmärked,
// jagamine ja ühendamine ning uue vaate lisamine; muid toiminguid (nt küsimused, AI ettepaneku tagasilükkamine) mitte.
export function UndoView({ state, busy = false, error = '', notice = '', onUndo }) {
  if (!state) return null;
  return (
    <div className="undo-bar">
      <button type="button" className="secondary" disabled={busy || !state.available} onClick={onUndo}>↶ Võta tagasi viimane toetatud muudatus</button>
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
  useEffect(() => {
    window.addEventListener('pjt:changed', refresh);
    return () => window.removeEventListener('pjt:changed', refresh);
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
