import { canConfirm, ROLE_NAME_MAX, ROLES_MAX, selectedCount } from '../roles/selection.js';

// AI rollide ettepanek (ainult kuvamine; olek on RolesPanel'is). Ettepanek on andmebaasis
// olekuga "pending"; kinnitatud rollideks saab see alles nupuga "Kinnita rollid".
export default function RolesProposalCard({
  message, items, newRole, addError, error, busy, onToggle, onRemove, onNewRoleChange, onAdd, onConfirm, onReject,
}) {
  const count = selectedCount(items);
  return (
    <section className="roles-proposal" aria-labelledby="roles-proposal-title">
      <h3 id="roles-proposal-title">AI ettepanek – ei ole veel kinnitatud</h3>
      {message && <p>{message}</p>}

      <ul className="roles-list">
        {items.map((item) => (
          <li key={item.key} className="role-item">
            <label className="role-item__label">
              <input type="checkbox" checked={item.checked} onChange={() => onToggle(item.key)} disabled={Boolean(busy)} />
              <span>
                <strong>{item.name}</strong>
                {item.source === 'manual' && <span className="tag">käsitsi</span>}
                {item.description && <span className="muted"> – {item.description}</span>}
              </span>
            </label>
            <button type="button" className="icon-button" onClick={() => onRemove(item.key)} disabled={Boolean(busy)} aria-label={`Eemalda roll ${item.name}`}>
              ✕
            </button>
          </li>
        ))}
      </ul>

      <form
        className="role-add"
        onSubmit={(e) => {
          e.preventDefault();
          onAdd();
        }}
      >
        <label htmlFor="new-role" className="visually-hidden">Lisa oma roll</label>
        <input
          id="new-role"
          placeholder="Lisa oma roll, nt Treener"
          maxLength={ROLE_NAME_MAX}
          value={newRole}
          onChange={(e) => onNewRoleChange(e.target.value)}
          disabled={Boolean(busy)}
          aria-invalid={Boolean(addError)}
        />
        <button type="submit" disabled={Boolean(busy)}>Lisa</button>
      </form>
      {addError && <p className="error">{addError}</p>}

      {error && <p className="error">{error}</p>}
      <div className="actions">
        <button type="button" onClick={onConfirm} disabled={Boolean(busy) || !canConfirm(items)}>
          {busy === 'apply' ? 'Kinnitan…' : 'Kinnita rollid'}
        </button>
        <button type="button" className="secondary" onClick={onReject} disabled={Boolean(busy)}>
          Loobu
        </button>
      </div>
      <p className="muted">
        Valitud {count} rolli{count > ROLES_MAX ? ` – lubatud on kuni ${ROLES_MAX}` : ''}.{count === 0 ? ' Vali vähemalt üks roll.' : ''}
      </p>
    </section>
  );
}
