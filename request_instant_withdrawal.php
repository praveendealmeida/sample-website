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

if (!isset($data['amount'])) {
    echo json_encode(['success' => false, 'error' => 'Missing required parameters']);
    exit;
}

$amount = floatval($data['amount']);
$walletAddress = isset($data['walletAddress']) && !empty($data['walletAddress']) 
    ? trim($data['walletAddress']) 
    : null;

if ($walletAddress !== null && strlen($walletAddress) > 100) {
    echo json_encode(['success' => false, 'error' => 'Wallet address is too long']);
    exit;
}

// Validate amount
if (!is_numeric($data['amount']) || $amount < 50 || $amount > 5000) {
    echo json_encode(['success' => false, 'error' => 'Amount must be between 50 and 5,000 USDT']);
    exit;
}

$conn = getDBConnection();

// Get current balance from database
$balanceQuery = "SELECT total_accumulated FROM usdt_balance WHERE id = 1";
$balanceResult = $conn->query($balanceQuery);
$balance = $balanceResult->fetch_assoc();
$currentBalance = floatval($balance['total_accumulated']);

// Get total of all pending and completed payouts
$payoutQuery = "SELECT SUM(payout_amount) as total_payouts FROM payout_schedule WHERE status IN ('pending', 'completed')";
$payoutResult = $conn->query($payoutQuery);
$payoutData = $payoutResult->fetch_assoc();
$totalScheduledPayouts = floatval($payoutData['total_payouts']);

// Calculate available balance
$availableBalance = $currentBalance - $totalScheduledPayouts;

// Validate that amount doesn't exceed available balance
if ($amount > $availableBalance) {
    echo json_encode([
        'success' => false, 
        'error' => 'Insufficient balance! Available for withdrawal: ' . number_format($availableBalance, 2) . ' USDT (Balance: ' . number_format($currentBalance, 2) . ' USDT, Already scheduled: ' . number_format($totalScheduledPayouts, 2) . ' USDT)'
    ]);
    closeDBConnection($conn);
    exit;
}

// Insert instant withdrawal request as a completed payout with today's date
$today = date('Y-m-d');

// If wallet address is not provided, get default from usdt_balance table
if ($walletAddress === null) {
    $walletQuery = "SELECT wallet_address FROM usdt_balance WHERE id = 1";
    $walletResult = $conn->query($walletQuery);
    $walletData = $walletResult->fetch_assoc();
    $walletAddress = $walletData['wallet_address'];
}

$query = "INSERT INTO payout_schedule (payout_amount, payout_date, status, wallet_address) VALUES (?, ?, 'completed', ?)";
$stmt = $conn->prepare($query);
$stmt->bind_param('dss', $amount, $today, $walletAddress);

if ($stmt->execute()) {
    echo json_encode([
        'success' => true, 
        'message' => 'Instant withdrawal request submitted successfully. Payment within 24 hours.',
        'payout_id' => $stmt->insert_id
    ]);
} else {
    echo json_encode(['success' => false, 'error' => 'Failed to submit instant withdrawal request']);
}

$stmt->close();
closeDBConnection($conn);
?>
