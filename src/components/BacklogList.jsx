import { useState } from 'react';
import { canMove } from '../backlog/order.js';
import StoryReadiness from './StoryReadiness.jsx';
import { ORIGIN_LABELS, STATUS_LABELS } from '../stories/selection.js';

// Backlog'i loend (L06, L07): järjekorranumber, pealkiri, staatus, suurus, päritolu ja ↑/↓ nupud.
// buttonRef(id, direction) annab nupu viite, et fookus jääks pärast tõstet samale nupule.
// L19/L20: loo all on avatav lahter „Valmisolek ja küsimused“ (kui andmetes on readiness).
// L17: mvpCount = mitu lugu on MVP joonest ülalpool (null = joont pole); onMvp(count, kind) muudab joont.
export default function BacklogList({
  stories, busy = false, highlightId = null, focusStoryId = null, onMove, buttonRef, readiness = null, initialOpenId = null,
  mvpCount = null, onMvp = null,
}) {
  const [openId, setOpenId] = useState(initialOpenId);
  if (stories.length === 0) return <p className="muted">Backlog on tühi.</p>;
  const hasLine = mvpCount !== null && mvpCount !== undefined;
  const mvpLine = hasLine && (
    <li key="mvp-line" className="mvp-line">
      <span className="mvp-line__label">MVP joon</span>
      <span className="mvp-line__hint">{mvpCount === 0 ? 'MVP-s lugusid pole' : `ülalpool ${mvpCount} lugu`}</span>
      {onMvp && (
        <span className="mvp-line__actions">
          <button type="button" className="icon-button" ref={buttonRef?.('mvp', 'up')} disabled={busy || mvpCount === 0}
            aria-label="Liiguta MVP joont ühe loo võrra üles" onClick={() => onMvp(mvpCount - 1, 'up')}>↑ Joon üles</button>
          <button type="button" className="icon-button" ref={buttonRef?.('mvp', 'down')} disabled={busy || mvpCount === stories.length}
            aria-label="Liiguta MVP joont ühe loo võrra alla" onClick={() => onMvp(mvpCount + 1, 'down')}>↓ Joon alla</button>
          <button type="button" className="icon-button" disabled={busy} onClick={() => onMvp(null, 'remove')}>Eemalda joon</button>
        </span>
      )}
    </li>
  );
  return (
    <>
    <ol className="backlog">
      {hasLine && mvpCount === 0 && mvpLine}
      {stories.map((s, i) => {
        const number = i + 1;
        const arrow = (direction, symbol, verb) => (
          <button
            type="button"
            className="icon-button"
            ref={buttonRef?.(s.id, direction)}
            disabled={busy || !canMove(i, stories.length, direction)}
            aria-label={`Tõsta lugu ${number} ${verb}: ${s.title}`}
            onClick={() => onMove(s.id, direction)}
          >
            {symbol}
          </button>
        );
        return [
          <li key={s.id} className={s.id === highlightId ? 'backlog__item backlog__item--moved' : 'backlog__item'}>
            <span className="backlog__number">{number}.</span>
            <div>
              <p className="backlog__title">
                {hasLine && i < mvpCount && <><span className="tag tag--mvp">MVP</span>{' '}</>}
                {s.id === focusStoryId && <><span className="tag tag--focus">Alustame sellest</span>{' '}</>}{s.title}
              </p>
              <p className="backlog__meta">
                Staatus: {s.readiness?.expired
                  ? <span className="backlog__expired">{STATUS_LABELS[s.status]} – valmisolek aegunud</span>
                  : STATUS_LABELS[s.status] ?? s.status} · Suurus: {s.size} · Päritolu: {ORIGIN_LABELS[s.origin] ?? s.origin}
                {s.questions?.some((q) => !q.resolvedAt) && <> · Avatud küsimusi: {s.questions.filter((q) => !q.resolvedAt).length}</>}
              </p>
              {s.readiness && readiness && (
                <button type="button" className="link-button" aria-expanded={openId === s.id} aria-controls={`loo-${s.id}-valmisolek`}
                  onClick={() => setOpenId(openId === s.id ? null : s.id)}>
                  {openId === s.id ? 'Peida' : 'Valmisolek ja küsimused'}
                  {s.readiness.ok ? ' (DoR ✓)' : ` (DoR puudu: ${s.readiness.checks.filter((c) => !c.ok).length})`}
                </button>
              )}
              {s.readiness && readiness && openId === s.id && (
                <StoryReadiness
                  story={s}
                  busy={busy}
                  error={readiness.errorFor === s.id ? readiness.error : ''}
                  onStatus={(status) => readiness.onStatus(s.id, status)}
                  onAddQuestion={(text) => readiness.onAddQuestion(s.id, text)}
                  onResolve={(questionId) => readiness.onResolve(s.id, questionId)}
                />
              )}
            </div>
            {onMove && (
              <div className="backlog__actions">
                {arrow('up', '↑', 'üles')}
                {arrow('down', '↓', 'alla')}
              </div>
            )}
          </li>,
          hasLine && mvpCount === i + 1 ? mvpLine : null,
        ];
      })}
    </ol>
    {!hasLine && onMvp && (
      <button type="button" className="secondary mvp-add" ref={buttonRef?.('mvp', 'add')} disabled={busy} onClick={() => onMvp(1, 'add')}>
        Lisa MVP joon
      </button>
    )}
    </>
  );
}
