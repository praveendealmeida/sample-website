<?php
header('Content-Type: application/json');
require_once __DIR__ . '/lib.php';

$action = $_GET['action'] ?? '';

if ($_SERVER['REQUEST_METHOD'] === 'GET') {
    if ($action === 'csrf') json_response(['success' => true, 'csrf' => csrf_token()]);
    if ($action === 'check') {
        $logged = is_logged_in();
        json_response(['success' => true, 'loggedIn' => $logged, 'user' => $logged ? ['id' => current_uid(), 'username' => $_SESSION['user_username']] : null]);
    }
    if ($action === 'verify' && isset($_GET['token'])) { verifyEmail($_GET['token']); }
    json_response(['success' => false, 'error' => 'Invalid action']);
}

$data = json_decode(file_get_contents('php://input'), true);
$action = $data['action'] ?? '';

if ($action === 'logout') {
    unset($_SESSION['user_logged_in'], $_SESSION['user_id'], $_SESSION['user_username']);
    json_response(['success' => true, 'message' => 'Logged out']);
}

$conn = getDBConnection();

switch ($action) {
    case 'register':
        $username = trim($data['username'] ?? '');
        $email = strtolower(trim($data['email'] ?? ''));
        $password = $data['password'] ?? '';
        $referral = strtoupper(trim($data['referral_code'] ?? ''));

        if (strlen($username) < 3 || strlen($username) > 50) json_response(['success' => false, 'error' => 'Username must be 3-50 characters']);
        if (!filter_var($email, FILTER_VALIDATE_EMAIL)) json_response(['success' => false, 'error' => 'Invalid email address']);
        if (strlen($password) < 6) json_response(['success' => false, 'error' => 'Password must be at least 6 characters']);

        $stmt = $conn->prepare("SELECT id FROM users WHERE username = ? OR email = ?");
        $stmt->bind_param('ss', $username, $email);
        $stmt->execute();
        $stmt->store_result();
        if ($stmt->num_rows > 0) { $stmt->close(); json_response(['success' => false, 'error' => 'Username or email already in use']); }
        $stmt->close();

        $referredBy = null;
        if ($referral !== '') {
            $stmt = $conn->prepare("SELECT id FROM users WHERE referral_code = ?");
            $stmt->bind_param('s', $referral);
            $stmt->execute();
            $r = $stmt->get_result();
            if ($r->num_rows) $referredBy = intval($r->fetch_assoc()['id']);
            $stmt->close();
        }

        $code = generate_referral_code($conn);
        $hash = password_hash($password, PASSWORD_DEFAULT);
        $stmt = $conn->prepare("INSERT INTO users (username, email, password, referral_code, referred_by) VALUES (?,?,?,?,?)");
        $stmt->bind_param('ssssi', $username, $email, $hash, $code, $referredBy);
        if (!$stmt->execute()) json_response(['success' => false, 'error' => 'Registration failed']);
        $uid = $stmt->insert_id;
        $stmt->close();

        $token = create_token($conn, $uid, 'verify');
        $base = (isset($_SERVER['HTTPS']) ? 'https' : 'http') . '://' . ($_SERVER['HTTP_HOST'] ?? 'localhost');
        $link = $base . '/auth_api.php?action=verify&token=' . $token;
        send_mail($email, 'Verify your email', 'Click to verify your account: ' . $link);

        session_regenerate_id(true);
        $_SESSION['user_logged_in'] = true;
        $_SESSION['user_id'] = $uid;
        $_SESSION['user_username'] = $username;
        json_response(['success' => true, 'message' => 'Registered. Check your email to verify.', 'user' => ['id' => $uid, 'username' => $username, 'email_verified' => 0]]);
        break;

    case 'login':
        $login = trim($data['login'] ?? '');
        $password = $data['password'] ?? '';
        $stmt = $conn->prepare("SELECT id, username, password, email_verified, status FROM users WHERE username = ? OR email = ?");
        $stmt->bind_param('ss', $login, $login);
        $stmt->execute();
        $res = $stmt->get_result();
        if ($res->num_rows === 1) {
            $u = $res->fetch_assoc();
            if (password_verify($password, $u['password'])) {
                if ($u['status'] === 'suspended') json_response(['success' => false, 'error' => 'Account suspended']);
                session_regenerate_id(true);
                $_SESSION['user_logged_in'] = true;
                $_SESSION['user_id'] = $u['id'];
                $_SESSION['user_username'] = $u['username'];
                json_response(['success' => true, 'message' => 'Logged in', 'user' => ['id' => $u['id'], 'username' => $u['username'], 'email_verified' => (int)$u['email_verified']]]);
            }
        }
        json_response(['success' => false, 'error' => 'Invalid credentials']);
        break;

    case 'resend':
        $email = strtolower(trim($data['email'] ?? ''));
        $stmt = $conn->prepare("SELECT id FROM users WHERE email = ?");
        $stmt->bind_param('s', $email);
        $stmt->execute();
        $r = $stmt->get_result();
        if ($r->num_rows !== 1) json_response(['success' => false, 'error' => 'No account found with that email']);
        $uid = intval($r->fetch_assoc()['id']);
        $token = create_token($conn, $uid, 'verify');
        $base = (isset($_SERVER['HTTPS']) ? 'https' : 'http') . '://' . ($_SERVER['HTTP_HOST'] ?? 'localhost');
        $link = $base . '/auth_api.php?action=verify&token=' . $token;
        send_mail($email, 'Verify your email', 'Click to verify your account: ' . $link);
        json_response(['success' => true, 'message' => 'Verification email sent']);
        break;

    default:
        json_response(['success' => false, 'error' => 'Invalid action']);
}

closeDBConnection($conn);

function verifyEmail($token) {
    $conn = getDBConnection();
    $stmt = $conn->prepare("SELECT id, user_id, expires_at, used FROM email_tokens WHERE token = ? AND type = 'verify'");
    $stmt->bind_param('s', $token);
    $stmt->execute();
    $res = $stmt->get_result();
    if ($res->num_rows !== 1) { closeDBConnection($conn); echo 'Invalid or expired verification link.'; exit; }
    $row = $res->fetch_assoc();
    if ($row['used'] || strtotime($row['expires_at']) < time()) { closeDBConnection($conn); echo 'Verification link expired.'; exit; }
    $conn->query("UPDATE email_tokens SET used = 1 WHERE id = " . intval($row['id']));
    $conn->query("UPDATE users SET email_verified = 1 WHERE id = " . intval($row['user_id']));
    closeDBConnection($conn);
    echo '<h2>Email verified successfully!</h2><p>You can close this page and log in.</p>';
    exit;
}