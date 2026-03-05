# SmartTable – Szoftverfejlesztés és -tesztelés vizsgaremek

A **SmartTable** egy webes (**asztali + mobilbarát**) éttermi foglalási és menedzsment rendszer.  
Célja, hogy a vendégek gyorsan tudjanak **éttermet keresni**, **idősávot választani**, **asztalt foglalni**, majd **értékelést írni**, míg az admin felületen az üzemeltető **foglalásokat kezel**, **statisztikákat lát**, és **tartalmat menedzsel**.

---

## Csapattagok és azonosítók (commit nevek)

A commit history-ban több alias is szerepel, de a projektet **3 fő készítette**:

- **Koncz Gábor Sándor** – `KG`, `kgabor016`, `koncz`  
- **Boros Róbert** – `BR`, `Carl0s69`  
- **Kovács Kristóf** – `Kristof0724`, `KK`, `kk`

---

## Fő funkciók (röviden)

### Vendég (user)
- Regisztráció / bejelentkezés  
- Éttermek listázása, keresése, népszerű/top listák  
- Étterem részletező: étlap, hot deals, vélemények  
- Foglalás létrehozása idősáv alapján  
- Saját foglalások listázása, módosítása/lemondása *(ha engedélyezett)*  
- Értékelés (**1–5 csillag + szöveg**), admin válasz a véleményre  

### Admin
- Admin dashboard (összesítők)  
- Foglalások listázása és státuszkezelése (pl. `pending` / `accepted` / `completed`)  
- Admin felület külön oldalon: `admin.html` + `admin.js`  

---

## Technológiák

- **Backend:** Python **Flask** *(REST API + statikus frontend kiszolgálás)*  
- **Adatbázis:** **MySQL / MariaDB** *(PyMySQL)*  
- **Frontend:** HTML + **Bootstrap** + JavaScript  
- **Auth:** session/cookie alapú *(Flask session)*  

---

## Projekt felépítése

```txt
Smarttable/
  backend_flask/
    app.py
    db.py
    requirements.txt
  frontend_web/
    index.html
    restaurants.html
    restaurant.html
    reservations.html
    my_reservations.html
    login.html
    register.html
    admin.html
    css/style.css
    js/*.js
    assets/*
  database/
    smarttable.sql
```

---

## Telepítés és futtatás (Windows / XAMPP ajánlott)

### 1) Adatbázis import
1. Indítsd el a **MySQL/MariaDB** szervert (pl. **XAMPP**).  
2. Hozz létre egy adatbázist: `smarttable`  
3. Importáld a dumpot: `database/smarttable.sql`  

**Mintafelhasználók (a dumpban):**
- Admin: `admin@example.com` / jelszó: `admin123`  
- User: `user@example.com` / jelszó: `user123`  

### 2) Backend (Flask) futtatás
1. Nyisd meg a projektet terminálban: `Smarttable/backend_flask`  
2. Virtuális környezet (ajánlott):
   ```bash
   python -m venv venv
   venv\Scripts\activate
   ```
3. Függőségek telepítése:
   ```bash
   pip install -r requirements.txt
   ```
4. Indítás:
   ```bash
   python app.py
   ```

### 3) Frontend megnyitása
A backend a frontendet is kiszolgálja, ezért böngészőben nyisd meg:

- **http://localhost:5000/**  *(automatikusan index.html)*

---

## Licenc

Oktatási célra készült vizsgaremek.
