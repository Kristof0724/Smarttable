export function getUser() {
	const raw = localStorage.getItem("user");
	return raw ? JSON.parse(raw) : null;
}
export function setUser(user) {
	localStorage.setItem("user", JSON.stringify(user));
}
export function logout() {
	// Backend session törlés (ha elérhető)
	try {
		fetch("/api/auth/logout", { method: "POST", credentials: "same-origin" }).catch(()=>{});
	} catch {}
	localStorage.removeItem("user");
	window.location.href = "login.html";
}
export function requireAuth() {
	const u = getUser();
	if (!u) window.location.href = "login.html";
	return u;
}
