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

if (!isset($data['amount']) || !isset($data['date'])) {
    echo json_encode(['success' => false, 'error' => 'Missing required parameters']);
    exit;
}

$amount = floatval($data['amount']);
$date = $data['date'];

// Validate amount
if (!is_numeric($data['amount']) || $amount < 50 || $amount > 1000) {
    echo json_encode(['success' => false, 'error' => 'Amount must be between 50 and 1,000 USDT']);
    exit;
}

// Validate date (must be at least 5 days from now)
if (!is_string($date) || trim($date) === '') {
    echo json_encode(['success' => false, 'error' => 'Invalid date format']);
    exit;
}

try {
    $selectedDate = new DateTime($date);
} catch (Throwable $e) {
    echo json_encode(['success' => false, 'error' => 'Invalid date format']);
    exit;
}

$minDate = new DateTime();
$minDate->modify('+5 days');
$selectedDate->setTime(0, 0, 0);
$minDate->setTime(0, 0, 0);

if ($selectedDate < $minDate) {
    echo json_encode(['success' => false, 'error' => 'Date must be at least 5 days from today']);
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

// Calculate new total with this request
$newTotalPayouts = $totalScheduledPayouts + $amount;

// Validate that total payouts don't exceed balance
if ($newTotalPayouts > $currentBalance) {
    $remainingAvailable = $currentBalance - $totalScheduledPayouts;
    
    echo json_encode([
        'success' => false, 
        'error' => 'Total scheduled payouts would exceed balance! Available for withdrawal: ' . number_format($remainingAvailable, 2) . ' USDT (Balance: ' . number_format($currentBalance, 2) . ' USDT, Already scheduled: ' . number_format($totalScheduledPayouts, 2) . ' USDT)'
    ]);
    closeDBConnection($conn);
    exit;
}

// Insert withdrawal request as a payout
$query = "INSERT INTO payout_schedule (payout_amount, payout_date, status) VALUES (?, ?, 'pending')";
$stmt = $conn->prepare($query);
$stmt->bind_param('ds', $amount, $date);

if ($stmt->execute()) {
    echo json_encode([
        'success' => true, 
        'message' => 'Withdrawal request submitted successfully',
        'payout_id' => $stmt->insert_id
    ]);
} else {
    echo json_encode(['success' => false, 'error' => 'Failed to submit withdrawal request']);
}

$stmt->close();
closeDBConnection($conn);
?>
