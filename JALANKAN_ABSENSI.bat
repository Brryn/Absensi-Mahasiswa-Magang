@echo off
title E-Absensi Mahasiswa Magang Kementerian HAM RI
color 0B

echo ===================================================================
echo   MEMULAI SERVER E-ABSENSI KEMENTERIAN HAM RI
echo ===================================================================
echo.
echo Sedang menyiapkan server...

:: Buka browser secara otomatis ke alamat aplikasi
start "" "http://localhost:3000"

:: Jalankan backend server Node.js
node backend/server.js

pause
