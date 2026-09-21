require('dotenv').config();
const express = require('express');
const fs = require('fs');
const path = require('path');
const cors = require('cors');
const cookieParser = require('cookie-parser');
const { initDb } = require('./config/database');

const app = express();
const PORT = process.env.PORT || 3000;

// Inisialisasi Database (Jika belum ada)
if (process.env.NODE_ENV !== 'production') {
  initDb().catch(err => {
    console.warn('Perhatian saat initDb:', err.message);
  });
}

// Middleware Global
app.use(cors({
  origin: true,
  credentials: true
}));
app.use(express.json({ limit: '10mb' })); // Limit besar untuk mengunggah face descriptors
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
app.use(cookieParser());

// Routing API (Dukung prefix /api dan tanpa prefix untuk Vercel Serverless)
app.use(['/api/auth', '/auth'], require('./routes/auth'));
app.use(['/api/kampus', '/kampus'], require('./routes/kampus'));
app.use(['/api/mahasiswa', '/mahasiswa'], require('./routes/mahasiswa'));
app.use(['/api/absensi', '/absensi'], require('./routes/absensi'));

// Menyajikan file statis (otomatis gunakan folder dist/ jika ada, atau frontend/ untuk dev)
const distPath = path.join(__dirname, '..', 'dist');
const devFrontendPath = path.join(__dirname, '..', 'frontend');
const publicPath = fs.existsSync(distPath) ? distPath : devFrontendPath;

console.log(`📁 Menyajikan Web Frontend dari: ${path.basename(publicPath)}/`);
app.use(express.static(publicPath));

// 404 handler khusus rute API
app.use('/api', (req, res) => {
  res.status(404).json({ success: false, message: 'API Endpoint tidak ditemukan.' });
});

// Global error handler
app.use((err, req, res, next) => {
  console.error('SERVER ERROR HANDLER:', err);
  res.status(500).json({
    success: false,
    message: `Server Error: ${err.message || String(err)}`
  });
});

// Fallback untuk SPA jika ada, atau sekadar mengembalikan index html absensi mahasiswa
app.get('*', (req, res) => {
  res.sendFile(path.join(publicPath, 'index.html'));
});

// Jalankan Server jika dipanggil secara langsung (bukan serverless Vercel)
if (require.main === module) {
  app.listen(PORT, () => {
    console.log(`==================================================`);
    console.log(` Server E-Absensi Kemenham berjalan sukses!`);
    console.log(` Port : ${PORT}`);
    console.log(` Link : http://localhost:${PORT}`);
    console.log(`==================================================`);
  });
}

module.exports = app;
