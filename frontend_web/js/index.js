import { getUser, logout } from "./auth.js";

const statusEl = document.getElementById("status");
const logoutBtn = document.getElementById("logoutBtn");

const loginLink = document.getElementById("loginLink");
const registerLink = document.getElementById("registerLink");
const myResLink = document.getElementById("myResLink");
const adminLink = document.getElementById("adminLink");

const user = getUser();

function setText(el, txt) {
  if (el) el.textContent = txt;
}

function setVisible(el, visible) {
  if (el) el.style.display = visible ? "inline" : "none";
}

if (!user || !user.id) {
  setText(statusEl, "Nem vagy bejelentkezve.");
  setVisible(logoutBtn, false);
  setVisible(myResLink, true);     // engedheted, de úgyis auth védi majd
  setVisible(adminLink, false);    // ne látszódjon
} else {
  setText(statusEl, `Bejelentkezve: ${user.name} (${user.email})`);
  setVisible(logoutBtn, true);

  // Belépve felesleges a login/reg
  setVisible(loginLink, false);
  setVisible(registerLink, false);

  // Admin link csak adminnak
  setVisible(adminLink, user.role === "admin");
}

logoutBtn?.addEventListener("click", () => {
  logout();
  window.location.reload();
});
