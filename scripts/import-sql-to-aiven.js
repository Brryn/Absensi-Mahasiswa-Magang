require('dotenv').config();
const fs = require('fs');
const path = require('path');
const mysql = require('mysql2/promise');

async function importSql() {
  console.log('====================================================');
  console.log('  🚀 IMPORT DATABASE KE AIVEN CLOUD MYSQL           ');
  console.log('====================================================\n');

  const dbDir = path.join(__dirname, '..', 'database');
  const files = fs.readdirSync(dbDir).filter(f => f.endsWith('.sql'));

  if (files.length === 0) {
    console.error('❌ Tidak ditemukan file .sql di folder database/!');
    process.exit(1);
  }

  // Pilih file .sql (utamakan kemenham_absensi.sql jika baru saja di-export)
  let sqlFile = files.find(f => f.toLowerCase().includes('kemenham')) || files[0];
  const sqlPath = path.join(dbDir, sqlFile);
  console.log(`📄 Membaca file SQL: database/${sqlFile}`);

  const sqlContent = fs.readFileSync(sqlPath, 'utf8');

  const dbHost = process.env.DB_HOST;
  const dbPort = parseInt(process.env.DB_PORT || '3306', 10);
  const dbUser = process.env.DB_USER;
  const dbPassword = process.env.DB_PASSWORD;
  const dbName = process.env.DB_NAME || 'defaultdb';

  if (!dbHost || !dbUser) {
    console.error('❌ DB_HOST / DB_USER di file .env belum diisi dengan kredensial Aiven!');
    process.exit(1);
  }

  console.log(`🔌 Menyambung ke Aiven Cloud MySQL (${dbHost}:${dbPort})...`);

  try {
    const conn = await mysql.createConnection({
      host: dbHost,
      port: dbPort,
      user: dbUser,
      password: dbPassword,
      database: dbName,
      multipleStatements: true,
      ssl: { rejectUnauthorized: false }
    });

    console.log(`✅ Terhubung ke database '${dbName}'. Mengunggah seluruh tabel & data...`);

    // Hapus sintaks CREATE DATABASE & USE agar mengimpor ke defaultdb Aiven
    let cleanSql = sqlContent
      .replace(/CREATE DATABASE[\s\S]*?;/gi, '')
      .replace(/USE `.*?`;/gi, '');

    await conn.query(cleanSql);
    await conn.end();

    console.log('\n====================================================');
    console.log('  ✅ SELURUH DATA LAMA BERHASIL DI-IMPORT KE AIVEN! ');
    console.log('====================================================\n');

  } catch (err) {
    console.error('❌ Terjadi kesalahan saat mengimpor:', err.message);
  }
}

importSql();
