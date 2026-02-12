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

function card(r, bookLabel) {
  const name = r.name ?? "—";
  const city = r.city ?? "";
  const cuisine = r.cuisine ?? "";
  const avg = Number(r.avgRating || 0);
  const avgTxt = avg ? avg.toFixed(1) : "—";
  return `
  <div class="col-12 col-md-6 col-lg-3">
    <div class="card st-card h-100">
      <div class="card-body">
        <div class="d-flex justify-content-between align-items-start gap-2">
          <div class="fw-bold">${escapeHtml(name)}</div>
          <span class="badge text-bg-light border">
            ${starsHtml(avg)} <span class="ms-1">${escapeHtml(avgTxt)}</span>
          </span>
        </div>
        <div class="text-secondary small mt-1">${escapeHtml([cuisine, city].filter(Boolean).join(" • "))}</div>
        <div class="mt-3 d-grid">
          <a class="btn btn-primary btn-sm" href="restaurant.html?id=${encodeURIComponent(r.id)}">${escapeHtml(bookLabel)}</a>
        </div>
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
    const bookLabel = "Foglalás";
    el.innerHTML = top.map((r) => card(r, bookLabel)).join("");
  } catch (e) {
    el.innerHTML = `<div class="error">Betöltési hiba.</div>`;
  }
}

let _allRestaurantsCache = null;
let _selectedRestaurant = null;

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

function setSelectedRestaurant(r) {
  _selectedRestaurant = r;

  const input = document.getElementById("restaurantSearch");
  if (input) input.value = r?.name ?? "";

  const btn = document.getElementById("landingBookBtn");
  if (btn) btn.disabled = !r;

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
  if (s.endsWith("+")) return Number.parseInt(s, 10) || 6;
  return Number.parseInt(s, 10) || 2;
}

function todayStrLocal() {
  const d = new Date();
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

export async function setupRestaurantSearchAutocomplete() {
  const input = document.getElementById("restaurantSearch");
  const box = document.getElementById("restaurantSearchSuggestions");
  const dateEl = document.getElementById("searchDate");
  const timeEl = document.getElementById("searchTime");
  const peopleEl = document.getElementById("searchPeople");
  const bookBtn = document.getElementById("landingBookBtn");
  const timeListEl = document.getElementById("landingTimeSlots");

  if (!input || !box) return;

  // dátum default + min
  if (dateEl) {
    const t = todayStrLocal();
    if (!dateEl.value) dateEl.value = t;
    dateEl.min = t;
  }

  let lastItems = [];

  async function refreshTimeSlots() {
    if (!timeEl || !dateEl || !timeListEl) return;
    if (!_selectedRestaurant || !_selectedRestaurant.id) {
      timeListEl.innerHTML = "";
      return;
    }

    const date = dateEl.value;
    const peopleCount = toIntPeople(peopleEl?.value);
    if (!date) return;

    try {
      const data = await api.getRestaurantTimeSlots(_selectedRestaurant.id, date, peopleCount);
      const slots = Array.isArray(data?.slots) ? data.slots : [];
      const available = slots.filter(s => s.available).map(s => s.time);

      timeListEl.innerHTML = available.map(t => `<option value="${t}"></option>`).join("");

      // ha jelenlegi időpont nincs a listában, álljunk az első elérhetőre
      if (available.length > 0) {
        if (!available.includes(timeEl.value)) timeEl.value = available[0];
        setMessage(`Elérhető idősávok: <b>${available.length}</b> • Kapacitás: <b>${escapeHtml(data.capacity)}</b>`, "text-white");
      } else {
        setMessage('Nincs szabad idősáv ezen a napon a választott létszámmal.', 'text-warning');
      }
    } catch (e) {
      // ha hiba, ne állítsuk meg a foglalást, de jelezzünk
      timeListEl.innerHTML = "";
    }
  }


  async function update() {
    const q = normalize(input.value);

    // ha a user elkezd átírni, töröljük a kiválasztást
    if (_selectedRestaurant && normalize(_selectedRestaurant.name) !== q) {
      setSelectedRestaurant(null);
    }

    if (!q) {
      renderSuggestions([], () => {});
      lastItems = [];
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
  }

  input.addEventListener("input", () => {
    update();
  });

  input.addEventListener("keydown", (e) => {
    if (e.key === "Enter") {
      e.preventDefault();
      if (lastItems && lastItems.length > 0) {
        setSelectedRestaurant(lastItems[0]);
        renderSuggestions([], () => {});
        refreshTimeSlots();
      } else {
        renderSuggestions([], () => {});
      }
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
  if (peopleEl) peopleEl.addEventListener("change", refreshTimeSlots);

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
        if (bookBtn) bookBtn.disabled = !_selectedRestaurant;
      }
    });
  }
}
