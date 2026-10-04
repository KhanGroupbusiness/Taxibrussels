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

## Weekly driver availability

The driver dashboard now includes weekly availability with these editable defaults:
- Monday–Friday: 18:00–22:00.
- Saturday–Sunday: 05:00–23:00.
- All times use Europe/Brussels.

Use **Preview upcoming dates**, review the pickup windows, then **Publish available windows**. Publish 1, 2, 4 or 8 weeks at a time. The default is 4 weeks. There is no unattended recurring publication; publish another range before your current availability runs out.

Each generated window permits one customer request, as in the existing booking system. Choose a reserved ride duration that includes the entire journey, pickup travel and a buffer. The default is 1 hour for transfers. Day trips use 8-hour windows; periods shorter than the chosen duration generate no windows. A partial remainder is not published.

The weekly hours are saved locally on the current device for the signed-in driver. Published windows are stored in Supabase and available across devices. The weekly template itself is not synced across devices. Saving weekly hours alone does not publish availability.

Existing windows are preserved, including closed windows and reservations. Preview/publish skips overlaps. Editing the template changes only future publications; it does not move previously published windows. Use **Exceptions for a date** to close unreserved windows, and use **Add a one-off window** to add different hours. Reopening remains available in the individual availability cards. Review any new requests received while closing a date before approving them.

### Deploy this update
Replace `admin.html`, `admin.js` and `style.css`, and add `weekly.js` in the GitHub repository root. Commit and wait for GitHub Pages to publish. No SQL migration is needed. Keep the existing Supabase configuration and password-reset redirect URLs.

## Business contact and navigation
The menu and footer link to `admin.html`. Business contact is +32 466 19 08 24 / khangroup.motors@gmail.com. The website offers call and email links. Booking requests continue to be stored in Supabase for driver approval; this update does not configure automatic email notifications. Also replace `index.html` and `script.js` when deploying this contact update.

## Editable published fares
Run `pricing-upgrade.sql` once in the existing Supabase project's SQL Editor. Do not rerun the original booking schema on an existing project. This upgrade creates a public fare table; only authenticated driver admins can change its values. No existing requests or availability are modified.

In the driver dashboard, use **Prices & fares** to edit day trips, transfer supplements, vehicle multipliers and fixed airport routes, then **Save published prices**. Prices are stored in Supabase, not only on your device. New visitors and refreshed booking pages receive the saved prices. Existing quotations and approved final fares are preserved. If two devices edit prices, an outdated save is rejected; load published prices again.

Customers cannot calculate a fare if published pricing cannot be loaded. After uploading, complete the SQL setup before accepting requests. Day-trip prices are starting fares before the selected vehicle multiplier.

### Files for this combined update
Replace `index.html`, `script.js`, `availability.js`, `admin.html`, `admin.js`, `style.css`; add `weekly.js`, `pricing.js`, `pricing-admin.js`. Keep your existing `booking-config.js` and `booking-api.js`.

Destination photos use Wikimedia thumbnails with source and Creative Commons licence credits in the day-trip section. They are hosted externally.

Business contact: +32 466 19 08 24 and khangroup.motors@gmail.com. Booking requests are reviewed in the portal using Approve/Decline. Automatic booking email notifications have not been configured; email contact links open the customer's email app and Email customer opens a driver email draft.
