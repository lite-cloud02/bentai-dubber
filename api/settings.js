const { db, send, fail } = require('./_lib');
const { loadSettings } = require('./_settings');
module.exports = async (req, res) => {
  try { send(res, 200, await loadSettings(db)); } catch (e) { fail(res, 500, 'Server error'); }
};
