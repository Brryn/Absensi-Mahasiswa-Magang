-- ============================================================
-- SQL Schema Migration Script for E-Absensi Kementerian HAM
-- Target Database Engine: MySQL / MariaDB (v5.7+ / v8.0+)
-- ============================================================

CREATE DATABASE IF NOT EXISTS `kemenham_absensi` 
  DEFAULT CHARACTER SET utf8mb4 
  COLLATE utf8mb4_unicode_ci;

USE `kemenham_absensi`;

-- 1. Tabel Kampus
CREATE TABLE IF NOT EXISTS `kampus` (
  `id` INT NOT NULL AUTO_INCREMENT,
  `nama_kampus` VARCHAR(255) NOT NULL,
  `alamat` TEXT NULL,
  `status_aktif` TINYINT(1) DEFAULT 1,
  PRIMARY KEY (`id`),
  UNIQUE KEY `idx_nama_kampus` (`nama_kampus`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 2. Tabel Mahasiswa
CREATE TABLE IF NOT EXISTS `mahasiswa` (
  `id` INT NOT NULL AUTO_INCREMENT,
  `nama` VARCHAR(255) NOT NULL,
  `nim` VARCHAR(100) NULL,
  `kampus_id` INT NULL,
  `no_hp` VARCHAR(50) NULL,
  `pembimbing` VARCHAR(255) NULL,
  `tgl_mulai` DATE NULL,
  `tgl_selesai` DATE NULL,
  `face_descriptor` LONGTEXT NULL,
  `angkatan` VARCHAR(50) NULL,
  `jenis_program` VARCHAR(100) DEFAULT 'Magang',
  `status_aktif` TINYINT(1) DEFAULT 1,
  PRIMARY KEY (`id`),
  UNIQUE KEY `idx_nim` (`nim`),
  CONSTRAINT `fk_mahasiswa_kampus` 
    FOREIGN KEY (`kampus_id`) REFERENCES `kampus` (`id`) 
    ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 3. Tabel Absensi
CREATE TABLE IF NOT EXISTS `absensi` (
  `id` INT NOT NULL AUTO_INCREMENT,
  `mahasiswa_id` INT NOT NULL,
  `tanggal` DATE NOT NULL,
  `jam_masuk` DATETIME NULL,
  `jam_pulang` DATETIME NULL,
  `latitude` DOUBLE NULL,
  `longitude` DOUBLE NULL,
  `akurasi_gps` DOUBLE NULL,
  `status` ENUM('hadir','izin','sakit','alpha','terlambat') NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `unique_mhs_tgl` (`mahasiswa_id`, `tanggal`),
  CONSTRAINT `fk_absensi_mahasiswa` 
    FOREIGN KEY (`mahasiswa_id`) REFERENCES `mahasiswa` (`id`) 
    ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 4. Tabel Admin
CREATE TABLE IF NOT EXISTS `admin` (
  `id` INT NOT NULL AUTO_INCREMENT,
  `username` VARCHAR(100) NOT NULL,
  `password_hash` VARCHAR(255) NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `idx_username` (`username`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 5. Tabel Pengaturan
CREATE TABLE IF NOT EXISTS `pengaturan` (
  `id` INT NOT NULL AUTO_INCREMENT,
  `latitude_kantor` DOUBLE NULL,
  `longitude_kantor` DOUBLE NULL,
  `radius_meter` INT DEFAULT 100,
  `threshold_wajah` DOUBLE DEFAULT 0.45,
  `notifikasi_email` TINYINT(1) DEFAULT 1,
  `notifikasi_wa` TINYINT(1) DEFAULT 0,
  `jam_masuk` VARCHAR(10) DEFAULT '07:30',
  `jam_terlambat` VARCHAR(10) DEFAULT '08:00',
  `jam_pulang` VARCHAR(10) DEFAULT '16:00',
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 6. Tabel Log Aktivitas
CREATE TABLE IF NOT EXISTS `log_aktivitas` (
  `id` INT NOT NULL AUTO_INCREMENT,
  `tanggal` VARCHAR(100) NULL,
  `aktivitas` TEXT NULL,
  `admin_username` VARCHAR(100) NULL,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Seed Data Admin Default (Username: admin, Password: admin123) jika belum ada admin
INSERT IGNORE INTO `admin` (`id`, `username`, `password_hash`) 
VALUES (1, 'admin', '$2a$10$wO9zC0S0fD.XQYm6pP/Hxe/Hk7fB7G.3.2b8N0gU4bN/2E6p6eXqS');

-- Seed Data Pengaturan Default (Kantor Wilker Kendari Sultra)
INSERT IGNORE INTO `pengaturan` (`id`, `latitude_kantor`, `longitude_kantor`, `radius_meter`, `threshold_wajah`, `jam_masuk`, `jam_terlambat`, `jam_pulang`) 
VALUES (1, -3.9778, 122.5150, 100, 0.45, '07:30', '08:00', '16:00');
