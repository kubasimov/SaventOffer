#!/usr/bin/env node
require('dotenv').config({ path: '/opt/savento/backend/.env' });
const { Pool } = require('pg');
const jwt = require('jsonwebtoken');

const pool = new Pool({
  host: process.env.DB_HOST, port: process.env.DB_PORT,
  database: process.env.DB_NAME, user: process.env.DB_USER,
  password: process.env.DB_PASS,
});

const token = jwt.sign({ id:1, email:'admin@savento.pl', rola:'admin' }, process.env.JWT_SECRET, { expiresIn:'1h' });

(async () => {
  // find a client with no offers
  const c = await pool.query(`SELECT c.id,c.nazwa FROM clients c LEFT JOIN offers o ON o.klient_id=c.id WHERE o.id IS NULL LIMIT 1`);
  if (!c.rows.length) { console.log('BRAK KLIENTOW BEZ OFERT'); return; }
  const klient = c.rows[0];
  console.log('DELETE client:', klient.nazwa, klient.id);

  const http = require('http');
  const opts = {
    hostname: 'localhost', port: 3001, path: `/api/klienci/${klient.id}`,
    method: 'DELETE',
    headers: { 'Authorization': `Bearer ${token}` }
  };
  const req = http.request(opts, res => {
    let data = '';
    res.on('data', d => data += d);
    res.on('end', () => console.log('Status:', res.statusCode, 'Body:', data));
  });
  req.end();
})();