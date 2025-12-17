-- phpMyAdmin SQL Dump
-- version 5.2.1
-- https://www.phpmyadmin.net/
--
-- Gép: 127.0.0.1
-- Létrehozás ideje: 2025. Dec 17. 16:25
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
  `status` varchar(20) DEFAULT 'pending'
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- A tábla adatainak kiíratása `reservations`
--

INSERT INTO `reservations` (`id`, `restaurantId`, `userId`, `date`, `time`, `peopleCount`, `status`) VALUES
(2, 1, 3, '0000-00-00', '18:00', 2, 'pending'),
(3, 2, 9, '0000-00-00', '18:00', 2, 'pending'),
(4, 2, 10, '2026-04-13', '13:00', 10000000, 'pending'),
(5, 1, 9, '0000-00-00', '18:00', 2, 'pending'),
(6, 1, 11, '0000-00-00', '18:00', 2, 'pending'),
(7, 1, 9, '0000-00-00', '18:00', 2, 'pending');

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
  `openingHours` varchar(100) DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- A tábla adatainak kiíratása `restaurants`
--

INSERT INTO `restaurants` (`id`, `name`, `city`, `address`, `cuisine`, `priceRange`, `description`, `openingHours`) VALUES
(1, 'Pesti Étterem', 'Budapest', '1051 Budapest, Fő utca 1.', 'Magyar', '$$', 'Hagyományos magyar ételek modern tálalással.', 'H–V: 11:00–22:00'),
(2, 'La Pasta', 'Budapest', '1061 Budapest, Olasz tér 2.', 'Olasz', '$$', 'Friss tészta és pizza kemencéből.', 'H–V: 12:00–23:00');

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

--
-- A tábla adatainak kiíratása `users`
--

INSERT INTO `users` (`id`, `name`, `email`, `password_hash`, `role`) VALUES
(3, 'asd', 'kristofkvcs24@gmail.com', '$2a$10$LbBVAhHa8nEEpPi5.4yVJeOdNl42oT9BR3U1stTtYFk9Q7XOuTeTW', 'user'),
(5, 'Admin Felhasználó', 'admin@example.com', '$2b$10$jEso/mzOfNWFZn1YRSAN/.ogLHOMfuKOzok/t0CkCXQrjOF/oaz6.', 'admin'),
(9, 'Teszt Felhasználó', 'user@example.com', '$2b$10$Y5IuVMiXPsnIDvpRqTdilOf7JW2GoqbkHCteu65/lCq0BCHHvb0ti', 'user'),
(10, 'kristofios', 'kovacskristof5a@gmail.com', '$2b$10$wGqpAlOVrWa3vZGUAajyQug2Yv7kdl14Xex3RGhBfy0zwZpfW0Nq.', 'user'),
(11, 'blabla', 'blabla@fmail.com', '$2b$10$muECB2JH1X0M5l.Sko8N7.6Q78H.Lfg5uqN4IoDH9f7KpWC.qRLSC', 'user'),
(12, 'Android ', 'android@gmail.com', '$2b$10$plIoMjH2Q46jvKovK2JcOeKVTXNDNUWlB1q0PbCJ8vSJoE0nAuQoe', 'user');

--
-- Indexek a kiírt táblákhoz
--

--
-- A tábla indexei `reservations`
--
ALTER TABLE `reservations`
  ADD PRIMARY KEY (`id`),
  ADD KEY `restaurantId` (`restaurantId`),
  ADD KEY `userId` (`userId`);

--
-- A tábla indexei `restaurants`
--
ALTER TABLE `restaurants`
  ADD PRIMARY KEY (`id`);

--
-- A tábla indexei `users`
--
ALTER TABLE `users`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `email` (`email`);

--
-- A kiírt táblák AUTO_INCREMENT értéke
--

--
-- AUTO_INCREMENT a táblához `reservations`
--
ALTER TABLE `reservations`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=8;

--
-- AUTO_INCREMENT a táblához `restaurants`
--
ALTER TABLE `restaurants`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=3;

--
-- AUTO_INCREMENT a táblához `users`
--
ALTER TABLE `users`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=13;

--
-- Megkötések a kiírt táblákhoz
--

--
-- Megkötések a táblához `reservations`
--
ALTER TABLE `reservations`
  ADD CONSTRAINT `reservations_ibfk_1` FOREIGN KEY (`restaurantId`) REFERENCES `restaurants` (`id`),
  ADD CONSTRAINT `reservations_ibfk_2` FOREIGN KEY (`userId`) REFERENCES `users` (`id`);
COMMIT;

/*!40101 SET CHARACTER_SET_CLIENT=@OLD_CHARACTER_SET_CLIENT */;
/*!40101 SET CHARACTER_SET_RESULTS=@OLD_CHARACTER_SET_RESULTS */;
/*!40101 SET COLLATION_CONNECTION=@OLD_COLLATION_CONNECTION */;
