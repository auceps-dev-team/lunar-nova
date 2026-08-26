<?php
/**
 * Plugin Name:       WaCopilote Bridge
 * Plugin URI:        https://auceps-digital.com/wacopilote
 * Description:       Connects WordPress to WaCopilote AI agent with Human-in-the-Loop governance. All AI mutations require admin approval before execution.
 * Version:           2.0.0
 * Author:            AUCEPS Digital
 * License:           GPL v2 or later
 * Text Domain:       wacopilote-bridge
 */

if ( ! defined( 'ABSPATH' ) ) {
    exit;
}

define( 'WAC_BRIDGE_VERSION', '2.0.0' );
define( 'WAC_BRIDGE_NAMESPACE', 'wacopilote/v1' );
define( 'WAC_ACTION_CPT', 'wa_ai_action' );

// ─── 1. Plugin Activation: Generate a unique security token & Create Agent ───
register_activation_hook( __FILE__, 'wac_bridge_activate' );
function wac_bridge_activate() {
    // No token needed — authentication uses WordPress Application Passwords (WP 5.6+).
    // 1. Create a custom role — propose-only, no direct DB writes
    add_role(
        'wacopilote_agent_role',
        'Agent WaCopilote',
        array(
            'read'                => true,
            'upload_files'        => true,
            'wacopilote_propose'  => true, // Custom cap: can only submit proposals
        )
    );

    // 1b. Register the staging CPT (needs flush after activation)
    wac_bridge_register_action_cpt();
    flush_rewrite_rules();

    // 2. Create the Bot User if it doesn't exist
    $user_login = 'wacopilote_agent_bot';
    if ( ! username_exists( $user_login ) ) {
        $random_password = wp_generate_password( 32, true, true );
        $user_id = wp_create_user( $user_login, $random_password, 'bot@wacopilote.local' );
        if ( ! is_wp_error( $user_id ) ) {
            $user = new WP_User( $user_id );
            $user->set_role( 'wacopilote_agent_role' );
            update_option( 'wacopilote_bridge_agent_id', $user_id );
        }
    } else {
        $user = get_user_by( 'login', $user_login );
        update_option( 'wacopilote_bridge_agent_id', $user->ID );
    }

    // 3. Create the audit logs table
    wac_bridge_create_log_table();
}

// ─── 1a. Logs Table Creation ──────────────────────────────────
function wac_bridge_create_log_table() {
    global $wpdb;
    $table_name = $wpdb->prefix . 'wacopilote_logs';
    $charset_collate = $wpdb->get_charset_collate();

    $sql = "CREATE TABLE $table_name (
        id bigint(20) NOT NULL AUTO_INCREMENT,
        action_id bigint(20) NOT NULL,
        user_id bigint(20) NOT NULL,
        action_type varchar(50) NOT NULL,
        context text NOT NULL,
        status varchar(20) NOT NULL,
        created_at datetime DEFAULT CURRENT_TIMESTAMP NOT NULL,
        PRIMARY KEY  (id)
    ) $charset_collate;";

    require_once( ABSPATH . 'wp-admin/includes/upgrade.php' );
    dbDelta( $sql );
}

/**
 * Helper to log actions into the audit table.
 * 
 * @param int $action_id WP Post ID of the action
 * @param string $action_type e.g. CREATE_PRODUCT
 * @param string $context JSON or text context
 * @param string $status e.g. proposed, executed, rejected
 */
function wac_bridge_log_action( $action_id, $action_type, $context, $status ) {
    global $wpdb;
    $table_name = $wpdb->prefix . 'wacopilote_logs';
    $user_id = get_current_user_id();
    
    $wpdb->insert(
        $table_name,
        array(
            'action_id'   => $action_id,
            'user_id'     => $user_id,
            'action_type' => $action_type,
            'context'     => $context,
            'status'      => $status,
            'created_at'  => current_time( 'mysql' )
        )
    );
}

// ─── 1b. Plugin Deactivation ──────────────────────────────────
register_deactivation_hook( __FILE__, 'wac_bridge_deactivate' );
function wac_bridge_deactivate() {
    flush_rewrite_rules();
}

// ─── 1c. Register staging CPT wa_ai_action ────────────────────
add_action( 'init', 'wac_bridge_register_action_cpt' );
function wac_bridge_register_action_cpt() {
    register_post_type( WAC_ACTION_CPT, array(
        'label'               => 'AI Actions',
        'public'              => false,
        'show_ui'             => false,
        'show_in_menu'        => false,
        'show_in_rest'        => false,
        'exclude_from_search' => true,
        'publicly_queryable'  => false,
        'capability_type'     => 'post',
        'supports'            => array( 'title', 'custom-fields' ),
    ) );

    // Custom statuses for the staging workflow
    register_post_status( 'pending_review', array(
        'label'                     => 'Pending Review',
        'public'                    => false,
        'exclude_from_search'       => true,
        'show_in_admin_all_list'    => false,
        'show_in_admin_status_list' => false,
    ) );
    register_post_status( 'wa_approved', array(
        'label'  => 'Approved',
        'public' => false,
    ) );
    register_post_status( 'wa_rejected', array(
        'label'  => 'Rejected',
        'public' => false,
    ) );
}

// ─── 1d. Admin Notice: warn when proposals are pending ────────
add_action( 'admin_notices', 'wac_bridge_admin_notice' );
function wac_bridge_admin_notice() {
    if ( ! current_user_can( 'manage_options' ) ) return;
    $count = wp_count_posts( WAC_ACTION_CPT );
    $pending = isset( $count->pending_review ) ? intval( $count->pending_review ) : 0;
    if ( $pending < 1 ) return;
    $url = admin_url( 'admin.php?page=wa-ai-actions' );
    echo '<div class="notice notice-warning"><p>';
    printf(
        __( '🤖 <strong>WaCopilote Bridge</strong> — <strong>%d</strong> proposition(s) de l\'agent IA en attente de validation. <a href="%s">Examiner maintenant →</a>', 'wacopilote-bridge' ),
        $pending, esc_url( $url )
    );
    echo '</p></div>';
}

// Note: Full cleanup (option removal) happens via uninstall.php
// when the admin clicks "Delete" in the plugin list.

// ─── 2. Admin Menus ───
add_action( 'admin_menu', 'wac_bridge_add_menu' );
function wac_bridge_add_menu() {
    // Settings page (under Settings)
    add_options_page(
        'WaCopilote Bridge',
        'WaCopilote Bridge',
        'manage_options',
        'wacopilote-bridge',
        'wac_bridge_settings_page'
    );
    // Review queue (top-level menu)
    add_menu_page(
        'AI Actions — WaCopilote',
        'AI Actions',
        'manage_options',
        'wa-ai-actions',
        'wac_bridge_actions_page',
        'dashicons-robot',
        30
    );
}

// ─── Settings Page ─────────────────────────────────────────
function wac_bridge_settings_page() {
    $site_url  = get_site_url();
    $agent_id  = get_option( 'wacopilote_bridge_agent_id' );
    $agent_login = $agent_id ? get_userdata( $agent_id )->user_login : 'wacopilote_agent_bot';
    ?>
    <div class="wrap">
        <h1>🤖 WaCopilote Bridge <span style="font-size:14px;background:#16a34a;color:#fff;padding:2px 10px;border-radius:20px;margin-left:8px">v<?php echo WAC_BRIDGE_VERSION; ?></span></h1>
        <p>Connectez WaCopilote à ce site via <strong>WordPress Application Passwords</strong> (intégré depuis WP 5.6).</p>

        <div style="background:#eff6ff;border-left:4px solid #3b82f6;padding:16px 20px;border-radius:4px;margin-bottom:24px">
            <h3 style="margin:0 0 12px">📋 Instructions de connexion</h3>
            <ol style="margin:0;padding-left:20px;line-height:2">
                <li>Dans WaCopilote, cliquez sur <strong>"+ Connecter le site"</strong>.</li>
                <li>Saisissez l'URL du site : <code style="background:#dbeafe;padding:2px 6px;border-radius:3px"><?php echo esc_html($site_url); ?></code></li>
                <li>Dans WordPress, allez dans <strong>Utilisateurs → Votre profil</strong>.</li>
                <li>Faites défiler jusqu'à <strong>"Mots de passe d'application"</strong>.</li>
                <li>Saisissez le nom <em>WaCopilote</em> et cliquez sur <strong>"Ajouter"</strong>.</li>
                <li>Copiez le mot de passe généré (format : <code>xxxx xxxx xxxx xxxx xxxx xxxx</code>).</li>
                <li>Dans WaCopilote, saisissez le login WordPress et le mot de passe d'application.</li>
            </ol>
        </div>

        <h2>🛡️ Rôle de l'Agent</h2>
        <p>L'agent WaCopilote utilise le compte utilisateur dont vous saisissez les identifiants. Assurez-vous que cet utilisateur a le rôle <strong>«&nbsp;Agent WaCopilote&nbsp;»</strong> qui lui donne uniquement le droit de soumettre des propositions (jamais d'écrire directement).</p>
        <?php
        // Quick role info
        global $wp_roles;
        if ( ! isset( $wp_roles ) ) { $wp_roles = new WP_Roles(); }
        $role_obj = get_role( 'wacopilote_agent_role' );
        if ( $role_obj ) {
            echo '<p>✅ Le rôle <strong>Agent WaCopilote</strong> est bien enregistré avec les capacités : <code>' . implode( ', ', array_keys( array_filter( $role_obj->capabilities ) ) ) . '</code></p>';
        } else {
            echo '<div class="notice notice-error inline"><p>❌ Le rôle "Agent WaCopilote" n\'est pas enregistré. Désactivez et réactivez le plugin.</p></div>';
        }
        ?>
    </div>
    <?php
}

// ─── 3. REST Auth Middleware (WP Application Passwords) ─────────────────────
/**
 * Verifies that the request is authenticated via WordPress Application Passwords
 * AND that the authenticated user has the required capability.
 *
 * How it works:
 *   - WaCopilote sends: Authorization: Basic base64(wp_username:app_password)
 *   - WordPress REST API validates it natively (no plugin code needed for that layer)
 *   - We then just check capabilities with current_user_can()
 *
 * @param string $capability  The WP capability to check (default: 'wacopilote_propose')
 * @return true|WP_Error
 */
function wac_bridge_require_cap( $capability = 'wacopilote_propose' ) {
    // The WP REST auth layer has already run and set wp_get_current_user().
    // If no valid Application Password was provided, current_user_id() returns 0.
    if ( ! is_user_logged_in() ) {
        return new WP_Error(
            'unauthorized',
            'Authentication required. Use WordPress Application Passwords (Basic Auth).',
            array( 'status' => 401 )
        );
    }
    if ( ! current_user_can( $capability ) ) {
        return new WP_Error(
            'forbidden',
            sprintf( 'Insufficient permissions. Required capability: %s', $capability ),
            array( 'status' => 403 )
        );
    }
    return true;
}

// ─── 4. Register REST Routes ───
add_action( 'rest_api_init', 'wac_bridge_register_routes' );
function wac_bridge_register_routes() {
    // Shorthand callbacks for permission checks
    $can_propose = function() { return wac_bridge_require_cap( 'wacopilote_propose' ); };
    $can_manage  = function() { return wac_bridge_require_cap( 'manage_options' ); };

    // ── Read-only endpoints (require wacopilote_propose) ────────────────────
    register_rest_route( WAC_BRIDGE_NAMESPACE, '/stats',        array( 'methods' => 'GET',  'callback' => 'wac_bridge_get_stats',        'permission_callback' => $can_propose ) );
    register_rest_route( WAC_BRIDGE_NAMESPACE, '/posts',        array( 'methods' => 'GET',  'callback' => 'wac_bridge_get_posts',        'permission_callback' => $can_propose ) );
    register_rest_route( WAC_BRIDGE_NAMESPACE, '/pages',        array( 'methods' => 'GET',  'callback' => 'wac_bridge_get_pages',        'permission_callback' => $can_propose ) );
    register_rest_route( WAC_BRIDGE_NAMESPACE, '/orders',       array( 'methods' => 'GET',  'callback' => 'wac_bridge_get_orders',       'permission_callback' => $can_propose ) );
    register_rest_route( WAC_BRIDGE_NAMESPACE, '/analytics',    array( 'methods' => 'GET',  'callback' => 'wac_bridge_get_analytics',    'permission_callback' => $can_propose ) );
    register_rest_route( WAC_BRIDGE_NAMESPACE, '/seo-meta',     array( 'methods' => 'GET',  'callback' => 'wac_bridge_get_seo_meta',     'permission_callback' => $can_propose ) );
    register_rest_route( WAC_BRIDGE_NAMESPACE, '/products/meta',array( 'methods' => 'GET',  'callback' => 'wac_bridge_get_products_meta','permission_callback' => $can_propose ) );
    register_rest_route( WAC_BRIDGE_NAMESPACE, '/products',     array( 'methods' => 'GET',  'callback' => 'wac_bridge_get_products',     'permission_callback' => $can_propose ) );
    register_rest_route( WAC_BRIDGE_NAMESPACE, '/actions',      array( 'methods' => 'GET',  'callback' => 'wac_bridge_list_actions',     'permission_callback' => $can_propose ) );
    register_rest_route( WAC_BRIDGE_NAMESPACE, '/logs',         array( 'methods' => 'GET',  'callback' => 'wac_bridge_get_logs',         'permission_callback' => $can_propose ) );

    // ── Proposal endpoint (wacopilote_propose) ──────────────────────────────
    register_rest_route( WAC_BRIDGE_NAMESPACE, '/propose',      array( 'methods' => 'POST', 'callback' => 'wac_bridge_propose_action',   'permission_callback' => $can_propose ) );

    // ── Media upload (upload_files cap, subset of wacopilote_propose role) ─
    register_rest_route( WAC_BRIDGE_NAMESPACE, '/media/upload', array( 'methods' => 'POST', 'callback' => 'wac_bridge_upload_media',     'permission_callback' => function() {
        if ( ! is_user_logged_in() ) return new WP_Error( 'unauthorized', 'Authentication required.', array( 'status' => 401 ) );
        return current_user_can( 'upload_files' ) ? true : new WP_Error( 'forbidden', 'upload_files capability required.', array( 'status' => 403 ) );
    }) );

    // ── Admin-only: approve / reject proposals (manage_options) ────────────
    register_rest_route( WAC_BRIDGE_NAMESPACE, '/execute/(?P<action_id>\d+)', array(
        array( 'methods' => 'POST',   'callback' => 'wac_bridge_execute_action', 'permission_callback' => $can_manage ),
        array( 'methods' => 'DELETE', 'callback' => 'wac_bridge_reject_action',  'permission_callback' => $can_manage ),
    ) );
}



// ─── 5. Endpoint Callbacks ───

/**
 * GET /stats — Global overview
 */
function wac_bridge_get_stats() {
    $stats = array(
        'site_name'     => get_bloginfo( 'name' ),
        'site_url'      => get_site_url(),
        'wp_version'    => get_bloginfo( 'version' ),
        'wac_version'   => WAC_BRIDGE_VERSION,
        'total_posts'   => wp_count_posts( 'post' )->publish,
        'total_pages'   => wp_count_posts( 'page' )->publish,
        'total_comments'=> get_comments( array( 'count' => true, 'status' => 'approve' ) ),
        'plugins'       => array(
            'woocommerce'   => class_exists( 'WooCommerce' ),
            'aio_seo'       => defined( 'AIOSEO_VERSION' ),
            'yoast_seo'     => defined( 'WPSEO_VERSION' ),
        ),
    );

    // WooCommerce stats
    if ( class_exists( 'WooCommerce' ) ) {
        $wc_products = wp_count_posts( 'product' );
        $stats['woocommerce'] = array(
            'total_products' => isset( $wc_products->publish ) ? intval( $wc_products->publish ) : 0,
            'total_orders'   => wc_orders_count( 'processing' ) + wc_orders_count( 'completed' ),
            'currency'       => get_woocommerce_currency_symbol(),
        );

        // Revenue this month
        $args = array(
            'status'   => array( 'wc-completed' ),
            'limit'    => -1,
            'date_created' => '>' . date( 'Y-m-01' ),
        );
        $orders = wc_get_orders( $args );
        $revenue = 0;
        foreach ( $orders as $order ) {
            $revenue += floatval( $order->get_total() );
        }
        $stats['woocommerce']['monthly_revenue'] = $revenue;
    }

    return rest_ensure_response( $stats );
}

/**
 * GET /posts — Latest blog posts
 */
function wac_bridge_get_posts( WP_REST_Request $request ) {
    $limit = intval( $request->get_param( 'limit' ) ) ?: 15;
    $paged = intval( $request->get_param( 'page' ) ) ?: 1;

    $query = new WP_Query( array(
        'post_type'      => 'post',
        'post_status'    => array( 'publish', 'draft' ),
        'posts_per_page' => $limit,
        'paged'          => $paged,
        'orderby'        => 'date',
        'order'          => 'DESC',
    ) );

    $posts = array();
    foreach ( $query->posts as $post ) {
        $posts[] = array(
            'id'           => $post->ID,
            'title'        => get_the_title( $post ),
            'status'       => $post->post_status,
            'url'          => get_permalink( $post ),
            'date'         => $post->post_date,
            'author'       => get_the_author_meta( 'display_name', $post->post_author ),
            'excerpt'      => wp_trim_words( $post->post_content, 25 ),
            'thumbnail'    => get_the_post_thumbnail_url( $post, 'thumbnail' ),
            'categories'   => wp_get_post_terms( $post->ID, 'category', array( 'fields' => 'names' ) ),
        );
    }

    return rest_ensure_response( array(
        'total' => $query->found_posts,
        'pages' => $query->max_num_pages,
        'data'  => $posts,
    ) );
}

/**
 * GET /pages
 */
function wac_bridge_get_pages( WP_REST_Request $request ) {
    $pages_raw = get_pages( array(
        'post_status' => array( 'publish', 'draft' ),
        'sort_column'  => 'post_date',
        'sort_order'   => 'DESC',
        'number'       => intval( $request->get_param( 'limit' ) ) ?: 20,
    ) );

    $pages = array();
    foreach ( $pages_raw as $page ) {
        $pages[] = array(
            'id'     => $page->ID,
            'title'  => get_the_title( $page ),
            'status' => $page->post_status,
            'url'    => get_permalink( $page ),
            'date'   => $page->post_date,
        );
    }

    return rest_ensure_response( array( 'data' => $pages, 'total' => count( $pages ) ) );
}

/**
 * GET /products — WooCommerce products with full pagination & filters
 */
function wac_bridge_get_products( WP_REST_Request $request ) {
    if ( ! class_exists( 'WooCommerce' ) ) {
        return new WP_Error( 'woocommerce_missing', 'WooCommerce is not installed.', array( 'status' => 404 ) );
    }

    $per_page     = min( intval( $request->get_param( 'per_page' ) ) ?: 25, 100 );
    $page         = max( intval( $request->get_param( 'page' ) ) ?: 1, 1 );
    $category     = sanitize_text_field( $request->get_param( 'category' ) );
    $type         = sanitize_text_field( $request->get_param( 'type' ) );
    $stock_status = sanitize_text_field( $request->get_param( 'stock_status' ) );
    $brand        = sanitize_text_field( $request->get_param( 'brand' ) );
    $search       = sanitize_text_field( $request->get_param( 'search' ) );

    // Build WP_Query args for accurate total count
    $query_args = array(
        'post_type'      => 'product',
        'post_status'    => array( 'publish', 'draft' ),
        'posts_per_page' => $per_page,
        'paged'          => $page,
        'orderby'        => 'date',
        'order'          => 'DESC',
    );

    // Tax query
    $tax_query = array();

    if ( ! empty( $category ) ) {
        $tax_query[] = array(
            'taxonomy' => 'product_cat',
            'field'    => 'slug',
            'terms'    => $category,
        );
    }

    // Brand taxonomy — supports pwb-brand and product_brand
    if ( ! empty( $brand ) ) {
        $brand_tax = taxonomy_exists( 'pwb-brand' ) ? 'pwb-brand' : ( taxonomy_exists( 'product_brand' ) ? 'product_brand' : '' );
        if ( $brand_tax ) {
            $tax_query[] = array(
                'taxonomy' => $brand_tax,
                'field'    => 'slug',
                'terms'    => $brand,
            );
        }
    }

    if ( ! empty( $type ) ) {
        $tax_query[] = array(
            'taxonomy' => 'product_type',
            'field'    => 'slug',
            'terms'    => $type,
        );
    }

    if ( ! empty( $tax_query ) ) {
        $tax_query['relation']   = 'AND';
        $query_args['tax_query'] = $tax_query;
    }

    // Meta query for stock status
    if ( ! empty( $stock_status ) ) {
        $query_args['meta_query'] = array(
            array(
                'key'   => '_stock_status',
                'value' => $stock_status,
            )
        );
    }

    // Search
    if ( ! empty( $search ) ) {
        $query_args['s'] = $search;
    }

    $query = new WP_Query( $query_args );

    // Brand taxonomy name
    $brand_tax_name = taxonomy_exists( 'pwb-brand' ) ? 'pwb-brand' : ( taxonomy_exists( 'product_brand' ) ? 'product_brand' : '' );

    $products = array();
    foreach ( $query->posts as $post ) {
        $product = wc_get_product( $post->ID );
        if ( ! $product ) continue;

        // Categories as array of names
        $cats_raw = get_the_terms( $post->ID, 'product_cat' );
        $cats = array();
        if ( $cats_raw && ! is_wp_error( $cats_raw ) ) {
            foreach ( $cats_raw as $cat ) {
                $cats[] = array( 'id' => $cat->term_id, 'name' => $cat->name, 'slug' => $cat->slug );
            }
        }

        // Brands
        $brands_arr = array();
        if ( $brand_tax_name ) {
            $brands_raw = get_the_terms( $post->ID, $brand_tax_name );
            if ( $brands_raw && ! is_wp_error( $brands_raw ) ) {
                foreach ( $brands_raw as $b ) {
                    $brands_arr[] = array( 'id' => $b->term_id, 'name' => $b->name, 'slug' => $b->slug );
                }
            }
        }

        $products[] = array(
            'id'                => $product->get_id(),
            'name'              => $product->get_name(),
            'status'            => $product->get_status(),
            'type'              => $product->get_type(),
            'price'             => $product->get_price(),
            'regular_price'     => $product->get_regular_price(),
            'sale_price'        => $product->get_sale_price(),
            'sku'               => $product->get_sku(),
            'description'       => $product->get_description(),
            'short_description' => $product->get_short_description(),
            'stock_quantity'    => $product->get_stock_quantity(),
            'stock_status'      => $product->get_stock_status(),
            'in_stock'          => $product->is_in_stock(),
            'url'               => get_permalink( $product->get_id() ),
            'thumbnail'         => wp_get_attachment_url( $product->get_image_id() ),
            'categories'        => $cats,
            'brands'            => $brands_arr,
        );
    }

    return rest_ensure_response( array(
        'data'         => $products,
        'total'        => (int) $query->found_posts,
        'pages'        => (int) $query->max_num_pages,
        'per_page'     => $per_page,
        'current_page' => $page,
    ) );
}

/**
 * GET /products/meta — Filter options (categories, brands, types)
 */
function wac_bridge_get_products_meta( WP_REST_Request $request ) {
    if ( ! class_exists( 'WooCommerce' ) ) {
        return new WP_Error( 'woocommerce_missing', 'WooCommerce is not installed.', array( 'status' => 404 ) );
    }

    // Categories
    $cats_raw = get_terms( array( 'taxonomy' => 'product_cat', 'hide_empty' => true, 'orderby' => 'name', 'order' => 'ASC' ) );
    $categories = array();
    if ( ! is_wp_error( $cats_raw ) ) {
        foreach ( $cats_raw as $t ) {
            $categories[] = array( 'id' => $t->term_id, 'name' => $t->name, 'slug' => $t->slug, 'count' => $t->count );
        }
    }

    // Brands
    $brand_tax = taxonomy_exists( 'pwb-brand' ) ? 'pwb-brand' : ( taxonomy_exists( 'product_brand' ) ? 'product_brand' : '' );
    $brands = array();
    if ( $brand_tax ) {
        $brands_raw = get_terms( array( 'taxonomy' => $brand_tax, 'hide_empty' => true, 'orderby' => 'name' ) );
        if ( ! is_wp_error( $brands_raw ) ) {
            foreach ( $brands_raw as $t ) {
                $brands[] = array( 'id' => $t->term_id, 'name' => $t->name, 'slug' => $t->slug, 'count' => $t->count );
            }
        }
    }

    // Product types present on this site
    $type_terms = get_terms( array( 'taxonomy' => 'product_type', 'hide_empty' => true ) );
    $types = array();
    if ( ! is_wp_error( $type_terms ) ) {
        $type_labels = array(
            'simple'   => 'Produit simple',
            'variable' => 'Produit variable',
            'grouped'  => 'Produits groupés',
            'external' => 'Produit externe/affiliation',
        );
        foreach ( $type_terms as $t ) {
            $types[] = array( 'slug' => $t->slug, 'name' => isset( $type_labels[$t->slug] ) ? $type_labels[$t->slug] : ucfirst( $t->slug ), 'count' => $t->count );
        }
    }

    return rest_ensure_response( array(
        'categories' => $categories,
        'brands'     => $brands,
        'types'      => $types,
    ) );
}

/**
 * GET /orders — WooCommerce orders
 */
function wac_bridge_get_orders( WP_REST_Request $request ) {
    if ( ! class_exists( 'WooCommerce' ) ) {
        return new WP_Error( 'woocommerce_missing', 'WooCommerce is not installed.', array( 'status' => 404 ) );
    }

    $limit  = intval( $request->get_param( 'limit' ) ) ?: 15;
    $status = $request->get_param( 'status' ) ?: array( 'wc-completed', 'wc-processing', 'wc-pending' );

    $orders_raw = wc_get_orders( array(
        'limit'   => $limit,
        'status'  => $status,
        'orderby' => 'date',
        'order'   => 'DESC',
    ) );

    $orders = array();
    foreach ( $orders_raw as $order ) {
        $orders[] = array(
            'id'           => $order->get_id(),
            'status'       => $order->get_status(),
            'total'        => $order->get_total(),
            'currency'     => $order->get_currency(),
            'date'         => $order->get_date_created() ? $order->get_date_created()->date( 'Y-m-d H:i:s' ) : null,
            'customer'     => $order->get_billing_first_name() . ' ' . $order->get_billing_last_name(),
            'customer_email'=> $order->get_billing_email(),
            'items_count'  => $order->get_item_count(),
            'admin_url'    => admin_url( 'post.php?post=' . $order->get_id() . '&action=edit' ),
        );
    }

    return rest_ensure_response( array( 'data' => $orders, 'total' => count( $orders ) ) );
}

/**
 * GET /seo-meta — Global SEO metadata
 */
function wac_bridge_get_seo_meta() {
    $meta = array(
        'site_title'       => get_bloginfo( 'name' ),
        'tagline'          => get_bloginfo( 'description' ),
    );

    // All in One SEO
    if ( defined( 'AIOSEO_VERSION' ) && function_exists( 'aioseo' ) ) {
        $aio_settings = aioseo()->options->searchAppearance;
        $meta['aio_seo'] = array(
            'version'               => AIOSEO_VERSION,
            'global_title_format'   => $aio_settings->global->siteTitle ?? null,
            'global_description'    => $aio_settings->global->metaDescription ?? null,
        );
    }

    // Yoast SEO
    if ( defined( 'WPSEO_VERSION' ) ) {
        $yoast_options = get_option( 'wpseo_titles' );
        $meta['yoast_seo'] = array(
            'version'           => WPSEO_VERSION,
            'separator'         => $yoast_options['separator'] ?? '-',
            'homepage_title'    => $yoast_options['title-home-wpseo'] ?? null,
            'homepage_desc'     => $yoast_options['metadesc-home-wpseo'] ?? null,
        );
    }

    return rest_ensure_response( $meta );
}

/**
 * GET /analytics — Detailed WooCommerce Analytics
 */
function wac_bridge_get_analytics( WP_REST_Request $request ) {
    if ( ! class_exists( 'WooCommerce' ) ) {
        return new WP_Error( 'woocommerce_missing', 'WooCommerce is not installed.', array( 'status' => 404 ) );
    }

    global $wpdb;
    
    // Default to current month
    $date_start = $request->get_param('date_start') ?: date('Y-m-01 00:00:00');
    $date_end   = $request->get_param('date_end')   ?: date('Y-m-t 23:59:59'); // t gives last day of month

    // Query WooCommerce stats table for totals
    $query = $wpdb->prepare("
        SELECT 
            SUM(num_items_sold) as products_sold,
            SUM(gross_total) as gross_sales,
            SUM(tax_total) as taxes,
            SUM(shipping_total) as shipping,
            SUM(net_total) as net_sales,
            SUM(total_sales) as total_sales,
            SUM(discount_amount) as coupons,
            COUNT(order_id) as orders_count
        FROM {$wpdb->prefix}wc_order_stats
        WHERE status IN ('wc-completed', 'wc-processing')
        AND date_created >= %s AND date_created <= %s
    ", $date_start, $date_end);

    $stats = $wpdb->get_row($query, ARRAY_A);

    if ( ! $stats || $stats['orders_count'] === null ) {
        $stats = array(
            'products_sold' => 0, 'gross_sales' => 0, 'taxes' => 0,
            'shipping' => 0, 'net_sales' => 0, 'total_sales' => 0,
            'coupons' => 0, 'orders_count' => 0
        );
    }
    
    // Format numeric values
    foreach ( $stats as $k => $v ) {
        $stats[$k] = in_array( $k, array('products_sold', 'orders_count') ) ? intval( $v ) : floatval( $v );
    }

    // Query for Chart Data
    $chart_query = $wpdb->prepare("
        SELECT 
            DATE(date_created) as date,
            SUM(net_total) as net_sales,
            COUNT(order_id) as orders_count,
            SUM(num_items_sold) as products_sold
        FROM {$wpdb->prefix}wc_order_stats
        WHERE status IN ('wc-completed', 'wc-processing')
        AND date_created >= %s AND date_created <= %s
        GROUP BY DATE(date_created)
        ORDER BY date ASC
    ", $date_start, $date_end);
    
    $chart_results = $wpdb->get_results($chart_query, ARRAY_A);
    $chart_data = array();
    foreach($chart_results as $row) {
        $chart_data[] = array(
            'date' => $row['date'],
            'net_sales' => floatval($row['net_sales']),
            'orders' => intval($row['orders_count']),
            'products_sold' => intval($row['products_sold'])
        );
    }
    
    $stats['chart_data'] = $chart_data;
    $stats['currency'] = get_woocommerce_currency_symbol();
    $stats['date_start'] = $date_start;
    $stats['date_end'] = $date_end;

    return rest_ensure_response( $stats );
}

// ─── HITL Governance Functions ──────────────────────────────────────────────

/**
 * POST /propose
 * Agent submits an intention. Stored in wa_ai_action CPT — nothing written to production.
 */
function wac_bridge_propose_action( WP_REST_Request $request ) {
    $entity_type = sanitize_text_field( $request->get_param('entity_type') ); // post|page|product
    $operation   = sanitize_text_field( $request->get_param('operation') );   // CREATE|UPDATE|DELETE
    $target_id   = intval( $request->get_param('target_id') ?: 0 );
    $payload     = $request->get_param('payload');
    $label       = sanitize_text_field( $request->get_param('label') ?: 'Sans titre' );

    if ( ! $entity_type || ! $operation ) {
        return new WP_Error( 'bad_request', 'entity_type and operation are required.', array( 'status' => 400 ) );
    }

    $allowed_ops = array( 'CREATE', 'UPDATE', 'DELETE' );
    if ( ! in_array( strtoupper( $operation ), $allowed_ops, true ) ) {
        return new WP_Error( 'bad_request', 'operation must be CREATE, UPDATE or DELETE.', array( 'status' => 400 ) );
    }

    // If UPDATE/DELETE, capture current state for diff display
    $before_state = null;
    if ( $target_id && in_array( $operation, array( 'UPDATE', 'DELETE' ), true ) ) {
        $post = get_post( $target_id );
        if ( $post ) {
            $before_state = array(
                'title'   => $post->post_title,
                'content' => wp_trim_words( $post->post_content, 80 ),
                'status'  => $post->post_status,
            );
        }
    }

    $action_data = array(
        'requested_at'  => gmdate( 'c' ),
        'agent'         => 'jarvis_wp',
        'entity_type'   => $entity_type,
        'operation'     => strtoupper( $operation ),
        'target_id'     => $target_id,
        'payload'       => $payload,
        'before_state'  => $before_state,
    );

    $post_id = wp_insert_post( array(
        'post_type'   => WAC_ACTION_CPT,
        'post_title'  => sprintf( '[%s] %s — %s', strtoupper($operation), $entity_type, $label ),
        'post_status' => 'pending_review',
        'meta_input'  => array(
            '_wac_action_data' => wp_json_encode( $action_data ),
            '_wac_entity_type' => $entity_type,
            '_wac_operation'   => strtoupper( $operation ),
            '_wac_target_id'   => $target_id,
        ),
    ) );

    if ( is_wp_error( $post_id ) ) {
        return $post_id;
    }

    // Phase 5: Log the proposal
    wac_bridge_log_action( $post_id, strtoupper( $operation ) . '_' . strtoupper( $entity_type ), wp_json_encode( $action_data ), 'PROPOSED' );

    return new WP_REST_Response( array(
        'status'    => 'success',
        'message'   => 'Proposal stored for human review.',
        'action_id' => $post_id,
    ), 201 );
}

/**
 * POST /execute/{action_id}  — Admin approves → executes the stored proposal
 */
function wac_bridge_execute_action( WP_REST_Request $request ) {
    $action_id = intval( $request->get_param('action_id') );
    $action_post = get_post( $action_id );

    if ( ! $action_post || $action_post->post_type !== WAC_ACTION_CPT ) {
        return new WP_Error( 'not_found', 'Action not found.', array( 'status' => 404 ) );
    }
    if ( $action_post->post_status !== 'pending_review' ) {
        return new WP_Error( 'conflict', 'Action is not pending review.', array( 'status' => 409 ) );
    }

    $raw = get_post_meta( $action_id, '_wac_action_data', true );
    $data = json_decode( $raw, true );
    if ( ! $data ) {
        return new WP_Error( 'corrupt_data', 'Could not decode action payload.', array( 'status' => 500 ) );
    }

    $operation   = $data['operation'];
    $entity_type = $data['entity_type'];
    $target_id   = intval( $data['target_id'] );
    $payload     = $data['payload'];
    $result_id   = null;
    $result_url  = null;

    // \u2500\u2500 Execute the action \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500
    if ( $operation === 'CREATE' ) {
        if ( in_array( $entity_type, array( 'post', 'page' ), true ) ) {
            $post_data = array(
                'post_type'    => $entity_type,
                'post_title'   => sanitize_text_field( $payload['title'] ?? '' ),
                'post_content' => wp_kses_post( $payload['content'] ?? '' ),
                'post_status'  => sanitize_text_field( $payload['status'] ?? 'draft' ),
                'post_author'  => get_current_user_id(),
            );
            if ( ! empty( $payload['excerpt'] ) ) $post_data['post_excerpt'] = sanitize_text_field( $payload['excerpt'] );
            $result_id = wp_insert_post( $post_data, true );
            if ( is_wp_error( $result_id ) ) { return $result_id; }

            // Attach image if provided
            if ( ! empty( $payload['featured_image_id'] ) ) {
                set_post_thumbnail( $result_id, intval( $payload['featured_image_id'] ) );
            }
            if ( ! empty( $payload['categories'] ) ) {
                wp_set_post_categories( $result_id, array_map( 'intval', (array) $payload['categories'] ) );
            }
            $result_url = get_permalink( $result_id );

        } elseif ( $entity_type === 'product' && class_exists( 'WooCommerce' ) ) {
            $type = sanitize_text_field( $payload['type'] ?? 'simple' );
            $product = $type === 'variable' ? new WC_Product_Variable() : new WC_Product_Simple();
            $product->set_name( sanitize_text_field( $payload['name'] ?? '' ) );
            $product->set_description( wp_kses_post( $payload['description'] ?? '' ) );
            if ( ! empty( $payload['short_description'] ) ) $product->set_short_description( wp_kses_post( $payload['short_description'] ) );
            if ( ! empty( $payload['regular_price'] ) )     $product->set_regular_price( sanitize_text_field( $payload['regular_price'] ) );
            if ( ! empty( $payload['sale_price'] ) )        $product->set_sale_price( sanitize_text_field( $payload['sale_price'] ) );
            if ( ! empty( $payload['sku'] ) )               $product->set_sku( sanitize_text_field( $payload['sku'] ) );
            if ( ! empty( $payload['stock_quantity'] ) )    { $product->set_manage_stock( true ); $product->set_stock_quantity( intval( $payload['stock_quantity'] ) ); }
            $product->set_status( sanitize_text_field( $payload['status'] ?? 'draft' ) );
            $result_id = $product->save();
            if ( ! empty( $payload['image_id'] ) ) { $product->set_image_id( intval( $payload['image_id'] ) ); $product->save(); }
            if ( ! empty( $payload['categories'] ) ) wp_set_object_terms( $result_id, array_map( 'intval', (array) $payload['categories'] ), 'product_cat' );
            $result_url = get_permalink( $result_id );
        } else {
            return new WP_Error( 'unsupported', 'Unsupported entity_type for CREATE.', array( 'status' => 400 ) );
        }

    } elseif ( $operation === 'UPDATE' ) {
        if ( ! $target_id ) return new WP_Error( 'missing_target', 'target_id required for UPDATE.', array( 'status' => 400 ) );
        if ( in_array( $entity_type, array( 'post', 'page' ), true ) ) {
            $update = array( 'ID' => $target_id );
            if ( isset( $payload['title'] ) )   $update['post_title']   = sanitize_text_field( $payload['title'] );
            if ( isset( $payload['content'] ) )  $update['post_content'] = wp_kses_post( $payload['content'] );
            if ( isset( $payload['status'] ) )   $update['post_status']  = sanitize_text_field( $payload['status'] );
            $result_id = wp_update_post( $update, true );
            if ( is_wp_error( $result_id ) ) return $result_id;
            if ( ! empty( $payload['featured_image_id'] ) ) set_post_thumbnail( $result_id, intval( $payload['featured_image_id'] ) );
            $result_url = get_permalink( $result_id );

        } elseif ( $entity_type === 'product' && class_exists( 'WooCommerce' ) ) {
            $product = wc_get_product( $target_id );
            if ( ! $product ) return new WP_Error( 'not_found', 'Product not found.', array( 'status' => 404 ) );
            if ( isset( $payload['name'] ) )          $product->set_name( sanitize_text_field( $payload['name'] ) );
            if ( isset( $payload['description'] ) )   $product->set_description( wp_kses_post( $payload['description'] ) );
            if ( isset( $payload['regular_price'] ) ) $product->set_regular_price( sanitize_text_field( $payload['regular_price'] ) );
            if ( isset( $payload['sale_price'] ) )    $product->set_sale_price( sanitize_text_field( $payload['sale_price'] ) );
            if ( isset( $payload['status'] ) )        $product->set_status( sanitize_text_field( $payload['status'] ) );
            $result_id  = $product->save();
            $result_url = get_permalink( $result_id );
        }

    } elseif ( $operation === 'DELETE' ) {
        if ( ! $target_id ) return new WP_Error( 'missing_target', 'target_id required for DELETE.', array( 'status' => 400 ) );
        $deleted = wp_delete_post( $target_id, true ); // force=true skips trash
        if ( ! $deleted ) return new WP_Error( 'delete_failed', 'Could not delete the post.', array( 'status' => 500 ) );
        $result_id = $target_id;
    }

    // Mark action as approved
    wp_update_post( array(
        'ID'          => $action_id,
        'post_status' => 'wa_approved',
        'meta_input'  => array(
            '_wac_approved_at'  => gmdate('c'),
            '_wac_approved_by'  => get_current_user_id(),
            '_wac_result_id'    => $result_id,
        ),
    ) );

    // Phase 5: Log the execution
    wac_bridge_log_action( $action_id, strtoupper( $operation ) . '_' . strtoupper( $entity_type ), "Result ID: $result_id", 'EXECUTED' );

    return rest_ensure_response( array(
        'status'     => 'success',
        'message'    => 'Action executed successfully.',
        'action_id'  => $action_id,
        'result_id'  => $result_id,
        'result_url' => $result_url,
    ) );
}

/**
 * DELETE /execute/{action_id}  — Admin rejects a proposal
 */
function wac_bridge_reject_action( WP_REST_Request $request ) {
    $action_id = intval( $request->get_param('action_id') );
    $post = get_post( $action_id );
    if ( ! $post || $post->post_type !== WAC_ACTION_CPT ) {
        return new WP_Error( 'not_found', 'Action not found.', array( 'status' => 404 ) );
    }
    wp_update_post( array(
        'ID'          => $action_id,
        'post_status' => 'wa_rejected',
        'meta_input'  => array(
            '_wac_rejected_at' => gmdate('c'),
            '_wac_rejected_by' => get_current_user_id(),
        ),
    ) );

    // Phase 5: Log the rejection
    $raw = get_post_meta( $action_id, '_wac_action_data', true );
    $data = json_decode( $raw, true );
    $operation = isset($data['operation']) ? $data['operation'] : 'UNKNOWN';
    $entity_type = isset($data['entity_type']) ? $data['entity_type'] : 'UNKNOWN';
    wac_bridge_log_action( $action_id, strtoupper( $operation ) . '_' . strtoupper( $entity_type ), 'Rejected by admin', 'REJECTED' );

    return rest_ensure_response( array( 'status' => 'success', 'message' => 'Action rejected.', 'action_id' => $action_id ) );
}

/**
 * GET /actions  — List pending proposals (for frontend polling)
 */
function wac_bridge_list_actions( WP_REST_Request $request ) {
    $status = sanitize_text_field( $request->get_param('status') ?: 'pending_review' );
    $query  = new WP_Query( array(
        'post_type'      => WAC_ACTION_CPT,
        'post_status'    => $status,
        'posts_per_page' => 50,
        'orderby'        => 'date',
        'order'          => 'DESC',
    ) );

    $actions = array();
    foreach ( $query->posts as $p ) {
        $raw  = get_post_meta( $p->ID, '_wac_action_data', true );
        $data = json_decode( $raw, true ) ?: array();
        $actions[] = array(
            'action_id'     => $p->ID,
            'title'         => $p->post_title,
            'status'        => $p->post_status,
            'requested_at'  => $p->post_date_gmt,
            'entity_type'   => $data['entity_type'] ?? null,
            'operation'     => $data['operation'] ?? null,
            'target_id'     => $data['target_id'] ?? null,
            'before_state'  => $data['before_state'] ?? null,
            'payload_preview' => isset($data['payload']) ? array_intersect_key(
                (array)$data['payload'],
                array_flip(['title','name','description','regular_price','status'])
            ) : null,
        );
    }
    return rest_ensure_response( array( 'total' => $query->found_posts, 'data' => $actions ) );
}

/**
 * POST /media/upload  — Upload image or file to WordPress Media Library
 * Expects multipart/form-data with field 'file'. Optional: 'post_id' to attach.
 */
function wac_bridge_upload_media( WP_REST_Request $request ) {
    require_once ABSPATH . 'wp-admin/includes/file.php';
    require_once ABSPATH . 'wp-admin/includes/image.php';
    require_once ABSPATH . 'wp-admin/includes/media.php';

    $files = $request->get_file_params();
    if ( empty( $files['file'] ) ) {
        return new WP_Error( 'no_file', 'No file uploaded. Use multipart/form-data with field "file".', array( 'status' => 400 ) );
    }

    $post_id  = intval( $request->get_param('post_id') ?: 0 );
    $title    = sanitize_text_field( $request->get_param('title') ?: '' );

    // Use WordPress media handler
    $attachment_id = media_handle_upload( 'file', $post_id );

    if ( is_wp_error( $attachment_id ) ) {
        return $attachment_id;
    }

    if ( $title ) {
        wp_update_post( array( 'ID' => $attachment_id, 'post_title' => $title ) );
    }

    $url      = wp_get_attachment_url( $attachment_id );
    $metadata = wp_get_attachment_metadata( $attachment_id );

    return rest_ensure_response( array(
        'status'        => 'success',
        'attachment_id' => $attachment_id,
        'url'           => $url,
        'width'         => $metadata['width'] ?? null,
        'height'        => $metadata['height'] ?? null,
        'mime_type'     => get_post_mime_type( $attachment_id ),
    ) );
}

// ─── Admin Review Page (AI Actions Queue) ─────────────────────────────────
function wac_bridge_actions_page() {
    // Handle approve/reject via admin POST
    if ( isset( $_POST['wac_action'], $_POST['action_id'], $_POST['_wpnonce'] ) ) {
        $nonce_ok = wp_verify_nonce( sanitize_text_field( wp_unslash( $_POST['_wpnonce'] ) ), 'wac_action_' . intval( $_POST['action_id'] ) );
        if ( $nonce_ok && current_user_can( 'manage_options' ) ) {
            $action_id = intval( $_POST['action_id'] );
            if ( $_POST['wac_action'] === 'approve' ) {
                $fake_request = new WP_REST_Request();
                $fake_request->set_param( 'action_id', $action_id );
                $result = wac_bridge_execute_action( $fake_request );
                $msg = is_wp_error( $result ) ? '❌ Erreur : ' . $result->get_error_message() : '✅ Action exécutée avec succès.';
            } else {
                wp_update_post( array( 'ID' => $action_id, 'post_status' => 'wa_rejected', 'meta_input' => array( '_wac_rejected_by' => get_current_user_id() ) ) );
                $msg = '🚫 Proposition rejetée.';
            }
            echo '<div class="notice notice-' . ( strpos($msg, '✅') !== false ? 'success' : 'error' ) . ' is-dismissible"><p>' . esc_html( $msg ) . '</p></div>';
        }
    }

    // Load pending actions
    $query = new WP_Query( array(
        'post_type'      => WAC_ACTION_CPT,
        'post_status'    => array( 'pending_review', 'wa_approved', 'wa_rejected' ),
        'posts_per_page' => 30,
        'orderby'        => 'date',
        'order'          => 'DESC',
    ) );

    echo '<div class="wrap">';
    echo '<h1>🤖 WaCopilote — File d\'approbation des actions IA</h1>';
    echo '<p>Chaque ligne représente une intention de l\'agent IA. <strong>Aucune modification n\'est appliquée sans votre approbation.</strong></p>';

    if ( $query->found_posts === 0 ) {
        echo '<p>✅ Aucune proposition en attente.</p></div>';
        return;
    }

    echo '<table class="wp-list-table widefat fixed striped" style="margin-top:16px">';
    echo '<thead><tr>
        <th>Date</th><th>Opération</th><th>Type</th><th>Titre / Cible</th>
        <th>Aperçu</th><th>Statut</th><th>Actions</th>
    </tr></thead><tbody>';

    $op_colors = array( 'CREATE' => '#16a34a', 'UPDATE' => '#d97706', 'DELETE' => '#dc2626' );
    $status_labels = array(
        'pending_review' => '<span style="background:#fef9c3;color:#854d0e;padding:2px 8px;border-radius:4px;font-size:11px">⏳ En attente</span>',
        'wa_approved'    => '<span style="background:#dcfce7;color:#166534;padding:2px 8px;border-radius:4px;font-size:11px">✅ Approuvé</span>',
        'wa_rejected'    => '<span style="background:#fee2e2;color:#991b1b;padding:2px 8px;border-radius:4px;font-size:11px">🚫 Rejeté</span>',
    );

    foreach ( $query->posts as $p ) {
        $raw     = get_post_meta( $p->ID, '_wac_action_data', true );
        $d       = json_decode( $raw, true ) ?: array();
        $op      = $d['operation'] ?? '?';
        $color   = $op_colors[ $op ] ?? '#64748b';
        $preview = '';
        if ( ! empty( $d['payload'] ) ) {
            foreach ( array('title','name','regular_price','sku','status') as $k ) {
                if ( isset( $d['payload'][$k] ) ) $preview .= "<b>$k:</b> " . esc_html( $d['payload'][$k] ) . '<br>';
            }
        }
        $before = '';
        if ( ! empty( $d['before_state'] ) ) {
            $before = '<details style="margin-top:4px"><summary style="cursor:pointer;font-size:11px;color:#64748b">Voir état actuel</summary>';
            foreach ( $d['before_state'] as $k => $v ) {
                $before .= '<span style="display:block;font-size:11px"><b>' . esc_html($k) . ':</b> ' . esc_html( substr($v,0,80) ) . '</span>';
            }
            $before .= '</details>';
        }
        $nonce    = wp_create_nonce( 'wac_action_' . $p->ID );
        $form_url = admin_url( 'admin.php?page=wa-ai-actions' );
        $actions_html = '';
        if ( $p->post_status === 'pending_review' ) {
            $actions_html = '
            <form method="post" action="' . esc_url($form_url) . '" style="display:inline">
                ' . wp_nonce_field( 'wac_action_' . $p->ID, '_wpnonce', true, false ) . '
                <input type="hidden" name="action_id" value="' . $p->ID . '">
                <input type="hidden" name="wac_action" value="approve">
                <button type="submit" class="button button-primary" onclick="return confirm(\'Exécuter cette action en base de données ?\')">✅ Approuver</button>
            </form>
            <form method="post" action="' . esc_url($form_url) . '" style="display:inline;margin-left:6px">
                ' . wp_nonce_field( 'wac_action_' . $p->ID, '_wpnonce', true, false ) . '
                <input type="hidden" name="action_id" value="' . $p->ID . '">
                <input type="hidden" name="wac_action" value="reject">
                <button type="submit" class="button">🚫 Rejeter</button>
            </form>';
        }
        $date = date_i18n( 'd/m/Y H:i', strtotime( $p->post_date ) );
        echo '<tr>';
        echo '<td style="font-size:12px;color:#64748b">' . esc_html($date) . '</td>';
        echo '<td><span style="background:' . esc_attr($color) . ';color:#fff;padding:2px 8px;border-radius:4px;font-size:12px;font-weight:700">' . esc_html($op) . '</span></td>';
        echo '<td>' . esc_html( $d['entity_type'] ?? '?' ) . ( $d['target_id'] ? ' <span style="color:#94a3b8">#' . intval($d['target_id']) . '</span>' : '' ) . '</td>';
        echo '<td>' . esc_html( $p->post_title ) . '</td>';
        echo '<td style="font-size:12px">' . wp_kses_post( $preview . $before ) . '</td>';
        echo '<td>' . wp_kses_post( $status_labels[ $p->post_status ] ?? $p->post_status ) . '</td>';
        echo '<td>' . $actions_html . '</td>';
        echo '</tr>';
    }
    echo '</tbody></table></div>';
}

// ─── 10. Endpoints d'écriture directe retirés ───────────────────────────────
// Les callbacks « legacy » d'écriture directe (create_post / create_product) ont
// été supprimés : ils n'étaient enregistrés sur aucune route REST et contredisaient
// la gouvernance HITL du pont. Toute mutation passe par /propose (pending_review)
// puis /execute/{action_id} après approbation administrateur.

/**
 * GET /logs  — List audit logs from wp_wacopilote_logs
 */
function wac_bridge_get_logs( WP_REST_Request $request ) {
    global $wpdb;
    $table_name = $wpdb->prefix . 'wacopilote_logs';
    $limit = intval( $request->get_param('limit') ?: 50 );
    $offset = intval( $request->get_param('offset') ?: 0 );
    $status = sanitize_text_field( $request->get_param('status') );

    $where_clause = "";
    $query_args = array();

    if ( ! empty( $status ) ) {
        $where_clause = "WHERE status = %s";
        $query_args[] = $status;
    }

    $query_args[] = $limit;
    $query_args[] = $offset;

    // Count total records for pagination
    $count_query = "SELECT COUNT(*) FROM $table_name $where_clause";
    if ( ! empty( $status ) ) {
        $total = $wpdb->get_var( $wpdb->prepare( $count_query, $status ) );
    } else {
        $total = $wpdb->get_var( $count_query );
    }

    $query = $wpdb->prepare( "SELECT * FROM $table_name $where_clause ORDER BY created_at DESC LIMIT %d OFFSET %d", ...$query_args );
    $results = $wpdb->get_results( $query, ARRAY_A );

    // If table doesn't exist yet, return empty
    if ( $wpdb->last_error ) {
        $results = array();
        $total = 0;
    }

    $total_pages = $limit > 0 ? ceil( $total / $limit ) : 1;

    return rest_ensure_response( array(
        'status' => 'success',
        'data'   => $results,
        'pagination' => array(
            'total'        => intval( $total ),
            'pages'        => intval( $total_pages ),
            'current_page' => ( $offset / $limit ) + 1,
            'per_page'     => $limit
        )
    ) );
}
