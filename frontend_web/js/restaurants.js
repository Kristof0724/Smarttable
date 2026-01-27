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

function cardTemplate(r) {
  // Biztonság kedvéért, ha valamelyik mező hiányozna:
  const name = r.name ?? "Névtelen étterem";
  const city = r.city ?? "";
  const cuisine = r.cuisine ?? "";
  const priceRange = r.priceRange ?? "";

  return `
    <div class="restaurant-card" data-id="${r.id}">
      <div class="restaurant-name">${name}</div>
      <div class="restaurant-meta">
        ${city ? `<span>${city}</span>` : ""}
        ${cuisine ? `<span>• ${cuisine}</span>` : ""}
        ${priceRange ? `<span>• ${priceRange}</span>` : ""}
      </div>
      <div class="restaurant-link">Részletek →</div>
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
