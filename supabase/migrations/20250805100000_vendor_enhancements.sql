-- Migration: Vendor Management Enhancements
-- This migration enhances vendor management with price history, orders, and payment tracking

-- Step 1: Remove contact_person column from vendors table
ALTER TABLE vendors DROP COLUMN IF EXISTS contact_person;

-- Step 2: Create vendor_price_history table for tracking price changes
CREATE TABLE IF NOT EXISTS vendor_price_history (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    vendor_id UUID NOT NULL REFERENCES vendors(id) ON DELETE CASCADE,
    stage_id UUID NOT NULL REFERENCES workflow_stages(id) ON DELETE CASCADE,
    sku TEXT NOT NULL,
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    price DECIMAL(12, 2) NOT NULL CHECK (price >= 0),
    currency TEXT DEFAULT 'INR' CHECK (currency IN ('INR', 'USD', 'EUR', 'GBP')),
    price_unit TEXT DEFAULT 'per_piece' CHECK (price_unit IN ('per_piece', 'per_kg', 'per_dozen', 'per_hundred')),
    effective_from TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    effective_to TIMESTAMPTZ,
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    created_by UUID REFERENCES auth.users(id),
    
    FOREIGN KEY (sku, organization_id) REFERENCES item_master(sku, organization_id) ON DELETE CASCADE
);

-- Create indexes for price history
CREATE INDEX IF NOT EXISTS idx_vendor_price_history_vendor ON vendor_price_history(vendor_id);
CREATE INDEX IF NOT EXISTS idx_vendor_price_history_stage ON vendor_price_history(stage_id);
CREATE INDEX IF NOT EXISTS idx_vendor_price_history_sku ON vendor_price_history(sku, organization_id);
CREATE INDEX IF NOT EXISTS idx_vendor_price_history_effective ON vendor_price_history(effective_from, effective_to);

-- Step 3: Create vendor_orders table for tracking orders given to vendors
CREATE TABLE IF NOT EXISTS vendor_orders (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    vendor_id UUID NOT NULL REFERENCES vendors(id) ON DELETE CASCADE,
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    order_number TEXT NOT NULL,
    sku TEXT NOT NULL,
    quantity INTEGER NOT NULL CHECK (quantity > 0),
    unit_price DECIMAL(12, 2) NOT NULL CHECK (unit_price >= 0),
    total_amount DECIMAL(12, 2) NOT NULL CHECK (total_amount >= 0),
    currency TEXT DEFAULT 'INR',
    stage_id UUID NOT NULL REFERENCES workflow_stages(id),
    item_id UUID REFERENCES items(id),
    allocation_id UUID REFERENCES item_stage_allocations(id),
    status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'in_progress', 'completed', 'cancelled')),
    expected_completion TIMESTAMPTZ,
    actual_completion TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    created_by UUID REFERENCES auth.users(id),
    
    FOREIGN KEY (sku, organization_id) REFERENCES item_master(sku, organization_id) ON DELETE CASCADE,
    CONSTRAINT unique_vendor_order_number UNIQUE(organization_id, order_number)
);

-- Create indexes for vendor orders
CREATE INDEX IF NOT EXISTS idx_vendor_orders_vendor ON vendor_orders(vendor_id);
CREATE INDEX IF NOT EXISTS idx_vendor_orders_organization ON vendor_orders(organization_id);
CREATE INDEX IF NOT EXISTS idx_vendor_orders_sku ON vendor_orders(sku);
CREATE INDEX IF NOT EXISTS idx_vendor_orders_status ON vendor_orders(status);
CREATE INDEX IF NOT EXISTS idx_vendor_orders_item ON vendor_orders(item_id);

-- Step 4: Create vendor_payments table for tracking payments
CREATE TABLE IF NOT EXISTS vendor_payments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    vendor_id UUID NOT NULL REFERENCES vendors(id) ON DELETE CASCADE,
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    vendor_order_id UUID NOT NULL REFERENCES vendor_orders(id) ON DELETE CASCADE,
    payment_type TEXT NOT NULL CHECK (payment_type IN ('advance', 'part_payment', 'force_closure', 'closure')),
    amount_paid DECIMAL(12, 2) NOT NULL CHECK (amount_paid >= 0),
    total_order_amount DECIMAL(12, 2) NOT NULL CHECK (total_order_amount >= 0),
    remaining_amount DECIMAL(12, 2) GENERATED ALWAYS AS (total_order_amount - amount_paid) STORED,
    remarks TEXT,
    payment_date TIMESTAMPTZ DEFAULT NOW(),
    created_by UUID REFERENCES auth.users(id),
    is_carried_forward BOOLEAN DEFAULT false,
    carried_from_payment_id UUID REFERENCES vendor_payments(id),
    carried_to_order_id UUID REFERENCES vendor_orders(id)
);

-- Create indexes for vendor payments
CREATE INDEX IF NOT EXISTS idx_vendor_payments_vendor ON vendor_payments(vendor_id);
CREATE INDEX IF NOT EXISTS idx_vendor_payments_order ON vendor_payments(vendor_order_id);
CREATE INDEX IF NOT EXISTS idx_vendor_payments_type ON vendor_payments(payment_type);
CREATE INDEX IF NOT EXISTS idx_vendor_payments_carried ON vendor_payments(is_carried_forward);

-- Step 5: Create function to archive price history when vendor_stage_pricing is updated
CREATE OR REPLACE FUNCTION archive_vendor_price_change()
RETURNS TRIGGER AS $$
BEGIN
    -- Only archive if the price actually changed
    IF OLD.price != NEW.price OR OLD.price_unit != NEW.price_unit THEN
        -- Close the previous price history entry
        UPDATE vendor_price_history
        SET effective_to = NOW()
        WHERE vendor_id = NEW.vendor_id
        AND stage_id = NEW.stage_id
        AND sku = NEW.sku
        AND effective_to IS NULL;
        
        -- Create new price history entry
        INSERT INTO vendor_price_history (
            vendor_id, stage_id, sku, organization_id,
            price, currency, price_unit,
            effective_from, notes, created_by
        ) VALUES (
            NEW.vendor_id, NEW.stage_id, NEW.sku, NEW.organization_id,
            NEW.price, NEW.currency, NEW.price_unit,
            NOW(), NEW.notes, auth.uid()
        );
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for price history archival
DROP TRIGGER IF EXISTS archive_vendor_price_on_update ON vendor_stage_pricing;
CREATE TRIGGER archive_vendor_price_on_update
    AFTER UPDATE ON vendor_stage_pricing
    FOR EACH ROW
    EXECUTE FUNCTION archive_vendor_price_change();

-- Also create initial price history entries for existing pricing
INSERT INTO vendor_price_history (
    vendor_id, stage_id, sku, organization_id,
    price, currency, price_unit,
    effective_from, notes, created_by
)
SELECT 
    vendor_id, stage_id, sku, organization_id,
    price, currency, price_unit,
    created_at, notes, created_by
FROM vendor_stage_pricing
WHERE is_active = true;

-- Step 6: Create function to calculate vendor outstanding payments
CREATE OR REPLACE FUNCTION get_vendor_outstanding_payments(
    p_vendor_id UUID,
    p_organization_id UUID
)
RETURNS TABLE (
    total_outstanding DECIMAL(12, 2),
    outstanding_orders JSONB
) AS $$
BEGIN
    RETURN QUERY
    WITH order_payments AS (
        SELECT 
            vo.id as order_id,
            vo.order_number,
            vo.sku,
            vo.total_amount,
            COALESCE(SUM(vp.amount_paid), 0) as total_paid,
            vo.total_amount - COALESCE(SUM(vp.amount_paid), 0) as outstanding,
            MAX(vp.payment_type) as last_payment_type
        FROM vendor_orders vo
        LEFT JOIN vendor_payments vp ON vp.vendor_order_id = vo.id
        WHERE vo.vendor_id = p_vendor_id
        AND vo.organization_id = p_organization_id
        AND vo.status NOT IN ('cancelled')
        GROUP BY vo.id, vo.order_number, vo.sku, vo.total_amount
        HAVING vo.total_amount > COALESCE(SUM(vp.amount_paid), 0)
    )
    SELECT 
        COALESCE(SUM(outstanding), 0) as total_outstanding,
        COALESCE(jsonb_agg(jsonb_build_object(
            'order_id', order_id,
            'order_number', order_number,
            'sku', sku,
            'total_amount', total_amount,
            'total_paid', total_paid,
            'outstanding', outstanding,
            'last_payment_type', last_payment_type
        ) ORDER BY order_number), '[]'::jsonb) as outstanding_orders
    FROM order_payments;
END;
$$ LANGUAGE plpgsql;

-- Step 7: Create function to handle payment carryforward
CREATE OR REPLACE FUNCTION process_vendor_payment_carryforward(
    p_vendor_id UUID,
    p_new_order_id UUID
)
RETURNS void AS $$
DECLARE
    v_outstanding RECORD;
    v_carried_amount DECIMAL(12, 2) := 0;
BEGIN
    -- Get all outstanding payments for the vendor
    FOR v_outstanding IN
        SELECT 
            vo.id as order_id,
            vo.total_amount - COALESCE(SUM(vp.amount_paid), 0) as outstanding_amount
        FROM vendor_orders vo
        LEFT JOIN vendor_payments vp ON vp.vendor_order_id = vo.id
        WHERE vo.vendor_id = p_vendor_id
        AND vo.id != p_new_order_id
        AND vo.status NOT IN ('cancelled')
        GROUP BY vo.id, vo.total_amount
        HAVING vo.total_amount > COALESCE(SUM(vp.amount_paid), 0)
        ORDER BY vo.created_at
    LOOP
        v_carried_amount := v_carried_amount + v_outstanding.outstanding_amount;
        
        -- Mark the outstanding payment as carried forward
        UPDATE vendor_payments
        SET is_carried_forward = true,
            carried_to_order_id = p_new_order_id
        WHERE vendor_order_id = v_outstanding.order_id;
    END LOOP;
    
    -- If there's any carried amount, update the new order's total
    IF v_carried_amount > 0 THEN
        UPDATE vendor_orders
        SET total_amount = total_amount + v_carried_amount
        WHERE id = p_new_order_id;
    END IF;
END;
$$ LANGUAGE plpgsql;

-- Step 8: Create view for vendor payment summary
CREATE OR REPLACE VIEW vendor_payment_summary AS
SELECT 
    v.id as vendor_id,
    v.name as vendor_name,
    v.organization_id,
    COUNT(DISTINCT vo.id) as total_orders,
    SUM(vo.total_amount) as total_order_value,
    SUM(COALESCE(vp.amount_paid, 0)) as total_paid,
    SUM(vo.total_amount) - SUM(COALESCE(vp.amount_paid, 0)) as total_outstanding,
    COUNT(DISTINCT CASE WHEN vo.status = 'completed' THEN vo.id END) as completed_orders,
    COUNT(DISTINCT CASE WHEN vp.payment_type = 'closure' THEN vo.id END) as fully_paid_orders,
    COUNT(DISTINCT CASE WHEN vp.payment_type = 'part_payment' THEN vo.id END) as partially_paid_orders
FROM vendors v
LEFT JOIN vendor_orders vo ON vo.vendor_id = v.id
LEFT JOIN (
    SELECT vendor_order_id, SUM(amount_paid) as amount_paid, MAX(payment_type) as payment_type
    FROM vendor_payments
    GROUP BY vendor_order_id
) vp ON vp.vendor_order_id = vo.id
GROUP BY v.id, v.name, v.organization_id;

-- Grant access to the view
GRANT SELECT ON vendor_payment_summary TO authenticated;

-- Step 9: Enable RLS on new tables
ALTER TABLE vendor_price_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE vendor_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE vendor_payments ENABLE ROW LEVEL SECURITY;

-- RLS policies for vendor_price_history
DROP POLICY IF EXISTS "Users can view vendor price history in their organization" ON vendor_price_history;
CREATE POLICY "Users can view vendor price history in their organization"
    ON vendor_price_history FOR SELECT
    USING (
        organization_id IN (
            SELECT organization_id FROM profiles WHERE id = auth.uid()
        )
    );

DROP POLICY IF EXISTS "Owners can manage vendor price history" ON vendor_price_history;
CREATE POLICY "Owners can manage vendor price history"
    ON vendor_price_history FOR ALL
    USING (
        organization_id IN (
            SELECT organization_id FROM profiles 
            WHERE id = auth.uid() AND role = 'Owner'
        )
    );

-- RLS policies for vendor_orders
DROP POLICY IF EXISTS "Users can view vendor orders in their organization" ON vendor_orders;
CREATE POLICY "Users can view vendor orders in their organization"
    ON vendor_orders FOR SELECT
    USING (
        organization_id IN (
            SELECT organization_id FROM profiles WHERE id = auth.uid()
        )
    );

DROP POLICY IF EXISTS "Users can create vendor orders based on permissions" ON vendor_orders;
CREATE POLICY "Users can create vendor orders based on permissions"
    ON vendor_orders FOR INSERT
    WITH CHECK (
        organization_id IN (
            SELECT organization_id FROM profiles WHERE id = auth.uid()
        ) AND (
            EXISTS (
                SELECT 1 FROM profiles 
                WHERE id = auth.uid() AND role = 'Owner'
            ) OR 
            worker_has_permission('vendors.manage_orders')
        )
    );

DROP POLICY IF EXISTS "Users can update vendor orders based on permissions" ON vendor_orders;
CREATE POLICY "Users can update vendor orders based on permissions"
    ON vendor_orders FOR UPDATE
    USING (
        organization_id IN (
            SELECT organization_id FROM profiles WHERE id = auth.uid()
        ) AND (
            EXISTS (
                SELECT 1 FROM profiles 
                WHERE id = auth.uid() AND role = 'Owner'
            ) OR 
            worker_has_permission('vendors.manage_orders')
        )
    );

-- RLS policies for vendor_payments
DROP POLICY IF EXISTS "Users can view vendor payments in their organization" ON vendor_payments;
CREATE POLICY "Users can view vendor payments in their organization"
    ON vendor_payments FOR SELECT
    USING (
        organization_id IN (
            SELECT organization_id FROM profiles WHERE id = auth.uid()
        )
    );

DROP POLICY IF EXISTS "Users can create vendor payments based on permissions" ON vendor_payments;
CREATE POLICY "Users can create vendor payments based on permissions"
    ON vendor_payments FOR INSERT
    WITH CHECK (
        organization_id IN (
            SELECT organization_id FROM profiles WHERE id = auth.uid()
        ) AND (
            EXISTS (
                SELECT 1 FROM profiles 
                WHERE id = auth.uid() AND role = 'Owner'
            ) OR 
            worker_has_permission('vendors.manage_payments')
        )
    );

-- Add comments for documentation
COMMENT ON TABLE vendor_price_history IS 'Tracks historical price changes for vendor-stage-SKU combinations';
COMMENT ON TABLE vendor_orders IS 'Tracks orders placed with vendors for specific SKUs and quantities';
COMMENT ON TABLE vendor_payments IS 'Tracks payments made to vendors with support for partial payments and carryforward';
COMMENT ON FUNCTION get_vendor_outstanding_payments IS 'Calculates total outstanding payments for a vendor';
COMMENT ON FUNCTION process_vendor_payment_carryforward IS 'Handles carryforward of outstanding amounts to new orders';