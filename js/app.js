const app = $('#app'), nav = $('#bottomNav'), topbar = $('#topbar'), modal = $('#modal');
let me = null, pendingToken = null, player = null, S = {};

/* ---------- site settings (links, banner, popup, 18+) ---------- */
const okUrl = u => /^https?:\/\//i.test(u || '');
async function loadSettings() { try { S = await api('settings'); } catch (e) { S = {}; } }
function socialRow() {
  const items = [['telegram', 'Telegram', 'tg'], ['whatsapp', 'WhatsApp', 'wa'], ['instagram', 'Instagram', 'ig'], ['youtube', 'YouTube', 'yt'], ['support', S.support_label || 'Support', 'sp']];
  const h = items.filter(i => okUrl(S[i[0]])).map(i => `<a class="soc ${i[2]}" href="${esc(S[i[0]])}" target="_blank" rel="noopener noreferrer">${esc(i[1])}</a>`).join('');
  return h ? `<div class="socrow">${h}</div>` : '';
}
function bannerHtml() {
  if (!S.announce_text) return '';
  return okUrl(S.announce_link)
    ? `<a class="banner" href="${esc(S.announce_link)}" target="_blank" rel="noopener noreferrer">${esc(S.announce_text)}</a>`
    : `<div class="banner">${esc(S.announce_text)}</div>`;
}
function maybePopup() {
  if (S.popup_on !== '1' || !(S.popup_title || S.popup_text)) return;
  const sig = (S.popup_title || '') + '|' + (S.popup_text || '') + '|' + (S.popup_link || '');
  try { const v = JSON.parse(localStorage.getItem('bd_popup') || '{}'); if (v.sig === sig && Date.now() - v.t < 864e5) return; } catch (e) { /* ignore */ }
  showModal(`<h3>${esc(S.popup_title || 'Join karo')}</h3><p>${esc(S.popup_text || '')}</p>
    ${okUrl(S.popup_link) ? `<a class="btn" id="pGo" href="${esc(S.popup_link)}" target="_blank" rel="noopener noreferrer">${esc(S.popup_btn || 'Join karo')}</a>` : ''}
    <button class="btn ghost" id="pNo">Baad mein</button>`);
  try { localStorage.setItem('bd_popup', JSON.stringify({ sig, t: Date.now() })); } catch (e) { /* ignore */ }
  $('#pNo').onclick = closeModal; const g = $('#pGo'); if (g) g.onclick = closeModal;
}
function ageGate() {
  if (S.age_gate === '0') return Promise.resolve();
  try { if (localStorage.getItem('bd_age') === '1') return Promise.resolve(); } catch (e) { /* ignore */ }
  return new Promise(res => {
    const g = document.createElement('div'); g.className = 'agegate';
    g.innerHTML = `<div class="agebox"><h2>18+ warning</h2><p>Is site par sirf badon (18 saal ya usse zyada) ke liye content ho sakta hai. Kya aap 18+ ho?</p>
      <button class="btn" id="ageY">Haan, main 18+ hoon</button><button class="btn ghost" id="ageN">Nahi</button></div>`;
    document.body.appendChild(g);
    $('#ageY').onclick = () => { try { localStorage.setItem('bd_age', '1'); } catch (e) { /* ignore */ } g.remove(); res(); };
    $('#ageN').onclick = () => { g.querySelector('.agebox').innerHTML = '<h2>Maaf kijiye</h2><p>Is site ko dekhne ke liye 18+ hona zaroori hai.</p>'; };
  });
}
function openReport(episodeId) {
  showModal(`<h3>Problem report karo</h3><p>Kya dikkat aa rahi hai?</p>
    <select id="rWhy"><option>Video chal nahi raha</option><option>Awaaz nahi aa rahi</option><option>Galat episode ya galat title</option><option>Doosri dikkat</option></select>
    <textarea id="rMsg" maxlength="200" placeholder="Aur kuch batana ho to likho (zaroori nahi)" style="margin-top:10px"></textarea>
    <button class="btn" id="rGo">Bhejo</button><button class="btn ghost" id="rNo">Cancel</button>`);
  $('#rNo').onclick = closeModal;
  $('#rGo').onclick = async () => {
    const why = $('#rWhy').value, extra = $('#rMsg').value.trim();
    $('#rGo').disabled = true; $('#rGo').textContent = 'Bhej rahe hain...';
    try {
      await post('report', { episodeId, message: why + (extra ? ': ' + extra : '') });
      showModal('<h3>Shukriya!</h3><p>Aapki report mil gayi. Hum jaldi dekhenge.</p><button class="btn" id="rOk">Theek hai</button>');
    } catch (e) {
      showModal(`<h3>Report nahi gayi</h3><p>${esc(e.message)}</p><button class="btn" id="rOk">Theek hai</button>`);
    }
    $('#rOk').onclick = closeModal;
  };
}

/* ---------- helpers ---------- */
function posterHtml(a) {
  return a.poster_url ? `<img src="${esc(a.poster_url)}" alt="${esc(a.title)}" loading="lazy">` : `<span class="ph">${esc((a.title || '?')[0])}</span>`;
}
function chrome(show, tab) {
  nav.hidden = topbar.hidden = !show;
  nav.querySelectorAll('a').forEach(a => a.classList.toggle('on', a.dataset.tab === tab));
}
function showModal(html) { modal.innerHTML = `<div class="sheet">${html}</div>`; modal.hidden = false; }
function closeModal() { modal.hidden = true; modal.innerHTML = ''; }
modal.addEventListener('click', e => { if (e.target === modal) closeModal(); });
function loading(msg) { app.innerHTML = `<div class="center"><div class="spin"></div><p>${esc(msg || 'Loading...')}</p></div>`; }
function stopPlayer() {
  if (!player) return;
  clearInterval(player.timer); clearInterval(player.wmTimer); clearTimeout(player.hideT);
  if (player.hls) player.hls.destroy();
  if (player.kd) document.removeEventListener('keydown', player.kd);
  if (player.fsc) document.removeEventListener('fullscreenchange', player.fsc);
  document.body.classList.remove('nos');
  if (document.fullscreenElement && document.exitFullscreen) document.exitFullscreen().catch(() => {});
  player = null;
}

/* ---------- password reset ---------- */
function forgotScreen() {
  stopPlayer(); chrome(false);
  app.innerHTML = `<section class="auth">
    <h1 class="auth-brand">Password<span> reset</span></h1>
    <p class="auth-sub">Apna registered email likho. Hum password badalne ka link bhejenge.</p>
    <div class="field"><label>Email</label><input id="fEmail" type="email" autocomplete="email" placeholder="you@example.com"></div>
    <p class="msg" id="fMsg"></p>
    <button class="btn" id="fGo">Reset link bhejo</button>
    <button class="btn ghost" id="fBack">Wapas login par</button>
  </section>`;
  $('#fBack').onclick = () => authScreen('login');
  $('#fGo').onclick = async () => {
    const email = $('#fEmail').value.trim(), msg = $('#fMsg');
    if (!email) { msg.textContent = 'Email likho.'; return; }
    $('#fGo').disabled = true; msg.style.color = ''; msg.textContent = 'Ek second...';
    const { error } = await sb.auth.resetPasswordForEmail(email, { redirectTo: location.origin });
    $('#fGo').disabled = false;
    if (error) { msg.textContent = error.message; return; }
    msg.style.color = '#6ee7a1';
    msg.textContent = 'Agar ye email registered hai, to reset link bhej diya gaya hai. Inbox aur spam dono dekho.';
  };
}
function recoveryScreen() {
  stopPlayer(); chrome(false);
  app.innerHTML = `<section class="auth">
    <h1 class="auth-brand">Naya<span> password</span></h1>
    <p class="auth-sub">Apna naya password daalo.</p>
    <div class="field"><label>Naya password</label><input id="nPass" type="password" autocomplete="new-password" placeholder="Kam se kam 6 characters"></div>
    <div class="field"><label>Dobara likho</label><input id="nPass2" type="password" autocomplete="new-password"></div>
    <p class="msg" id="nMsg"></p>
    <button class="btn" id="nGo">Password badlo</button>
  </section>`;
  $('#nGo').onclick = async () => {
    const p1 = $('#nPass').value, p2 = $('#nPass2').value, msg = $('#nMsg');
    if (p1.length < 6) { msg.textContent = 'Password kam se kam 6 character ka rakho.'; return; }
    if (p1 !== p2) { msg.textContent = 'Dono password alag hain.'; return; }
    $('#nGo').disabled = true; msg.textContent = 'Ek second...';
    const { error } = await sb.auth.updateUser({ password: p1 });
    if (error) { $('#nGo').disabled = false; msg.textContent = error.message; return; }
    window.BD_RECOVERY = false; history.replaceState(null, '', location.pathname);
    me = null; const { data } = await sb.auth.getSession(); boot(data.session);
  };
}

/* ---------- auth ---------- */
function authScreen(mode) {
  stopPlayer(); chrome(false);
  const signup = mode === 'signup';
  app.innerHTML = `<section class="auth">
    <h1 class="auth-brand">Bentai<span>Dubber</span></h1>
    <p class="auth-sub">${signup ? 'Account banao aur dubbed anime dekho.' : 'Login karo aur dubbed anime dekho.'}</p>
    <div class="tabs"><button class="${signup ? '' : 'on'}" data-m="login">Login</button><button class="${signup ? 'on' : ''}" data-m="signup">Sign up</button></div>
    <div class="field ${signup ? '' : 'hide'}"><label>Naam</label><input id="aName" autocomplete="name" placeholder="Aapka naam"></div>
    <div class="field"><label>Email</label><input id="aEmail" type="email" autocomplete="email" placeholder="you@example.com"></div>
    <div class="field"><label>Password</label><input id="aPass" type="password" autocomplete="${signup ? 'new-password' : 'current-password'}" placeholder="Kam se kam 6 characters"></div>
    <p class="msg" id="aMsg"></p>
    <button class="btn" id="aGo">${signup ? 'Account banao' : 'Login karo'}</button>
    ${signup ? '' : '<div style="text-align:center"><button type="button" id="aForgot" style="background:none;border:0;color:#d6bbfb;font:inherit;font-size:13px;margin-top:12px;padding:6px;cursor:pointer">Password bhool gaye?</button></div>'}
  </section>`;
  const fg = $('#aForgot'); if (fg) fg.onclick = forgotScreen;
  app.querySelectorAll('.tabs button').forEach(b => b.onclick = () => authScreen(b.dataset.m));
  const msg = $('#aMsg');
  $('#aGo').onclick = async () => {
    const email = $('#aEmail').value.trim(), password = $('#aPass').value;
    if (!email || password.length < 6) { msg.textContent = 'Email aur 6+ character ka password daalo.'; return; }
    msg.textContent = 'Ek second...';
    if (signup) {
      const name = $('#aName').value.trim();
      const { data, error } = await sb.auth.signUp({ email, password, options: { data: { name } } });
      if (error) { msg.textContent = error.message; return; }
      if (!data.session) { msg.textContent = 'Email par confirmation link bheja hai. Confirm karke login karo.'; return; }
    } else {
      const { error } = await sb.auth.signInWithPassword({ email, password });
      if (error) { msg.textContent = 'Email ya password galat hai.'; return; }
    }
  };
}

/* ---------- home ---------- */
async function home() {
  stopPlayer(); chrome(true, 'home'); loading('Anime la rahe hain...');
  try {
    const { anime, latest } = await api('anime');
    const gOf = a => String(a.genre || '').split(',').map(x => x.trim()).filter(Boolean);
    const genres = [...new Set(anime.flatMap(gOf))].sort();
    let gsel = 'Sab';
    app.innerHTML = `<section class="page">
      ${bannerHtml()}${socialRow()}
      <div class="search"><svg viewBox="0 0 24 24"><circle cx="11" cy="11" r="7"/><path d="M20 20l-4-4"/></svg><input id="q" placeholder="Anime ka naam search karo" autocomplete="off"></div>
      ${genres.length ? `<div class="chips" id="chips">${['Sab', ...genres].map(g => `<button class="chipb ${g === 'Sab' ? 'on' : ''}" data-g="${esc(g)}">${esc(g)}</button>`).join('')}</div>` : ''}
      ${latest && latest.length ? `<h2 class="h2s">Naye episodes</h2><div class="hrow">${latest.map(e => { const an = e.anime || {}; return `<button class="lt" data-id="${e.id}">
        <div class="ltp">${an.poster_url ? `<img src="${esc(an.poster_url)}" alt="" loading="lazy">` : ''}<b class="num">Ep ${e.number}</b></div>
        <div class="ltt"><b>${esc(e.title)}</b><small>${esc(an.title || '')}</small></div></button>`; }).join('')}</div>` : ''}
      <h2 class="h2s">Saare anime</h2>
      <div class="grid" id="grid"></div>
      <p class="foot"><a href="#/about">Disclaimer</a> &middot; <a href="#/about">DMCA</a> &middot; <a href="#/about">Contact</a></p></section>`;
    const grid = $('#grid');
    const draw = () => {
      const q = $('#q').value.trim().toLowerCase();
      const rows = anime.filter(a => a.title.toLowerCase().includes(q) && (gsel === 'Sab' || gOf(a).includes(gsel)));
      grid.innerHTML = rows.length ? rows.map(a => `<a class="card" href="#/anime/${a.id}">
        <div class="poster">${posterHtml(a)}<b class="badge">${a.episodeCount} ep</b></div>
        <div class="card-t"><h3>${esc(a.title)}</h3><small>${esc(a.genre)}</small></div></a>`).join('')
        : `<p class="empty">${anime.length ? 'Is naam ka koi anime nahi mila.' : 'Abhi koi anime add nahi hua.'}</p>`;
    };
    $('#q').addEventListener('input', draw);
    app.querySelectorAll('.chipb').forEach(b => b.onclick = () => {
      gsel = b.dataset.g; app.querySelectorAll('.chipb').forEach(x => x.classList.toggle('on', x === b)); draw();
    });
    app.querySelectorAll('.lt').forEach(b => b.onclick = () => askUnlock(b.dataset.id));
    draw(); maybePopup();
  } catch (e) { app.innerHTML = `<div class="center"><p>${esc(e.message)}</p></div>`; }
}

/* ---------- anime page ---------- */
async function animePage(id) {
  stopPlayer(); chrome(true, 'home'); loading();
  try {
    const { anime, episodes } = await api('anime?id=' + encodeURIComponent(id));
    app.innerHTML = `<section class="page">
      <a class="back" href="#/">Wapas</a>
      <div class="detail"><div class="poster big">${posterHtml(anime)}</div>
        <div><h1>${esc(anime.title)}</h1><small class="genre">${esc(anime.genre)}</small><p class="desc">${esc(anime.description)}</p></div></div>
      <h2 class="h2">Episodes</h2>
      <div class="eps">${episodes.length ? episodes.map(e => `<button class="ep" data-id="${e.id}"><span class="n">${e.number}</span><span class="t">${esc(e.title)}</span><span class="go">Watch</span></button>`).join('')
        : '<p class="empty">Is anime ke episodes jaldi aayenge.</p>'}</div></section>`;
    app.querySelectorAll('.ep').forEach(b => b.onclick = () => askUnlock(b.dataset.id));
  } catch (e) { app.innerHTML = `<div class="center"><p>${esc(e.message)}</p><a class="btn" href="#/">Home par jao</a></div>`; }
}

/* ---------- shortener unlock ---------- */
function askUnlock(episodeId) {
  showModal(`<h3>Episode kholne ke liye</h3>
    <p>Ek chhota short link complete karna hoga. Complete karne ke baad ye episode <b>1 ghante</b> tak dekh sakte ho.</p>
    <button class="btn" id="mGo">Link kholo</button><button class="btn ghost" id="mNo">Abhi nahi</button>`);
  $('#mNo').onclick = closeModal;
  $('#mGo').onclick = async () => {
    $('#mGo').disabled = true; $('#mGo').textContent = 'Link ban raha hai...';
    try {
      const r = await post('start', { episodeId });
      if (r.direct) { closeModal(); location.hash = '#/watch/' + episodeId; }
      else location.href = r.url;
    } catch (e) {
      showModal(`<h3>Link nahi khula</h3><p>${esc(e.message)}</p><button class="btn" id="mOk">Theek hai</button>`);
      $('#mOk').onclick = closeModal;
    }
  };
}

async function verifyScreen(token) {
  stopPlayer(); chrome(false); loading('Link check ho raha hai...');
  history.replaceState(null, '', location.pathname);
  try {
    const r = await post('verify', { token });
    location.hash = '#/watch/' + r.episodeId;
  } catch (e) {
    app.innerHTML = `<div class="center"><h3>Verify nahi hua</h3><p>${esc(e.message)}</p><a class="btn" href="#/">Home par jao</a></div>`;
  }
}

/* ---------- watch ---------- */
const IC = {
  play: '<svg viewBox="0 0 24 24"><path d="M8 5v14l11-7z"/></svg>',
  pause: '<svg viewBox="0 0 24 24"><path d="M6 5h4v14H6zM14 5h4v14h-4z"/></svg>',
  replay: '<svg viewBox="0 0 24 24"><path class="st" d="M12 5V2L7 6l5 4V7a6 6 0 1 1-6 6"/><text x="12" y="16.4" text-anchor="middle" font-size="7.5" font-weight="700">10</text></svg>',
  forward: '<svg viewBox="0 0 24 24"><path class="st" d="M12 5V2l5 4-5 4V7a6 6 0 1 0 6 6"/><text x="12" y="16.4" text-anchor="middle" font-size="7.5" font-weight="700">10</text></svg>',
  vol: '<svg viewBox="0 0 24 24"><path d="M3 9v6h4l5 4V5L7 9z"/><path class="st" d="M16 8.5a5 5 0 0 1 0 7M18.5 6a8.5 8.5 0 0 1 0 12"/></svg>',
  mute: '<svg viewBox="0 0 24 24"><path d="M3 9v6h4l5 4V5L7 9z"/><path class="st" d="M16 9l5 6M21 9l-5 6"/></svg>',
  fsIn: '<svg viewBox="0 0 24 24"><path class="st" d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5"/></svg>',
  fsOut: '<svg viewBox="0 0 24 24"><path class="st" d="M9 4v5H4M15 4v5h5M9 20v-5H4M15 20v-5h5"/></svg>',
  more: '<svg viewBox="0 0 24 24"><circle cx="12" cy="5" r="2"/><circle cx="12" cy="12" r="2"/><circle cx="12" cy="19" r="2"/></svg>'
};
const SPEEDS = [[0.5, '0.5x'], [0.75, '0.75x'], [1, 'Normal'], [1.25, '1.25x'], [1.5, '1.5x'], [2, '2x']];
const fmtTime = s => {
  if (!isFinite(s) || s < 0) s = 0; s = Math.floor(s);
  const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), x = s % 60;
  return (h ? h + ':' + String(m).padStart(2, '0') : m) + ':' + String(x).padStart(2, '0');
};
function friendlyError(d) {
  const code = d.response && d.response.code;
  let apiMsg = '';
  // hls.js ka response.text sirf "Not Found" jaisa status deta hai; asli jawab networkDetails.responseText mein hota hai
  const bodies = [];
  try { bodies.push(d.networkDetails && d.networkDetails.responseText); } catch (e) { /* arraybuffer wale request par responseText padhna error deta hai */ }
  bodies.push(d.response && d.response.text);
  bodies.forEach(b => {
    if (apiMsg) return;
    try { apiMsg = JSON.parse(b).error || ''; } catch (e) { /* not json */ }
  });
  const det = d.details || d.type || 'error';
  let msg;
  if (det === 'manifestLoadError') msg = apiMsg || (code === 403 ? 'Access khatam ho gaya. Episode dobara unlock karo.' : 'Video ki playlist nahi mili.');
  else if (det === 'keyLoadError') msg = 'Video unlock karne ki key nahi mili. (KEY_SECRET aur SITE_URL check karo)';
  else if (det === 'fragDecryptError' || det === 'fragParsingError') msg = 'Video decrypt nahi ho paya. Ho sakta hai GitHub aur Vercel ka KEY_SECRET alag ho (dono bilkul same hone chahiye).';
  else if (det === 'fragLoadError' || det === 'fragLoadTimeOut') msg = 'Video ke tukde load nahi hue. Internet ya Backblaze CORS check karo.';
  else msg = 'Video chalne mein dikkat aayi.';
  return { msg, det: det + (code ? ' (' + code + ')' : '') };
}

async function watch(id) {
  stopPlayer(); chrome(false); loading('Video taiyaar ho raha hai...');
  let info;
  try { info = await api('play?e=' + encodeURIComponent(id)); }
  catch (e) {
    app.innerHTML = `<div class="center"><h3>${e.status === 403 ? 'Episode locked hai' : 'Video nahi khula'}</h3>
      <p>${e.status === 403 ? 'Access ka 1 ghanta khatam ho gaya, ya link complete nahi hua.' : esc(e.message)}</p>
      ${e.status === 403 ? '<button class="btn" id="relock">Dobara unlock karo</button>' : ''}<a class="btn ghost" href="#/">Home par jao</a></div>`;
    const b = $('#relock'); if (b) b.onclick = () => askUnlock(id);
    return;
  }

  app.innerHTML = `<section class="watch"><div class="wgrid"><div class="wmain">
    <div class="player" id="pl">
      <video id="vid" playsinline webkit-playsinline preload="auto" disablePictureInPicture controlsList="nodownload noremoteplayback"></video>
      <div class="wm" id="wm">${esc(info.watermark)}</div>
      <div class="tap" id="tap"></div>
      <div class="fx l" id="fxl">&laquo; 10 sec</div><div class="fx r" id="fxr">10 sec &raquo;</div>
      <div class="buf" id="buf"><div class="spin"></div></div>
      <div class="ctrls" id="ctrls">
        <div class="ptop"><span class="ptitle">${esc(info.animeTitle)} &middot; ${esc(info.title)}</span>
          <button class="cb sm" id="gear" aria-label="Settings">${IC.more}</button></div>
        <div class="mid">
          <button class="cb" id="bk" aria-label="10 second peeche">${IC.replay}</button>
          <button class="cb big" id="pp" aria-label="Play ya pause">${IC.play}</button>
          <button class="cb" id="fw" aria-label="10 second aage">${IC.forward}</button>
        </div>
        <div class="bot">
          <div class="row2">
            <span class="tm"><span id="tcur">0:00</span> / <span id="tdur">0:00</span></span>
            <span class="gap"></span>
            <button class="cb sm" id="mute" aria-label="Awaaz">${IC.vol}</button>
            <button class="cb sm" id="fs" aria-label="Fullscreen">${IC.fsIn}</button>
          </div>
          <div class="seek" id="seek"><div class="sb" id="sbuf"></div><div class="sf" id="sfill"></div><div class="sk" id="sknob"></div></div>
        </div>
      </div>
      <div class="mini" id="mini"><i id="minif"></i></div>
      <div class="menu" id="menu" hidden><div class="mh">Playback speed</div>${SPEEDS.map(s => `<button data-s="${s[0]}" class="${s[0] === 1 ? 'on' : ''}">${s[1]}</button>`).join('')}</div>
      <div class="msgbox" id="err" hidden><h3 id="errmsg"></h3><small id="errdet"></small><button class="btn" id="retry">Dobara try karo</button><button class="btn ghost" id="errrep">Problem report karo</button></div>
      <div class="msgbox" id="nextbox" hidden><h3>Episode khatam</h3><p id="nextname"></p><button class="btn" id="nextgo">Agla episode dekho</button><button class="btn ghost" id="replay">Dobara dekho</button></div>
      <div class="msgbox" id="exp" hidden><h3>1 ghanta khatam</h3><p>Dobara dekhne ke liye episode phir se unlock karo.</p><a class="btn" href="#/">Home par jao</a></div>
    </div>
    <div class="winfo">
      <h1 class="wtitle">${esc(info.title)}</h1>
      <div class="wmeta"><span>${esc(info.animeTitle)}</span><span class="chip" id="left"></span></div>
      <div class="wact"><button class="pill nx" id="nextbtn" hidden>Agla episode &rsaquo;</button><a class="pill" href="#/anime/${esc(info.animeId)}">Anime page</a><button class="pill" id="repbtn">Problem report</button><a class="pill" href="#/">Home</a></div>
      ${socialRow()}
    </div></div>
    <aside class="upnext"><h2>Agle episodes</h2><div id="upl"><p class="muted">Loading...</p></div></aside>
  </div></section>`;

  const video = $('#vid'), pl = $('#pl'), wm = $('#wm'), ctrls = $('#ctrls'), pp = $('#pp'), seek = $('#seek'), menu = $('#menu');
  const sfill = $('#sfill'), sknob = $('#sknob'), sbuf = $('#sbuf'), tcur = $('#tcur'), tdur = $('#tdur'), buf = $('#buf'), minif = $('#minif');
  const P = player = { hls: null, timer: null, wmTimer: null, hideT: null, recovered: false, done: false, next: null };
  let dragging = false;
  pl.addEventListener('contextmenu', e => e.preventDefault());

  /* --- agle episodes (YouTube ke "up next" jaisa) --- */
  api('anime?id=' + encodeURIComponent(info.animeId)).then(r => {
    if (player !== P) return;
    $('#upl').innerHTML = r.episodes.map(e => `<button class="un ${e.id === id ? 'cur' : ''}" data-id="${e.id}">
      <div class="unp">${r.anime.poster_url ? `<img src="${esc(r.anime.poster_url)}" alt="" loading="lazy">` : ''}<b class="num">Ep ${e.number}</b></div>
      <div class="unt"><b>${esc(e.title)}</b><small>${e.id === id ? 'Abhi chal raha hai' : esc(r.anime.title)}</small></div></button>`).join('') || '<p class="muted">Aur episodes nahi hain.</p>';
    $('#upl').querySelectorAll('.un').forEach(b => { if (b.dataset.id !== id) b.onclick = () => askUnlock(b.dataset.id); });
    const ix = r.episodes.findIndex(e => e.id === id);
    P.next = ix >= 0 ? r.episodes[ix + 1] || null : null;
    if (P.next) { const nb = $('#nextbtn'); nb.hidden = false; nb.onclick = () => askUnlock(P.next.id); }
  }).catch(() => { const u = $('#upl'); if (u) u.innerHTML = ''; });

  /* --- helpers --- */
  const showErr = e => {
    if (P.done) return;
    $('#errmsg').textContent = e.msg; $('#errdet').textContent = 'Code: ' + e.det;
    $('#err').hidden = false; buf.classList.add('hide'); ctrls.classList.add('hide');
  };
  $('#retry').onclick = () => watch(id);
  $('#repbtn').onclick = () => openReport(id);
  $('#errrep').onclick = () => openReport(id);
  $('#nextgo').onclick = () => { if (P.next) askUnlock(P.next.id); };
  $('#replay').onclick = () => { $('#nextbox').hidden = true; video.currentTime = 0; video.play().catch(() => {}); };
  const showCtrls = (auto = true) => {
    ctrls.classList.remove('hide'); clearTimeout(P.hideT);
    if (auto && !video.paused) P.hideT = setTimeout(() => ctrls.classList.add('hide'), 3000);
  };
  const toggleCtrls = () => {
    if (ctrls.classList.contains('hide')) showCtrls();
    else { ctrls.classList.add('hide'); clearTimeout(P.hideT); }
  };
  const togglePlay = () => { if (video.paused || video.ended) video.play().catch(() => {}); else video.pause(); };
  const flash = el => { el.classList.remove('go'); void el.offsetWidth; el.classList.add('go'); };
  const skip = s => {
    const d = video.duration || 0;
    video.currentTime = Math.max(0, Math.min(d || 1e9, video.currentTime + s));
    flash(s < 0 ? $('#fxl') : $('#fxr'));
  };
  const paintTime = () => {
    const d = video.duration;
    tdur.textContent = fmtTime(d);
    if (dragging) return;
    tcur.textContent = fmtTime(video.currentTime);
    const p = isFinite(d) && d > 0 ? video.currentTime / d : 0;
    sfill.style.width = (p * 100) + '%'; sknob.style.left = (p * 100) + '%'; minif.style.width = (p * 100) + '%';
    let be = 0;
    for (let i = 0; i < video.buffered.length; i++) {
      if (video.buffered.start(i) <= video.currentTime + 0.5 && video.buffered.end(i) >= be) be = video.buffered.end(i);
    }
    sbuf.style.width = (isFinite(d) && d > 0 ? Math.min(100, be / d * 100) : 0) + '%';
  };

  /* --- buttons --- */
  pp.onclick = togglePlay;
  $('#bk').onclick = () => skip(-10);
  $('#fw').onclick = () => skip(10);
  $('#mute').onclick = () => { video.muted = !video.muted; };
  ctrls.addEventListener('pointerdown', () => showCtrls());

  /* --- settings menu (speed) --- */
  $('#gear').onclick = () => { menu.hidden = !menu.hidden; showCtrls(false); };
  menu.querySelectorAll('button').forEach(b => b.onclick = () => {
    video.playbackRate = Number(b.dataset.s);
    menu.querySelectorAll('button').forEach(x => x.classList.toggle('on', x === b));
    menu.hidden = true; showCtrls();
  });

  /* --- tap: ek tap = controls, double tap = skip / play --- */
  let lastTap = 0, lastX = 0;
  $('#tap').addEventListener('click', e => {
    if (!menu.hidden) { menu.hidden = true; return; }
    const r = pl.getBoundingClientRect(), x = (e.clientX - r.left) / r.width, now = Date.now();
    if (now - lastTap < 320 && Math.abs(x - lastX) < 0.25) {
      lastTap = 0;
      if (x < 0.4) skip(-10); else if (x > 0.6) skip(10); else togglePlay();
      return;
    }
    lastTap = now; lastX = x; toggleCtrls();
  });

  /* --- seek bar (drag) --- */
  const ratio = e => { const r = seek.getBoundingClientRect(); return Math.min(1, Math.max(0, (e.clientX - r.left) / r.width)); };
  const preview = e => {
    const d = video.duration; if (!isFinite(d)) return;
    const p = ratio(e); sfill.style.width = (p * 100) + '%'; sknob.style.left = (p * 100) + '%'; tcur.textContent = fmtTime(p * d);
  };
  seek.addEventListener('pointerdown', e => { dragging = true; seek.classList.add('drag'); try { seek.setPointerCapture(e.pointerId); } catch (x) {} preview(e); showCtrls(false); });
  seek.addEventListener('pointermove', e => { if (dragging) preview(e); });
  seek.addEventListener('pointerup', e => {
    if (!dragging) return; dragging = false; seek.classList.remove('drag');
    const d = video.duration; if (isFinite(d)) video.currentTime = ratio(e) * d;
    paintTime(); showCtrls();
  });
  seek.addEventListener('pointercancel', () => { dragging = false; seek.classList.remove('drag'); });

  /* --- fullscreen (watermark bana rahe isliye player div ko fullscreen karte hain) --- */
  const isFs = () => !!(document.fullscreenElement || document.webkitFullscreenElement) || pl.classList.contains('pfs');
  const syncFs = () => { $('#fs').innerHTML = isFs() ? IC.fsOut : IC.fsIn; pl.classList.toggle('fsmode', isFs()); };
  const toggleFs = () => {
    if (pl.classList.contains('pfs')) { pl.classList.remove('pfs'); document.body.classList.remove('nos'); syncFs(); return; }
    if (document.fullscreenElement || document.webkitFullscreenElement) {
      (document.exitFullscreen || document.webkitExitFullscreen).call(document);
      if (screen.orientation && screen.orientation.unlock) try { screen.orientation.unlock(); } catch (e) {}
      return;
    }
    const req = pl.requestFullscreen || pl.webkitRequestFullscreen;
    if (req) {
      const p = req.call(pl);
      const lock = () => { if (screen.orientation && screen.orientation.lock) screen.orientation.lock('landscape').catch(() => {}); };
      if (p && p.then) p.then(lock).catch(() => {}); else lock();
    } else { pl.classList.add('pfs'); document.body.classList.add('nos'); syncFs(); }  // iPhone jaisa fallback
  };
  $('#fs').onclick = toggleFs;
  P.fsc = syncFs;
  document.addEventListener('fullscreenchange', P.fsc);

  /* --- keyboard (computer par) --- */
  P.kd = e => {
    if (e.target && /INPUT|TEXTAREA/.test(e.target.tagName)) return;
    const k = e.key;
    if (k === ' ' || k === 'k') { e.preventDefault(); togglePlay(); }
    else if (k === 'ArrowLeft') skip(-10);
    else if (k === 'ArrowRight') skip(10);
    else if (k === 'f') toggleFs();
    else if (k === 'm') video.muted = !video.muted;
    else return;
    showCtrls();
  };
  document.addEventListener('keydown', P.kd);

  /* --- video events --- */
  video.addEventListener('play', () => { pp.innerHTML = IC.pause; $('#nextbox').hidden = true; showCtrls(); });
  video.addEventListener('pause', () => { pp.innerHTML = IC.play; showCtrls(false); });
  video.addEventListener('ended', () => {
    pp.innerHTML = IC.play;
    if (P.next) { $('#nextname').textContent = P.next.title; $('#nextbox').hidden = false; ctrls.classList.add('hide'); } else showCtrls(false);
  });
  video.addEventListener('volumechange', () => { $('#mute').innerHTML = video.muted || video.volume === 0 ? IC.mute : IC.vol; });
  ['timeupdate', 'progress', 'durationchange', 'loadedmetadata'].forEach(ev => video.addEventListener(ev, paintTime));
  ['waiting', 'seeking', 'loadstart'].forEach(ev => video.addEventListener(ev, () => buf.classList.remove('hide')));
  ['playing', 'canplay', 'seeked', 'loadeddata'].forEach(ev => video.addEventListener(ev, () => buf.classList.add('hide')));
  video.addEventListener('error', () => showErr({ msg: 'Video chalne mein dikkat aayi.', det: 'video-element' }));

  /* --- HLS --- */
  const tok = await accessToken();
  if (player !== P) return;  // user beech mein hat gaya
  if (window.Hls && Hls.isSupported()) {
    const hls = new Hls({
      maxBufferLength: 40,
      xhrSetup: (xhr, url) => { if (url.indexOf('/api/') !== -1) xhr.setRequestHeader('Authorization', 'Bearer ' + tok); }
    });
    hls.loadSource(info.playlist); hls.attachMedia(video);
    hls.on(Hls.Events.MANIFEST_PARSED, () => { video.play().catch(() => {}); });
    hls.on(Hls.Events.ERROR, (_, d) => {
      if (!d.fatal) return;
      if (d.type === Hls.ErrorTypes.MEDIA_ERROR && !P.recovered) { P.recovered = true; hls.recoverMediaError(); return; }
      try { showErr(friendlyError(d)); } catch (x) { showErr({ msg: 'Video chalne mein dikkat aayi.', det: String(d.details || d.type || 'error') }); }
    });
    P.hls = hls;
  } else {
    showErr({ msg: 'Ye browser supported nahi hai. Chrome ya updated Safari (iOS 17.1+) use karo.', det: 'no-mse' });
  }

  /* --- watermark: har kuch second mein jagah badalta hai --- */
  const moveWm = () => { wm.style.left = (5 + Math.random() * 60) + '%'; wm.style.top = (8 + Math.random() * 70) + '%'; };
  moveWm(); P.wmTimer = setInterval(moveWm, 7000);

  /* --- 1 ghante ka timer --- */
  const end = new Date(info.expiresAt).getTime();
  const tick = () => {
    const s = Math.max(0, Math.round((end - Date.now()) / 1000));
    if (s <= 0) {
      P.done = true; video.pause(); if (P.hls) P.hls.destroy(); video.removeAttribute('src'); video.load();
      if (document.fullscreenElement) document.exitFullscreen();
      pl.classList.remove('pfs'); document.body.classList.remove('nos');
      ctrls.classList.add('hide'); buf.classList.add('hide'); menu.hidden = true; $('#err').hidden = true; $('#exp').hidden = false;
      $('#left').textContent = ''; clearInterval(P.timer); return;
    }
    $('#left').textContent = `Access: ${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')} baaki`;
  };
  tick(); P.timer = setInterval(tick, 1000);
}

/* ---------- me ---------- */
function meScreen() {
  stopPlayer(); chrome(true, 'me');
  app.innerHTML = `<section class="page"><div class="me"><div class="avatar">${esc((me.name || '?')[0].toUpperCase())}</div>
    <h2>${esc(me.name)}</h2><p class="muted">${esc(me.email)}</p></div>
    ${socialRow()}
    ${me.isAdmin ? '<a class="btn" href="admin.html">Admin panel</a>' : ''}
    <button class="btn ghost" id="out">Logout</button>
    <p class="foot"><a href="#/about">Disclaimer, DMCA aur Contact</a></p></section>`;
  $('#out').onclick = () => sb.auth.signOut();
}

/* ---------- about / legal ---------- */
function aboutScreen() {
  stopPlayer(); chrome(true, 'me');
  const mail = S.contact_email ? `<a href="mailto:${esc(S.contact_email)}">${esc(S.contact_email)}</a>` : 'Admin se social links par sampark karein.';
  app.innerHTML = `<section class="page legal"><a class="back" href="#/me">Wapas</a><h1>Disclaimer, DMCA aur Contact</h1>
    <h2>Disclaimer</h2><p>Is site par dikhaya gaya content uploader dwara daala jaata hai. Site kisi anime ya video par apne maalikana haq ka daava nahi karti.${S.age_gate !== '0' ? ' Ye site sirf 18+ users ke liye hai.' : ''}</p>
    <h2>DMCA / Content hatwana</h2><p>Agar aap kisi content ke rights holder hain aur aapko lagta hai ki wo bina ijazat daala gaya hai, to niche diye contact par episode ka naam aur apne haq ka saboot bhejein. Jaanch ke baad content hata diya jaayega.</p>
    <h2>Contact</h2><p>${mail}</p>
    ${S.about_text ? `<h2>Aur jaankari</h2><p>${esc(S.about_text).replace(/\n/g, '<br>')}</p>` : ''}
    ${socialRow()}</section>`;
}

/* ---------- router ---------- */
function route() {
  if (!me) return;
  const h = location.hash.replace(/^#\/?/, '').split('/');
  if (h[0] === 'anime' && h[1]) return animePage(h[1]);
  if (h[0] === 'watch' && h[1]) return watch(h[1]);
  if (h[0] === 'me') return meScreen();
  if (h[0] === 'about') return aboutScreen();
  return home();
}
window.addEventListener('hashchange', () => { closeModal(); route(); });

async function boot(session) {
  if (!session) { me = null; return authScreen('login'); }
  if (window.BD_RECOVERY) return recoveryScreen();
  try { me = await api('me'); } catch (e) { me = null; return authScreen('login'); }
  if (pendingToken) { const t = pendingToken; pendingToken = null; return verifyScreen(t); }
  route();
}

(async function init() {
  const t = new URLSearchParams(location.search).get('t');
  if (t) pendingToken = t;
  setTimeout(() => { const sp = $('#splash'); if (sp) { sp.classList.add('out'); setTimeout(() => sp.remove(), 500); } }, 1300);
  await loadSettings();
  await ageGate();
  let first = true;
  sb.auth.onAuthStateChange((ev, session) => {
    if (ev === 'PASSWORD_RECOVERY') { first = false; window.BD_RECOVERY = true; recoveryScreen(); return; }
    if (ev === 'TOKEN_REFRESHED' || (ev === 'SIGNED_IN' && me)) return; // tab wapas aane par SIGNED_IN dobara aata hai
    if (first || ev === 'SIGNED_IN' || ev === 'SIGNED_OUT') { first = false; boot(session); }
  });
})();
