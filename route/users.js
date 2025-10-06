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
 *     description: 用戶登入，成功後回傳使用者完整資訊
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
 *         description: 登入成功，返回使用者資訊
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
 *                 admin:
 *                   type: boolean
 *                   example: false
 *                 userName:
 *                   type: string
 *                   example: "小明"
 *                 email:
 *                   type: string
 *                   format: email
 *                   example: "swagger@mail.com"
 *                 tel:
 *                   type: string
 *                   example: "0912345678"
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
  let conn;

  try {
    conn = await pool.getConnection();
    const [rows] = await conn.query('SELECT id, password, admin, userName, email, tel FROM users WHERE email = ?', [email]);
    conn.release();

    // 比對信箱是否正確
    if (rows.length === 0) {
      return res.status(401).json({ error: 'Email 或密碼錯誤' });
    }

    const user = rows[0];
    const isValid = await bcrypt.compare(password, user.password);

    // 比對密碼是否正確
    if (!isValid) {
      return res.status(401).json({ error: 'Email 或密碼錯誤' });
    }

    // 4. 回傳使用者資訊（不回傳 password）
    res.status(200).json({
      message:  '登入成功',
      userId:   user.id,
      admin:    user.admin,
      userName: user.userName,
      email:    user.email,
      tel:      user.tel
    });
  } catch (err) {
    if (conn) conn.release();
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

// 驗證 Email 是否已被使用
/**
 * @openapi
 * /users/checkEmail:
 *   get:
 *     summary: 驗證 Email 是否已註冊
 *     description: 確認前端輸入的 Email 是否已在系統中註冊過
 *     tags: [Users - 會員管理]
 *     parameters:
 *       - in: query
 *         name: email
 *         required: true
 *         schema:
 *           type: string
 *           format: email
 *         description: 欲驗證的 Email
 *     responses:
 *       200:
 *         description: 回傳 Email 是否已被使用
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 exists:
 *                   type: boolean
 *                   example: false
 *       400:
 *         description: 缺少或格式錯誤的 email
 *       500:
 *         description: 伺服器錯誤
 */
router.get('/checkEmail', async (req, res) => {
  const email = req.query.email;
  if (typeof email !== 'string' || !email.includes('@')) {
    return res.status(400).json({ error: '請提供有效的 Email'});
  }

  let conn;
  try {
    conn = await pool.getConnection();
    const [rows] = await conn.query(
      'SELECT 1 FROM users WHERE email = ? LIMIT 1',
      [email]
    );
    // exists: 有紀錄 = true; 沒紀錄 = false
    res.json({ exists: rows.length > 0 });
  } catch (err) {
    res.status(500).json({ error: err.message });
  } finally {
    if (conn) conn.release();
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
 * /users:
 *   get:
 *     summary: 取得使用者資料
 *     description: |
 *       - 一般會員只能取得自己的帳號資訊  
 *       - 管理員可搜尋所有使用者，並自訂 page 和 limit 分頁  
 *     tags: [Users - 會員管理]
 *     security:
 *       - groupHeader: []
 *     parameters:
 *       - in: query
 *         name: id
 *         schema:
 *           type: integer
 *         description: 管理員可依 id 精確搜尋
 *       - in: query
 *         name: userName
 *         schema:
 *           type: string
 *         description: 管理員可依 userName 做模糊搜尋
 *       - in: query
 *         name: email
 *         schema:
 *           type: string
 *           format: email
 *         description: 管理員可依 email 做模糊搜尋
 *       - in: query
 *         name: tel
 *         schema:
 *           type: string
 *         description: 管理員可依 tel 做模糊搜尋
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           default: 1
 *         description: 管理員分頁的頁碼（從 1 開始）
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 10
 *         description: 管理員分頁時每頁顯示筆數
 *     responses:
 *       200:
 *         description: 會員資料或分頁使用者列表
 *         content:
 *           application/json:
 *             schema:
 *               oneOf:
 *                 - type: object
 *                   properties:
 *                     id:
 *                       type: integer
 *                     admin:
 *                       type: integer
 *                     userName:
 *                       type: string
 *                     email:
 *                       type: string
 *                       format: email
 *                     tel:
 *                       type: string
 *                     editTime:
 *                       type: string
 *                       format: date-time
 *                 - type: object
 *                   properties:
 *                     total:
 *                       type: integer
 *                     page:
 *                       type: integer
 *                     limit:
 *                       type: integer
 *                     users:
 *                       type: array
 *                       items:
 *                         type: object
 *                         properties:
 *                           id:
 *                             type: integer
 *                           admin:
 *                             type: integer
 *                           userName:
 *                             type: string
 *                           email:
 *                             type: string
 *                             format: email
 *                           tel:
 *                             type: string
 *                           editTime:
 *                             type: string
 *                             format: date-time
 *       403:
 *         description: 權限不足
 *       500:
 *         description: 伺服器錯誤
 */
router.get('/', checkLogin(false), async (req, res) => {
    const currentUserId = req.userId;
    const isAdmin       = req.isAdmin;
    let conn;

    try {
      conn = await pool.getConnection();

      // 非管理員：只拿自己的資料
      if (!isAdmin) {
        const [rows] = await conn.query(
          'SELECT id, admin, userName, email, tel, editTime FROM users WHERE id = ?',
          [currentUserId]
        );
        if (rows.length === 0) {
          return res.status(404).json({ error: '找不到該使用者' });
        }
        return res.json(rows[0]);
      }

      // 管理員：可模糊搜尋並分頁
      const { id, userName, email, tel } = req.query;
      const page  = Math.max(parseInt(req.query.page, 10)  || 1,  1);
      const limit = Math.max(parseInt(req.query.limit, 10) || 10, 1);
      const offset = (page - 1) * limit;

      const conds = [];
      const params = [];

      if (id) {
        conds.push('id = ?');
        params.push(Number(id));
      } if (userName) {
        conds.push('userName LIKE ?');
        params.push(`%${userName}%`);
      } if (email) {
        conds.push('email LIKE ?');
        params.push(`%${email}%`);
      } if (tel) {
        conds.push('tel LIKE ?');
        params.push(`%${tel}%`);
      }
      const whereClause = conds.length
        ? 'WHERE ' + conds.join(' AND ')
        : '';

      // 取得總筆數
      const [countRows] = await conn.query(
        `SELECT COUNT(*) AS total FROM users ${whereClause}`,
        params
      );
      const total = countRows[0].total;

      // 若無搜尋結果，回傳查無資料
      if (total === 0) {
        return res.status(404).json({ error: '查無資料' });
      }

      // 取得分頁資料
      const [users] = await conn.query(
        `SELECT id, admin, userName, email, tel, editTime
         FROM users
         ${whereClause}
         ORDER BY id ASC
         LIMIT ? OFFSET ?`,
        [...params, limit, offset]
      );

      return res.json({ total, page, limit, users });
    } catch (err) {
      return res.status(500).json({ error: err.message });
    } finally {
      if (conn) conn.release();
    }
  }
);

module.exports = router;


module.exports = router;
