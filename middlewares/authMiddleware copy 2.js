// 檢測是否登入並檢查管理員資格
const pool = require('../db');

const checkLogin = async (req, res, next) => {
    const userId = req.headers['x-group']; // 獲取用戶 ID

    if (!userId) {
        return res.status(401).json({ error: '請登入後操作，謝謝。' });
    }

    try {
        const conn = await pool.getConnection();
        const [rows] = await conn.query('SELECT admin FROM users WHERE id = ?', [userId]);
        conn.release();

        if (rows.length === 0) {
            return res.status(404).json({ error: '用戶不存在' });
        }

        const user = rows[0];

        if (user.admin !== 1) {
            // 如果 admin 不等於 1，判定為非管理員
            return res.status(403).json({ error: '您沒有管理員權限。' });
        }

        req.userId = userId; // 設置登入用戶的 ID
        req.isAdmin = user.admin; // 設置管理員資格
        next(); // 通過檢查，進入下一個中介函式或路由邏輯
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

module.exports = checkLogin;
