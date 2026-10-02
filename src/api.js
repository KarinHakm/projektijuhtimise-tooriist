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
  // Muutev päring (ka ebaõnnestunud – osa andmeid võis salvestuda): projekti vaade laadib etapi ja järgmised sammud uuesti (L13, L14).
  if (options?.method && options.method !== 'GET' && typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('pjt:changed'));
  }
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
const priorityPath = (projectId) => `/projects/${encodeURIComponent(projectId)}/priority`;

// Prioriteet (L08): AI soovitus, millest alustada; kinnitamine või oma valik.
export const getPriority = (projectId) => request(priorityPath(projectId));
export const proposePriority = (projectId) => postJson(`${priorityPath(projectId)}/propose`);
export const acceptPriority = (projectId, proposalId) => postJson(`${priorityPath(projectId)}/accept`, { proposalId });
export const choosePriority = (projectId, storyId) => postJson(`${priorityPath(projectId)}/choose`, { storyId });

const criteriaPath = (projectId) => `/projects/${encodeURIComponent(projectId)}/criteria`;

// Kriteeriumid ja mockup alustamise loole (L09, L10).
export const getCriteria = (projectId) => request(criteriaPath(projectId));
export const proposeCriteria = (projectId) => postJson(`${criteriaPath(projectId)}/propose`);
export const applyCriteria = (projectId, proposalId, criteria) => postJson(`${criteriaPath(projectId)}/apply`, { proposalId, criteria });
export const acceptMockup = (projectId, proposalId) => postJson(`${criteriaPath(projectId)}/mockup/accept`, { proposalId });
export const rejectMockup = (projectId, proposalId) => postJson(`${criteriaPath(projectId)}/mockup/reject`, { proposalId });
export const proposeMockup = (projectId) => postJson(`${criteriaPath(projectId)}/mockup/propose`);
// L22: varasema mockup'i versiooni taastamine uue versioonina.
export const restoreMockupVersion = (projectId, storyId, version) => postJson(`${criteriaPath(projectId)}/mockup/restore`, { storyId, version });
// Kooskõla (L23): kriteeriumi käsitsi sidumine ja kasutaja ülevaatuse kinnitus.
export const linkCriterion = (projectId, criterionId, kind, index) => postJson(`${criteriaPath(projectId)}/link`, { criterionId, kind, index });
export const reviewConsistency = (projectId, storyId, fingerprint) => postJson(`${criteriaPath(projectId)}/review`, { storyId, fingerprint });

const refinementPath = (projectId) => `/projects/${encodeURIComponent(projectId)}/refinement`;

// Kliendi täpsustus (L11, L12). storyId valib täpsustatava loo; vaikimisi alustamise lugu.
export const getRefinement = (projectId, storyId) =>
  request(`${refinementPath(projectId)}${storyId ? `?storyId=${encodeURIComponent(storyId)}` : ''}`);
export const proposeRefinement = (projectId, storyId, clarification) => postJson(`${refinementPath(projectId)}/propose`, { storyId, clarification });
export const applyRefinement = (projectId, proposalId, storyId, changes) =>
  postJson(`${refinementPath(projectId)}/apply`, changes ? { proposalId, storyId, changes } : { proposalId, storyId });
export const rejectRefinement = (projectId, proposalId) => postJson(`${refinementPath(projectId)}/reject`, { proposalId });

// direction = 'up' | 'down'; vastuses on uus järjekord (L07).
export const moveStory = (projectId, storyId, direction) =>
  postJson(`${storiesPath(projectId)}/${encodeURIComponent(storyId)}/move`, { direction });

export const getStage = (projectId) => request(`/projects/${encodeURIComponent(projectId)}/stage`);
// L14: etapi vahelejätmine ja aktiivne etapp (ka tagasiminek). Ei muuda backlog'i ega kutsu AI-d.
export const skipStage = (projectId, key) => postJson(`/projects/${encodeURIComponent(projectId)}/stage/skip`, { key });
export const setActiveStage = (projectId, key) => postJson(`/projects/${encodeURIComponent(projectId)}/stage/active`, { key });

// L19/L20: loo staatus ja avatud küsimused.
export const setStoryStatus = (projectId, storyId, status) =>
  postJson(`${storiesPath(projectId)}/${encodeURIComponent(storyId)}/status`, { status });
export const addStoryQuestion = (projectId, storyId, text) =>
  postJson(`${storiesPath(projectId)}/${encodeURIComponent(storyId)}/questions`, { text });
export const resolveStoryQuestion = (projectId, storyId, questionId) =>
  postJson(`${storiesPath(projectId)}/${encodeURIComponent(storyId)}/questions/${encodeURIComponent(questionId)}/resolve`, {});
// L17: MVP joon (count = mitu lugu on joonest ülalpool; null eemaldab joone).
export const setMvpLine = (projectId, count) => postJson(`${storiesPath(projectId)}/mvp`, { count });
// L15: lugude käsitsi haldus.
const sendJson = (method) => (path, body) => request(path, { method, headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });
export const createStory = (projectId, story) => postJson(storiesPath(projectId), story);
export const updateStory = (projectId, storyId, story) => sendJson('PUT')(`${storiesPath(projectId)}/${encodeURIComponent(storyId)}`, story);
export const getDeleteImpact = (projectId, storyId) => request(`${storiesPath(projectId)}/${encodeURIComponent(storyId)}/delete-impact`);
export const deleteStory = (projectId, storyId) => request(`${storiesPath(projectId)}/${encodeURIComponent(storyId)}`, { method: 'DELETE' });
// L25: loo käsitsi jagamine kaheks.
export const getSplitInfo = (projectId, storyId) => request(`${storiesPath(projectId)}/${encodeURIComponent(storyId)}/split-info`);
export const splitStoryInTwo = (projectId, storyId, body) => postJson(`${storiesPath(projectId)}/${encodeURIComponent(storyId)}/split`, body);
// L26: kahe loo käsitsi ühendamine (keepId säilib, removeId andmed viiakse üle).
export const getMergeInfo = (projectId, keepId, removeId) => request(`${storiesPath(projectId)}/${encodeURIComponent(keepId)}/merge-info?with=${encodeURIComponent(removeId)}`);
export const mergeStoriesInto = (projectId, keepId, body) => postJson(`${storiesPath(projectId)}/${encodeURIComponent(keepId)}/merge`, body);
// L27: backlog'i ülevaatus. value (valikuline) = „Muuda“ järel kasutaja muudetud väärtus.
const reviewPath = (projectId) => `/projects/${encodeURIComponent(projectId)}/review`;
export const getReview = (projectId) => request(reviewPath(projectId));
export const runReview = (projectId) => postJson(`${reviewPath(projectId)}/run`, {});
export const applyFinding = (projectId, findingId, value) =>
  postJson(`${reviewPath(projectId)}/findings/${encodeURIComponent(findingId)}/apply`, value === undefined ? {} : { value });
export const ignoreFinding = (projectId, findingId) => postJson(`${reviewPath(projectId)}/findings/${encodeURIComponent(findingId)}/ignore`, {});
export const undoFinding = (projectId, findingId) => postJson(`${reviewPath(projectId)}/findings/${encodeURIComponent(findingId)}/undo`, {});
