import { api } from "./api.js";
import { requireAuth, logout, getUser } from "./auth.js";

requireAuth();

const errEl = document.getElementById("err");
const okEl = document.getElementById("ok");

const dateEl = document.getElementById("date");
const timeEl = document.getElementById("time");
const peopleEl = document.getElementById("peopleCount");

const reserveBtn = document.getElementById("reserveBtn");
const logoutBtn = document.getElementById("logoutBtn");
const backLink = document.getElementById("backLink");

function showError(msg) {
  errEl.textContent = msg || "";
}

function showOk(msg) {
  okEl.textContent = msg || "";
}

function setLoading(loading) {
  reserveBtn.disabled = loading;
  reserveBtn.textContent = loading
    ? "Mentés..."
    : "Foglalás véglegesítése";
}

function getRestaurantId() {
  const params = new URLSearchParams(window.location.search);
  return params.get("restaurantId");
}

function todayISO() {
  const d = new Date();
  return d.toISOString().slice(0, 10);
}

logoutBtn.addEventListener("click", () => {
  logout();
  window.location.href = "login.html";
});

// alapértékek
dateEl.value = todayISO();
timeEl.value = "18:00";

const restaurantId = getRestaurantId();
if (restaurantId) {
  backLink.href = `restaurant.html?id=${encodeURIComponent(restaurantId)}`;
}

reserveBtn.addEventListener("click", async () => {
  showError("");
  showOk("");

  const user = getUser();
  if (!user) return;

  const date = dateEl.value;
  const time = timeEl.value;
  const peopleCount = Number(peopleEl.value);

  if (!restaurantId)
    return showError("Hiányzik az étterem azonosító!");
  if (!date) return showError("Válassz dátumot!");
  if (!time) return showError("Válassz időpontot!");
  if (!peopleCount || peopleCount < 1)
    return showError("A létszám minimum 1!");

  try {
    setLoading(true);

    await api.createReservation({
      restaurantId: Number(restaurantId),
      userId: Number(user.id),
      date,
      time,
      peopleCount,
    });

    showOk("Foglalás sikeres! Átirányítás...");

    setTimeout(() => {
      window.location.href = "my_reservations.html";
    }, 800);

  } catch (err) {
    showError(err.message || "Hiba történt a foglalás során.");
  } finally {
    setLoading(false);
  }
});
