const BUSINESS = {
  name: "Khan Executive Taxi",
  whatsappNumber: "32000000000", // Change to your real WhatsApp number, no + or spaces.
  email: "booking@example.com" // Change to your real email.
};

const STRIPE_LINKS = {
  // Replace these with your real Stripe Payment Links.
  deposit: "https://buy.stripe.com/test_deposit_placeholder",
  full: "https://buy.stripe.com/test_full_payment_placeholder",

  // Optional trip-specific links. Replace when you create fixed trip products in Stripe.
  trips: {
    "Bruges Day Trip": "https://buy.stripe.com/test_bruges_placeholder",
    "Ghent Day Trip": "https://buy.stripe.com/test_ghent_placeholder",
    "Knokke Day Trip": "https://buy.stripe.com/test_knokke_placeholder",
    "Brussels Private Tour": "https://buy.stripe.com/test_brussels_placeholder"
  }
};

const PRICING = {
  baseFee: 15,
  pricePerKm: 2.2,
  minimumFare: 45,
  airportPickupFee: 10,
  nightSurcharge: 20,
  depositAmount: 50,
  vehicleMultiplier: {
    standard: 1,
    van: 1.3,
    premium: 1.55
  }
};

const AIRPORT_KEYWORDS = ["airport", "aéroport", "luchthaven", "zaventem", "charleroi", "schiphol", "cdg", "orly"];

const FIXED_ROUTES = [
  { from: ["brussels airport", "zaventem"], to: ["brussels", "bruxelles"], price: 55, label: "Brussels Airport to Brussels" },
  { from: ["brussels airport", "zaventem"], to: ["charleroi airport"], price: 120, label: "Brussels Airport to Charleroi Airport" },
  { from: ["brussels airport", "zaventem"], to: ["schiphol", "amsterdam airport"], price: 320, label: "Brussels Airport to Amsterdam Schiphol" },
  { from: ["brussels airport", "zaventem"], to: ["charles de gaulle", "cdg", "paris airport"], price: 430, label: "Brussels Airport to Paris CDG" },
  { from: ["brussels airport", "zaventem"], to: ["orly"], price: 450, label: "Brussels Airport to Paris Orly" }
];

let currentQuote = null;

function loadGoogleMaps() {
  const script = document.createElement("script");
  script.src = `https://maps.googleapis.com/maps/api/js?key=${window.GOOGLE_MAPS_API_KEY}&libraries=places&callback=initAutocomplete`;
  script.async = true;
  script.defer = true;
  document.head.appendChild(script);
}

window.initAutocomplete = function () {
  const options = {
    fields: ["formatted_address", "geometry", "name"],
    componentRestrictions: { country: ["be", "nl", "fr"] }
  };

  new google.maps.places.Autocomplete(document.getElementById("pickup"), options);
  new google.maps.places.Autocomplete(document.getElementById("dropoff"), options);
};

loadGoogleMaps();

function normalize(text) {
  return (text || "").toLowerCase().trim();
}

function containsAny(text, keywords) {
  const clean = normalize(text);
  return keywords.some(k => clean.includes(k));
}

function fixedRoute(origin, destination) {
  return FIXED_ROUTES.find(route => {
    return (containsAny(origin, route.from) && containsAny(destination, route.to)) ||
           (containsAny(origin, route.to) && containsAny(destination, route.from));
  });
}

function getVehicleMultiplier() {
  return PRICING.vehicleMultiplier[document.getElementById("vehicleType").value] || 1;
}

function isNightTime() {
  const time = document.getElementById("time").value;
  if (!time) return false;
  const hour = Number(time.split(":")[0]);
  return hour >= 22 || hour < 6;
}

function calculateTransfer() {
  const origin = document.getElementById("pickup").value;
  const destination = document.getElementById("dropoff").value;

  if (!origin || !destination) {
    alert("Please enter pickup and drop-off locations.");
    return;
  }

  const route = fixedRoute(origin, destination);
  if (route) {
    let price = route.price * getVehicleMultiplier();
    const extras = [];
    if (isNightTime()) {
      price += PRICING.nightSurcharge;
      extras.push(`Night surcharge €${PRICING.nightSurcharge}`);
    }

    setQuote({
      type: "Transfer",
      title: route.label,
      origin,
      destination,
      distance: "Fixed route",
      duration: "Fixed price",
      price,
      extras
    });
    return;
  }

  if (!window.google || !google.maps) {
    alert("Google Maps is loading. Please try again in a few seconds.");
    return;
  }

  const service = new google.maps.DistanceMatrixService();
  service.getDistanceMatrix({
    origins: [origin],
    destinations: [destination],
    travelMode: google.maps.TravelMode.DRIVING,
    unitSystem: google.maps.UnitSystem.METRIC
  }, (response, status) => {
    if (status !== "OK") {
      alert("Distance calculation failed. Check your Google API settings.");
      return;
    }

    const element = response.rows[0].elements[0];
    if (element.status !== "OK") {
      alert("No driving route found. Please choose Google suggested places.");
      return;
    }

    const km = element.distance.value / 1000;
    let price = PRICING.baseFee + (km * PRICING.pricePerKm);
    price *= getVehicleMultiplier();

    const extras = [];

    if (containsAny(origin, AIRPORT_KEYWORDS)) {
      price += PRICING.airportPickupFee;
      extras.push(`Airport pickup fee €${PRICING.airportPickupFee}`);
    }

    if (isNightTime()) {
      price += PRICING.nightSurcharge;
      extras.push(`Night surcharge €${PRICING.nightSurcharge}`);
    }

    price = Math.max(price, PRICING.minimumFare);

    setQuote({
      type: "Transfer",
      title: "Distance-based transfer",
      origin,
      destination,
      distance: `${km.toFixed(1)} km`,
      duration: element.duration.text,
      price,
      extras
    });
  });
}

function selectDayTrip(title, origin, destination, price, duration) {
  document.getElementById("bookingType").value = "day-trip";
  document.getElementById("pickup").value = origin;
  document.getElementById("dropoff").value = destination;

  const finalPrice = price * getVehicleMultiplier();

  setQuote({
    type: "Day Trip",
    title,
    origin,
    destination,
    distance: "Fixed trip",
    duration,
    price: finalPrice,
    extras: ["Private driver", "Flexible pickup time", "Return included"]
  });

  document.getElementById("booking").scrollIntoView({ behavior: "smooth" });
}

function setQuote(quote) {
  currentQuote = {
    ...quote,
    priceText: `€${quote.price.toFixed(2)}`,
    depositText: `€${PRICING.depositAmount.toFixed(2)}`,
    customerName: document.getElementById("customerName").value,
    customerPhone: document.getElementById("customerPhone").value,
    date: document.getElementById("date").value,
    time: document.getElementById("time").value,
    passengers: document.getElementById("passengers").value,
    luggage: document.getElementById("luggage").value,
    notes: document.getElementById("notes").value,
    vehicle: document.getElementById("vehicleType").value
  };

  renderQuote();
  updateActionButtons();
}

function renderQuote() {
  const box = document.getElementById("quoteBox");
  const extras = currentQuote.extras.length ? `<ul>${currentQuote.extras.map(e => `<li>${escapeHtml(e)}</li>`).join("")}</ul>` : "";

  box.classList.remove("empty");
  box.innerHTML = `
    <h3>${escapeHtml(currentQuote.title)}</h3>
    <p><strong>Type:</strong> ${escapeHtml(currentQuote.type)}</p>
    <p><strong>Pickup:</strong> ${escapeHtml(currentQuote.origin)}</p>
    <p><strong>Drop-off:</strong> ${escapeHtml(currentQuote.destination)}</p>
    <p><strong>Distance:</strong> ${escapeHtml(currentQuote.distance)}</p>
    <p><strong>Duration:</strong> ${escapeHtml(currentQuote.duration)}</p>
    ${extras}
    <div class="big-price">${currentQuote.priceText}</div>
    <p class="small">Deposit option: ${currentQuote.depositText}</p>
  `;
}

function buildMessage() {
  if (!currentQuote) return "";

  currentQuote.customerName = document.getElementById("customerName").value;
  currentQuote.customerPhone = document.getElementById("customerPhone").value;
  currentQuote.date = document.getElementById("date").value;
  currentQuote.time = document.getElementById("time").value;
  currentQuote.passengers = document.getElementById("passengers").value;
  currentQuote.luggage = document.getElementById("luggage").value;
  currentQuote.notes = document.getElementById("notes").value;

  return `Hello, I would like to book:

Service: ${currentQuote.title}
Type: ${currentQuote.type}
Pickup: ${currentQuote.origin}
Drop-off: ${currentQuote.destination}
Date: ${currentQuote.date || "Not selected"}
Time: ${currentQuote.time || "Not selected"}
Name: ${currentQuote.customerName || "Not provided"}
Phone: ${currentQuote.customerPhone || "Not provided"}
Passengers: ${currentQuote.passengers}
Luggage: ${currentQuote.luggage}
Vehicle: ${currentQuote.vehicle}
Estimated price: ${currentQuote.priceText}
Notes: ${currentQuote.notes || "None"}`;
}

function updateActionButtons() {
  const message = buildMessage();

  const whatsapp = document.getElementById("whatsappBtn");
  whatsapp.href = `https://wa.me/${BUSINESS.whatsappNumber}?text=${encodeURIComponent(message)}`;
  whatsapp.classList.remove("disabled");

  const email = document.getElementById("emailBtn");
  email.href = `mailto:${BUSINESS.email}?subject=${encodeURIComponent("Taxi booking request")}&body=${encodeURIComponent(message)}`;
  email.classList.remove("disabled");

  const deposit = document.getElementById("depositBtn");
  deposit.href = STRIPE_LINKS.deposit;
  deposit.textContent = `Pay Deposit ${currentQuote.depositText}`;
  deposit.classList.remove("disabled");

  const full = document.getElementById("fullPayBtn");
  full.href = STRIPE_LINKS.trips[currentQuote.title] || STRIPE_LINKS.full;
  full.textContent = `Pay Full ${currentQuote.priceText}`;
  full.classList.remove("disabled");
}

function saveBooking() {
  if (!currentQuote) {
    alert("Please select a day trip or calculate a transfer first.");
    return;
  }

  buildMessage();
  const bookings = JSON.parse(localStorage.getItem("taxiBookings") || "[]");
  bookings.push({
    ...currentQuote,
    createdAt: new Date().toISOString()
  });

  localStorage.setItem("taxiBookings", JSON.stringify(bookings));
  alert("Booking saved in local admin dashboard.");
}

function escapeHtml(value) {
  return String(value || "").replace(/[&<>"']/g, char => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#039;"
  }[char]));
}
