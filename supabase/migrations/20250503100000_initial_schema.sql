-- Final Database Schema with Buyer IDs and Quantity Tracking
-- Enable UUID extension if not already enabled
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Organizations Table: Stores company/tenant information
CREATE TABLE
    public.organizations (
        id uuid PRIMARY KEY DEFAULT uuid_generate_v4 (),
        name text NOT NULL,
        created_at timestamptz NOT NULL DEFAULT now ()
    );

COMMENT ON TABLE public.organizations IS 'Stores company/tenant information.';

-- Profiles Table: Links auth.users to organizations and roles
CREATE TABLE
    public.profiles (
        id uuid PRIMARY KEY REFERENCES auth.users (id) ON DELETE CASCADE, -- Links to Supabase auth user ID
        organization_id uuid NOT NULL REFERENCES public.organizations (id) ON DELETE CASCADE,
        role text NOT NULL DEFAULT 'Worker' CHECK (role IN ('Owner', 'Worker')), -- Enforce valid roles
        full_name text,
        updated_at timestamptz DEFAULT now ()
    );

COMMENT ON TABLE public.profiles IS 'User profile information, linking Supabase auth users to organizations and roles.';

-- Workflow Stages Table: Defines main stages in the production workflow
CREATE TABLE
    public.workflow_stages (
        id uuid PRIMARY KEY DEFAULT uuid_generate_v4 (),
        name text NOT NULL,
        sequence_order integer NOT NULL,
        organization_id uuid REFERENCES public.organizations (id) ON DELETE CASCADE, -- NULL indicates a default stage template
        is_default boolean NOT NULL DEFAULT false,
        created_at timestamptz NOT NULL DEFAULT now (),
        UNIQUE (organization_id, sequence_order) -- Each organization has unique sequence orders
    );

COMMENT ON TABLE public.workflow_stages IS 'Defines the main stages in the production/preparation workflow.';

COMMENT ON COLUMN public.workflow_stages.organization_id IS 'NULL indicates a global default stage template.';

-- Workflow Sub-Stages Table: Defines steps within a main workflow stage
CREATE TABLE
    public.workflow_sub_stages (
        id uuid PRIMARY KEY DEFAULT uuid_generate_v4 (),
        name text NOT NULL,
        sequence_order integer NOT NULL,
        stage_id uuid NOT NULL REFERENCES public.workflow_stages (id) ON DELETE CASCADE, -- Link to parent stage
        organization_id uuid REFERENCES public.organizations (id) ON DELETE CASCADE, -- NULL indicates a default sub-stage template
        is_default boolean NOT NULL DEFAULT false,
        created_at timestamptz NOT NULL DEFAULT now (),
        UNIQUE (stage_id, sequence_order) -- Each stage has unique sequence orders for sub-stages
    );

COMMENT ON TABLE public.workflow_sub_stages IS 'Defines specific sub-steps within a main workflow stage.';

COMMENT ON COLUMN public.workflow_sub_stages.organization_id IS 'NULL indicates a global default sub-stage template.';

-- Orders Table: Represents customer orders containing items to be processed
CREATE TABLE
    public.orders (
        id uuid PRIMARY KEY DEFAULT uuid_generate_v4 (),
        organization_id uuid NOT NULL REFERENCES public.organizations (id) ON DELETE CASCADE,
        order_number text NOT NULL,
        customer_name text,
        payment_status text NOT NULL DEFAULT 'Unpaid', -- Consider ENUM type later (e.g., 'Unpaid', 'Lent', 'Credit', 'Paid')
        status text NOT NULL DEFAULT 'In Progress', -- Consider ENUM type later (e.g., 'Draft', 'In Progress', 'Completed', 'Cancelled')
        total_quantity integer NOT NULL CHECK (total_quantity > 0), -- Total quantity of items in this order
        created_at timestamptz NOT NULL DEFAULT now (),
        updated_at timestamptz NOT NULL DEFAULT now (),
        UNIQUE (organization_id, order_number) -- Order number is unique within an organization
    );

COMMENT ON TABLE public.orders IS 'Represents customer orders containing items to be processed.';

COMMENT ON COLUMN public.orders.total_quantity IS 'Total quantity of items ordered.';

-- Item Master Table: Catalog of unique items (SKUs) an organization handles
CREATE TABLE
    public.item_master (
        sku text NOT NULL,
        organization_id uuid NOT NULL REFERENCES public.organizations (id) ON DELETE CASCADE,
        item_name text NOT NULL,
        master_details jsonb, -- Stores default details like weight, dimensions, etc.
        created_at timestamptz NOT NULL DEFAULT now (),
        PRIMARY KEY (sku, organization_id) -- Composite key ensures SKU is unique per organization
    );

COMMENT ON TABLE public.item_master IS 'Catalog of unique items (SKUs) with their master details for an organization.';

-- Items Table: Tracks individual item types within orders as they move through the workflow
CREATE TABLE
    public.items (
        id uuid PRIMARY KEY DEFAULT uuid_generate_v4 (),
        order_id uuid NOT NULL REFERENCES public.orders (id) ON DELETE CASCADE,
        sku text NOT NULL,
        buyer_id text, -- External reference ID used by the buyer
        instance_details jsonb, -- Overrides or specific details for this instance
        total_quantity integer NOT NULL CHECK (total_quantity > 0), -- Total quantity of items of this type in the order
        remaining_quantity integer NOT NULL CHECK (remaining_quantity >= 0), -- Quantity that hasn't been completed yet
        organization_id uuid NOT NULL REFERENCES public.organizations (id) ON DELETE CASCADE,
        created_at timestamptz NOT NULL DEFAULT now (),
        updated_at timestamptz NOT NULL DEFAULT now (),
        -- Foreign key to ensure the SKU exists in the item master for the organization
        FOREIGN KEY (sku, organization_id) REFERENCES public.item_master (sku, organization_id) ON DELETE RESTRICT ON UPDATE CASCADE
    );

COMMENT ON TABLE public.items IS 'Tracks individual item types within orders as they move through the workflow.';

COMMENT ON COLUMN public.items.instance_details IS 'Specific details for this item instance, potentially overriding master details.';

COMMENT ON COLUMN public.items.total_quantity IS 'Total quantity of this item type in the order.';

COMMENT ON COLUMN public.items.remaining_quantity IS 'Quantity of this item type that has not yet completed the entire workflow.';

COMMENT ON COLUMN public.items.buyer_id IS 'External reference ID used by the buyer for this specific item.';

-- Item Stage Allocation Table: Tracks quantities of items at specific stages/substages
CREATE TABLE
    public.item_stage_allocations (
        id uuid PRIMARY KEY DEFAULT uuid_generate_v4 (),
        item_id uuid NOT NULL REFERENCES public.items (id) ON DELETE CASCADE,
        stage_id uuid NOT NULL REFERENCES public.workflow_stages (id) ON DELETE CASCADE,
        sub_stage_id uuid REFERENCES public.workflow_sub_stages (id) ON DELETE SET NULL,
        quantity integer NOT NULL CHECK (quantity > 0),
        status text NOT NULL DEFAULT 'In Progress', -- Consider ENUM: 'In Progress', 'On Hold', 'Completed', etc.
        moved_by uuid REFERENCES auth.users (id) ON DELETE SET NULL,
        organization_id uuid NOT NULL REFERENCES public.organizations (id) ON DELETE CASCADE,
        created_at timestamptz NOT NULL DEFAULT now (),
        updated_at timestamptz NOT NULL DEFAULT now ()
    );

COMMENT ON TABLE public.item_stage_allocations IS 'Tracks quantities of items at specific workflow stages or sub-stages.';

COMMENT ON COLUMN public.item_stage_allocations.quantity IS 'Number of items currently at this stage/sub-stage.';

-- Item Movement History Table: Logs the movement of item quantities between stages/sub-stages
CREATE TABLE
    public.item_movement_history (
        id bigserial PRIMARY KEY,
        item_id uuid NOT NULL REFERENCES public.items (id) ON DELETE CASCADE,
        from_stage_id uuid REFERENCES public.workflow_stages (id) ON DELETE SET NULL,
        from_sub_stage_id uuid REFERENCES public.workflow_sub_stages (id) ON DELETE SET NULL,
        to_stage_id uuid REFERENCES public.workflow_stages (id) ON DELETE SET NULL,
        to_sub_stage_id uuid REFERENCES public.workflow_sub_stages (id) ON DELETE SET NULL,
        quantity integer NOT NULL CHECK (quantity > 0),
        moved_at timestamptz NOT NULL DEFAULT now (),
        moved_by uuid REFERENCES auth.users (id) ON DELETE SET NULL,
        organization_id uuid NOT NULL REFERENCES public.organizations (id) ON DELETE CASCADE,
        rework_reason text -- Reason if this movement corresponds to a rework step
    );

COMMENT ON TABLE public.item_movement_history IS 'Logs the movement of item quantities between workflow stages and sub-stages.';

-- Remarks Table: Stores comments or notes related to specific items or movements
CREATE TABLE
    public.remarks (
        id bigserial PRIMARY KEY,
        item_id uuid NOT NULL REFERENCES public.items (id) ON DELETE CASCADE,
        allocation_id uuid REFERENCES public.item_stage_allocations (id) ON DELETE SET NULL, -- Optional: Link to a specific allocation
        movement_id bigint REFERENCES public.item_movement_history (id) ON DELETE SET NULL, -- Optional: Link to a specific movement
        user_id uuid NOT NULL REFERENCES auth.users (id) ON DELETE SET NULL, -- User who made the remark
        text text NOT NULL CHECK (text <> ''), -- Ensure remark text is not empty
        "timestamp" timestamptz NOT NULL DEFAULT now (), -- Quoted identifier as 'timestamp' is a type name
        organization_id uuid NOT NULL REFERENCES public.organizations (id) ON DELETE CASCADE
    );

COMMENT ON TABLE public.remarks IS 'Stores comments or notes related to items, potentially linked to specific allocations or movements.';

-- -- Trigger function to update 'updated_at' timestamp on profiles table
-- CREATE OR REPLACE FUNCTION public.handle_timestamp_update()
-- RETURNS TRIGGER AS $$
-- BEGIN
--   NEW.updated_at = now();
--   RETURN NEW;
-- END;
-- $$ LANGUAGE plpgsql SECURITY DEFINER;
-- -- Apply update timestamp triggers
-- CREATE TRIGGER on_profile_update
-- BEFORE UPDATE ON public.profiles
-- FOR EACH ROW
-- EXECUTE FUNCTION public.handle_timestamp_update();
-- CREATE TRIGGER on_order_update
-- BEFORE UPDATE ON public.orders
-- FOR EACH ROW
-- EXECUTE FUNCTION public.handle_timestamp_update();
-- CREATE TRIGGER on_item_update
-- BEFORE UPDATE ON public.items
-- FOR EACH ROW
-- EXECUTE FUNCTION public.handle_timestamp_update();
-- CREATE TRIGGER on_allocation_update
-- BEFORE UPDATE ON public.item_stage_allocations
-- FOR EACH ROW
-- EXECUTE FUNCTION public.handle_timestamp_update();
-- -- Trigger function to ensure the sum of allocated quantities doesn't exceed item total_quantity
-- CREATE OR REPLACE FUNCTION public.validate_allocation_quantity()
-- RETURNS TRIGGER AS $$
-- DECLARE
--     total_allocated integer;
--     item_total integer;
-- BEGIN
--     -- Calculate total allocated quantity for this item (including the new/updated allocation)
--     SELECT COALESCE(SUM(quantity), 0) INTO total_allocated
--     FROM public.item_stage_allocations
--     WHERE item_id = NEW.item_id
--     AND id != NEW.id; -- Exclude this allocation if it's an update
--     total_allocated := total_allocated + NEW.quantity;
--     -- Get the item's total quantity
--     SELECT total_quantity INTO item_total
--     FROM public.items
--     WHERE id = NEW.item_id;
--     -- Ensure allocated quantity doesn't exceed total
--     IF total_allocated > item_total THEN
--         RAISE EXCEPTION 'Total allocated quantity (%) exceeds item total quantity (%)', 
--                         total_allocated, item_total;
--     END IF;
--     RETURN NEW;
-- END;
-- $$ LANGUAGE plpgsql;
-- -- Apply the validation trigger
-- CREATE TRIGGER check_allocation_quantity
-- BEFORE INSERT OR UPDATE ON public.item_stage_allocations
-- FOR EACH ROW
-- EXECUTE FUNCTION public.validate_allocation_quantity();
-- -- Trigger function to update order status when all items are complete
-- CREATE OR REPLACE FUNCTION public.check_order_completion()
-- RETURNS TRIGGER AS $$
-- DECLARE
--     all_complete boolean;
--     order_id_val uuid;
-- BEGIN
--     -- Get the order ID
--     SELECT order_id INTO order_id_val
--     FROM public.items
--     WHERE id = NEW.id;
--     -- Check if all items in this order have remaining_quantity = 0
--     SELECT bool_and(remaining_quantity = 0) INTO all_complete
--     FROM public.items
--     WHERE order_id = order_id_val;
--     -- If all items are complete, update the order status
--     IF all_complete THEN
--         UPDATE public.orders
--         SET status = 'Completed'
--         WHERE id = order_id_val
--         AND status != 'Completed'; -- Only update if not already completed
--     END IF;
--     RETURN NEW;
-- END;
-- $$ LANGUAGE plpgsql;
-- -- Apply the order completion trigger
-- CREATE TRIGGER check_order_completion
-- AFTER UPDATE OF remaining_quantity ON public.items
-- FOR EACH ROW
-- WHEN (NEW.remaining_quantity = 0 AND OLD.remaining_quantity > 0)
-- EXECUTE FUNCTION public.check_order_completion();
-- Add basic indexes
CREATE INDEX idx_profiles_organization_id ON public.profiles (organization_id);

CREATE INDEX idx_workflow_stages_organization_id ON public.workflow_stages (organization_id);

CREATE INDEX idx_workflow_stages_is_default ON public.workflow_stages (is_default);

CREATE INDEX idx_workflow_sub_stages_stage_id ON public.workflow_sub_stages (stage_id);

CREATE INDEX idx_workflow_sub_stages_organization_id ON public.workflow_sub_stages (organization_id);

CREATE INDEX idx_workflow_sub_stages_is_default ON public.workflow_sub_stages (is_default);

CREATE INDEX idx_orders_organization_id ON public.orders (organization_id);

CREATE INDEX idx_orders_status ON public.orders (status);

CREATE INDEX idx_orders_payment_status ON public.orders (payment_status);

CREATE INDEX idx_item_master_organization_id ON public.item_master (organization_id);

CREATE INDEX idx_items_order_id ON public.items (order_id);

CREATE INDEX idx_items_organization_id ON public.items (organization_id);

CREATE INDEX idx_items_sku_organization_id ON public.items (sku, organization_id);

CREATE INDEX idx_items_buyer_id ON public.items (buyer_id);

CREATE INDEX idx_item_stage_allocations_item_id ON public.item_stage_allocations (item_id);

CREATE INDEX idx_item_stage_allocations_stage_id ON public.item_stage_allocations (stage_id);

CREATE INDEX idx_item_stage_allocations_sub_stage_id ON public.item_stage_allocations (sub_stage_id);

CREATE INDEX idx_item_stage_allocations_organization_id ON public.item_stage_allocations (organization_id);

CREATE INDEX idx_item_stage_allocations_status ON public.item_stage_allocations (status);

CREATE INDEX idx_item_movement_history_item_id ON public.item_movement_history (item_id);

CREATE INDEX idx_item_movement_history_organization_id ON public.item_movement_history (organization_id);

CREATE INDEX idx_item_movement_history_moved_at ON public.item_movement_history (moved_at);

CREATE INDEX idx_remarks_item_id ON public.remarks (item_id);

CREATE INDEX idx_remarks_organization_id ON public.remarks (organization_id);

CREATE INDEX idx_remarks_allocation_id ON public.remarks (allocation_id);

CREATE INDEX idx_remarks_movement_id ON public.remarks (movement_id);