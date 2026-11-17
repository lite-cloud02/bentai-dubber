if (!window.BD_CONFIG || !BD_CONFIG.SUPABASE_URL || !BD_CONFIG.SUPABASE_ANON_KEY) {
  const why = window.BD_CONFIG && BD_CONFIG.ERROR === 'secret_key'
    ? 'Vercel ke SUPABASE_ANON_KEY mein SECRET key padi hai. Wahan publishable ya anon (public) key daalo.'
    : 'Setup adhura hai. Vercel mein SUPABASE_URL aur SUPABASE_ANON_KEY (public key) daalo, phir Redeploy karo.';
  document.body.innerHTML = '<div style="padding:28px;color:#fff;font:15px system-ui">' + why + '</div>';
  throw new Error('config missing');
}
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
