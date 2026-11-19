const { createClient } = require('@supabase/supabase-js');
const crypto = require('crypto');

const strip = s => String(s || '').trim().replace(/^["']|["']$/g, '');
function cleanUrl(u) { try { return new URL(strip(u)).origin; } catch (e) { return ''; } }

const SUPABASE_URL = cleanUrl(process.env.SUPABASE_URL);
const SERVICE_KEY = strip(process.env.SUPABASE_SERVICE_ROLE_KEY);
const missing = [];
if (!SUPABASE_URL) missing.push('SUPABASE_URL');
if (!SERVICE_KEY) missing.push('SUPABASE_SERVICE_ROLE_KEY');
if (!process.env.KEY_SECRET) missing.push('KEY_SECRET');

const db = createClient(SUPABASE_URL || 'https://missing.supabase.co', SERVICE_KEY || 'missing', {
  auth: { persistSession: false }
});

const cfg = {
  siteUrl: (process.env.SITE_URL || '').replace(/\/$/, ''),
  minWait: Number(process.env.MIN_WAIT_SECONDS || 15),
  accessMinutes: Number(process.env.ACCESS_MINUTES || 60),
  admins: (process.env.ADMIN_EMAILS || '').toLowerCase().split(',').map(s => s.trim()).filter(Boolean)
};

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

async function getUser(req) {
  const h = req.headers.authorization || '';
  const jwt = h.startsWith('Bearer ') ? h.slice(7) : '';
  if (!jwt) return null;
  const { data, error } = await db.auth.getUser(jwt);
  if (error) {
    if (/api key|apikey/i.test(error.message || '')) throw new Error('SUPABASE_SERVICE_ROLE_KEY is invalid');
    return null;
  }
  return data.user;
}

const isAdmin = u => !!u && cfg.admins.includes((u.email || '').toLowerCase());
// VIP: admin panel se email add hoti hai (vip_users table). Expiry ke baad row apne aap delete ho jaati hai.
// Return: null (VIP nahi) ya { expiresAt: ISO string ya null (lifetime) }
async function vipInfo(u) {
  if (!u || !u.email) return null;
  if (isAdmin(u)) return { expiresAt: null };
  try {
    const email = u.email.toLowerCase();
    const { data } = await db.from('vip_users').select('expires_at').eq('email', email).maybeSingle();
    if (!data) return null;
    if (data.expires_at && new Date(data.expires_at).getTime() <= Date.now()) {
      await db.from('vip_users').delete().eq('email', email); // expire: list se remove
      return null;
    }
    return { expiresAt: data.expires_at || null };
  } catch (e) { return null; }
}
const displayName = u => (u && u.user_metadata && u.user_metadata.name) || ((u && u.email) || 'user').split('@')[0];

function send(res, code, body) {
  res.setHeader('Cache-Control', 'no-store');
  res.status(code).json(body);
}
const fail = (res, code, msg) => send(res, code, { error: msg });

function episodeKey(id) {
  return crypto.createHmac('sha256', process.env.KEY_SECRET).update(String(id)).digest().subarray(0, 16);
}

async function activeGrant(userId, episodeId) {
  const { data } = await db.from('access_grants').select('expires_at')
    .eq('user_id', userId).eq('episode_id', episodeId)
    .gt('expires_at', new Date().toISOString()).maybeSingle();
  return data || null;
}

module.exports = { db, cfg, missing, UUID, getUser, isAdmin, vipInfo, displayName, send, fail, episodeKey, activeGrant, crypto };
