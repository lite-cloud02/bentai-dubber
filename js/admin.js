const root = $('#admin');
let data = { anime: [], settings: {}, reports: [], vips: [] }, editA = null, editE = null, msg = '';
const v = x => esc(x == null ? '' : x);

async function start() {
  try { const me = await api('me'); if (!me.isAdmin) throw new Error('x'); }
  catch (e) { root.innerHTML = '<div class="center"><h3>No admin access</h3><p>Log in with the admin email first.</p><a class="btn" href="index.html">Go home</a></div>'; return; }
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

  root.innerHTML = `<a class="back" href="index.html">Back</a><h1>Admin panel</h1>

  <form class="panel" id="fA"><h2>${a ? 'Edit anime' : 'Add anime'}</h2>
    <div class="field"><label>Title</label><input name="title" required value="${v(a && a.title)}"></div>
    <div class="field"><label>Genre (comma separated, e.g. Action, Ecchi)</label><input name="genre" value="${v(a ? a.genre : 'Action')}"></div>
    <div class="field"><label>Description</label><textarea name="description">${v(a && a.description)}</textarea></div>
    <div class="field"><label>Poster / thumbnail</label>
      <div class="pup"><div class="pprev" id="pPrev">${a && a.poster_url ? `<img src="${v(a.poster_url)}" alt="">` : 'No image'}</div>
        <div><label class="btn ghost pbtn">Upload image<input type="file" id="pFile" accept="image/*" hidden></label><button type="button" class="btn ghost pbtn" id="pClear">Remove</button></div></div>
      <input name="poster_url" id="pUrl" value="${v(a && a.poster_url)}" placeholder="or paste an image URL">
      <p class="muted" id="pMsg" style="font-size:13px"></p></div>
    <button class="btn">${a ? 'Update' : 'Save anime'}</button>
    ${a ? '<button type="button" class="btn ghost" id="cancelA">Cancel</button>' : ''}</form>

  <form class="panel" id="fE"><h2>${e ? 'Edit episode' : 'Add episode'}</h2>
    <div class="field"><label>Anime</label><select name="animeId" ${e ? 'disabled' : ''} required>${list.map(x => `<option value="${x.id}" ${e && e.anime_id === x.id ? 'selected' : ''}>${v(x.title)}</option>`).join('')}</select></div>
    <div class="field"><label>Episode number</label><input name="number" type="number" min="1" value="${e ? e.number : 1}"></div>
    <div class="field"><label>Episode title</label><input name="title" required value="${v(e && e.title)}" placeholder="Episode 1"></div>
    <div class="field"><label>Episode thumbnail (16:9)</label>
      <div class="pup"><div class="pprev ethumb" id="ePrev">${e && e.thumb_url ? `<img src="${v(e.thumb_url)}" alt="">` : 'No image'}</div>
        <div><label class="btn ghost pbtn">Upload image<input type="file" id="eFile" accept="image/*" hidden></label><button type="button" class="btn ghost pbtn" id="eClear">Remove</button></div></div>
      <input name="thumb_url" id="eUrl" value="${v(e && e.thumb_url)}" placeholder="or paste an image URL">
      <p class="muted" id="eMsg" style="font-size:13px">Any image works, it is cropped to 16:9 automatically.</p></div>
    <button class="btn">${e ? 'Update' : 'Create episode'}</button>
    ${e ? '<button type="button" class="btn ghost" id="cancelE">Cancel</button>' : ''}
    <div id="cmdBox"></div></form>

  <div class="panel"><h2>Reports (${(data.reports || []).length})</h2>
    ${(data.reports || []).length ? data.reports.map(r => `<div class="row"><span>${v(r.episodes && r.episodes.anime ? r.episodes.anime.title : '')} &middot; ${v(r.episodes && r.episodes.title)}<br><small>${v(r.message)} &middot; ${new Date(r.created_at).toLocaleString('en-IN')}</small></span><button class="del ok" data-r="${r.id}">Resolved</button></div>`).join('') : '<p class="muted">No reports yet.</p>'}</div>

  <form class="panel" id="fV"><h2>VIP accounts (${(data.vips || []).length})</h2>
    <p class="muted" style="font-size:13px;margin-top:-6px">VIP users skip the shortener link. Enter the email they used to sign up. After the VIP days end, the user is removed from this list automatically. Adding the same email again renews the days.</p>
    <div class="field"><label>User email</label><input name="email" type="email" required placeholder="user@gmail.com"></div>
    <div class="field"><label>VIP days (empty = lifetime, e.g. 30)</label><input name="days" type="number" min="1" max="3650" placeholder="30"></div>
    <div class="field"><label>Note (optional)</label><input name="note" maxlength="80" placeholder="e.g. paid, friend"></div>
    <button class="btn">Add VIP</button>
    ${(data.vips || []).length ? (data.vips || []).map(x => `<div class="row"><span>${v(x.email)}<br><small>${x.expires_at ? 'Expires ' + new Date(x.expires_at).toLocaleDateString('en-IN') + ' (' + Math.max(0, Math.ceil((new Date(x.expires_at) - Date.now()) / 86400000)) + ' days left)' : 'Lifetime'}${x.note ? ' &middot; ' + v(x.note) : ''}</small></span><button type="button" class="del" data-vip="${v(x.email)}">Remove</button></div>`).join('') : '<p class="muted">No VIP users yet.</p>'}</form>

  <form class="panel" id="fD"><h2>Reset devices</h2>
    <p class="muted" style="font-size:13px;margin-top:-6px">One account works on only 2 devices. If a user changed phone or cleared the browser, enter their email to clear their saved devices.</p>
    <div class="field"><label>User email</label><input name="email" type="email" required placeholder="user@gmail.com"></div>
    <button class="btn">Reset devices</button></form>

  <form class="panel" id="fS"><h2>Site settings</h2>
    <p class="muted" style="font-size:13px;margin-top:-6px">Leave a field empty to hide it on the site. Links must start with https://</p>
    ${inp('telegram', 'Telegram link', 'https://t.me/...')}
    ${inp('whatsapp', 'WhatsApp channel/group link', 'https://whatsapp.com/channel/...')}
    ${inp('instagram', 'Instagram link', 'https://instagram.com/...')}
    ${inp('youtube', 'YouTube link', 'https://youtube.com/...')}
    ${inp('support', 'Support channel link', 'https://t.me/...')}
    ${inp('support_label', 'Support button label', 'Support channel')}
    ${inp('contact_email', 'Contact email (for DMCA)', 'you@email.com')}
    <h2 style="margin-top:18px">Announcement banner (top of home)</h2>
    ${inp('announce_text', 'Banner text', 'New episode is out!')}
    ${inp('announce_link', 'Banner link (optional)', 'https://...')}
    <h2 style="margin-top:18px">Join popup (once a day)</h2>
    ${chk('popup_on', 'Enable popup')}
    ${inp('popup_title', 'Popup title', 'Join our Telegram')}
    <div class="field"><label>Popup text</label><textarea name="popup_text">${v(S.popup_text)}</textarea></div>
    ${inp('popup_link', 'Popup link', 'https://t.me/...')}
    ${inp('popup_btn', 'Button label', 'Join us')}
    <h2 style="margin-top:18px">Other</h2>
    ${chk('age_gate', 'Show 18+ warning popup')}
    <div class="field"><label>Extra information on the contact page</label><textarea name="about_text">${v(S.about_text)}</textarea></div>
    <button class="btn">Save settings</button><p class="muted" id="sMsg">${v(msg)}</p></form>

  <div class="panel"><h2>Saved content</h2>${list.length ? list.map(x => `<div class="row"><span><b>${v(x.title)}</b> <small>${v(x.genre)}</small></span><span><button class="del ed" data-ea="${x.id}">Edit</button> <button class="del" data-a="${x.id}">Delete</button></span></div>
    ${(x.episodes || []).map(ep => `<div class="row sub-eps"><span>${ep.number}. ${v(ep.title)}<br><small>${ep.id}</small></span><span><button class="del ed" data-ee="${ep.id}">Edit</button> <button class="del" data-e="${ep.id}">Delete</button></span></div>`).join('')}`).join('') : '<p class="muted">Nothing added yet.</p>'}
    <p class="muted" style="font-size:12px">Deleting does not remove video files from Backblaze. Remove them there separately.</p></div>`;

  const run = async fn => { try { await fn(); } catch (err) { alert(err.message); } };

  $('#fA').onsubmit = ev => { ev.preventDefault(); run(async () => {
    const f = Object.fromEntries(new FormData(ev.target));
    await post('admin', a ? { action: 'updateAnime', id: a.id, ...f } : { action: 'addAnime', ...f });
    editA = null; await load();
  }); };
  const pUrl = $('#pUrl'), pPrev = $('#pPrev'), pMsg = $('#pMsg');
  const showPrev = () => { pPrev.innerHTML = pUrl.value ? `<img src="${v(pUrl.value)}" alt="">` : 'No image'; };
  pUrl.addEventListener('input', showPrev);
  $('#pClear').onclick = () => { pUrl.value = ''; showPrev(); };
  $('#pFile').onchange = async ev => {
    const file = ev.target.files[0]; if (!file) return;
    try {
      pMsg.textContent = 'Uploading...';
      const bmp = await createImageBitmap(file), sc = Math.min(1, 720 / bmp.width), cv = document.createElement('canvas');
      cv.width = Math.round(bmp.width * sc); cv.height = Math.round(bmp.height * sc);
      cv.getContext('2d').drawImage(bmp, 0, 0, cv.width, cv.height);
      const r = await post('admin', { action: 'uploadPoster', data: cv.toDataURL('image/jpeg', 0.85).split(',')[1] });
      pUrl.value = r.url; showPrev(); pMsg.textContent = 'Uploaded. Press the save button to apply it.';
    } catch (err) { pMsg.textContent = ''; alert(err.message); }
  };
  if ($('#cancelA')) $('#cancelA').onclick = () => { editA = null; render(); };

  $('#fE').onsubmit = ev => { ev.preventDefault(); run(async () => {
    const f = Object.fromEntries(new FormData(ev.target));
    if (e) { await post('admin', { action: 'updateEpisode', id: e.id, number: f.number, title: f.title, thumb_url: f.thumb_url }); editE = null; await load(); return; }
    const r = await post('admin', { action: 'addEpisode', ...f });
    await load();
    $('#cmdBox').innerHTML = `<p class="muted" style="margin:12px 0 0">Episode created. Copy this <b>episode ID</b>:</p><code class="cmd">${r.id}</code><p class="muted" style="font-size:13px">GitHub &rarr; Actions &rarr; Encode episode &rarr; Run workflow. Put this ID in <b>episode_id</b> and the Backblaze file name in <b>source_key</b>.</p>`;
  }); };
  const eUrl = $('#eUrl'), ePrev = $('#ePrev'), eMsg = $('#eMsg');
  const showEPrev = () => { ePrev.innerHTML = eUrl.value ? `<img src="${v(eUrl.value)}" alt="">` : 'No image'; };
  eUrl.addEventListener('input', showEPrev);
  $('#eClear').onclick = () => { eUrl.value = ''; showEPrev(); };
  $('#eFile').onchange = async ev => {
    const file = ev.target.files[0]; if (!file) return;
    try {
      eMsg.textContent = 'Uploading...';
      const bmp = await createImageBitmap(file), W = 640, H = 360, cv = document.createElement('canvas');
      cv.width = W; cv.height = H;
      const sc = Math.max(W / bmp.width, H / bmp.height), dw = bmp.width * sc, dh = bmp.height * sc; // center crop 16:9
      cv.getContext('2d').drawImage(bmp, (W - dw) / 2, (H - dh) / 2, dw, dh);
      const r = await post('admin', { action: 'uploadPoster', data: cv.toDataURL('image/jpeg', 0.85).split(',')[1] });
      eUrl.value = r.url; showEPrev(); eMsg.textContent = 'Uploaded. Press the button below to save.';
    } catch (err) { eMsg.textContent = ''; alert(err.message); }
  };
  if ($('#cancelE')) $('#cancelE').onclick = () => { editE = null; render(); };

  $('#fV').onsubmit = ev => { ev.preventDefault(); run(async () => {
    const f = Object.fromEntries(new FormData(ev.target));
    await post('admin', { action: 'addVip', email: f.email, days: f.days, note: f.note });
    await load();
  }); };
  root.querySelectorAll('[data-vip]').forEach(b => b.onclick = () => run(async () => {
    if (!confirm('Remove VIP from ' + b.dataset.vip + '?')) return;
    await post('admin', { action: 'removeVip', email: b.dataset.vip });
    await load();
  }));

  $('#fD').onsubmit = ev => { ev.preventDefault(); run(async () => {
    const f = Object.fromEntries(new FormData(ev.target));
    const r = await post('admin', { action: 'resetDevices', email: f.email });
    alert('Cleared ' + r.removed + ' saved device(s).');
    ev.target.reset();
  }); };

  $('#fS').onsubmit = ev => { ev.preventDefault(); run(async () => {
    const form = ev.target, settings = {};
    new FormData(form).forEach((val, k) => { settings[k] = val; });
    ['popup_on', 'age_gate'].forEach(k => { settings[k] = form.elements[k].checked ? '1' : '0'; });
    await post('admin', { action: 'saveSettings', settings });
    msg = 'Saved.'; await load(); msg = '';
  }); };

  root.querySelectorAll('[data-ea]').forEach(b => b.onclick = () => { editA = b.dataset.ea; editE = null; render(); $('#fA').scrollIntoView(); });
  root.querySelectorAll('[data-ee]').forEach(b => b.onclick = () => { editE = b.dataset.ee; editA = null; render(); $('#fE').scrollIntoView(); });
  root.querySelectorAll('[data-r]').forEach(b => b.onclick = () => run(async () => { await post('admin', { action: 'resolveReport', id: b.dataset.r }); await load(); }));
  root.querySelectorAll('[data-a],[data-e]').forEach(b => b.onclick = () => run(async () => {
    if (!confirm('Delete this item?')) return;
    await post('admin', b.dataset.a ? { action: 'deleteAnime', id: b.dataset.a } : { action: 'deleteEpisode', id: b.dataset.e });
    await load();
  }));
}
start();
