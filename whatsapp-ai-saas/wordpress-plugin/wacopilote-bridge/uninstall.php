<?php
/**
 * WaCopilote Bridge — Uninstall Script
 *
 * This file is executed automatically by WordPress when the admin
 * clicks "Delete" on the plugin page (after deactivation).
 * It removes ALL data created by the plugin from the database.
 *
 * @package WaCopiloteBridge
 */

// Security: WordPress must be the one calling this file.
if ( ! defined( 'WP_UNINSTALL_PLUGIN' ) ) {
    die( 'Direct access not allowed.' );
}

// ─── Remove plugin options ─────────────────────────────────────────────────
delete_option( 'wacopilote_bridge_token' );
delete_option( 'wacopilote_bridge_version' );

// Also clean up site-wide options in multisite setups
if ( is_multisite() ) {
    delete_site_option( 'wacopilote_bridge_token' );
    delete_site_option( 'wacopilote_bridge_version' );

    // Loop through all sites in the network
    $sites = get_sites( array( 'number' => 1000 ) );
    foreach ( $sites as $site ) {
        switch_to_blog( $site->blog_id );
        delete_option( 'wacopilote_bridge_token' );
        delete_option( 'wacopilote_bridge_version' );
        restore_current_blog();
    }
}

// ─── Flush rewrite rules ───────────────────────────────────────────────────
flush_rewrite_rules();
