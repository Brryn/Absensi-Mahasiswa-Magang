const jwt = require('jsonwebtoken');

const JWT_SECRET = process.env.JWT_SECRET || 'kemenham_magang_absensi_super_secret_key_12345';

function verifyToken(req, res, next) {
  // Ambil token dari cookie, header Authorization, atau query parameter
  let token = req.cookies && req.cookies.token ? req.cookies.token : null;

  if (!token && req.query && req.query.token) {
    token = req.query.token;
  }

  if (!token && req.headers.authorization) {
    const parts = req.headers.authorization.split(' ');
    if (parts.length === 2 && parts[0] === 'Bearer') {
      token = parts[1];
    }
  }

  if (!token) {
    return res.status(401).json({ success: false, message: 'Akses ditolak. Token tidak disediakan.' });
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    req.admin = decoded;
    next();
  } catch (error) {
    return res.status(403).json({ success: false, message: 'Token tidak valid atau telah kedaluwarsa.' });
  }
}

module.exports = {
  verifyToken,
  JWT_SECRET
};
