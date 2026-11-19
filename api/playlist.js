const { UUID, getUser, fail, activeGrant } = require('./_lib');
const { s3missing, signedUrl, rewritePlaylist } = require('./_s3');

// HLS playlist: sirf active access wale user ko, har segment ka signed link ke saath
module.exports = async (req, res) => {
  try {
    const miss = s3missing();
    if (miss.length) return fail(res, 500, 'These Vercel variables are empty: ' + miss.join(', '));
    const user = await getUser(req);
    if (!user) return fail(res, 401, 'Login required');
    const e = req.query.e;
    if (!UUID.test(e || '')) return fail(res, 400, 'Bad episode');
    const grant = await activeGrant(user.id, e);
    if (!grant) return fail(res, 403, 'Access expired');

    const left = Math.floor((new Date(grant.expires_at).getTime() - Date.now()) / 1000);
    const expires = Math.max(60, Math.min(left + 60, 7200));
    const r = await fetch(signedUrl(`episodes/${e}/index.m3u8`, 300));
    if (!r.ok) return fail(res, 404, r.status === 404
      ? 'Video file not found. The episode may not be encoded yet (check the GitHub Actions run).'
      : `Backblaze refused the request (status ${r.status}). Check S3_KEY_ID, S3_SECRET and S3_BUCKET.`);
    const text = await r.text();
    res.setHeader('Content-Type', 'application/vnd.apple.mpegurl');
    res.setHeader('Cache-Control', 'no-store');
    res.status(200).send(rewritePlaylist(text, `episodes/${e}/`, expires));
  } catch (err) { fail(res, 500, 'Server error'); }
};
