// Browser ko Supabase URL aur PUBLIC (anon/publishable) key deta hai, Vercel ke Environment Variables se.
// Yahan secret/service_role key kabhi nahi bhejni.
const strip = s => String(s || '').trim().replace(/^["']|["']$/g, '');
module.exports = (req, res) => {
  let url = '';
  try { url = new URL(strip(process.env.SUPABASE_URL)).origin; } catch (e) { /* khali */ }
  const key = strip(process.env.SUPABASE_ANON_KEY);
  const risky = /^sb_secret_/.test(key) || /"role"\s*:\s*"service_role"/.test(Buffer.from(key.split('.')[1] || '', 'base64url').toString());
  res.setHeader('Content-Type', 'application/javascript; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store');
  res.status(200).send('window.BD_CONFIG = ' + JSON.stringify({
    SUPABASE_URL: url,
    SUPABASE_ANON_KEY: risky ? '' : key,
    ERROR: risky ? 'secret_key' : '',
    TURNSTILE_SITEKEY: strip(process.env.TURNSTILE_SITEKEY) // public key; khali ho to bot check band
  }) + ';');
};
