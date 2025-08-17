-- Migration: Create vendor_payment_receipts table
-- Description: Add table to store receipt images for vendor payments

CREATE TABLE vendor_payment_receipts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    payment_id UUID NOT NULL REFERENCES vendor_payments(id) ON DELETE CASCADE,
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    s3_key TEXT NOT NULL,
    s3_url TEXT,
    file_name TEXT,
    file_size_bytes BIGINT,
    content_type TEXT,
    uploaded_by UUID NOT NULL REFERENCES auth.users(id),
    uploaded_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Create indexes for performance
CREATE INDEX idx_vendor_payment_receipts_payment_id ON vendor_payment_receipts(payment_id);
CREATE INDEX idx_vendor_payment_receipts_organization_id ON vendor_payment_receipts(organization_id);
CREATE INDEX idx_vendor_payment_receipts_uploaded_at ON vendor_payment_receipts(uploaded_at);

-- Add RLS (Row Level Security) policies
ALTER TABLE vendor_payment_receipts ENABLE ROW LEVEL SECURITY;

-- Policy for users to view receipts from their organization
CREATE POLICY "Users can view payment receipts from their organization" ON vendor_payment_receipts
    FOR SELECT
    USING (
        organization_id IN (
            SELECT profiles.organization_id 
            FROM profiles 
            WHERE profiles.id = auth.uid()
        )
    );

-- Policy for users to insert receipts for their organization
CREATE POLICY "Users can upload payment receipts for their organization" ON vendor_payment_receipts
    FOR INSERT
    WITH CHECK (
        organization_id IN (
            SELECT profiles.organization_id 
            FROM profiles 
            WHERE profiles.id = auth.uid()
        )
        AND uploaded_by = auth.uid()
    );

-- Policy for users to delete receipts they uploaded
CREATE POLICY "Users can delete payment receipts they uploaded" ON vendor_payment_receipts
    FOR DELETE
    USING (
        uploaded_by = auth.uid()
        AND organization_id IN (
            SELECT profiles.organization_id 
            FROM profiles 
            WHERE profiles.id = auth.uid()
        )
    );

-- Add trigger for updated_at
CREATE OR REPLACE FUNCTION update_vendor_payment_receipts_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_vendor_payment_receipts_updated_at
    BEFORE UPDATE ON vendor_payment_receipts
    FOR EACH ROW
    EXECUTE FUNCTION update_vendor_payment_receipts_updated_at();

-- Add comments for documentation
COMMENT ON TABLE vendor_payment_receipts IS 'Stores receipt images/documents for vendor payments';
COMMENT ON COLUMN vendor_payment_receipts.payment_id IS 'References the vendor payment this receipt belongs to';
COMMENT ON COLUMN vendor_payment_receipts.s3_key IS 'S3 key for the receipt file storage';
COMMENT ON COLUMN vendor_payment_receipts.s3_url IS 'Optional S3 URL (usually generated dynamically with signed URLs)';
COMMENT ON COLUMN vendor_payment_receipts.file_name IS 'Original filename of the uploaded receipt';
COMMENT ON COLUMN vendor_payment_receipts.file_size_bytes IS 'Size of the receipt file in bytes';
COMMENT ON COLUMN vendor_payment_receipts.content_type IS 'MIME type of the receipt file';