<?php
// This script simulates USDT generation
// Run this periodically via cron job or task scheduler
// Example cron: */5 * * * * php /path/to/generate_usdt.php

require_once 'config.php';

$conn = getDBConnection();

// Get running scripts
$scriptsQuery = "SELECT id FROM processing_scripts WHERE is_active = TRUE";
$scriptsResult = $conn->query($scriptsQuery);

$totalGenerated = 0;

while ($script = $scriptsResult->fetch_assoc()) {
    // Generate random amount between 0.0001 and 0.0015 USDT per update
    $amount = rand(10, 15) / 10000;
    
    // Insert generation record
    $insertQuery = "INSERT INTO usdt_generation (script_id, amount) VALUES (?, ?)";
    $stmt = $conn->prepare($insertQuery);
    $stmt->bind_param('id', $script['id'], $amount);
    $stmt->execute();
    $stmt->close();
    
    $totalGenerated += $amount;
}

// Update total balance
if ($totalGenerated > 0) {
    $updateQuery = "UPDATE usdt_balance SET total_accumulated = total_accumulated + ? WHERE id = 1";
    $stmt = $conn->prepare($updateQuery);
    $stmt->bind_param('d', $totalGenerated);
    $stmt->execute();
    $stmt->close();
    
    echo "Generated: $totalGenerated USDT\n";
} else {
    echo "No active scripts running\n";
}

closeDBConnection($conn);
?>
