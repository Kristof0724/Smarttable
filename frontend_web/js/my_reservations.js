import { api } from "./api.js";
import { requireAuth, logout, getUser } from "./auth.js";

requireAuth();

const listEl = document.getElementById("list");
const errEl = document.getElementById("err");
const loadingEl = document.getElementById("loading");
const logoutBtn = document.getElementById("logoutBtn");


function showError(msg) {
	if (!errEl) return;
	errEl.textContent = msg || "";
}

function setLoading(isLoading) {
	if (!loadingEl) return;
	loadingEl.style.display = isLoading ? "block" : "none";
}


const toastContainer = document.getElementById("toastContainer");


const pendingCancelTimers = new Map();
const pendingCancelPrevStatus = new Map();

function showToast(message, variant = "success", action) {
	if (!toastContainer) return;
	const id = `t_${Date.now()}_${Math.floor(Math.random() * 1000)}`;
	const bg =
		variant === "danger"
			? "text-bg-danger"
			: variant === "warning"
				? "text-bg-warning"
				: "text-bg-success";

	const hasAction = action && action.label && typeof action.onClick === "function";
	const actionBtn = hasAction
		? `<button type="button" class="btn btn-sm btn-light ms-2 toastActionBtn">${escapeHtml(action.label)}</button>`
		: "";

	const html = `
	<div id="${id}" class="toast align-items-center ${bg} border-0" role="alert" aria-live="assertive" aria-atomic="true">
		<div class="d-flex">
			<div class="toast-body d-flex align-items-center">
				<span>${escapeHtml(message)}</span>
				${actionBtn}
			</div>
			<button type="button" class="btn-close btn-close-white me-2 m-auto" data-bs-dismiss="toast" aria-label="Close"></button>
		</div>
	</div>`;
	toastContainer.insertAdjacentHTML("beforeend", html);
	const el = document.getElementById(id);

	if (hasAction) {
		const btn = el?.querySelector(".toastActionBtn");
		btn?.addEventListener("click", () => {
			try {
				action.onClick();
			} finally {
				
				try {
					window.bootstrap?.Toast.getOrCreateInstance(el)?.hide();
				} catch {}
			}
		});
	}

	try {
		const delay = hasAction ? 5200 : 2200;
		const t = new window.bootstrap.Toast(el, { delay });
		t.show();
		el.addEventListener("hidden.bs.toast", () => el.remove());
	} catch {
		setTimeout(() => el?.remove(), hasAction ? 5500 : 2500);
	}
}

function statusMeta(status) {
	const s = String(status || "").toLowerCase();
	if (s === "accepted" || s === "approved") return { label: "Elfogadva", badge: "text-bg-success" };
	if (s === "rejected") return { label: "Elutasítva", badge: "text-bg-danger" };
	if (s === "cancelled" || s === "canceled") return { label: "Lemondva", badge: "text-bg-secondary" };
	if (s === "completed") return { label: "Teljesítve", badge: "text-bg-primary" };
	if (s === "cancelling") return { label: "Lemondás…", badge: "text-bg-secondary" };
	return { label: "Függőben", badge: "text-bg-warning" };
}

function escapeHtml(str) {
	return String(str ?? "")
		.replaceAll("&", "&amp;")
		.replaceAll("<", "&lt;")
		.replaceAll(">", "&gt;")
		.replaceAll('"', "&quot;")
		.replaceAll("'", "&#039;");
}

function reservationCard(r) {
	const id = r.id;
	const restaurantName = r.restaurantName || r.restaurant_name || r.name || null;
	const restaurantText = restaurantName
		? escapeHtml(restaurantName)
		: `Étterem ID: ${escapeHtml(r.restaurantId ?? r.restaurant_id ?? "?")}`;

	const date = escapeHtml(r.date || "");
	const time = escapeHtml(r.time || "");
	const people = escapeHtml(r.peopleCount ?? r.people_count ?? "");
	const rawStatus = String(r.status || "pending").toLowerCase();
	const sm = statusMeta(rawStatus);

	const canCancel = rawStatus === "pending" || rawStatus === "accepted";

		return `
	    <div class="col-12 col-md-6">
	      <div class="restaurant-card card" data-id="${id}" data-status="${rawStatus}">
	        <div class="card-body d-flex flex-column">
          <div class="d-flex justify-content-between align-items-start gap-2">
            <div class="restaurant-name mb-1">${restaurantText}</div>
            <span class="badge ${sm.badge}">${sm.label}</span>
          </div>

	          <div class="restaurant-meta mb-2">
	            ${[date, time ? time : null, people ? `${people} fő` : null].filter(Boolean).join(" • ")}
	          </div>

	          <div class="d-flex gap-2 mt-3 myres-actions">
            <a class="btn btn-outline-secondary w-100" href="reservations.html?edit=${id}"><i class="bi bi-pencil-square me-1"></i>Módosítás</a>
            ${
				canCancel
					? `<button class="btn btn-outline-danger w-100 cancelBtn"><i class="bi bi-x-circle me-1"></i>Lemondás</button>`
					: `<button class="btn btn-outline-danger w-100" disabled><i class="bi bi-x-circle me-1"></i>Lemondás</button>`
			}
          </div>
        </div>
      </div>
    </div>
  `;
}

let allRows = [];







function bindCancelButtons() {
	listEl.querySelectorAll(".cancelBtn").forEach((btn) => {
		btn.addEventListener("click", async () => {
			showError("");
			const card = btn.closest(".restaurant-card");
			const id = Number(card?.getAttribute("data-id"));
			if (!id) return;

			
			if (pendingCancelTimers.has(id)) return;

			
			const idx = allRows.findIndex((x) => Number(x.id) === Number(id));
			if (idx === -1) return;

			const prev = String(allRows[idx].status || "pending");
			pendingCancelPrevStatus.set(id, prev);
			allRows[idx].status = "cancelling";
			render();

		
			const timer = setTimeout(async () => {
				pendingCancelTimers.delete(id);
				try {
					await api.cancelReservation(id);
					const ix = allRows.findIndex((x) => Number(x.id) === Number(id));
					if (ix !== -1) allRows[ix].status = "cancelled";
					pendingCancelPrevStatus.delete(id);
					showToast("Foglalás lemondva.");
					render();
				} catch (err) {
					
					const ix = allRows.findIndex((x) => Number(x.id) === Number(id));
					if (ix !== -1) allRows[ix].status = pendingCancelPrevStatus.get(id) || "pending";
					pendingCancelPrevStatus.delete(id);
					showError(err.message || "Nem sikerült lemondani a foglalást.");
					showToast("Nem sikerült lemondani.", "danger");
					render();
				}
			}, 5000);

			pendingCancelTimers.set(id, timer);

			showToast("Foglalás lemondása 5 mp múlva…", "warning", {
				label: "Visszavonás",
				onClick: () => {
					const t = pendingCancelTimers.get(id);
					if (t) clearTimeout(t);
					pendingCancelTimers.delete(id);
					const ix = allRows.findIndex((x) => Number(x.id) === Number(id));
					if (ix !== -1) allRows[ix].status = pendingCancelPrevStatus.get(id) || "pending";
					pendingCancelPrevStatus.delete(id);
					showToast("Lemondás visszavonva.", "success");
					render();
				},
			});
		});
	});
}

function render() {
	if (!allRows || allRows.length === 0) {
		listEl.innerHTML = `<div class="hint">Még nincs foglalásod.</div>`;
		return;
	}

	listEl.innerHTML = allRows.map(reservationCard).join("");
	bindCancelButtons();
		}

async function loadMyReservations() {
	showError("");
	setLoading(true);
	listEl.innerHTML = "";

	try {
		const user = getUser();
		const userId = user?.id;

		if (!userId) {
			showError("Nincs bejelentkezett felhasználó.");
			return;
		}

		const reservations = await api.getMyReservations();
		allRows = Array.isArray(reservations) ? reservations : [];
		render();
	} catch (err) {
		showError(err.message || "Hiba történt a foglalások betöltése közben.");
	} finally {
		setLoading(false);
	}
}

loadMyReservations();
