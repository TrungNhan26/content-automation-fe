// Thin fetch wrapper for the local API. Errors surface the server's Vietnamese message.

async function request(method, url, body) {
  const res = await fetch(url, {
    method,
    headers: body instanceof FormData || body === undefined ? undefined : { 'Content-Type': 'application/json' },
    body: body instanceof FormData ? body : body === undefined ? undefined : JSON.stringify(body),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(typeof data.detail === 'string' ? data.detail : data.error || `Lỗi ${res.status}`);
  return data;
}

const uploadFile = (url, file) => {
  const form = new FormData();
  form.append('file', file);
  return request('POST', url, form);
};

export const api = {
  getSettings: () => request('GET', '/api/v1/story/settings'),
  saveSettings: (s) => request('PUT', '/api/v1/story/settings', s),
  listModels: () => request('GET', '/api/v1/story/models'),

  listCharacters: () => request('GET', '/api/v1/story/characters'),
  saveCharacters: (list) => request('PUT', '/api/v1/story/characters', list),
  uploadCharacterImage: (file) => uploadFile('/api/v1/story/characters/images', file),

  listProjects: () => request('GET', '/api/v1/story/projects'),
  createProject: (data) => request('POST', '/api/v1/story/projects', data),
  getProject: (id) => request('GET', `/api/v1/story/projects/${id}`),
  saveProject: (p) => request('PUT', `/api/v1/story/projects/${p.id}`, p),
  deleteProject: (id) => request('DELETE', `/api/v1/story/projects/${id}`),

  generateFrames: (id, body) => request('POST', `/api/v1/story/projects/${id}/slides/script`, body),
  planStory: (id, body) => request('POST', `/api/v1/story/projects/${id}/story/plan`, body),
  placeBubbles: (id, body) => request('POST', `/api/v1/story/projects/${id}/frames/bubbles`, body),
  generateImage: (id, body) => request('POST', `/api/v1/story/projects/${id}/images/generate`, body),
  uploadPanelImage: (id, file) => uploadFile(`/api/v1/story/projects/${id}/images/upload`, file),
  generateCaption: (id, body) => request('POST', `/api/v1/story/projects/${id}/caption`, body),

  sendToAutopost: (id, body) => request('POST', `/api/v1/story/projects/${id}/autopost`, body),
  saveRenderedSlides: (id, blobs) => {
    const form = new FormData();
    blobs.forEach((blob, i) => form.append('files', blob, `slide-${i + 1}.png`));
    return request('PUT', `/api/v1/story/projects/${id}/rendered`, form);
  },
};

export const characterImageUrl = (file) => `/api/v1/story/files/characters/${file}`;
export const panelImageUrl = (projectId, file) => `/api/v1/story/files/panels/${projectId}/${file}`;
