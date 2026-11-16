const sb = supabase.createClient(BD_CONFIG.SUPABASE_URL, BD_CONFIG.SUPABASE_ANON_KEY);
const $ = s => document.querySelector(s);
const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

async function accessToken() {
  const { data } = await sb.auth.getSession();
  return data.session ? data.session.access_token : null;
}

async function api(path, opts = {}) {
  const headers = { 'Content-Type': 'application/json' };
  const tok = await accessToken();
  if (tok) headers.Authorization = 'Bearer ' + tok;
  const r = await fetch('/api/' + path, { ...opts, headers });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) { const e = new Error(j.error || 'Request fail hua'); e.status = r.status; throw e; }
  return j;
}
const post = (path, body) => api(path, { method: 'POST', body: JSON.stringify(body) });
