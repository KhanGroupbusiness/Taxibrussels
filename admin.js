function loadBookings(){
  const list = document.getElementById("bookingsList");
  const bookings = JSON.parse(localStorage.getItem("taxiBookings") || "[]");

  if (!bookings.length) {
    list.innerHTML = "<p>No bookings saved yet.</p>";
    return;
  }

  list.innerHTML = bookings.map((b, i) => `
    <div class="quote" style="margin-bottom:14px">
      <h3>${i + 1}. ${escapeHtml(b.title)}</h3>
      <p><strong>Created:</strong> ${new Date(b.createdAt).toLocaleString()}</p>
      <p><strong>Name:</strong> ${escapeHtml(b.customerName || "")}</p>
      <p><strong>Phone:</strong> ${escapeHtml(b.customerPhone || "")}</p>
      <p><strong>Pickup:</strong> ${escapeHtml(b.origin)}</p>
      <p><strong>Drop-off:</strong> ${escapeHtml(b.destination)}</p>
      <p><strong>Date/Time:</strong> ${escapeHtml(b.date || "")} ${escapeHtml(b.time || "")}</p>
      <p><strong>Passengers:</strong> ${escapeHtml(b.passengers || "")}</p>
      <p><strong>Price:</strong> ${escapeHtml(b.priceText)}</p>
      <p><strong>Notes:</strong> ${escapeHtml(b.notes || "")}</p>
    </div>
  `).join("");
}

function clearBookings(){
  if(confirm("Clear all saved bookings in this browser?")){
    localStorage.removeItem("taxiBookings");
    loadBookings();
  }
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

loadBookings();
