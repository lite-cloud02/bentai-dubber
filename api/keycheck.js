const { crypto, send } = require('./_lib');
// Temporary check: compare with the "KEY_SECRET check" line in the GitHub Actions log. Delete this file when done.
module.exports = (req, res) => {
  const s = process.env.KEY_SECRET || '';
  send(res, 200, { set: !!s, length: s.length, fingerprint: crypto.createHash('sha256').update(s).digest('hex').slice(0, 8) });
};
