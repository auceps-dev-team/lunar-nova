<?php
/**
 * Plugin Name:       WaCopilote Bridge
 * Plugin URI:        https://auceps-digital.com/wacopilote
 * Description:       Connects your WordPress site to WaCopilote. Exposes a secure REST API for reading site data (posts, WooCommerce orders, SEO stats).
 * Version:           1.0.5
 * Author:            AUCEPS Digital
 * License:           GPL v2 or later
 * Text Domain:       wacopilote-bridge
 */

if ( ! defined( 'ABSPATH' ) ) {
    exit;
}

define( 'WAC_BRIDGE_VERSION', '1.0.4' );
define( 'WAC_BRIDGE_TOKEN_KEY', 'wacopilote_bridge_token' );
define( 'WAC_BRIDGE_NAMESPACE', 'wacopilote/v1' );

// ─── 1. Plugin Activation: Generate a unique security token & Create Agent ───
register_activation_hook( __FILE__, 'wac_bridge_activate' );
function wac_bridge_activate() {
    if ( ! get_option( WAC_BRIDGE_TOKEN_KEY ) ) {
        $token = bin2hex( random_bytes( 32 ) );
        update_option( WAC_BRIDGE_TOKEN_KEY, $token );
    }

    // 1. Create a custom role with mixed capabilities (Blog + WooCommerce)
    add_role(
        'wacopilote_agent_role',
        'Agent WaCopilote (Mixte)',
        array(
            'read'                   => true,
            'edit_posts'             => true,
            'publish_posts'          => true,
            'edit_published_posts'   => true,
            'upload_files'           => true,
            'edit_products'          => true,
            'publish_products'       => true,
            'edit_published_products'=> true,
            'read_private_products'  => true,
        )
    );

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
}

// ─── 1b. Plugin Deactivation: flush rewrite rules ─────────────
register_deactivation_hook( __FILE__, 'wac_bridge_deactivate' );
function wac_bridge_deactivate() {
    // Unregister routes are removed automatically on deactivation.
    // Token is preserved so the user can re-activate without reconfiguring.
    flush_rewrite_rules();
}

// Note: Full cleanup (option removal) happens via uninstall.php
// when the admin clicks "Delete" in the plugin list.

// ─── 2. Add Admin Settings Page ───
add_action( 'admin_menu', 'wac_bridge_add_menu' );
function wac_bridge_add_menu() {
    add_options_page(
        'WaCopilote Bridge',
        'WaCopilote Bridge',
        'manage_options',
        'wacopilote-bridge',
        'wac_bridge_settings_page'
    );
}

function wac_bridge_settings_page() {
    $token = get_option( WAC_BRIDGE_TOKEN_KEY, 'Non généré' );
    $site_url = get_site_url();
    ?>
    <div class="wrap">
        <h1>🤖 WaCopilote Bridge</h1>
        <p>Copiez ces informations dans WaCopilote pour connecter votre site.</p>
        <table class="form-table">
            <tr>
                <th scope="row">URL du site</th>
                <td>
                    <input type="text" readonly value="<?php echo esc_attr( $site_url ); ?>" class="regular-text" onclick="this.select();" />
                </td>
            </tr>
            <tr>
                <th scope="row">Token de sécurité</th>
                <td>
                    <input type="text" readonly value="<?php echo esc_attr( $token ); ?>" class="regular-text" onclick="this.select();" />
                    <p class="description">⚠️ Ne partagez ce token avec personne. Il donne accès en lecture à votre site.</p>
                </td>
            </tr>
        </table>
        </table>

        <hr style="margin: 30px 0;" />
        <h2>🛡️ Sécurité & Droits d'Accès</h2>
        <p>WaCopilote se connecte à ce site via un robot ("Agent"). Choisissez quelles autorisations WordPress lui accorder :</p>
        <?php
        // Prepare roles list
        global $wp_roles;
        if ( ! isset( $wp_roles ) ) {
            $wp_roles = new WP_Roles();
        }
        $all_roles = $wp_roles->roles;
        $agent_id = get_option('wacopilote_bridge_agent_id');
        $current_agent_role = '';
        if ($agent_id) {
            $user_info = get_userdata($agent_id);
            if ($user_info && !empty($user_info->roles)) {
                $current_agent_role = $user_info->roles[0];
            }
        }
        ?>
        <form method="post" action="">
            <table class="form-table">
                <tr>
                    <th scope="row">Niveau d'accès du Bot</th>
                    <td>
                        <select name="wac_agent_role">
                            <?php foreach ( $all_roles as $role_key => $role_details ) : ?>
                                <option value="<?php echo esc_attr( $role_key ); ?>" <?php selected( $current_agent_role, $role_key ); ?>>
                                    <?php echo esc_html( translate_user_role( $role_details['name'] ) ); ?>
                                </option>
                            <?php endforeach; ?>
                        </select>
                        <p class="description">Le rôle par défaut "Agent WaCopilote" le limite à l'édition d'articles et de produits. Vous pouvez le restreindre à "Auteur" si vous le souhaitez, empêchant WaCopilote de toucher à la boutique.</p>
                    </td>
                </tr>
            </table>
            <p>
                <input type="submit" name="wac_regen_role" class="button button-primary" value="Enregistrer le rôle de l'Agent" />
            </p>
        </form>

        <hr style="margin: 30px 0;" />

        <p>
            <a href="<?php echo esc_url( admin_url( 'options-general.php?page=wacopilote-bridge&regen=1' ) ); ?>" class="button button-secondary" onclick="return confirm('Régénérer le token invalidera la connexion existante. Confirmer ?');">
                🔄 Régénérer le token
            </a>
        </p>
        <?php
        // Handle token regeneration
        if ( isset( $_GET['regen'] ) && current_user_can( 'manage_options' ) ) {
            $new_token = bin2hex( random_bytes( 32 ) );
            update_option( WAC_BRIDGE_TOKEN_KEY, $new_token );
            echo '<div class="notice notice-success"><p>Token régénéré avec succès.</p></div>';
        }

        // Handle role update
        if ( isset( $_POST['wac_regen_role'] ) && isset($_POST['wac_agent_role']) && current_user_can( 'manage_options' ) ) {
            $selected_role = sanitize_text_field($_POST['wac_agent_role']);
            if ($agent_id) {
                $user = new WP_User($agent_id);
                $user->set_role($selected_role);
                echo '<div class="notice notice-success"><p>Le rôle de l\'Agent WaCopilote a bien été mis à jour dans WordPress.</p></div>';
                // Refresh role display
                echo '<script>window.location.href = window.location.href;</script>';
            }
        }
        ?>
    </div>
    <?php
}

// ─── 3. Token Authentication Middleware ───
function wac_bridge_authenticate( WP_REST_Request $request ) {
    $stored_token = get_option( WAC_BRIDGE_TOKEN_KEY, '' );
    $auth_header  = $request->get_header( 'Authorization' );

    if ( empty( $auth_header ) || ! $stored_token ) {
        return new WP_Error( 'unauthorized', 'Missing or invalid token.', array( 'status' => 401 ) );
    }

    // Format: "Bearer <token>"
    $parts = explode( ' ', $auth_header, 2 );
    if ( count( $parts ) !== 2 || strtolower( $parts[0] ) !== 'bearer' ) {
        return new WP_Error( 'unauthorized', 'Invalid Authorization header format.', array( 'status' => 401 ) );
    }

    $provided_token = trim( $parts[1] );
    if ( ! hash_equals( $stored_token, $provided_token ) ) {
        return new WP_Error( 'forbidden', 'Invalid token.', array( 'status' => 403 ) );
    }

    // Authenticate successfully & Set WordPress Execution Identity to our Agent Bot.
    $agent_id = get_option('wacopilote_bridge_agent_id');
    if ( $agent_id ) {
        wp_set_current_user( $agent_id );
    }

    return true;
}

// ─── 4. Register REST Routes ───
add_action( 'rest_api_init', 'wac_bridge_register_routes' );
function wac_bridge_register_routes() {
    $auth = 'wac_bridge_authenticate';

    // Global site stats
    register_rest_route( WAC_BRIDGE_NAMESPACE, '/stats', array(
        'methods'             => 'GET',
        'callback'            => 'wac_bridge_get_stats',
        'permission_callback' => $auth,
    ) );

    // Latest posts (GET + POST)
    register_rest_route( WAC_BRIDGE_NAMESPACE, '/posts', array(
        array(
            'methods'             => 'GET',
            'callback'            => 'wac_bridge_get_posts',
            'permission_callback' => $auth,
        ),
        array(
            'methods'             => 'POST',
            'callback'            => 'wac_bridge_create_post',
            'permission_callback' => $auth,
        )
    ) );

    // Pages
    register_rest_route( WAC_BRIDGE_NAMESPACE, '/pages', array(
        'methods'             => 'GET',
        'callback'            => 'wac_bridge_get_pages',
        'permission_callback' => $auth,
    ) );

    // WooCommerce products (GET + POST)
    register_rest_route( WAC_BRIDGE_NAMESPACE, '/products', array(
        array(
            'methods'             => 'GET',
            'callback'            => 'wac_bridge_get_products',
            'permission_callback' => $auth,
        ),
        array(
            'methods'             => 'POST',
            'callback'            => 'wac_bridge_create_product',
            'permission_callback' => $auth,
        )
    ) );

    // WooCommerce products meta (filter options)
    register_rest_route( WAC_BRIDGE_NAMESPACE, '/products/meta', array(
        'methods'             => 'GET',
        'callback'            => 'wac_bridge_get_products_meta',
        'permission_callback' => $auth,
    ) );

    // WooCommerce Analytics
    register_rest_route( WAC_BRIDGE_NAMESPACE, '/analytics', array(
        'methods'             => 'GET',
        'callback'            => 'wac_bridge_get_analytics',
        'permission_callback' => $auth,
    ) );

    // WooCommerce orders
    register_rest_route( WAC_BRIDGE_NAMESPACE, '/orders', array(
        'methods'             => 'GET',
        'callback'            => 'wac_bridge_get_orders',
        'permission_callback' => $auth,
    ) );

    // SEO meta (All in One SEO / Yoast)
    register_rest_route( WAC_BRIDGE_NAMESPACE, '/seo-meta', array(
        'methods'             => 'GET',
        'callback'            => 'wac_bridge_get_seo_meta',
        'permission_callback' => $auth,
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

// ─── 10. POST Endpoints (Create Content) ───

function wac_bridge_create_post( WP_REST_Request $request ) {
    if ( ! current_user_can( 'publish_posts' ) ) {
        return new WP_Error( 'forbidden', 'You do not have permission to publish posts.', array( 'status' => 403 ) );
    }

    $title   = sanitize_text_field( $request->get_param( 'title' ) );
    $content = wp_kses_post( $request->get_param( 'content' ) );
    $status  = sanitize_text_field( $request->get_param( 'status' ) ?: 'draft' );

    $post_id = wp_insert_post( array(
        'post_title'   => $title,
        'post_content' => $content,
        'post_status'  => $status,
        'post_author'  => get_current_user_id()
    ) );

    if ( is_wp_error( $post_id ) ) {
        return $post_id;
    }

    return rest_ensure_response( array(
        'message' => 'Post created successfully.',
        'post_id' => $post_id,
        'url'     => get_permalink( $post_id )
    ) );
}

function wac_bridge_create_product( WP_REST_Request $request ) {
    if ( ! current_user_can( 'publish_products' ) && ! current_user_can( 'edit_products' ) ) {
        return new WP_Error( 'forbidden', 'You do not have permission to publish products.', array( 'status' => 403 ) );
    }

    if ( ! class_exists( 'WooCommerce' ) ) {
        return new WP_Error( 'woocommerce_missing', 'WooCommerce is not installed.', array( 'status' => 400 ) );
    }

    try {
        $product = new WC_Product_Simple();
        $product->set_name( sanitize_text_field( $request->get_param( 'name' ) ) );
        $product->set_description( wp_kses_post( $request->get_param( 'description' ) ) );
        if ( $request->get_param( 'short_description' ) ) {
            $product->set_short_description( wp_kses_post( $request->get_param( 'short_description' ) ) );
        }
        if ( $request->get_param( 'regular_price' ) ) {
            $product->set_regular_price( sanitize_text_field( $request->get_param( 'regular_price' ) ) );
        }
        $product->set_status( sanitize_text_field( $request->get_param( 'status' ) ?: 'draft' ) );
        
        $product_id = $product->save();

        return rest_ensure_response( array(
            'message'    => 'Product created successfully.',
            'product_id' => $product_id,
            'url'        => get_permalink( $product_id )
        ) );
    } catch ( Exception $e ) {
        return new WP_Error( 'creation_failed', $e->getMessage(), array( 'status' => 500 ) );
    }
}
