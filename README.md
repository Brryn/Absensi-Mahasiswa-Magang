# E-Absensi Mahasiswa Magang - Kementerian HAM (Kemenham)

Sistem absensi full-stack berbasis web untuk mahasiswa magang di Kementerian HAM. Dilengkapi fitur **Face Recognition (Pencocokan Wajah)**, **Liveness Check (Deteksi Kedip)**, dan **Geofencing (Validasi Lokasi GPS)** secara real-time di sisi server.

---

## 🛠️ Tech Stack & Fitur Utama

- **Frontend**: Vanilla HTML, CSS (Premium & Modern Grid), Javascript, dan `@vladmandic/face-api` (untuk deteksi wajah & facial landmarks).
- **Backend**: Node.js + Express.js.
- **Database**: Dukungan Dual Database — **MySQL / MariaDB** (Default untuk hosting & production) dan **SQLite** (lokal `/database/absensi.db`). Beralih otomatis via file `.env`.
- **Geofencing**: Menggunakan rumus matematika **Haversine** di server untuk membandingkan koordinat GPS mahasiswa dengan lokasi kantor Kemenham.
- **Liveness Check**: Deteksi kedipan nyata mata menggunakan perhitungan matematika **Eye Aspect Ratio (EAR)** antar-frame sebelum pencocokan wajah dilakukan.
- **Deaktivasi Batch**: Admin dapat menonaktifkan status aktif satu kampus, sehingga seluruh mahasiswa dari kampus tersebut otomatis dibekukan dari hak absensi tanpa memperbarui profil mahasiswa satu per satu.

---

## 🚀 Cara Menjalankan Project

### 1. Prasyarat
Pastikan Anda sudah menginstal **Node.js** (versi 16 atau lebih baru) di sistem Anda.

### 2. Instalasi Dependensi
Buka terminal/command prompt di direktori root project (`kemenham-absensi`), lalu jalankan perintah:
```bash
npm install
```
*Catatan*: Saat proses instalasi selesai (`postinstall`), script otomatis (`scripts/download-models.js`) akan berjalan untuk mengunduh model face-api.js dari CDN ke folder lokal `/frontend/models/`.

### 3. Jalankan Aplikasi
Untuk menyalakan server lokal, jalankan perintah:
```bash
npm run dev
```
Setelah server menyala, buka browser Anda dan akses:
- **Halaman Absensi Mahasiswa**: [http://localhost:3000](http://localhost:3000)
- **Halaman Panel Admin**: [http://localhost:3000/admin/login.html](http://localhost:3000/admin/login.html)

---

## 🔑 Kredensial Admin & Seed Data Awal

Saat pertama kali server dijalankan, database SQLite akan dibuat secara otomatis dan diisi dengan data awal (seed):
- **Username Admin**: `admin`
- **Password Admin**: `admin123` (Telah ter-hash secara otomatis menggunakan `bcryptjs`)
- **Lokasi Kantor Default (Kendari)**:
  - Latitude: `-3.9778`
  - Longitude: `122.5150`
  - Radius: `100` meter
  *Catatan*: Anda dapat mengubah koordinat & radius kantor secara instan melalui menu **Pengaturan** di Dashboard Admin.

---

## 🧪 Panduan Alur Pengujian / Demo

1. **Login Admin**: 
   Akses `http://localhost:3000/admin/login.html` dan masuk menggunakan kredensial di atas.
2. **Tambah Kampus**:
   Masuk ke tab **Kelola Kampus**, klik **Tambah Kampus**, dan buat kampus baru. Pastikan format nama kampus menyertakan tahun angkatan (contoh: `Universitas Nahdlatul Ulama Sulawesi Tenggara 2025`).
3. **Daftarkan Mahasiswa**:
   Masuk ke tab **Kelola Mahasiswa**, klik **Daftarkan Mahasiswa**. Isi formulir dan ambil 3 sampel wajah dengan kamera admin (sudut: Depan, Kiri, dan Kanan). Simpan data mahasiswa.
4. **Kalibrasi Lokasi Kantor (Penting untuk Demo)**:
   Karena validasi lokasi dihitung di backend, silakan buka tab **Pengaturan** di admin, lalu ubah koordinat latitude dan longitude kantor Kemenham agar **sesuai dengan koordinat GPS tempat Anda melakukan pengujian saat ini** (Anda dapat mengecek koordinat Anda melalui Google Maps atau log browser). Atur radius toleransi (default 100 meter), lalu simpan.
5. **Uji Coba Absensi Mahasiswa**:
   Buka halaman absensi mahasiswa di HP atau tab baru (`http://localhost:3000`). Klik **Mulai Absen**, izinkan kamera dan GPS, berkedip saat diminta, dan lihat hasil verifikasi absensinya.
6. **Uji Coba Penolakan**:
   - Coba ganti lokasi kantor di tab Pengaturan Admin ke lokasi lain yang jauh. Lakukan absensi lagi, pastikan ditolak karena berada di luar area kantor.
   - Coba nonaktifkan kampus mahasiswa di tab **Kelola Kampus** Admin. Lakukan absensi lagi, pastikan ditolak dengan alasan status kampus dinonaktifkan.
   - Uji juga anti-absen ganda dengan melakukan scan wajah berulang kali. Scan pertama mencatat **Masuk**, scan kedua mencatat **Pulang**, dan scan third ditolak karena absensi hari ini sudah lengkap.

---

## 🗄️ Pengaturan Database MySQL & Migrasi

Aplikasi ini mendukung dua pilihan driver database (**MySQL** & **SQLite**) yang dapat diatur via file `.env`.

### 1. Konfigurasi File `.env` (MySQL)
Buka atau buat file `.env` di root folder project, lalu sesuaikan kredensial MySQL Anda (misal XAMPP / CPanel / phpMyAdmin / Docker):
```env
DB_DRIVER=mysql
DB_HOST=localhost
DB_PORT=3306
DB_USER=root
DB_PASSWORD=
DB_NAME=kemenham_absensi
```
*Catatan*: Aplikasi akan **otomatis membuat database `kemenham_absensi` dan seluruh tabelnya** secara mandiri saat server pertama kali dijalankan dengan `npm run dev` atau `npm start`.

### 2. Impor Manual SQL (Opsional)
Jika Anda ingin membuat/mengimpor struktur tabel secara manual via phpMyAdmin atau MySQL CLI, file schema SQL tersedia di:
`database/schema_mysql.sql`

### 3. Migrasi Data dari SQLite ke MySQL
Jika Anda sudah memiliki data mahasiswa, kampus, atau absensi di SQLite lokal (`database/absensi.db`), Anda dapat memindahkan seluruh data tersebut ke MySQL secara otomatis dengan menjalankan:
```bash
node scripts/migrate-sqlite-to-mysql.js
```

