// AI päringu veateade koos nupuga „Proovi uuesti“. Teade tuleb serverist (eestikeelne, ohutu);
// päringupiiri korral näidatakse ka soovituslikku ooteaega.
export default function AiError({ error, onRetry, retrying = false }) {
  if (!error) return null;
  const wait = error.code === 'rate_limited' && error.retryAfterSeconds ? ` Oota umbes ${error.retryAfterSeconds} s.` : '';

  return (
    <div className="ai-error" role="alert">
      <p>{error.message}{wait}</p>
      {onRetry && (
        <button type="button" onClick={onRetry} disabled={retrying}>
          {retrying ? 'Proovin uuesti…' : 'Proovi uuesti'}
        </button>
      )}
    </div>
  );
}
