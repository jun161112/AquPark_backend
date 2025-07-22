const pool = require('./db');

async function testConnection() {
    try {
        const connection = await pool.getConnection();
        console.log('✅ 資料庫連線成功！');
        connection.release(); // 釋放連線回連線池
    } catch (err) {
        console.error('❌ 連線失敗：', err);
    }
}

testConnection();
