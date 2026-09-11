<?php
header('Content-Type: application/json');
require_once __DIR__ . '/lib.php';
require_once __DIR__ . '/deposit_service.php';
require_admin();

$conn = getDBConnection();
$isPost = $_SERVER['REQUEST_METHOD'] === 'POST';
$data = $isPost ? json_decode(file_get_contents('php://input'), true) : [];
$action = $isPost ? ($data['action'] ?? '') : ($_GET['action'] ?? '');

if ($isPost && !csrf_verify($data['csrf'] ?? '')) {
    json_response(['success' => false, 'error' => 'Invalid CSRF token'], 403);
}

$WHITELIST = ['site_name','currency','min_deposit','min_withdraw','withdraw_fee','kyc_required','maintenance','referral_enabled','referral_level1','referral_level2','referral_level3','smtp_host','smtp_port','smtp_user','smtp_pass','smtp_from','deposit_erc20_address','deposit_bep20_address','deposit_trc20_address','deposit_erc20_enabled','deposit_bep20_enabled','deposit_trc20_enabled','deposit_required_confirmations','deposit_verification'];

switch ($action) {
    case 'csrf':
        json_response(['success' => true, 'csrf' => csrf_token()]);
        break;

    case 'dashboard':
        $s = [];
        $s['total_users'] = intval($conn->query("SELECT COUNT(*) c FROM users")->fetch_assoc()['c']);
        $s['verified_users'] = intval($conn->query("SELECT COUNT(*) c FROM users WHERE email_verified = 1")->fetch_assoc()['c']);
        $s['pending_kyc'] = intval($conn->query("SELECT COUNT(*) c FROM users WHERE kyc_status = 'pending'")->fetch_assoc()['c']);
        $s['total_deposits'] = floatval($conn->query("SELECT COALESCE(SUM(amount),0) a FROM deposits WHERE status='approved'")->fetch_assoc()['a']);
        $s['total_withdrawals'] = floatval($conn->query("SELECT COALESCE(SUM(amount),0) a FROM withdrawals WHERE status='approved'")->fetch_assoc()['a']);
        $s['pending_withdrawals'] = intval($conn->query("SELECT COUNT(*) c FROM withdrawals WHERE status='pending'")->fetch_assoc()['c']);
        $s['pending_deposits'] = intval($conn->query("SELECT COUNT(*) c FROM deposits WHERE status='pending'")->fetch_assoc()['c']);
        $s['active_investments'] = intval($conn->query("SELECT COUNT(*) c FROM investments WHERE status='active'")->fetch_assoc()['c']);
        $s['total_invested'] = floatval($conn->query("SELECT COALESCE(SUM(amount),0) a FROM investments")->fetch_assoc()['a']);
        $s['referral_paid'] = floatval($conn->query("SELECT COALESCE(SUM(amount),0) a FROM referral_commissions")->fetch_assoc()['a']);
        json_response(['success' => true, 'stats' => $s]);
        break;

    case 'plans':
        $r = $conn->query("SELECT * FROM plans ORDER BY id ASC");
        $plans = []; while ($p = $r->fetch_assoc()) $plans[] = $p;
        json_response(['success' => true, 'plans' => $plans]);
        break;

    case 'plan_save':
        $id = intval($data['id'] ?? 0);
        $name = trim($data['name'] ?? '');
        $min = floatval($data['min_amount'] ?? 0);
        $max = floatval($data['max_amount'] ?? 0);
        $pct = floatval($data['return_percent'] ?? 0);
        $days = intval($data['duration_days'] ?? 0);
        $type = $data['return_type'] ?? 'daily';
        $status = $data['status'] ?? 'active';
        $featured = !empty($data['featured']) ? 1 : 0;
        $desc = trim($data['description'] ?? '');

        if ($name === '' || $min <= 0 || $max < $min || $pct <= 0 || $days <= 0) json_response(['success' => false, 'error' => 'Invalid plan values']);
        if (!in_array($type, ['daily','apr','end'])) json_response(['success' => false, 'error' => 'Invalid return type']);
        if (!in_array($status, ['active','inactive'])) json_response(['success' => false, 'error' => 'Invalid status']);

        if ($id > 0) {
            $stmt = $conn->prepare("UPDATE plans SET name=?, min_amount=?, max_amount=?, return_percent=?, duration_days=?, return_type=?, status=?, featured=?, description=? WHERE id=?");
            $stmt->bind_param('sdddisisi', $name, $min, $max, $pct, $days, $type, $status, $featured, $desc, $id);
        } else {
            $stmt = $conn->prepare("INSERT INTO plans (name, min_amount, max_amount, return_percent, duration_days, return_type, status, featured, description) VALUES (?,?,?,?,?,?,?,?,?)");
            $stmt->bind_param('sdddisisi', $name, $min, $max, $pct, $days, $type, $status, $featured, $desc);
        }
        if ($stmt->execute()) json_response(['success' => true, 'message' => 'Plan saved']);
        json_response(['success' => false, 'error' => 'Failed to save plan']);
        break;

    case 'plan_delete':
        $id = intval($data['id'] ?? 0);
        $conn->query("DELETE FROM plans WHERE id = $id");
        json_response(['success' => true, 'message' => 'Plan deleted']);
        break;

    case 'users':
        $q = trim($data['q'] ?? ($_GET['q'] ?? ''));
        $where = '';
        if ($q !== '') { $like = '%' . $q . '%'; $stmt = $conn->prepare("SELECT id, username, email, email_verified, kyc_status, status, balance, created_at FROM users WHERE username LIKE ? OR email LIKE ? ORDER BY id DESC LIMIT 200"); $stmt->bind_param('ss', $like, $like); $stmt->execute(); $res = $stmt->get_result(); }
        else { $res = $conn->query("SELECT id, username, email, email_verified, kyc_status, status, balance, created_at FROM users ORDER BY id DESC LIMIT 200"); }
        $users = []; while ($u = $res->fetch_assoc()) $users[] = $u;
        json_response(['success' => true, 'users' => $users]);
        break;

    case 'user_detail':
        $id = intval($data['id'] ?? 0);
        $u = $conn->query("SELECT id, username, email, email_verified, wallet_address, kyc_status, status, referral_code, referred_by, balance, created_at FROM users WHERE id = $id")->fetch_assoc();
        if (!$u) json_response(['success' => false, 'error' => 'User not found']);
        $inv = $conn->query("SELECT COUNT(*) c, COALESCE(SUM(amount),0) a FROM investments WHERE user_id = $id")->fetch_assoc();
        $refs = $conn->query("SELECT COUNT(*) c FROM users WHERE referred_by = $id")->fetch_assoc();
        json_response(['success' => true, 'user' => $u, 'investments' => ['count' => intval($inv['c']), 'total' => floatval($inv['a'])], 'referrals' => intval($refs['c'])]);
        break;

    case 'user_toggle':
        $id = intval($data['id'] ?? 0);
        $status = ($data['status'] ?? '') === 'suspended' ? 'suspended' : 'active';
        $conn->query("UPDATE users SET status = '$status' WHERE id = $id");
        json_response(['success' => true, 'message' => 'User status updated']);
        break;

    case 'deposits':
        $status = trim($data['status'] ?? ($_GET['status'] ?? ''));
        $sql = "SELECT d.*, u.username FROM deposits d LEFT JOIN users u ON u.id = d.user_id";
        if (in_array($status, ['pending','approved','rejected'])) $sql .= " WHERE d.status = '$status'";
        $sql .= " ORDER BY d.id DESC LIMIT 300";
        $r = $conn->query($sql); $list = []; while ($x = $r->fetch_assoc()) $list[] = $x;
        json_response(['success' => true, 'deposits' => $list]);
        break;

    case 'deposit_review':
        $id = intval($data['id'] ?? 0);
        $decision = $data['decision'] ?? '';
        $d = $conn->query("SELECT * FROM deposits WHERE id = $id AND status IN ('pending','confirming')")->fetch_assoc();
        if (!$d) json_response(['success' => false, 'error' => 'Deposit not found or already reviewed']);
        if ($decision === 'approve') {
            $conn->begin_transaction();
            try {
                credit($conn, intval($d['user_id']), floatval($d['amount']), 'deposit', 'USDT deposit approved (' . $d['network'] . ')', $id);
                $conn->query("UPDATE deposits SET status='approved', reviewed_by=1, approved_at=NOW() WHERE id = $id");
                notify($conn, intval($d['user_id']), 'Deposit approved', 'Your deposit of ' . number_format(floatval($d['amount']), 2) . ' USDT (' . strtoupper($d['network']) . ') has been approved.');
                $conn->commit();
                json_response(['success' => true, 'message' => 'Deposit approved']);
            } catch (Exception $e) { $conn->rollback(); json_response(['success' => false, 'error' => 'Failed']); }
        } else {
            $conn->query("UPDATE deposits SET status='rejected', reviewed_by=1 WHERE id = $id");
            notify($conn, intval($d['user_id']), 'Deposit rejected', 'Your deposit was rejected.');
            json_response(['success' => true, 'message' => 'Deposit rejected']);
        }
        break;

    case 'deposit_settings':
        json_response(['success' => true, 'settings' => [
            'erc20_address' => setting('deposit_erc20_address'),
            'bep20_address' => setting('deposit_bep20_address'),
            'trc20_address' => setting('deposit_trc20_address'),
            'erc20_enabled' => setting('deposit_erc20_enabled'),
            'bep20_enabled' => setting('deposit_bep20_enabled'),
            'trc20_enabled' => setting('deposit_trc20_enabled'),
            'min_deposit' => setting('min_deposit'),
            'required_confirmations' => setting('deposit_required_confirmations'),
            'verification' => setting('deposit_verification')
        ]]);
        break;

    case 'deposit_settings_save':
        $fields = [
            'erc20_address' => 'deposit_erc20_address',
            'bep20_address' => 'deposit_bep20_address',
            'trc20_address' => 'deposit_trc20_address',
            'erc20_enabled' => 'deposit_erc20_enabled',
            'bep20_enabled' => 'deposit_bep20_enabled',
            'trc20_enabled' => 'deposit_trc20_enabled',
            'required_confirmations' => 'deposit_required_confirmations',
            'verification' => 'deposit_verification'
        ];
        foreach ($fields as $k => $key) {
            if (array_key_exists($k, $data)) {
                $v = (string)$data[$k];
                if (in_array($k, ['erc20_enabled','bep20_enabled','trc20_enabled'])) $v = ($v == '1') ? '1' : '0';
                if ($k === 'verification') $v = ($v === 'auto') ? 'auto' : 'manual';
                $stmt = $conn->prepare("INSERT INTO settings (setting_key, setting_value) VALUES (?,?) ON DUPLICATE KEY UPDATE setting_value = VALUES(setting_value)");
                $stmt->bind_param('ss', $key, $v);
                $stmt->execute();
            }
        }
        if (array_key_exists('min_deposit', $data)) {
            $v = (string)floatval($data['min_deposit']);
            $stmt = $conn->prepare("INSERT INTO settings (setting_key, setting_value) VALUES ('min_deposit',?) ON DUPLICATE KEY UPDATE setting_value = VALUES(setting_value)");
            $stmt->bind_param('s', $v);
            $stmt->execute();
        }
        json_response(['success' => true, 'message' => 'Deposit settings saved']);
        break;

    case 'deposit_set_confirmations':
        $id = intval($data['id'] ?? 0);
        $count = intval($data['confirmations'] ?? 0);
        $d = $conn->query("SELECT * FROM deposits WHERE id = $id")->fetch_assoc();
        if (!$d) json_response(['success' => false, 'error' => 'Deposit not found']);
        $conn->query("UPDATE deposits SET confirmation_count = $count WHERE id = $id");
        $required = intval(setting('deposit_required_confirmations', 6));
        if (setting('deposit_verification', 'manual') === 'auto' && $count >= $required && in_array($d['status'], ['pending', 'confirming'])) {
            $conn->begin_transaction();
            try {
                credit($conn, intval($d['user_id']), floatval($d['amount']), 'deposit', 'USDT deposit auto-approved (' . $d['network'] . ')', $id);
                $conn->query("UPDATE deposits SET status='approved', approved_at=NOW() WHERE id = $id");
                notify($conn, intval($d['user_id']), 'Deposit approved', 'Your deposit has been confirmed and approved.');
                $conn->commit();
                json_response(['success' => true, 'message' => 'Deposit auto-approved']); 
            } catch (Exception $e) { $conn->rollback(); json_response(['success' => false, 'error' => 'Failed']); }
        }
        json_response(['success' => true, 'message' => 'Confirmations updated']);
        break;

    case 'withdrawals':
        $status = trim($data['status'] ?? ($_GET['status'] ?? ''));
        $sql = "SELECT w.*, u.username FROM withdrawals w LEFT JOIN users u ON u.id = w.user_id";
        if (in_array($status, ['pending','approved','rejected'])) $sql .= " WHERE w.status = '$status'";
        $sql .= " ORDER BY w.id DESC LIMIT 300";
        $r = $conn->query($sql); $list = []; while ($x = $r->fetch_assoc()) $list[] = $x;
        json_response(['success' => true, 'withdrawals' => $list]);
        break;

    case 'withdrawal_review':
        $id = intval($data['id'] ?? 0);
        $decision = $data['decision'] ?? '';
        $w = $conn->query("SELECT * FROM withdrawals WHERE id = $id AND status = 'pending'")->fetch_assoc();
        if (!$w) json_response(['success' => false, 'error' => 'Withdrawal not found or already reviewed']);
        if ($decision === 'approve') {
            $conn->query("UPDATE withdrawals SET status='approved', reviewed_by=1, reviewed_at=NOW() WHERE id = $id");
            notify($conn, intval($w['user_id']), 'Withdrawal approved', 'Your withdrawal of ' . number_format(floatval($w['amount']), 2) . ' USDT has been approved.');
            json_response(['success' => true, 'message' => 'Withdrawal approved']);
        } else {
            $fee = floatval(setting('withdraw_fee', 0));
            $conn->begin_transaction();
            try {
                credit($conn, intval($w['user_id']), floatval($w['amount']) + $fee, 'withdrawal', 'Withdrawal rejected (refund)', $id);
                $conn->query("UPDATE withdrawals SET status='rejected', reviewed_by=1, reviewed_at=NOW() WHERE id = $id");
                notify($conn, intval($w['user_id']), 'Withdrawal rejected', 'Your withdrawal of ' . number_format(floatval($w['amount']), 2) . ' USDT was rejected and refunded.');
                $conn->commit();
                json_response(['success' => true, 'message' => 'Withdrawal rejected and refunded']);
            } catch (Exception $e) { $conn->rollback(); json_response(['success' => false, 'error' => 'Failed']); }
        }
        break;

    case 'kyc_list':
        $r = $conn->query("SELECT k.*, u.username FROM kyc_documents k LEFT JOIN users u ON u.id = k.user_id ORDER BY (k.status='pending') DESC, k.id DESC LIMIT 300");
        $list = []; while ($x = $r->fetch_assoc()) $list[] = $x;
        json_response(['success' => true, 'documents' => $list]);
        break;

    case 'kyc_review':
        $id = intval($data['id'] ?? 0);
        $decision = $data['decision'] ?? '';
        $notes = trim($data['notes'] ?? '');
        $doc = $conn->query("SELECT * FROM kyc_documents WHERE id = $id")->fetch_assoc();
        if (!$doc) json_response(['success' => false, 'error' => 'Document not found']);
        $newStatus = $decision === 'approve' ? 'approved' : 'rejected';
        $conn->query("UPDATE kyc_documents SET status='$newStatus', notes='" . $conn->real_escape_string($notes) . "' WHERE id = $id");
        $conn->query("UPDATE users SET kyc_status='$newStatus' WHERE id = " . intval($doc['user_id']));
        notify($conn, intval($doc['user_id']), 'KYC ' . $newStatus, 'Your KYC submission was ' . $newStatus . '.');
        json_response(['success' => true, 'message' => 'KYC updated']);
        break;

    case 'referral_settings':
        json_response(['success' => true, 'settings' => ['enabled' => setting('referral_enabled'), 'level1' => setting('referral_level1'), 'level2' => setting('referral_level2'), 'level3' => setting('referral_level3')]]);
        break;

    case 'referral_save':
        $conn->query("UPDATE settings SET setting_value = '" . (empty($data['enabled']) ? '0' : '1') . "' WHERE setting_key = 'referral_enabled'");
        foreach (['level1' => 'referral_level1', 'level2' => 'referral_level2', 'level3' => 'referral_level3'] as $k => $key) {
            $v = floatval($data[$k] ?? 0);
            $conn->query("UPDATE settings SET setting_value = '$v' WHERE setting_key = '$key'");
        }
        json_response(['success' => true, 'message' => 'Referral settings saved']);
        break;

    case 'referrals_stats':
        $commissions = $conn->query("SELECT rc.*, u.username AS referrer, fu.username AS referred FROM referral_commissions rc LEFT JOIN users u ON u.id = rc.user_id LEFT JOIN users fu ON fu.id = rc.from_user_id ORDER BY rc.id DESC LIMIT 300")->fetch_all(MYSQLI_ASSOC);
        $total = floatval($conn->query("SELECT COALESCE(SUM(amount),0) a FROM referral_commissions")->fetch_assoc()['a']);
        json_response(['success' => true, 'commissions' => $commissions, 'total' => $total]);
        break;

    case 'settings_get':
        json_response(['success' => true, 'settings' => settings()]);
        break;

    case 'settings_save':
        $conn->begin_transaction();
        foreach ($WHITELIST as $key) {
            if (array_key_exists($key, $data)) {
                $v = (string)$data[$key];
                $stmt = $conn->prepare("INSERT INTO settings (setting_key, setting_value) VALUES (?,?) ON DUPLICATE KEY UPDATE setting_value = VALUES(setting_value)");
                $stmt->bind_param('ss', $key, $v);
                $stmt->execute();
            }
        }
        $conn->commit();
        json_response(['success' => true, 'message' => 'Settings saved']);
        break;

    default:
        json_response(['success' => false, 'error' => 'Invalid action']);
}

closeDBConnection($conn);