const app = $('#app'), nav = $('#bottomNav'), topbar = $('#topbar'), modal = $('#modal');
let me = null, pendingToken = null, player = null, S = {};

/* ---------- site settings (links, banner, popup, 18+) ---------- */
const okUrl = u => /^https?:\/\//i.test(u || '');
async function loadSettings() { try { S = await api('settings'); } catch (e) { S = {}; } }
const SOC_IC = { telegram: '<path d="M22 2 11 13M22 2l-7 20-4-9-9-4z"/>', whatsapp: '<path d="M21 11.5a8.4 8.4 0 0 1-12.6 7.3L3 20l1.3-5A8.4 8.4 0 1 1 21 11.5z"/>', instagram: '<rect x="3" y="3" width="18" height="18" rx="5"/><circle cx="12" cy="12" r="4"/><path d="M17.5 6.5h.01"/>', youtube: '<path d="M22 8.2a3 3 0 0 0-2-2C18.2 5.7 12 5.7 12 5.7s-6.2 0-8 .5a3 3 0 0 0-2 2C1.5 10 1.5 12 1.5 12s0 2 .5 3.8a3 3 0 0 0 2 2c1.8.5 8 .5 8 .5s6.2 0 8-.5a3 3 0 0 0 2-2c.5-1.8.5-3.8.5-3.8s0-2-.5-3.8z"/><path d="M10 15V9l5 3z"/>', support: '<path d="M3 14v-2a9 9 0 0 1 18 0v2"/><path d="M3 14h3v5H4a1 1 0 0 1-1-1zM21 14h-3v5h2a1 1 0 0 0 1-1z"/>' };
function socialList() {
  const items = [['telegram', 'Telegram'], ['whatsapp', 'WhatsApp'], ['instagram', 'Instagram'], ['youtube', 'YouTube'], ['support', S.support_label || 'Support']];
  return items.filter(i => okUrl(S[i[0]])).map(i => `<a class="dsoc" href="${esc(S[i[0]])}" target="_blank" rel="noopener noreferrer"><svg viewBox="0 0 24 24">${SOC_IC[i[0]]}</svg>${esc(i[1])}</a>`).join('');
}
function renderFoot(show) {
  const f = $('#siteFoot'); if (!f) return;
  f.innerHTML = `${show ? '<p class="flinks"><a href="#/about">Disclaimer</a><a href="#/about">DMCA</a><a href="#/about">Contact</a></p>' : ''}<p class="copy">&copy; ${new Date().getFullYear()} Bentai. All rights reserved.</p>`;
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
  showModal(`<h3>${esc(S.popup_title || 'Join us')}</h3><p>${esc(S.popup_text || '')}</p>
    ${okUrl(S.popup_link) ? `<a class="btn" id="pGo" href="${esc(S.popup_link)}" target="_blank" rel="noopener noreferrer">${esc(S.popup_btn || 'Join us')}</a>` : ''}
    <button class="btn ghost" id="pNo">Maybe later</button>`);
  try { localStorage.setItem('bd_popup', JSON.stringify({ sig, t: Date.now() })); } catch (e) { /* ignore */ }
  $('#pNo').onclick = closeModal; const g = $('#pGo'); if (g) g.onclick = closeModal;
}
function ageGate() {
  if (S.age_gate === '0') return Promise.resolve();
  try { if (localStorage.getItem('bd_age') === '1') return Promise.resolve(); } catch (e) { /* ignore */ }
  return new Promise(res => {
    const g = document.createElement('div'); g.className = 'agegate';
    g.innerHTML = `<div class="agebox"><h2>18+ warning</h2><p>This site may contain content for adults only (18 or older). Are you 18+?</p>
      <button class="btn" id="ageY">Yes, I am 18+</button><button class="btn ghost" id="ageN">No</button></div>`;
    document.body.appendChild(g);
    $('#ageY').onclick = () => { try { localStorage.setItem('bd_age', '1'); } catch (e) { /* ignore */ } g.remove(); res(); };
    $('#ageN').onclick = () => { g.querySelector('.agebox').innerHTML = '<h2>Sorry</h2><p>You must be 18 or older to view this site.</p>'; };
  });
}
function openReport(episodeId) {
  showModal(`<h3>Report a problem</h3><p>What went wrong?</p>
    <select id="rWhy"><option>Video does not play</option><option>No sound</option><option>Wrong episode or title</option><option>Something else</option></select>
    <textarea id="rMsg" maxlength="200" placeholder="Anything else to add? (optional)" style="margin-top:10px"></textarea>
    <button class="btn" id="rGo">Send</button><button class="btn ghost" id="rNo">Cancel</button>`);
  $('#rNo').onclick = closeModal;
  $('#rGo').onclick = async () => {
    const why = $('#rWhy').value, extra = $('#rMsg').value.trim();
    $('#rGo').disabled = true; $('#rGo').textContent = 'Sending...';
    try {
      await post('report', { episodeId, message: why + (extra ? ': ' + extra : '') });
      showModal('<h3>Thank you!</h3><p>We received your report and will look into it soon.</p><button class="btn" id="rOk">OK</button>');
    } catch (e) {
      showModal(`<h3>Report not sent</h3><p>${esc(e.message)}</p><button class="btn" id="rOk">OK</button>`);
    }
    $('#rOk').onclick = closeModal;
  };
}

/* ---------- helpers ---------- */
const fmtV = n => n >= 1e6 ? (n / 1e6).toFixed(1).replace(/\.0$/, '') + 'M' : n >= 1e3 ? (n / 1e3).toFixed(1).replace(/\.0$/, '') + 'K' : String(n);
function posterHtml(a) {
  return a.poster_url ? `<img src="${esc(a.poster_url)}" alt="${esc(a.title)}" loading="lazy">` : `<span class="ph">${esc((a.title || '?')[0])}</span>`;
}
/* ---------- page background (img/bg/home.jpg, me.jpg, auth.jpg) ---------- */
const BG_VER = 1; // image badalne ke baad browser purani dikhaye to ye number badha do
function setBg(name) {
  const b = document.body;
  if (!name || name === 'none') { b.removeAttribute('data-bg'); return; }
  b.style.setProperty('--bg-img', `url("/img/bg/${name}.jpg?v=${BG_VER}")`);
  b.setAttribute('data-bg', name);
}
function chrome(show, tab) {
  nav.hidden = topbar.hidden = !show; renderFoot(show); const av = $('#topAvatar'); if (av && me) av.textContent = (me.name || '?')[0].toUpperCase();
  const ts = $('#topSearch'); if (ts) ts.hidden = tab === 'search'; // Search page par icon nahi, wahan search bar hai
  nav.querySelectorAll('a').forEach(a => a.classList.toggle('on', a.dataset.tab === tab));
  setBg(show ? (tab === 'me' ? 'me' : 'home') : 'auth'); // login/signup = auth, account = me, baaki = home
}
function showModal(html) { modal.innerHTML = `<div class="sheet">${html}</div>`; modal.hidden = false; }
function closeModal() { modal.hidden = true; modal.innerHTML = ''; }
modal.addEventListener('click', e => { if (e.target === modal) closeModal(); });
function loading(msg) { app.innerHTML = `<div class="center"><div class="spin"></div><p>${esc(msg || 'Loading...')}</p></div>`; }
function stopPlayer() {
  if (!player) return;
  clearInterval(player.timer); clearInterval(player.beat); clearInterval(player.wmTimer); clearTimeout(player.hideT); clearTimeout(player.noteT); clearTimeout(player.waitT);
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
    <p class="auth-sub">Enter your registered email. We will send you a link to reset your password.</p>
    <div class="field"><label>Email</label><input id="fEmail" type="email" autocomplete="email" placeholder="you@example.com"></div>
    <p class="msg" id="fMsg"></p>
    <button class="btn" id="fGo">Send reset link</button>
    <button class="btn ghost" id="fBack">Back to login</button>
  </section>`;
  $('#fBack').onclick = () => authScreen('login');
  $('#fGo').onclick = async () => {
    const email = $('#fEmail').value.trim(), msg = $('#fMsg');
    if (!email) { msg.textContent = 'Enter your email.'; return; }
    $('#fGo').disabled = true; msg.style.color = ''; msg.textContent = 'One moment...';
    const { error } = await sb.auth.resetPasswordForEmail(email, { redirectTo: location.origin });
    $('#fGo').disabled = false;
    if (error) { msg.textContent = error.message; return; }
    msg.style.color = '#6ee7a1';
    msg.textContent = 'If this email is registered, a reset link has been sent. Check your inbox and spam folder.';
  };
}
function recoveryScreen() {
  stopPlayer(); chrome(false);
  app.innerHTML = `<section class="auth">
    <h1 class="auth-brand">New<span> password</span></h1>
    <p class="auth-sub">Enter your new password.</p>
    <div class="field"><label>New password</label><div class="pw"><input id="nPass" type="password" autocomplete="new-password" placeholder="At least 6 characters"><button type="button" class="pw-eye" aria-label="Show password"><svg viewBox="0 0 24 24"><path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/><path class="sl" d="M3 3l18 18"/></svg></button></div></div>
    <div class="field"><label>Confirm password</label><div class="pw"><input id="nPass2" type="password" autocomplete="new-password"><button type="button" class="pw-eye" aria-label="Show password"><svg viewBox="0 0 24 24"><path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/><path class="sl" d="M3 3l18 18"/></svg></button></div></div>
    <p class="msg" id="nMsg"></p>
    <button class="btn" id="nGo">Update password</button>
  </section>`;
  $('#nGo').onclick = async () => {
    const p1 = $('#nPass').value, p2 = $('#nPass2').value, msg = $('#nMsg');
    if (p1.length < 6) { msg.textContent = 'Password must be at least 6 characters.'; return; }
    if (p1 !== p2) { msg.textContent = 'The passwords do not match.'; return; }
    $('#nGo').disabled = true; msg.textContent = 'One moment...';
    const { error } = await sb.auth.updateUser({ password: p1 });
    if (error) { $('#nGo').disabled = false; msg.textContent = error.message; return; }
    window.BD_RECOVERY = false; history.replaceState(null, '', location.pathname);
    me = null; const { data } = await sb.auth.getSession(); boot(data.session);
  };
}

/* ---------- auth ---------- */
const AUTH_GOOGLE = false; // Google login button: true = dikhao, false = chhupao
const AUTH_SIGNUP = true;  // Sign up tab: true = dikhao, false = chhupao
function authScreen(mode) {
  stopPlayer(); chrome(false);
  const signup = AUTH_SIGNUP && mode === 'signup';
  app.innerHTML = `<section class="auth">
    <img class="auth-logo" src="img/logo.png" alt="Bentai Dubber">
    <p class="auth-sub">${signup ? 'Create an account and watch dubbed anime.' : 'Log in and watch dubbed anime.'}</p>
    ${AUTH_SIGNUP ? `<div class="tabs"><button class="${signup ? '' : 'on'}" data-m="login">Login</button><button class="${signup ? 'on' : ''}" data-m="signup">Sign up</button></div>` : ''}
    ${AUTH_GOOGLE ? `<button type="button" class="gbtn" id="aGoogle"><svg viewBox="0 0 48 48"><path fill="#EA4335" d="M24 9.5c3.5 0 6.6 1.2 9.1 3.6l6.8-6.8C35.8 2.4 30.3 0 24 0 14.6 0 6.5 5.4 2.6 13.2l7.9 6.1C12.4 13.6 17.7 9.5 24 9.5z"/><path fill="#4285F4" d="M46.5 24.5c0-1.6-.1-3.1-.4-4.5H24v9h12.7c-.6 3-2.3 5.5-4.8 7.2l7.6 5.9c4.4-4.1 7-10.1 7-17.6z"/><path fill="#FBBC05" d="M10.5 28.7a14.5 14.5 0 0 1 0-9.4l-7.9-6.1a24 24 0 0 0 0 21.6z"/><path fill="#34A853" d="M24 48c6.5 0 12-2.1 16-5.8l-7.6-5.9c-2.1 1.4-4.9 2.3-8.4 2.3-6.3 0-11.6-4.1-13.5-9.8l-7.9 6.1C6.5 42.6 14.6 48 24 48z"/></svg> Continue with Google</button><div class="or">or</div>` : ''}
    <div class="field ${signup ? '' : 'hide'}"><label>Name</label><input id="aName" autocomplete="name" placeholder="Your name"></div>
    <div class="field"><label>Email</label><input id="aEmail" type="email" autocomplete="email" placeholder="you@example.com"></div>
    <div class="field"><label>Password</label><div class="pw"><input id="aPass" type="password" autocomplete="${signup ? 'new-password' : 'current-password'}" placeholder="At least 6 characters"><button type="button" class="pw-eye" aria-label="Show password"><svg viewBox="0 0 24 24"><path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/><path class="sl" d="M3 3l18 18"/></svg></button></div></div>
    <p class="msg" id="aMsg"></p>
    <button class="btn" id="aGo">${signup ? 'Create account' : 'Log in'}</button>
    ${signup ? '' : '<div style="text-align:center"><button type="button" id="aForgot" style="background:none;border:0;color:var(--lav);font:inherit;font-size:13px;margin-top:12px;padding:6px;cursor:pointer">Forgot password?</button></div>'}
  </section>`;
  const fg = $('#aForgot'); if (fg) fg.onclick = forgotScreen;
  if ($('#aGoogle')) $('#aGoogle').onclick = async () => { const { error } = await sb.auth.signInWithOAuth({ provider: 'google', options: { redirectTo: location.origin } }); if (error) $('#aMsg').textContent = error.message; };
  app.querySelectorAll('.tabs button').forEach(b => b.onclick = () => authScreen(b.dataset.m));
  const msg = $('#aMsg');
  $('#aGo').onclick = async () => {
    const email = $('#aEmail').value.trim(), password = $('#aPass').value;
    if (!email || password.length < 6) { msg.textContent = 'Enter your email and a password of 6+ characters.'; return; }
    msg.textContent = 'One moment...';
    if (signup) {
      const name = $('#aName').value.trim();
      const { data, error } = await sb.auth.signUp({ email, password, options: { data: { name } } });
      if (error) { msg.textContent = error.message; return; }
      if (!data.session) { msg.textContent = 'We sent a confirmation link to your email. Confirm it, then log in.'; return; }
    } else {
      const { error } = await sb.auth.signInWithPassword({ email, password });
      if (error) { msg.textContent = 'Incorrect email or password.'; return; }
    }
  };
}

/* ---------- home ---------- */
const gOf = a => String(a.genre || '').split(',').map(x => x.trim()).filter(Boolean);
const CHEV = '<svg viewBox="0 0 24 24"><path d="M7 6l6 6-6 6M13 6l6 6-6 6"/></svg>';
let GENRES = [], genreSel = null, SEARCHPG = null;
const BLOCK_Q = /^(episodes?|eps?)\s*\.?\s*#?\d*$/i; // "episode 1", "ep 2" search karne par kuch nahi dikhega
const thumb = a => a.poster_url ? `<img src="${esc(a.poster_url)}" alt="${esc(a.title || '')}" loading="lazy" decoding="async">` : `<span class="ph">${esc((a.title || '?')[0])}</span>`;
const epCard = e => { const an = e.anime || {}; return `<button class="c16 ep-c" data-id="${e.id}" aria-label="${esc(an.title || e.title || '')} episode ${e.number}"><div class="t16">${thumb({ poster_url: e.thumb_url || an.poster_url, title: an.title })}<b class="tpill">Ep ${e.number}</b></div><span class="ct">${esc(an.title || e.title || '')}</span></button>`; };
const secHead = (title, href) => `<div class="sec"><i></i><h2>${title}</h2>${href ? `<a class="more" href="${href}" aria-label="See all">${CHEV}</a>` : ''}</div>`;

const searchEpCard = (an, e) => `<button class="c16 ep-c" data-id="${e.id}" aria-label="${esc(e.title)}"><div class="t16">${thumb({ poster_url: e.thumb_url || an.poster_url, title: e.title })}<b class="tpill">Ep ${e.number}</b></div><span class="ct">${esc(e.title)}</span><span class="cg">${esc(an.title)}</span></button>`;

async function home(searchMode) {
  // Home: banner + New episodes (slide) + All anime. Tags/chips sirf Search page par (aur 3-line menu mein).
  stopPlayer(); chrome(true, searchMode ? 'search' : 'home'); loading('Loading anime...');
  try {
    const { anime, latest } = await api('anime');
    const genres = [...new Set(anime.flatMap(gOf))].sort();
    GENRES = genres;
    let gsel = (searchMode && genreSel && genres.includes(genreSel)) ? genreSel : 'All';
    genreSel = null;
    app.innerHTML = `<section class="page home">
      ${searchMode ? '' : bannerHtml()}
      ${searchMode ? `<div class="search"><svg viewBox="0 0 24 24"><circle cx="11" cy="11" r="7"/><path d="M20 20l-4-4"/></svg><input id="q" placeholder="Search anime or episode..." autocomplete="off"></div>` : ''}
      ${searchMode && genres.length ? `<div class="chips" id="chips">${['All', ...genres].map(g => `<button class="chipb ${g === gsel ? 'on' : ''}" data-g="${esc(g)}">${esc(g)}</button>`).join('')}</div>` : ''}
      ${!searchMode && latest && latest.length ? `${secHead('New episodes', '')}<div class="hslide">${latest.map(epCard).join('')}</div>` : ''}
      ${secHead('All anime', searchMode ? '' : '#/search')}
      <div class="grid16" id="grid"></div>
      <div id="epres"></div>
      </section>`;
    const grid = $('#grid'), epres = $('#epres');
    const draw = () => {
      const q = searchMode ? $('#q').value.trim().toLowerCase() : '';
      const inG = a => gsel === 'All' || gOf(a).includes(gsel);
      let rows = [], epRows = [];
      if (!(q && BLOCK_Q.test(q))) {
        rows = anime.filter(a => a.title.toLowerCase().includes(q) && inG(a));
        if (q) epRows = anime.filter(inG).flatMap(a => (a.eps || []).filter(e => String(e.title).toLowerCase().includes(q)).map(e => ({ a, e })));
      }
      grid.innerHTML = rows.length ? rows.map(a => `<a class="c16" href="#/anime/${a.id}" aria-label="${esc(a.title)}"><div class="t16 port">${thumb(a)}<b class="tpill">${a.episodeCount} ep</b></div><span class="ct">${esc(a.title)}</span><span class="cg">${esc(gOf(a).slice(0, 3).join(', '))}</span></a>`).join('')
        : (epRows.length ? '' : `<p class="empty">${anime.length ? 'No results found.' : 'No anime added yet.'}</p>`);
      if (epres) {
        epres.innerHTML = epRows.length ? `${secHead('Episodes', '')}<div class="grid16">${epRows.map(x => searchEpCard(x.a, x.e)).join('')}</div>` : '';
        epres.querySelectorAll('.ep-c').forEach(b => b.onclick = () => askUnlock(b.dataset.id));
      }
    };
    const select = g => {
      gsel = g; app.querySelectorAll('.chipb').forEach(x => x.classList.toggle('on', x.dataset.g === g)); draw();
    };
    if (searchMode) $('#q').addEventListener('input', draw);
    app.querySelectorAll('.chipb').forEach(b => b.onclick = () => select(b.dataset.g));
    app.querySelectorAll('.ep-c').forEach(b => b.onclick = () => askUnlock(b.dataset.id));
    SEARCHPG = searchMode ? { root: app.firstElementChild, select } : null;
    draw(); if (!searchMode) maybePopup();
  } catch (e) { app.innerHTML = `<div class="center"><p>${esc(e.message)}</p></div>`; }
}

/* ---------- New episodes (poori list) ---------- */
async function newPage() {
  stopPlayer(); chrome(true, 'home'); loading('Loading...');
  try {
    const { latest } = await api('anime');
    app.innerHTML = `<section class="page home">${secHead('New episodes', '')}
      ${latest && latest.length ? `<div class="grid16">${latest.map(epCard).join('')}</div>` : '<p class="empty">No new episodes right now.</p>'}</section>`;
    app.querySelectorAll('.ep-c').forEach(b => b.onclick = () => askUnlock(b.dataset.id));
  } catch (e) { app.innerHTML = `<div class="center"><p>${esc(e.message)}</p></div>`; }
}

/* ---------- menu (3 lines): tags + social links ---------- */
const drawer = $('#drawer'), drawerBg = $('#drawerBg');
function closeMenu() { drawer.classList.remove('open'); drawerBg.hidden = true; }
async function openMenu() {
  if (!GENRES.length) { try { const { anime } = await api('anime'); GENRES = [...new Set(anime.flatMap(gOf))].sort(); } catch (e) { /* ignore */ } }
  $('#drTags').innerHTML = GENRES.length ? GENRES.map(g => `<button class="dtag" data-g="${esc(g)}">${esc(g)}</button>`).join('') : '<p class="muted">No tags yet.</p>';
  $('#drSoc').innerHTML = socialList() || '<p class="muted">No links yet.</p>';
  drawerBg.hidden = false; drawer.classList.add('open');
}
function pickTag(g) {
  closeMenu();
  if (SEARCHPG && app.contains(SEARCHPG.root)) { SEARCHPG.select(g); window.scrollTo(0, 0); return; } // Search page par ho to seedha filter
  genreSel = g; // warna Search page khulega, tag wahan selected dikhega
  if (location.hash === '#/search') home(true); else location.hash = '#/search';
}
$('#menuBtn').onclick = openMenu;
$('#drClose').onclick = closeMenu;
drawerBg.onclick = closeMenu;
$('#drTags').onclick = ev => { const b = ev.target.closest('.dtag'); if (b) pickTag(b.dataset.g); };
document.addEventListener('keydown', ev => { if (ev.key === 'Escape') closeMenu(); });

/* ---------- anime page ---------- */
async function animePage(id) {
  stopPlayer(); chrome(true, 'home'); loading();
  try {
    const { anime, episodes } = await api('anime?id=' + encodeURIComponent(id));
    app.innerHTML = `<section class="page dp">
      <div class="dp-hero" style="background-image:url('${esc(anime.poster_url || '')}')"></div>
      <a class="back" href="#/">Back</a>
      <div class="dp-poster poster">${posterHtml(anime)}</div>
      <h1>${esc(anime.title)}</h1>
      <div class="dp-badges"><span class="dp-badge">${episodes.length} episode${episodes.length === 1 ? '' : 's'}</span><span class="dp-badge dub">Dub</span></div>
      <div class="dp-genres">${String(anime.genre || '').split(',').map(x => x.trim()).filter(Boolean).map(x => `<span>${esc(x)}</span>`).join('')}</div>
      <p class="desc">${esc(anime.description)}</p>
      ${episodes.length ? '<button class="btn dp-start" id="startW"><svg viewBox="0 0 24 24"><path d="M8 5v14l11-7z"/></svg>Start watching</button>' : ''}
      <h2 class="h2">Episodes</h2>
      <div class="eps">${episodes.length ? episodes.map(e => `<button class="ep" data-id="${e.id}"><span class="ept">${thumb({ poster_url: e.thumb_url || anime.poster_url, title: e.title })}<b class="epn">E${e.number}</b></span><span class="epi"><small>${esc(anime.title)}</small><b>${esc(e.title)}</b><em>Dub</em></span></button>`).join('')
        : '<p class="empty">Episodes are coming soon.</p>'}</div></section>`;
    app.querySelectorAll('.ep').forEach(b => b.onclick = () => askUnlock(b.dataset.id));
    const sw = $('#startW'); if (sw) sw.onclick = () => askUnlock(episodes[0].id);
  } catch (e) { app.innerHTML = `<div class="center"><p>${esc(e.message)}</p><a class="btn" href="#/">Go home</a></div>`; }
}

/* ---------- shortener unlock ---------- */
function askUnlock(episodeId) {
  showModal(`<h3>Unlock this episode</h3>
    <p>Complete one short link to unlock this episode. Then you can watch it for <b>1 hour</b>.</p>
    <button class="btn" id="mGo">Open link</button><button class="btn ghost" id="mNo">Not now</button>`);
  $('#mNo').onclick = closeModal;
  $('#mGo').onclick = async () => {
    $('#mGo').disabled = true; $('#mGo').textContent = 'Preparing link...';
    try {
      const r = await post('start', { episodeId });
      if (r.direct) { closeModal(); location.hash = '#/watch/' + episodeId; }
      else location.href = r.url;
    } catch (e) {
      showModal(`<h3>Link failed</h3><p>${esc(e.message)}</p><button class="btn" id="mOk">OK</button>`);
      $('#mOk').onclick = closeModal;
    }
  };
}

async function verifyScreen(token) {
  stopPlayer(); chrome(false); loading('Checking link...');
  history.replaceState(null, '', location.pathname);
  try {
    const r = await post('verify', { token });
    location.hash = '#/watch/' + r.episodeId;
  } catch (e) {
    app.innerHTML = `<div class="center"><h3>Verification failed</h3><p>${esc(e.message)}</p><a class="btn" href="#/">Go home</a></div>`;
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
  if (det === 'manifestLoadError') msg = apiMsg || (code === 403 ? 'Access has ended. Unlock the episode again.' : 'Video playlist not found.');
  else if (det === 'keyLoadError') msg = 'Could not load the video. Please refresh the page and try again.';
  else if (det === 'fragDecryptError' || det === 'fragParsingError') msg = 'Could not play this video right now. Please try again in a while.';
  else if (det === 'fragLoadError' || det === 'fragLoadTimeOut') msg = 'The video could not load. Check your internet and try again.';
  else msg = 'Playback problem.';
  // jaanch ke liye: status aur tukde ka address (signature ke bina)
  let where = '', st = '';
  try { if (d.frag && d.frag.url) { const u = new URL(d.frag.url); where = ' | ' + u.host + u.pathname; } } catch (e) { /* ignore */ }
  try { if (d.networkDetails && d.networkDetails.status !== undefined) st = ' http=' + d.networkDetails.status; } catch (e) { /* ignore */ }
  return { msg, det: det + (code ? ' (' + code + ')' : '') + st + where };
}

async function watch(id) {
  stopPlayer(); chrome(true, 'home'); setBg('none'); loading('Preparing video...'); // video page par background nahi
  let info;
  try { info = await api('play?e=' + encodeURIComponent(id)); }
  catch (e) {
    app.innerHTML = `<div class="center"><h3>${e.status === 403 ? 'Episode locked' : 'Video could not open'}</h3>
      <p>${e.status === 403 ? 'Your 1 hour of access has ended, or the link was not completed.' : esc(e.message)}</p>
      ${e.status === 403 ? '<button class="btn" id="relock">Unlock again</button>' : ''}<a class="btn ghost" href="#/">Go home</a></div>`;
    const b = $('#relock'); if (b) b.onclick = () => askUnlock(id);
    return;
  }

  app.innerHTML = `<section class="watch"><div class="wgrid"><div class="wmain">
    ${info.servers > 1 ? `<div class="srvbar" id="srvbar"><span>Server</span><button class="srvb on" data-s="1">Server 1</button><button class="srvb" data-s="2">Server 2</button><div class="srvnote" id="srvnote" hidden>Video not loading? Try switching the server.</div></div>` : ''}
    <div class="wtop"><a class="backc" href="#/anime/${esc(info.animeId)}" aria-label="Back"><svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"/><path d="M13.5 8l-4 4 4 4"/></svg></a><div class="np off" id="np"><i class="eq"><b></b><b></b><b></b></i><span class="npt"><small>NOW PLAYING</small><b>Episode ${esc(info.number)}</b></span></div></div>
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
          <button class="cb" id="bk" aria-label="Back 10 seconds">${IC.replay}</button>
          <button class="cb big" id="pp" aria-label="Play or pause">${IC.play}</button>
          <button class="cb" id="fw" aria-label="Forward 10 seconds">${IC.forward}</button>
        </div>
        <div class="bot">
          <div class="row2">
            <span class="tm"><span id="tcur">0:00</span> / <span id="tdur">0:00</span></span>
            <span class="gap"></span>
            <button class="cb sm" id="mute" aria-label="Volume">${IC.vol}</button>
            <button class="cb sm" id="fs" aria-label="Fullscreen">${IC.fsIn}</button>
          </div>
          <div class="seek" id="seek"><div class="sb" id="sbuf"></div><div class="sf" id="sfill"></div><div class="sk" id="sknob"></div></div>
        </div>
      </div>
      <div class="mini" id="mini"><i id="minif"></i></div>
      <div class="menu" id="menu" hidden><div class="mh">Playback speed</div>${SPEEDS.map(s => `<button data-s="${s[0]}" class="${s[0] === 1 ? 'on' : ''}">${s[1]}</button>`).join('')}</div>
      <div class="msgbox" id="err" hidden><h3 id="errmsg"></h3><small id="errdet"></small><button class="btn" id="retry">Try again</button><button class="btn ghost" id="errrep">Report a problem</button></div>
      <div class="msgbox" id="nextbox" hidden><h3>Episode finished</h3><p id="nextname"></p><button class="btn" id="nextgo">Watch next episode</button><button class="btn ghost" id="replay">Watch again</button></div>
      <div class="msgbox" id="exp" hidden><h3>Access ended</h3><p>Unlock the episode again to keep watching.</p><a class="btn" href="#/">Go home</a></div>
    </div>
    <div class="winfo">
      <h1 class="wtitle">${esc(info.title)}</h1>
      <div class="wmeta"><span class="aname">${esc(info.animeTitle)}</span>${info.views != null ? `<span class="views">${fmtV(info.views)}<svg viewBox="0 0 24 24"><path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/></svg></span>` : ''}</div>
      <div class="wact"><button class="pill nx" id="nextbtn" hidden>Next episode &rsaquo;</button></div>
      
    </div></div>
    <aside class="upnext"><div class="epcard"><div class="eph"><span>EPISODES</span><div class="epnav"><button id="epPrev" aria-label="Previous episode" disabled>&lsaquo;</button><button id="epNext" aria-label="Next episode" disabled>&rsaquo;</button></div></div><div class="epchips" id="upl"><span class="muted">Loading...</span></div></div><p class="vnote">Every episode needs its own verification. After unlocking, it stays open for 60 minutes.</p><a class="live" href="#/anime/${esc(info.animeId)}"><span class="liveimg">${posterHtml({ poster_url: info.animePoster, title: info.animeTitle })}</span><span class="livetxt"><small>Full series</small><b>${esc(info.animeTitle)}</b><em>View all episodes &rsaquo;</em></span></a><span id="left" hidden></span></aside>
  </div></section>`;

  const video = $('#vid'), pl = $('#pl'), wm = $('#wm'), ctrls = $('#ctrls'), pp = $('#pp'), seek = $('#seek'), menu = $('#menu');
  const sfill = $('#sfill'), sknob = $('#sknob'), sbuf = $('#sbuf'), tcur = $('#tcur'), tdur = $('#tdur'), buf = $('#buf'), minif = $('#minif');
  const P = player = { hls: null, timer: null, wmTimer: null, hideT: null, recovered: false, done: false, next: null };
  let dragging = false;
  pl.addEventListener('contextmenu', e => e.preventDefault());
  const np = $('#np'); // "NOW PLAYING" bars sirf tab chalte hain jab video sach mein chal raha ho
  video.addEventListener('playing', () => np.classList.remove('off'));
  video.addEventListener('pause', () => np.classList.add('off'));
  video.addEventListener('ended', () => np.classList.add('off'));

  /* --- agle episodes (YouTube ke "up next" jaisa) --- */
  api('anime?id=' + encodeURIComponent(info.animeId)).then(r => {
    if (player !== P) return;
    const eps = r.episodes, ix = eps.findIndex(e => e.id === id);
    $('#upl').innerHTML = eps.map(e => `<button class="epc ${e.id === id ? 'cur' : ''}" data-id="${e.id}">${e.number}</button>`).join('');
    $('#upl').querySelectorAll('.epc').forEach(b => { if (b.dataset.id !== id) b.onclick = () => askUnlock(b.dataset.id); });
    const pv = eps[ix - 1], nx = eps[ix + 1];
    if (pv) { $('#epPrev').disabled = false; $('#epPrev').onclick = () => askUnlock(pv.id); }
    if (nx) { $('#epNext').disabled = false; $('#epNext').onclick = () => askUnlock(nx.id); }
    P.next = nx || null;
    if (P.next) { const nb = $('#nextbtn'); nb.hidden = false; nb.onclick = () => askUnlock(P.next.id); }
  }).catch(() => { const u = $('#upl'); if (u) u.innerHTML = ''; });

  /* --- helpers --- */
  const showErr = e => {
    if (P.done) return;
    $('#errmsg').textContent = e.msg + (info.servers > 1 && !/device-/.test(e.det) ? ' Try switching the server above.' : ''); $('#errdet').textContent = 'Code: ' + e.det; $('#errdet').style.wordBreak = 'break-all';
    $('#err').hidden = false; buf.classList.add('hide'); ctrls.classList.add('hide');
  };
  $('#retry').onclick = () => watch(id);
  /* --- server notice + active server --- */
  const setActive = n => app.querySelectorAll('.srvb').forEach(b => b.classList.toggle('on', Number(b.dataset.s) === n));
  const showNote = () => { const n = $('#srvnote'); if (n) n.hidden = false; };
  const hideNote = () => { const n = $('#srvnote'); if (n) n.hidden = true; clearTimeout(P.noteT); clearTimeout(P.waitT); };
  video.addEventListener('playing', hideNote);
  video.addEventListener('waiting', () => { clearTimeout(P.waitT); P.waitT = setTimeout(() => { if (video.readyState < 3) showNote(); }, 8000); });
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
  video.addEventListener('error', () => showErr({ msg: 'Playback problem.', det: 'video-element' }));

  /* --- HLS --- */
  const tok = await accessToken();
  if (player !== P) return;  // user beech mein hat gaya
  if (window.Hls && Hls.isSupported()) {
    // Server apne aap nahi badalta: sirf Server 1 / Server 2 button dabane par badalta hai
    const startHls = (srv, startAt) => {
      const hls = new Hls({
        maxBufferLength: 40,
        startPosition: startAt > 1 ? startAt : -1,
        xhrSetup: (xhr, url) => {
          if (url.indexOf('/api/') !== -1) xhr.setRequestHeader('Authorization', 'Bearer ' + tok);
          if (url.indexOf('/api/playlist') !== -1) xhr.addEventListener('load', () => { const s = Number(xhr.getResponseHeader('X-Storage')); if (s === 1 || s === 2) setActive(s); });
        }
      });
      clearTimeout(P.noteT); P.noteT = setTimeout(() => { if (video.readyState < 3) showNote(); }, 12000); // 12 second mein shuru na ho to notice
      hls.loadSource(info.playlist + (srv === 2 ? (info.playlist.indexOf('?') === -1 ? '?' : '&') + 'srv=2' : ''));
      hls.attachMedia(video);
      hls.on(Hls.Events.MANIFEST_PARSED, () => { video.play().catch(() => {}); });
      hls.on(Hls.Events.ERROR, (_, d) => {
        if (!d.fatal) return;
        if (d.type === Hls.ErrorTypes.MEDIA_ERROR && !P.recovered) { P.recovered = true; hls.recoverMediaError(); return; }
        showNote();
        try { showErr(friendlyError(d)); } catch (x) { showErr({ msg: 'Playback problem.', det: String(d.details || d.type || 'error') }); }
      });
      return hls;
    };
    // Server button: dabane par usi jagah se dusre server se chalega
    P.switchTo = n => {
      hideNote(); $('#err').hidden = true; ctrls.classList.remove('hide'); buf.classList.remove('hide');
      const t = video.currentTime || 0;
      if (P.hls) P.hls.destroy();
      P.recovered = false;
      try { localStorage.setItem('bd_srv', String(n)); } catch (x) { /* ignore */ }
      P.hls = startHls(n, t); setActive(n);
    };
    app.querySelectorAll('.srvb').forEach(b => b.onclick = () => P.switchTo(Number(b.dataset.s)));
    let srv0 = 1; // pichhli baar jo server chuna tha wahi se shuru (agar do server hon)
    try { if (info.servers > 1 && localStorage.getItem('bd_srv') === '2') srv0 = 2; } catch (x) { /* ignore */ }
    P.hls = startHls(srv0, 0); setActive(srv0);
  } else {
    showErr({ msg: 'This browser is not supported. Use Chrome or an updated Safari (iOS 17.1+).', det: 'no-mse' });
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
    $('#left').textContent = `Access: ${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')} left`;
  };
  tick(); P.timer = setInterval(tick, 1000);

  /* --- ek time par 1 device: har 40 second mein server ko batate hain; dusre device par chala to yahan band --- */
  P.beat = setInterval(async () => {
    if (P.done) return;
    try { await api('play?e=' + encodeURIComponent(id) + '&beat=1'); }
    catch (e) {
      if (e.status === 409 || e.status === 423) {
        showErr({ msg: e.message, det: 'device-' + e.status });
        P.done = true; video.pause(); if (P.hls) P.hls.destroy(); video.removeAttribute('src'); video.load();
        clearInterval(P.beat);
      }
    }
  }, 40000);
}

/* ---------- me ---------- */
function meScreen() {
  stopPlayer(); chrome(true, 'me');
  app.innerHTML = `<section class="page"><div class="me"><div class="avatar">${esc((me.name || '?')[0].toUpperCase())}</div>
    <h2>${esc(me.name)}</h2><p class="muted">${esc(me.email)}</p></div>
    ${socialList() ? `<div class="me-soc"><div class="dr-sec">Follow us</div><div class="dr-soc">${socialList()}</div></div>` : ''}
    ${me.isAdmin ? '<a class="btn" href="admin.html">Admin panel</a>' : ''}
    <button class="btn ghost" id="out">Logout</button>
    </section>`;
  $('#out').onclick = () => sb.auth.signOut();
}

/* ---------- about / legal ---------- */
function aboutScreen() {
  stopPlayer(); chrome(true, 'me');
  const mail = S.contact_email ? `<a href="mailto:${esc(S.contact_email)}">${esc(S.contact_email)}</a>` : 'Contact the admin through the social links.';
  app.innerHTML = `<section class="page legal"><a class="back" href="#/me">Back</a><h1>Disclaimer, DMCA &amp; Contact</h1>
    <h2>Disclaimer</h2><p>Content shown on this site is added by uploaders. The site does not claim ownership of any anime or video.${S.age_gate !== '0' ? ' This site is for users aged 18+ only.' : ''}</p>
    <h2>DMCA / Content removal</h2><p>If you are a rights holder and believe content was added without permission, send the episode name and proof of ownership to the contact below. After review, the content will be removed.</p>
    <h2>Contact</h2><p>${mail}</p>
    ${S.about_text ? `<h2>More information</h2><p>${esc(S.about_text).replace(/\n/g, '<br>')}</p>` : ''}
    </section>`;
}

/* ---------- router ---------- */
function route() {
  if (!me) return;
  const h = location.hash.replace(/^#\/?/, '').split('/');
  if (h[0] === 'anime' && h[1]) return animePage(h[1]);
  if (h[0] === 'watch' && h[1]) return watch(h[1]);
  if (h[0] === 'search') { const fromTag = !!genreSel; return home(true).then(() => { const q = $('#q'); if (q && !fromTag) q.focus(); }); }
  if (h[0] === 'new') return newPage();
  if (h[0] === 'me') return meScreen();
  if (h[0] === 'about') return aboutScreen();
  return home();
}
window.addEventListener('hashchange', () => { closeModal(); closeMenu(); route(); });

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
