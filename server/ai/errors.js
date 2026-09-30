// AI-kihi vead. Kasutajale läheb alati ainult siin kirjas olev eestikeelne teade,
// mitte AI-teenuse toorvastus ega tehniline veatekst.

const ERRORS = {
  not_configured: { status: 503, message: 'AI ei ole serveris seadistatud. Käsitsi saad edasi töötada.' },
  auth_failed: { status: 502, message: 'AI-teenus keeldus ligipääsust. Kontrolli serveri AI seadistust.' },
  timeout: { status: 504, message: 'AI ei vastanud õigeaegselt. Proovi uuesti.' },
  rate_limited: { status: 429, message: 'AI-teenuse päringupiir on täis. Proovi umbes minuti pärast uuesti.' },
  unavailable: { status: 502, message: 'AI-teenus ei ole praegu kättesaadav. Käsitsi saad edasi töötada.' },
  invalid_response: { status: 502, message: 'AI vastus oli vigane. Proovi uuesti.' },
};

export class AiError extends Error {
  constructor(code, { retryAfterSeconds } = {}) {
    const def = ERRORS[code] ?? ERRORS.unavailable;
    super(def.message);
    this.name = 'AiError';
    this.code = ERRORS[code] ? code : 'unavailable';
    this.status = def.status;
    if (retryAfterSeconds != null) this.retryAfterSeconds = retryAfterSeconds;
  }
}

// HTTP-vastuse kuju, mille server brauserile saadab.
export function toHttpError(err) {
  const e = err instanceof AiError ? err : new AiError('unavailable');
  const body = { error: e.message, code: e.code };
  if (e.retryAfterSeconds != null) body.retryAfterSeconds = e.retryAfterSeconds;
  return { status: e.status, body };
}
