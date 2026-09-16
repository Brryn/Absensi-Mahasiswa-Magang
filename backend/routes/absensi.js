const express = require('express');
const router = express.Router();
const { dbHelper } = require('../config/database');
const { verifyToken } = require('../middleware/auth');
const { catatAktivitas } = require('../utils/logger');

// Helper Jarak Euclidean untuk Face Matching
function euclideanDistance(arr1, arr2) {
  if (!arr1 || !arr2 || arr1.length !== arr2.length) return Infinity;
  let sum = 0;
  for (let i = 0; i < arr1.length; i++) {
    sum += Math.pow(arr1[i] - arr2[i], 2);
  }
  return Math.sqrt(sum);
}

// Helper Jarak Geografis Haversine (dalam meter)
function getHaversineDistance(lat1, lon1, lat2, lon2) {
  const R = 6371000; // Radius Bumi dalam meter
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = 
    Math.sin(dLat/2) * Math.sin(dLat/2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * 
    Math.sin(dLon/2) * Math.sin(dLon/2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  return R * c;
}

// Helper mendapatkan tanggal & waktu lokal (WITA - UTC+8)
function getLocalTimeInfo() {
  const dateObj = new Date();
  const utc = dateObj.getTime() + (dateObj.getTimezoneOffset() * 60000);
  const witaTime = new Date(utc + (3600000 * 8)); // UTC + 8 jam
  
  const year = witaTime.getFullYear();
  const month = String(witaTime.getMonth() + 1).padStart(2, '0');
  const day = String(witaTime.getDate()).padStart(2, '0');
  const tanggal = `${year}-${month}-${day}`;
  
  const hours = String(witaTime.getHours()).padStart(2, '0');
  const minutes = String(witaTime.getMinutes()).padStart(2, '0');
  const seconds = String(witaTime.getSeconds()).padStart(2, '0');
  const jam = `${hours}:${minutes}:${seconds}`;
  
  return { tanggal, jam, datetime: `${tanggal} ${jam}`, witaTime };
}

// POST /api/absensi/verifikasi - Proses absensi mahasiswa (face match, status kampus, validasi lokasi)
router.post('/verifikasi', async (req, res) => {
  const { face_descriptor, latitude, longitude, akurasi_gps } = req.body;

  if (!face_descriptor || latitude === undefined || longitude === undefined) {
    return res.status(400).json({ success: false, message: 'Data absensi tidak lengkap (wajah/lokasi tidak terdeteksi).' });
  }

  try {
    // 1. Ambil pengaturan kantor dari database (dinamis)
    const settings = await dbHelper.get('SELECT * FROM pengaturan ORDER BY id DESC LIMIT 1');
    if (!settings) {
      return res.status(500).json({ success: false, message: 'Konfigurasi lokasi kantor belum diatur oleh admin.' });
    }

    // Set threshold wajah dinamis dari database (default 0.45 jika belum diatur)
    const threshold = settings.threshold_wajah !== undefined && settings.threshold_wajah !== null 
      ? settings.threshold_wajah 
      : 0.45;

    // 2. Ambil semua mahasiswa yang memiliki descriptor wajah
    const students = await dbHelper.all(`
      SELECT m.id, m.nama, m.face_descriptor, m.kampus_id, m.status_aktif, k.nama_kampus, k.status_aktif as kampus_aktif
      FROM mahasiswa m
      LEFT JOIN kampus k ON m.kampus_id = k.id
    `);

    let matchedStudent = null;
    let minDistance = Infinity;

    console.log('\n======================================');
    console.log('       PROSES PENCOCOKAN WAJAH');
    console.log('======================================');

    // Cari mahasiswa dengan kecocokan wajah terbaik (Euclidean distance minimum)
    for (const student of students) {
      if (!student.face_descriptor) continue;
      
      let studentDescriptors;
      try {
        studentDescriptors = JSON.parse(student.face_descriptor);
      } catch (e) {
        continue;
      }

      let studentMinDistance = Infinity;

      // Pastikan format descriptor tersimpan berupa array
      if (Array.isArray(studentDescriptors)) {
        if (Array.isArray(studentDescriptors[0])) {
          for (const descriptor of studentDescriptors) {
            const dist = euclideanDistance(face_descriptor, descriptor);
            if (dist < studentMinDistance) {
              studentMinDistance = dist;
            }
          }
        } else {
          studentMinDistance = euclideanDistance(face_descriptor, studentDescriptors);
        }
      }

      console.log(`- Mahasiswa: ${student.nama} | Jarak Wajah: ${studentMinDistance.toFixed(4)}`);

      if (studentMinDistance < minDistance) {
        minDistance = studentMinDistance;
        matchedStudent = student;
      }
    }

    console.log('--------------------------------------');
    console.log(`Hasil Terbaik: ${matchedStudent ? matchedStudent.nama : 'Tidak Ada'} | Jarak Terkecil: ${minDistance.toFixed(4)} (Batas Maksimal/Threshold: ${threshold})`);
    console.log('======================================\n');

    // Periksa apakah kecocokan di bawah threshold
    if (!matchedStudent || minDistance >= threshold) {
      return res.status(400).json({ 
        success: false, 
        message: 'Wajah tidak dikenali. Pastikan posisi wajah tegak dan pencahayaan cukup.' 
      });
    }

    // 3. Validasi status aktif akun mahasiswa & kampus
    if (matchedStudent.status_aktif === 0) {
      return res.status(403).json({ 
        success: false, 
        message: 'Absen ditolak. Akun mahasiswa Anda saat ini sedang dinonaktifkan oleh Admin.' 
      });
    }

    if (matchedStudent.kampus_aktif === 0) {
      return res.status(403).json({
        success: false,
        message: `Absen ditolak. Kampus Anda (${matchedStudent.nama_kampus || 'Kampus Asal'}) saat ini sedang dinonaktifkan oleh Admin.`
      });
    }

    // 4. Hitung jarak mahasiswa ke kantor (Haversine)
    const distance = getHaversineDistance(
      latitude, 
      longitude, 
      settings.latitude_kantor, 
      settings.longitude_kantor
    );

    if (distance > settings.radius_meter) {
      return res.status(400).json({
        success: false,
        message: `Anda berada di luar wilayah kantor Kemenham. Jarak Anda: ${Math.round(distance)} meter. Batas toleransi radius: ${settings.radius_meter} meter.`
      });
    }

    // 5. Catat absensi & Cegah absen ganda
    const timeInfo = getLocalTimeInfo();
    const existing = await dbHelper.get(
      'SELECT * FROM absensi WHERE mahasiswa_id = ? AND tanggal = ?',
      [matchedStudent.id, timeInfo.tanggal]
    );

    if (existing) {
      const jamAda = existing.jam_masuk ? (existing.jam_masuk.includes(' ') ? existing.jam_masuk.split(' ')[1] : existing.jam_masuk) : '';
      return res.json({
        success: true,
        already_attended: true,
        type: 'sudah_absen',
        nama: matchedStudent.nama,
        nim: matchedStudent.nim || '-',
        kampus: matchedStudent.nama_kampus || 'Kementerian HAM',
        jam: jamAda || timeInfo.jam,
        status: (existing.status || 'hadir').toUpperCase(),
        distance: Math.round(distance),
        message: `Anda sudah tercatat hadir untuk hari ini pada pukul ${jamAda || timeInfo.jam} WITA.`
      });
    }

    // Lakukan Presensi Kehadiran (Waktu Datang)
    let limitHour = 8;
    let limitMin = 0;
    if (settings && settings.jam_terlambat) {
      const parts = settings.jam_terlambat.split(':');
      if (parts.length >= 2) {
        limitHour = parseInt(parts[0], 10);
        limitMin = parseInt(parts[1], 10);
      }
    }

    const checkInTime = timeInfo.witaTime;
    let status = 'hadir';

    // Cek keterlambatan
    if (checkInTime.getHours() > limitHour || (checkInTime.getHours() === limitHour && checkInTime.getMinutes() > limitMin)) {
      status = 'terlambat';
    }

    await dbHelper.run(
      `INSERT INTO absensi (mahasiswa_id, tanggal, jam_masuk, status, latitude, longitude, akurasi_gps) 
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [matchedStudent.id, timeInfo.tanggal, timeInfo.datetime, status, latitude, longitude, akurasi_gps || null]
    );

    // Catat log aktivitas
    await catatAktivitas(matchedStudent.nama, `Melakukan presensi KEHADIRAN secara mandiri (${status.toUpperCase()}, Jarak: ${Math.round(distance)}m).`);

    return res.json({
      success: true,
      type: 'masuk',
      nama: matchedStudent.nama,
      nim: matchedStudent.nim,
      kampus: matchedStudent.nama_kampus,
      jam: timeInfo.jam,
      status: status,
      message: `Presensi kehadiran berhasil dicatat pada pukul ${timeInfo.jam} WITA (${status === 'hadir' ? 'Tepat Waktu' : 'Terlambat'}).`
    });

  } catch (error) {
    console.error('Error saat verifikasi absensi:', error);
    res.status(500).json({ 
      success: false, 
      message: error.message ? `Gagal memproses absensi: ${error.message}` : 'Terjadi kesalahan internal pada server saat memproses absensi.' 
    });
  }
});

// GET /api/absensi/rekap - Rekap absensi mahasiswa dengan filter (Admin)
router.get('/rekap', verifyToken, async (req, res) => {
  const { tanggal, tanggal_mulai, tanggal_selesai, kampus_id, status } = req.query;
  let sql = `
    SELECT a.*, m.nama, m.nim, k.nama_kampus
    FROM absensi a
    LEFT JOIN mahasiswa m ON a.mahasiswa_id = m.id
    LEFT JOIN kampus k ON m.kampus_id = k.id
    WHERE 1=1
  `;
  const params = [];

  if (tanggal_mulai && tanggal_selesai) {
    sql += ' AND a.tanggal >= ? AND a.tanggal <= ?';
    params.push(tanggal_mulai, tanggal_selesai);
  } else if (tanggal_mulai) {
    sql += ' AND a.tanggal >= ?';
    params.push(tanggal_mulai);
  } else if (tanggal_selesai) {
    sql += ' AND a.tanggal <= ?';
    params.push(tanggal_selesai);
  } else if (tanggal) {
    sql += ' AND a.tanggal = ?';
    params.push(tanggal);
  }

  if (kampus_id) {
    sql += ' AND m.kampus_id = ?';
    params.push(kampus_id);
  }
  if (status) {
    sql += ' AND a.status = ?';
    params.push(status);
  }

  sql += ' ORDER BY a.tanggal DESC, a.jam_masuk DESC';

  try {
    const list = await dbHelper.all(sql, params);
    res.json({ success: true, list });
  } catch (error) {
    console.error('Error rekap absensi:', error);
    res.status(500).json({ success: false, message: 'Gagal mengambil rekap absensi.' });
  }
});

// POST /api/absensi/manual - Input absensi manual oleh Admin (izin, sakit, alpha, dsb)
router.post('/manual', verifyToken, async (req, res) => {
  const { mahasiswa_id, tanggal, status } = req.body;

  if (!mahasiswa_id || !tanggal || !status) {
    return res.status(400).json({ success: false, message: 'Kolom mahasiswa, tanggal, dan status wajib diisi.' });
  }

  const validStatus = ['hadir', 'izin', 'sakit', 'alpha', 'terlambat'];
  if (!validStatus.includes(status)) {
    return res.status(400).json({ success: false, message: 'Status kehadiran tidak valid.' });
  }

  try {
    // Cek apakah data absensi hari tersebut sudah ada
    const existing = await dbHelper.get(
      'SELECT id FROM absensi WHERE mahasiswa_id = ? AND tanggal = ?',
      [mahasiswa_id, tanggal]
    );

    const timeInfo = getLocalTimeInfo();
    const mockDatetime = `${tanggal} ${timeInfo.jam}`;

    if (existing) {
      await dbHelper.run(
        'UPDATE absensi SET status = ? WHERE id = ?',
        [status, existing.id]
      );
    } else {
      await dbHelper.run(
        `INSERT INTO absensi (mahasiswa_id, tanggal, jam_masuk, status) 
         VALUES (?, ?, ?, ?)`,
        [mahasiswa_id, tanggal, mockDatetime, status]
      );
    }

    // Dapatkan nama mahasiswa untuk log
    const mhs = await dbHelper.get('SELECT nama FROM mahasiswa WHERE id = ?', [mahasiswa_id]);
    const namaMhs = mhs ? mhs.nama : `ID ${mahasiswa_id}`;

    // Catat log
    await catatAktivitas(
      req.admin.username, 
      `Mengupdate absensi manual mahasiswa ${namaMhs} tanggal ${tanggal} dengan status ${status.toUpperCase()}`
    );

    res.json({ success: true, message: 'Absensi berhasil diperbarui secara manual.' });
  } catch (error) {
    console.error('Error input absensi manual:', error);
    res.status(500).json({ success: false, message: 'Gagal mengupdate absensi manual.' });
  }
});

// GET /api/absensi/dashboard-stats - Ringkasan Dashboard Admin
router.get('/dashboard-stats', verifyToken, async (req, res) => {
  try {
    const timeInfo = getLocalTimeInfo();
    const today = timeInfo.tanggal;

    // 1. Jumlah hadir/terlambat hari ini
    const hadirToday = await dbHelper.get(
      "SELECT COUNT(*) as count FROM absensi WHERE tanggal = ? AND status IN ('hadir', 'terlambat')",
      [today]
    );

    // 2. Total mahasiswa aktif
    const activeStudents = await dbHelper.get(
      'SELECT COUNT(*) as count FROM mahasiswa'
    );

    // 3. Rekap grafis mingguan (kehadiran per hari selama 7 hari terakhir)
    const weeklyData = [];
    for (let i = 6; i >= 0; i--) {
      const dateObj = new Date();
      const utc = dateObj.getTime() + (dateObj.getTimezoneOffset() * 60000);
      const witaTime = new Date(utc + (3600000 * 8) - (i * 24 * 60 * 60 * 1000));
      
      const y = witaTime.getFullYear();
      const m = String(witaTime.getMonth() + 1).padStart(2, '0');
      const d = String(witaTime.getDate()).padStart(2, '0');
      const dateString = `${y}-${m}-${d}`;
      
      const countRow = await dbHelper.get(
        "SELECT COUNT(*) as count FROM absensi WHERE tanggal = ? AND status IN ('hadir', 'terlambat')",
        [dateString]
      );
      
      const days = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];
      const dayName = days[witaTime.getDay()];

      weeklyData.push({
        tanggal: dateString,
        hari: dayName,
        jumlah: countRow.count
      });
    }

    res.json({
      success: true,
      stats: {
        hadir_hari_ini: hadirToday.count,
        total_mahasiswa: activeStudents.count
      },
      weekly: weeklyData
    });
  } catch (error) {
    console.error('Error dashboard stats:', error);
    res.status(500).json({ success: false, message: 'Gagal mengambil data dashboard.' });
  }
});

// GET /api/absensi/export-excel & /api/absensi/export-csv - Ekspor Rekap Kehadiran Resmi ke Excel
router.get(['/export-excel', '/export-csv'], verifyToken, async (req, res) => {
  const { tanggal, tanggal_mulai, tanggal_selesai, kampus_id, status } = req.query;
  let sql = `
    SELECT a.tanggal, a.jam_masuk, a.jam_pulang, a.status, a.latitude, a.longitude,
           m.nama, m.nim, k.nama_kampus
    FROM absensi a
    LEFT JOIN mahasiswa m ON a.mahasiswa_id = m.id
    LEFT JOIN kampus k ON m.kampus_id = k.id
    WHERE 1=1
  `;
  const params = [];

  if (tanggal_mulai && tanggal_selesai) {
    sql += ' AND a.tanggal >= ? AND a.tanggal <= ?';
    params.push(tanggal_mulai, tanggal_selesai);
  } else if (tanggal_mulai) {
    sql += ' AND a.tanggal >= ?';
    params.push(tanggal_mulai);
  } else if (tanggal_selesai) {
    sql += ' AND a.tanggal <= ?';
    params.push(tanggal_selesai);
  } else if (tanggal) {
    sql += ' AND a.tanggal = ?';
    params.push(tanggal);
  }

  if (kampus_id) {
    sql += ' AND m.kampus_id = ?';
    params.push(kampus_id);
  }
  if (status) {
    sql += ' AND a.status = ?';
    params.push(status);
  }

  sql += ' ORDER BY a.tanggal DESC, m.nama ASC';

  try {
    const list = await dbHelper.all(sql, params);

    // Ambil info nama kampus jika difilter
    let namaKampusHeader = 'SELURUH KAMPUS ASAL MAGANG';
    if (kampus_id) {
      const kps = await dbHelper.get('SELECT nama_kampus FROM kampus WHERE id = ?', [kampus_id]);
      if (kps) namaKampusHeader = kps.nama_kampus.toUpperCase();
    }

    // Format tanggal Indonesia
    const formatIndoDate = (dateStr) => {
      if (!dateStr) return '';
      const d = new Date(dateStr);
      const months = [
        'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
        'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'
      ];
      return `${d.getDate()} ${months[d.getMonth()]} ${d.getFullYear()}`;
    };

    const timeInfo = getLocalTimeInfo();
    let tanggalTampil = '';
    if (tanggal_mulai && tanggal_selesai) {
      tanggalTampil = `${formatIndoDate(tanggal_mulai).toUpperCase()} S/D ${formatIndoDate(tanggal_selesai).toUpperCase()}`;
    } else if (tanggal_mulai) {
      tanggalTampil = `MULAI ${formatIndoDate(tanggal_mulai).toUpperCase()}`;
    } else if (tanggal_selesai) {
      tanggalTampil = `HINGGA ${formatIndoDate(tanggal_selesai).toUpperCase()}`;
    } else if (tanggal) {
      tanggalTampil = formatIndoDate(tanggal).toUpperCase();
    } else {
      tanggalTampil = `SEMUA PERIODE (S/D ${formatIndoDate(timeInfo.tanggal).toUpperCase()})`;
    }

    const tanggalTtd = formatIndoDate(timeInfo.tanggal);

    // Bangun HTML Spreadsheet yang dibuka sempurna oleh Microsoft Excel
    let excelHtml = `
<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:x="urn:schemas-microsoft-com:office:excel" xmlns="http://www.w3.org/TR/REC-html40">
<head>
  <meta http-equiv="Content-Type" content="text/html; charset=utf-8">
  <!--[if gte mso 9]>
  <xml>
    <x:ExcelWorkbook>
      <x:ExcelWorksheets>
        <x:ExcelWorksheet>
          <x:Name>Absensi Mahasiswa</x:Name>
          <x:WorksheetOptions>
            <x:DisplayGridlines/>
          </x:WorksheetOptions>
        </x:ExcelWorksheet>
      </x:ExcelWorksheets>
    </x:ExcelWorkbook>
  </xml>
  <![endif]-->
  <style>
    body { font-family: 'Arial', sans-serif; font-size: 10pt; color: #000000; }
    .kop-1 { font-size: 12pt; font-weight: bold; text-align: center; }
    .kop-2 { font-size: 11pt; font-weight: bold; text-align: center; }
    .kop-desc { font-size: 8.5pt; text-align: center; color: #333333; }
    .title-doc { font-size: 11pt; font-weight: bold; text-align: center; text-transform: uppercase; }
    .meta-doc { font-size: 10pt; font-weight: bold; text-align: center; text-transform: uppercase; }
    
    table.data-grid { border-collapse: collapse; width: 100%; margin-top: 10px; }
    table.data-grid th { background-color: #f1f5f9; font-weight: bold; text-align: center; border: 1px solid #000000; padding: 6px 8px; font-size: 9.5pt; }
    table.data-grid td { border: 1px solid #000000; padding: 5px 8px; font-size: 9.5pt; vertical-align: middle; }
    
    .c-center { text-align: center; }
    .c-left { text-align: left; }
    .c-right { text-align: right; }
    .bold { font-weight: bold; }
    .st-hadir { color: #047857; font-weight: bold; }
    .st-terlambat { color: #b45309; font-weight: bold; }
    .st-izin { color: #1d4ed8; font-weight: bold; }
    .st-sakit { color: #6b21a8; font-weight: bold; }
    .st-alpha { color: #b91c1c; font-weight: bold; }
  </style>
</head>
<body>
  <table>
    <!-- KOP SURAT RESMI KEMENTERIAN HAM -->
    <tr>
      <td colspan="9" class="kop-1">KEMENTERIAN HAK ASASI MANUSIA</td>
    </tr>
    <tr>
      <td colspan="9" class="kop-1">REPUBLIK INDONESIA</td>
    </tr>
    <tr>
      <td colspan="9" class="kop-2">KANTOR WILAYAH SULAWESI SELATAN</td>
    </tr>
    <tr>
      <td colspan="9" class="kop-2">WILAYAH KERJA SULAWESI TENGGARA</td>
    </tr>
    <tr>
      <td colspan="9" class="kop-desc">Jl. Abunawas No. VII, Bende, Kec. Kadia, Kota Kendari, Sulawesi Tenggara 93461</td>
    </tr>
    <tr>
      <td colspan="9" class="kop-desc">Website: https://kemenham.go.id | Email: kementerianhamsultra@gmail.com</td>
    </tr>
    <tr>
      <td colspan="9" style="border-bottom: 2px solid #000000; height: 5px;"></td>
    </tr>
    <tr><td colspan="9" style="height: 12px;"></td></tr>
    
    <!-- JUDUL LAPORAN -->
    <tr>
      <td colspan="9" class="title-doc">DAFTAR HADIR / ABSENSI MAHASISWA MAGANG</td>
    </tr>
    <tr>
      <td colspan="9" class="meta-doc">${namaKampusHeader}</td>
    </tr>
    <tr>
      <td colspan="9" class="meta-doc">TANGGAL: ${tanggalTampil}</td>
    </tr>
    <tr><td colspan="9" style="height: 10px;"></td></tr>
  </table>

  <!-- TABEL DATA KEHADIRAN -->
  <table class="data-grid">
    <thead>
      <tr>
        <th style="width: 35px;">No</th>
        <th>NAMA MAHASISWA</th>
        <th>STAMBUK / NIM</th>
        <th>KAMPUS ASAL</th>
        <th>WAKTU MASUK</th>
        <th>WAKTU PULANG</th>
        <th>STATUS</th>
        <th>PARAF / VERIFIKASI</th>
        <th>KETERANGAN</th>
      </tr>
    </thead>
    <tbody>
`;

    if (list.length === 0) {
      excelHtml += `
      <tr>
        <td colspan="9" class="c-center" style="padding: 15px; color: #64748b;">Tidak ada catatan kehadiran pada filter tanggal/kampus ini.</td>
      </tr>
      `;
    } else {
      list.forEach((row, idx) => {
        const jamMsk = row.jam_masuk ? row.jam_masuk.split(' ')[1] || row.jam_masuk : '-';
        const jamPlg = row.jam_pulang ? row.jam_pulang.split(' ')[1] || row.jam_pulang : '-';
        const statusUpper = (row.status || 'HADIR').toUpperCase();
        
        let statusClass = 'st-hadir';
        if (row.status === 'terlambat') statusClass = 'st-terlambat';
        else if (row.status === 'izin') statusClass = 'st-izin';
        else if (row.status === 'sakit') statusClass = 'st-sakit';
        else if (row.status === 'alpha') statusClass = 'st-alpha';

        const parafVerifikasi = row.latitude ? 'Tervalidasi Biometrik AI' : 'Manual / Terverifikasi';
        const keterangan = row.status === 'terlambat' ? 'Terlambat Masuk' : (row.status === 'hadir' ? 'Tepat Waktu' : statusUpper);

        excelHtml += `
      <tr>
        <td class="c-center">${idx + 1}</td>
        <td class="c-left bold">${row.nama || '-'}</td>
        <td class="c-center">${row.nim || '-'}</td>
        <td class="c-left">${row.nama_kampus || '-'}</td>
        <td class="c-center">${jamMsk}</td>
        <td class="c-center">${jamPlg}</td>
        <td class="c-center ${statusClass}">${statusUpper}</td>
        <td class="c-center">${parafVerifikasi}</td>
        <td class="c-left">${keterangan}</td>
      </tr>
        `;
      });
    }

    excelHtml += `
    </tbody>
  </table>

  <!-- TANDA TANGAN / PENGESAHAN KOORDINATOR -->
  <br>
  <table>
    <tr>
      <td colspan="6"></td>
      <td colspan="3" style="text-align: center; font-size: 10pt;">
        Kendari, ${tanggalTtd}<br>
        Mengetahui,<br>
        <strong>Koordinator / Pembimbing Magang</strong>
        <br><br><br><br>
        <strong><u>Muhammad Imran Karim</u></strong><br>
        NIP. ........................................
      </td>
    </tr>
  </table>
</body>
</html>
    `;

    const fileName = `rekap_absensi_kemenham_${tanggal || 'semua'}.xls`;
    res.setHeader('Content-Type', 'application/vnd.ms-excel; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);
    res.status(200).send(excelHtml);

  } catch (error) {
    console.error('Error export Excel:', error);
    res.status(500).json({ success: false, message: 'Gagal mengekspor data absensi ke Excel.' });
  }
});

module.exports = router;
