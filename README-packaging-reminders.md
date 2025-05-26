# Packaging Reminder System Setup

This document explains how to set up and configure the automated packaging reminder system for Trakure.

## Overview

The packaging reminder system automatically sends email notifications to organization owners when a certain percentage of items in an order reach a predefined trigger stage. This helps ensure packaging materials are ordered with appropriate lead times.

## Features

- ✅ **Per-order material lists**: Users define required packaging materials at the order level
- ✅ **Single trigger stage**: Users choose one trigger stage/sub-stage for the entire order
- ✅ **Percentage-based triggers**: Reminders sent when 75% of items reach the trigger stage
- ✅ **Email notifications**: Beautiful HTML emails sent via Resend
- ✅ **Automatic tracking**: Prevents duplicate reminders per order

## Prerequisites

1. **Resend Account**: Sign up at [resend.com](https://resend.com)
2. **Domain Verification**: Verify your sending domain in Resend
3. **Environment Variables**: Configure the required environment variables

## Installation

### 1. Install Resend Package

```bash
npm install resend
```

### 2. Environment Variables

Add these environment variables to your project:

```bash
# Required
RESEND_API_KEY=re_xxxxxxxxxxxxxxxxxxxxxxxxx
RESEND_FROM_EMAIL="Trakure <noreply@yourdomain.com>"

# Optional (for API security)
PACKAGING_REMINDER_API_KEY=your-secret-api-key-here
```

### 3. Database Migration

Run the migration to add the required database fields:

```bash
# If using Supabase CLI
supabase db push

# Or apply the migration manually:
# supabase/migrations/20250113000000_fix_packaging_reminders.sql
```

### 4. Deploy Supabase Edge Function (Recommended)

```bash
# Deploy the edge function
supabase functions deploy packaging-reminder-scheduler

# Set environment variables for the edge function
supabase secrets set RESEND_API_KEY=your_resend_api_key
supabase secrets set RESEND_FROM_EMAIL="Trakure <noreply@yourdomain.com>"
supabase secrets set PACKAGING_REMINDER_API_KEY=your_secret_key
```

## Configuration

### Scheduling Options

#### Option 1: Supabase Cron (Recommended)

Create a cron job in your Supabase dashboard:

```sql
SELECT cron.schedule(
  'packaging-reminders',
  '0 */2 * * *', -- Every 2 hours
  'SELECT net.http_post(
    url := ''https://your-project.supabase.co/functions/v1/packaging-reminder-scheduler'',
    headers := ''{"Authorization": "Bearer YOUR_API_KEY"}''::jsonb,
    body := ''{}''::jsonb
  );'
);
```

#### Option 2: External Cron Service

Use services like GitHub Actions, Vercel Cron, or Netlify Functions:

```yaml
# .github/workflows/packaging-reminders.yml
name: Packaging Reminders
on:
  schedule:
    - cron: "0 */2 * * *" # Every 2 hours
jobs:
  trigger:
    runs-on: ubuntu-latest
    steps:
      - name: Trigger reminder check
        run: |
          curl -X POST "https://your-project.supabase.co/functions/v1/packaging-reminder-scheduler" \
            -H "Authorization: Bearer ${{ secrets.PACKAGING_REMINDER_API_KEY }}"
```

#### Option 3: Manual API Calls

For testing or manual triggers:

```bash
curl -X POST "https://your-app.com/api/packaging-reminders/check" \
  -H "Authorization: Bearer YOUR_API_KEY" \
  -H "Content-Type: application/json"
```

## Usage

### 1. Setting Up Orders

When creating orders, users can:

- Define required packaging materials (e.g., "Velvet Box", "Bubble Wrap")
- Select a trigger stage/sub-stage (e.g., "Final Finishing")
- The system automatically tracks total item quantities using the existing `total_quantity` field

### 2. Item Progression

As items move through the workflow:

- The system monitors which stage/sub-stage each item is in
- Calculates the percentage of items that have reached the trigger stage
- Triggers reminders when 75% threshold is reached

### 3. Email Notifications

When triggered, the system:

- Sends emails to all organization owners
- Lists all required packaging materials for the order
- Includes order details and progress information
- Marks the order as "reminder sent" to prevent duplicates

## Database Schema

### New Fields Added to `orders` Table:

- `required_packaging_materials`: `text[]` - Array of material names
- `packaging_reminder_trigger_stage_id`: `uuid` - FK to workflow_stages
- `packaging_reminder_trigger_sub_stage_id`: `uuid` - FK to workflow_sub_stages
- `packaging_reminder_sent`: `boolean` - Prevents duplicate reminders

### Existing Field Usage:

- `total_quantity`: `integer` - Total quantity of all items (used for percentage calculation)

### Automatic Triggers:

The system includes triggers to automatically update `total_quantity` when items are added/modified/removed, ensuring it stays in sync with the actual item quantities in the order.

## Customization

### Percentage Threshold

The default threshold is 75%. To change it, modify the `REMINDER_PERCENTAGE_THRESHOLD` constant in:

- `lib/packaging-reminder-scheduler.ts` (line 7)
- `supabase/functions/packaging-reminder-scheduler/index.ts` (line 17)

### Email Template

Customize the email template in:

- `lib/email/packaging-reminder.ts` (HTML template in `sendPackagingReminder` function)

### Scheduling Frequency

Adjust the cron schedule based on your needs:

- More frequent: `'0 * * * *'` (every hour)
- Less frequent: `'0 8,17 * * 1-5'` (twice daily on weekdays)

## Testing

### Manual Testing

1. Create an order with packaging materials and trigger stage
2. Add items to the order and move them through workflow stages
3. Manually trigger the reminder check:
   ```bash
   curl -X POST "http://localhost:3000/api/packaging-reminders/check"
   ```

### Logs and Monitoring

- Check Supabase Edge Function logs for execution details
- Monitor Resend dashboard for email delivery status
- API responses include detailed processing information

## Troubleshooting

### Common Issues

1. **No emails sent**

   - Check RESEND_API_KEY is valid
   - Verify sending domain is verified in Resend
   - Check logs for specific error messages

2. **Percentage not calculating correctly**

   - Verify `total_quantity` field is updating automatically when items are added
   - Check that item allocations are being tracked properly

3. **Reminders sent multiple times**

   - Ensure `packaging_reminder_sent` flag is being set
   - Check for database transaction issues

4. **Missing organization owners**
   - Verify profiles have `role = 'Owner'`
   - Check that user emails are accessible

### Debug Mode

Enable detailed logging by setting `NODE_ENV=development` in your environment.

## Security Considerations

1. **API Key Protection**: Store the `PACKAGING_REMINDER_API_KEY` securely
2. **Email Rate Limits**: Resend has rate limits; the system processes orders sequentially
3. **Database Access**: Edge functions use service role key with full database access
4. **Input Validation**: All user inputs are validated before processing

## Support

For issues or questions:

1. Check the logs in Supabase dashboard
2. Review Resend delivery logs
3. Test with manual API calls to isolate issues
4. Verify all environment variables are set correctly
