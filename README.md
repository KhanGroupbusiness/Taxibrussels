# Belgium Taxi Full Pro Website

This is a GitHub Pages friendly taxi website with:

- Luxury landing page
- Airport/city transfer price calculator
- Google Maps autocomplete and distance calculation
- Fixed airport routes
- Fixed-price day trips
- Stripe Payment Link buttons
- WhatsApp booking
- Email booking
- Local browser admin dashboard

## Required Google Cloud restrictions

Your key is visible in browser code because Google Maps JavaScript runs in the browser. Keep it restricted.

Application restriction:

```text
https://khangroupbusiness.github.io/*
```

Optional local testing:

```text
http://localhost/*
```

API restrictions:

- Maps JavaScript API
- Places API
- Distance Matrix API

## Change WhatsApp and email

Open `script.js` and edit:

```js
const BUSINESS = {
  whatsappNumber: "32000000000",
  email: "booking@example.com"
};
```

## Add Stripe payments

Create Stripe Payment Links in Stripe Dashboard.

Then open `script.js` and replace:

```js
const STRIPE_LINKS = {
  deposit: "...",
  full: "...",
  trips: {
    "Bruges Day Trip": "...",
    "Ghent Day Trip": "...",
    "Knokke Day Trip": "...",
    "Brussels Private Tour": "..."
  }
};
```

Important: true dynamic Stripe checkout requires a backend server. This static version uses Stripe Payment Links, which is the best simple option for GitHub Pages.

## Admin dashboard

Open:

```text
admin.html
```

This dashboard shows bookings saved in the same browser with localStorage. For real bookings stored online, you will later need a backend, Airtable, Firebase, Supabase, or similar.
