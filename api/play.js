const { configured } = require('./_s3');
const { db, UUID, getUser, isAdmin, displayName, send, fail, activeGrant, limited, claimDevice } = require('./_lib');
module.exports = async (req, res) => {
  try {
    const user = await getUser(req);
    if (!user) return fail(res, 401, 'Please log in first');
    const e = req.query.e;
    if (!UUID.test(e || '')) return fail(res, 400, 'Bad episode');
    const beat = req.query.beat === '1'; // player har ~40 second mein "main chal raha hoon" bhejta hai
    if (await limited(req, res, (beat ? 'beat:' : 'play:') + user.id, beat ? 10 : 30, 60)) return;
    const grant = await activeGrant(user.id, e);
    if (!grant) return fail(res, 403, 'locked');
    const bad = await claimDevice(req, user, e, !beat);
    if (bad) return fail(res, bad.code, bad.msg);
    if (beat) return send(res, 200, { ok: true });
    const { data: ep } = await db.from('episodes').select('id,title,number,anime_id,anime(title,poster_url)').eq('id', e).maybeSingle();
    if (!ep) return fail(res, 404, 'Episode not found');
    let views = null; // needs supabase/update2.sql; hidden until then
    try {
      const r = await db.from('episodes').select('views').eq('id', e).maybeSingle();
      if (r.data && r.data.views !== undefined) {
        views = Number(r.data.views) || 0;
        if (!isAdmin(user)) { views += 1; await db.from('episodes').update({ views }).eq('id', e); }
      }
    } catch (_) {}
    send(res, 200, {
      title: ep.title,
      number: ep.number,
      animeId: ep.anime_id,
      animeTitle: ep.anime ? ep.anime.title : '',
      animePoster: ep.anime ? ep.anime.poster_url : '',
      views,
      playlist: `/api/playlist?e=${ep.id}`,
      servers: [1, 2].filter(configured).length,
      expiresAt: grant.expires_at,
      watermark: displayName(user)
    });
  } catch (err) { fail(res, 500, 'Server error'); }
};
