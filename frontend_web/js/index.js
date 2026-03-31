import { api } from "./api.js";
import { getUser } from "./auth.js";

function escapeHtml(str) {
  return String(str ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
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

function card(r) {
  const name = r.name ?? "—";
  const city = r.city ?? "";
  const cuisine = r.cuisine ?? "";
  const avg = Number(r.avgRating || 0);
  const avgTxt = avg ? avg.toFixed(1) : "—";
  let img = r.imageUrl ? String(r.imageUrl) : "assets/restaurant_sample.png";
  if (img.startsWith("/")) img = img.slice(1);
  return `
  <div class="col-12 col-md-6 col-lg-3">
    <div class="card st-card h-100 restaurant-card" data-id="${r.id}">
      <img class="restaurant-img" src="${img}" alt="${escapeHtml(name)}" onerror="this.onerror=null;this.src='assets/restaurant_sample.png';">
      <div class="card-body">
        <div class="d-flex justify-content-between align-items-start gap-2">
          <div class="fw-bold">${escapeHtml(name)}</div>
          <span class="badge text-bg-light border">
            ${starsHtml(avg)} <span class="ms-1">${escapeHtml(avgTxt)}</span>
          </span>
        </div>
        <div class="text-secondary small mt-1">${escapeHtml([cuisine, city].filter(Boolean).join(" • "))}</div>
      </div>
    </div>
  </div>`;
}

export async function initPopular() {
  const el = document.getElementById("popularList");
  if (!el) return;

  el.innerHTML = `<div class="hint">Betöltés…</div>`;

  try {
    const top = await api.getTopRestaurants();
    if (!top || top.length === 0) {
      el.innerHTML = `<div class="hint">Még nincs toplista.</div>`;
      return;
    }
    el.innerHTML = top.map((r) => card(r)).join("");
    el.querySelectorAll(".restaurant-card").forEach((cardEl) => {
      cardEl.addEventListener("click", () => {
        const id = cardEl.getAttribute("data-id");
        if (id) window.location.href = `restaurant.html?id=${encodeURIComponent(id)}`;
      });
    });
  } catch (e) {
    el.innerHTML = `<div class="error">Betöltési hiba.</div>`;
  }
}

let _allRestaurantsCache = null;
let _selectedRestaurant = null;
let _currentSlotState = [];

async function getAllRestaurantsCached() {
  if (_allRestaurantsCache) return _allRestaurantsCache;
  const list = await api.getRestaurants();
  _allRestaurantsCache = Array.isArray(list) ? list : [];
  return _allRestaurantsCache;
}

function normalize(s) {
  return String(s || "").toLowerCase().trim();
}

function setMessage(html, kind = "") {
  const msg = document.getElementById("landingBookMsg");
  if (!msg) return;
  msg.className = `small mt-2 ${kind}`.trim();
  msg.innerHTML = html || "";
}


function renderTimeOptions(slots, peopleCount, currentTime) {
  const select = document.getElementById('searchTime');
  if (!select) return;
  const options = ['<option value=""></option>'];
  const filtered = (peopleCount ? slots.filter((slot) => slot.available) : slots);
  filtered.forEach((slot) => {
    const selected = currentTime && currentTime === slot.time ? ' selected' : '';
    options.push(`<option value="${escapeHtml(slot.time)}"${selected}>${escapeHtml(slot.time)}</option>`);
  });
  select.innerHTML = options.join('');
  if (currentTime && !filtered.some((slot) => String(slot.time) === String(currentTime))) {
    select.value = '';
  }
}

function refreshBookButtonState() {

  const btn = document.getElementById("landingBookBtn");
  const input = document.getElementById("restaurantSearch");
  const dateEl = document.getElementById("searchDate");
  const timeEl = document.getElementById("searchTime");
  const peopleEl = document.getElementById("searchPeople");
  if (!btn) return;
  const hasRestaurant = !!(_selectedRestaurant || String(input?.value || "").trim());
  const hasDate = !!String(dateEl?.value || "").trim();
  const selectedTime = String(timeEl?.value || "").trim();
  const hasTime = !!selectedTime;
  const peopleCount = toIntPeople(peopleEl?.value);
  const selectedSlot = _currentSlotState.find((slot) => String(slot.time) === selectedTime);
  const slotAllowed = !selectedTime || !peopleCount || !selectedSlot ? true : !!selectedSlot.available;
  btn.disabled = !(hasRestaurant && hasDate && hasTime && peopleCount && slotAllowed);
}

function setSelectedRestaurant(r) {
  _selectedRestaurant = r;

  const input = document.getElementById("restaurantSearch");
  if (input) input.value = r?.name ?? "";

  refreshBookButtonState();

  if (r) {
    const meta = [r.cuisine, r.city].filter(Boolean).join(" • ");
    setMessage(
      `Kiválasztva: <b>${escapeHtml(r.name)}</b>${meta ? ` <span class="text-white-50">(${escapeHtml(meta)})</span>` : ""}`,
      "text-white"
    );
  } else {
    setMessage("");
  }
}

function renderSuggestions(items, onPick) {
  const box = document.getElementById("restaurantSearchSuggestions");
  if (!box) return;

  if (!items || items.length === 0) {
    box.innerHTML = "";
    box.style.display = "none";
    return;
  }

  box.style.display = "block";
  box.innerHTML = items
    .map((r) => {
      const name = r.name ?? "—";
      const city = r.city ?? "";
      const cuisine = r.cuisine ?? "";
      const meta = [cuisine, city].filter(Boolean).join(" • ");
      return `<button type="button" class="list-group-item list-group-item-action" data-id="${escapeHtml(r.id)}">
        <div class="fw-semibold">${escapeHtml(name)}</div>
        ${meta ? `<div class="small text-secondary">${escapeHtml(meta)}</div>` : ``}
      </button>`;
    })
    .join("");

  box.onclick = (e) => {
    const btn = e.target.closest("button[data-id]");
    if (!btn) return;
    const id = btn.getAttribute("data-id");
    const picked = items.find((x) => String(x.id) === String(id));
    if (picked) onPick(picked);
  };
}

function toIntPeople(v) {
  const s = String(v || "").trim();
  if (!s) return null;
  if (s.endsWith("+")) return Number.parseInt(s, 10) || null;
  const n = Number.parseInt(s, 10);
  return Number.isFinite(n) && n > 0 ? n : null;
}

function applyPeopleLimit(input, capacity) {
  if (!input) return;
  const maxPeople = Math.max(1, (Number(capacity) || 40) - 1);
  input.max = String(maxPeople);
  const current = Number.parseInt(String(input.value || ""), 10);
  if (Number.isFinite(current) && current > maxPeople) {
    input.value = String(maxPeople);
  }
}

function todayStrLocal() {
  const d = new Date();
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}


async function pickBestRestaurantFromInput(rawValue) {
  const q = normalize(rawValue);
  if (!q) return null;
  const all = await getAllRestaurantsCached();
  const exact = all.find((r) => normalize(r.name) === q);
  if (exact) return exact;
  const starts = all.find((r) => normalize(r.name).startsWith(q) || normalize(r.city).startsWith(q));
  if (starts) return starts;
  return all.find((r) => {
    const name = normalize(r.name);
    const city = normalize(r.city);
    const cuisine = normalize(r.cuisine);
    return name.includes(q) || city.includes(q) || cuisine.includes(q);
  }) || null;
}
export async function setupRestaurantSearchAutocomplete() {
  const input = document.getElementById("restaurantSearch");
  const box = document.getElementById("restaurantSearchSuggestions");
  const dateEl = document.getElementById("searchDate");
  const timeEl = document.getElementById("searchTime");
  const peopleEl = document.getElementById("searchPeople");
  const bookBtn = document.getElementById("landingBookBtn");

  if (!input || !box) return;

  if (dateEl) {
    const t = todayStrLocal();
    if (!dateEl.value) dateEl.value = t;
    dateEl.min = t;
  }

  refreshBookButtonState();

  let lastItems = [];

  async function refreshTimeSlots() {
    if (!timeEl || !dateEl) return;
    if (!_selectedRestaurant || !_selectedRestaurant.id) {
      if (timeEl) timeEl.value = "";
      renderTimeOptions([], peopleEl?.value, "");
      refreshBookButtonState();
      return;
    }

    const date = dateEl.value;
    const peopleCount = toIntPeople(peopleEl?.value);
    if (!date) {
      refreshBookButtonState();
      return;
    }

    try {
      const requestedPeople = peopleCount || 1;
      const data = await api.getRestaurantTimeSlots(_selectedRestaurant.id, date, requestedPeople);
      applyPeopleLimit(peopleEl, data?.capacity);
      const slots = Array.isArray(data?.slots) ? data.slots : [];
      _currentSlotState = slots;
      const available = slots.filter((s) => s.available).map((s) => s.time);
      const allTimes = slots.map((s) => s.time);
      const currentTime = timeEl?.value || "";

      if (currentTime && allTimes.includes(currentTime) && (!peopleCount || available.includes(currentTime))) {
        timeEl.value = currentTime;
      } else if (peopleCount && currentTime && !available.includes(currentTime)) {
        timeEl.value = "";
      }
      renderTimeOptions(slots, peopleCount, timeEl?.value || "");

      if (!peopleCount) {
        setMessage("Add meg a létszámot a pontos szabad helyekhez.", "text-white-50");
      } else if (available.length > 0) {
        if (currentTime && !available.includes(currentTime)) {
          setMessage(`A kiválasztott időpontra ennél a létszámnál már nincs hely. Válassz másik időpontot. • Kapacitás: <b>${escapeHtml(data.capacity)}</b>`, "text-warning");
        } else {
          setMessage(`Elérhető idősávok: <b>${available.length}</b> • Kapacitás: <b>${escapeHtml(data.capacity)}</b>`, "text-white");
        }
      } else {
        setMessage('Nincs szabad idősáv ezen a napon a választott létszámmal.', 'text-warning');
      }
      refreshBookButtonState();
    } catch (e) {
      _currentSlotState = [];
      if (timeEl) timeEl.value = "";
      renderTimeOptions([], peopleEl?.value, "");
      refreshBookButtonState();
    }
  }


  async function update() {
    const q = normalize(input.value);

    if (_selectedRestaurant && normalize(_selectedRestaurant.name) !== q) {
      setSelectedRestaurant(null);
    }

    if (!q) {
      renderSuggestions([], () => {});
      lastItems = [];
      refreshBookButtonState();
      return;
    }

    const all = await getAllRestaurantsCached();
    const hits = all
      .filter((r) => {
        const name = normalize(r.name);
        const city = normalize(r.city);
        const cuisine = normalize(r.cuisine);
        return name.includes(q) || city.includes(q) || cuisine.includes(q);
      })
      .slice(0, 8);

    lastItems = hits;
    renderSuggestions(hits, (picked) => {
      setSelectedRestaurant(picked);
      renderSuggestions([], () => {});
      refreshTimeSlots();
    });
    refreshBookButtonState();
  }

  input.addEventListener("input", () => {
    update();
  });

  input.addEventListener("blur", async () => {
    if (_selectedRestaurant || !String(input.value || "").trim()) return;
    const picked = await pickBestRestaurantFromInput(input.value);
    if (picked) {
      setSelectedRestaurant(picked);
      refreshTimeSlots();
    }
  });

  input.addEventListener("keydown", async (e) => {
    if (e.key === "Enter") {
      e.preventDefault();
      if (lastItems && lastItems.length > 0) {
        setSelectedRestaurant(lastItems[0]);
      } else {
        const picked = await pickBestRestaurantFromInput(input.value);
        if (picked) setSelectedRestaurant(picked);
      }
      renderSuggestions([], () => {});
      refreshTimeSlots();
    }
    if (e.key === "Escape") {
      renderSuggestions([], () => {});
    }
  });

  document.addEventListener("click", (e) => {
    if (e.target === input || box.contains(e.target)) return;
    renderSuggestions([], () => {});
  });

  if (dateEl) dateEl.addEventListener("change", refreshTimeSlots);
  if (timeEl) {
    timeEl.addEventListener('change', refreshBookButtonState);
  }
  if (peopleEl) {
    peopleEl.addEventListener("change", refreshTimeSlots);
    peopleEl.addEventListener("input", refreshTimeSlots);
  }

  if (bookBtn) {
    bookBtn.addEventListener("click", async () => {
      try {
        const user = getUser();
        if (!user || !user.id) {
          setMessage("A foglaláshoz jelentkezz be! Átdobunk a bejelentkezésre…", "text-warning");
          window.location.href = "login.html";
          return;
        }

        if (!_selectedRestaurant) {
          const picked = await pickBestRestaurantFromInput(input.value);
          if (picked) {
            setSelectedRestaurant(picked);
            await refreshTimeSlots();
          }
        }

        if (!_selectedRestaurant) {
          setMessage("Először válassz egy éttermet a listából.", "text-warning");
          return;
        }

        const date = dateEl?.value;
        const time = timeEl?.value;
        const peopleCount = toIntPeople(peopleEl?.value);

        if (!date || !time) {
          setMessage("Add meg a dátumot és az időpontot.", "text-warning");
          return;
        }
        if (!peopleCount) {
          setMessage("Add meg a létszámot.", "text-warning");
          return;
        }

        await refreshTimeSlots();
        const chosenSlot = _currentSlotState.find((slot) => String(slot.time) === String(time));
        if (!chosenSlot || !chosenSlot.available) {
          setMessage("Erre az időpontra már nincs elég szabad hely. Kérlek válassz másik időpontot.", "text-warning");
          return;
        }

        bookBtn.disabled = true;
        setMessage("Foglalás mentése…", "text-white");

        await api.createReservation({
          restaurantId: _selectedRestaurant.id,
          userId: user.id,
          date,
          time,
          peopleCount,
        });

        setMessage("Sikeres foglalás! Megnyitjuk a foglalásaidat…", "text-success");
        window.location.href = "my_reservations.html";
      } catch (err) {
        setMessage(escapeHtml(err?.message || "Hiba a foglalás mentésekor."), "text-danger");
      } finally {
        refreshBookButtonState();
      }
    });
  }
}
