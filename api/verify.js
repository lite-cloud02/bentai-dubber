const { db, cfg, getUser, send, fail } = require('./_lib');
module.exports = async (req, res) => {
  if (req.method !== 'POST') return fail(res, 405, 'POST only');
  try {
    const user = await getUser(req);
    if (!user) return fail(res, 401, 'Please log in first');
    const token = String((req.body && req.body.token) || '');
    if (!/^[0-9a-f]{48}$/.test(token)) return fail(res, 400, 'Invalid link');

    const { data: t } = await db.from('shortener_tokens').select('*').eq('token', token).maybeSingle();
    if (!t) return fail(res, 400, 'Invalid link');
    if (t.user_id !== user.id) return fail(res, 403, 'This link belongs to another account');
    if (t.used) return fail(res, 400, 'This link was already used. Open the episode again.');

    const age = (Date.now() - new Date(t.created_at).getTime()) / 1000;
    if (age > 30 * 60) return fail(res, 400, 'This link has expired. Open the episode again.');
    if (age < cfg.minWait) return fail(res, 400, 'The link was completed too fast. Please complete the whole shortener.');

    // Sirf ek hi baar use ho: used=false wali row hi update hogi
    const { data: claimed } = await db.from('shortener_tokens').update({ used: true })
      .eq('token', token).eq('used', false).select('token');
    if (!claimed || !claimed.length) return fail(res, 400, 'This link was already used.');

    const expires = new Date(Date.now() + cfg.accessMinutes * 60000).toISOString();
    await db.from('access_grants').upsert(
      { user_id: user.id, episode_id: t.episode_id, expires_at: expires },
      { onConflict: 'user_id,episode_id' }
    );
    send(res, 200, { episodeId: t.episode_id });
  } catch (e) { fail(res, 500, 'Server error'); }
};
