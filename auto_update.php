<?php

/**
 * Auto-update script.
 *
 * Adds USDT to the balance based on the number of active processing scripts.
 * The per-script rate range is controlled from the Admin Panel (Auto-Update
 * Settings). This script accrues the *elapsed* time since the last update so
 * the configured "USDT per hour per script" rate is honored regardless of the
 * cron interval (every minute, every 5 minutes, etc.).
 */

require_once 'config.php';

$LOG_FILE = __DIR__ . '/auto_update.log'; // Log file path

// Function to log messages
function logMessage($message) {
    global $LOG_FILE;
    $timestamp = date('Y-m-d H:i:s');
    $logEntry = "[$timestamp] $message\n";
    @file_put_contents($LOG_FILE, $logEntry, FILE_APPEND);
    echo $logEntry;
}

try {
    $conn = getDBConnection();

    // Check if auto-update is enabled and get rate settings
    $settingsQuery = "SELECT auto_update_enabled, min_rate_per_script, max_rate_per_script FROM system_settings WHERE id = 1";
    $settingsResult = $conn->query($settingsQuery);
    $settings = $settingsResult->fetch_assoc();

    if (!$settings || !$settings['auto_update_enabled']) {
        logMessage("INFO: Auto-update is disabled in settings. Skipping update.");
        closeDBConnection($conn);
        exit(0);
    }

    $minRate = floatval($settings['min_rate_per_script']);
    $maxRate = floatval($settings['max_rate_per_script']);

    if ($maxRate <= $minRate) {
        logMessage("ERROR: Invalid rate settings (max rate must be greater than min rate).");
        closeDBConnection($conn);
        exit(1);
    }

    // Get count of active scripts
    $activeQuery = "SELECT COUNT(*) as active_count FROM processing_scripts WHERE is_active = TRUE";
    $result = $conn->query($activeQuery);
    $row = $result->fetch_assoc();
    $activeCount = intval($row['active_count']);

    if ($activeCount <= 0) {
        logMessage("INFO: No active scripts. No balance update.");
        closeDBConnection($conn);
        exit(0);
    }

    // Measure elapsed time since the last balance update so the hourly rate is
    // always accurate, no matter how often the cron job runs.
    $balanceQuery = "SELECT total_accumulated, last_update FROM usdt_balance WHERE id = 1";
    $balanceResult = $conn->query($balanceQuery);
    $balance = $balanceResult->fetch_assoc();

    $lastUpdate = ($balance && !empty($balance['last_update'])) ? strtotime($balance['last_update']) : (time() - 60);
    $elapsedMinutes = max(0, (time() - $lastUpdate) / 60);
    $elapsedMinutes = min(60, $elapsedMinutes); // Clamp to avoid a huge catch-up after downtime

    $totalAmount = 0.0;

    for ($i = 0; $i < $activeCount; $i++) {
        // Random amount between minRate and maxRate USDT per hour
        $randomHourlyRate = $minRate + (mt_rand() / mt_getrandmax()) * ($maxRate - $minRate);
        $totalAmount += ($randomHourlyRate / 60) * $elapsedMinutes;
    }

    if ($totalAmount <= 0) {
        logMessage("INFO: Elapsed time too short. No balance update.");
        closeDBConnection($conn);
        exit(0);
    }

    // Update balance
    $updateQuery = "UPDATE usdt_balance SET total_accumulated = total_accumulated + ? WHERE id = 1";
    $stmt = $conn->prepare($updateQuery);
    $stmt->bind_param('d', $totalAmount);

    if ($stmt->execute()) {
        logMessage("SUCCESS: Added " . number_format($totalAmount, 8) . " USDT (" . number_format($elapsedMinutes, 2) . " min, $activeCount active scripts @ {$minRate}-{$maxRate} USDT/hr each).");
    } else {
        logMessage("ERROR: Failed to update balance");
    }

    $stmt->close();
    closeDBConnection($conn);

} catch (Exception $e) {
    logMessage("ERROR: " . $e->getMessage());
    exit(1);
}

exit(0);
?>
