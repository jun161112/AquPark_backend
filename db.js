require('dotenv').config();
const mysql = require('mysql2/promise');

const pool = mysql.createPool({ // createPool >>> 建立可重複使用的連線提升效能
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_DATABASE,
    port: process.env.DB_PORT,
    waitForConnections: true, // 無可連線時是否等待
    connectionLimit: 10, // 同時連線最大數
    queueLimit: 0 // 佇列上限
});

module.exports = pool;