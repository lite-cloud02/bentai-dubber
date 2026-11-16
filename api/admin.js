const { db, UUID, getUser, isAdmin, send, fail } = require('./_lib');
const { KEYS, clean, loadSettings } = require('./_settings');

module.exports = async (req, res) => {
  try {
    const user = await getUser(req);
    if (!user) return fail(res, 401, 'Login required');
    if (!isAdmin(user)) return fail(res, 403, 'Sirf admin');

    if (req.method === 'GET') {
      const { data } = await db.from('anime')
        .select('id,title,genre,description,poster_url,episodes(id,title,number)').order('created_at', { ascending: false });
      (data || []).forEach(a => (a.episodes || []).sort((x, y) => x.number - y.number));
      let reports = [];
      try {
        const r = await db.from('reports').select('id,message,created_at,episodes(title,anime(title))')
          .eq('resolved', false).order('created_at', { ascending: false }).limit(50);
        reports = r.data || [];
      } catch (e) { /* table abhi nahi bani */ }
      return send(res, 200, { anime: data || [], settings: await loadSettings(db), reports });
    }
    if (req.method !== 'POST') return fail(res, 405, 'Method not allowed');

    const b = req.body || {};
    const txt = (s, n) => String(s || '').trim().slice(0, n);

    if (b.action === 'addAnime' || b.action === 'updateAnime') {
      const title = txt(b.title, 120);
      if (!title) return fail(res, 400, 'Title likho');
      const row = { title, genre: txt(b.genre, 80) || 'Action', description: txt(b.description, 1000), poster_url: txt(b.poster_url, 500) };
      if (b.action === 'addAnime') {
        const { data, error } = await db.from('anime').insert(row).select('id').single();
        if (error) return fail(res, 500, error.message);
        return send(res, 200, { id: data.id });
      }
      if (!UUID.test(b.id || '')) return fail(res, 400, 'Bad id');
      const { error } = await db.from('anime').update(row).eq('id', b.id);
      if (error) return fail(res, 500, error.message);
      return send(res, 200, { ok: true });
    }

    if (b.action === 'addEpisode' || b.action === 'updateEpisode') {
      const title = txt(b.title, 120);
      if (!title) return fail(res, 400, 'Episode title likho');
      const number = Math.max(1, parseInt(b.number, 10) || 1);
      if (b.action === 'addEpisode') {
        if (!UUID.test(b.animeId || '')) return fail(res, 400, 'Anime chuno');
        const { data, error } = await db.from('episodes').insert({ anime_id: b.animeId, title, number }).select('id').single();
        if (error) return fail(res, 500, error.message);
        return send(res, 200, { id: data.id });
      }
      if (!UUID.test(b.id || '')) return fail(res, 400, 'Bad id');
      const { error } = await db.from('episodes').update({ title, number }).eq('id', b.id);
      if (error) return fail(res, 500, error.message);
      return send(res, 200, { ok: true });
    }

    if (b.action === 'saveSettings') {
      const s = b.settings || {};
      const rows = Object.keys(KEYS).filter(k => k in s).map(k => ({ key: k, value: clean(k, s[k]) }));
      if (rows.length) {
        const { error } = await db.from('settings').upsert(rows, { onConflict: 'key' });
        if (error) return fail(res, 500, 'Settings save nahi hui. Supabase mein update1.sql run kiya? (' + error.message + ')');
      }
      return send(res, 200, { ok: true });
    }

    if (b.action === 'deleteAnime' || b.action === 'deleteEpisode' || b.action === 'resolveReport') {
      if (!UUID.test(b.id || '')) return fail(res, 400, 'Bad id');
      const table = b.action === 'deleteAnime' ? 'anime' : b.action === 'deleteEpisode' ? 'episodes' : 'reports';
      const { error } = await db.from(table).delete().eq('id', b.id);
      if (error) return fail(res, 500, error.message);
      return send(res, 200, { ok: true });
    }
    fail(res, 400, 'Unknown action');
  } catch (e) { fail(res, 500, 'Server error'); }
};
