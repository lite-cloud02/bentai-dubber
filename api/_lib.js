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
  minWait: Math.max(60, Number(process.env.MIN_WAIT_SECONDS || 60)), // kam se kam 1 minute
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

// Admin sirf wahi jiska email confirm ho chuka ho (koi dusra admin ki email se signup karke admin na ban sake)
const isAdmin = u => !!u && !!(u.email_confirmed_at || u.confirmed_at) && cfg.admins.includes((u.email || '').toLowerCase());
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

async function activeGameGrant(userId, gameId) {
  const { data } = await db.from('game_grants').select('expires_at')
    .eq('user_id', userId).eq('game_id', gameId)
    .gt('expires_at', new Date().toISOString()).maybeSingle();
  return data || null;
}

// ---------- Rate limit (supabase/update4.sql ki rate_limits table + rl_hit function) ----------
const ipOf = req => String(req.headers['x-forwarded-for'] || '').split(',')[0].trim() || (req.socket && req.socket.remoteAddress) || 'ip';
async function limited(req, res, key, max, seconds) {
  try {
    const { data, error } = await db.rpc('rl_hit', { p_key: key, p_seconds: seconds });
    if (error) return false; // table abhi nahi bani to site na ruke
    if (Math.random() < 0.01) await db.from('rate_limits').delete().lt('expires_at', new Date().toISOString());
    if (Number(data) > max) { fail(res, 429, 'Too many requests. Please wait a minute and try again.'); return true; }
  } catch (e) { /* fail-open */ }
  return false;
}

// ---------- Device limit: ek account par max 2 device, aur ek time par sirf 1 device se play ----------
const MAX_DEVICES = 2;
const SESSION_STALE_MS = 120000; // itne time tak beat na aaye to device "band" maana jaata hai
async function claimDevice(req, user, episodeId, register) {
  if (isAdmin(user)) return null;
  const dev = String(req.headers['x-device-id'] || '');
  if (!/^[A-Za-z0-9-]{8,64}$/.test(dev)) return { code: 400, msg: 'Please refresh the page and try again.' };
  try {
    const now = Date.now();
    if (register) {
      await db.from('user_devices').delete().eq('user_id', user.id).lt('last_seen', new Date(now - 30 * 86400000).toISOString());
      const { data: list } = await db.from('user_devices').select('device_id').eq('user_id', user.id);
      const known = (list || []).some(d => d.device_id === dev);
      if (!known) {
        if ((list || []).length >= MAX_DEVICES) return { code: 423, msg: 'This account is already used on 2 devices. One account can be used on only 2 devices.' };
        await db.from('user_devices').insert({ user_id: user.id, email: (user.email || '').toLowerCase(), device_id: dev });
      } else {
        await db.from('user_devices').update({ last_seen: new Date(now).toISOString() }).eq('user_id', user.id).eq('device_id', dev);
      }
    }
    const { data: s } = await db.from('play_sessions').select('device_id,last_beat').eq('user_id', user.id).maybeSingle();
    if (s && s.device_id !== dev && now - new Date(s.last_beat).getTime() < SESSION_STALE_MS)
      return { code: 409, msg: 'This account is playing on another device. Stop it there first, then try again in a minute.' };
    await db.from('play_sessions').upsert({ user_id: user.id, device_id: dev, episode_id: episodeId, last_beat: new Date(now).toISOString() }, { onConflict: 'user_id' });
  } catch (e) { /* table nahi bani to site na ruke */ }
  return null;
}

module.exports = { db, cfg, ipOf, limited, claimDevice, missing, UUID, getUser, isAdmin, vipInfo, displayName, send, fail, episodeKey, activeGrant, activeGameGrant, crypto };
