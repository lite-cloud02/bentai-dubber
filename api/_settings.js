// Site settings (links, banner, popup, 18+ gate). Admin panel se badalti hain.
const KEYS = {
  telegram: 'url', whatsapp: 'url', instagram: 'url', youtube: 'url', support: 'url', support_label: 'text',
  contact_email: 'email', announce_text: 'text', announce_link: 'url',
  popup_on: 'flag', popup_title: 'text', popup_text: 'text', popup_link: 'url', popup_btn: 'text',
  age_gate: 'flag', about_text: 'long'
};
const DEFAULTS = { age_gate: '1', support_label: 'Support channel', popup_btn: 'Join karo' };

function clean(key, v) {
  v = String(v == null ? '' : v).trim();
  const t = KEYS[key];
  if (t === 'url') return /^https?:\/\/\S+$/i.test(v) ? v.slice(0, 300) : '';
  if (t === 'email') return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v) ? v.slice(0, 120) : '';
  if (t === 'flag') return v === '1' ? '1' : '0';
  return v.slice(0, t === 'long' ? 1500 : 300);
}

async function loadSettings(db) {
  const out = { ...DEFAULTS };
  try {
    const { data } = await db.from('settings').select('key,value');
    (data || []).forEach(r => { if (KEYS[r.key]) out[r.key] = r.value; });
  } catch (e) { /* table abhi nahi bani to defaults */ }
  return out;
}
module.exports = { KEYS, clean, loadSettings };
