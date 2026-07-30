<?php
// ===================================================
// KONFIGURASI DATABASE & HOSTING NEXUS MODS DEV
// Ubah variabel di bawah sesuai server / hosting Anda
// ===================================================

define('DB_HOST', 'localhost');
define('DB_USER', 'root');
define('DB_PASS', '');
define('DB_NAME', 'nexus_mods');

// Dynamic Base URL detection (Bisa diisi manual misal: 'https://domain-anda.com')
$protocol = (!empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off') ? "https://" : "http://";
$host = $_SERVER['HTTP_HOST'] ?? 'localhost';
define('BASE_URL', $protocol . $host);

function getDB() {
    static $pdo = null;
    if ($pdo === null) {
        try {
            $dsn = "mysql:host=" . DB_HOST . ";dbname=" . DB_NAME . ";charset=utf8mb4";
            $pdo = new PDO($dsn, DB_USER, DB_PASS, [
                PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
                PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC
            ]);
        } catch (PDOException $e) {
            header('HTTP/1.1 500 Internal Server Error');
            echo "Database Error: " . $e->getMessage();
            exit();
        }
    }
    return $pdo;
}
