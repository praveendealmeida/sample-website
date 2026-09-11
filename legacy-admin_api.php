<?php
header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: POST');
header('Access-Control-Allow-Headers: Content-Type');

require_once 'config.php';

// Check if admin is logged in
if (!isset($_SESSION['admin_logged_in']) || $_SESSION['admin_logged_in'] !== true) {
    echo json_encode(['success' => false, 'error' => 'Unauthorized']);
    exit;
}

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    echo json_encode(['success' => false, 'error' => 'Only POST requests allowed']);
    exit;
}

$data = json_decode(file_get_contents('php://input'), true);
$action = $data['action'] ?? '';

$conn = getDBConnection();

switch ($action) {
    case 'update_balance':
        $amount = floatval($data['amount']);
        $rate = floatval($data['rate']);
        
        if (!is_numeric($data['amount']) || !is_numeric($data['rate']) || $amount < 0 || $rate < 0) {
            echo json_encode(['success' => false, 'error' => 'Balance and rate must be non-negative numbers']);
            break;
        }
        
        $query = "UPDATE usdt_balance SET total_accumulated = ?, generation_rate = ? WHERE id = 1";
        $stmt = $conn->prepare($query);
        $stmt->bind_param('dd', $amount, $rate);
        
        if ($stmt->execute()) {
            echo json_encode(['success' => true, 'message' => 'Balance updated']);
        } else {
            echo json_encode(['success' => false, 'error' => 'Failed to update']);
        }
        $stmt->close();
        break;
        
    case 'toggle_script':
        $scriptId = intval($data['scriptId']);
        $isActive = $data['isActive'] ? 1 : 0;
        $status = $isActive ? 'active' : 'inactive';
        
        // Debug logging
        error_log("Toggle Script - ID: $scriptId, New Active: $isActive, New Status: $status");
        
        $query = "UPDATE processing_scripts SET is_active = ?, status = ? WHERE id = ?";
        $stmt = $conn->prepare($query);
        $stmt->bind_param('isi', $isActive, $status, $scriptId);
        
        if ($stmt->execute()) {
            // Get rate settings
            $settingsQuery = "SELECT min_rate_per_script, max_rate_per_script FROM system_settings WHERE id = 1";
            $settingsResult = $conn->query($settingsQuery);
            $settings = $settingsResult->fetch_assoc();
            
            $minRate = floatval($settings['min_rate_per_script']);
            $maxRate = floatval($settings['max_rate_per_script']);
            
            // Recalculate generation rate based on active scripts
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
            $updateRateQuery = "UPDATE usdt_balance SET generation_rate = ? WHERE id = 1";
            $stmtRate = $conn->prepare($updateRateQuery);
            $stmtRate->bind_param('d', $totalRate);
            $stmtRate->execute();
            $stmtRate->close();
            
            echo json_encode([
                'success' => true, 
                'message' => 'Script updated',
                'debug' => [
                    'scriptId' => $scriptId,
                    'newActive' => $isActive,
                    'newStatus' => $status,
                    'newRate' => $totalRate
                ]
            ]);
        } else {
            echo json_encode(['success' => false, 'error' => 'Failed to update']);
        }
        $stmt->close();
        break;
        
    case 'update_server':
        $isOnline = $data['isOnline'] ? 1 : 0;
        $responseTime = intval($data['responseTime']);
        
        if ($responseTime < 0 || $responseTime > 600000) {
            echo json_encode(['success' => false, 'error' => 'Response time must be between 0 and 600,000 ms']);
            break;
        }
        
        $query = "UPDATE server_status SET is_online = ?, response_time_ms = ? WHERE id = 1";
        $stmt = $conn->prepare($query);
        $stmt->bind_param('ii', $isOnline, $responseTime);
        
        if ($stmt->execute()) {
            echo json_encode(['success' => true, 'message' => 'Server status updated']);
        } else {
            echo json_encode(['success' => false, 'error' => 'Failed to update']);
        }
        $stmt->close();
        break;
        
    case 'update_payout':
        $payoutId = intval($data['payoutId']);
        $amount = floatval($data['amount']);
        $date = $data['date'];
        
        $query = "UPDATE payout_schedule SET payout_amount = ?, payout_date = ? WHERE id = ?";
        $stmt = $conn->prepare($query);
        $stmt->bind_param('dsi', $amount, $date, $payoutId);
        
        if ($stmt->execute()) {
            echo json_encode(['success' => true, 'message' => 'Payout updated']);
        } else {
            echo json_encode(['success' => false, 'error' => 'Failed to update']);
        }
        $stmt->close();
        break;
        
    case 'add_payout':
        $amount = floatval($data['amount']);
        $date = $data['date'];
        
        if (!is_numeric($data['amount']) || $amount <= 0 || !preg_match('/^\d{4}-\d{2}-\d{2}$/', $date)) {
            echo json_encode(['success' => false, 'error' => 'Invalid payout amount or date']);
            break;
        }
        
        $query = "INSERT INTO payout_schedule (payout_amount, payout_date, status) VALUES (?, ?, 'pending')";
        $stmt = $conn->prepare($query);
        $stmt->bind_param('ds', $amount, $date);
        
        if ($stmt->execute()) {
            echo json_encode(['success' => true, 'message' => 'Payout added']);
        } else {
            echo json_encode(['success' => false, 'error' => 'Failed to add']);
        }
        $stmt->close();
        break;
        
    case 'delete_payout':
        $payoutId = intval($data['payoutId']);
        
        $query = "DELETE FROM payout_schedule WHERE id = ?";
        $stmt = $conn->prepare($query);
        $stmt->bind_param('i', $payoutId);
        
        if ($stmt->execute()) {
            echo json_encode(['success' => true, 'message' => 'Payout deleted']);
        } else {
            echo json_encode(['success' => false, 'error' => 'Failed to delete']);
        }
        $stmt->close();
        break;
        
    case 'complete_payout':
        $payoutId = intval($data['payoutId']);
        
        $query = "UPDATE payout_schedule SET status = 'completed' WHERE id = ?";
        $stmt = $conn->prepare($query);
        $stmt->bind_param('i', $payoutId);
        
        if ($stmt->execute()) {
            echo json_encode(['success' => true, 'message' => 'Payout marked as completed']);
        } else {
            echo json_encode(['success' => false, 'error' => 'Failed to update']);
        }
        $stmt->close();
        break;
        
    case 'transfer_payout':
        $payoutId = intval($data['payoutId']);
        $transactionId = $data['transactionId'] ?? '';
        
        if (empty($transactionId)) {
            echo json_encode(['success' => false, 'error' => 'Transaction ID is required']);
            break;
        }
        
        $query = "UPDATE payout_schedule SET status = 'transferred', transaction_id = ?, transferred_at = NOW() WHERE id = ?";
        $stmt = $conn->prepare($query);
        $stmt->bind_param('si', $transactionId, $payoutId);
        
        if ($stmt->execute()) {
            echo json_encode(['success' => true, 'message' => 'Payout marked as transferred']);
        } else {
            echo json_encode(['success' => false, 'error' => 'Failed to update']);
        }
        $stmt->close();
        break;
        
    case 'mark_error':
        $payoutId = intval($data['payoutId']);
        $errorMessage = $data['errorMessage'] ?? '';
        
        if (empty($errorMessage)) {
            echo json_encode(['success' => false, 'error' => 'Error message is required']);
            break;
        }
        
        $query = "UPDATE payout_schedule SET status = 'error', error_message = ? WHERE id = ?";
        $stmt = $conn->prepare($query);
        $stmt->bind_param('si', $errorMessage, $payoutId);
        
        if ($stmt->execute()) {
            echo json_encode(['success' => true, 'message' => 'Payout marked as error']);
        } else {
            echo json_encode(['success' => false, 'error' => 'Failed to update']);
        }
        $stmt->close();
        break;
        
    case 'get_all_payouts':
        $query = "SELECT * FROM payout_schedule ORDER BY payout_date ASC";
        $result = $conn->query($query);
        $payouts = [];
        
        while ($row = $result->fetch_assoc()) {
            $payouts[] = $row;
        }
        
        echo json_encode(['success' => true, 'payouts' => $payouts]);
        break;
        
    case 'update_settings':
        $minRate = floatval($data['minRate']);
        $maxRate = floatval($data['maxRate']);
        $autoUpdateEnabled = $data['autoUpdateEnabled'] ? 1 : 0;
        
        if (!is_numeric($data['minRate']) || !is_numeric($data['maxRate']) || $minRate < 0 || $maxRate <= 0) {
            echo json_encode(['success' => false, 'error' => 'Rates must be positive numbers']);
            break;
        }
        
        if ($minRate >= $maxRate) {
            echo json_encode(['success' => false, 'error' => 'Minimum rate must be less than maximum rate']);
            break;
        }
        
        $query = "UPDATE system_settings SET min_rate_per_script = ?, max_rate_per_script = ?, auto_update_enabled = ? WHERE id = 1";
        $stmt = $conn->prepare($query);
        $stmt->bind_param('ddi', $minRate, $maxRate, $autoUpdateEnabled);
        
        if ($stmt->execute()) {
            echo json_encode(['success' => true, 'message' => 'Settings updated']);
        } else {
            echo json_encode(['success' => false, 'error' => 'Failed to update']);
        }
        $stmt->close();
        break;
        
    case 'get_settings':
        $query = "SELECT * FROM system_settings WHERE id = 1";
        $result = $conn->query($query);
        $settings = $result->fetch_assoc();
        
        echo json_encode(['success' => true, 'settings' => $settings]);
        break;
        
    default:
        echo json_encode(['success' => false, 'error' => 'Invalid action']);
}

closeDBConnection($conn);
?>
