# Khan Executive Taxi — approval-based booking draft

This update keeps the existing GitHub Pages website and replaces local-only bookings with a Supabase-backed request flow. It is a setup-ready draft, not a deployed or production-certified booking service.

## What it does

- You publish individual pickup windows from a password-protected driver dashboard.
- Each window reserves a complete period for one ride; overlapping windows are rejected in the database.
- Customers see only open, unoccupied windows. All times use Europe/Brussels.
- Booking requests reserve the whole window immediately. Pending requests stay blocked until you review them; they do not expire automatically.
- Simultaneous submissions lock the same database row, and a unique active-request index prevents two requests from occupying the same window.
- You approve with a final fare, decline, or cancel. Decline/cancellation releases the window unless it is closed.
- Your dashboard reads shared bookings across devices after sign-in.
- Customer records cannot be read by anonymous visitors or ordinary authenticated users. Only explicitly allowlisted driver accounts can view records or make decisions.
- Requests and quotes are indicative until reviewed. Customer-supplied price estimates are never treated as the approved fare.
- This version does not collect payment. Customer notification uses an email draft you send yourself, not an automatic email service.

## Setup — do this before replacing the live website

1. Create a Supabase project. Choose an EU region if appropriate for your business.
2. In the project's SQL Editor run `schema.sql` once, on a new project. It creates the tables, permissions and functions.
3. In Authentication, create your driver user with your own email and password. Disable public account signups because customer accounts are unnecessary.
4. Copy the driver's user UUID. Run this separately in the SQL Editor:

   ```sql
   insert into taxi_private.admins(user_id) values ('YOUR-ADMIN-USER-UUID');
   ```

5. Put the project URL and PUBLIC publishable/anon key into `booking-config.js`. Never put a database password, secret key, or service-role key in website files.
6. Test the site using a local web server or a private staging deployment. Open `admin.html` and sign in. Publish future pickup windows for the appropriate service.
7. Test a request using test contact details. Check it appears from a second browser. Approve/decline it and verify availability updates.
8. Test two browsers submitting the same window: one must succeed and the other must receive an unavailable error. Verify anonymous and non-admin users cannot read requests or edit slots. These live tests have not yet been run.
9. Once verified, upload the files inside this folder to the existing GitHub repository. This package has not been published for you.

## Scheduling rules

Pickup must be at least four hours ahead and within 90 days. Windows can be no longer than 12 hours. The customer pickup time is the beginning of the window; you must ensure you can reach that pickup location before it starts.

Publish only windows you can actually fulfil. Reserve the full journey, repositioning/return travel and a generous buffer until the window end. Do not publish adjacent windows if you need travel time between their pickup areas. Day-trip windows must be at least 8 hours for Bruges/Knokke, 7 hours for Ghent, or 5 hours for Brussels; add your travel/buffer yourself.

Transfers have variable duration, so the driver must review the requested route against the reserved window before approving. This version does not automatically compute journey-aware calendar slots or sync Google Calendar. A pending long route may be declined if it does not fit. To block personal time, do not publish windows then, or close an existing window. Closing does not cancel an existing request.

## Before public launch

- Connect automatic transactional notifications if you want customers notified without manually sending email. Until then, review the dashboard regularly and send decisions using “Email customer”.
- Add server-verified bot protection and request rate limiting before broad public promotion. Anonymous requests currently can reserve published slots; spam can consume availability. Client-only CAPTCHA is not sufficient. Use an Edge Function validating the challenge before invoking a restricted booking function for a public production deployment.
- Review your privacy notice, contact details, cancellation rules and data-retention process. This draft includes only a brief request acknowledgement, not a complete privacy policy.
- Retain/restrict your Google Maps browser key and verify Maps pricing/routing. Original pricing logic remains indicative and needs your review.
- Replace the original stock destination photos before launch. Photo changes are outside this booking update.
- Only standard car bookings (up to 3 passengers and 4 bags) are offered here. Confirm real luggage capacity before launch.
- Add a protected customer status link or automated confirmation if needed. The reference shown after submission identifies the request; it is not a status page or an access credential.

## Checks performed

JavaScript syntax and Belgian summer/winter/DST conversion checks were run locally. Browser rendering could not be run because the execution environment has no installed Chromium binary. Supabase execution, concurrency, access-control and real email/payment integrations remain unverified until a project is connected. No real bookings, customer messages, payments or deployments were made.

## References

https://supabase.com/docs/guides/database/functions
https://supabase.com/docs/guides/database/postgres/row-level-security
