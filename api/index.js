const app = require('../backend/server');

module.exports = async (req, res) => {
  try {
    return await app(req, res);
  } catch (err) {
    console.error('Vercel Top-level Error:', err);
    return res.status(500).json({
      success: false,
      message: `Vercel Function Error: ${err.message || String(err)}`,
      stack: err.stack
    });
  }
};
