<?php
// Database Configuration
define('DB_HOST', 'localhost');
define('DB_USER', 'root');
define('DB_PASS', '');
define('DB_NAME', 'usdt_operations');

// Create database connection
function getDBConnection() {
    try {
        $conn = new mysqli(DB_HOST, DB_USER, DB_PASS, DB_NAME);
        
        if ($conn->connect_error) {
            die(json_encode([
                'success' => false,
                'error' => 'Database connection failed'
            ]));
        }
        
        $conn->set_charset('utf8mb4');
        return $conn;
    } catch (Exception $e) {
        die(json_encode([
            'success' => false,
            'error' => 'Database error'
        ]));
    }
}

function closeDBConnection($conn) {
    if ($conn) {
        $conn->close();
    }
}

// Start session for admin authentication
session_start();
?>
