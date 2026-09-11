<?php
header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET');

require_once 'config.php';

$conn = getDBConnection();

// Get all scripts status
$scriptsQuery = "SELECT * FROM processing_scripts ORDER BY script_number";
$scriptsResult = $conn->query($scriptsQuery);
$scripts = [];
$activeCount = 0;

while ($row = $scriptsResult->fetch_assoc()) {
    // Convert is_active to proper boolean
    $row['is_active'] = (bool)$row['is_active'];
    $scripts[] = $row;
    if ($row['is_active']) {
        $activeCount++;
    }
}

// Get server status
$serverQuery = "SELECT * FROM server_status LIMIT 1";
$serverResult = $conn->query($serverQuery);
$server = $serverResult->fetch_assoc();

// Get balance
$balanceQuery = "SELECT * FROM usdt_balance WHERE id = 1";
$balanceResult = $conn->query($balanceQuery);
$balance = $balanceResult->fetch_assoc();

// Get system settings
$settingsQuery = "SELECT * FROM system_settings WHERE id = 1";
$settingsResult = $conn->query($settingsQuery);
$settings = $settingsResult->fetch_assoc();

// Get next payout
$payoutQuery = "SELECT * FROM payout_schedule WHERE status = 'pending' AND payout_date >= CURDATE() ORDER BY payout_date ASC LIMIT 1";
$payoutResult = $conn->query($payoutQuery);
$nextPayout = $payoutResult->fetch_assoc();

// Get all payouts
$allPayoutsQuery = "SELECT * FROM payout_schedule ORDER BY payout_date ASC";
$allPayoutsResult = $conn->query($allPayoutsQuery);
$allPayouts = [];
while ($row = $allPayoutsResult->fetch_assoc()) {
    $allPayouts[] = $row;
}

$response = [
    'success' => true,
    'data' => [
        'scripts' => $scripts,
        'activeCount' => $activeCount,
        'totalScripts' => count($scripts),
        'server' => [
            'isOnline' => (bool)$server['is_online'],
            'responseTime' => $server['response_time_ms']
        ],
        'balance' => [
            'total' => floatval($balance['total_accumulated']),
            'rate' => floatval($balance['generation_rate']),
            'wallet' => $balance['wallet_address']
        ],
        'nextPayout' => $nextPayout ? [
            'amount' => floatval($nextPayout['payout_amount']),
            'date' => $nextPayout['payout_date']
        ] : null,
        'allPayouts' => $allPayouts
    ]
];

closeDBConnection($conn);
echo json_encode($response);
?>
