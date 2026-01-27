import { api } from "./api.js";
import { setUser } from "./auth.js";

const emailInput = document.getElementById("email");
const passwordInput = document.getElementById("password");
const loginBtn = document.getElementById("loginBtn");
const errorDiv = document.getElementById("err");

function showError(message) {
	errorDiv.textContent = message || "";
}

function setLoading(loading) {
	loginBtn.disabled = loading;
	loginBtn.textContent = loading ? "Bejelentkezés..." : "Belépés";
}

loginBtn.addEventListener("click", async () => {
	showError("");

	const email = emailInput.value.trim().toLowerCase();
	const password = passwordInput.value;

	if (!email || !password) {
		showError("Add meg az e-mail címet és a jelszót!");
		return;
	}

	try {
		setLoading(true);

		// API hívás
		const user = await api.login(email, password);

		// felhasználó mentése
		setUser(user);

		// tovább a főoldalra
		window.location.href = "restaurants.html";
	} catch (err) {
		showError(err.message || "Hiba történt a bejelentkezés során");
	} finally {
		setLoading(false);
	}
});

// ENTER billentyű kezelése
[emailInput, passwordInput].forEach((input) => {
	input.addEventListener("keydown", (e) => {
		if (e.key === "Enter") {
			loginBtn.click();
		}
	});
});
