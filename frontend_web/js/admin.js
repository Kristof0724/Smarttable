import { api } from "./api.js";
import { requireAuth, logout, getUser } from "./auth.js";

requireAuth();

const user = getUser();
if (!user || user.role !== "admin") {
  // nem admin → vissza az éttermekhez
  window.location.href = "restaurants.html";
}

const errEl = document.getElementById("err");
const okEl = document.getElementById("ok");
const loadingEl = document.getElementById("loading");
const listEl = document.getElementById("list");
const logoutBtn = document.getElementById("logoutBtn");

const qEl = document.getElementById("q");
const statusFilterEl = document.getElementById("statusFilter");

function showError(msg) {
  errEl.textContent = msg || "";
}

function showOk(msg) {
  okEl.textContent = msg || "";
  if (msg) setTimeout(() => (okEl.textContent = ""), 1500);
}

function setLoading(isLoading) {
  loadingEl.style.display = isLoading ? "block" : "none";
}

logoutBtn.addEventListener("click", () => {
  logout();
  window.location.href = "login.html";
});

function statusHu(status) {
  const s = String(status || "").toLowerCase();
  if (s === "pending") return "Függőben";
  if (s === "accepted" || s === "approved") return "Elfogadva";
  if (s === "cancelled" || s === "canceled") return "Lemondva";
  return status || "Ismeretlen";
}

function escapeHtml(str) {
  return String(str ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function renderRow(r) {
  // Ezeket a backend JOIN-ból küldje vissza:
  // r.id, r.restaurantName, r.userName, r.userEmail, r.date, r.time, r.peopleCount, r.status
  const id = r.id;
  const restaurantName = escapeHtml(r.restaurantName ?? "Ismeretlen étterem");
  const userName = escapeHtml(r.userName ?? "Ismeretlen felhasználó");
  const userEmail = escapeHtml(r.userEmail ?? "");
  const date = escapeHtml(r.date ?? "");
  const time = escapeHtml(r.time ?? "");
  const peopleCount = escapeHtml(r.peopleCount ?? "");
  const status = String(r.status ?? "pending").toLowerCase();

  return `
    <div class="restaurant-card" data-id="${id}">
      <div class="restaurant-name">${restaurantName}</div>
      <div class="restaurant-meta">
        <span>${date}</span>
        ${time ? `<span>• ${time}</span>` : ""}
        ${peopleCount ? `<span>• ${peopleCount} fő</span>` : ""}
      </div>
      <div class="restaurant-meta">
        <span>${userName}</span>
        ${userEmail ? `<span>• ${userEmail}</span>` : ""}
      </div>

      <div style="display:flex; gap:10px; align-items:center; margin-top:10px;">
        <select class="input statusSelect" style="flex:1;">
          <option value="pending" ${status === "pending" ? "selected" : ""}>Függőben</option>
          <option value="accepted" ${status === "accepted" ? "selected" : ""}>Elfogadva</option>
          <option value="cancelled" ${status === "cancelled" ? "selected" : ""}>Lemondva</option>
        </select>
        <button class="btn small saveBtn">Mentés</button>
      </div>

      <div class="hint" style="margin-top:8px;">Jelenlegi státusz: ${statusHu(status)}</div>
    </div>
  `;
}

function applyClientFilters(rows) {
  const q = qEl.value.trim().toLowerCase();
  const sf = statusFilterEl.value;

  return rows.filter((r) => {
    const hay = `${r.restaurantName ?? ""} ${r.userName ?? ""} ${r.userEmail ?? ""}`.toLowerCase();
    const qOk = !q || hay.includes(q);
    const sOk = !sf || String(r.status).toLowerCase() === sf;
    return qOk && sOk;
  });
}

let allRows = [];

async function loadAllReservations() {
  showError("");
  setLoading(true);
  listEl.innerHTML = "";

  try {
    const rows = await api.getAllReservations(); // admin endpoint
    allRows = Array.isArray(rows) ? rows : [];

    render();

  } catch (err) {
    showError(err.message || "Hiba történt a foglalások betöltése közben.");
  } finally {
    setLoading(false);
  }
}

function render() {
  const rows = applyClientFilters(allRows);

  if (rows.length === 0) {
    listEl.innerHTML = `<div class="hint">Nincs találat.</div>`;
    return;
  }

  listEl.innerHTML = rows.map(renderRow).join("");

  // Mentés gombok
  listEl.querySelectorAll(".restaurant-card").forEach((card) => {
    const id = card.getAttribute("data-id");
    const select = card.querySelector(".statusSelect");
    const saveBtn = card.querySelector(".saveBtn");

    saveBtn.addEventListener("click", async () => {
      showError("");

      const newStatus = select.value;

      try {
        saveBtn.disabled = true;
        saveBtn.textContent = "Mentés...";

        await api.updateReservationStatus(Number(id), newStatus);

        // frissítsük a local listában
        const idx = allRows.findIndex((x) => String(x.id) === String(id));
        if (idx !== -1) allRows[idx].status = newStatus;

        showOk("Státusz mentve!");
        render();

      } catch (err) {
        showError(err.message || "Nem sikerült menteni a státuszt.");
      } finally {
        saveBtn.disabled = false;
        saveBtn.textContent = "Mentés";
      }
    });
  });
}

// szűrők
qEl.addEventListener("input", render);
statusFilterEl.addEventListener("change", render);

loadAllReservations();
