<?php
require_once __DIR__ . '/../config.php';

header('Content-Type: application/json');

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    echo json_encode(['success' => false, 'message' => 'Method not allowed']);
    exit();
}

$rawInput = file_get_contents('php://input');
$data = json_decode($rawInput, true) ?? $_POST;

$action = $data['action'] ?? '';
$pdo = getDB();

try {
    if ($action === 'list') {
        $stmt = $pdo->query("SELECT id, key_code, script_name, expires_at, status, created_at FROM license_keys ORDER BY id DESC");
        $keys = $stmt->fetchAll();
        echo json_encode(['success' => true, 'keys' => $keys, 'baseUrl' => BASE_URL]);
        exit();
    }

    if ($action === 'create') {
        $scriptName = !empty($data['scriptName']) ? trim($data['scriptName']) : 'Untitled Script';
        $customKey  = !empty($data['customKey']) ? trim($data['customKey']) : '';
        $expireDays = isset($data['expireDays']) ? (int)$data['expireDays'] : 30;
        $luaCode    = !empty($data['luaCode']) ? $data['luaCode'] : 'gg.toast("Hello World")';

        if (empty($customKey)) {
            $keyCode = 'NEXUS-' . strtoupper(substr(bin2hex(random_bytes(4)), 0, 8));
        } else {
            $keyCode = $customKey;
        }

        $expiresAt = date('Y-m-d H:i:s', strtotime("+{$expireDays} days"));

        $stmt = $pdo->prepare("INSERT INTO license_keys (key_code, script_name, lua_code, expires_at, status) VALUES (:key_code, :script_name, :lua_code, :expires_at, 'active')");
        $stmt->execute([
            ':key_code' => $keyCode,
            ':script_name' => $scriptName,
            ':lua_code' => $luaCode,
            ':expires_at' => $expiresAt
        ]);

        echo json_encode(['success' => true, 'key' => $keyCode]);
        exit();
    }

    if ($action === 'toggle_status') {
        $keyId = $data['id'] ?? null;
        if (!$keyId) {
            echo json_encode(['success' => false, 'message' => 'ID Key tidak valid']);
            exit();
        }

        $stmt = $pdo->prepare("UPDATE license_keys SET status = IF(status='active', 'disabled', 'active') WHERE id = :id");
        $stmt->execute([':id' => $keyId]);

        echo json_encode(['success' => true]);
        exit();
    }

    if ($action === 'delete') {
        $keyId = $data['id'] ?? null;
        if (!$keyId) {
            echo json_encode(['success' => false, 'message' => 'ID Key tidak valid']);
            exit();
        }

        $stmt = $pdo->prepare("DELETE FROM license_keys WHERE id = :id");
        $stmt->execute([':id' => $keyId]);

        echo json_encode(['success' => true]);
        exit();
    }

    echo json_encode(['success' => false, 'message' => 'Action tidak valid']);
} catch (Exception $e) {
    echo json_encode(['success' => false, 'message' => $e->getMessage()]);
}
