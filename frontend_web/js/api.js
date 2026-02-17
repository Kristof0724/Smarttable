const API_BASE = "/api";

async function request(path, method = "GET", body) {
	const opts = {
		method,
		headers: { "Content-Type": "application/json" },
		credentials: "same-origin",
	};

	if (body) opts.body = JSON.stringify(body);

	const res = await fetch(API_BASE + path, opts);
	const text = await res.text();

	let data = {};
	try {
		data = text ? JSON.parse(text) : {};
	} catch {
		data = { error: text || "Hiba" };
	}

	// Auth handling
	if (res.status === 401) {
		try { localStorage.removeItem("user"); } catch {}
	
		if (!String(window.location.pathname || "").endsWith("login.html")) {
			window.location.href = "login.html";
		}
		throw new Error(data.error || "Nincs bejelentkezve");
	}

	if (res.status === 403) {
		throw new Error(data.error || "Nincs jogosultság");
	}

	if (!res.ok) throw new Error(data.error || "Hálózati hiba");
	return data;
}

export const api = {
	login: (email, password) =>
		request("/auth/login", "POST", { email, password }),
	register: (name, email, password) =>
		request("/auth/register", "POST", { name, email, password }),
	me: () => request("/auth/me"),
	logout: () => request("/auth/logout", "POST"),
	getRestaurants: () => request("/restaurants"),
	getPopularRestaurants: () => request("/restaurants/popular"),
	getTopRestaurants: () => request("/restaurants/top"),
	getRestaurantById: (id) => request(`/restaurants/${id}`),
	getRestaurantTimeSlots: (id, date, peopleCount=1) => request(`/restaurants/${id}/time-slots?date=${encodeURIComponent(date)}&peopleCount=${encodeURIComponent(peopleCount)}`),
	getMenuByRestaurant: (id) => request(`/restaurants/${id}/menu`),
	getDealsByRestaurant: (id) => request(`/restaurants/${id}/deals`),
	getReviews: (id) => request(`/restaurants/${id}/reviews`),
	addReview: (id, payload) => request(`/restaurants/${id}/reviews`, "POST", payload),
	upsertReviewResponse: (reviewId, responseText) => request(`/reviews/${reviewId}/response`, "POST", { responseText }),
	createReservation: (payload) => request("/reservations", "POST", payload),
	getReservationById: (id) => request(`/reservations/${id}`),
	updateReservation: (id, payload) => request(`/reservations/${id}`, "PUT", payload),
	getMyReservations: () => request(`/reservations/me`),
	getAllReservations: () => request("/reservations"),
	updateReservationStatus: (id, status) =>
		request(`/reservations/${id}/status`, "PUT", { status }),
	cancelReservation: (id) => request(`/reservations/${id}/cancel`, "PUT"),
	
	getAdminDashboard: () => request("/admin/dashboard"),
	getAdminReviews: () => request("/admin/reviews"),
	getAdminGuests: (includeAdmins = 0) => request(`/admin/guests?includeAdmins=${encodeURIComponent(includeAdmins)}`),
	
	adminGetMenuItems: (restaurantId) => request(`/admin/menu-items?restaurantId=${encodeURIComponent(restaurantId)}`),
	adminCreateMenuItem: (payload) => request("/admin/menu-items", "POST", payload),
	adminUpdateMenuItem: (id, payload) => request(`/admin/menu-items/${id}`, "PUT", payload),
	adminDeleteMenuItem: (id) => request(`/admin/menu-items/${id}`, "DELETE"),
	adminGetHotDeals: (restaurantId) => request(`/admin/hot-deals?restaurantId=${encodeURIComponent(restaurantId)}`),
	adminCreateHotDeal: (payload) => request("/admin/hot-deals", "POST", payload),
	adminUpdateHotDeal: (id, payload) => request(`/admin/hot-deals/${id}`, "PUT", payload),
	adminDeleteHotDeal: (id) => request(`/admin/hot-deals/${id}`, "DELETE"),
};