// Sirf check ke liye. Kisi key ko kabhi nahi dikhata.
// /api/health               -> Supabase key ki kism
// /api/health?test=shortener -> Arolinks ko ek test link bhejkar jawab dikhata hai
const strip = s => String(s || '').trim().replace(/^["']|["']$/g, '');

function supabaseKind() {
  const k = strip(process.env.SUPABASE_SERVICE_ROLE_KEY);
  let kind = 'khali (Vercel mein set nahi hai)', projectMatches = null;
  if (k) {
    if (k.startsWith('sb_publishable_')) kind = 'publishable key (GALAT, secret key chahiye)';
    else if (k.startsWith('sb_secret_')) kind = 'secret key (sahi)';
    else if (k.split('.').length === 3) {
      try {
        const p = JSON.parse(Buffer.from(k.split('.')[1], 'base64url').toString());
        kind = p.role === 'service_role' ? 'service_role key (sahi)' : 'JWT role=' + p.role + ' (GALAT, service_role chahiye)';
        const host = new URL(strip(process.env.SUPABASE_URL)).hostname.split('.')[0];
        projectMatches = p.ref ? p.ref === host : null;
      } catch (e) { kind = 'key padhi nahi gayi (galat paste hui?)'; }
    } else kind = 'pehchaan nahi hui (galat paste hui?)';
  }
  return { SUPABASE_SERVICE_ROLE_KEY: kind, sameProjectAsUrl: projectMatches };
}

const hide = (t, k) => [k, strip(k)].filter(Boolean).reduce((a, x) => a.split(x).join('***'), t);

async function testShortener() {
  const rawKey = process.env.AROLINKS_API_KEY || '';
  const base = process.env.AROLINKS_API_URL || 'https://arolinks.com/api';
  const site = (process.env.SITE_URL || '').replace(/\/$/, '');
  const out = {
    AROLINKS_API_KEY: rawKey ? 'set hai' : 'KHALI (Vercel mein daalo)',
    key_mein_extra_space_ya_quote: rawKey ? rawKey !== strip(rawKey) : null,
    AROLINKS_API_URL: base,
    SITE_URL: site || 'KHALI (Vercel mein daalo, jaise https://bengal-dubber.vercel.app)'
  };
  if (!rawKey || !site) return out;
  try {
    const r = await fetch(`${base}?api=${encodeURIComponent(rawKey)}&url=${encodeURIComponent(site + '/?t=test')}`);
    out.httpStatus = r.status;
    out.jawab = hide(await r.text(), rawKey).slice(0, 300);
  } catch (e) { out.fetchError = hide(String(e.message), rawKey); }
  return out;
}

module.exports = async (req, res) => {
  const body = supabaseKind();
  if (req.query && req.query.test === 'shortener') body.shortener = await testShortener();
  res.setHeader('Cache-Control', 'no-store');
  res.status(200).json(body);
};
