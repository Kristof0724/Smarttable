-- phpMyAdmin SQL Dump
-- version 5.2.1
-- https://www.phpmyadmin.net/
--
-- Gép: 127.0.0.1
-- Létrehozás ideje: 2026. Feb 25. 19:00
-- Kiszolgáló verziója: 10.4.32-MariaDB
-- PHP verzió: 8.0.30

SET SQL_MODE = "NO_AUTO_VALUE_ON_ZERO";
START TRANSACTION;
SET time_zone = "+00:00";


/*!40101 SET @OLD_CHARACTER_SET_CLIENT=@@CHARACTER_SET_CLIENT */;
/*!40101 SET @OLD_CHARACTER_SET_RESULTS=@@CHARACTER_SET_RESULTS */;
/*!40101 SET @OLD_COLLATION_CONNECTION=@@COLLATION_CONNECTION */;
/*!40101 SET NAMES utf8mb4 */;

--
-- Adatbázis: `smarttable`
--

DROP TABLE IF EXISTS `review_responses`;
DROP TABLE IF EXISTS `hot_deals`;
DROP TABLE IF EXISTS `reviews`;
DROP TABLE IF EXISTS `menu_items`;
DROP TABLE IF EXISTS `reservations`;
DROP TABLE IF EXISTS `restaurants`;
DROP TABLE IF EXISTS `users`;

-- --------------------------------------------------------

--
-- Tábla szerkezet ehhez a táblához `users`
--

CREATE TABLE `users` (
  `id` int(11) NOT NULL,
  `name` varchar(100) NOT NULL,
  `email` varchar(120) NOT NULL,
  `password_hash` varchar(255) NOT NULL,
  `role` enum('user','admin') DEFAULT 'user'
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- --------------------------------------------------------

--
-- Tábla szerkezet ehhez a táblához `restaurants`
--

CREATE TABLE `restaurants` (
  `id` int(11) NOT NULL,
  `name` varchar(120) NOT NULL,
  `city` varchar(100) DEFAULT NULL,
  `address` varchar(200) DEFAULT NULL,
  `cuisine` varchar(100) DEFAULT NULL,
  `priceRange` varchar(10) DEFAULT NULL,
  `description` text DEFAULT NULL,
  `opening_time` time NOT NULL DEFAULT '11:00:00',
  `closing_time` time NOT NULL DEFAULT '22:00:00',
  `capacity` int(11) NOT NULL DEFAULT 40,
  `imageUrl` varchar(255) DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- --------------------------------------------------------

--
-- Tábla szerkezet ehhez a táblához `reservations`
--

CREATE TABLE `reservations` (
  `id` int(11) NOT NULL,
  `restaurantId` int(11) NOT NULL,
  `userId` int(11) NOT NULL,
  `date` date NOT NULL,
  `time` varchar(10) NOT NULL,
  `peopleCount` int(11) NOT NULL,
  `status` varchar(20) DEFAULT 'pending',
  `publicToken` varchar(64) DEFAULT NULL,
  `createdAt` timestamp NOT NULL DEFAULT current_timestamp(),
  `updatedAt` timestamp NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- --------------------------------------------------------

--
-- Tábla szerkezet ehhez a táblához `menu_items`
--

CREATE TABLE `menu_items` (
  `id` int(11) NOT NULL,
  `restaurantId` int(11) NOT NULL,
  `category` varchar(60) NOT NULL,
  `name` varchar(160) NOT NULL,
  `description` varchar(255) DEFAULT NULL,
  `priceHuf` int(11) NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- --------------------------------------------------------

--
-- Tábla szerkezet ehhez a táblához `reviews`
--

CREATE TABLE `reviews` (
  `id` int(11) NOT NULL,
  `restaurantId` int(11) NOT NULL,
  `userId` int(11) NOT NULL,
  `rating` int(11) NOT NULL,
  `comment` varchar(500) NOT NULL,
  `createdAt` timestamp NOT NULL DEFAULT current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- --------------------------------------------------------

--
-- Tábla szerkezet ehhez a táblához `review_responses`
--

CREATE TABLE `review_responses` (
  `id` int(11) NOT NULL,
  `reviewId` int(11) NOT NULL,
  `adminUserId` int(11) NOT NULL,
  `responseText` varchar(800) NOT NULL,
  `createdAt` timestamp NOT NULL DEFAULT current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- --------------------------------------------------------

--
-- Tábla szerkezet ehhez a táblához `hot_deals`
--

CREATE TABLE `hot_deals` (
  `id` int(11) NOT NULL,
  `restaurantId` int(11) NOT NULL,
  `name` varchar(160) NOT NULL,
  `description` varchar(255) DEFAULT NULL,
  `originalPriceHuf` int(11) NOT NULL,
  `dealPriceHuf` int(11) NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- --------------------------------------------------------

--
-- A tábla adatainak kiíratása `users`
--

INSERT INTO `users` (`id`, `name`, `email`, `password_hash`, `role`) VALUES
(1, 'Admin Felhasználó', 'admin@example.com', '$2b$10$jEso/mzOfNWFZn1YRSAN/.ogLHOMfuKOzok/t0CkCXQrjOF/oaz6.', 'admin'),
(2, 'Teszt Felhasználó', 'user@example.com', '$2b$10$Y5IuVMiXPsnIDvpRqTdilOf7JW2GoqbkHCteu65/lCq0BCHHvb0ti', 'user');

-- --------------------------------------------------------

--
-- A tábla adatainak kiíratása `restaurants`
--

INSERT INTO `restaurants` (`id`, `name`, `city`, `address`, `cuisine`, `priceRange`, `description`, `opening_time`, `closing_time`, `capacity`, `imageUrl`) VALUES
(1, 'LOCAL Bistro', 'Budapest', '1051 Budapest, Kossuth Lajos tér 3.', 'Modern európai', '$$$', 'LOCAL Bistro – barátságos hangulat, friss alapanyagok és gyors kiszolgálás. Kóstold meg a ház specialitásait!', '11:00:00', '22:00:00', 40, 'assets/local-bistro.png'),
(2, 'Duna Grill', 'Budapest', '1095 Budapest, Dandár utca 8.', 'Grill & BBQ', '$$', 'Duna Grill – barátságos hangulat, friss alapanyagok és gyors kiszolgálás. Kóstold meg a ház specialitásait!', '11:00:00', '22:00:00', 40, 'assets/duna-grill.png'),
(3, 'La Pizza Napoli', 'Budapest', '1065 Budapest, Nagymező utca 12.', 'Olasz', '$$', 'La Pizza Napoli – barátságos hangulat, friss alapanyagok és gyors kiszolgálás. Kóstold meg a ház specialitásait!', '11:00:00', '22:00:00', 40, 'assets/la-pizza-napoli.png'),
(4, 'Sakura Ramen House', 'Budapest', '1072 Budapest, Rákóczi út 18.', 'Japán', '$$', 'Sakura Ramen House – barátságos hangulat, friss alapanyagok és gyors kiszolgálás. Kóstold meg a ház specialitásait!', '11:00:00', '22:00:00', 40, 'assets/sakura-ramen-house.png'),
(5, 'Spicy Curry Corner', 'Budapest', '1062 Budapest, Andrássy út 44.', 'Indiai', '$$', 'Spicy Curry Corner – barátságos hangulat, friss alapanyagok és gyors kiszolgálás. Kóstold meg a ház specialitásait!', '11:00:00', '22:00:00', 40, 'assets/spicy-curry-corner.png'),
(6, 'Buda Brunch & Co.', 'Budapest', '1011 Budapest, Fő utca 9.', 'Brunch', '$$', 'Buda Brunch & Co. – barátságos hangulat, friss alapanyagok és gyors kiszolgálás. Kóstold meg a ház specialitásait!', '11:00:00', '22:00:00', 40, 'assets/buda-brunch-co.png'),
(7, 'Tisza Fish Bar', 'Szeged', '6720 Szeged, Kárász utca 6.', 'Halételek', '$$', 'Tisza Fish Bar – barátságos hangulat, friss alapanyagok és gyors kiszolgálás. Kóstold meg a ház specialitásait!', '11:00:00', '22:00:00', 40, 'assets/tisza-fish-bar.png'),
(8, 'Debrecen Steakhouse', 'Debrecen', '4024 Debrecen, Piac utca 31.', 'Steak', '$$$', 'Debrecen Steakhouse – barátságos hangulat, friss alapanyagok és gyors kiszolgálás. Kóstold meg a ház specialitásait!', '11:00:00', '22:00:00', 40, 'assets/debrecen-steakhouse.png'),
(9, 'Pécsi Kemence', 'Pécs', '7621 Pécs, Király utca 15.', 'Magyar', '$$', 'Pécsi Kemence – barátságos hangulat, friss alapanyagok és gyors kiszolgálás. Kóstold meg a ház specialitásait!', '11:00:00', '22:00:00', 40, 'assets/pecsi-kemence.png'),
(10, 'Balaton Beach Kitchen', 'Siófok', '8600 Siófok, Petőfi sétány 2.', 'Street food', '$', 'Balaton Beach Kitchen – barátságos hangulat, friss alapanyagok és gyors kiszolgálás. Kóstold meg a ház specialitásait!', '11:00:00', '22:00:00', 40, 'assets/balaton-beach-kitchen.png');

-- --------------------------------------------------------

--
-- A tábla adatainak kiíratása `menu_items`
--

INSERT INTO `menu_items` (`id`, `restaurantId`, `category`, `name`, `description`, `priceHuf`) VALUES
(1, 1, 'Leves', 'Gulyásleves', 'Házi gulyás marhahússal', 2490),
(2, 1, 'Főétel', 'Csirkepaprikás galuskával', 'Tejfölös mártással', 3990),
(3, 1, 'Desszert', 'Somlói galuska', 'Klasszikus magyar desszert', 1690),
(4, 2, 'Előétel', 'Coleslaw', 'Friss káposztasaláta', 990),
(5, 2, 'Főétel', 'BBQ oldalas', 'Füstös szósszal', 5490),
(6, 2, 'Ital', 'Limonádé', 'Citromos házi limonádé', 990),
(7, 3, 'Pizza', 'Margherita', 'Paradicsom, mozzarella, bazsalikom', 2890),
(8, 3, 'Pizza', 'Prosciutto', 'Sonka, mozzarella', 3290),
(9, 3, 'Tészta', 'Carbonara', 'Tejszínes-szalonnás spagetti', 3690),
(10, 4, 'Leves', 'Tonkotsu ramen', 'Gazdag sertésalaplével', 4290),
(11, 4, 'Főétel', 'Chicken Teriyaki Bowl', 'Rizzsel és zöldségekkel', 3890),
(12, 5, 'Főétel', 'Butter Chicken', 'Enyhén csípős paradicsomos szószban', 4190),
(13, 5, 'Köret', 'Garlic Naan', 'Fokhagymás naan kenyér', 1190),
(14, 6, 'Brunch', 'Avokádós toast', 'Buggyantott tojással', 3190),
(15, 6, 'Brunch', 'Eggs Benedict', 'Hollandi mártással', 3590),
(16, 7, 'Főétel', 'Roston sült harcsa', 'Citrommal és salátával', 4890),
(17, 8, 'Főétel', 'Ribeye steak', 'Borsmártással', 8990),
(18, 9, 'Főétel', 'Kemencés csülök', 'Párolt káposztával', 5290),
(19, 10, 'Street food', 'Sajtburger menü', 'Hasábburgonyával', 3290),
(20, 10, 'Desszert', 'Fagylaltkehely', 'Szezonális gyümölcsökkel', 1890);

-- --------------------------------------------------------

--
-- A tábla adatainak kiíratása `reviews`
--

INSERT INTO `reviews` (`id`, `restaurantId`, `userId`, `rating`, `comment`, `createdAt`) VALUES
(1, 1, 2, 5, 'Nagyon finom ételek és kedves kiszolgálás!', '2026-02-20 12:10:00'),
(2, 3, 2, 4, 'A pizza nagyon jó volt, biztos jövünk még.', '2026-02-21 18:25:00'),
(3, 6, 2, 5, 'Szuper brunch hely, hangulatos környezet.', '2026-02-22 09:40:00');

-- --------------------------------------------------------

--
-- A tábla adatainak kiíratása `review_responses`
--

INSERT INTO `review_responses` (`id`, `reviewId`, `adminUserId`, `responseText`, `createdAt`) VALUES
(1, 1, 1, 'Köszönjük szépen a kedves visszajelzést, várunk vissza!', '2026-02-20 13:00:00'),
(2, 2, 1, 'Örülünk, hogy ízlett a pizza! Legközelebb is szeretettel várunk.', '2026-02-21 19:00:00');

-- --------------------------------------------------------

--
-- A tábla adatainak kiíratása `hot_deals`
--

INSERT INTO `hot_deals` (`id`, `restaurantId`, `name`, `description`, `originalPriceHuf`, `dealPriceHuf`) VALUES
(1, 1, 'Napi menü', 'Leves + főétel hétköznap 14:00-ig', 3990, 2990),
(2, 3, '2 pizza akció', 'Két közepes pizza együtt', 6580, 5490),
(3, 6, 'Brunch páros csomag', '2 brunch + 2 kávé', 8380, 6990),
(4, 10, 'Beach burger deal', 'Burger + üdítő', 3980, 3190);

-- --------------------------------------------------------

--
-- A tábla adatainak kiíratása `reservations`
--

INSERT INTO `reservations` (`id`, `restaurantId`, `userId`, `date`, `time`, `peopleCount`, `status`, `publicToken`, `createdAt`, `updatedAt`) VALUES
(1, 1, 2, '2026-02-28', '19:00', 2, 'pending', 'demo_token_001', '2026-02-24 10:00:00', '2026-02-24 10:00:00'),
(2, 3, 2, '2026-03-01', '18:30', 4, 'confirmed', 'demo_token_002', '2026-02-24 11:15:00', '2026-02-24 12:00:00');

-- --------------------------------------------------------

--
-- Indexek a kiírt táblákhoz
--

--
-- A tábla indexei `users`
--
ALTER TABLE `users`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `uq_users_email` (`email`);

--
-- A tábla indexei `restaurants`
--
ALTER TABLE `restaurants`
  ADD PRIMARY KEY (`id`);

--
-- A tábla indexei `reservations`
--
ALTER TABLE `reservations`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `uq_res_publicToken` (`publicToken`),
  ADD KEY `idx_res_restaurant` (`restaurantId`),
  ADD KEY `idx_res_user` (`userId`),
  ADD KEY `idx_res_status` (`status`),
  ADD KEY `idx_res_createdAt` (`createdAt`);

--
-- A tábla indexei `menu_items`
--
ALTER TABLE `menu_items`
  ADD PRIMARY KEY (`id`),
  ADD KEY `idx_menu_restaurant` (`restaurantId`);

--
-- A tábla indexei `reviews`
--
ALTER TABLE `reviews`
  ADD PRIMARY KEY (`id`),
  ADD KEY `idx_reviews_restaurant` (`restaurantId`),
  ADD KEY `idx_reviews_user` (`userId`);

--
-- A tábla indexei `review_responses`
--
ALTER TABLE `review_responses`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `uq_review_responses_review` (`reviewId`),
  ADD KEY `idx_review_responses_admin` (`adminUserId`);

--
-- A tábla indexei `hot_deals`
--
ALTER TABLE `hot_deals`
  ADD PRIMARY KEY (`id`),
  ADD KEY `idx_deals_restaurant` (`restaurantId`);

-- --------------------------------------------------------

--
-- A kiírt táblák AUTO_INCREMENT értéke
--

--
-- AUTO_INCREMENT a táblához `users`
--
ALTER TABLE `users`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=3;

--
-- AUTO_INCREMENT a táblához `restaurants`
--
ALTER TABLE `restaurants`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=11;

--
-- AUTO_INCREMENT a táblához `reservations`
--
ALTER TABLE `reservations`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=3;

--
-- AUTO_INCREMENT a táblához `menu_items`
--
ALTER TABLE `menu_items`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=21;

--
-- AUTO_INCREMENT a táblához `reviews`
--
ALTER TABLE `reviews`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=4;

--
-- AUTO_INCREMENT a táblához `review_responses`
--
ALTER TABLE `review_responses`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=3;

--
-- AUTO_INCREMENT a táblához `hot_deals`
--
ALTER TABLE `hot_deals`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=5;

-- --------------------------------------------------------

--
-- Megkötések a kiírt táblákhoz
--

--
-- Megkötések a táblához `reservations`
--
ALTER TABLE `reservations`
  ADD CONSTRAINT `fk_res_restaurant` FOREIGN KEY (`restaurantId`) REFERENCES `restaurants` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT `fk_res_user` FOREIGN KEY (`userId`) REFERENCES `users` (`id`) ON DELETE CASCADE ON UPDATE CASCADE;

--
-- Megkötések a táblához `menu_items`
--
ALTER TABLE `menu_items`
  ADD CONSTRAINT `fk_menu_restaurant` FOREIGN KEY (`restaurantId`) REFERENCES `restaurants` (`id`) ON DELETE CASCADE ON UPDATE CASCADE;

--
-- Megkötések a táblához `reviews`
--
ALTER TABLE `reviews`
  ADD CONSTRAINT `fk_reviews_restaurant` FOREIGN KEY (`restaurantId`) REFERENCES `restaurants` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT `fk_reviews_user` FOREIGN KEY (`userId`) REFERENCES `users` (`id`) ON DELETE CASCADE ON UPDATE CASCADE;

--
-- Megkötések a táblához `review_responses`
--
ALTER TABLE `review_responses`
  ADD CONSTRAINT `fk_review_responses_review` FOREIGN KEY (`reviewId`) REFERENCES `reviews` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT `fk_review_responses_admin` FOREIGN KEY (`adminUserId`) REFERENCES `users` (`id`) ON DELETE CASCADE ON UPDATE CASCADE;

--
-- Megkötések a táblához `hot_deals`
--
ALTER TABLE `hot_deals`
  ADD CONSTRAINT `fk_deals_restaurant` FOREIGN KEY (`restaurantId`) REFERENCES `restaurants` (`id`) ON DELETE CASCADE ON UPDATE CASCADE;

COMMIT;

/*!40101 SET CHARACTER_SET_CLIENT=@OLD_CHARACTER_SET_CLIENT */;
/*!40101 SET CHARACTER_SET_RESULTS=@OLD_CHARACTER_SET_RESULTS */;
/*!40101 SET COLLATION_CONNECTION=@OLD_COLLATION_CONNECTION */;