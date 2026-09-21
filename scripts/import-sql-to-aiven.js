require('dotenv').config();
const fs = require('fs');
const path = require('path');
const mysql = require('mysql2/promise');

const arg = process.argv[2];
const connectionString = arg || process.env.DATABASE_URL || process.env.MYSQL_URL || process.env.MYSQLURL;

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

  let sqlFile = files.find(f => f.toLowerCase().includes('kemenham')) || files[0];
  const sqlPath = path.join(dbDir, sqlFile);
  console.log(`📄 Membaca file SQL: database/${sqlFile}`);

  const sqlContent = fs.readFileSync(sqlPath, 'utf8');

  let connConfig = {};

  if (connectionString) {
    console.log('🔌 Menggunakan Connection String / Service URI...');
    connConfig = {
      uri: connectionString,
      multipleStatements: true,
      ssl: { rejectUnauthorized: false }
    };
  } else {
    const dbHost = process.env.DB_HOST;
    const dbPort = parseInt(process.env.DB_PORT || '3306', 10);
    const dbUser = process.env.DB_USER;
    const dbPassword = process.env.DB_PASSWORD;
    const dbName = process.env.DB_NAME || 'defaultdb';

    if (!dbHost || !dbUser) {
      console.error('❌ Harap berikan Service URI Aiven atau isi file .env!');
      console.log('👉 Contoh perintah: node scripts/import-sql-to-aiven.js "mysql://avnadmin:password@host:port/defaultdb"');
      process.exit(1);
    }

    connConfig = {
      host: dbHost,
      port: dbPort,
      user: dbUser,
      password: dbPassword,
      database: dbName,
      multipleStatements: true,
      ssl: { rejectUnauthorized: false }
    };
  }

  try {
    const conn = await mysql.createConnection(connConfig);

    console.log(`✅ Terhubung ke Aiven Cloud MySQL. Mengunggah seluruh tabel & data...`);

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
