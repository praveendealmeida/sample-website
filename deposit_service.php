<?php
/**
 * Deposit service — USDT only (ERC20 / BEP20 / TRC20).
 *
 * Kept in its own file so blockchain verification / chain APIs
 * (Etherscan, BscScan, TronGrid, etc.) can be added here later
 * without touching the rest of the platform.
 */
require_once __DIR__ . '/lib.php';

const DEPOSIT_NETWORKS = [
    'erc20' => 'USDT — ERC20',
    'bep20' => 'USDT — BEP20',
    'trc20' => 'USDT — TRC20',
];

function valid_network($n) { return array_key_exists($n, DEPOSIT_NETWORKS); }

function network_enabled($n) {
    return valid_network($n) && setting('deposit_' . $n . '_enabled', '0') == '1';
}

function deposit_address_for($n) {
    return setting('deposit_' . $n . '_address', '');
}

function enabled_deposit_networks() {
    $list = [];
    foreach (DEPOSIT_NETWORKS as $key => $label) {
        if (network_enabled($key)) {
            $list[] = ['key' => $key, 'label' => $label, 'address' => deposit_address_for($key)];
        }
    }
    return $list;
}

/**
 * Blockchain verification hook (modular extension point).
 *
 * In AUTOMATIC verification mode this function should query the relevant
 * USDT chain API and return the number of on-chain confirmations for
 * $transactionHash on $network. Return null when no external API is
 * configured (the deposit then stays in manual/confirming state).
 */
function blockchain_verify_deposit($network, $transactionHash, $depositAddress, $amount) {
    // TODO: integrate chain API here (e.g. Etherscan / BscScan / TronGrid).
    // Example return value: 12  (number of confirmations)
    return null;
}