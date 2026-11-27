const { db, UUID, getUser, isAdmin, send, fail, limited, crypto } = require('./_lib');
const { conf, s3missing, configured } = require('./_s3');
const { KEYS, clean, loadSettings } = require('./_settings');

module.exports = async (req, res) => {
  try {
    const user = await getUser(req);
    if (!user) return fail(res, 401, 'Login required');
    if (!isAdmin(user)) return fail(res, 403, 'Admins only');
    if (await limited(req, res, 'admin:' + user.id, 120, 60)) return;

    if (req.method === 'GET') {
      const aQ = cols => db.from('anime').select(cols).order('created_at', { ascending: false });
      let ar = await aQ('id,title,genre,description,poster_url,episodes(id,title,number,thumb_url)');
      if (ar.error) ar = await aQ('id,title,genre,description,poster_url,episodes(id,title,number)'); // update5.sql baaki
      const data = ar.data;
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
      // Video servers ki sthiti (sirf admin ko): kaun si Vercel value mili / nahi mili (value kabhi nahi dikhti)
      const storage = [1, 2].map(n => ({ n, ok: configured(n), missing: s3missing(n), bucket: conf(n).bucket }));
      let games = [];
      try {
        const g = await db.from('games').select('id,title,description,thumb_url,shots,download_url,created_at').order('created_at', { ascending: false });
        games = g.data || [];
      } catch (e) { /* table abhi nahi bani (update6.sql baaki) */ }
      return send(res, 200, { anime: data || [], settings: await loadSettings(db), reports, vips, storage, games });
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
      const thumb = txt(b.thumb_url, 500);
      if (thumb && !/^https?:\/\//i.test(thumb)) return fail(res, 400, 'Thumbnail must be an image link starting with https://');
      const thumbErr = m => (/thumb_url/.test(m || '') ? 'Run supabase/update5.sql in Supabase first (thumbnail column is missing).' : m);
      if (b.action === 'addEpisode') {
        if (!UUID.test(b.animeId || '')) return fail(res, 400, 'Select an anime');
        const { data, error } = await db.from('episodes').insert({ anime_id: b.animeId, title, number, thumb_url: thumb }).select('id').single();
        if (error) return fail(res, 500, thumbErr(error.message));
        return send(res, 200, { id: data.id });
      }
      if (!UUID.test(b.id || '')) return fail(res, 400, 'Bad id');
      const { error } = await db.from('episodes').update({ title, number, thumb_url: thumb }).eq('id', b.id);
      if (error) return fail(res, 500, thumbErr(error.message));
      return send(res, 200, { ok: true });
    }

    if (b.action === 'addGame' || b.action === 'updateGame') {
      const title = txt(b.title, 120);
      if (!title) return fail(res, 400, 'Enter a game title');
      const link = (s, n) => txt(s, n);
      const thumb = link(b.thumb_url, 500), dl = link(b.download_url, 1000);
      const shots = (Array.isArray(b.shots) ? b.shots : []).slice(0, 6).map(x => link(x, 500)).filter(Boolean);
      const bad = [thumb, dl, ...shots].find(u => u && !/^https?:\/\//i.test(u));
      if (bad) return fail(res, 400, 'Images and the download link must start with https://');
      const row = { title, description: txt(b.description, 3000), thumb_url: thumb, shots, download_url: dl };
      const gErr = m => (/games/.test(m || '') ? 'Run supabase/update6.sql in Supabase first (games table is missing).' : m);
      if (b.action === 'addGame') {
        const { data, error } = await db.from('games').insert(row).select('id').single();
        if (error) return fail(res, 500, gErr(error.message));
        return send(res, 200, { id: data.id });
      }
      if (!UUID.test(b.id || '')) return fail(res, 400, 'Bad id');
      const { error } = await db.from('games').update(row).eq('id', b.id);
      if (error) return fail(res, 500, gErr(error.message));
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

    if (b.action === 'resetDevices') {
      const email = String(b.email || '').trim().toLowerCase();
      if (!email) return fail(res, 400, 'Enter an email');
      const { data: rows } = await db.from('user_devices').select('user_id').eq('email', email);
      await db.from('user_devices').delete().eq('email', email);
      for (const uid of [...new Set((rows || []).map(x => x.user_id))]) await db.from('play_sessions').delete().eq('user_id', uid);
      return send(res, 200, { ok: true, removed: (rows || []).length });
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

    if (b.action === 'deleteAnime' || b.action === 'deleteEpisode' || b.action === 'resolveReport' || b.action === 'deleteGame') {
      if (!UUID.test(b.id || '')) return fail(res, 400, 'Bad id');
      const table = b.action === 'deleteAnime' ? 'anime' : b.action === 'deleteEpisode' ? 'episodes' : b.action === 'deleteGame' ? 'games' : 'reports';
      const { error } = await db.from(table).delete().eq('id', b.id);
      if (error) return fail(res, 500, error.message);
      return send(res, 200, { ok: true });
    }
    fail(res, 400, 'Unknown action');
  } catch (e) { fail(res, 500, 'Server error'); }
};
