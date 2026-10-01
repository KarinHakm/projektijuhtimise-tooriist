// AI-kihi vead. Kasutajale läheb alati ainult siin kirjas olev eestikeelne teade,
// mitte AI-teenuse toorvastus ega tehniline veatekst.

const ERRORS = {
  not_configured: { status: 503, message: 'AI ei ole serveris seadistatud. Käsitsi saad edasi töötada.' },
  timeout: { status: 504, message: 'AI ei vastanud õigeaegselt. Proovi uuesti.' },
  unavailable: { status: 502, message: 'AI-teenus ei ole praegu kättesaadav. Käsitsi saad edasi töötada.' },
  invalid_response: { status: 502, message: 'AI vastus oli vigane. Proovi uuesti.' },
  // Claude Code CLI (serveri arvutis sisse logitud kasutaja tellimus)
  cli_missing: { status: 503, message: 'Serveri arvutis ei leitud Claude Code\'i (käsk „claude“). Paigalda see ja logi sisse või kasuta AI-ta näidist. Käsitsi saad edasi töötada.' },
  not_logged_in: { status: 503, message: 'Claude Code ei ole serveri arvutis sisse logitud. Käivita terminalis „claude“, logi oma kontoga sisse ja proovi uuesti. Käsitsi saad edasi töötada.' },
  usage_limit: { status: 429, message: 'Claude\'i tellimuse kasutuslimiit on praegu täis. Proovi hiljem uuesti; käsitsi saad edasi töötada.' },
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
