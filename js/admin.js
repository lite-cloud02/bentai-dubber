const root = $('#admin');
let data = { anime: [], settings: {}, reports: [] }, editA = null, editE = null, msg = '';
const v = x => esc(x == null ? '' : x);

async function start() {
  try { const me = await api('me'); if (!me.isAdmin) throw new Error('x'); }
  catch (e) { root.innerHTML = '<div class="center"><h3>Admin access nahi hai</h3><p>Pehle admin email se login karo.</p><a class="btn" href="index.html">Home par jao</a></div>'; return; }
  await load();
}
async function load() { data = await api('admin'); render(); }

function render() {
  const S = data.settings || {}, list = data.anime || [];
  const a = editA ? list.find(x => x.id === editA) : null;
  let e = null;
  if (editE) for (const an of list) { const f = (an.episodes || []).find(x => x.id === editE); if (f) { e = { ...f, anime_id: an.id }; break; } }
  const inp = (k, label, ph) => `<div class="field"><label>${label}</label><input name="${k}" value="${v(S[k])}" placeholder="${ph || ''}"></div>`;
  const chk = (k, label) => `<label class="chk"><input type="checkbox" name="${k}" ${S[k] === '1' ? 'checked' : ''}> ${label}</label>`;

  root.innerHTML = `<a class="back" href="index.html">Wapas</a><h1>Admin panel</h1>

  <form class="panel" id="fA"><h2>${a ? 'Anime edit karo' : 'Anime add karo'}</h2>
    <div class="field"><label>Title</label><input name="title" required value="${v(a && a.title)}"></div>
    <div class="field"><label>Genre (comma se alag karo, jaise Action, Ecchi)</label><input name="genre" value="${v(a ? a.genre : 'Action')}"></div>
    <div class="field"><label>Description</label><textarea name="description">${v(a && a.description)}</textarea></div>
    <div class="field"><label>Poster image URL (kisi bhi hosting ka link)</label><input name="poster_url" value="${v(a && a.poster_url)}" placeholder="https://..."></div>
    <button class="btn">${a ? 'Update karo' : 'Anime save karo'}</button>
    ${a ? '<button type="button" class="btn ghost" id="cancelA">Cancel</button>' : ''}</form>

  <form class="panel" id="fE"><h2>${e ? 'Episode edit karo' : 'Episode add karo'}</h2>
    <div class="field"><label>Anime</label><select name="animeId" ${e ? 'disabled' : ''} required>${list.map(x => `<option value="${x.id}" ${e && e.anime_id === x.id ? 'selected' : ''}>${v(x.title)}</option>`).join('')}</select></div>
    <div class="field"><label>Episode number</label><input name="number" type="number" min="1" value="${e ? e.number : 1}"></div>
    <div class="field"><label>Episode title</label><input name="title" required value="${v(e && e.title)}" placeholder="Episode 1"></div>
    <button class="btn">${e ? 'Update karo' : 'Episode banao'}</button>
    ${e ? '<button type="button" class="btn ghost" id="cancelE">Cancel</button>' : ''}
    <div id="cmdBox"></div></form>

  <div class="panel"><h2>Reports (${(data.reports || []).length})</h2>
    ${(data.reports || []).length ? data.reports.map(r => `<div class="row"><span>${v(r.episodes && r.episodes.anime ? r.episodes.anime.title : '')} &middot; ${v(r.episodes && r.episodes.title)}<br><small>${v(r.message)} &middot; ${new Date(r.created_at).toLocaleString('en-IN')}</small></span><button class="del ok" data-r="${r.id}">Theek ho gaya</button></div>`).join('') : '<p class="muted">Abhi koi report nahi.</p>'}</div>

  <form class="panel" id="fS"><h2>Site settings</h2>
    <p class="muted" style="font-size:13px;margin-top:-6px">Khali chhodoge to wo cheez site par nahi dikhegi. Links https:// se shuru hone chahiye.</p>
    ${inp('telegram', 'Telegram link', 'https://t.me/...')}
    ${inp('whatsapp', 'WhatsApp channel/group link', 'https://whatsapp.com/channel/...')}
    ${inp('instagram', 'Instagram link', 'https://instagram.com/...')}
    ${inp('youtube', 'YouTube link', 'https://youtube.com/...')}
    ${inp('support', 'Support channel link', 'https://t.me/...')}
    ${inp('support_label', 'Support button ka naam', 'Support channel')}
    ${inp('contact_email', 'Contact email (DMCA ke liye)', 'aap@email.com')}
    <h2 style="margin-top:18px">Announcement banner (home ke upar)</h2>
    ${inp('announce_text', 'Banner ka text', 'Naya episode aa gaya!')}
    ${inp('announce_link', 'Banner ka link (zaroori nahi)', 'https://...')}
    <h2 style="margin-top:18px">Join popup (din mein ek baar)</h2>
    ${chk('popup_on', 'Popup chalu karo')}
    ${inp('popup_title', 'Popup ka title', 'Telegram join karo')}
    <div class="field"><label>Popup ka text</label><textarea name="popup_text">${v(S.popup_text)}</textarea></div>
    ${inp('popup_link', 'Popup ka link', 'https://t.me/...')}
    ${inp('popup_btn', 'Button ka naam', 'Join karo')}
    <h2 style="margin-top:18px">Baaki</h2>
    ${chk('age_gate', '18+ warning popup dikhao')}
    <div class="field"><label>Contact page par extra jaankari</label><textarea name="about_text">${v(S.about_text)}</textarea></div>
    <button class="btn">Settings save karo</button><p class="muted" id="sMsg">${v(msg)}</p></form>

  <div class="panel"><h2>Saved content</h2>${list.length ? list.map(x => `<div class="row"><span><b>${v(x.title)}</b> <small>${v(x.genre)}</small></span><span><button class="del ed" data-ea="${x.id}">Edit</button> <button class="del" data-a="${x.id}">Delete</button></span></div>
    ${(x.episodes || []).map(ep => `<div class="row sub-eps"><span>${ep.number}. ${v(ep.title)}<br><small>${ep.id}</small></span><span><button class="del ed" data-ee="${ep.id}">Edit</button> <button class="del" data-e="${ep.id}">Delete</button></span></div>`).join('')}`).join('') : '<p class="muted">Abhi kuch add nahi hua.</p>'}
    <p class="muted" style="font-size:12px">Delete karne par Backblaze se video files apne aap nahi hatti. Wahan se alag se hatani hongi.</p></div>`;

  const run = async fn => { try { await fn(); } catch (err) { alert(err.message); } };

  $('#fA').onsubmit = ev => { ev.preventDefault(); run(async () => {
    const f = Object.fromEntries(new FormData(ev.target));
    await post('admin', a ? { action: 'updateAnime', id: a.id, ...f } : { action: 'addAnime', ...f });
    editA = null; await load();
  }); };
  if ($('#cancelA')) $('#cancelA').onclick = () => { editA = null; render(); };

  $('#fE').onsubmit = ev => { ev.preventDefault(); run(async () => {
    const f = Object.fromEntries(new FormData(ev.target));
    if (e) { await post('admin', { action: 'updateEpisode', id: e.id, number: f.number, title: f.title }); editE = null; await load(); return; }
    const r = await post('admin', { action: 'addEpisode', ...f });
    await load();
    $('#cmdBox').innerHTML = `<p class="muted" style="margin:12px 0 0">Episode ban gaya. Ye <b>episode ID</b> copy karo:</p><code class="cmd">${r.id}</code><p class="muted" style="font-size:13px">GitHub &rarr; Actions &rarr; Encode episode &rarr; Run workflow mein <b>episode_id</b> mein ye ID aur <b>source_key</b> mein Backblaze wali file ka naam daalo.</p>`;
  }); };
  if ($('#cancelE')) $('#cancelE').onclick = () => { editE = null; render(); };

  $('#fS').onsubmit = ev => { ev.preventDefault(); run(async () => {
    const form = ev.target, settings = {};
    new FormData(form).forEach((val, k) => { settings[k] = val; });
    ['popup_on', 'age_gate'].forEach(k => { settings[k] = form.elements[k].checked ? '1' : '0'; });
    await post('admin', { action: 'saveSettings', settings });
    msg = 'Save ho gaya.'; await load(); msg = '';
  }); };

  root.querySelectorAll('[data-ea]').forEach(b => b.onclick = () => { editA = b.dataset.ea; editE = null; render(); $('#fA').scrollIntoView(); });
  root.querySelectorAll('[data-ee]').forEach(b => b.onclick = () => { editE = b.dataset.ee; editA = null; render(); $('#fE').scrollIntoView(); });
  root.querySelectorAll('[data-r]').forEach(b => b.onclick = () => run(async () => { await post('admin', { action: 'resolveReport', id: b.dataset.r }); await load(); }));
  root.querySelectorAll('[data-a],[data-e]').forEach(b => b.onclick = () => run(async () => {
    if (!confirm('Pakka delete karna hai?')) return;
    await post('admin', b.dataset.a ? { action: 'deleteAnime', id: b.dataset.a } : { action: 'deleteEpisode', id: b.dataset.e });
    await load();
  }));
}
start();
