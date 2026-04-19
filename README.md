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

## Fő funkciók

### Vendég (user)
- Regisztráció / bejelentkezés  
- Éttermek listázása, keresése, népszerű és top listák  
- Étterem részletező oldal: nyitvatartás, étlap, hot deals, értékelések  
- Asztalfoglalás idősáv és létszám alapján  
- Saját foglalások megtekintése, módosítása és lemondása *(ha a státusz engedi)*  
- Saját értékelés írása csillaggal és szöveggel  

### Admin
- Admin dashboard összesítő statisztikákkal  
- Foglalások kezelése és státusz módosítása  
- Értékelések áttekintése és válasz írása  
- Étlap és hot deal tartalmak kezelése  
- Vendéglista megtekintése  

---

## Technológiák

- **Backend:** Python + **Flask**  
- **Adatbázis:** **MySQL / MariaDB** + PyMySQL  
- **Frontend:** HTML + Bootstrap + JavaScript  
- **Hitelesítés:** session / cookie alapú beléptetés  
- **Adatbázis indulás:** automatikus létrehozás és SQL import az első futáskor  

---

## Projekt felépítése

```txt
Smarttable/
  backend_flask/
    app.py
    db.py
    requirements.txt
    .env.example
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

## Futtatás

### 1) MySQL / MariaDB indítása
Indítsd el a **MySQL/MariaDB** szervert, például **XAMPP** alatt.

> Fontos: a projekt **nem igényel kézi adatbázis-létrehozást vagy kézi SQL importot**.  
> Az első induláskor a backend automatikusan:
> - létrehozza a `smarttable` adatbázist, ha még nem létezik,
> - létrehozza a `user_smarttable` adatbázis-felhasználót, ha szükséges,
> - importálja a `database/smarttable.sql` fájl tartalmát, ha a séma még hiányzik.

### 2) Opcionális `.env` beállítás
A `backend_flask/.env.example` fájlból készíthetsz `.env` fájlt, ha módosítani akarod az adatbázis vagy a session beállításait.

Alapértelmezett értékek:
- `MYSQL_HOST=localhost`
- `MYSQL_PORT=3306`
- `MYSQL_DATABASE=smarttable`
- `MYSQL_USER=user_smarttable`
- `MYSQL_PASSWORD=smarttable123`
- `MYSQL_BOOTSTRAP_USER=root`
- `MYSQL_BOOTSTRAP_PASSWORD=` *(XAMPP esetén gyakran üres)*

Ha a root felhasználónak van jelszava, állítsd be a `MYSQL_BOOTSTRAP_PASSWORD` értékét is.

### 3) Backend indítása
Nyisd meg a projektet a `Smarttable/backend_flask` mappában, majd futtasd:

```bash
python -m venv venv
venv\Scripts\activate
pip install -r requirements.txt
python app.py
```

### 4) Frontend megnyitása
A frontendet a Flask szolgálja ki, ezért a böngészőben ezt nyisd meg:

- **http://localhost:5000/**

---

## Mintafelhasználók

Az első automatikus import után a rendszerben elérhető mintafelhasználók:

- **Admin:** `admin@example.com` / `admin123`
- **User:** `user@example.com` / `user123`

---

## Újrainicializálás fejlesztés közben

Ha teljesen tiszta állapotból akarod újra feltölteni az adatbázist, akkor töröld a `smarttable` adatbázist MySQL-ben, majd indítsd újra a backendet.  
A backend a következő induláskor ismét automatikusan létrehozza és feltölti az adatbázist.

---

## Megjegyzés

A projekt oktatási célra készült vizsgaremek, ezért a fókusz a funkcionalitáson, az átlátható felépítésen és a bemutathatóságon volt.
