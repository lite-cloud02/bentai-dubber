const { db, UUID, send, fail } = require('./_lib');
module.exports = async (req, res) => {
  try {
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
    const { data: latest } = await db.from('episodes')
      .select('id,title,number,created_at,anime(id,title,poster_url)')
      .order('created_at', { ascending: false }).limit(10);
    send(res, 200, {
      anime: (data || []).map(a => ({
        id: a.id, title: a.title, genre: a.genre, poster_url: a.poster_url,
        episodeCount: (a.episodes && a.episodes[0] && a.episodes[0].count) || 0
      })),
      latest: latest || []
    });
  } catch (e) { fail(res, 500, 'Server error'); }
};
