// Optional offline PostgreSQL-engine regression check; not a substitute for concurrency/server tests.
// npm install --prefix <temporary-folder> @electric-sql/pglite
// node scripts/smoke/sql-embedded.cjs <temporary-folder>/node_modules/@electric-sql/pglite
const {PGlite} = require(process.argv[2] || '@electric-sql/pglite');
const fs = require('node:fs');
const path = require('node:path');
(async()=>{
 const db = new PGlite();
 const root = path.resolve(__dirname,'../..');
 try {
  await db.exec(fs.readFileSync(path.join(root,'database/schema/01_schema.sql'),'utf8'));
  const result=await db.query("SELECT count(*)::integer AS n FROM information_schema.tables WHERE table_schema='campus' AND table_type='BASE TABLE'");
  if(result.rows[0].n!==15) throw new Error('Expected 15 campus tables');
  await db.exec(fs.readFileSync(path.join(root,'database/tests/02_registration_reset.sql'),'utf8'));
  const empty=await db.query('SELECT count(*)::integer AS n FROM campus.users');
  if(empty.rows[0].n!==0) throw new Error('Test fixtures were not rolled back');
  console.log('PASS: embedded PostgreSQL schema + registration regression; fixtures rolled back. Not a server/concurrency test.');
 } finally {await db.close();}
})().catch(error=>{console.error(error);process.exitCode=1;});
