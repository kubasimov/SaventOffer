const express = require("express");
const router = express.Router();
const pool = require("../db/pool");
const bcrypt = require("bcrypt");
const requireAdmin = require("../middleware/admin");
const { enforcePasswordPolicy } = require("../utils/password");

router.get("/", requireAdmin, async (req, res) => {
  const users = (
    await pool.query(
      "SELECT id,email,imie_nazwisko,rola,aktywny,utworzony FROM users ORDER BY utworzony ASC"
    )
  ).rows;
  res.json(users);
});

router.post("/", requireAdmin, async (req, res) => {
  const { email, haslo, imie } = req.body;
  if (!email || !haslo) return res.status(400).json({ error: "Podaj email i haslo" });
  try { enforcePasswordPolicy(haslo); } catch (e) { return res.status(400).json({ error: e.message }); }
  try {
    const hash = await bcrypt.hash(haslo, 11);
    const user = (
      await pool.query(
        "INSERT INTO users (email, haslo_hash, imie_nazwisko, rola) VALUES ($1,$2,$3,$4) RETURNING id, email, imie_nazwisko, rola, aktywny",
        [email, hash, imie || ""]
      )
    ).rows[0];
    res.status(201).json(user);
  } catch (e) {
    if (e.code === "23505") return res.status(400).json({ error: "Email juz istnieje" });
    res.status(500).json({ error: e.message });
  }
});

router.put("/:id", requireAdmin, async (req, res) => {
  const { aktywny, imie, haslo } = req.body;
  try {
    if (haslo) {
      try { enforcePasswordPolicy(haslo); } catch (e) { return res.status(400).json({ error: e.message }); }
      const hash = await bcrypt.hash(haslo, 11);
      await pool.query("UPDATE users SET haslo_hash = $1 WHERE id = $2", [hash, req.params.id]);
    }
    const updated = (
      await pool.query(
        "UPDATE users SET aktywny = COALESCE($1, aktywny), imie_nazwisko = COALESCE($2, imie_nazwisko) WHERE id = $3 RETURNING id, email, imie_nazwisko, rola, aktywny",
        [aktywny !== undefined ? aktywny : null, imie || null, req.params.id]
      )
    ).rows[0];
    res.json(updated);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

module.exports = router;
