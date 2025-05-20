-- Migration: Add New Orders Functionality
-- Purpose: This migration introduces a status field to the items table,
--          a view for new order items, and a function to allocate
--          items to the workflow.
-- Affected Tables/Columns:
--   - public.items: ADD COLUMN status
-- Affected Views:
--   - public.new_order_items: CREATE VIEW
-- Affected Functions:
--   - public.allocate_item_to_workflow: CREATE FUNCTION

-- Add status field to items table
-- This column will track whether an item is new, in the workflow, or completed.
alter table public.items 
add column status text not null default 'New' 
check (status in ('New', 'In Workflow', 'Completed'));

comment on column public.items.status is 'Indicates if an item is new, already allocated to workflow, or completed.';

-- Drop the view if it exists to allow for column renaming through recreation
DROP VIEW IF EXISTS public.new_order_items;

-- Create a View for "New Orders" to Make Querying Easy
-- This view simplifies querying for items that are new and not yet in the workflow.
-- It now calculates quantity_in_new_pool based on original total and existing stage allocations.
CREATE OR REPLACE VIEW public.new_order_items AS
SELECT 
    i.id AS item_id,
    i.sku,
    i.buyer_id,
    i.total_quantity AS original_item_total_quantity, -- Original total for the item line
    (i.total_quantity - COALESCE(sa.allocated_sum, 0)) AS quantity_in_new_pool,
    i.remaining_quantity, -- This refers to overall workflow completion, not the 'New' pool
    o.id AS order_id,
    o.order_number,
    o.customer_name,
    i.created_at,
    i.organization_id,
    i.status -- Expose item status for clarity and filtering if needed
FROM 
    public.items i
JOIN 
    public.orders o ON i.order_id = o.id
LEFT JOIN (
    SELECT item_id, SUM(quantity) AS allocated_sum
    FROM public.item_stage_allocations
    GROUP BY item_id
) sa ON i.id = sa.item_id
WHERE 
    i.status = 'New' AND (i.total_quantity - COALESCE(sa.allocated_sum, 0)) > 0;

COMMENT ON VIEW public.new_order_items IS 'Shows newly created items (status=New) that have quantity remaining to be allocated to workflow stages.';
COMMENT ON COLUMN public.new_order_items.original_item_total_quantity IS 'The original total quantity for this item line in the order.';
COMMENT ON COLUMN public.new_order_items.quantity_in_new_pool IS 'The quantity of this item currently in the ''New'' status and available for allocation to a workflow stage.';

-- Create a Function for Allocating Items from New Orders to Workflow
-- This function moves items from the 'New' status into a specified workflow stage.
create or replace function public.allocate_item_to_workflow(
    p_item_id uuid,
    p_stage_id uuid,
    p_sub_stage_id uuid,
    p_quantity integer,
    p_allocated_by uuid
)
returns void as $$
declare
    v_org_id uuid;
    v_item_original_total_quantity integer;
    v_item_status text;
    v_currently_allocated_in_stages integer;
    v_available_to_allocate_from_new integer;
begin
    raise notice '[allocate_item_to_workflow V2] Called with p_item_id: %, p_stage_id: %, p_sub_stage_id: %, p_quantity: %, p_allocated_by: %', 
                 p_item_id, p_stage_id, p_sub_stage_id, p_quantity, p_allocated_by;

    if p_quantity <= 0 then
        raise notice '[allocate_item_to_workflow V2] Error: p_quantity is not positive (%).', p_quantity;
        raise exception 'Quantity to allocate must be positive. Received: %', p_quantity;
    end if;

    -- Lock the items row first
    select organization_id, total_quantity, status
    into v_org_id, v_item_original_total_quantity, v_item_status
    from public.items
    where id = p_item_id
    for update;

    if not found then
        raise notice '[allocate_item_to_workflow V2] Error: Item with ID % not found or could not be locked.', p_item_id;
        raise exception 'Item with ID % not found or could not be locked.', p_item_id;
    end if;

    raise notice '[allocate_item_to_workflow V2] Item Locked. Original Total Qty: %, Status: %', v_item_original_total_quantity, v_item_status;

    if v_item_status <> 'New' then
        raise notice '[allocate_item_to_workflow V2] Error: Item with ID % is not in New status. Current status: %', p_item_id, v_item_status;
        raise exception 'Item with ID % is not in New status and cannot be allocated from the New pool. Current status: %', p_item_id, v_item_status;
    end if;

    -- Calculate how much is already allocated to any stage for this item
    -- We also lock item_stage_allocations implicitly by querying it if strict serializable isolation is used, 
    -- or we rely on the item row lock to serialize operations on its allocations.
    select coalesce(sum(quantity), 0)
    into v_currently_allocated_in_stages
    from public.item_stage_allocations
    where item_id = p_item_id;

    raise notice '[allocate_item_to_workflow V2] Currently allocated in stages: %', v_currently_allocated_in_stages;

    v_available_to_allocate_from_new := v_item_original_total_quantity - v_currently_allocated_in_stages;

    raise notice '[allocate_item_to_workflow V2] Available to allocate from New pool: %', v_available_to_allocate_from_new;

    if p_quantity > v_available_to_allocate_from_new then
        raise notice '[allocate_item_to_workflow V2] Error: Requested quantity (%) exceeds available in New pool (%). Original: %, Allocated in Stages: %', 
                        p_quantity, v_available_to_allocate_from_new, v_item_original_total_quantity, v_currently_allocated_in_stages;
        raise exception 'Requested quantity (%) exceeds available quantity in the New pool (%). Item ID: %', 
                        p_quantity, v_available_to_allocate_from_new, p_item_id;
    end if;
    
    -- If this insert succeeds, the validate_allocation_quantity trigger will also run and check against v_item_original_total_quantity.
    insert into public.item_stage_allocations (
        item_id, stage_id, sub_stage_id, quantity, status, moved_by, organization_id
    ) values (
        p_item_id, p_stage_id, p_sub_stage_id, p_quantity, 'In Progress', p_allocated_by, v_org_id
    );
    
    insert into public.item_movement_history (
        item_id, from_stage_id, from_sub_stage_id, to_stage_id, to_sub_stage_id, quantity, moved_by, organization_id
    ) values (
        p_item_id, null, null, p_stage_id, p_sub_stage_id, p_quantity, p_allocated_by, v_org_id
    );
    
    -- Update item status based on allocation status
    if (v_currently_allocated_in_stages + p_quantity) = v_item_original_total_quantity then
        raise notice '[allocate_item_to_workflow V2] All quantity allocated (Existing: % + New: % = Original: %). Setting status to In Workflow.', 
                    v_currently_allocated_in_stages, p_quantity, v_item_original_total_quantity;
        update public.items
        set status = 'In Workflow'
        where id = p_item_id;
    else
        raise notice '[allocate_item_to_workflow V2] Partial quantity allocated (Existing: % + New: % < Original: %). Status remains New.', 
                    v_currently_allocated_in_stages, p_quantity, v_item_original_total_quantity;
        -- Item status remains 'New', no update needed
    end if;

    raise notice '[allocate_item_to_workflow V2] Successfully processed allocation for item %.', p_item_id;
end;
$$ language plpgsql;

-- Grant execute permission (ensure this is still here and correct)
grant execute on function public.allocate_item_to_workflow(uuid, uuid, uuid, integer, uuid) to authenticated; 