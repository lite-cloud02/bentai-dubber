const { db, UUID, getUser, isAdmin, send, fail, crypto } = require('./_lib');
const { KEYS, clean, loadSettings } = require('./_settings');

module.exports = async (req, res) => {
  try {
    const user = await getUser(req);
    if (!user) return fail(res, 401, 'Login required');
    if (!isAdmin(user)) return fail(res, 403, 'Admins only');

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
      let vips = [];
      try {
        await db.from('vip_users').delete().lt('expires_at', new Date().toISOString()); // expire hue VIP list se hat jaate hain
        const v = await db.from('vip_users').select('email,note,expires_at,created_at').order('created_at', { ascending: false });
        vips = v.data || [];
      } catch (e) { /* table abhi nahi bani */ }
      return send(res, 200, { anime: data || [], settings: await loadSettings(db), reports, vips });
    }
    if (req.method !== 'POST') return fail(res, 405, 'Method not allowed');

    const b = req.body || {};
    const txt = (s, n) => String(s || '').trim().slice(0, n);

    if (b.action === 'addAnime' || b.action === 'updateAnime') {
      const title = txt(b.title, 120);
      if (!title) return fail(res, 400, 'Enter a title');
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
      if (!title) return fail(res, 400, 'Enter an episode title');
      const number = Math.max(1, parseInt(b.number, 10) || 1);
      if (b.action === 'addEpisode') {
        if (!UUID.test(b.animeId || '')) return fail(res, 400, 'Select an anime');
        const { data, error } = await db.from('episodes').insert({ anime_id: b.animeId, title, number }).select('id').single();
        if (error) return fail(res, 500, error.message);
        return send(res, 200, { id: data.id });
      }
      if (!UUID.test(b.id || '')) return fail(res, 400, 'Bad id');
      const { error } = await db.from('episodes').update({ title, number }).eq('id', b.id);
      if (error) return fail(res, 500, error.message);
      return send(res, 200, { ok: true });
    }

    if (b.action === 'uploadPoster') {
      const raw = String(b.data || '');
      if (!raw || raw.length > 3000000) return fail(res, 400, 'Image is too large');
      const buf = Buffer.from(raw, 'base64');
      if (buf.length < 100 || buf[0] !== 0xFF || buf[1] !== 0xD8) return fail(res, 400, 'Upload a valid image');
      await db.storage.createBucket('posters', { public: true }); // already exists = fine
      const name = Date.now() + '-' + crypto.randomBytes(4).toString('hex') + '.jpg';
      const { error } = await db.storage.from('posters').upload(name, buf, { contentType: 'image/jpeg' });
      if (error) return fail(res, 500, 'Upload failed: ' + error.message);
      return send(res, 200, { url: db.storage.from('posters').getPublicUrl(name).data.publicUrl });
    }

    if (b.action === 'saveSettings') {
      const s = b.settings || {};
      const rows = Object.keys(KEYS).filter(k => k in s).map(k => ({ key: k, value: clean(k, s[k]) }));
      if (rows.length) {
        const { error } = await db.from('settings').upsert(rows, { onConflict: 'key' });
        if (error) return fail(res, 500, 'Settings were not saved. Did you run update1.sql in Supabase? (' + error.message + ')');
      }
      return send(res, 200, { ok: true });
    }

    if (b.action === 'addVip') {
      const email = String(b.email || '').trim().toLowerCase();
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 120) return fail(res, 400, 'Enter a valid email');
      const days = parseInt(b.days, 10);
      if (b.days !== '' && b.days != null && !(days >= 1 && days <= 3650)) return fail(res, 400, 'Days must be between 1 and 3650 (or leave empty for lifetime)');
      const expires_at = days >= 1 ? new Date(Date.now() + days * 86400000).toISOString() : null;
      const { error } = await db.from('vip_users').upsert({ email, note: txt(b.note, 80), expires_at }, { onConflict: 'email' });
      if (error) return fail(res, 500, 'Could not add VIP. Did you run update3.sql in Supabase? (' + error.message + ')');
      return send(res, 200, { ok: true });
    }
    if (b.action === 'removeVip') {
      const email = String(b.email || '').trim().toLowerCase();
      if (!email) return fail(res, 400, 'Bad email');
      const { error } = await db.from('vip_users').delete().eq('email', email);
      if (error) return fail(res, 500, error.message);
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
