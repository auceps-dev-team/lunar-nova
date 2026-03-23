const { Pool } = require('pg');
require('dotenv').config({ path: '.env' });

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

async function test() {
    try {
        console.log("Checking wa_contact_lists...");
        const lists = await pool.query('SELECT * FROM wa_contact_lists');
        console.log("Lists in DB:", lists.rows);

        if (lists.rows.length === 0) {
            console.log("No lists found!");
            process.exit(0);
        }

        const listId = lists.rows[0].id;
        
        console.log("Checking wa_contacts...");
        const contacts = await pool.query('SELECT id, name, list_id FROM wa_contacts LIMIT 2');
        console.log("Contacts in DB:", contacts.rows);

        if (contacts.rows.length === 0) {
            process.exit(0);
        }

        const contactIds = contacts.rows.map(c => c.id);
        
        console.log(`Updating contacts [${contactIds.join(',')}] to list_id ${listId}...`);
        
        const idPlaceholders = contactIds.map((_, i) => `$${i + 2}`).join(',');
        const query = `
            UPDATE wa_contacts 
            SET list_id = $1 
            WHERE id IN (${idPlaceholders}) 
            RETURNING *
        `;

        const values = [listId, ...contactIds];
        const updateResult = await pool.query(query, values);
        
        console.log(`Update Result: ${updateResult.rowCount} rows affected.`);
        
        const finalCheck = await pool.query(`
            SELECT c.id, c.list_id, l.name as list_name
            FROM wa_contacts c
            LEFT JOIN wa_contact_lists l ON c.list_id = l.id
            WHERE c.id IN (${idPlaceholders})
        `, contactIds);
        
        console.log("Final check of joined list names:", finalCheck.rows);

    } catch (e) {
        console.error(e);
    } finally {
        pool.end();
    }
}

test();
