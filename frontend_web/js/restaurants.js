// Ez a modul az éttermek listáját és az oldal navigációs állapotát kezeli.
import { api } from './api.js';
import { logout, redirectAdminUsers, syncUserWithSession, getUser } from './auth.js';

redirectAdminUsers();

const listEl = document.getElementById('list');
const errEl = document.getElementById('err');
const loadingEl = document.getElementById('loading');
const leftNavEl = document.getElementById('restaurantsLeftNav');
const sessionActionsEl = document.getElementById('restaurantsSessionActions');

// Eldönti, hogy normál bejelentkezett felhasználóról van-e szó.
function isLoggedUser(user) {
  return !!user && String(user.role || '').toLowerCase() !== 'admin';
}

// HTML-biztosra alakítja a kiírt szöveget.
function escapeHtml(str) {
  return String(str ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

// A felhasználó állapota alapján felépíti az oldal navigációját.
function renderNav(user) {
  const logged = isLoggedUser(user);
  if (leftNavEl) {
    leftNavEl.innerHTML = `
      <li class="nav-item"><a class="nav-link" href="index.html">Kezdőlap</a></li>
      <li class="nav-item"><a class="nav-link active" href="restaurants.html">Éttermek</a></li>
      ${logged ? '<li class="nav-item"><a class="nav-link" href="my_reservations.html">Foglalásaim</a></li>' : ''}
    `;
  }
  if (sessionActionsEl) {
    sessionActionsEl.innerHTML = logged ? `<button id="logoutBtn" class="btn btn-outline-secondary st-nav-action-btn st-logout-btn"><i class="bi bi-box-arrow-right"></i>Kijelentkezés</button>` : '';
    document.getElementById('logoutBtn')?.addEventListener('click', (e) => {
      e.preventDefault();
      logout();
    });
  }
}

// Frissíti a navigációt a szerveroldali session alapján is.
async function applyNavState() {
  renderNav(getUser());
  const user = await syncUserWithSession();
  renderNav(user);
}

// Megjeleníti az étteremlista hibaüzenetét.
function showError(msg) {
  errEl.textContent = msg || '';
}

// Frissíti az étteremlista betöltési állapotát.
function setLoading(isLoading) {
  loadingEl.style.display = isLoading ? 'block' : 'none';
}

// Elkészíti a csillagos értékelés HTML-jét.
function starsHtml(avg) {
  const a = Number(avg || 0);
  const full = Math.round(a);
  let out = '';
  for (let i = 1; i <= 5; i++) {
    out += `<i class="bi ${i <= full ? 'bi-star-fill text-warning' : 'bi-star text-warning'}"></i>`;
  }
  return out;
}

// Elkészíti egy étteremkártya HTML-jét.
function cardTemplate(r) {
  const name = r.name ?? 'Névtelen étterem';
  const city = r.city ?? '';
  const cuisine = r.cuisine ?? '';
  let img = r.imageUrl ? String(r.imageUrl) : 'assets/restaurant_sample.png';
  if (img.startsWith('/')) img = img.slice(1);
  const avg = Number(r.avgRating || 0);
  const avgTxt = avg ? avg.toFixed(1) : '—';

  return `
    <div class="col-12 col-md-6 col-xl-4">
      <div class="restaurant-card card h-100" data-id="${r.id}">
        <img class="restaurant-img" src="${img}" alt="${escapeHtml(name)}" onerror="this.onerror=null;this.src='assets/restaurant_sample.png';">
        <div class="card-body d-flex flex-column">
          <div class="d-flex justify-content-between align-items-start gap-2">
            <div class="restaurant-name card-title mb-1">${escapeHtml(name)}</div>
            <span class="badge text-bg-light border">${starsHtml(avg)} <span class="ms-1">${avgTxt}</span></span>
          </div>
          <div class="restaurant-meta">${escapeHtml([city, cuisine].filter(Boolean).join(' • '))}</div>
        </div>
      </div>
    </div>
  `;
}

// Betölti és kirajzolja az éttermek listáját.
async function loadRestaurants() {
  showError('');
  setLoading(true);
  try {
    const restaurants = await api.getRestaurants();
    listEl.innerHTML = '';
    if (!restaurants || restaurants.length === 0) {
      listEl.innerHTML = '<div class="hint">Nincs megjeleníthető étterem.</div>';
      return;
    }
    listEl.innerHTML = restaurants.map(cardTemplate).join('');
    listEl.querySelectorAll('.restaurant-card').forEach((cardEl) => {
      cardEl.addEventListener('click', () => {
        const id = cardEl.getAttribute('data-id');
        window.location.href = `restaurant.html?id=${encodeURIComponent(id)}`;
      });
    });
  } catch (err) {
    showError(err.message || 'Hiba történt az éttermek betöltése közben.');
  } finally {
    setLoading(false);
  }
}

applyNavState();
loadRestaurants();
