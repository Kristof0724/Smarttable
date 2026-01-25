import { api } from "./api.js";
import { requireAuth, logout } from "./auth.js";

requireAuth();

const errEl = document.getElementById("err");
const loadingEl = document.getElementById("loading");
const contentEl = document.getElementById("content");

const nameEl = document.getElementById("name");
const metaEl = document.getElementById("meta");
const descEl = document.getElementById("description");
const openEl = document.getElementById("openingHours");

const logoutBtn = document.getElementById("logoutBtn");
const reserveBtn = document.getElementById("reserveBtn");

function showError(msg) {
  errEl.textContent = msg || "";
}

function setLoading(isLoading) {
  loadingEl.style.display = isLoading ? "block" : "none";
  contentEl.style.display = isLoading ? "none" : "block";
}

function getIdFromQuery() {
  const params = new URLSearchParams(window.location.search);
  return params.get("id");
}

logoutBtn.addEventListener("click", () => {
  logout();
  window.location.href = "login.html";
});

async function loadRestaurant() {
  showError("");
  setLoading(true);

  const id = getIdFromQuery();
  if (!id) {
    setLoading(false);
    showError("Hiányzó étterem azonosító (id). Menj vissza az éttermekhez.");
    return;
  }

  try {
    const r = await api.getRestaurantById(id);

    // Biztonsági fallbackek
    const name = r?.name ?? "Névtelen étterem";
    const city = r?.city ?? "";
    const address = r?.address ?? "";
    const cuisine = r?.cuisine ?? "";
    const priceRange = r?.priceRange ?? "";
    const description = r?.description ?? "Nincs leírás.";
    const openingHours = r?.openingHours ?? "Nincs megadva.";

    nameEl.textContent = name;

    // meta sor összeállítás
    const parts = [];
    if (city) parts.push(city);
    if (address) parts.push(address);
    if (cuisine) parts.push(cuisine);
    if (priceRange) parts.push(priceRange);
    metaEl.textContent = parts.join(" • ");

    descEl.textContent = description;
    openEl.textContent = openingHours;

    // Foglalás gomb → későbbi oldalra (még megcsináljuk)
    reserveBtn.addEventListener("click", () => {
      window.location.href = `reservations.html?restaurantId=${encodeURIComponent(id)}`;
    });

  } catch (err) {
    showError(err.message || "Hiba történt az étterem betöltése közben.");
  } finally {
    setLoading(false);
  }
}

loadRestaurant();
