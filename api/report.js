const { db, UUID, getUser, send, fail } = require('./_lib');
module.exports = async (req, res) => {
  if (req.method !== 'POST') return fail(res, 405, 'POST only');
  try {
    const user = await getUser(req);
    if (!user) return fail(res, 401, 'Please log in first');
    const b = req.body || {};
    if (!UUID.test(b.episodeId || '')) return fail(res, 400, 'Bad episode');
    const message = String(b.message || '').trim().slice(0, 300);
    const { data: ep } = await db.from('episodes').select('id').eq('id', b.episodeId).maybeSingle();
    if (!ep) return fail(res, 404, 'Episode not found');
    const since = new Date(Date.now() - 24 * 3600000).toISOString(); // 24 ghante
    const { count } = await db.from('reports').select('id', { count: 'exact', head: true }).eq('user_id', user.id).gt('created_at', since);
    if ((count || 0) >= 1) return fail(res, 429, 'You can send only one report per day. Please try again tomorrow.');
    const { error } = await db.from('reports').insert({ user_id: user.id, episode_id: b.episodeId, message });
    if (error) return fail(res, 500, 'Could not save the report right now.');
    send(res, 200, { ok: true });
  } catch (e) { fail(res, 500, 'Server error'); }
};
