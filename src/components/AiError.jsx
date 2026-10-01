// AI päringu veateade koos nupuga „Proovi uuesti“. Teade tuleb serverist (eestikeelne, ohutu);
// kasutuslimiidi korral näidatakse ka ligikaudset ooteaega.
export default function AiError({ error, onRetry, retrying = false }) {
  if (!error) return null;
  const wait = error.code === 'usage_limit' && error.retryAfterSeconds
    ? ` Limiit vabaneb umbes ${Math.max(1, Math.round(error.retryAfterSeconds / 60))} min pärast.` : '';

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
