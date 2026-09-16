const express = require('express');
const router = express.Router();
const { dbHelper } = require('../config/database');
const { verifyToken } = require('../middleware/auth');
const { catatAktivitas } = require('../utils/logger');

// GET /api/kampus - Mendapatkan daftar semua kampus + jumlah mahasiswa
router.get('/', verifyToken, async (req, res) => {
  try {
    const list = await dbHelper.all(`
      SELECT k.*, 
        (SELECT COUNT(*) FROM mahasiswa m WHERE m.kampus_id = k.id) as total_mahasiswa
      FROM kampus k 
      ORDER BY k.nama_kampus ASC
    `);
    res.json({ success: true, list });
  } catch (error) {
    console.error('Error ambil kampus:', error);
    res.status(500).json({ success: false, message: 'Gagal mengambil data kampus.' });
  }
});

// POST /api/kampus - Tambah kampus baru
router.post('/', verifyToken, async (req, res) => {
  const { nama_kampus, alamat } = req.body;

  if (!nama_kampus) {
    return res.status(400).json({ success: false, message: 'Nama kampus harus diisi.' });
  }

  try {
    const result = await dbHelper.run(
      'INSERT INTO kampus (nama_kampus, alamat, status_aktif) VALUES (?, ?, 1)',
      [nama_kampus, alamat || '']
    );

    // Catat log
    await catatAktivitas(req.admin.username, `Menambahkan kampus baru: ${nama_kampus}`);

    res.status(201).json({
      success: true,
      message: 'Kampus berhasil ditambahkan.',
      id: result.id
    });
  } catch (error) {
    if (error.message.includes('UNIQUE')) {
      return res.status(400).json({
        success: false,
        message: 'Nama kampus sudah terdaftar. Harap gunakan nama kampus unik.'
      });
    }
    console.error('Error tambah kampus:', error);
    res.status(500).json({ success: false, message: 'Gagal menambahkan kampus.' });
  }
});

// PUT /api/kampus/:id - Edit data kampus
router.put('/:id', verifyToken, async (req, res) => {
  const { id } = req.params;
  const { nama_kampus, alamat } = req.body;

  if (!nama_kampus) {
    return res.status(400).json({ success: false, message: 'Nama kampus harus diisi.' });
  }

  try {
    await dbHelper.run(
      'UPDATE kampus SET nama_kampus = ?, alamat = ? WHERE id = ?',
      [nama_kampus, alamat || '', id]
    );

    // Catat log
    await catatAktivitas(req.admin.username, `Memperbarui data kampus: ${nama_kampus}`);

    res.json({ success: true, message: 'Kampus berhasil diperbarui.' });
  } catch (error) {
    if (error.message.includes('UNIQUE')) {
      return res.status(400).json({
        success: false,
        message: 'Nama kampus sudah terdaftar. Gunakan nama unik.'
      });
    }
    console.error('Error edit kampus:', error);
    res.status(500).json({ success: false, message: 'Gagal memperbarui data kampus.' });
  }
});

// DELETE /api/kampus/:id - Hapus data kampus
router.delete('/:id', verifyToken, async (req, res) => {
  const { id } = req.params;

  try {
    const kampus = await dbHelper.get('SELECT nama_kampus FROM kampus WHERE id = ?', [id]);
    if (!kampus) {
      return res.status(404).json({ success: false, message: 'Data kampus tidak ditemukan.' });
    }

    // Cek apakah masih ada mahasiswa yang terdaftar di kampus ini
    const countMhs = await dbHelper.get('SELECT COUNT(*) as total FROM mahasiswa WHERE kampus_id = ?', [id]);
    if (countMhs && countMhs.total > 0) {
      return res.status(400).json({
        success: false,
        message: `Kampus "${kampus.nama_kampus}" tidak dapat dihapus karena masih memiliki ${countMhs.total} mahasiswa yang terhubung. Silakan hapus atau pindahkan data mahasiswa terlebih dahulu.`
      });
    }

    // Hapus kampus jika sudah 0 mahasiswa
    await dbHelper.run('DELETE FROM kampus WHERE id = ?', [id]);

    // Catat log
    await catatAktivitas(req.admin.username, `Menghapus data kampus: ${kampus.nama_kampus}`);

    res.json({ success: true, message: `Kampus ${kampus.nama_kampus} berhasil dihapus.` });
  } catch (error) {
    console.error('Error hapus kampus:', error);
    res.status(500).json({ success: false, message: 'Gagal menghapus data kampus.' });
  }
});

// PUT /api/kampus/:id/status - Tetap dipertahankan untuk backward-compatibility
router.put('/:id/status', verifyToken, async (req, res) => {
  const { id } = req.params;
  const { status_aktif } = req.body;

  if (status_aktif === undefined) {
    return res.status(400).json({ success: false, message: 'Status aktif harus disertakan.' });
  }

  try {
    const statusVal = status_aktif ? 1 : 0;
    const kampus = await dbHelper.get('SELECT nama_kampus FROM kampus WHERE id = ?', [id]);
    const namaKampus = kampus ? kampus.nama_kampus : `ID ${id}`;

    await dbHelper.run(
      'UPDATE kampus SET status_aktif = ? WHERE id = ?',
      [statusVal, id]
    );

    const actionText = statusVal === 1 ? 'mengaktifkan' : 'menonaktifkan';
    await catatAktivitas(req.admin.username, `Mengubah status kampus ${namaKampus} menjadi ${actionText.toUpperCase()}`);

    const msg = statusVal === 1 ? 'Kampus berhasil diaktifkan.' : 'Kampus berhasil dinonaktifkan.';
    res.json({ success: true, message: msg });
  } catch (error) {
    console.error('Error ubah status kampus:', error);
    res.status(500).json({ success: false, message: 'Gagal mengubah status aktif kampus.' });
  }
});

module.exports = router;
