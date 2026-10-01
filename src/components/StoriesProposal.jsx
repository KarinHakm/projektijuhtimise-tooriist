import { buildApply, visibleStories } from '../stories/selection.js';
import AiError from './AiError.jsx';
import StoryCard from './StoryCard.jsx';

// AI lugude ettepanek (ainult kuvamine; olek on StoriesPanel'is). Ettepanek on andmebaasis olekuga
// "pending"; backlog'i jõuavad lood alles nuppudega "Lisa kõik backlog'i" või "Lisa valitud".
// replaceError: ebaõnnestunud "Paku teistsuguseid" – senine ettepanek jääb nähtavaks ja kasutatavaks.
export default function StoriesProposal({
  proposal, items, roles, busy, error, replaceError,
  onToggle, onReject, onSave, onAddAll, onAddSelected, onReplace,
}) {
  const visible = visibleStories(items);
  const allCount = buildApply(items, 'all').length;
  const selectedCount = buildApply(items, 'selected').length;
  const rejectedCount = items.length - visible.length;
  const disabled = Boolean(busy);

  return (
    <section className="stories-proposal" aria-labelledby="stories-proposal-title">
      <h3 id="stories-proposal-title">
        {proposal.demo ? 'Näidisettepanek (käsitsi koostatud, mitte AI) – ei ole veel backlog\'is' : 'AI ettepanek – ei ole veel backlog\'is'}
      </h3>
      {proposal.message && <p>{proposal.message}</p>}
      <p className="muted">Lood on peamise rolli ({proposal.primaryRole}) põhitöövoo järjekorras.</p>

      <ol className="story-cards">
        {visible.map((item) => (
          <StoryCard
            key={item.index}
            item={item}
            number={item.index + 1}
            roles={roles}
            busy={disabled}
            onToggle={() => onToggle(item.index)}
            onReject={() => onReject(item.index)}
            onSave={(fields) => onSave(item.index, fields)}
          />
        ))}
      </ol>
      {rejectedCount > 0 && <p className="muted">Tagasi lükatud: {rejectedCount}. Neid backlog'i ei lisata.</p>}

      {error && <p className="error">{error}</p>}
      <div className="actions">
        <button type="button" onClick={onAddAll} disabled={disabled || allCount === 0}>
          {busy === 'apply-all' ? 'Lisan…' : `Lisa kõik backlog'i (${allCount})`}
        </button>
        <button type="button" onClick={onAddSelected} disabled={disabled || selectedCount === 0}>
          {busy === 'apply-selected' ? 'Lisan…' : `Lisa valitud (${selectedCount})`}
        </button>
        <button type="button" className="secondary" onClick={onReplace} disabled={disabled}>
          Paku teistsuguseid
        </button>
      </div>
      {replaceError && !busy && <AiError error={replaceError} onRetry={onReplace} />}
    </section>
  );
}
