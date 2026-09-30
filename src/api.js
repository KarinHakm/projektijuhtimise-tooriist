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

const postJson = (path, body) => request(path, {
  method: 'POST',
  headers: { 'content-type': 'application/json' },
  body: JSON.stringify(body ?? {}),
});
const conversationPath = (projectId) => `/projects/${encodeURIComponent(projectId)}/conversation`;

export const getConversation = (projectId) => request(conversationPath(projectId));
export const sendIdea = (projectId, text) => postJson(`${conversationPath(projectId)}/idea`, { text });
export const sendAnswers = (projectId, questionsMessageId, answers) =>
  postJson(`${conversationPath(projectId)}/answers`, { questionsMessageId, answers });
export const continueConversation = (projectId) => postJson(`${conversationPath(projectId)}/continue`);

const rolesPath = (projectId) => `/projects/${encodeURIComponent(projectId)}/roles`;

export const getRoles = (projectId) => request(rolesPath(projectId));
export const proposeRoles = (projectId) => postJson(`${rolesPath(projectId)}/propose`);
export const applyRoles = (projectId, proposalId, roles) => postJson(`${rolesPath(projectId)}/apply`, { proposalId, roles });
export const rejectRoles = (projectId, proposalId) => postJson(`${rolesPath(projectId)}/reject`, { proposalId });

const storiesPath = (projectId) => `/projects/${encodeURIComponent(projectId)}/stories`;

export const getStories = (projectId) => request(storiesPath(projectId));
// replace = senise ettepaneku id ("Paku teistsuguseid"); server vahetab selle alles pärast uue edukat salvestamist.
export const proposeStories = (projectId, replace) => postJson(`${storiesPath(projectId)}/propose`, replace ? { replace } : {});
export const applyStories = (projectId, proposalId, stories) => postJson(`${storiesPath(projectId)}/apply`, { proposalId, stories });
