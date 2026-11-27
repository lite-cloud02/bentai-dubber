const { db, UUID, send, fail, limited, ipOf, getUser, activeGameGrant } = require('./_lib');
module.exports = async (req, res) => {
  try {
    if (await limited(req, res, 'anime:' + ipOf(req), 300, 60)) return;
    // Games ki list (sirf title + thumbnail)
    if (req.query.games) {
      const r = await db.from('games').select('id,title,thumb_url').order('created_at', { ascending: false });
      return send(res, 200, { games: r.error ? [] : (r.data || []).map(g => ({ id: g.id, title: g.title, thumb_url: g.thumb_url })) }); // download link kabhi list mein nahi
    }
    // Ek game ki detail. Download link tabhi milta hai jab is user ka access (shortener ke baad) chalu ho
    if (req.query.game) {
      const gid = req.query.game;
      if (!UUID.test(gid)) return fail(res, 400, 'Bad id');
      const { data: g } = await db.from('games').select('id,title,description,thumb_url,shots,download_url').eq('id', gid).maybeSingle();
      if (!g) return fail(res, 404, 'Game not found');
      let unlocked = false;
      try { const u = await getUser(req); if (u) unlocked = !!(await activeGameGrant(u.id, gid)); } catch (e) { /* login nahi = locked */ }
      return send(res, 200, {
        game: { id: g.id, title: g.title, description: g.description, thumb_url: g.thumb_url, shots: g.shots || [] },
        unlocked, download_url: unlocked ? g.download_url : ''
      });
    }
    const id = req.query.id;
    if (id) {
      if (!UUID.test(id)) return fail(res, 400, 'Bad id');
      const { data: anime } = await db.from('anime')
        .select('id,title,genre,description,poster_url').eq('id', id).maybeSingle();
      if (!anime) return fail(res, 404, 'Anime not found');
      const epQ = cols => db.from('episodes').select(cols).eq('anime_id', id).order('number');
      let er = await epQ('id,title,number,thumb_url');
      if (er.error) er = await epQ('id,title,number'); // thumb_url column abhi nahi bana (update5.sql baaki)
      return send(res, 200, { anime, episodes: er.data || [] });
    }
    const listQ = cols => db.from('anime').select(cols).order('created_at', { ascending: false });
    let dr = await listQ('id,title,genre,poster_url,episodes(id,title,number,thumb_url)');
    if (dr.error) dr = await listQ('id,title,genre,poster_url,episodes(id,title,number)'); // update5.sql baaki ho tab bhi chale
    const data = dr.data;
    // "Episode 1", "Ep 2" jaise default naam search mein nahi aate; sirf asli (custom) episode naam search hote hain
    const GENERIC = /^\s*(episode|ep|e)\s*\.?\s*#?\d+\s*$/i;
    // "New episodes": sirf pichhle NEW_EPISODE_DAYS (default 7) din ke episodes. Uske baad row se hat jaate hain, anime ke page par rehte hain.
    const days = Math.max(1, Number(process.env.NEW_EPISODE_DAYS || 7));
    const since = new Date(Date.now() - days * 86400000).toISOString();
    const latQ = cols => db.from('episodes').select(cols)
      .gte('created_at', since).order('created_at', { ascending: false }).limit(10);
    let lr = await latQ('id,title,number,created_at,thumb_url,anime(id,title,poster_url)');
    if (lr.error) lr = await latQ('id,title,number,created_at,anime(id,title,poster_url)');
    const latest = lr.data;
    send(res, 200, {
      anime: (data || []).map(a => ({
        id: a.id, title: a.title, genre: a.genre, poster_url: a.poster_url,
        episodeCount: (a.episodes || []).length,
        eps: (a.episodes || []).filter(e => !GENERIC.test(e.title || '')).sort((x, y) => x.number - y.number)
          .map(e => ({ id: e.id, title: e.title, number: e.number, thumb_url: e.thumb_url || '' }))
      })),
      latest: latest || []
    });
  } catch (e) { fail(res, 500, 'Server error'); }
};
