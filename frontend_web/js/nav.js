import { getUser, logout, isAdminLike, syncUserWithSession } from './auth.js';

function render(user) {
  const leftNav = document.getElementById('landingLeftNav');
  const rightNav = document.getElementById('landingRightNav');
  if (!leftNav || !rightNav) return;

  const isLogged = !!user && !isAdminLike(user);

  leftNav.innerHTML = `
    <li class="nav-item"><a class="nav-link active" href="index.html">Kezdőlap</a></li>
    <li class="nav-item"><a class="nav-link" href="restaurants.html">Éttermek</a></li>
    ${isLogged ? '<li class="nav-item"><a class="nav-link" href="my_reservations.html">Foglalásaim</a></li>' : ''}
  `;

  if (isLogged) {
    rightNav.innerHTML = `<button class="btn btn-outline-light st-auth-btn" id="logoutBtn"><i class="bi bi-box-arrow-right"></i><span>Kijelentkezés</span></button>`;
    document.getElementById('logoutBtn')?.addEventListener('click', (e) => {
      e.preventDefault();
      logout();
    });
    return;
  }

  rightNav.innerHTML = `
    <a class="btn btn-primary st-auth-btn" href="register.html"><i class="bi bi-person-plus"></i><span>Regisztráció</span></a>
    <a class="btn btn-outline-light st-auth-btn" href="login.html"><i class="bi bi-box-arrow-in-right"></i><span>Bejelentkezés</span></a>
  `;
}

export async function setupLandingNav() {
  const cachedUser = getUser();
  if (isAdminLike(cachedUser)) {
    window.location.href = 'admin.html';
    return;
  }
  render(cachedUser);
  const user = await syncUserWithSession();
  if (isAdminLike(user)) {
    window.location.href = 'admin.html';
    return;
  }
  render(user);
}
