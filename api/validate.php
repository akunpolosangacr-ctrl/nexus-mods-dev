<?php
require_once __DIR__ . '/../config.php';

header("Access-Control-Allow-Origin: *");
header("Access-Control-Allow-Methods: POST, OPTIONS");
header("Access-Control-Allow-Headers: Content-Type");

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit();
}

// 1. Proteksi Browser (Method GET Ditolak)
if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    http_response_code(403);
    header('Content-Type: text/html; charset=utf-8');
    echo '<!DOCTYPE html>
<html lang="id">
<head>
    <meta charset="UTF-8">
    <title>Access Protected</title>
    <style>
        body { background: #0f172a; color: #ef4444; font-family: system-ui, sans-serif; display: flex; align-items: center; justify-content: center; height: 100vh; margin: 0; text-align: center; }
        .box { background: #1e293b; padding: 35px; border-radius: 12px; border: 1px solid #334155; box-shadow: 0 10px 25px -5px rgba(0,0,0,0.5); }
        h2 { font-size: 20px; margin-bottom: 10px; }
        p { color: #94a3b8; font-size: 14px; margin: 0; }
    </style>
</head>
<body>
    <div class="box">
        <h2>🔒 ACCESS PROTECTED</h2>
        <p>Akses langsung via Browser ditolak. Endpoint ini hanya menerima HTTP POST dari Game Guardian Script.</p>
    </div>
</body>
</html>';
    exit();
}

// 2. Baca Input POST (JSON / Form Data)
$rawInput = file_get_contents('php://input');
$data = json_decode($rawInput, true);
if (!$data) {
    $data = $_POST;
}

$keyCode = isset($data['key']) ? trim($data['key']) : '';

if (empty($keyCode)) {
    http_response_code(400);
    echo "gg.alert('❌ Key wajib diisi!') os.exit()";
    exit();
}

// 3. Cek Database
try {
    $pdo = getDB();
    $stmt = $pdo->prepare("SELECT * FROM license_keys WHERE key_code = :key_code LIMIT 1");
    $stmt->execute([':key_code' => $keyCode]);
    $row = $stmt->fetch();

    if (!$row) {
        http_response_code(404);
        echo "gg.alert('❌ Key INVALID atau Tidak Terdaftar di Database!') os.exit()";
        exit();
    }

    if ($row['status'] !== 'active') {
        http_response_code(403);
        echo "gg.alert('⛔ Key ini dalam status NONAKTIF/DISABLED!') os.exit()";
        exit();
    }

    $now = new DateTime();
    $expiresAt = new DateTime($row['expires_at']);

    if ($now > $expiresAt) {
        http_response_code(403);
        echo "gg.alert('⛔ Key ini telah EXPIRED pada (" . $expiresAt->format('d-m-Y H:i') . ")!') os.exit()";
        exit();
    }

    // Key Valid: Kirimkan kode Lua
    http_response_code(200);
    header('Content-Type: text/plain; charset=utf-8');
    echo $row['lua_code'];
    exit();

} catch (Exception $e) {
    http_response_code(500);
    echo "gg.alert('❌ Database Error!') os.exit()";
    exit();
}
