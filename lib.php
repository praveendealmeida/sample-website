<?php
require_once __DIR__ . '/config.php';

function json_response($data, $code = 200) {
    http_response_code($code);
    echo json_encode($data);
    exit;
}

function settings() {
    static $s = null;
    if ($s === null) {
        $conn = getDBConnection();
        $res = $conn->query("SELECT setting_key, setting_value FROM settings");
        $s = [];
        while ($r = $res->fetch_assoc()) $s[$r['setting_key']] = $r['setting_value'];
        closeDBConnection($conn);
    }
    return $s;
}
function setting($k, $d = null) { $s = settings(); return array_key_exists($k, $s) ? $s[$k] : $d; }

function csrf_token() { if (empty($_SESSION['csrf'])) $_SESSION['csrf'] = bin2hex(random_bytes(16)); return $_SESSION['csrf']; }
function csrf_verify($t) { return isset($_SESSION['csrf']) && is_string($t) && hash_equals($_SESSION['csrf'], $t); }

function is_logged_in() { return !empty($_SESSION['user_logged_in']) && !empty($_SESSION['user_id']); }
function current_uid() { return $_SESSION['user_id'] ?? null; }
function require_login() { if (!is_logged_in()) json_response(['success' => false, 'error' => 'Please log in'], 401); }
function is_admin() { return !empty($_SESSION['admin_logged_in']); }
function require_admin() { if (!is_admin()) json_response(['success' => false, 'error' => 'Unauthorized'], 401); }

function esc($v) { return htmlspecialchars((string)$v, ENT_QUOTES, 'UTF-8'); }

function generate_referral_code($conn) {
    do {
        $code = strtoupper(substr(bin2hex(random_bytes(5)), 0, 8));
        $stmt = $conn->prepare("SELECT id FROM users WHERE referral_code = ?");
        $stmt->bind_param('s', $code);
        $stmt->execute();
        $stmt->store_result();
        $exists = $stmt->num_rows > 0;
        $stmt->close();
    } while ($exists);
    return $code;
}

function get_balance($conn, $uid) {
    $stmt = $conn->prepare("SELECT balance FROM users WHERE id = ?");
    $stmt->bind_param('i', $uid);
    $stmt->execute();
    $r = $stmt->get_result()->fetch_assoc();
    return floatval($r['balance']);
}

function record_transaction($conn, $uid, $type, $amount, $desc, $refId = null, $status = 'completed') {
    $bal = get_balance($conn, $uid);
    $ref = $refId === null ? 0 : intval($refId);
    $stmt = $conn->prepare("INSERT INTO transactions (user_id, type, amount, balance_after, ref_id, description, status) VALUES (?,?,?,?,?,?,?)");
    $stmt->bind_param('isddiss', $uid, $type, $amount, $bal, $ref, $desc, $status);
    $stmt->execute();
    return $stmt->insert_id;
}

function credit($conn, $uid, $amount, $type, $desc, $refId = null) {
    $stmt = $conn->prepare("UPDATE users SET balance = balance + ? WHERE id = ?");
    $stmt->bind_param('di', $amount, $uid);
    $stmt->execute();
    return record_transaction($conn, $uid, $type, $amount, $desc, $refId);
}

function debit($conn, $uid, $amount, $type, $desc, $refId = null) {
    if (get_balance($conn, $uid) < $amount) return false;
    $stmt = $conn->prepare("UPDATE users SET balance = balance - ? WHERE id = ?");
    $stmt->bind_param('di', $amount, $uid);
    $stmt->execute();
    record_transaction($conn, $uid, $type, -$amount, $desc, $refId);
    return true;
}

function notify($conn, $uid, $title, $message) {
    $stmt = $conn->prepare("INSERT INTO notifications (user_id, title, message) VALUES (?,?,?)");
    $stmt->bind_param('iss', $uid, $title, $message);
    $stmt->execute();
}

function create_token($conn, $uid, $type, $hours = 24) {
    $token = bin2hex(random_bytes(32));
    $expires = date('Y-m-d H:i:s', time() + $hours * 3600);
    $stmt = $conn->prepare("INSERT INTO email_tokens (user_id, token, type, expires_at) VALUES (?,?,?,?)");
    $stmt->bind_param('isss', $uid, $token, $type, $expires);
    $stmt->execute();
    return $token;
}

function send_mail($to, $subject, $body) {
    $host = setting('smtp_host');
    $log = 'To: ' . $to . ' | Subject: ' . $subject . "\n" . $body . "\n----------------------------------------\n";
    @file_put_contents(__DIR__ . '/email.log', '[' . date('Y-m-d H:i:s') . "]\n" . $log, FILE_APPEND);
    return true;
}

function credit_referrals($conn, $uid, $investAmount) {
    if (!setting('referral_enabled')) return;
    $levels = [(float)setting('referral_level1', 0), (float)setting('referral_level2', 0), (float)setting('referral_level3', 0)];
    $cur = $uid;
    $level = 0;
    while ($level < 3) {
        $stmt = $conn->prepare("SELECT referred_by FROM users WHERE id = ?");
        $stmt->bind_param('i', $cur);
        $stmt->execute();
        $r = $stmt->get_result();
        if (!$r->num_rows) break;
        $row = $r->fetch_assoc();
        $refId = intval($row['referred_by']);
        if (!$refId) break;
        $pct = $levels[$level];
        $level++;
        if ($pct > 0) {
            $commission = round($investAmount * ($pct / 100), 8);
            credit($conn, $refId, $commission, 'referral', 'Referral commission (level ' . $level . ')', $cur);
            $stmt2 = $conn->prepare("INSERT INTO referral_commissions (user_id, from_user_id, level, amount, source) VALUES (?,?,?,?, 'investment')");
            $stmt2->bind_param('iiid', $refId, $cur, $level, $commission);
            $stmt2->execute();
        }
        $cur = $refId;
    }
}