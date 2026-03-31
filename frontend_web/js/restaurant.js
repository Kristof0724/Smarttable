import { api } from "./api.js";
import { logout, getUser, redirectAdminUsers } from "./auth.js";

redirectAdminUsers();



function escapeHtml(s) {
	return String(s ?? "")
		.replaceAll("&", "&amp;")
		.replaceAll("<", "&lt;")
		.replaceAll(">", "&gt;")
		.replaceAll('"', "&quot;")
		.replaceAll("'", "&#039;");
}

function formatMoneyHuf(value) {
	const n = Number(value || 0);
	if (!n) return "";
	return `${new Intl.NumberFormat("hu-HU").format(n)} Ft`;
}


const errEl = document.getElementById("err");
const loadingEl = document.getElementById("loading");
const contentEl = document.getElementById("content");

const imgEl = document.getElementById("restaurantImg");
const nameEl = document.getElementById("name");
const metaEl = document.getElementById("meta");
const descEl = document.getElementById("description");
const openEl = document.getElementById("openingHours");

const ratingBadgeEl = document.getElementById("ratingBadge");
const ratingCountEl = document.getElementById("ratingCount");

const logoutBtn = document.getElementById("logoutBtn");
const reserveBtn = document.getElementById("reserveBtn");
const myResBtn = document.getElementById("myResBtn");
const adminBtn = document.getElementById("adminBtn");

const currentUser = getUser();
if (!currentUser) { if (myResBtn) myResBtn.style.display = "none"; if (logoutBtn) logoutBtn.style.display = "none"; }
if (currentUser && currentUser.role === "admin") { if (adminBtn) adminBtn.style.display = "inline-flex"; if (myResBtn) myResBtn.style.display = "none"; }

const menuErrEl = document.getElementById("menuErr");
const menuLoadingEl = document.getElementById("menuLoading");
const menuListEl = document.getElementById("menuList");

const dealsEl = document.getElementById("deals");
const dealsErrEl = document.getElementById("dealsErr");

const reviewsListEl = document.getElementById("reviewsList");
const reviewsLoadingEl = document.getElementById("reviewsLoading");
const reviewErrEl = document.getElementById("reviewErr");
const reviewOkEl = document.getElementById("reviewOk");
const reviewTextEl = document.getElementById("reviewText");
const sendReviewBtn = document.getElementById("sendReviewBtn");
const starPickerEl = document.getElementById("starPicker");

let selectedRating = 5;

let currentRestaurantId = null;

function showError(msg) {
	errEl.textContent = msg || "";
}

function setLoading(isLoading) {
	loadingEl.style.display = isLoading ? "block" : "none";
	contentEl.style.display = isLoading ? "none" : "block";
}

function showMenuError(msg) {
	if (!menuErrEl) return;
	menuErrEl.textContent = msg || "";
}
function setMenuLoading(isLoading) {
	if (!menuLoadingEl || !menuListEl) return;
	menuLoadingEl.style.display = isLoading ? "block" : "none";
	menuListEl.style.display = isLoading ? "none" : "block";
}

function showReviewError(msg) {
	if (!reviewErrEl) return;
	reviewErrEl.textContent = msg || "";
}
function showReviewOk(msg) {
	if (!reviewOkEl) return;
	reviewOkEl.textContent = msg || "";
}

function starsHtml(avg) {
	const a = Number(avg || 0);
	const full = Math.round(a);
	let out = "";
	for (let i = 1; i <= 5; i++) {
		out += `<i class="bi ${i <= full ? "bi-star-fill text-warning" : "bi-star text-warning"}"></i>`;
	}
	return out;
}

function renderRating(avg, count) {
	const a = Number(avg || 0);
	const c = Number(count || 0);
	ratingBadgeEl.innerHTML = `${starsHtml(a)} <span class="ms-1">${a ? a.toFixed(1) : "—"}</span>`;
	ratingCountEl.textContent = c ? `${c} értékelés` : "Még nincs értékelés";
}

function renderMenu(items) {
	if (!menuListEl) return;
	if (!items || items.length === 0) {
		menuListEl.innerHTML = `<div class="hint">Ehhez az étteremhez még nincs feltöltött étlap.</div>`;
		return;
	}
	const norm = (s) =>
		String(s ?? "")
			.trim()
			.toLowerCase();

	const mapGroup = (cat) => {
		const c = norm(cat);

		if (c.includes("dessz") || c.includes("dessert")) return "dessert";
		if (
			c.includes("ital") ||
			c.includes("drink") ||
			c.includes("káv") ||
			c.includes("kave") ||
			c.includes("tea") ||
			c.includes("üd") ||
			c.includes("udo") ||
			c.includes("sör") ||
			c.includes("sor") ||
			c.includes("kokt")
		)
			return "drinks";
		if (
			c.includes("elő") ||
			c.includes("elo") ||
			c.includes("starter") ||
			c.includes("appet") ||
			c.includes("leves") ||
			c.includes("soup")
		)
			return "appetizer";

		return "main";
	};

	const groups = { appetizer: [], main: [], dessert: [], drinks: [] };
	for (const it of items) {
		const key = mapGroup(it.category);
		groups[key].push(it);
	}

	const sortByName = (a, b) =>
		String(a?.name ?? "").localeCompare(String(b?.name ?? ""), "hu");

	groups.appetizer.sort(sortByName);
	groups.dessert.sort(sortByName);
	groups.drinks.sort(sortByName);
	groups.main.sort(
		(a, b) =>
			String(a?.category ?? "").localeCompare(
				String(b?.category ?? ""),
				"hu",
			) || sortByName(a, b),
	);

	const renderSection = (title, arr, showCategory = false) => {
		if (!arr || arr.length === 0) return "";

		const rows = arr
			.map((it) => {
				const name = escapeHtml(it.name ?? "");
				const desc = escapeHtml(it.description ?? "");
				const cat = escapeHtml(it.category ?? "");
				const price = Number(it.priceHuf ?? it.price ?? 0);

				return `<tr>
					${
						showCategory
							? `<td class="text-nowrap"><span class="badge text-bg-light border">${cat}</span></td>`
							: ``
					}
					<td>
						<div class="fw-semibold">${name}</div>
						${desc ? `<div class="text-secondary small">${desc}</div>` : ``}
					</td>
					<td class="text-end text-nowrap fw-semibold">${price ? formatMoneyHuf(price) : ""}</td>
				</tr>`;
			})
			.join("");

		return `
			<div class="mt-4">
				<div class="d-flex align-items-center gap-3 mb-2">
					<div class="fw-bold">${title}</div>
					<hr class="flex-grow-1 m-0" />
				</div>
				<table class="table align-middle">
					${
						showCategory
							? `<thead><tr><th style="width:1%;">Kategória</th><th>Tétel</th><th class="text-end" style="width:1%;">Ár</th></tr></thead>`
							: `<thead><tr><th>Tétel</th><th class="text-end" style="width:1%;">Ár</th></tr></thead>`
					}
					<tbody>${rows}</tbody>
				</table>
			</div>
		`;
	};

	const parts = [];
	parts.push(renderSection("Előétel", groups.appetizer));
	parts.push(renderSection("Főétel", groups.main, true));
	parts.push(renderSection("Desszert", groups.dessert));
	parts.push(renderSection("Ital", groups.drinks));

	menuListEl.innerHTML = parts.filter(Boolean).join("");
}

function renderDeals(items) {
	if (!dealsEl) return;
	if (!items || items.length === 0) {
		dealsEl.innerHTML = `<div class="hint">Jelenleg nincs akció.</div>`;
		return;
	}
	dealsEl.innerHTML = items
		.map((d) => {
			const name = d.name ?? "";
			const desc = d.description ?? "";
			const original = Number(d.originalPriceHuf || d.originalPrice || 0);
			const deal = Number(d.dealPriceHuf || d.dealPrice || 0);
			const percent =
				original > 0 && deal > 0
					? Math.round((1 - deal / original) * 100)
					: null;

			return `
			<div class="border rounded-3 p-3 mb-2">
				<div class="d-flex justify-content-between align-items-start gap-2">
					<div class="fw-semibold">${name}</div>
					${percent ? `<span class="badge text-bg-success">-${percent}%</span>` : ``}
				</div>
				${desc ? `<div class="text-secondary small mt-1">${desc}</div>` : ``}
				<div class="mt-2 d-flex align-items-baseline gap-2">
					${original ? `<div class="text-secondary text-decoration-line-through small">${formatMoneyHuf(original)}</div>` : ``}
					<div class="fw-bold">${deal ? `${formatMoneyHuf(deal)}` : ``}</div>
				</div>
			</div>`;
		})
		.join("");
}

async function renderReviews(items) {
	if (!reviewsListEl) return;

	const userObj = getUser();
	const isAdmin = userObj?.role === "admin";

	if (!items || items.length === 0) {
		reviewsListEl.innerHTML = `<div class="hint">${"Még nincs vélemény."}</div>`;
		return;
	}

	const respBadge = "Válasz";
	const respPlaceholder = "Írj választ…";
	const respSend = "Küldés";

	reviewsListEl.innerHTML = items
		.map((rv) => {
			const user = rv.userName ?? "—";
			const rating = Number(rv.rating || 0);
			const text = rv.comment ?? "";
			const created = rv.createdAt ?? "";
			const respText = rv.responseText ?? "";
			const respCreated = rv.responseCreatedAt ?? "";

			const responseHtml = respText
				? `
				<div class="mt-3 p-3 bg-light border rounded-3">
					<div class="d-flex align-items-center gap-2 mb-1">
						<span class="badge text-bg-success">${respBadge}</span>
						${respCreated ? `<span class="small text-secondary">${respCreated}</span>` : ``}
					</div>
					<div>${escapeHtml(respText)}</div>
				</div>`
				: ``;

			const adminForm = isAdmin
				? `
				<div class="mt-3">
					<textarea class="form-control" rows="2" data-review-response="${rv.id}" placeholder="${respPlaceholder}">${escapeHtml(
						respText || "",
					)}</textarea>
					<div class="d-grid mt-2">
						<button class="btn btn-sm btn-outline-success" data-review-response-btn="${rv.id}">
							<i class="bi bi-reply"></i> ${respSend}
						</button>
					</div>
				</div>`
				: ``;

			return `
			<div class="border rounded-3 p-3 mb-2">
				<div class="d-flex justify-content-between align-items-start gap-2">
					<div class="fw-semibold">${escapeHtml(user)}</div>
					<div class="text-nowrap">${starsHtml(rating)}</div>
				</div>
				${created ? `<div class="small text-secondary mt-1">${created}</div>` : ``}
				${text ? `<div class="mt-2">${escapeHtml(text)}</div>` : ``}
				${responseHtml}
				${adminForm}
			</div>`;
		})
		.join("");
	const btns = reviewsListEl.querySelectorAll("[data-review-response-btn]");
	btns.forEach((btn) => {
		btn.addEventListener("click", async () => {
			const rid = btn.getAttribute("data-review-response-btn");
			const ta = reviewsListEl.querySelector(`[data-review-response="${rid}"]`);
			const val = (ta?.value || "").trim();

			try {
				btn.disabled = true;
				await api.upsertReviewResponse(rid, val);
				await loadReviews();
			} catch (e) {
				alert(e.message || "Hiba");
			} finally {
				btn.disabled = false;
			}
		});
	});
}

function getIdFromQuery() {
	const params = new URLSearchParams(window.location.search);
	return params.get("id");
}

async function loadReviews() {
	if (!currentRestaurantId) return [];

	showReviewError("");
	showReviewOk("");
	if (reviewsLoadingEl) reviewsLoadingEl.style.display = "block";

	try {
		const reviews = await api.getReviews(currentRestaurantId);
		await renderReviews(reviews);
		const ttEl = document.getElementById("reviewsToggleText");
		if (ttEl) ttEl.textContent = `Vélemények (${reviews.length})`;
		return reviews;
	} catch (e) {
		showReviewError(e.message || "Betöltési hiba.");
		await renderReviews([]);
		const ttEl = document.getElementById("reviewsToggleText");
		if (ttEl) ttEl.textContent = `Vélemények (0)`;
		return [];
	} finally {
		if (reviewsLoadingEl) reviewsLoadingEl.style.display = "none";
	}
}

logoutBtn?.addEventListener("click", () => {
	logout();
	window.location.href = "login.html";
});

function initStarPicker() {
	if (!starPickerEl) return;

	const buttons = [];
	for (let i = 1; i <= 5; i++) {
		const btn = document.createElement("button");
		btn.type = "button";
		btn.className = "btn btn-sm btn-light border";
		btn.innerHTML = `<i class="bi bi-star-fill text-warning"></i> ${i}`;
		btn.addEventListener("click", () => {
			selectedRating = i;
			buttons.forEach((b, idx) => {
				b.classList.toggle("btn-primary", idx + 1 === i);
				b.classList.toggle("btn-light", idx + 1 !== i);
			});
		});
		buttons.push(btn);
		starPickerEl.appendChild(btn);
	}
	buttons[4].classList.add("btn-primary");
	buttons[4].classList.remove("btn-light");
}

async function loadAll(id) {
	currentRestaurantId = id;
	showError("");
	setLoading(true);

	try {
		const r = await api.getRestaurantById(id);

		const name = r?.name ?? "Névtelen étterem";
		const city = r?.city ?? "";
		const address = r?.address ?? "";
		const cuisine = r?.cuisine ?? "";
		const priceRange = r?.priceRange ?? "";
		const description = r?.description ?? "Nincs leírás.";
		const ot = r?.opening_time ?? r?.openingTime ?? null;
		const ct = r?.closing_time ?? r?.closingTime ?? null;
		const fmtTime = (t) => {
			if (!t) return null;
			const s = String(t);
			return s.length >= 5 ? s.slice(0, 5) : s;
		};
		const openingHours =
			ot && ct
				? fmtTime(ot) + " - " + fmtTime(ct)
				: (r?.openingHours ?? "Nincs megadva.");

		let img = r?.imageUrl ? String(r.imageUrl) : "assets/restaurant_sample.png";
		if (img.startsWith("/")) img = img.slice(1);
		if (imgEl) { imgEl.onerror = () => { imgEl.onerror = null; imgEl.src = "assets/restaurant_sample.png"; }; imgEl.src = img; }

		nameEl.textContent = name;

		const parts = [];
		if (city) parts.push(city);
		if (address) parts.push(address);
		if (cuisine) parts.push(cuisine);
		if (priceRange) parts.push(priceRange);
		metaEl.textContent = parts.join(" • ");

		descEl.textContent = description;
		openEl.textContent = openingHours;

		renderRating(r.avgRating || 0, r.reviewCount || 0);

		try {
			showMenuError("");
			setMenuLoading(true);
			const menu = await api.getMenuByRestaurant(id);
			renderMenu(menu);
		} catch (e) {
			showMenuError(e.message || "Hiba történt az étlap betöltése közben.");
			if (menuListEl) menuListEl.innerHTML = "";
		} finally {
			setMenuLoading(false);
		}

		if (dealsErrEl) dealsErrEl.textContent = "";
		try {
			const deals = await api.getDealsByRestaurant(id);
			renderDeals(deals);
		} catch (e) {
			if (dealsErrEl)
				dealsErrEl.textContent =
					e.message || "Hiba az akciók betöltése közben.";
			if (dealsEl) dealsEl.innerHTML = "";
		}

		await loadReviews();

		reserveBtn?.addEventListener("click", () => {
			const u = getUser();
			if (!u) { window.location.href = "login.html"; return; }
			window.location.href = `reservations.html?restaurantId=${encodeURIComponent(id)}`;
		});

		const reviewFormWrap = sendReviewBtn?.closest(".card") || sendReviewBtn?.parentElement?.parentElement;
		if (!getUser() && reviewFormWrap) { reviewFormWrap.style.display = "none"; }
		if (sendReviewBtn) {
			sendReviewBtn.onclick = async () => {
				showReviewError("");
				showReviewOk("");

				const user = getUser();
				if (!user?.id)
					return showReviewError("Nincs bejelentkezett felhasználó.");

				const comment = (reviewTextEl?.value || "").trim();
				if (!selectedRating || selectedRating < 1 || selectedRating > 5)
					return showReviewError("Adj meg 1–5 csillagos értékelést!");
				if (comment.length < 3)
					return showReviewError("Írj legalább 3 karaktert a véleményhez.");

				sendReviewBtn.disabled = true;
				sendReviewBtn.textContent = "Küldés...";

				try {
					await api.addReview(id, {
						rating: Number(selectedRating),
						comment,
					});
					showReviewOk("Köszi! A véleményed mentve lett.");
					if (reviewTextEl) reviewTextEl.value = "";

					const [reviews, rest] = await Promise.all([
						api.getReviews(id),
						api.getRestaurantById(id),
					]);
					await renderReviews(reviews);
					const ttEl = document.getElementById("reviewsToggleText");
					if (ttEl) ttEl.textContent = `${"Vélemények"} (${reviews.length})`;
					renderRating(rest.avgRating || 0, rest.reviewCount || 0);
				} catch (e) {
					showReviewError(e.message || "Nem sikerült menteni a véleményt.");
				} finally {
					sendReviewBtn.disabled = false;
					sendReviewBtn.textContent = "Vélemény elküldése";
				}
			};
		}
	} catch (err) {
		showError(err.message || "Hiba történt az étterem betöltése közben.");
	} finally {
		setLoading(false);
	}
}

(function init() {
	initStarPicker();

	const id = getIdFromQuery();
	if (!id) {
		showError("Hiányzó étterem azonosító (id). Menj vissza az éttermekhez.");
		return;
	}
	loadAll(id);
})();