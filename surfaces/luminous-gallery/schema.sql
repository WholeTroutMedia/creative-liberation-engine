-- Luminous Gallery Sovereign Order Logging & Cryptographic Verification Database Schema
-- Target: PostgreSQL 14+
-- Location: Y:\creative-liberation-engine\surfaces\luminous-gallery\schema.sql

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

CREATE SCHEMA IF NOT EXISTS luminous_gallery;

-- -----------------------------------------------------------------------------
-- ENUMS
-- -----------------------------------------------------------------------------
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'order_status') THEN
        CREATE TYPE order_status AS ENUM (
            'pending_payment',
            'paid',
            'printing',
            'framed',
            'packaged',
            'shipped',
            'delivered',
            'cancelled',
            'refunded'
        );
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'payment_status') THEN
        CREATE TYPE payment_status AS ENUM (
            'requires_payment_method',
            'requires_confirmation',
            'requires_action',
            'processing',
            'requires_capture',
            'succeeded',
            'canceled',
            'failed'
        );
    END IF;
END$$;

-- -----------------------------------------------------------------------------
-- TABLES
-- -----------------------------------------------------------------------------

-- Table: luminous_gallery.editions
-- Holds the metadata for limited edition prints.
CREATE TABLE IF NOT EXISTS luminous_gallery.editions (
    edition_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    artwork_title VARCHAR(255) NOT NULL,
    artist_name VARCHAR(255) NOT NULL,
    total_editions INTEGER NOT NULL CHECK (total_editions > 0),
    base_price_cents INTEGER NOT NULL CHECK (base_price_cents >= 0),
    token_uri VARCHAR(512), -- Metadata pointer (IPFS/Arweave/HTTPS)
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Table: luminous_gallery.orders
-- Records customer print orders, shipping details, and payment metrics.
CREATE TABLE IF NOT EXISTS luminous_gallery.orders (
    order_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    customer_email VARCHAR(255) NOT NULL,
    customer_name VARCHAR(255) NOT NULL,
    
    -- Print Specification Fields
    edition_id UUID REFERENCES luminous_gallery.editions(edition_id),
    print_title VARCHAR(255) NOT NULL,
    print_dimensions VARCHAR(50) NOT NULL, -- e.g., '24x36', '40x60'
    print_finish VARCHAR(100) NOT NULL, -- e.g., 'acrylic_glass', 'matte_fine_art'
    print_frame_style VARCHAR(100), -- e.g., 'oak_wood', 'black_aluminum', 'frameless'
    print_paper_type VARCHAR(100), -- e.g., 'hahnemuehle_photo_rag'
    
    -- Shipping Details (JSONB matching exact shipping schema)
    shipping_details JSONB NOT NULL,
    -- JSONB Schema expectation:
    -- {
    --   "carrier": "FEDEX" | "DHL" | "UPS",
    --   "tracking_number": "string",
    --   "address": {
    --     "line1": "string",
    --     "line2": "string",
    --     "city": "string",
    --     "state": "string",
    --     "postal_code": "string",
    --     "country": "string"
    --   }
    -- }
    
    -- Stripe Charge & Payment Status
    stripe_session_id VARCHAR(255),
    stripe_payment_intent_id VARCHAR(255) UNIQUE,
    stripe_charge_id VARCHAR(255) UNIQUE,
    amount_cents INTEGER NOT NULL CHECK (amount_cents >= 0),
    currency VARCHAR(3) DEFAULT 'USD' NOT NULL,
    order_status order_status DEFAULT 'pending_payment'::order_status NOT NULL,
    payment_status payment_status DEFAULT 'requires_payment_method'::payment_status NOT NULL,
    
    -- Timestamps
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Table: luminous_gallery.nfc_tag_verifications
-- Cryptographic hardware-anchored authentication details for each physical print.
CREATE TABLE IF NOT EXISTS luminous_gallery.nfc_tag_verifications (
    verification_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    order_id UUID REFERENCES luminous_gallery.orders(order_id) ON DELETE SET NULL,
    edition_id UUID NOT NULL REFERENCES luminous_gallery.editions(edition_id),
    edition_number INTEGER NOT NULL CHECK (edition_number > 0),
    
    -- NFC Hardware Anchors
    nfc_uid VARCHAR(64) UNIQUE NOT NULL, -- Unique NFC Chip UID
    nfc_hash VARCHAR(64) UNIQUE NOT NULL, -- SHA-256 hash representing target verification URL
    
    -- Cryptographic Signatures
    tag_signature TEXT NOT NULL, -- ECDSA/Ed25519 signature of the chip's private key
    verification_public_key TEXT NOT NULL, -- Public key mapping to the chip
    cryptographic_proof JSONB NOT NULL, -- Full verification cryptographic audit trail (e.g., payload, r, s, v)
    
    -- Verification metrics
    scan_count INTEGER DEFAULT 0 NOT NULL,
    last_scanned_at TIMESTAMP WITH TIME ZONE,
    minted_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    
    -- Constraints
    UNIQUE (edition_id, edition_number)
);

-- Table: luminous_gallery.nfc_scan_logs
-- Audit log of NFC scan requests.
CREATE TABLE IF NOT EXISTS luminous_gallery.nfc_scan_logs (
    log_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    nfc_uid VARCHAR(64) REFERENCES luminous_gallery.nfc_tag_verifications(nfc_uid) ON DELETE CASCADE,
    client_ip VARCHAR(45),
    user_agent TEXT,
    is_signature_valid BOOLEAN NOT NULL,
    scan_payload JSONB,
    scanned_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Table: luminous_gallery.order_audit_trail
-- Complete structural state-history logging for order status tracking.
CREATE TABLE IF NOT EXISTS luminous_gallery.order_audit_trail (
    trail_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    order_id UUID REFERENCES luminous_gallery.orders(order_id) ON DELETE CASCADE,
    previous_status order_status,
    new_status order_status NOT NULL,
    changed_by VARCHAR(255) NOT NULL, -- 'SYSTEM', 'STRIPE_WEBHOOK', 'OPERATOR_ID'
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- -----------------------------------------------------------------------------
-- INDEXES FOR MAXIMUM INGRESS AND QUERY PERFORMANCE
-- -----------------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_orders_customer_email ON luminous_gallery.orders(customer_email);
CREATE INDEX IF NOT EXISTS idx_orders_status ON luminous_gallery.orders(order_status);
CREATE INDEX IF NOT EXISTS idx_orders_stripe_payment_intent ON luminous_gallery.orders(stripe_payment_intent_id);
CREATE INDEX IF NOT EXISTS idx_orders_created_at ON luminous_gallery.orders(created_at);
CREATE INDEX IF NOT EXISTS idx_nfc_verifications_hash ON luminous_gallery.nfc_tag_verifications(nfc_hash);
CREATE INDEX IF NOT EXISTS idx_nfc_verifications_edition ON luminous_gallery.nfc_tag_verifications(edition_id, edition_number);
CREATE INDEX IF NOT EXISTS idx_nfc_scan_logs_uid ON luminous_gallery.nfc_scan_logs(nfc_uid);
CREATE INDEX IF NOT EXISTS idx_nfc_scan_logs_scanned_at ON luminous_gallery.nfc_scan_logs(scanned_at);

-- -----------------------------------------------------------------------------
-- AUTOMATION & TRIGGERS (Auto updated_at)
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_update_editions_updated_at
    BEFORE UPDATE ON luminous_gallery.editions
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER trg_update_orders_updated_at
    BEFORE UPDATE ON luminous_gallery.orders
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Trigger: log_order_status_change
-- Auto-records status changes into order_audit_trail
CREATE OR REPLACE FUNCTION log_order_status_change_func()
RETURNS TRIGGER AS $$
BEGIN
    IF (OLD.order_status IS NULL OR OLD.order_status <> NEW.order_status) THEN
        INSERT INTO luminous_gallery.order_audit_trail (order_id, previous_status, new_status, changed_by, notes)
        VALUES (
            NEW.order_id,
            OLD.order_status,
            NEW.order_status,
            COALESCE(current_setting('luminous_gallery.audit_user', true), 'SYSTEM'),
            'Order state modified by automated gateway.'
        );
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_log_order_status_change
    AFTER UPDATE ON luminous_gallery.orders
    FOR EACH ROW
    EXECUTE FUNCTION log_order_status_change_func();

CREATE OR REPLACE FUNCTION log_order_initial_status_func()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO luminous_gallery.order_audit_trail (order_id, previous_status, new_status, changed_by, notes)
    VALUES (
        NEW.order_id,
        NULL,
        NEW.order_status,
        COALESCE(current_setting('luminous_gallery.audit_user', true), 'SYSTEM'),
        'Initial order created and queued.'
    );
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_log_order_initial_status
    AFTER INSERT ON luminous_gallery.orders
    FOR EACH ROW
    EXECUTE FUNCTION log_order_initial_status_func();
