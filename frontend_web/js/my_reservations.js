import { api } from "./api.js";
import { requireAuth, logout, getUser } from "./auth.js";

requireAuth();

const listEl = document.getElementById("list");
const errEl = document.getElementById("err");
const loadingEl = document.getElementById("loading");
const logoutBtn = document.getElementById("logoutBtn");

function showError(msg) {
	errEl.textContent = msg || "";
}

function setLoading(isLoading) {
	loadingEl.style.display = isLoading ? "block" : "none";
}

logoutBtn.addEventListener("click", () => {
	logout();
	window.location.href = "login.html";
});

function formatStatus(status) {
	const s = String(status || "").toLowerCase();
	if (s === "accepted" || s === "approved") return "Elfogadva";
	if (s === "cancelled" || s === "canceled") return "Lemondva";
	if (s === "pending") return "Függőben";
	return status || "Ismeretlen";
}

function reservationCard(r) {
	// Támogatjuk azt is, ha a backend ad vissza étteremnevet (pl. restaurantName vagy restaurant_name)
	const restaurantName =
		r.restaurantName || r.restaurant_name || r.name || null;

	const date = r.date || "";
	const time = r.time || "";
	const people = r.peopleCount ?? r.people_count ?? "";
	const status = formatStatus(r.status);

	const restaurantText = restaurantName
		? restaurantName
		: `Étterem ID: ${r.restaurantId ?? r.restaurant_id ?? "?"}`;

	return `
    <div class="restaurant-card">
      <div class="restaurant-name">${restaurantText}</div>
      <div class="restaurant-meta">
        <span>${date}</span>
        ${time ? `<span>• ${time}</span>` : ""}
        ${people ? `<span>• ${people} fő</span>` : ""}
      </div>
      <div class="restaurant-link">Státusz: ${status}</div>
    </div>
  `;
}

async function loadMyReservations() {
	showError("");
	setLoading(true);
	listEl.innerHTML = "";

	try {
		const user = getUser();
		const userId = user?.id;

		if (!userId) {
			showError("Nincs bejelentkezett felhasználó.");
			return;
		}

		const reservations = await api.getMyReservations(userId);

		if (!reservations || reservations.length === 0) {
			listEl.innerHTML = `<div class="hint">Még nincs foglalásod.</div>`;
			return;
		}

		listEl.innerHTML = reservations.map(reservationCard).join("");
	} catch (err) {
		showError(err.message || "Hiba történt a foglalások betöltése közben.");
	} finally {
		setLoading(false);
	}
}

loadMyReservations();
