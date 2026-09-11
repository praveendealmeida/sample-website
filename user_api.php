<?php
header('Content-Type: application/json');
require_once __DIR__ . '/lib.php';
require_once __DIR__ . '/deposit_service.php';
require_login();

$conn = getDBConnection();
$uid = current_uid();
$isPost = $_SERVER['REQUEST_METHOD'] === 'POST';
$data = $isPost ? json_decode(file_get_contents('php://input'), true) : [];
$action = $isPost ? ($data['action'] ?? '') : ($_GET['action'] ?? '');

if ($isPost && !csrf_verify($data['csrf'] ?? '')) {
    json_response(['success' => false, 'error' => 'Invalid CSRF token'], 403);
}

switch ($action) {
    case 'profile':
        $stmt = $conn->prepare("SELECT id, username, email, email_verified, wallet_address, kyc_status, status, referral_code, balance, created_at FROM users WHERE id = ?");
        $stmt->bind_param('i', $uid); $stmt->execute();
        json_response(['success' => true, 'profile' => $stmt->get_result()->fetch_assoc()]);
        break;

    case 'summary':
        $stmt = $conn->prepare("SELECT balance, username, email_verified, kyc_status, referral_code FROM users WHERE id = ?");
        $stmt->bind_param('i', $uid); $stmt->execute();
        $u = $stmt->get_result()->fetch_assoc();
        $agg = $conn->query("SELECT COUNT(*) AS active_count, COALESCE(SUM(CASE WHEN status='active' THEN amount ELSE 0 END),0) AS total_invested, COALESCE(SUM(total_profit_accrued),0) AS total_profit FROM investments WHERE user_id = $uid")->fetch_assoc();
        $refs = $conn->query("SELECT COUNT(*) AS total_refs, COALESCE(SUM(amount),0) AS total_earned FROM referral_commissions WHERE user_id = $uid")->fetch_assoc();
        json_response(['success' => true, 'balance' => floatval($u['balance']), 'username' => $u['username'], 'email_verified' => (int)$u['email_verified'], 'kyc_status' => $u['kyc_status'], 'referral_code' => $u['referral_code'], 'active_count' => intval($agg['active_count']), 'total_invested' => floatval($agg['total_invested']), 'total_profit' => floatval($agg['total_profit']), 'referral_count' => intval($refs['total_refs']), 'referral_earned' => floatval($refs['total_earned'])]);
        break;

    case 'plans':
        $r = $conn->query("SELECT * FROM plans WHERE status = 'active' ORDER BY featured DESC, id ASC");
        $plans = []; while ($p = $r->fetch_assoc()) $plans[] = $p;
        json_response(['success' => true, 'plans' => $plans]);
        break;

    case 'invest':
        $planId = intval($data['plan_id'] ?? 0);
        $amount = floatval($data['amount'] ?? 0);
        if (!is_numeric($data['amount']) || $amount <= 0) json_response(['success' => false, 'error' => 'Invalid amount']);

        $stmt = $conn->prepare("SELECT email_verified, kyc_status, status FROM users WHERE id = ?");
        $stmt->bind_param('i', $uid); $stmt->execute();
        $user = $stmt->get_result()->fetch_assoc();
        if (!$user['email_verified']) json_response(['success' => false, 'error' => 'Please verify your email before investing']);
        if (setting('kyc_required') && $user['kyc_status'] !== 'approved') json_response(['success' => false, 'error' => 'KYC verification is required']);
        if ($user['status'] !== 'active') json_response(['success' => false, 'error' => 'Account suspended']);

        $stmt = $conn->prepare("SELECT * FROM plans WHERE id = ? AND status = 'active'");
        $stmt->bind_param('i', $planId); $stmt->execute();
        $plan = $stmt->get_result()->fetch_assoc();
        if (!$plan) json_response(['success' => false, 'error' => 'Plan not available']);

        $min = floatval($plan['min_amount']); $max = floatval($plan['max_amount']);
        if ($amount < $min || $amount > $max) json_response(['success' => false, 'error' => 'Amount must be between ' . number_format($min, 2) . ' and ' . number_format($max, 2) . ' USDT']);
        if (get_balance($conn, $uid) < $amount) json_response(['success' => false, 'error' => 'Insufficient balance. Please make a deposit first.']);

        $returnType = $plan['return_type'];
        $returnPct = floatval($plan['return_percent']);
        $days = intval($plan['duration_days']);
        if ($returnType === 'daily') $daily = round($amount * ($returnPct / 100), 8);
        elseif ($returnType === 'apr') $daily = round($amount * ($returnPct / 100) / $days, 8);
        else $daily = 0;
        $start = date('Y-m-d');
        $end = date('Y-m-d', strtotime('+' . $days . ' days'));

        $conn->begin_transaction();
        try {
            if (!debit($conn, $uid, $amount, 'investment', 'Invest in ' . $plan['name'])) throw new Exception('debit failed');
            $stmt = $conn->prepare("INSERT INTO investments (user_id, plan_id, amount, return_percent, duration_days, return_type, daily_profit, start_date, end_date, status) VALUES (?,?,?,?,?,?,?,?,?, 'active')");
            $stmt->bind_param('iiddisdss', $uid, $planId, $amount, $returnPct, $days, $returnType, $daily, $start, $end);
            $stmt->execute();
            $invId = $stmt->insert_id;
            credit_referrals($conn, $uid, $amount);
            notify($conn, $uid, 'Investment created', 'You invested ' . number_format($amount, 2) . ' USDT in ' . $plan['name']);
            $conn->commit();
            json_response(['success' => true, 'message' => 'Investment created', 'investment' => ['id' => $invId, 'amount' => $amount, 'daily_profit' => $daily, 'return_type' => $returnType, 'start_date' => $start, 'end_date' => $end]]);
        } catch (Exception $e) {
            $conn->rollback();
            json_response(['success' => false, 'error' => 'Investment failed']);
        }
        break;

    case 'my_investments':
        $stmt = $conn->prepare("SELECT i.*, p.name AS plan_name FROM investments i LEFT JOIN plans p ON p.id = i.plan_id WHERE i.user_id = ? ORDER BY i.created_at DESC");
        $stmt->bind_param('i', $uid); $stmt->execute();
        $res = $stmt->get_result(); $list = [];
        while ($row = $res->fetch_assoc()) $list[] = $row;
        json_response(['success' => true, 'investments' => $list]);
        break;

    case 'transactions':
        $stmt = $conn->prepare("SELECT * FROM transactions WHERE user_id = ? ORDER BY id DESC LIMIT 200");
        $stmt->bind_param('i', $uid); $stmt->execute();
        $res = $stmt->get_result(); $list = [];
        while ($row = $res->fetch_assoc()) $list[] = $row;
        json_response(['success' => true, 'transactions' => $list]);
        break;

    case 'deposit_networks':
        json_response(['success' => true, 'networks' => enabled_deposit_networks()]);
        break;

    case 'request_deposit':
        $amount = floatval($data['amount'] ?? 0);
        $network = strtolower(trim($data['network'] ?? ''));
        $txHash = trim($data['transaction_hash'] ?? '');
        $min = floatval(setting('min_deposit', 10));

        if (!is_numeric($data['amount']) || $amount <= 0) json_response(['success' => false, 'error' => 'Invalid amount']);
        if ($amount < $min) json_response(['success' => false, 'error' => 'Minimum deposit is ' . number_format($min, 2) . ' USDT']);
        if (!valid_network($network)) json_response(['success' => false, 'error' => 'Invalid network']);
        if (!network_enabled($network)) json_response(['success' => false, 'error' => 'This network is currently disabled']);
        if ($txHash === '' || strlen($txHash) > 190) json_response(['success' => false, 'error' => 'A valid transaction hash is required']);

        // Resolve the deposit address server-side (never trust the client).
        $depositAddress = deposit_address_for($network);
        if ($depositAddress === '') json_response(['success' => false, 'error' => 'Deposit address is not configured for this network yet']);

        // Prevent the same transaction hash from being credited twice.
        $dup = $conn->prepare("SELECT id FROM deposits WHERE transaction_hash = ?");
        $dup->bind_param('s', $txHash);
        $dup->execute();
        $dup->store_result();
        if ($dup->num_rows > 0) { $dup->close(); json_response(['success' => false, 'error' => 'This transaction hash has already been submitted']); }
        $dup->close();

        $status = setting('deposit_verification', 'manual') === 'auto' ? 'confirming' : 'pending';
        $stmt = $conn->prepare("INSERT INTO deposits (user_id, asset, network, amount, deposit_address, transaction_hash, status) VALUES (?, 'USDT', ?, ?, ?, ?, ?)");
        $stmt->bind_param('isdsss', $uid, $network, $amount, $depositAddress, $txHash, $status);
        if ($stmt->execute()) {
            json_response(['success' => true, 'message' => 'Deposit submitted successfully', 'deposit_id' => $stmt->insert_id, 'status' => $status]);
        }
        json_response(['success' => false, 'error' => 'Failed to submit deposit']);
        break;

    case 'deposits':
        $stmt = $conn->prepare("SELECT * FROM deposits WHERE user_id = ? ORDER BY id DESC");
        $stmt->bind_param('i', $uid); $stmt->execute();
        $res = $stmt->get_result(); $list = [];
        while ($row = $res->fetch_assoc()) $list[] = $row;
        json_response(['success' => true, 'deposits' => $list]);
        break;

    case 'request_withdrawal':
        $amount = floatval($data['amount'] ?? 0);
        $wallet = trim($data['wallet'] ?? '');
        $fee = floatval(setting('withdraw_fee', 0));
        $min = floatval(setting('min_withdraw', 10));
        if (!is_numeric($data['amount']) || $amount < $min) json_response(['success' => false, 'error' => 'Minimum withdrawal is ' . number_format($min, 2) . ' USDT']);
        if ($wallet === '') json_response(['success' => false, 'error' => 'Wallet address is required']);
        if (get_balance($conn, $uid) < ($amount + $fee)) json_response(['success' => false, 'error' => 'Insufficient balance']);
        $conn->begin_transaction();
        try {
            debit($conn, $uid, $amount + $fee, 'withdrawal', 'Withdrawal request', null);
            $stmt = $conn->prepare("INSERT INTO withdrawals (user_id, amount, wallet_address, status) VALUES (?,?,?, 'pending')");
            $stmt->bind_param('ids', $uid, $amount, $wallet);
            $stmt->execute();
            $wid = $stmt->insert_id;
            notify($conn, $uid, 'Withdrawal requested', 'Your withdrawal of ' . number_format($amount, 2) . ' USDT is pending review.');
            $conn->commit();
            json_response(['success' => true, 'message' => 'Withdrawal request submitted', 'withdrawal_id' => $wid]);
        } catch (Exception $e) {
            $conn->rollback();
            json_response(['success' => false, 'error' => 'Withdrawal failed']);
        }
        break;

    case 'withdrawals':
        $stmt = $conn->prepare("SELECT * FROM withdrawals WHERE user_id = ? ORDER BY id DESC");
        $stmt->bind_param('i', $uid); $stmt->execute();
        $res = $stmt->get_result(); $list = [];
        while ($row = $res->fetch_assoc()) $list[] = $row;
        json_response(['success' => true, 'withdrawals' => $list]);
        break;

    case 'referrals':
        $stmt = $conn->prepare("SELECT referral_code FROM users WHERE id = ?");
        $stmt->bind_param('i', $uid); $stmt->execute();
        $code = $stmt->get_result()->fetch_assoc()['referral_code'];
        $base = (isset($_SERVER['HTTPS']) ? 'https' : 'http') . '://' . ($_SERVER['HTTP_HOST'] ?? 'localhost');
        $stats = $conn->query("SELECT COUNT(*) AS total, COALESCE(SUM(amount),0) AS earned FROM referral_commissions WHERE user_id = $uid")->fetch_assoc();
        $commissions = $conn->query("SELECT * FROM referral_commissions WHERE user_id = $uid ORDER BY id DESC LIMIT 100")->fetch_all(MYSQLI_ASSOC);
        $refUsers = $conn->query("SELECT id, username, created_at FROM users WHERE referred_by = $uid ORDER BY id DESC")->fetch_all(MYSQLI_ASSOC);
        json_response(['success' => true, 'referral_code' => $code, 'referral_link' => $base . '/register.html?ref=' . $code, 'total_referrals' => intval($stats['total']), 'referral_earned' => floatval($stats['earned']), 'commissions' => $commissions, 'referred_users' => $refUsers]);
        break;

    case 'update_profile':
        $wallet = trim($data['wallet'] ?? '');
        if (strlen($wallet) > 120) json_response(['success' => false, 'error' => 'Wallet address too long']);
        $stmt = $conn->prepare("UPDATE users SET wallet_address = ? WHERE id = ?");
        $stmt->bind_param('si', $wallet, $uid);
        $stmt->execute();
        json_response(['success' => true, 'message' => 'Profile updated']);
        break;

    case 'change_password':
        $old = $data['old_password'] ?? '';
        $new = $data['new_password'] ?? '';
        if (strlen($new) < 6) json_response(['success' => false, 'error' => 'New password must be at least 6 characters']);
        $stmt = $conn->prepare("SELECT password FROM users WHERE id = ?");
        $stmt->bind_param('i', $uid); $stmt->execute();
        $cur = $stmt->get_result()->fetch_assoc()['password'];
        if (!password_verify($old, $cur)) json_response(['success' => false, 'error' => 'Current password is incorrect']);
        $hash = password_hash($new, PASSWORD_DEFAULT);
        $stmt = $conn->prepare("UPDATE users SET password = ? WHERE id = ?");
        $stmt->bind_param('si', $hash, $uid);
        $stmt->execute();
        json_response(['success' => true, 'message' => 'Password changed']);
        break;

    case 'kyc_submit':
        $docType = $data['doc_type'] ?? '';
        $filename = $data['filename'] ?? '';
        $b64 = $data['file'] ?? '';
        if (!in_array($docType, ['passport', 'id_card', 'selfie'])) json_response(['success' => false, 'error' => 'Invalid document type']);
        $dir = __DIR__ . '/uploads/kyc';
        if (!is_dir($dir)) @mkdir($dir, 0755, true);
        $ext = strtolower(pathinfo($filename, PATHINFO_EXTENSION));
        if (!in_array($ext, ['jpg', 'jpeg', 'png', 'pdf'])) json_response(['success' => false, 'error' => 'Unsupported file type']);
        $safeName = 'kyc_' . $uid . '_' . bin2hex(random_bytes(8)) . '.' . $ext;
        $raw = base64_decode($b64);
        if ($raw === false || strlen($raw) > 5 * 1024 * 1024) json_response(['success' => false, 'error' => 'Invalid or too large file']);
        file_put_contents($dir . '/' . $safeName, $raw);
        $stmt = $conn->prepare("INSERT INTO kyc_documents (user_id, doc_type, file_path, status) VALUES (?,?,?, 'pending')");
        $relPath = 'uploads/kyc/' . $safeName;
        $stmt->bind_param('iss', $uid, $docType, $relPath);
        $stmt->execute();
        $conn->query("UPDATE users SET kyc_status = 'pending' WHERE id = $uid");
        json_response(['success' => true, 'message' => 'KYC submitted for review']);
        break;

    case 'notifications':
        $stmt = $conn->prepare("SELECT * FROM notifications WHERE user_id = ? ORDER BY id DESC LIMIT 100");
        $stmt->bind_param('i', $uid); $stmt->execute();
        $res = $stmt->get_result(); $list = [];
        while ($row = $res->fetch_assoc()) $list[] = $row;
        json_response(['success' => true, 'notifications' => $list]);
        break;

    case 'notifications_read':
        $conn->query("UPDATE notifications SET is_read = 1 WHERE user_id = $uid");
        json_response(['success' => true]);
        break;

    default:
        json_response(['success' => false, 'error' => 'Invalid action']);
}

closeDBConnection($conn);