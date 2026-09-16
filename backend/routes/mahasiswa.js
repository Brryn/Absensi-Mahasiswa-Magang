const express = require('express');
const router = express.Router();
const { dbHelper } = require('../config/database');
const { verifyToken } = require('../middleware/auth');
const { catatAktivitas } = require('../utils/logger');

// GET /api/mahasiswa - Daftar semua mahasiswa dengan filter
router.get('/', verifyToken, async (req, res) => {
  const { search, kampus_id, angkatan, jenis_program, status_aktif } = req.query;
  let sql = `
    SELECT m.*, k.nama_kampus, k.status_aktif as kampus_aktif 
    FROM mahasiswa m
    LEFT JOIN kampus k ON m.kampus_id = k.id
    WHERE 1=1
  `;
  const params = [];

  if (search) {
    sql += ` AND (m.nama LIKE ? OR m.nim LIKE ? OR k.nama_kampus LIKE ?) `;
    const term = `%${search}%`;
    params.push(term, term, term);
  }

  if (kampus_id) {
    sql += ` AND m.kampus_id = ? `;
    params.push(kampus_id);
  }

  if (angkatan) {
    sql += ` AND m.angkatan = ? `;
    params.push(angkatan);
  }

  if (jenis_program) {
    sql += ` AND m.jenis_program = ? `;
    params.push(jenis_program);
  }

  if (status_aktif !== undefined && status_aktif !== '') {
    sql += ` AND m.status_aktif = ? `;
    params.push(parseInt(status_aktif));
  }

  sql += ` ORDER BY m.nama ASC `;

  try {
    const list = await dbHelper.all(sql, params);
    res.json({ success: true, list });
  } catch (error) {
    console.error('Error ambil mahasiswa:', error);
    res.status(500).json({ success: false, message: 'Gagal mengambil data mahasiswa.' });
  }
});

// GET /api/mahasiswa/:id/detail - Profil Lengkap & Riwayat Absensi Mahasiswa
router.get('/:id/detail', verifyToken, async (req, res) => {
  const { id } = req.params;
  try {
    const student = await dbHelper.get(`
      SELECT m.*, k.nama_kampus, k.alamat as alamat_kampus
      FROM mahasiswa m
      LEFT JOIN kampus k ON m.kampus_id = k.id
      WHERE m.id = ?
    `, [id]);

    if (!student) {
      return res.status(404).json({ success: false, message: 'Mahasiswa tidak ditemukan.' });
    }

    // Hitung ringkasan statistik kehadiran
    const totalAbsen = await dbHelper.get('SELECT COUNT(*) as count FROM absensi WHERE mahasiswa_id = ?', [id]);
    const hadir = await dbHelper.get("SELECT COUNT(*) as count FROM absensi WHERE mahasiswa_id = ? AND status = 'hadir'", [id]);
    const terlambat = await dbHelper.get("SELECT COUNT(*) as count FROM absensi WHERE mahasiswa_id = ? AND status = 'terlambat'", [id]);
    const izin = await dbHelper.get("SELECT COUNT(*) as count FROM absensi WHERE mahasiswa_id = ? AND status = 'izin'", [id]);
    const sakit = await dbHelper.get("SELECT COUNT(*) as count FROM absensi WHERE mahasiswa_id = ? AND status = 'sakit'", [id]);
    const alpha = await dbHelper.get("SELECT COUNT(*) as count FROM absensi WHERE mahasiswa_id = ? AND status = 'alpha'", [id]);

    // Riwayat 10 absensi terakhir
    const history = await dbHelper.all(`
      SELECT * FROM absensi 
      WHERE mahasiswa_id = ? 
      ORDER BY tanggal DESC, jam_masuk DESC 
      LIMIT 15
    `, [id]);

    res.json({
      success: true,
      student,
      stats: {
        total_rekaman: totalAbsen.count,
        hadir: hadir.count,
        terlambat: terlambat.count,
        izin: izin.count,
        sakit: sakit.count,
        alpha: alpha.count
      },
      history
    });
  } catch (error) {
    console.error('Error ambil detail mahasiswa:', error);
    res.status(500).json({ success: false, message: 'Gagal mengambil profil mahasiswa.' });
  }
});

// POST /api/mahasiswa - Daftarkan mahasiswa baru
router.post('/', verifyToken, async (req, res) => {
  const {
    nama,
    nim,
    kampus_id,
    no_hp,
    angkatan,
    jenis_program,
    tgl_mulai,
    tgl_selesai,
    face_descriptor
  } = req.body;

  if (!nama || !nim || !kampus_id || !tgl_mulai || !tgl_selesai || !face_descriptor) {
    return res.status(400).json({ success: false, message: 'Semua kolom wajib diisi termasuk sampel wajah.' });
  }

  try {
    const descriptorString = typeof face_descriptor === 'string' 
      ? face_descriptor 
      : JSON.stringify(face_descriptor);

    const program = jenis_program || 'Magang';
    const akt = angkatan || new Date().getFullYear().toString();

    const result = await dbHelper.run(
      `INSERT INTO mahasiswa (nama, nim, kampus_id, no_hp, angkatan, jenis_program, status_aktif, tgl_mulai, tgl_selesai, face_descriptor) 
       VALUES (?, ?, ?, ?, ?, ?, 1, ?, ?, ?)`,
      [nama, nim, kampus_id, no_hp || '', akt, program, tgl_mulai, tgl_selesai, descriptorString]
    );

    // Catat log
    await catatAktivitas(req.admin.username, `Mendaftarkan mahasiswa baru: ${nama} (${program} - Angkatan ${akt})`);

    res.status(201).json({
      success: true,
      message: 'Mahasiswa berhasil didaftarkan.',
      id: result.id
    });
  } catch (error) {
    if (error.message.includes('UNIQUE')) {
      return res.status(400).json({ success: false, message: 'NIM sudah terdaftar. Gunakan NIM yang unik.' });
    }
    console.error('Error tambah mahasiswa:', error);
    res.status(500).json({ success: false, message: 'Gagal mendaftarkan mahasiswa.' });
  }
});

// PUT /api/mahasiswa/:id - Perbarui data mahasiswa
router.put('/:id', verifyToken, async (req, res) => {
  const { id } = req.params;
  const {
    nama,
    nim,
    kampus_id,
    no_hp,
    angkatan,
    jenis_program,
    status_aktif,
    tgl_mulai,
    tgl_selesai,
    face_descriptor
  } = req.body;

  if (!nama || !nim || !kampus_id || !tgl_mulai || !tgl_selesai) {
    return res.status(400).json({ success: false, message: 'Kolom utama tidak boleh kosong.' });
  }

  try {
    let sql = `
      UPDATE mahasiswa 
      SET nama = ?, nim = ?, kampus_id = ?, no_hp = ?, angkatan = ?, jenis_program = ?, tgl_mulai = ?, tgl_selesai = ?
    `;
    const params = [
      nama, 
      nim, 
      kampus_id, 
      no_hp || '', 
      angkatan || '', 
      jenis_program || 'Magang', 
      tgl_mulai, 
      tgl_selesai
    ];

    if (status_aktif !== undefined) {
      sql += `, status_aktif = ? `;
      params.push(status_aktif ? 1 : 0);
    }

    if (face_descriptor) {
      sql += `, face_descriptor = ? `;
      const descriptorString = typeof face_descriptor === 'string' 
        ? face_descriptor 
        : JSON.stringify(face_descriptor);
      params.push(descriptorString);
    }

    sql += ` WHERE id = ?`;
    params.push(id);

    await dbHelper.run(sql, params);

    // Catat log
    await catatAktivitas(req.admin.username, `Memperbarui data mahasiswa: ${nama} (NIM: ${nim})`);

    res.json({ success: true, message: 'Data mahasiswa berhasil diperbarui.' });
  } catch (error) {
    if (error.message.includes('UNIQUE')) {
      return res.status(400).json({ success: false, message: 'NIM sudah digunakan oleh mahasiswa lain.' });
    }
    console.error('Error edit mahasiswa:', error);
    res.status(500).json({ success: false, message: 'Gagal memperbarui data mahasiswa.' });
  }
});

// PUT /api/mahasiswa/:id/status - Toggle status aktif mahasiswa
router.put('/:id/status', verifyToken, async (req, res) => {
  const { id } = req.params;
  const { status_aktif } = req.body;

  if (status_aktif === undefined) {
    return res.status(400).json({ success: false, message: 'Status aktif harus disertakan.' });
  }

  try {
    const statusVal = status_aktif ? 1 : 0;
    const mhs = await dbHelper.get('SELECT nama FROM mahasiswa WHERE id = ?', [id]);
    const namaMhs = mhs ? mhs.nama : `ID ${id}`;

    await dbHelper.run('UPDATE mahasiswa SET status_aktif = ? WHERE id = ?', [statusVal, id]);

    const actionText = statusVal === 1 ? 'mengaktifkan' : 'menonaktifkan';
    await catatAktivitas(req.admin.username, `Mengubah status mahasiswa ${namaMhs} menjadi ${actionText.toUpperCase()}`);

    const msg = statusVal === 1 ? `Mahasiswa ${namaMhs} berhasil diaktifkan.` : `Mahasiswa ${namaMhs} berhasil dinonaktifkan (tidak dapat melakukan absensi).`;
    res.json({ success: true, message: msg });
  } catch (error) {
    console.error('Error ubah status mahasiswa:', error);
    res.status(500).json({ success: false, message: 'Gagal mengubah status mahasiswa.' });
  }
});

// DELETE /api/mahasiswa/:id - Hapus data mahasiswa
router.delete('/:id', verifyToken, async (req, res) => {
  const { id } = req.params;

  try {
    const mhs = await dbHelper.get('SELECT nama, nim FROM mahasiswa WHERE id = ?', [id]);
    const mhsInfo = mhs ? `${mhs.nama} (NIM: ${mhs.nim})` : `ID ${id}`;

    await dbHelper.run('DELETE FROM absensi WHERE mahasiswa_id = ?', [id]);
    await dbHelper.run('DELETE FROM mahasiswa WHERE id = ?', [id]);

    await catatAktivitas(req.admin.username, `Menghapus mahasiswa: ${mhsInfo}`);

    res.json({ success: true, message: 'Mahasiswa beserta riwayat absensinya berhasil dihapus.' });
  } catch (error) {
    console.error('Error hapus mahasiswa:', error);
    res.status(500).json({ success: false, message: 'Gagal menghapus data mahasiswa.' });
  }
});

module.exports = router;
