import { api } from "./api.js";
import { setUser } from "./auth.js";

const nameInput = document.getElementById("name");
const emailInput = document.getElementById("email");
const passwordInput = document.getElementById("password");
const registerBtn = document.getElementById("registerBtn");
const errorDiv = document.getElementById("err");

function showError(message) {
	errorDiv.textContent = message || "";
}

function setLoading(loading) {
	registerBtn.disabled = loading;
	registerBtn.textContent = loading ? "Regisztráció..." : "Regisztráció";
}

function validate(name, email, password) {
	if (!name || name.length < 2) return "A név legalább 2 karakter legyen!";
	if (!email || !email.includes("@"))
		return "Adj meg egy érvényes e-mail címet!";
	if (!password || password.length < 4)
		return "A jelszó legalább 4 karakter legyen!";
	return null;
}

registerBtn.addEventListener("click", async () => {
	showError("");

	const name = nameInput.value.trim();
	const email = emailInput.value.trim().toLowerCase();
	const password = passwordInput.value;

	const error = validate(name, email, password);
	if (error) {
		showError(error);
		return;
	}

	try {
		setLoading(true);

		// API: regisztráció
		const user = await api.register(name, email, password);

		// beléptetés (localStorage)
		setUser(user);

		// tovább a főoldalra
		window.location.href = "restaurants.html";
	} catch (err) {
		showError(err.message || "Hiba történt regisztráció közben");
	} finally {
		setLoading(false);
	}
});

// ENTER billentyű kezelése
[nameInput, emailInput, passwordInput].forEach((input) => {
	input.addEventListener("keydown", (e) => {
		if (e.key === "Enter") {
			registerBtn.click();
		}
	});
});
