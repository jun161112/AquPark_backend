const express = require('express');
const bcrypt = require('bcrypt');
const pool = require('./db');
const cors = require('cors');
require('dotenv').config();

const app = express();
app.use(express.json());
app.use(cors());


// 取得所有使用者 (不回傳密碼)
app.get('/users', async (req, res) => {
    try {
        const conn = await pool.getConnection();
        const [rows] = await conn.query('SELECT id, admin, userName, email, tel, editTime FROM users');
        conn.release();
        res.json(rows);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// 取得單一使用者 (不回傳密碼)
app.get('/users/:id', async (req, res) => {
    const { id } = req.params;
    try {
        const conn = await pool.getConnection();
        const [rows] = await conn.query('SELECT id, admin, userName, email, tel, editTime FROM users WHERE id = ?', [id]);
        conn.release();

        if (rows.length === 0) {
            return res.status(404).json({ error: '使用者未找到' });
        }
        res.json(rows[0]);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// 新增使用者 (加密密碼)
app.post('/users', async (req, res) => {
    const { admin, userName, email, tel, password } = req.body;

    if (!userName || !email || !password) {
        return res.status(400).json({ error: 'userName、email 和 password 為必填欄位' });
    }

    try {
        // 加密密碼
        const hashedPassword = await bcrypt.hash(password, 10);

        const conn = await pool.getConnection();
        const result = await conn.query(
            'INSERT INTO users (admin, userName, email, tel, password, editTime) VALUES (?, ?, ?, ?, ?, NOW())',
            [admin || false, userName, email, tel || null, hashedPassword]
        );
        conn.release();

        res.status(201).json({ id: result.insertId, admin, userName, email, tel, editTime: new Date() });
    } catch (err) {
        if (err.code === 'ER_DUP_ENTRY') {
            return res.status(400).json({ error: 'Email 已存在，請使用其他 Email' });
        }
        res.status(500).json({ error: err.message });
    }
});

// 更新使用者 (密碼可選擇更新)
app.put('/users/:id', async (req, res) => {
    const { id } = req.params;
    const { admin, userName, email, tel, password } = req.body;

    if (!userName || !email) {
        return res.status(400).json({ error: 'userName 和 email 為必填欄位' });
    }

    try {
        let hashedPassword = null;
        if (password) {
            hashedPassword = await bcrypt.hash(password, 10);
        }

        const conn = await pool.getConnection();
        const result = await conn.query(
            `UPDATE users 
            SET admin = ?, userName = ?, email = ?, tel = ?, ${password ? 'password = ?, ' : ''} editTime = NOW()
            WHERE id = ?`,
            password ? [admin || false, userName, email, tel || null, hashedPassword, id] 
                     : [admin || false, userName, email, tel || null, id]
        );
        conn.release();

        if (result.affectedRows === 0) {
            return res.status(404).json({ error: '使用者未找到' });
        }
        res.json({ id, admin, userName, email, tel, editTime: new Date() });
    } catch (err) {
        if (err.code === 'ER_DUP_ENTRY') {
            return res.status(400).json({ error: 'Email 已存在，請使用其他 Email' });
        }
        res.status(500).json({ error: err.message });
    }
});

// 刪除使用者
app.delete('/users/:id', async (req, res) => {
    const { id } = req.params;
    try {
        const conn = await pool.getConnection();
        const result = await conn.query('DELETE FROM users WHERE id = ?', [id]);
        conn.release();

        if (result.affectedRows === 0) {
            return res.status(404).json({ error: '使用者未找到' });
        }
        res.json({ message: '使用者已刪除' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// 登入
app.post('/login', async (req, res) => {
    const { email, password } = req.body;

    if (!email || !password) {
        return res.status(400).json({ error: '請提供 email 和 password' });
    }

    try {
        const conn = await pool.getConnection();
        const rows = await conn.query('SELECT id, password FROM users WHERE email = ?', [email]);
        conn.release();

        if (rows.length === 0) {
            return res.status(401).json({ error: 'Email 或密碼錯誤' });
        }

        const user = rows[0];
        const isPasswordValid = await bcrypt.compare(password, user.password);

        if (!isPasswordValid) {
            return res.status(401).json({ error: 'Email 或密碼錯誤' });
        }

        res.json({ message: '登入成功', userId: user.id });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});


// 啟動伺服器
const PORT = process.env.PORT || 3000;
app.listen(PORT, '0.0.0.0', () => {
    console.log(`伺服器運行於 PORT:${PORT}`);
});