<?php
header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: POST');
header('Access-Control-Allow-Headers: Content-Type');

require_once 'config.php';

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    echo json_encode(['success' => false, 'error' => 'Only POST requests allowed']);
    exit;
}

$data = json_decode(file_get_contents('php://input'), true);

if (!isset($data['action'])) {
    echo json_encode(['success' => false, 'error' => 'Missing action parameter']);
    exit;
}

$conn = getDBConnection();
$action = $data['action'];

// Calculate generation rate based on active scripts
function updateGenerationRate($conn) {
    // Get rate settings
    $settingsQuery = "SELECT min_rate_per_script, max_rate_per_script FROM system_settings WHERE id = 1";
    $settingsResult = $conn->query($settingsQuery);
    $settings = $settingsResult->fetch_assoc();
    
    $minRate = floatval($settings['min_rate_per_script']);
    $maxRate = floatval($settings['max_rate_per_script']);
    
    // Count active scripts
    $countQuery = "SELECT COUNT(*) as active_count FROM processing_scripts WHERE is_active = TRUE";
    $result = $conn->query($countQuery);
    $row = $result->fetch_assoc();
    $activeCount = $row['active_count'];
    
    // Each script generates random rate between min and max USDT per hour
    $totalRate = 0;
    for ($i = 0; $i < $activeCount; $i++) {
        $randomRate = $minRate + (mt_rand() / mt_getrandmax()) * ($maxRate - $minRate);
        $totalRate += $randomRate;
    }
    
    // Update the rate in database
    $updateQuery = "UPDATE usdt_balance SET generation_rate = ? WHERE id = 1";
    $stmt = $conn->prepare($updateQuery);
    $stmt->bind_param('d', $totalRate);
    $stmt->execute();
    $stmt->close();
    
    return $totalRate;
}

if ($action === 'start' || $action === 'stop') {
    if (!isset($data['scriptId'])) {
        echo json_encode(['success' => false, 'error' => 'Missing scriptId']);
        exit;
    }
    
    $scriptId = intval($data['scriptId']);
    $isActive = ($action === 'start') ? 1 : 0;
    $status = ($action === 'start') ? 'active' : 'inactive';
    
    $query = "UPDATE processing_scripts SET is_active = ?, status = ? WHERE id = ?";
    $stmt = $conn->prepare($query);
    $stmt->bind_param('isi', $isActive, $status, $scriptId);
    
    if ($stmt->execute()) {
        // Update generation rate
        $newRate = updateGenerationRate($conn);
        
        echo json_encode([
            'success' => true, 
            'message' => 'Script status updated',
            'newRate' => $newRate
        ]);
    } else {
        echo json_encode(['success' => false, 'error' => 'Failed to update script status']);
    }
    
    $stmt->close();
} elseif ($action === 'reboot_server') {
    // Simulate server reboot
    $query = "UPDATE server_status SET last_ping = NOW() WHERE id = 1";
    $conn->query($query);
    
    echo json_encode([
        'success' => true, 
        'message' => 'Server reboot initiated'
    ]);
} else {
    echo json_encode(['success' => false, 'error' => 'Invalid action']);
}

closeDBConnection($conn);
?>
