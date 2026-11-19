const { db, UUID, send, fail, limited, ipOf } = require('./_lib');
module.exports = async (req, res) => {
  try {
    if (await limited(req, res, 'anime:' + ipOf(req), 300, 60)) return;
    const id = req.query.id;
    if (id) {
      if (!UUID.test(id)) return fail(res, 400, 'Bad id');
      const { data: anime } = await db.from('anime')
        .select('id,title,genre,description,poster_url').eq('id', id).maybeSingle();
      if (!anime) return fail(res, 404, 'Anime not found');
      const { data: eps } = await db.from('episodes')
        .select('id,title,number').eq('anime_id', id).order('number');
      return send(res, 200, { anime, episodes: eps || [] });
    }
    const { data } = await db.from('anime')
      .select('id,title,genre,poster_url,episodes(count)').order('created_at', { ascending: false });
    // "New episodes": sirf pichhle NEW_EPISODE_DAYS (default 7) din ke episodes. Uske baad row se hat jaate hain, anime ke page par rehte hain.
    const days = Math.max(1, Number(process.env.NEW_EPISODE_DAYS || 7));
    const since = new Date(Date.now() - days * 86400000).toISOString();
    const { data: latest } = await db.from('episodes')
      .select('id,title,number,created_at,anime(id,title,poster_url)')
      .gte('created_at', since).order('created_at', { ascending: false }).limit(10);
    send(res, 200, {
      anime: (data || []).map(a => ({
        id: a.id, title: a.title, genre: a.genre, poster_url: a.poster_url,
        episodeCount: (a.episodes && a.episodes[0] && a.episodes[0].count) || 0
      })),
      latest: latest || []
    });
  } catch (e) { fail(res, 500, 'Server error'); }
};
