const mysql = require('mysql2/promise');
require('dotenv').config();

const pool = mysql.createPool({
    // host: 'localhost',
    // user: 'root',
    // password: '',
    // database: 'spssvmic_db',
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASS,
    database: process.env.DB_NAME,
    port: process.env.DB_PORT || 3306,
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0
});

// Test connection when the module loads
(async () => {
    try {
        const connection = await pool.getConnection();
        console.log("✅ Connected to MySQL using mysql2.");
        connection.release();
    } catch (err) {
        console.error("❌ MySQL connection failed:", err);
    }
})();

module.exports = pool;

// const mysql = require('mysql2');
// require('dotenv').config();

// const connection = mysql.createConnection({
//     host: 'localhost',
//     user: 'root',
//     password: 'Vg2002@@',
//     database: 'spssvmic_db',
// });

// connection.connect(err => {
//     if (err) throw err;
//     console.log("✅ Connected to MySQL using mysql2.");
// });


// module.exports = connection;