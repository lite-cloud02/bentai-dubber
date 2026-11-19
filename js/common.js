window.BD_RECOVERY = /(^|[#&?])type=recovery/.test(location.hash + location.search);
if (!window.BD_CONFIG || !BD_CONFIG.SUPABASE_URL || !BD_CONFIG.SUPABASE_ANON_KEY) {
  const why = window.BD_CONFIG && BD_CONFIG.ERROR === 'secret_key'
    ? 'SUPABASE_ANON_KEY in Vercel holds a SECRET key. Use the publishable or anon (public) key there.'
    : 'Setup is incomplete. Add SUPABASE_URL and SUPABASE_ANON_KEY (public key) in Vercel, then redeploy.';
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
  if (!r.ok) { const e = new Error(j.error || 'Request failed'); e.status = r.status; throw e; }
  return j;
}
const post = (path, body) => api(path, { method: 'POST', body: JSON.stringify(body) });

document.addEventListener('click', e => {
  const b = e.target.closest('.pw-eye'); if (!b) return;
  const i = b.parentNode.querySelector('input'), show = i.type === 'password';
  i.type = show ? 'text' : 'password'; b.classList.toggle('on', show);
  b.setAttribute('aria-label', show ? 'Hide password' : 'Show password');
});
