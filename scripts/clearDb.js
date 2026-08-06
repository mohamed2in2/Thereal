/* eslint-disable @typescript-eslint/no-require-imports */
require('dotenv').config();
const { Client } = require('pg');

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  console.error('DATABASE_URL not set. Aborting.');
  process.exit(1);
}

async function main() {
  const client = new Client({ connectionString });
  try {
    await client.connect();
    console.log('Connected to DB. Running truncate...');
    const sql = 'TRUNCATE "QuizQuestion","QuizResult","Progress","Video","Folder","AccessCode","Quiz","Course","User" RESTART IDENTITY CASCADE;';
    await client.query(sql);
    console.log('Truncate successful.');
  } catch (err) {
    console.error('Error truncating tables:', err);
    process.exitCode = 1;
  } finally {
    await client.end();
  }
}

main();
