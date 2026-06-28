const { Pool } = require('pg');
require('dotenv').config();
const p = new Pool({host:process.env.DB_HOST,port:process.env.DB_PORT,database:process.env.DB_NAME,user:process.env.DB_USER,password:process.env.DB_PASSWORD});
(async()=>{
  try {
    const r = await p.query("SELECT tableowner FROM pg_tables WHERE tablename='clients'");
    console.log('owner:', r.rows[0]?.tableowner);
  } catch(e) { console.log('ERR:', e.message); }
  await p.end();
})();