const { UUID, getUser, fail, activeGrant } = require('./_lib');
const { s3missing, configured, signedUrl, rewritePlaylist } = require('./_s3');

// HLS playlist: sirf active access wale user ko, har segment ka signed link ke saath.
// Server 1 ya Server 2: sirf wahi jo player ne maanga (?srv=2). Apne aap dusre server par nahi jaata, button dabane par hi.
module.exports = async (req, res) => {
  try {
    const n = (String(req.query.srv) === '2' && configured(2)) ? 2 : 1;
    if (!configured(n)) return fail(res, 500, 'These Vercel variables are empty: ' + s3missing(n).join(', '));
    const user = await getUser(req);
    if (!user) return fail(res, 401, 'Login required');
    const e = req.query.e;
    if (!UUID.test(e || '')) return fail(res, 400, 'Bad episode');
    const grant = await activeGrant(user.id, e);
    if (!grant) return fail(res, 403, 'Access expired');

    const left = Math.floor((new Date(grant.expires_at).getTime() - Date.now()) / 1000);
    const expires = Math.max(60, Math.min(left + 60, 7200));

    let r;
    try { r = await fetch(signedUrl(`episodes/${e}/index.m3u8`, 300, n), { signal: AbortSignal.timeout(8000) }); }
    catch (err) { return fail(res, 503, 'Video is temporarily unavailable. Please try again in a few minutes.'); }
    if (!r.ok) {
      return fail(res, r.status === 404 ? 404 : 503, r.status === 404
        ? 'Video file not found on this server. It may not be encoded yet (check the GitHub Actions run).'
        : 'Video is temporarily unavailable. Please try again in a few minutes.');
    }
    const text = await r.text();
    res.setHeader('Content-Type', 'application/vnd.apple.mpegurl');
    res.setHeader('Cache-Control', 'no-store');
    res.setHeader('X-Storage', String(n));
    res.status(200).send(rewritePlaylist(text, `episodes/${e}/`, expires, n));
  } catch (err) { fail(res, 500, 'Server error'); }
};
