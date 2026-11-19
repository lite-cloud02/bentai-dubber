const { getUser, isAdmin, displayName, send, fail, missing, limited } = require('./_lib');
module.exports = async (req, res) => {
  if (missing.length) return fail(res, 500, 'These Vercel variables are empty: ' + missing.join(', '));
  try {
    const user = await getUser(req);
    if (!user) return fail(res, 401, 'Login required');
    if (await limited(req, res, 'me:' + user.id, 60, 60)) return;
    send(res, 200, { email: user.email, name: displayName(user), isAdmin: isAdmin(user) });
  } catch (e) { fail(res, 500, e.message); }
};
