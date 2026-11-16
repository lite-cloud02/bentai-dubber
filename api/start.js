const { db, cfg, UUID, getUser, send, fail, activeGrant, crypto } = require('./_lib');

async function shorten(dest) {
  const key = process.env.AROLINKS_API_KEY;
  if (!key) throw new Error('AROLINKS_API_KEY set nahi hai');
  const base = process.env.AROLINKS_API_URL || 'https://arolinks.com/api';
  const r = await fetch(`${base}?api=${encodeURIComponent(key)}&url=${encodeURIComponent(dest)}`);
  const text = (await r.text()).trim();
  let j = null;
  try { j = JSON.parse(text); } catch (e) { /* plain text response */ }
  let url = '';
  if (j) {
    if (String(j.status || '').toLowerCase() === 'error') throw new Error(j.message || 'shortener error');
    url = j.shortenedUrl || j.shortened_url || j.short_url || j.url || '';
  } else if (/^https?:\/\//i.test(text)) {
    url = text;
  }
  if (!/^https?:\/\//i.test(url)) throw new Error('shortener se galat response aaya');
  return url;
}

module.exports = async (req, res) => {
  if (req.method !== 'POST') return fail(res, 405, 'POST only');
  try {
    const user = await getUser(req);
    if (!user) return fail(res, 401, 'Pehle login karo');
    const episodeId = req.body && req.body.episodeId;
    if (!UUID.test(episodeId || '')) return fail(res, 400, 'Bad episode');

    const { data: ep } = await db.from('episodes').select('id').eq('id', episodeId).maybeSingle();
    if (!ep) return fail(res, 404, 'Episode nahi mila');

    // 1 ghante ka access abhi chal raha hai to dobara shortener nahi
    if (await activeGrant(user.id, episodeId)) return send(res, 200, { direct: true });

    const since = new Date(Date.now() - 60000).toISOString();
    const { count } = await db.from('shortener_tokens').select('token', { count: 'exact', head: true })
      .eq('user_id', user.id).gt('created_at', since);
    if ((count || 0) >= 5) return fail(res, 429, 'Bahut zyada requests. 1 minute baad try karo.');

    const token = crypto.randomBytes(24).toString('hex');
    const short = await shorten(`${cfg.siteUrl}/?t=${token}`);
    await db.from('shortener_tokens').insert({ token, user_id: user.id, episode_id: episodeId });
    // Token client ko nahi bheja jaata, sirf short link jaata hai
    send(res, 200, { url: short });
  } catch (e) {
    console.error('start error:', e.message);
    fail(res, 502, 'Short link nahi ban paya. Thodi der baad try karo.');
  }
};
