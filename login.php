<?php
header('Content-Type: application/json');
require_once 'config.php';

if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    $data = json_decode(file_get_contents('php://input'), true);
    $username = $data['username'] ?? '';
    $password = $data['password'] ?? '';
    
    if (empty($username) || empty($password)) {
        echo json_encode(['success' => false, 'error' => 'Username and password required']);
        exit;
    }
    
    $conn = getDBConnection();
    $query = "SELECT * FROM admin_users WHERE username = ?";
    $stmt = $conn->prepare($query);
    $stmt->bind_param('s', $username);
    $stmt->execute();
    $result = $stmt->get_result();
    
    if ($result->num_rows === 1) {
        $user = $result->fetch_assoc();
        
        // Verify password
        if (password_verify($password, $user['password'])) {
            session_regenerate_id(true);
            $_SESSION['admin_logged_in'] = true;
            $_SESSION['admin_username'] = $username;
            echo json_encode(['success' => true, 'message' => 'Login successful']);
        } else {
            echo json_encode(['success' => false, 'error' => 'Invalid credentials']);
        }
    } else {
        echo json_encode(['success' => false, 'error' => 'Invalid credentials']);
    }
    
    $stmt->close();
    closeDBConnection($conn);
} elseif ($_SERVER['REQUEST_METHOD'] === 'GET' && isset($_GET['action'])) {
    if ($_GET['action'] === 'check') {
        echo json_encode([
            'success' => true,
            'loggedIn' => isset($_SESSION['admin_logged_in']) && $_SESSION['admin_logged_in']
        ]);
    } elseif ($_GET['action'] === 'logout') {
        session_destroy();
        echo json_encode(['success' => true, 'message' => 'Logged out']);
    }
} else {
    echo json_encode(['success' => false, 'error' => 'Invalid request']);
}
?>
