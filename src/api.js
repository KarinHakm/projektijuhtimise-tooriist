// Kõik päringud käivad oma serveri /api kaudu, mitte otse välistesse teenustesse.

export class ApiError extends Error {
  constructor(message, status, field, { code, retryAfterSeconds } = {}) {
    super(message);
    this.status = status;
    this.field = field;
    this.code = code;
    this.retryAfterSeconds = retryAfterSeconds;
  }
}

async function request(path, options) {
  let res;
  try {
    res = await fetch(`/api${path}`, options);
  } catch {
    throw new ApiError('Serveriga ei saa ühendust.', 0);
  }
  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new ApiError(body.error || `Viga (HTTP ${res.status})`, res.status, body.field, {
      code: body.code,
      retryAfterSeconds: body.retryAfterSeconds,
    });
  }
  return body;
}

export const getHealth = () => request('/health');
export const listProjects = () => request('/projects');
export const getProject = (id) => request(`/projects/${encodeURIComponent(id)}`);
export const createProject = (project) => request('/projects', {
  method: 'POST',
  headers: { 'content-type': 'application/json' },
  body: JSON.stringify(project),
});
