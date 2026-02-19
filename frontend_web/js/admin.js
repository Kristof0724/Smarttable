import { api } from "./api.js";
import { requireAuth, logout, getUser } from "./auth.js";

requireAuth();

const user = getUser();
if (!user || user.role !== "admin") {
	window.location.href = "restaurants.html";
}


const errEl = document.getElementById("err");
const okEl = document.getElementById("ok");
const logoutBtn = document.getElementById("logoutBtn");

function showError(msg) {
	errEl.textContent = msg || "";
}

function showOk(msg) {
	okEl.textContent = msg || "";
	if (msg) setTimeout(() => (okEl.textContent = ""), 1500);
}

logoutBtn?.addEventListener("click", () => {
	logout();
	window.location.href = "login.html";
});

function escapeHtml(str) {
	return String(str ?? "")
		.replaceAll("&", "&amp;")
		.replaceAll("<", "&lt;")
		.replaceAll(">", "&gt;")
		.replaceAll('"', "&quot;")
		.replaceAll("'", "&#039;");
}

function starsHtml(rating) {
	const r = Math.max(0, Math.min(5, Number(rating) || 0));
	let out = "";
	for (let i = 1; i <= 5; i++) {
		out += `<i class="bi bi-star-fill ${i <= r ? "text-warning" : "text-secondary"}" style="opacity:${i <= r ? 1 : 0.25}"></i>`;
	}
	return out;
}

function statusHu(status) {
	const s = String(status || "").toLowerCase();
	if (s === "pending") return "Függőben";
	if (s === "accepted" || s === "approved") return "Elfogadva";
	if (s === "rejected") return "Elutasítva";
	if (s === "cancelled" || s === "canceled") return "Lemondva";
	if (s === "completed") return "Teljesítve";
	return status || "Ismeretlen";
}


const navLinks = Array.from(document.querySelectorAll("[data-nav]"));
function setActiveNav(key) {
	navLinks.forEach((a) => a.classList.toggle("active", a.getAttribute("data-nav") === key));
}

function ensureSectionOpen(key) {
	
	try {
		const map = {
			reservations: "collapseReservations",
			reviews: "collapseReviews",
			menu: "collapseMenu",
			guests: "collapseGuests",
		};
		const targetId = map[key];
		if (targetId) {
			const el = document.getElementById(targetId);
			if (el && window.bootstrap?.Collapse) {
				new window.bootstrap.Collapse(el, { toggle: false }).show();
			}
		}
	} catch {}
}

navLinks.forEach((a) => {
	a.addEventListener("click", () => {
		const key = a.getAttribute("data-nav") || "dash";
		setActiveNav(key);
		ensureSectionOpen(key);
	});
});


document.addEventListener("click", (e) => {
	const el = e.target?.closest?.("[data-nav]");
	if (!el) return;
	const key = el.getAttribute("data-nav");
	if (!key) return;
	setActiveNav(key);
	ensureSectionOpen(key);
});

const refreshDashBtn = document.getElementById("refreshDashBtn");
const mToday = document.getElementById("mToday");
const mPending = document.getElementById("mPending");
const mNext2 = document.getElementById("mNext2");
const mOcc = document.getElementById("mOcc");
const mTodayBar = document.getElementById("mTodayBar");
const mPendingBar = document.getElementById("mPendingBar");
const mNext2Bar = document.getElementById("mNext2Bar");
const mOccBar = document.getElementById("mOccBar");
const hourlyBars = document.getElementById("hourlyBars");
const alertsEl = document.getElementById("alerts");
const recentReservationsEl = document.getElementById("recentReservations");
const recentReviewsEl = document.getElementById("recentReviews");
const refreshEventsBtn = document.getElementById("refreshEventsBtn");

function setBar(el, percent) {
	if (!el) return;
	const p = Math.max(0, Math.min(100, Math.round(percent || 0)));
	el.style.width = `${p}%`;
}

function renderHourly(load) {
	if (!hourlyBars) return;
	const arr = Array.isArray(load) ? load : [];
	const max = Math.max(1, ...arr.map((x) => Number(x.people) || 0));
	hourlyBars.innerHTML = arr
		.map((x) => {
			const people = Number(x.people) || 0;
			const h = Number(x.hour) || 0;
			const heightPx = Math.max(6, Math.round((people / max) * 150));
			return `
			<div class="st-bar-col" title="${h}:00 - ${people} fő">
				<div class="st-bar" style="height:${heightPx}px"></div>
				<div class="st-bar-label">${h}</div>
			</div>`;
		})
		.join("");
}

function renderAlerts(alerts) {
	if (!alertsEl) return;
	const arr = Array.isArray(alerts) ? alerts : [];
	const iconFor = (t) => {
		if (t === "warning") return "bi-exclamation-triangle";
		if (t === "info") return "bi-bell";
		return "bi-check-circle";
	};
	alertsEl.innerHTML = arr
		.map((a) => {
			const type = a.type || "success";
			return `
			<div class="st-alert ${type}">
				<i class="bi ${iconFor(type)}" style="font-size:1.1rem; margin-top:1px;"></i>
				<div class="fw-semibold">${escapeHtml(a.text || "")}</div>
			</div>`;
		})
		.join("");
}

function renderRecentEvents(events) {
  const arr = Array.isArray(events) ? events : [];
  if (!recentReservationsEl || !recentReviewsEl) return;

  const fmtTime = (s) => {
    const t = String(s || "").trim();
    if (!t) return "";
    return t.length > 16 ? t.slice(0, 16) : t;
  };

  const reservations = arr.filter((e) => String(e.kind || "").toLowerCase() !== "review").slice(0, 6);
  const reviews = arr.filter((e) => String(e.kind || "").toLowerCase() === "review").slice(0, 6);

  if (reservations.length === 0) {
    recentReservationsEl.innerHTML = `<div class="text-secondary small">Nincs foglalás esemény.</div>`;
  } else {
    recentReservationsEl.innerHTML = reservations
      .map((e) => {
        const userName = escapeHtml(e.userName || "");
        const restaurantName = escapeHtml(e.restaurantName || "");
        const d = escapeHtml(e.date || "");
        const tm = escapeHtml(e.time || "");
        const pc = escapeHtml(e.peopleCount || "");
        const t = escapeHtml(fmtTime(e.createdAt));
        return `
        <div class="st-recent-item">
          <div class="st-recent-ico blue"><i class="bi bi-calendar2-check"></i></div>
          <div class="st-recent-main">
            <div class="st-recent-title">Foglalás</div>
            <div class="st-recent-sub">${userName || "–"} — ${restaurantName || ""}</div>
            <div class="st-recent-sub2">${d}${tm ? " • " + tm : ""}${pc ? " • " + pc + " fő" : ""}</div>
          </div>
          <div class="st-recent-meta">
            <div class="st-recent-time">${t}</div>
          </div>
        </div>`;
      })
      .join("");
  }

  if (reviews.length === 0) {
    recentReviewsEl.innerHTML = `<div class="text-secondary small">Nincs review esemény.</div>`;
  } else {
    recentReviewsEl.innerHTML = reviews
      .map((e) => {
        const userName = escapeHtml(e.userName || "");
        const restaurantName = escapeHtml(e.restaurantName || "");
        const t = escapeHtml(fmtTime(e.createdAt));
        const rating = starsHtml(e.rating);
        return `
        <div class="st-recent-item">
          <div class="st-recent-ico gold"><i class="bi bi-star-fill"></i></div>
          <div class="st-recent-main">
            <div class="st-recent-title">${userName || "–"}</div>
            <div class="st-recent-sub">${restaurantName || ""}</div>
            <div class="st-recent-stars">${rating}</div>
          </div>
          <div class="st-recent-meta">
            <div class="st-recent-time">${t}</div>
          </div>
        </div>`;
      })
      .join("");
  }
}

async function loadDashboard() {
	showError("");
	try {
		const data = await api.getAdminDashboard();
		const today = Number(data.todayReservations) || 0;
		const pending = Number(data.pendingReservations) || 0;
		const next2 = Number(data.next2Hours) || 0;
		const occ = Number(data.occupancyPercent) || 0;

		if (mToday) mToday.textContent = String(today);
		if (mPending) mPending.textContent = String(pending);
		if (mNext2) mNext2.textContent = String(next2);
		if (mOcc) mOcc.textContent = String(occ);

		
		const base = Math.max(1, today);
		setBar(mTodayBar, Math.min(100, (today / base) * 100));
		setBar(mPendingBar, Math.min(100, (pending / base) * 100));
		setBar(mNext2Bar, Math.min(100, (next2 / base) * 100));
		setBar(mOccBar, occ);

		renderHourly(data.hourlyLoad);
		renderAlerts(data.alerts);
		renderRecentEvents(data.recentEvents);
	} catch (e) {
		showError(e.message || "Nem sikerült betölteni a dashboardot.");
	}
}

refreshDashBtn?.addEventListener("click", loadDashboard);
refreshEventsBtn?.addEventListener("click", loadDashboard);


const loadingEl = document.getElementById("loading");
const listEl = document.getElementById("list");
const qEl = document.getElementById("q");
const statusFilterEl = document.getElementById("statusFilter");
const refreshReservationsBtn = document.getElementById("refreshReservationsBtn");

function setLoading(isLoading) {
	if (!loadingEl) return;
	loadingEl.style.display = isLoading ? "block" : "none";
}

function renderReservationCard(r) {
	const id = r.id;
	const restaurantName = escapeHtml(r.restaurantName ?? "Ismeretlen étterem");
	const userName = escapeHtml(r.userName ?? "Ismeretlen felhasználó");
	const userEmail = escapeHtml(r.userEmail ?? "");
	const date = escapeHtml(r.date ?? "");
	const time = escapeHtml(r.time ?? "");
	const peopleCount = escapeHtml(r.peopleCount ?? "");
	const status = String(r.status ?? "pending").toLowerCase();

	return `
	<div class="col-12 col-lg-6">
		<div class="restaurant-card card h-100" data-id="${id}">
			<div class="card-body">
				<div class="restaurant-name card-title mb-2">${restaurantName}</div>
				<div class="restaurant-meta">
					<span>${date}</span>
					${time ? `<span>• ${time}</span>` : ""}
					${peopleCount ? `<span>• ${peopleCount} fő</span>` : ""}
				</div>
				<div class="restaurant-meta">
					<span>${userName}</span>
					${userEmail ? `<span>• ${userEmail}</span>` : ""}
				</div>

				<div style="display:flex; gap:10px; align-items:center; margin-top:10px;">
					<select class="form-select statusSelect" style="flex:1;">
						<option value="pending" ${status === "pending" ? "selected" : ""}>Függőben</option>
						<option value="accepted" ${status === "accepted" ? "selected" : ""}>Elfogadva</option>
						<option value="rejected" ${status === "rejected" ? "selected" : ""}>Elutasítva</option>
						<option value="cancelled" ${status === "cancelled" ? "selected" : ""}>Lemondva</option>
						<option value="completed" ${status === "completed" ? "selected" : ""}>Teljesítve</option>
					</select>
					<button class="btn btn-outline-primary saveBtn">Mentés</button>
				</div>

				<div class="hint" style="margin-top:8px;">Jelenlegi státusz: ${statusHu(status)}</div>
			</div>
		</div>
	</div>`;
}

function applyClientFilters(rows) {
	const q = (qEl?.value || "").trim().toLowerCase();
	const sf = statusFilterEl?.value || "";

	return rows.filter((r) => {
		const hay = `${r.restaurantName ?? ""} ${r.userName ?? ""} ${r.userEmail ?? ""}`.toLowerCase();
		const qOk = !q || hay.includes(q);
		const sOk = !sf || String(r.status).toLowerCase() === sf;
		return qOk && sOk;
	});
}

let allRows = [];

function wireReservationActions() {
	listEl?.querySelectorAll(".restaurant-card").forEach((card) => {
		const id = Number(card.getAttribute("data-id"));
		const select = card.querySelector(".statusSelect");
		const saveBtn = card.querySelector(".saveBtn");

		saveBtn?.addEventListener("click", async () => {
			showError("");
			const newStatus = select?.value || "pending";
			try {
				saveBtn.disabled = true;
				saveBtn.textContent = "Mentés...";
				await api.updateReservationStatus(id, newStatus);
				const idx = allRows.findIndex((x) => Number(x.id) === id);
				if (idx !== -1) allRows[idx].status = newStatus;
				showOk("Státusz mentve!");
				await loadDashboard();
				renderReservations();
			} catch (e) {
				showError(e.message || "Nem sikerült menteni a státuszt.");
			} finally {
				saveBtn.disabled = false;
				saveBtn.textContent = "Mentés";
			}
		});
	});
}

function renderReservations() {
	if (!listEl) return;
	const rows = applyClientFilters(allRows);
	if (rows.length === 0) {
		listEl.innerHTML = `<div class="hint">Nincs találat.</div>`;
		return;
	}
	listEl.innerHTML = rows.map(renderReservationCard).join("");
	wireReservationActions();
}

async function loadAllReservations() {
	showError("");
	setLoading(true);
	if (listEl) listEl.innerHTML = "";
	try {
		const rows = await api.getAllReservations();
		allRows = Array.isArray(rows) ? rows : [];
		renderReservations();
	} catch (e) {
		showError(e.message || "Hiba történt a foglalások betöltése közben.");
	} finally {
		setLoading(false);
	}
}

qEl?.addEventListener("input", renderReservations);
statusFilterEl?.addEventListener("change", renderReservations);
refreshReservationsBtn?.addEventListener("click", loadAllReservations);


const refreshReviewsBtn = document.getElementById("refreshReviewsBtn");
const reviewsLoadingEl = document.getElementById("reviewsLoading");
const reviewsListEl = document.getElementById("reviewsList");

function setReviewsLoading(isLoading) {
	if (!reviewsLoadingEl) return;
	reviewsLoadingEl.style.display = isLoading ? "block" : "none";
}

function renderReviewRow(rv) {
	const id = rv.id;
	const restaurant = escapeHtml(rv.restaurantName ?? "");
	const userName = escapeHtml(rv.userName ?? "");
	const userEmail = escapeHtml(rv.userEmail ?? "");
	const created = escapeHtml((rv.createdAt || "").toString());
	const rating = Number(rv.rating) || 0;
	const comment = escapeHtml(rv.comment ?? "");
	const hasResp = !!rv.responseText;
	const respText = escapeHtml(rv.responseText ?? "");
	const respAdmin = escapeHtml(rv.adminName ?? "");
	const respCreated = escapeHtml((rv.responseCreatedAt || "").toString());

	return `
	<div class="border rounded-3 p-3 mb-2">
		<div class="d-flex justify-content-between gap-2 align-items-start">
			<div>
				<div class="fw-bold">${restaurant}</div>
				<div class="small text-secondary">${userName}${userEmail ? ` • ${userEmail}` : ""}</div>
			</div>
			<div class="text-nowrap">${starsHtml(rating)}</div>
		</div>
		${created ? `<div class="small text-secondary mt-1">${created}</div>` : ""}
		${comment ? `<div class="mt-2">${comment}</div>` : ""}

		${hasResp ? `
		<div class="mt-3 p-2 rounded-3" style="background:#f1f5f9; border:1px solid rgba(2,6,23,.08);">
			<div class="d-flex align-items-center gap-2 mb-1">
				<span class="badge text-bg-success">Admin válasz</span>
				${respCreated ? `<span class="small text-secondary">${respCreated}</span>` : ""}
				${respAdmin ? `<span class="small text-secondary">• ${respAdmin}</span>` : ""}
			</div>
			<div>${respText}</div>
		</div>` : ""}

		<div class="mt-3">
			<textarea class="form-control" rows="2" data-review-response="${id}" placeholder="Írj admin választ...">${respText}</textarea>
			<div class="d-grid mt-2">
				<button class="btn btn-sm btn-outline-success" data-review-response-btn="${id}"><i class="bi bi-reply"></i> ${hasResp ? "Válasz frissítése" : "Válasz küldése"}</button>
			</div>
		</div>
	</div>`;
}

async function loadAdminReviews() {
	showError("");
	setReviewsLoading(true);
	if (reviewsListEl) reviewsListEl.innerHTML = "";
	try {
		const rows = await api.getAdminReviews();
		const list = Array.isArray(rows) ? rows : [];
		
		list.sort((a, b) => {
			const ar = a.responseText ? 1 : 0;
			const br = b.responseText ? 1 : 0;
			return ar - br;
		});
		if (!reviewsListEl) return;
		if (list.length === 0) {
			reviewsListEl.innerHTML = `<div class="hint">Nincs vélemény.</div>`;
			return;
		}
		reviewsListEl.innerHTML = list.map(renderReviewRow).join("");

		
		reviewsListEl.querySelectorAll("[data-review-response-btn]").forEach((btn) => {
			btn.addEventListener("click", async () => {
				const rid = btn.getAttribute("data-review-response-btn");
				const ta = reviewsListEl.querySelector(`[data-review-response="${rid}"]`);
				const val = (ta?.value || "").trim();
				if (!val) {
					alert("A válasz nem lehet üres.");
					return;
				}
				try {
					btn.disabled = true;
					await api.upsertReviewResponse(Number(rid), val);
					showOk("Válasz mentve!");
					await Promise.all([loadAdminReviews(), loadDashboard()]);
				} catch (e) {
					showError(e.message || "Hiba a válasz mentésekor.");
				} finally {
					btn.disabled = false;
				}
			});
		});
	} catch (e) {
		showError(e.message || "Hiba történt a vélemények betöltése közben.");
	} finally {
		setReviewsLoading(false);
	}
}

refreshReviewsBtn?.addEventListener("click", loadAdminReviews);


const refreshMenuBtn = document.getElementById("refreshMenuBtn");
const menuRestaurantSel = document.getElementById("menuRestaurant");
const menuItemsListEl = document.getElementById("menuItemsList");
const hotDealsListEl = document.getElementById("hotDealsList");


const miCategory = document.getElementById("miCategory");
const miName = document.getElementById("miName");
const miDesc = document.getElementById("miDesc");
const miPrice = document.getElementById("miPrice");
const addMenuItemBtn = document.getElementById("addMenuItemBtn");


const hdName = document.getElementById("hdName");
const hdDesc = document.getElementById("hdDesc");
const hdOrig = document.getElementById("hdOrig");
const hdDeal = document.getElementById("hdDeal");
const addHotDealBtn = document.getElementById("addHotDealBtn");

let adminRestaurants = [];
let currentRestId = null;

function renderAdminRestaurantOptions() {
  if (!menuRestaurantSel) return;
  menuRestaurantSel.innerHTML = adminRestaurants
    .map((r) => `<option value="${r.id}">${escapeHtml(r.name)} (${escapeHtml(r.city||"")})</option>`)
    .join("");
}

function renderMenuItemCard(mi) {
  const id = Number(mi.id);
  return `
  <div class="border rounded-3 p-3">
    <div class="d-flex justify-content-between gap-2">
      <div>
        <div class="fw-bold">${escapeHtml(mi.name)}</div>
        <div class="small text-secondary">${escapeHtml(mi.category)} • ${escapeHtml(mi.priceHuf)} Ft</div>
        ${mi.description ? `<div class="mt-1">${escapeHtml(mi.description)}</div>` : ""}
      </div>
      <div class="d-flex gap-2 align-items-start">
        <button class="btn btn-sm btn-outline-secondary" data-mi-edit="${id}"><i class="bi bi-pencil"></i></button>
        <button class="btn btn-sm btn-outline-danger" data-mi-del="${id}"><i class="bi bi-trash"></i></button>
      </div>
    </div>
    <div class="mt-3" style="display:none;" data-mi-editrow="${id}">
      <div class="row g-2">
        <div class="col-md-4"><input class="form-control" data-mi-cat="${id}" value="${escapeHtml(mi.category)}" /></div>
        <div class="col-md-4"><input class="form-control" data-mi-name="${id}" value="${escapeHtml(mi.name)}" /></div>
        <div class="col-md-4"><input class="form-control" type="number" min="0" data-mi-price="${id}" value="${escapeHtml(mi.priceHuf)}" /></div>
        <div class="col-12"><input class="form-control" data-mi-desc="${id}" value="${escapeHtml(mi.description||"")}" placeholder="Leírás" /></div>
        <div class="col-12 d-flex gap-2">
          <button class="btn btn-sm btn-outline-primary" data-mi-save="${id}">Mentés</button>
          <button class="btn btn-sm btn-outline-secondary" data-mi-cancel="${id}">Mégse</button>
        </div>
      </div>
    </div>
  </div>`;
}

function renderHotDealCard(hd) {
  const id = Number(hd.id);
  return `
  <div class="border rounded-3 p-3">
    <div class="d-flex justify-content-between gap-2">
      <div>
        <div class="fw-bold">${escapeHtml(hd.name)}</div>
        <div class="small text-secondary">${escapeHtml(hd.dealPriceHuf)} Ft <span style="opacity:.6; text-decoration:line-through;">${escapeHtml(hd.originalPriceHuf)} Ft</span></div>
        ${hd.description ? `<div class="mt-1">${escapeHtml(hd.description)}</div>` : ""}
      </div>
      <div class="d-flex gap-2 align-items-start">
        <button class="btn btn-sm btn-outline-secondary" data-hd-edit="${id}"><i class="bi bi-pencil"></i></button>
        <button class="btn btn-sm btn-outline-danger" data-hd-del="${id}"><i class="bi bi-trash"></i></button>
      </div>
    </div>
    <div class="mt-3" style="display:none;" data-hd-editrow="${id}">
      <div class="row g-2">
        <div class="col-12"><input class="form-control" data-hd-name="${id}" value="${escapeHtml(hd.name)}" /></div>
        <div class="col-12"><input class="form-control" data-hd-desc="${id}" value="${escapeHtml(hd.description||"")}" placeholder="Leírás" /></div>
        <div class="col-6"><input class="form-control" type="number" min="0" data-hd-orig="${id}" value="${escapeHtml(hd.originalPriceHuf)}" /></div>
        <div class="col-6"><input class="form-control" type="number" min="0" data-hd-deal="${id}" value="${escapeHtml(hd.dealPriceHuf)}" /></div>
        <div class="col-12 d-flex gap-2">
          <button class="btn btn-sm btn-outline-primary" data-hd-save="${id}">Mentés</button>
          <button class="btn btn-sm btn-outline-secondary" data-hd-cancel="${id}">Mégse</button>
        </div>
      </div>
    </div>
  </div>`;
}

async function loadMenuAndDeals() {
  if (!currentRestId) return;
  showError("");
  try {
    const [items, deals] = await Promise.all([
      api.adminGetMenuItems(currentRestId),
      api.adminGetHotDeals(currentRestId),
    ]);

    if (menuItemsListEl) {
      const arr = Array.isArray(items) ? items : [];
      menuItemsListEl.innerHTML = arr.length ? arr.map(renderMenuItemCard).join("") : `<div class="hint">Nincs menütétel.</div>`;
    }
    if (hotDealsListEl) {
      const arr = Array.isArray(deals) ? deals : [];
      hotDealsListEl.innerHTML = arr.length ? arr.map(renderHotDealCard).join("") : `<div class="hint">Nincs hot deal.</div>`;
    }

    wireMenuActions();
  } catch (e) {
    showError(e.message || "Nem sikerült betölteni a menüt/hot dealeket.");
  }
}

function wireMenuActions() {
  
  menuItemsListEl?.querySelectorAll("[data-mi-del]").forEach((btn) => {
    btn.addEventListener("click", async () => {
      const id = Number(btn.getAttribute("data-mi-del"));
      if (!confirm("Biztosan törlöd a menütételt?")) return;
      try {
        btn.disabled = true;
        await api.adminDeleteMenuItem(id);
        showOk("Törölve!");
        await loadMenuAndDeals();
	autoCollapseOnMobile();
      } catch (e) {
        showError(e.message || "Nem sikerült törölni.");
      } finally {
        btn.disabled = false;
      }
    });
  });

  menuItemsListEl?.querySelectorAll("[data-mi-edit]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const id = btn.getAttribute("data-mi-edit");
      const row = menuItemsListEl.querySelector(`[data-mi-editrow="${id}"]`);
      if (!row) return;
      row.style.display = row.style.display === "none" ? "block" : "none";
    });
  });

  menuItemsListEl?.querySelectorAll("[data-mi-cancel]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const id = btn.getAttribute("data-mi-cancel");
      const row = menuItemsListEl.querySelector(`[data-mi-editrow="${id}"]`);
      if (row) row.style.display = "none";
    });
  });

  menuItemsListEl?.querySelectorAll("[data-mi-save]").forEach((btn) => {
    btn.addEventListener("click", async () => {
      const id = Number(btn.getAttribute("data-mi-save"));
      const cat = menuItemsListEl.querySelector(`[data-mi-cat="${id}"]`)?.value || "";
      const name = menuItemsListEl.querySelector(`[data-mi-name="${id}"]`)?.value || "";
      const desc = menuItemsListEl.querySelector(`[data-mi-desc="${id}"]`)?.value || "";
      const price = menuItemsListEl.querySelector(`[data-mi-price="${id}"]`)?.value || "0";
      try {
        btn.disabled = true;
        await api.adminUpdateMenuItem(id, { category: cat, name, description: desc, priceHuf: price });
        showOk("Mentve!");
        await loadMenuAndDeals();
	autoCollapseOnMobile();
      } catch (e) {
        showError(e.message || "Nem sikerült menteni.");
      } finally {
        btn.disabled = false;
      }
    });
  });

  
  hotDealsListEl?.querySelectorAll("[data-hd-del]").forEach((btn) => {
    btn.addEventListener("click", async () => {
      const id = Number(btn.getAttribute("data-hd-del"));
      if (!confirm("Biztosan törlöd a hot dealt?")) return;
      try {
        btn.disabled = true;
        await api.adminDeleteHotDeal(id);
        showOk("Törölve!");
        await loadMenuAndDeals();
	autoCollapseOnMobile();
      } catch (e) {
        showError(e.message || "Nem sikerült törölni.");
      } finally {
        btn.disabled = false;
      }
    });
  });

  hotDealsListEl?.querySelectorAll("[data-hd-edit]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const id = btn.getAttribute("data-hd-edit");
      const row = hotDealsListEl.querySelector(`[data-hd-editrow="${id}"]`);
      if (!row) return;
      row.style.display = row.style.display === "none" ? "block" : "none";
    });
  });

  hotDealsListEl?.querySelectorAll("[data-hd-cancel]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const id = btn.getAttribute("data-hd-cancel");
      const row = hotDealsListEl.querySelector(`[data-hd-editrow="${id}"]`);
      if (row) row.style.display = "none";
    });
  });

  hotDealsListEl?.querySelectorAll("[data-hd-save]").forEach((btn) => {
    btn.addEventListener("click", async () => {
      const id = Number(btn.getAttribute("data-hd-save"));
      const name = hotDealsListEl.querySelector(`[data-hd-name="${id}"]`)?.value || "";
      const desc = hotDealsListEl.querySelector(`[data-hd-desc="${id}"]`)?.value || "";
      const orig = hotDealsListEl.querySelector(`[data-hd-orig="${id}"]`)?.value || "0";
      const deal = hotDealsListEl.querySelector(`[data-hd-deal="${id}"]`)?.value || "0";
      try {
        btn.disabled = true;
        await api.adminUpdateHotDeal(id, { name, description: desc, originalPriceHuf: orig, dealPriceHuf: deal });
        showOk("Mentve!");
        await loadMenuAndDeals();
	autoCollapseOnMobile();
      } catch (e) {
        showError(e.message || "Nem sikerült menteni.");
      } finally {
        btn.disabled = false;
      }
    });
  });
}

async function loadAdminRestaurants() {
  const list = await api.getRestaurants();
  adminRestaurants = Array.isArray(list) ? list : [];
  if (adminRestaurants.length === 0) return;
  renderAdminRestaurantOptions();
  currentRestId = Number(menuRestaurantSel?.value || adminRestaurants[0].id);
}

menuRestaurantSel?.addEventListener("change", async () => {
  currentRestId = Number(menuRestaurantSel.value);
  await loadMenuAndDeals();
	autoCollapseOnMobile();
});

refreshMenuBtn?.addEventListener("click", loadMenuAndDeals);

addMenuItemBtn?.addEventListener("click", async () => {
  if (!currentRestId) return;
  const category = (miCategory?.value || "").trim();
  const name = (miName?.value || "").trim();
  const description = (miDesc?.value || "").trim();
  const priceHuf = (miPrice?.value || "").trim();
  if (!category || !name || priceHuf === "") {
    alert("Kategória, név és ár kötelező.");
    return;
  }
  try {
    addMenuItemBtn.disabled = true;
    await api.adminCreateMenuItem({ restaurantId: currentRestId, category, name, description, priceHuf });
    if (miCategory) miCategory.value = "";
    if (miName) miName.value = "";
    if (miDesc) miDesc.value = "";
    if (miPrice) miPrice.value = "";
    showOk("Menütétel hozzáadva!");
    await loadMenuAndDeals();
	autoCollapseOnMobile();
  } catch (e) {
    showError(e.message || "Nem sikerült hozzáadni.");
  } finally {
    addMenuItemBtn.disabled = false;
  }
});

addHotDealBtn?.addEventListener("click", async () => {
  if (!currentRestId) return;
  const name = (hdName?.value || "").trim();
  const description = (hdDesc?.value || "").trim();
  const originalPriceHuf = (hdOrig?.value || "").trim();
  const dealPriceHuf = (hdDeal?.value || "").trim();
  if (!name || originalPriceHuf === "" || dealPriceHuf === "") {
    alert("Név, eredeti ár és akciós ár kötelező.");
    return;
  }
  try {
    addHotDealBtn.disabled = true;
    await api.adminCreateHotDeal({ restaurantId: currentRestId, name, description, originalPriceHuf, dealPriceHuf });
    if (hdName) hdName.value = "";
    if (hdDesc) hdDesc.value = "";
    if (hdOrig) hdOrig.value = "";
    if (hdDeal) hdDeal.value = "";
    showOk("Hot deal hozzáadva!");
    await loadMenuAndDeals();
	autoCollapseOnMobile();
  } catch (e) {
    showError(e.message || "Nem sikerült hozzáadni.");
  } finally {
    addHotDealBtn.disabled = false;
  }
});


const refreshGuestsBtn = document.getElementById("refreshGuestsBtn");
const guestQEl = document.getElementById("guestQ");
const guestRoleEl = document.getElementById("guestRole");
const guestsLoadingEl = document.getElementById("guestsLoading");
const guestsTbodyEl = document.getElementById("guestsTbody");

let allGuests = [];

function setGuestsLoading(isLoading) {
  if (!guestsLoadingEl) return;
  guestsLoadingEl.style.display = isLoading ? "block" : "none";
}

function fmtTsShort(s) {
  const v = String(s || "").trim();
  if (!v) return "";
  return v.length > 16 ? v.slice(0, 16) : v;
}

function applyGuestFilters(rows) {
  const q = (guestQEl?.value || "").trim().toLowerCase();
  return (rows || []).filter((g) => {
    if (!q) return true;
    const hay = `${g.name ?? ""} ${g.email ?? ""}`.toLowerCase();
    return hay.includes(q);
  });
}

function renderGuests() {
  if (!guestsTbodyEl) return;
  const rows = applyGuestFilters(allGuests);
  if (rows.length === 0) {
    guestsTbodyEl.innerHTML = `<tr><td colspan="5" class="hint">Nincs találat.</td></tr>`;
    return;
  }
  guestsTbodyEl.innerHTML = rows
    .map((g) => {
      const role = String(g.role || "user");
      const badge = role === "admin" ? `<span class="badge text-bg-dark">admin</span>` : `<span class="badge text-bg-secondary">user</span>`;
      return `
      <tr>
        <td>
          <div class="fw-semibold">${escapeHtml(g.name || "")}</div>
          <div class="small text-secondary">ID: ${escapeHtml(g.id)}</div>
        </td>
        <td>
          <div>${escapeHtml(g.email || "")}</div>
          <div class="small text-secondary">${badge}</div>
        </td>
        <td class="text-center fw-semibold">${escapeHtml(g.reservationsCount ?? 0)}</td>
        <td class="text-center fw-semibold">${escapeHtml(g.reviewsCount ?? 0)}</td>
        <td>${escapeHtml(fmtTsShort(g.lastActivity || ""))}</td>
      </tr>`;
    })
    .join("");
}

async function loadGuests() {
  showError("");
  setGuestsLoading(true);
  try {
    const includeAdmins = (guestRoleEl?.value || "user") === "all";
    const rows = await api.getAdminGuests(includeAdmins ? 1 : 0);
    allGuests = Array.isArray(rows) ? rows : [];
    renderGuests();
  } catch (e) {
    showError(e.message || "Nem sikerült betölteni a vendégeket.");
  } finally {
    setGuestsLoading(false);
  }
}

refreshGuestsBtn?.addEventListener("click", loadGuests);
guestQEl?.addEventListener("input", renderGuests);
guestRoleEl?.addEventListener("change", loadGuests);


function autoCollapseOnMobile() {
  try {
    if (window.innerWidth >= 992) return;
    const ids = ["collapseReservations","collapseReviews","collapseMenu","collapseGuests"];
    ids.forEach((id) => {
      const el = document.getElementById(id);
      if (el && window.bootstrap?.Collapse) {
        
        const inst = window.bootstrap.Collapse.getOrCreateInstance(el, { toggle: false });
        inst.hide();
      }
    });
  } catch {}
}

(async function init() {
	await Promise.all([loadDashboard(), loadAllReservations(), loadAdminReviews(), loadAdminRestaurants(), loadGuests()]);
	await loadMenuAndDeals();
	autoCollapseOnMobile();
})();
