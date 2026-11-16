const { db, UUID, getUser, send, fail } = require('./_lib');
module.exports = async (req, res) => {
  if (req.method !== 'POST') return fail(res, 405, 'POST only');
  try {
    const user = await getUser(req);
    if (!user) return fail(res, 401, 'Pehle login karo');
    const b = req.body || {};
    if (!UUID.test(b.episodeId || '')) return fail(res, 400, 'Bad episode');
    const message = String(b.message || '').trim().slice(0, 300);
    const { data: ep } = await db.from('episodes').select('id').eq('id', b.episodeId).maybeSingle();
    if (!ep) return fail(res, 404, 'Episode nahi mila');
    const since = new Date(Date.now() - 3600000).toISOString();
    const { count } = await db.from('reports').select('id', { count: 'exact', head: true }).eq('user_id', user.id).gt('created_at', since);
    if ((count || 0) >= 5) return fail(res, 429, 'Bahut zyada reports. Thodi der baad try karo.');
    const { error } = await db.from('reports').insert({ user_id: user.id, episode_id: b.episodeId, message });
    if (error) return fail(res, 500, 'Report abhi save nahi ho paya.');
    send(res, 200, { ok: true });
  } catch (e) { fail(res, 500, 'Server error'); }
};
