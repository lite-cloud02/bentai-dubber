const { UUID, getUser, fail, episodeKey, activeGrant } = require('./_lib');
// HLS decryption key: sirf logged-in user ko, aur sirf active access ke time
module.exports = async (req, res) => {
  try {
    const user = await getUser(req);
    if (!user) return fail(res, 401, 'Login required');
    const e = req.query.e;
    if (!UUID.test(e || '')) return fail(res, 400, 'Bad episode');
    if (!(await activeGrant(user.id, e))) return fail(res, 403, 'Access expired');
    res.setHeader('Content-Type', 'application/octet-stream');
    res.setHeader('Cache-Control', 'no-store');
    res.status(200).send(episodeKey(e));
  } catch (err) { fail(res, 500, 'Server error'); }
};
