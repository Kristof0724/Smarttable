// Ez a modul az új foglalás és a foglalásmódosítás oldal logikáját kezeli.
import { api } from "./api.js";
import { requireAuth, logout, getUser, redirectAdminUsers } from "./auth.js";

const authUser = requireAuth();
redirectAdminUsers();

const errEl = document.getElementById("err");
const okEl = document.getElementById("ok");
const openHintEl = document.getElementById("openHint");

const dateEl = document.getElementById("date");
const timeEl = document.getElementById("time");
const peopleEl = document.getElementById("peopleCount");

const reserveBtn = document.getElementById("reserveBtn");
let currentSlots = [];
const logoutBtn = document.getElementById("logoutBtn");
const backLink = document.getElementById("backLink");

// Megjeleníti a foglalási hibaüzenetet.
function showError(msg) {
  if (errEl) errEl.textContent = msg || "";
}

// Megjeleníti a sikeres foglalási visszajelzést.
function showOk(msg) {
  if (okEl) okEl.textContent = msg || "";
}

// Frissíti a foglalási oldal betöltési állapotát.
function setLoading(loading) {
  if (!reserveBtn) return;
  reserveBtn.disabled = loading;
  reserveBtn.textContent = loading ? "Mentés..." : (isEdit ? "Módosítás mentése" : "Foglalás véglegesítése");
}

// Kinyeri az étterem azonosítóját az URL-ből.
function getRestaurantId() {
  const params = new URLSearchParams(window.location.search);
  return params.get("restaurantId");
}

// Visszaadja a mai nap dátumát ISO formátumban.
function todayISO() {
  const d = new Date();
  return d.toISOString().slice(0, 10);
}

logoutBtn?.addEventListener("click", () => {
  logout();
  window.location.href = "login.html";
});

let restaurantId = getRestaurantId();

// Kinyeri a szerkesztett foglalás azonosítóját az URL-ből.
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

// Betölti a meglévő foglalás adatait szerkesztési módban.
async function initEditMode() {
  if (!isEdit) return;
  try {
    setLoading(true);
    const data = await api.getReservationById(editId);
    const currentStatus = String(data?.status || "pending").toLowerCase();
    if (!["pending", "accepted"].includes(currentStatus)) {
      showError("A teljesített vagy lemondott foglalás már nem módosítható.");
      if (reserveBtn) reserveBtn.disabled = true;
      return;
    }
    restaurantId = String(data.restaurantId);
    if (dateEl) dateEl.value = data.date || '';
    if (timeEl) timeEl.value = data.time || '';
    if (peopleEl) peopleEl.value = String(data.peopleCount || '');
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

if (!isEdit && restaurantId && backLink) {
  backLink.href = `restaurant.html?id=${encodeURIComponent(restaurantId)}`;
}

// Kiolvassa és ellenőrzi a megadott létszámot.
function getPeopleCount() {
  const raw = String(peopleEl?.value || "").trim();
  if (!raw) return null;
  const n = Number.parseInt(raw, 10);
  return Number.isFinite(n) && n > 0 ? n : null;
}

// A kapacitás szerint korlátozza a maximális létszámot.
function applyPeopleLimit(capacity) {
  if (!peopleEl) return;
  const maxPeople = Math.max(1, (Number(capacity) || 40) - 1);
  peopleEl.max = String(maxPeople);
  const current = Number.parseInt(String(peopleEl.value || ""), 10);
  if (Number.isFinite(current) && current > maxPeople) {
    peopleEl.value = String(maxPeople);
  }
}

// Frissíti a választható idősávokat a dátum és létszám alapján.
async function refreshTimeSlots() {
  if (!restaurantId || !dateEl || !timeEl) return;

  const user = getUser();
  if (!user?.id) return;

  const date = dateEl.value;
  const peopleCount = getPeopleCount();
  if (!date) return;

  try {
    const requestedPeople = peopleCount || 1;
    const data = await api.getRestaurantTimeSlots(restaurantId, date, requestedPeople, isEdit ? editId : null);
    applyPeopleLimit(data?.capacity);
    const slots = Array.isArray(data?.slots) ? data.slots : [];
    currentSlots = slots;
    const available = slots.filter((s) => s.available).map((s) => s.time);
    const allTimes = slots.map((s) => s.time);
    const currentTime = timeEl?.value || "";

    timeEl.innerHTML = [`<option value="">Válassz időpontot</option>`]
      .concat(slots.map((slot) => {
        const unavailable = !!peopleCount && !slot.available;
        const selectedUnavailable = currentTime && currentTime === slot.time && unavailable;
        const disabledAttr = unavailable && !selectedUnavailable ? ' disabled' : '';
        const suffix = unavailable ? ' - megtelt' : '';
        return `<option value="${slot.time}"${disabledAttr}>${slot.time}${suffix}</option>`;
      }))
      .join("");

    if (currentTime && allTimes.includes(currentTime) && (!peopleCount || available.includes(currentTime))) {
      timeEl.value = currentTime;
    } else if (peopleCount && currentTime && !available.includes(currentTime)) {
      timeEl.value = "";
    }

    if (openHintEl) {
      const openTxt = data?.openingTime && data?.closingTime ? `${data.openingTime}-${data.closingTime}` : (data?.openingHours || "");
      const capTxt = data?.capacity ? `Kapacitás: ${data.capacity}` : "";
      const availTxt = peopleCount ? `Elérhető idősávok: ${available.length}` : "Válassz létszámot a pontos szabad helyekhez";
      openHintEl.textContent = [openTxt && `Nyitvatartás: ${openTxt}`, capTxt, availTxt].filter(Boolean).join(" • ");
    }

    if (peopleCount && available.length === 0) {
      showError("Nincs szabad idősáv ezen a napon a választott létszámmal.");
    } else if (peopleCount && currentTime && !available.includes(currentTime)) {
      showError("A kiválasztott időpontra ennél a létszámnál már nincs hely. Válassz másik időpontot.");
    }
  } catch (e) {
    currentSlots = [];
    timeEl.innerHTML = `<option value="">Válassz időpontot</option>`;
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
peopleEl?.addEventListener("input", () => {
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
  const peopleCount = getPeopleCount();

  if (!restaurantId) return showError("Hiányzik az étterem azonosító!");
  if (!date) return showError("Válassz dátumot!");
  if (!time) return showError("Válassz időpontot!");
  if (!peopleCount) return showError("Add meg a létszámot!");

  try {
    await refreshTimeSlots();
    const chosenSlot = currentSlots.find((slot) => String(slot.time) === String(time));
    if (!chosenSlot || !chosenSlot.available) {
      return showError("Erre az időpontra már nincs elég szabad hely. Kérlek válassz másik időpontot.");
    }

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