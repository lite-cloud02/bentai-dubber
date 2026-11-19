const { db, UUID, getUser, displayName, send, fail, activeGrant } = require('./_lib');
module.exports = async (req, res) => {
  try {
    const user = await getUser(req);
    if (!user) return fail(res, 401, 'Please log in first');
    const e = req.query.e;
    if (!UUID.test(e || '')) return fail(res, 400, 'Bad episode');
    const grant = await activeGrant(user.id, e);
    if (!grant) return fail(res, 403, 'locked');
    const { data: ep } = await db.from('episodes').select('id,title,number,anime_id,anime(title)').eq('id', e).maybeSingle();
    if (!ep) return fail(res, 404, 'Episode not found');
    send(res, 200, {
      title: ep.title,
      number: ep.number,
      animeId: ep.anime_id,
      animeTitle: ep.anime ? ep.anime.title : '',
      playlist: `/api/playlist?e=${ep.id}`,
      expiresAt: grant.expires_at,
      watermark: displayName(user)
    });
  } catch (err) { fail(res, 500, 'Server error'); }
};
