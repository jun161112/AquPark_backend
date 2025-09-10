const express = require('express');
const bcrypt = require('bcrypt');
const pool = require('../db');
const {checkLogin} = require('../middlewares/authMiddleware');
const authorizeOwnerOrAdmin = require('../middlewares/authorizeOwnerOrAdmin');

const router = express.Router();

// 登入
/**
 * @openapi
 * /users/login:
 *   post:
 *     summary: 使用者登入
 *     description: 用戶登入
 *     tags: [Users - 會員管理]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - email
 *               - password
 *             properties:
 *               email:
 *                 type: string
 *                 format: email
 *                 description: 使用者的電子郵件
 *                 example: "swagger@mail.com"
 *               password:
 *                 type: string
 *                 format: password
 *                 description: 使用者的密碼
 *                 example: "swagger"
 *     responses:
 *       200:
 *         description: 登入成功，返回使用者 ID
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: "登入成功"
 *                 userId:
 *                   type: integer
 *                   example: 13
 *       401:
 *         description: Email 或密碼錯誤
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 error:
 *                   type: string
 *                   example: "Email 或密碼錯誤"
 *       500:
 *         description: 伺服器錯誤
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 error:
 *                   type: string
 *                   example: 登入失敗，請稍後在試
 */
router.post('/login', async (req, res) => {
    const { email, password } = req.body;

    try {
        const conn = await pool.getConnection();
        const [rows] = await conn.query('SELECT id, password FROM users WHERE email = ?', [email]);
        conn.release();

        // 比對信箱是否正確
        if (rows.length === 0) {
            return res.status(401).json({ error: 'Email 或密碼錯誤' });
        }

        const user = rows[0];
        const isPasswordValid = await bcrypt.compare(password, user.password);

        // 比對密碼是否正確
        if (!isPasswordValid) {
            return res.status(401).json({ error: 'Email 或密碼錯誤' });
        }

        res.json({ message: '登入成功', userId: user.id });
    } catch (err) {
        res.status(500).json({ message: '登入失敗，請稍後再試' });
    }
});

// 註冊
/**
 * @openapi
 * /users/register:
 *   post:
 *     summary: 註冊新用戶
 *     description: 判斷[信箱]是否有重複後存入資料。
 *     tags: [Users - 會員管理]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - userName
 *               - email
 *               - password
 *             properties:
 *               userName:
 *                 type: string
 *                 description: 使用者名稱
 *                 example: "testContainer(testc)"
 *               email:
 *                 type: string
 *                 format: email
 *                 description: 使用者信箱(不可與現有信箱重複)
 *                 example: "testContainer@mail.com"
 *               tel:
 *                 type: string
 *                 description: 使用者電話(可空)
 *                 example: "0800123321"
 *               password:
 *                 type: string
 *                 format: password
 *                 description: 使用者密碼(加密後存入)
 *                 example: "testc"
 *     responses:
 *       201:
 *         description: 註冊成功
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: 註冊成功
 *       400:
 *         description: 該 email 已被使用，請使用其他 email 註冊
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 error:
 *                   type: string
 *                   example: 該 email 已被使用，請使用其他 email 註冊
 *       500:
 *         description: 伺服器錯誤
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 error:
 *                   type: string
 *                   example: 無法註冊帳號，請稍後再試
 */
router.post('/register', async (req, res) => {
    const { userName, email, tel, password } = req.body;

    try {
        const conn = await pool.getConnection();

        // 驗證 email 是否已存在
        const [existingUser] = await conn.query('SELECT * FROM users WHERE email = ?', [email]);
        if (existingUser.length > 0) {
            conn.release();
            return res.status(400).json({ error: '該 email 已被使用，請使用其他 email 註冊' });
        }

        // 密碼加密
        const hashedPassword = await bcrypt.hash(password, 10);
        
        await conn.query(
            'INSERT INTO users (admin, userName, email, tel, password, editTime) VALUES (?, ?, ?, ?, ?, NOW())',
            [0, userName, email, tel, hashedPassword]
        );
        conn.release();

        res.status(201).json({ message: '註冊成功' });
    } catch (err) {
        // res.status(500).json({ error: err.message });
        res.status(500).json({ message: '無法註冊帳號，請稍後再試' });
    }
});

// 修改會員資料
/**
 * @openapi
 * /users/profile:
 *   patch:
 *     summary: 修改會員資料
 *     description: 登入後使用者可修改自己的資料，管理員可指定修改其他人。
 *     tags: [Users - 會員管理]
 *     security:
 *       - groupHeader: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               userName:
 *                 type: string
 *               email:
 *                 type: string
 *                 format: email
 *               tel:
 *                 type: string
 *               password:
 *                 type: string
 *                 format: password
 *               targetUserId:
 *                 type: integer
 *                 description: 僅管理員可指定他人 ID
 *     responses:
 *       200:
 *         description: 成功修改
 *       400:
 *         description: 欄位不完整或權限不足
 *       500:
 *         description: 伺服器錯誤
 */
router.patch('/profile', checkLogin(false), authorizeOwnerOrAdmin({ source: 'body', key: 'targetUserId' }), async (req, res) => {
    const userId = req.effectiveUserId;
    const { userName, email, tel, password } = req.body;

    // 動態組 SQL 欄位
    const fields = [];
    const values = [];

    if (userName) {
      fields.push('userName = ?');
      values.push(userName);
    }
    if (email) {
      fields.push('email = ?');
      values.push(email);
    }
    if (tel) {
      fields.push('tel = ?');
      values.push(tel);
    }
    if (password) {
      const hash = await bcrypt.hash(password, 10);
      fields.push('password = ?');
      values.push(hash);
    }

    if (fields.length === 0) {
      return res
        .status(400)
        .json({ error: '沒有提供任何需要更新的欄位' });
    }

    fields.push('editTime = NOW()');
    const sql = `UPDATE users SET ${fields.join(', ')} WHERE id = ?`;
    values.push(userId);

    try {
      const conn = await pool.getConnection();
      await conn.query(sql, values);
      conn.release();
      res.json({ message: '資料已更新' });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
});

// 取得使用者
/**
 * @openapi
 * /users/{userId}:
 *   get:
 *     summary: 查詢使用者
 *     description: 
 *       非管理員使用者僅能查看自己的資料；  
 *       管理員可指定任何 userId。
 *     tags: [Users - 會員管理]
 *     security:
 *       - groupHeader: []
 *     parameters:
 *       - in: path
 *         name: userId
 *         required: true
 *         schema:
 *           type: integer
 *         description: 欲查詢的使用者 ID
 *     responses:
 *       200:
 *         description: 成功回傳單一使用者資訊
 *       403:
 *         description: 權限不足
 *       404:
 *         description: 找不到該使用者
 *       500:
 *         description: 伺服器錯誤
 */
router.get('/:userId', checkLogin(false), authorizeOwnerOrAdmin({ source: 'params', key: 'userId' }), async (req, res) => {
    const userId = req.effectiveUserId;

    try {
        const conn = await pool.getConnection();
        const [rows] = await conn.query('SELECT id, admin, userName, email, tel, editTime FROM users WHERE id = ?', [userId]);
        conn.release();

      if (rows.length === 0) {
        return res.status(404).json({ error: '找不到該使用者' });
      }
        res.json(rows);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

module.exports = router;
