export function getUser() {
  const raw = localStorage.getItem("user");
  return raw ? JSON.parse(raw) : null;
}
export function setUser(user) {
  localStorage.setItem("user", JSON.stringify(user));
}
export function logout() {
  localStorage.removeItem("user");
  window.location.href = "login.html";
}
export function requireAuth() {
  const u = getUser();
  if (!u) window.location.href = "login.html";
  return u;
}
