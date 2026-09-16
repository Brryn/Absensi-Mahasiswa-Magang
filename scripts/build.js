/**
 * Build & Obfuscation Script untuk E-Absensi Kementerian HAM
 * Mengompilasi dan mengenkripsi seluruh kode Frontend ke dalam folder dist/
 * Format output: HTML, CSS, dan JS terenkripsi/terbundel (mirip Vue/Vite build).
 */

const fs = require('fs');
const path = require('path');
const CleanCSS = require('clean-css');
const Terser = require('terser');
const JavaScriptObfuscator = require('javascript-obfuscator');
const htmlMinifier = require('html-minifier-terser');

const rootDir = path.join(__dirname, '..');
const srcDir = path.join(rootDir, 'frontend');
const distDir = path.join(rootDir, 'dist');

console.log('====================================================');
console.log('  🚀 MEMULAI BUILD & ENKRIPSI KODE (PRODUCTION)     ');
console.log('====================================================\n');

// 1. Bersihkan dan siapkan direktori dist/
if (fs.existsSync(distDir)) {
  fs.rmSync(distDir, { recursive: true, force: true });
}

fs.mkdirSync(distDir, { recursive: true });
fs.mkdirSync(path.join(distDir, 'admin'), { recursive: true });
fs.mkdirSync(path.join(distDir, 'css'), { recursive: true });
fs.mkdirSync(path.join(distDir, 'js'), { recursive: true });
fs.mkdirSync(path.join(distDir, 'img'), { recursive: true });
fs.mkdirSync(path.join(distDir, 'models'), { recursive: true });

// Helper: Obfuscate & Minify JS
async function processJS(rawCode, filename) {
  console.log(`  ⚙️  Mengenkripsi & Membundel JS: ${filename}...`);
  try {
    // 1. Minify dengan Terser terlebih dahulu
    const minified = await Terser.minify(rawCode, {
      compress: { drop_console: false, passes: 2 },
      mangle: true
    });

    const codeToObfuscate = minified.code || rawCode;

    // 2. Enkripsi dengan JavaScript Obfuscator
    const obfuscated = JavaScriptObfuscator.obfuscate(codeToObfuscate, {
      compact: true,
      controlFlowFlattening: false, // Jaga performa AI tetap kencang
      deadCodeInjection: false,
      debugProtection: false,
      disableConsoleOutput: false,
      identifierNamesGenerator: 'hexadecimal',
      numbersToExpressions: false,
      renameGlobals: false,
      selfDefending: false,
      simplify: true,
      splitStrings: false,
      stringArray: true,
      stringArrayEncoding: ['base64'],
      stringArrayThreshold: 0.75,
      transformObjectKeys: true,
      unicodeEscapeSequence: false
    });

    return obfuscated.getObfuscatedCode();
  } catch (err) {
    console.warn(`    ⚠️ Gagal mengenkripsi ${filename} secara penuh, menggunakan minifikasi standar:`, err.message);
    const fallback = await Terser.minify(rawCode);
    return fallback.code;
  }
}

// Helper: Minify CSS
function processCSS(rawCSS, filename) {
  console.log(`  🎨 Membundel & Minifikasi CSS: ${filename}...`);
  const output = new CleanCSS({ level: 2 }).minify(rawCSS);
  return output.styles;
}

// Helper: Minify HTML
async function processHTML(rawHTML, filename) {
  console.log(`  📄 Minifikasi HTML: ${filename}...`);
  return await htmlMinifier.minify(rawHTML, {
    collapseWhitespace: true,
    removeComments: true,
    removeRedundantAttributes: true,
    useShortDoctype: true,
    minifyJS: true,
    minifyCSS: true
  });
}

// Helper Copy Recursive
function copyDir(src, dest) {
  if (!fs.existsSync(src)) return;
  fs.mkdirSync(dest, { recursive: true });
  const entries = fs.readdirSync(src, { withFileTypes: true });

  for (const entry of entries) {
    const srcPath = path.join(src, entry.name);
    const destPath = path.join(dest, entry.name);

    if (entry.isDirectory()) {
      copyDir(srcPath, destPath);
    } else {
      fs.copyFileSync(srcPath, destPath);
    }
  }
}

async function runBuild() {
  const startTime = Date.now();

  try {
    // ==================== 1. PROSES CSS ====================
    console.log('[1/5] Memproses File CSS...');
    const mhsCssRaw = fs.readFileSync(path.join(srcDir, 'css', 'mahasiswa.css'), 'utf8');
    const adminCssRaw = fs.readFileSync(path.join(srcDir, 'css', 'admin.css'), 'utf8');

    const mhsCssMin = processCSS(mhsCssRaw, 'mahasiswa.min.css');
    const adminCssMin = processCSS(adminCssRaw, 'admin.min.css');

    fs.writeFileSync(path.join(distDir, 'css', 'mahasiswa.min.css'), mhsCssMin);
    fs.writeFileSync(path.join(distDir, 'css', 'admin.min.css'), adminCssMin);

    // ==================== 2. PROSES JS ====================
    console.log('\n[2/5] Memproses & Mengenkripsi File JS...');
    const apiJsRaw = fs.readFileSync(path.join(srcDir, 'js', 'api.js'), 'utf8');
    const livenessJsRaw = fs.readFileSync(path.join(srcDir, 'js', 'face-liveness.js'), 'utf8');
    const adminJsRaw = fs.readFileSync(path.join(srcDir, 'js', 'admin.js'), 'utf8');

    // Standalone API client (untuk Login & Modular)
    const apiJsMin = await processJS(apiJsRaw, 'api.js');
    fs.writeFileSync(path.join(distDir, 'js', 'api.js'), apiJsMin);

    // Bundel 1: Mahasiswa (api.js + face-liveness.js)
    const bundleMhsRaw = `${apiJsRaw}\n;\n${livenessJsRaw}`;
    const bundleMhsMin = await processJS(bundleMhsRaw, 'bundle-mahasiswa.min.js');
    fs.writeFileSync(path.join(distDir, 'js', 'bundle-mahasiswa.min.js'), bundleMhsMin);

    // Bundel 2: Admin (api.js + admin.js)
    const bundleAdminRaw = `${apiJsRaw}\n;\n${adminJsRaw}`;
    const bundleAdminMin = await processJS(bundleAdminRaw, 'bundle-admin.min.js');
    fs.writeFileSync(path.join(distDir, 'js', 'bundle-admin.min.js'), bundleAdminMin);

    // Copy library lokal pihak ketiga (exceljs & face-api)
    if (fs.existsSync(path.join(srcDir, 'js', 'exceljs.min.js'))) {
      fs.copyFileSync(
        path.join(srcDir, 'js', 'exceljs.min.js'),
        path.join(distDir, 'js', 'exceljs.min.js')
      );
    }
    if (fs.existsSync(path.join(srcDir, 'js', 'face-api.js'))) {
      fs.copyFileSync(
        path.join(srcDir, 'js', 'face-api.js'),
        path.join(distDir, 'js', 'face-api.js')
      );
    }

    // ==================== 3. SALIN ASSETS STATIS ====================
    console.log('\n[3/5] Menyalin Gambar & Model AI...');
    copyDir(path.join(srcDir, 'img'), path.join(distDir, 'img'));
    copyDir(path.join(srcDir, 'models'), path.join(distDir, 'models'));

    // ==================== 4. PROSES HTML ====================
    console.log('\n[4/5] Memperbarui & Menyatukan HTML...');

    // 4a. Mahasiswa index.html
    let mhsHtml = fs.readFileSync(path.join(srcDir, 'index.html'), 'utf8');
    mhsHtml = mhsHtml.replace('css/mahasiswa.css', 'css/mahasiswa.min.css');
    // Ganti 2 script terpisah menjadi 1 bundle terenkripsi
    mhsHtml = mhsHtml.replace(
      /<script defer src="js\/api\.js"><\/script>\s*<script defer src="js\/face-liveness\.js"><\/script>/,
      '<script defer src="js/bundle-mahasiswa.min.js"></script>'
    );
    const mhsHtmlMin = await processHTML(mhsHtml, 'index.html');
    fs.writeFileSync(path.join(distDir, 'index.html'), mhsHtmlMin);

    // 4b. Admin index.html
    let adminHtml = fs.readFileSync(path.join(srcDir, 'admin', 'index.html'), 'utf8');
    adminHtml = adminHtml.replace('../css/admin.css', '../css/admin.min.css');
    // Ganti script api.js & admin.js menjadi 1 bundle
    adminHtml = adminHtml.replace(
      /<script defer src="\.\.\/js\/api\.js"><\/script>\s*<script defer src="\.\.\/js\/admin\.js"><\/script>/,
      '<script defer src="../js/bundle-admin.min.js"></script>'
    );
    const adminHtmlMin = await processHTML(adminHtml, 'admin/index.html');
    fs.writeFileSync(path.join(distDir, 'admin', 'index.html'), adminHtmlMin);

    // 4c. Admin login.html
    if (fs.existsSync(path.join(srcDir, 'admin', 'login.html'))) {
      let loginHtml = fs.readFileSync(path.join(srcDir, 'admin', 'login.html'), 'utf8');
      loginHtml = loginHtml.replace('../css/admin.css', '../css/admin.min.css');
      const loginHtmlMin = await processHTML(loginHtml, 'admin/login.html');
      fs.writeFileSync(path.join(distDir, 'admin', 'login.html'), loginHtmlMin);
    }

    // ==================== 5. SELESAI ====================
    const elapsed = ((Date.now() - startTime) / 1000).toFixed(2);
    console.log('\n====================================================');
    console.log(`  ✅ BUILD SELESAI DENGAN SUKSES (${elapsed} detik)!`);
    console.log('  📁 Output tersimpan di folder: dist/');
    console.log('  🔒 Seluruh kode JS & CSS telah terenkripsi & dibundel!');
    console.log('====================================================\n');

  } catch (error) {
    console.error('\n❌ Terjadi kesalahan saat build:', error);
    process.exit(1);
  }
}

runBuild();
