const path = require('path');
const sqlite3 = require('sqlite3').verbose();
const { open } = require('sqlite');

async function test() {
    const db = await open({
        filename: path.join(__dirname, 'database.sqlite'),
        driver: sqlite3.Database
    });

    console.log("Checking wa_contact_lists...");
    let lists = await db.all("SELECT * FROM wa_contact_lists");
    console.log("Lists:", lists);

    if (lists.length === 0) {
        console.log("Inserting a dummy list...");
        await db.run("INSERT INTO wa_contact_lists (name) VALUES ('Test List')");
        lists = await db.all("SELECT * FROM wa_contact_lists");
        console.log("Lists after insert:", lists);
    }

    const listId = lists[0].id;

    console.log("Checking wa_contacts...");
    let contacts = await db.all("SELECT id, name, list_id FROM wa_contacts LIMIT 2");
    console.log("Contacts:", contacts);

    if (contacts.length === 0) {
        console.log("Inserting dummy contacts...");
        await db.run("INSERT INTO wa_contacts (name, phone) VALUES ('c1', '123'), ('c2', '456')");
        contacts = await db.all("SELECT id, name, list_id FROM wa_contacts LIMIT 2");
        console.log("Contacts after insert:", contacts);
    }
    
    const contactIds = contacts.map(c => c.id);
    const idPlaceholders = contactIds.map(() => '?').join(',');

    console.log(`Updating contacts [${contactIds.join(',')}] with list_id ${listId}...`);
    try {
        const updateParams = [listId, ...contactIds];
        const updateSql = `UPDATE wa_contacts SET list_id = ? WHERE id IN (${idPlaceholders}) RETURNING *`;
        console.log("Executing:", updateSql, updateParams);
        
        const result = await db.all(updateSql, updateParams);
        console.log("Update result rows:", result);
    } catch (e) {
        console.error("Update failed:", e.message);
    }

    const verify = await db.all(`
        SELECT c.id, c.name, c.list_id, l.name as list_name
        FROM wa_contacts c
        LEFT JOIN wa_contact_lists l ON c.list_id = l.id
        WHERE c.id IN (${idPlaceholders})
    `, contactIds);

    console.log("Verification after update:", verify);
    
    await db.close();
}

test().catch(console.error);
