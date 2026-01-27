import { getUser } from "./auth.js";
import { getUser } from "./auth.js";

// ✅ automatikus host (LAN + telefon kompatibilis)
const API_BASE = `${location.protocol}//${location.hostname}:5000/api`;

async function request(path, method = "GET", body) {
  const user = getUser();
  const opts = { method, headers: { "Content-Type": "application/json" } };

  // admin/jogosultság header, ha van user
  if (user && user.id) {
    opts.headers["X-User-Id"] = String(user.id);
  }

  if (body) opts.body = JSON.stringify(body);

  const res = await fetch(API_BASE + path, opts);
  const text = await res.text();

  let data = {};
  try {
    data = text ? JSON.parse(text) : {};
  } catch {
    data = { error: text || "Hiba" };
  }

  if (!res.ok) throw new Error(data.error || "Hálózati hiba");
  return data;
}

export const api = {
  login: (email, password) => request("/auth/login", "POST", { email, password }),
  register: (name, email, password) => request("/auth/register", "POST", { name, email, password }),
  getRestaurants: () => request("/restaurants"),
  getRestaurantById: (id) => request(`/restaurants/${id}`),
  createReservation: (payload) => request("/reservations", "POST", payload),
  getMyReservations: (userId) => request(`/reservations/user/${userId}`),
  getAllReservations: () => request("/reservations"),
  updateReservationStatus: (id, status) => request(`/reservations/${id}/status`, "PUT", { status }),
};
