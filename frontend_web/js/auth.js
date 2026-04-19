// Ez a modul a kliens oldali bejelentkezési állapotot és jogosultságokat kezeli.
// Kiolvassa a localStorage-ben tárolt felhasználót.
export function getUser() {
  const raw = localStorage.getItem("user");
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch {
    localStorage.removeItem("user");
    return null;
  }
}

// Elmenti a felhasználó adatait a localStorage-be.
export function setUser(user) {
  localStorage.setItem("user", JSON.stringify(user));
}

// Törli a tárolt felhasználói adatokat a localStorage-ből.
export function clearUser() {
  localStorage.removeItem("user");
}

// Összehangolja a kliens oldali felhasználót a szerver sessionnel.
export async function syncUserWithSession() {
  try {
    const res = await fetch('/api/auth/me', { credentials: 'same-origin' });
    if (!res.ok) {
      clearUser();
      return null;
    }
    const user = await res.json();
    setUser(user);
    return user;
  } catch {
    clearUser();
    return null;
  }
}

// Eldönti, hogy a felhasználó admin jogosultságú-e.
export function isAdminLike(user = getUser()) {
  return String(user?.role || '').toLowerCase() === 'admin';
}

// Szükség esetén átirányítja az admin felhasználót az admin oldalra.
export function redirectAdminUsers(target = 'admin.html') {
  const user = getUser();
  if (isAdminLike(user)) {
    window.location.href = target;
    return true;
  }
  return false;
}

// Kijelentkezteti a felhasználót kliens és szerver oldalon is.
export function logout() {
  try {
    fetch('/api/auth/logout', { method: 'POST', credentials: 'same-origin' }).catch(() => {});
  } catch {}
  clearUser();
  window.location.href = 'login.html';
}

// Védi az oldalt, és átirányít bejelentkezésre, ha nincs session.
export function requireAuth(redirectTo = 'login.html') {
  const user = getUser();
  if (!user) window.location.href = redirectTo;
  return user;
}
