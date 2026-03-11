import Database from 'better-sqlite3';

const db = new Database('../../data/dispatch.db', { readonly: true });
const rows = db.prepare(`
    SELECT title, description, org, created 
    FROM tasks 
    WHERE (title LIKE '%Flipboard%' OR description LIKE '%Flipboard%' OR title LIKE '%AI Magazine%')
    AND created LIKE '2026-03-11%'
    ORDER BY created DESC 
    LIMIT 10
`).all();

console.log(JSON.stringify(rows, null, 2));
