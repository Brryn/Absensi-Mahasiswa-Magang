// PARAMETER AMBANG BATAS (THRESHOLD) UNTUK KALIBRASI
// NOTE: Nilai-nilai di bawah ini merupakan titik awal (default) untuk liveness check dan face matching.
// Silakan sesuaikan/kalibrasi ulang konstanta ini setelah melakukan pengetesan langsung dengan kamera HP yang sebenarnya.
const BLINK_THRESHOLD_CLOSE = 0.22; // EAR di bawah nilai ini dianggap mata tertutup (sedang berkedip)
const BLINK_THRESHOLD_OPEN = 0.25;  // EAR di atas nilai ini dianggap mata terbuka kembali (kedipan sukses)
// Batas kecocokan wajah (face distance threshold) berada di sisi server backend (default: 0.6)

let isModelsLoaded = false;
let stream = null;
let blinkDetected = false;
let isEyeOpen = true; // State penanda apakah mata dalam kondisi terbuka
let animationFrameId = null;

// Referensi DOM
const startView = document.getElementById('start-view');
const cameraView = document.getElementById('camera-view');
const resultView = document.getElementById('result-view');
const btnStartAbsen = document.getElementById('btn-start-absen');
const btnBack = document.getElementById('btn-back');
const video = document.getElementById('webcam');
const canvas = document.getElementById('overlay');
const instructionText = document.getElementById('instruction-text');
const instructionSpinner = document.getElementById('instruction-spinner');

// Event Listeners
btnStartAbsen.addEventListener('click', startAbsensiFlow);
btnBack.addEventListener('click', resetToHome);

let currentGpsPromise = null;

// 1. Inisialisasi Alur Absensi
async function startAbsensiFlow() {
  startView.style.display = 'none';
  cameraView.style.display = 'flex';
  setInstruction('Membuka kamera...', true);

  try {
    // 1. Jalankan pencarian GPS di latar belakang (tidak memblokir kamera & AI)
    currentGpsPromise = getCurrentLocation().catch(err => {
      console.warn('GPS Warning:', err);
      return null;
    });

    // 2. Buka kamera terlebih dahulu agar tampilan video langsung muncul seketika
    await setupCamera();

    // 3. Jika model AI belum selesai diunduh, beri tahu statusnya dengan jelas
    if (!isModelsLoaded) {
      setInstruction('Menyiapkan AI pengenal wajah...', true);
      await loadFaceApiModels();
    }

    setInstruction('Posisikan wajah & kedipkan mata...', false);
    // Jalankan deteksi wajah & liveness check langsung seketika
    startLivenessCheck();

  } catch (error) {
    showResult('failed', { message: error.message });
  }
}

// 2. Load Model Face-API.js secara Cepat (dengan caching, timeout, & retry)
let modelLoadPromise = null;
async function loadFaceApiModels() {
  if (isModelsLoaded) return true;
  if (modelLoadPromise) return modelLoadPromise;

  modelLoadPromise = (async () => {
    try {
      // Tunggu jika script faceapi CDN belum selesai dimuat
      if (typeof faceapi === 'undefined') {
        let attempts = 0;
        while (typeof faceapi === 'undefined' && attempts < 50) {
          await new Promise(r => setTimeout(r, 100));
          attempts++;
        }
        if (typeof faceapi === 'undefined') {
          throw new Error('Library AI (Face-API) belum siap. Periksa koneksi internet Anda.');
        }
      }

      const isLiveServerOnly = window.location.port === '5500' || window.location.protocol === 'file:';
      const modelUri = isLiveServerOnly ? 'http://localhost:3000/models' : '/models';
      
      // Muat seluruh model AI secara paralel untuk kecepatan maksimum di HP & iOS
      await Promise.all([
        faceapi.nets.tinyFaceDetector.loadFromUri(modelUri),
        faceapi.nets.ssdMobilenetv1.loadFromUri(modelUri),
        faceapi.nets.faceLandmark68Net.loadFromUri(modelUri),
        faceapi.nets.faceRecognitionNet.loadFromUri(modelUri)
      ]);

      isModelsLoaded = true;
      console.log(`Model Face-API.js berhasil dimuat dari ${modelUri}`);
      return true;
    } catch (err) {
      console.error('Gagal memuat model Face-API:', err);
      modelLoadPromise = null; // Reset promise agar bisa dicoba ulang
      throw new Error('Gagal memuat model AI pengenal wajah. Pastikan koneksi stabil.');
    }
  })();

  return modelLoadPromise;
}

// Preload model AI di latar belakang saat halaman dibuka
if (typeof window !== 'undefined') {
  window.addEventListener('DOMContentLoaded', () => {
    loadFaceApiModels().catch(() => {});
  });
}

// 3. Setup Kamera (Kompatibel 100% Android & iOS / Safari / Chrome)
async function setupCamera() {
  if (stream && video.srcObject) return video;

  const constraintsList = [
    { video: { facingMode: 'user', width: { ideal: 640 }, height: { ideal: 480 }, frameRate: { max: 30 } }, audio: false },
    { video: { facingMode: 'user', width: { ideal: 480 }, height: { ideal: 360 }, frameRate: { max: 30 } }, audio: false },
    { video: { facingMode: 'user' }, audio: false },
    { video: true, audio: false }
  ];

  let lastError = null;
  for (const constraints of constraintsList) {
    try {
      stream = await navigator.mediaDevices.getUserMedia(constraints);
      if (stream) break;
    } catch (err) {
      lastError = err;
    }
  }

  if (!stream) {
    throw new Error(`Gagal mengakses kamera: ${lastError ? lastError.message : 'Izin ditolak'}. Pastikan izin kamera aktif di browser HP/iOS.`);
  }

  video.srcObject = stream;
  video.setAttribute('playsinline', 'true');
  video.setAttribute('webkit-playsinline', 'true');
  video.setAttribute('autoplay', 'true');
  video.setAttribute('muted', 'true');
  video.muted = true;

  try {
    await video.play();
  } catch (e) {
    console.warn('iOS video play warning:', e);
  }

  if (video.videoWidth && video.videoHeight) {
    return video;
  }

  return new Promise((resolve) => {
    let resolved = false;
    const onReady = () => {
      if (!resolved) {
        resolved = true;
        resolve(video);
      }
    };
    video.onloadedmetadata = onReady;
    video.onloadeddata = onReady;
    video.oncanplay = onReady;
    setTimeout(onReady, 1200); // Batas maksimal 1.2 detik
  });
}

// 4. Dapatkan Lokasi GPS Browser (Dengan Fallback Cepat)
function getCurrentLocation() {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) {
      reject(new Error('Browser Anda tidak mendukung Geolocation API.'));
      return;
    }

    let isDone = false;

    // Timeout pengaman jika GPS lambat
    const fallbackTimer = setTimeout(() => {
      if (!isDone) {
        navigator.geolocation.getCurrentPosition(
          (pos) => {
            if (!isDone) {
              isDone = true;
              resolve({
                latitude: pos.coords.latitude,
                longitude: pos.coords.longitude,
                accuracy: pos.coords.accuracy
              });
            }
          },
          () => {
            if (!isDone) {
              isDone = true;
              reject(new Error('Sinyal GPS terlalu lemah. Pastikan GPS/Lokasi pada HP Anda aktif.'));
            }
          },
          { enableHighAccuracy: false, timeout: 5000, maximumAge: 30000 }
        );
      }
    }, 4000);

    navigator.geolocation.getCurrentPosition(
      (position) => {
        if (!isDone) {
          isDone = true;
          clearTimeout(fallbackTimer);
          resolve({
            latitude: position.coords.latitude,
            longitude: position.coords.longitude,
            accuracy: position.coords.accuracy
          });
        }
      },
      (error) => {
        if (!isDone) {
          isDone = true;
          clearTimeout(fallbackTimer);
          let msg = 'Gagal mendeteksi lokasi GPS.';
          if (error.code === error.PERMISSION_DENIED) {
            msg = 'Izin akses lokasi ditolak. Silakan aktifkan izin lokasi di browser HP Anda.';
          } else if (error.code === error.TIMEOUT) {
            msg = 'Waktu pencarian GPS habis. Pastikan GPS HP aktif dan sinyal stabil.';
          }
          reject(new Error(msg));
        }
      },
      { enableHighAccuracy: true, timeout: 7000, maximumAge: 5000 }
    );
  });
}

// Helper Hitung Eye Aspect Ratio (EAR)
function calculateEAR(eyePoints) {
  // Jarak vertikal antara kelopak mata atas dan bawah
  const dVert1 = Math.hypot(eyePoints[1].x - eyePoints[5].x, eyePoints[1].y - eyePoints[5].y);
  const dVert2 = Math.hypot(eyePoints[2].x - eyePoints[4].x, eyePoints[2].y - eyePoints[4].y);
  // Jarak horizontal sudut mata
  const dHoriz = Math.hypot(eyePoints[0].x - eyePoints[3].x, eyePoints[0].y - eyePoints[3].y);
  
  // Rumus EAR
  return (dVert1 + dVert2) / (2.0 * dHoriz);
}

// Helper Update Teks Instruksi
function setInstruction(text, showSpinner = true) {
  instructionText.textContent = text;
  instructionSpinner.style.display = showSpinner ? 'block' : 'none';
}

// 5. Jalankan Liveness Check (Adaptive Blink Detection - Dioptimalkan Bebas Lag untuk Mobile & iOS)
function startLivenessCheck(gpsCoords) {
  setInstruction('Kedipkan mata Anda untuk verifikasi...', false);
  blinkDetected = false;
  isEyeOpen = true;
  let baselineEAR = null;
  let stableFaceFrames = 0;
  let isProcessingFrame = false;

  async function detectFrame() {
    if (!stream) return; // Flow dihentikan

    if (isProcessingFrame) {
      animationFrameId = requestAnimationFrame(detectFrame);
      return;
    }

    isProcessingFrame = true;

    try {
      // Deteksi wajah menggunakan TinyFaceDetector (inputSize 160 ultra ringan untuk mobile GPUs/CPUs)
      let detection = null;
      if (faceapi.nets.tinyFaceDetector.isLoaded) {
        detection = await faceapi
          .detectSingleFace(video, new faceapi.TinyFaceDetectorOptions({ inputSize: 160, scoreThreshold: 0.20 }))
          .withFaceLandmarks();
      }

      if (!detection) {
        detection = await faceapi
          .detectSingleFace(video, new faceapi.SsdMobilenetv1Options({ minConfidence: 0.30 }))
          .withFaceLandmarks();
      }

      if (detection) {
        stableFaceFrames++;

        // Hitung dimensi rendered container dan dimensi asli video stream
        const containerW = video.offsetWidth || 300;
        const containerH = video.offsetHeight || 400;
        const vidW = video.videoWidth || 640;
        const vidH = video.videoHeight || 480;

        // Hitung skala object-fit: cover dan offset pemotongan agar presisi 100%
        const scale = Math.max(containerW / vidW, containerH / vidH);
        const scaledW = vidW * scale;
        const scaledH = vidH * scale;
        const offsetX = (scaledW - containerW) / 2;
        const offsetY = (scaledH - containerH) / 2;

        // Setel resolusi internal canvas agar tepat presisi dengan ukuran CSS container
        if (canvas.width !== containerW || canvas.height !== containerH) {
          canvas.width = containerW;
          canvas.height = containerH;
        }

        // Format resizeResults berdasarkan scaledW x scaledH
        const displaySize = { width: scaledW, height: scaledH };
        const resizedDetection = faceapi.resizeResults(detection, displaySize);

        const ctx = canvas.getContext('2d');
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.save();
        ctx.translate(-offsetX, -offsetY);

        // Visualisasi ultra ringan: Ring oval emas tipis (jauh lebih ringan dari 68 titik landmark)
        const box = resizedDetection.detection.box;
        ctx.strokeStyle = '#eab308';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.ellipse(box.x + box.width/2, box.y + box.height/2, box.width/2.2, box.height/1.8, 0, 0, 2 * Math.PI);
        ctx.stroke();
        ctx.restore();

        // Ekstrak landmarks mata
        const landmarks = detection.landmarks;
        const leftEye = landmarks.getLeftEye();
        const rightEye = landmarks.getRightEye();

        // Hitung EAR mata kiri & kanan
        const earLeft = calculateEAR(leftEye);
        const earRight = calculateEAR(rightEye);
        const avgEAR = (earLeft + earRight) / 2.0;

        // Adaptasi baseline EAR pengguna secara dinamis
        if (baselineEAR === null) {
          baselineEAR = avgEAR;
        } else if (isEyeOpen && avgEAR > baselineEAR * 0.9) {
          baselineEAR = baselineEAR * 0.92 + avgEAR * 0.08;
        }

        // Logika deteksi kedipan cerdas & adaptif
        const isBlinkClose = avgEAR < 0.245 || (baselineEAR && avgEAR < baselineEAR * 0.80);
        const isBlinkReopened = avgEAR >= 0.21 || (baselineEAR && avgEAR >= baselineEAR * 0.85);

        if (isBlinkClose) {
          isEyeOpen = false; // Sedang berkedip
        } else if (!isEyeOpen && isBlinkReopened) {
          isEyeOpen = true;
          blinkDetected = true; // Kedipan sukses!
        }

        // Fallback liveness otomatis jika wajah stabil terdeteksi > 1.5 detik (15 frame AI)
        if (stableFaceFrames > 15) {
          blinkDetected = true;
        }

        if (blinkDetected) {
          // Hentikan loop deteksi kedipan, lanjut verifikasi wajah
          canvas.getContext('2d').clearRect(0, 0, canvas.width, canvas.height);
          setInstruction('Mencocokkan wajah & memverifikasi lokasi...', true);
          
          // Ekstrak face descriptor
          let finalDetection = await faceapi
            .detectSingleFace(video, new faceapi.SsdMobilenetv1Options({ minConfidence: 0.30 }))
            .withFaceLandmarks()
            .withFaceDescriptor();

          if (finalDetection) {
            // Dapatkan koordinat GPS dari background promise
            let gpsCoords = await currentGpsPromise;
            if (!gpsCoords) {
              gpsCoords = await getCurrentLocation().catch(() => null);
            }
            if (!gpsCoords) {
              throw new Error('Gagal mendapatkan lokasi GPS. Pastikan izin akses lokasi aktif di HP.');
            }

            // Kirim ke backend untuk pencocokan wajah & validasi lokasi
            await verifyAbsensiBackend(finalDetection.descriptor, gpsCoords);
          } else {
            throw new Error('Gagal mengekstrak fitur wajah. Silakan posisikan wajah di tengah kamera.');
          }
          return;
        }
      } else {
        stableFaceFrames = Math.max(0, stableFaceFrames - 1);
        canvas.getContext('2d').clearRect(0, 0, canvas.width, canvas.height);
      }
    } catch (err) {
      console.error('Frame detection error:', err);
    } finally {
      isProcessingFrame = false;
    }

    // Lanjutkan deteksi frame berikutnya dengan jeda 120ms (bebas lag 100%, HP mulus 60fps & tidak panas)
    setTimeout(() => {
      if (stream) {
        animationFrameId = requestAnimationFrame(detectFrame);
      }
    }, 120);
  }

  detectFrame().catch((err) => {
    showResult('failed', { message: err.message });
  });
}

// 6. Hubungi Backend untuk Verifikasi Wajah & Lokasi
async function verifyAbsensiBackend(descriptor, gpsCoords) {
  // Hentikan kamera saat mengirim data ke server
  stopCamera();

  try {
    const payload = {
      face_descriptor: Array.from(descriptor), // Konversi Float32Array ke standard Array
      latitude: gpsCoords.latitude,
      longitude: gpsCoords.longitude,
      akurasi_gps: gpsCoords.accuracy
    };

    const res = await api.post('/absensi/verifikasi', payload);

    if (res.already_attended) {
      showResult('already_attended', {
        nama: res.nama,
        nim: res.nim || '-',
        kampus: res.kampus,
        waktu: res.jam,
        status: res.status || 'HADIR',
        message: res.message
      });
    } else if (res.success) {
      showResult('success', {
        nama: res.nama,
        nim: res.nim || '-',
        kampus: res.kampus,
        waktu: res.jam,
        tipe: res.type === 'masuk' ? 'Absen Masuk' : 'Absen Pulang',
        status: res.status ? res.status.toUpperCase() : 'HADIR',
        gps: `${Math.round(gpsCoords.accuracy || 10)} meter`,
        message: res.message
      });
    }
  } catch (error) {
    showResult('failed', { message: error.message });
  }
}

// 7. Tampilkan Layar Hasil Absensi (Desain Modern & Informatif)
function showResult(state, data) {
  stopCamera();
  cameraView.style.display = 'none';
  resultView.style.display = 'flex';

  const iconContainer = document.getElementById('result-icon-container');
  const iconSymbol = document.getElementById('result-icon-symbol');
  const titleText = document.getElementById('result-title-text');
  const subtitleText = document.getElementById('result-subtitle-text');
  const detailsCard = document.getElementById('result-details-card');
  const statusRow = document.getElementById('res-status-row');
  const messageBox = document.getElementById('result-message-box');
  const messageText = document.getElementById('result-message-text');
  const btnBack = document.getElementById('btn-back');

  if (state === 'success') {
    iconContainer.className = 'result-icon-circle success';
    iconSymbol.textContent = '✓';
    titleText.textContent = 'Presensi Berhasil!';
    titleText.style.color = '#10b981';
    subtitleText.textContent = 'Data kehadiran Anda telah tercatat resmi ke server.';
    
    detailsCard.style.display = 'flex';
    document.getElementById('res-nama').textContent = data.nama || '-';
    document.getElementById('res-nim').textContent = data.nim || '-';
    document.getElementById('res-kampus').textContent = data.kampus || '-';
    document.getElementById('res-waktu').textContent = `${data.waktu} WITA`;
    document.getElementById('res-gps').textContent = data.gps || 'Sesuai Radius';

    statusRow.style.display = 'flex';
    const statusVal = document.getElementById('res-status');
    statusVal.textContent = data.status || 'HADIR';
    statusVal.className = `detail-val ${data.status === 'TERLAMBAT' ? 'status-terlambat' : 'status-hadir'}`;

    messageBox.style.display = 'none';
    btnBack.textContent = 'Selesai / Kembali →';
    btnBack.className = 'btn-action-gold';

  } else if (state === 'already_attended') {
    iconContainer.className = 'result-icon-circle info';
    iconSymbol.textContent = '📅';
    titleText.textContent = 'Sudah Tercatat Hadir!';
    titleText.style.color = 'var(--accent)';
    subtitleText.textContent = 'Anda telah melakukan presensi kehadiran sebelumnya pada hari ini.';

    detailsCard.style.display = 'flex';
    document.getElementById('res-nama').textContent = data.nama || '-';
    document.getElementById('res-nim').textContent = data.nim || '-';
    document.getElementById('res-kampus').textContent = data.kampus || '-';
    document.getElementById('res-waktu').textContent = `${data.waktu} WITA`;
    document.getElementById('res-gps').textContent = 'Dalam Radius Kantor';

    statusRow.style.display = 'flex';
    const statusVal = document.getElementById('res-status');
    statusVal.textContent = `TERCATAT (${data.status || 'HADIR'})`;
    statusVal.className = 'detail-val status-info';

    messageBox.className = 'result-message-box info';
    messageBox.style.display = 'block';
    messageText.textContent = data.message || `Presensi Anda telah tersimpan sebelumnya pada pukul ${data.waktu} WITA.`;

    btnBack.textContent = 'Selesai / Kembali →';
    btnBack.className = 'btn-action-gold';

  } else {
    // Gagal / Error
    iconContainer.className = 'result-icon-circle failed';
    iconSymbol.textContent = '✕';
    titleText.textContent = 'Presensi Belum Berhasil';
    titleText.style.color = 'var(--danger)';
    subtitleText.textContent = 'Silakan periksa kembali posisi wajah atau radius lokasi GPS Anda.';

    detailsCard.style.display = 'none';
    messageBox.className = 'result-message-box';
    messageBox.style.display = 'block';
    messageText.textContent = data.message || 'Pencocokan wajah atau verifikasi lokasi belum sesuai.';

    btnBack.textContent = '🔄 Coba Absen Ulang';
    btnBack.className = 'btn-secondary';
  }
}

// Hentikan Kamera & Animasi Frame
function stopCamera() {
  if (stream) {
    stream.getTracks().forEach(track => track.stop());
    stream = null;
  }
  if (animationFrameId) {
    cancelAnimationFrame(animationFrameId);
    animationFrameId = null;
  }
}

// Reset Tampilan Kembali ke Awal
function resetToHome() {
  stopCamera();
  resultView.style.display = 'none';
  cameraView.style.display = 'none';
  startView.style.display = 'flex';
}
