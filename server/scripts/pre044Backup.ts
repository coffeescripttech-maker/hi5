import fs from 'fs';
import path from 'path';
import { getConnection } from '../src/config/database';
import { generateLogicalDump, BACKUP_DIR } from '../src/utils/dbBackup';

(async () => {
  const conn = await getConnection();
  try {
    const DB_NAME = (process.env.DB_NAME as string) || 'hi5_db';
    const sql = await generateLogicalDump(conn, DB_NAME);
    const stamp = new Date().toISOString().replace(/[:]/g, '-');
    const file = path.resolve(BACKUP_DIR, `pre-044-${stamp}.sql`);
    fs.writeFileSync(file, sql, 'utf8');
    console.log('BACKUP_WRITTEN:' + file + ' size=' + sql.length);
  } finally {
    conn.release();
  }
  process.exit(0);
})().catch((e) => { console.error('BACKUP_ERR:', e.message); process.exit(1); });
