const fs = require('fs');
const mysql = require('mysql2/promise');
require('dotenv').config();

(async () => {
    try {
        const connection = await mysql.createConnection({
            host: process.env.DB_HOST,
            user: process.env.DB_USER,
            password: process.env.DB_PASS,
            database: process.env.DB_NAME,
            port: process.env.DB_PORT || 3306,
            multipleStatements: true,
        });

        console.log("✅ Connected to Railway MySQL");

        const sql = fs.readFileSync('./full-dump.sql', 'utf8');
        await connection.query(sql);

        console.log("✅ All tables imported successfully.");
        await connection.end();
    } catch (err) {
        console.error("❌ Import failed:", err);
    }
})();
