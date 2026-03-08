import { api } from "./api.js";
import { requireAuth, logout, getUser } from "./auth.js";

requireAuth();

const errEl = document.getElementById("err");
const okEl = document.getElementById("ok");
const openHintEl = document.getElementById("openHint");

const dateEl = document.getElementById("date");
const timeEl = document.getElementById("time");
const timeListEl = document.getElementById("reserveTimeSlots");
const peopleEl = document.getElementById("peopleCount");

const reserveBtn = document.getElementById("reserveBtn");
const logoutBtn = document.getElementById("logoutBtn");
const backLink = document.getElementById("backLink");

function showError(msg) {
  if (errEl) errEl.textContent = msg || "";
}

function showOk(msg) {
  if (okEl) okEl.textContent = msg || "";
}

function setLoading(loading) {
  if (!reserveBtn) return;
  reserveBtn.disabled = loading;
  reserveBtn.textContent = loading ? "Mentés..." : (isEdit ? "Módosítás mentése" : "Foglalás véglegesítése");
}

function getRestaurantId() {
  const params = new URLSearchParams(window.location.search);
  return params.get("restaurantId");
}

function todayISO() {
  const d = new Date();
  return d.toISOString().slice(0, 10);
}

logoutBtn?.addEventListener("click", () => {
  logout();
  window.location.href = "login.html";
});

let restaurantId = getRestaurantId();

function getEditId() {
  const params = new URLSearchParams(window.location.search);
  return params.get("edit");
}

const editId = getEditId();
const isEdit = Boolean(editId);

if (isEdit) {
  const h1 = document.querySelector('h1');
  if (h1) h1.textContent = 'Foglalás módosítása';
  if (reserveBtn) reserveBtn.textContent = 'Módosítás mentése';
  if (backLink) backLink.href = 'my_reservations.html';
  if (reserveBtn) reserveBtn.disabled = true;
}

async function initEditMode() {
  if (!isEdit) return;
  try {
    setLoading(true);
    const data = await api.getReservationById(editId);
    restaurantId = String(data.restaurantId);
    if (dateEl) dateEl.value = data.date || '';
    if (timeEl) timeEl.value = data.time || '';
    if (peopleEl) peopleEl.value = String(data.peopleCount || 2);
    refreshTimeSlots();
    if (reserveBtn) reserveBtn.disabled = false;
  } catch (e) {
    showError(e?.message || 'Nem sikerült betölteni a foglalást.');
  } finally {
    setLoading(false);
  }
}

initEditMode();


if (dateEl) {
  dateEl.min = todayISO();
  if (!isEdit) dateEl.value = todayISO();
}
if (timeEl && !timeEl.value && !isEdit) timeEl.value = "18:00";

if (!isEdit && restaurantId && backLink) {
  backLink.href = `restaurant.html?id=${encodeURIComponent(restaurantId)}`;
}

async function refreshTimeSlots() {
  if (!restaurantId || !dateEl || !timeEl || !timeListEl) return;

  const user = getUser();
  if (!user?.id) return;

  const date = dateEl.value;
  const peopleCount = Number(peopleEl?.value || 1);
  if (!date) return;

  try {
    const data = await api.getRestaurantTimeSlots(restaurantId, date, peopleCount);
    const slots = Array.isArray(data?.slots) ? data.slots : [];
    const available = slots.filter((s) => s.available).map((s) => s.time);

    timeListEl.innerHTML = available.map((t) => `<option value="${t}"></option>`).join("");

    if (openHintEl) {
      const openTxt = data?.openingTime && data?.closingTime ? `${data.openingTime}–${data.closingTime}` : (data?.openingHours || "");
      const capTxt = data?.capacity ? `Kapacitás: ${data.capacity}` : "";
      const availTxt = `Elérhető idősávok: ${available.length}`;
      openHintEl.textContent = [openTxt && `Nyitvatartás: ${openTxt}`, capTxt, availTxt].filter(Boolean).join(" • ");
    }

    if (available.length > 0 && !available.includes(timeEl.value)) {
      timeEl.value = available[0];
    }

    if (available.length === 0) {
      showError("Nincs szabad idősáv ezen a napon a választott létszámmal.");
    }
  } catch (e) {
  }
}

if (restaurantId) {
  api
    .getRestaurantById(restaurantId)
    .then((r) => {
      if (openHintEl) openHintEl.textContent = `Nyitvatartás: ${r.openingHours || "nincs megadva"}`;
      return refreshTimeSlots();
    })
    .catch(() => {
    });
}

dateEl?.addEventListener("change", () => {
  showError("");
  showOk("");
  refreshTimeSlots();
});

peopleEl?.addEventListener("change", () => {
  showError("");
  showOk("");
  refreshTimeSlots();
});

reserveBtn?.addEventListener("click", async () => {
  showError("");
  showOk("");

  const user = getUser();
  if (!user) return;

  const date = dateEl?.value;
  const time = timeEl?.value;
  const peopleCount = Number(peopleEl?.value);

  if (!restaurantId) return showError("Hiányzik az étterem azonosító!");
  if (!date) return showError("Válassz dátumot!");
  if (!time) return showError("Válassz időpontot!");
  if (!peopleCount || peopleCount < 1) return showError("A létszám minimum 1!");

  try {
    setLoading(true);

    if (isEdit) {
      await api.updateReservation(editId, { date, time, peopleCount });
      showOk("Módosítás sikeres! Átirányítás...");
    } else {
      await api.createReservation({
        restaurantId: Number(restaurantId),
        date,
        time,
        peopleCount,
      });
      showOk("Foglalás sikeres! Átirányítás...");
    }

    setTimeout(() => {
      window.location.href = "my_reservations.html";
    }, 800);
  } catch (err) {
    showError(err.message || "Hiba történt a foglalás során.");
  } finally {
    setLoading(false);
  }
});