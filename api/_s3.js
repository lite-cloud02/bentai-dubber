// Backblaze B2 (S3-compatible) ke liye signed link banata hai. Koi extra package nahi chahiye.
const crypto = require('crypto');
const hmac = (k, d) => crypto.createHmac('sha256', k).update(d).digest();
const sha = d => crypto.createHash('sha256').update(d).digest('hex');
const enc = s => encodeURIComponent(s).replace(/[!'()*]/g, c => '%' + c.charCodeAt(0).toString(16).toUpperCase());
const encPath = p => p.split('/').map(enc).join('/');
const strip = s => String(s || '').trim().replace(/^["']|["']$/g, '');

function presign({ host, path, region, accessKey, secret, expires, now }) {
  const d = now || new Date();
  const amz = d.toISOString().replace(/[:-]|\.\d{3}/g, '');
  const date = amz.slice(0, 8);
  const scope = `${date}/${region}/s3/aws4_request`;
  const q = {
    'X-Amz-Algorithm': 'AWS4-HMAC-SHA256',
    'X-Amz-Credential': `${accessKey}/${scope}`,
    'X-Amz-Date': amz,
    'X-Amz-Expires': String(expires),
    'X-Amz-SignedHeaders': 'host'
  };
  const qs = Object.keys(q).sort().map(k => `${enc(k)}=${enc(q[k])}`).join('&');
  const canonical = ['GET', path, qs, `host:${host}\n`, 'host', 'UNSIGNED-PAYLOAD'].join('\n');
  const sts = ['AWS4-HMAC-SHA256', amz, scope, sha(canonical)].join('\n');
  const kSigning = hmac(hmac(hmac(hmac('AWS4' + secret, date), region), 's3'), 'aws4_request');
  const sig = hmac(kSigning, sts).toString('hex');
  return `https://${host}${path}?${qs}&X-Amz-Signature=${sig}`;
}

// Server 1 = S3_* variables (abhi Backblaze). Server 2 = S3B_* variables (jaise Cloudflare R2). Dono same tarah ke S3 hain.
function conf(n) {
  const p = n === 2 ? 'S3B_' : 'S3_';
  const e = k => strip(process.env[p + k]);
  const host = e('ENDPOINT').replace(/^https?:\/\//, '').replace(/\/.*$/, '');
  const m = host.match(/^s3\.([^.]+)\./);
  return { host, bucket: e('BUCKET'), region: e('REGION') || (m ? m[1] : ''), accessKey: e('KEY_ID'), secret: e('SECRET') };
}

function s3missing(n) {
  const c = conf(n), p = n === 2 ? 'S3B_' : 'S3_', out = [];
  if (!c.host) out.push(p + 'ENDPOINT');
  if (!c.bucket) out.push(p + 'BUCKET');
  if (!c.region) out.push(p + 'REGION');
  if (!c.accessKey) out.push(p + 'KEY_ID');
  if (!c.secret) out.push(p + 'SECRET');
  return out;
}
const configured = n => s3missing(n).length === 0;

function signedUrl(key, expires, n) {
  const c = conf(n);
  return presign({ host: c.host, path: `/${enc(c.bucket)}/${encPath(key)}`, region: c.region, accessKey: c.accessKey, secret: c.secret, expires });
}

// m3u8 ki har segment line ko signed link se badal deta hai
function rewritePlaylist(text, prefix, expires, n) {
  return text.split(/\r?\n/).map(line => {
    const t = line.trim();
    if (!t || t.startsWith('#')) return line;
    return signedUrl(prefix + t, expires, n);
  }).join('\n');
}

module.exports = { presign, conf, s3missing, configured, signedUrl, rewritePlaylist };
