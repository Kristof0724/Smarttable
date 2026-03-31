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

export function setUser(user) {
  localStorage.setItem("user", JSON.stringify(user));
}

export function clearUser() {
  localStorage.removeItem("user");
}

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

export function isAdminLike(user = getUser()) {
  return String(user?.role || '').toLowerCase() === 'admin';
}

export function redirectAdminUsers(target = 'admin.html') {
  const user = getUser();
  if (isAdminLike(user)) {
    window.location.href = target;
    return true;
  }
  return false;
}

export function logout() {
  try {
    fetch('/api/auth/logout', { method: 'POST', credentials: 'same-origin' }).catch(() => {});
  } catch {}
  clearUser();
  window.location.href = 'login.html';
}

export function requireAuth(redirectTo = 'login.html') {
  const user = getUser();
  if (!user) window.location.href = redirectTo;
  return user;
}
