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

function starsHtml(avg) {
	const a = Number(avg || 0);
	const full = Math.round(a);
	let out = "";
	for (let i = 1; i <= 5; i++) {
		out += `<i class="bi ${i <= full ? "bi-star-fill text-warning" : "bi-star text-warning"}"></i>`;
	}
	return out;
}

logoutBtn.addEventListener("click", () => {
	logout();
	window.location.href = "login.html";
});

function cardTemplate(r) {
	const name = r.name ?? "Névtelen étterem";
	const city = r.city ?? "";
	const cuisine = r.cuisine ?? "";
	const priceRange = r.priceRange ?? "";
	let img = r.imageUrl ? String(r.imageUrl) : "assets/restaurant_sample.png";
	if (img.startsWith("/")) img = img.slice(1);
	const avg = Number(r.avgRating || 0);
	const avgTxt = avg ? avg.toFixed(1) : "—";

	return `
    <div class="col-12 col-md-6 col-lg-4">
      <div class="restaurant-card card h-100" data-id="${r.id}">
        <img class="restaurant-img" src="${img}" alt="${name}">
        <div class="card-body d-flex flex-column">
          <div class="d-flex justify-content-between align-items-start gap-2">
            <div class="restaurant-name card-title mb-1">${name}</div>
            <span class="badge text-bg-light border">
              ${starsHtml(avg)} <span class="ms-1">${avgTxt}</span>
            </span>
          </div>
          <div class="restaurant-meta mb-3">
            ${[city, cuisine, priceRange].filter(Boolean).join(" • ")}
          </div>
          <div class="restaurant-link mt-auto">Részletek →</div>
        </div>
      </div>
    </div>
  `;
}

async function loadRestaurants() {
	showError("");
	setLoading(true);

	try {
		const user = getUser(); // ha később kell (pl. üdvözlés)
		console.log("LOGGED IN USER:", user);

		const restaurants = await api.getRestaurants();

		listEl.innerHTML = "";

		if (!restaurants || restaurants.length === 0) {
			listEl.innerHTML = `<div class="hint">Nincs megjeleníthető étterem.</div>`;
			return;
		}

		listEl.innerHTML = restaurants.map(cardTemplate).join("");

		// kattintás események
		listEl.querySelectorAll(".restaurant-card").forEach((card) => {
			card.addEventListener("click", () => {
				const id = card.getAttribute("data-id");
				window.location.href = `restaurant.html?id=${id}`;
			});
		});
	} catch (err) {
		showError(err.message || "Hiba történt az éttermek betöltése közben.");
	} finally {
		setLoading(false);
	}
}

loadRestaurants();
