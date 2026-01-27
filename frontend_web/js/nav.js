import { getUser, logout } from "./auth.js";

export function setupLandingNav() {
  const user = getUser();

  const loginLink = document.getElementById("navLogin");
  const registerLink = document.getElementById("navRegister");
  const logoutBtn = document.getElementById("logoutBtn");
  const myRes = document.getElementById("navMyRes");
  const restaurants = document.getElementById("navRestaurants");
  const admin = document.getElementById("adminBtn");

  if (user) {
    if (loginLink) loginLink.style.display = "none";
    if (registerLink) registerLink.style.display = "none";
    if (logoutBtn) logoutBtn.style.display = "inline-flex";
    if (myRes) myRes.style.display = "inline-flex";
    if (restaurants) restaurants.style.display = "inline-flex";
    if (admin && user.role === "admin") admin.style.display = "inline-flex";
  } else {
    if (logoutBtn) logoutBtn.style.display = "none";
    if (myRes) myRes.style.display = "none";
    if (restaurants) restaurants.style.display = "none";
    if (admin) admin.style.display = "none";
  }

  if (logoutBtn) logoutBtn.addEventListener("click", () => logout());
}
