const express = require('express');
const pool = require('../db');
const checkLogin = require('../middlewares/authMiddleware');
const authorizeOwnerOrAdmin = require('../middlewares/authorizeOwnerOrAdmin');

const router = express.Router();

// 取得購物車內容
/**
 * @openapi
 * /cart:
 *   get:
 *     summary: 取得購物車列表
 *     description: 管理員可查看任何使用者的購物車，非管理員僅能查看自己的購物車。
 *     tags: [Cart]
 *     security:
 *       - groupHeader: []
 *     parameters:
 *       - in: query
 *         name: targetUserId
 *         schema:
 *           type: integer
 *         description: 僅管理員可指定查詢其他使用者的購物車
 *     responses:
 *       200:
 *         description: 成功取得購物車列表
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 type: object
 *                 properties:
 *                   cartId:
 *                     type: integer
 *                   productId:
 *                     type: integer
 *                   title:
 *                     type: string
 *                   price:
 *                     type: number
 *                   salePrice:
 *                     type: number
 *                   qty:
 *                     type: integer
 *                   imgUrls:
 *                     type: string
 *       403:
 *         description: 權限不足
 *       500:
 *         description: 伺服器錯誤
 */
router.get('/', checkLogin(false), authorizeOwnerOrAdmin({ source: 'query', key: 'targetUserId' }), async (req, res) => {
    const userId = req.effectiveUserId;

    try {
        const conn = await pool.getConnection();
        const [rows] = await conn.query(
        `SELECT
            c.id AS cartId,
            c.productId,
            p.title,
            p.price,
            p.salePrice,
            p.imgUrls,
            c.qty
        FROM cart c
        JOIN products p ON c.productId = p.id
        WHERE c.userId = ?`,
        [userId]
        );
        conn.release();
        res.json(rows);
    } catch (err) {
    res.status(500).json({ error: err.message });
    }
});

// 新增至購物車
/**
 * @openapi
 * /cart:
 *   post:
 *     summary: 新增購物車項目
 *     description: 管理員可替任何使用者新增；一般使用者只能新增到自己的購物車。若項目已存在，自動累加數量。
 *     tags: [Cart]
 *     security:
 *       - groupHeader: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - productId
 *               - qty
 *             properties:
 *               productId:
 *                 type: integer
 *               qty:
 *                 type: integer
 *               targetUserId:
 *                 type: integer
 *                 description: 僅管理員可指定
 *     responses:
 *       201:
 *         description: 加入成功
 *       400:
 *         description: 欄位不完整或權限不足
 *       404:
 *         description: 商品不存在或未上架
 *       500:
 *         description: 伺服器錯誤
 */
router.post('/', checkLogin(false), authorizeOwnerOrAdmin({ source: 'body', key: 'targetUserId' }), async (req, res) => {
  const userId = req.effectiveUserId;
  const { productId, qty } = req.body;

  if (!productId || !qty) {
    return res.status(400).json({ error: '請提供 productId 與 qty' });
  }

  try {
    const conn = await pool.getConnection();

    // 確認商品存在且已上架
    const [prd] = await conn.query(
      'SELECT id FROM products WHERE id = ? AND sell = 1',
      [productId]
    );
    if (prd.length === 0) {
      conn.release();
      return res.status(404).json({ error: '商品不存在或未上架' });
    }

    // 檢查是否已在購物車
    const [cartRows] = await conn.query(
      'SELECT id, qty FROM cart WHERE userId = ? AND productId = ?',
      [userId, productId]
    );
    if (cartRows.length > 0) {
      await conn.query(
        'UPDATE cart SET qty = qty + ? WHERE id = ?',
        [qty, cartRows[0].id]
      );
    } else {
      await conn.query(
        'INSERT INTO cart (userId, productId, qty) VALUES (?, ?, ?)',
        [userId, productId, qty]
      );
    }

    conn.release();
    res.status(201).json({ message: '已加入購物車' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 更新購物車
/**
 * @openapi
 * /cart:
 *   patch:
 *     summary: 更新購物車項目數量或刪除
 *     description: |
 *       管理員可更新任意使用者的購物車；一般使用者僅能更新自己的。  
 *       qty < 0 回傳 400；qty = 0 等同刪除該品項。  
 *     tags: [Cart]
 *     security:
 *       - groupHeader: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - productId
 *               - qty
 *             properties:
 *               productId:
 *                 type: integer
 *                 example: 3
 *               qty:
 *                 type: integer
 *                 example: 2
 *               targetUserId:
 *                 type: integer
 *                 description: 僅管理員可指定修改其他使用者
 *     responses:
 *       200:
 *         description: 更新成功，或 qty=0 時刪除成功
 *       400:
 *         description: 欄位錯誤（qty < 0）或權限不足
 *       404:
 *         description: 該使用者購物車中不存在此商品
 *       500:
 *         description: 伺服器錯誤
 */
router.patch('/', checkLogin(false), authorizeOwnerOrAdmin({ source: 'body', key: 'targetUserId' }), async (req, res) => {
    const userId = req.effectiveUserId;
    const { productId, qty } = req.body;

    // 欄位檢查
    if (typeof productId !== 'number' || typeof qty !== 'number') {
        return res.status(400).json({ error: '請提供 productId 與數字型別 qty' });
    }

    // 數量驗證
    if (qty < 0) {
        return res.status(400).json({ error: 'qty 不能小於 0' });
    }

    try {
        const conn = await pool.getConnection();

        // 確認該使用者的購物車中有此商品
        const [rows] = await conn.query(
            'SELECT qty FROM cart WHERE userId = ? AND productId = ?',
            [userId, productId]
        );
        if (rows.length === 0) {
            conn.release();
            return res.status(404).json({ error: '購物車中不存在此商品' });
        }

        if (qty === 0) {
            // qty=0 當作刪除
            await conn.query(
                'DELETE FROM cart WHERE userId = ? AND productId = ?',
                [userId, productId]
            );
            conn.release();
            return res.json({ message: '商品已從購物車移除' });
        }

        // qty > 0 更新數量
        await conn.query(
            'UPDATE cart SET qty = ? WHERE userId = ? AND productId = ?',
            [qty, userId, productId]
        );
        conn.release();
        res.json({ message: '購物車數量已更新' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// 刪除購物車項目
/**
 * @openapi
 * /cart/{productId}:
 *   delete:
 *     summary: 刪除購物車指定商品
 *     description: 管理員可刪除任何使用者的購物車商品；一般使用者僅能刪除自己的。
 *     tags: [Cart]
 *     security:
 *       - groupHeader: []
 *     parameters:
 *       - in: path
 *         name: productId
 *         schema:
 *           type: integer
 *         required: true
 *         description: 要刪除的商品 ID
 *       - in: query
 *         name: targetUserId
 *         schema:
 *           type: integer
 *         description: 僅管理員可指定刪除其他人購物車
 *     responses:
 *       200:
 *         description: 刪除成功
 *       400:
 *         description: 權限不足
 *       404:
 *         description: 購物車中不存在此商品
 *       500:
 *         description: 伺服器錯誤
 */
router.delete('/:productId', checkLogin(false), authorizeOwnerOrAdmin({ source: 'query', key: 'targetUserId' }), async (req, res) => {
    const userId = req.effectiveUserId;
    const productId = Number(req.params.productId);

    try {
        const conn = await pool.getConnection();

        // 確認存在
        const [rows] = await conn.query(
            'SELECT id FROM cart WHERE userId = ? AND productId = ?',
            [userId, productId]
        );
        if (rows.length === 0) {
            conn.release();
            return res.status(404).json({ error: '購物車中不存在此商品' });
        }

        await conn.query(
            'DELETE FROM cart WHERE userId = ? AND productId = ?',
            [userId, productId]
        );
        conn.release();
        res.json({ message: '商品已從購物車刪除' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// 建立訂單並清空購物車
/**
 * @openapi
 * /cart/orders:
 *   post:
 *     summary: 結帳並建立訂單
 *     description: |
 *       使用者或管理員按下結帳後，必須在 body 中提供 userId 以指明目標購物車，同時
 *       驗證該 userId 與目前登入使用者是否相符。成功後自動清空該購物車。
 *     tags: [Cart]
 *     security:
 *       - groupHeader: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - userId
 *               - consignee
 *               - tel
 *               - address
 *             properties:
 *               userId:
 *                 type: integer
 *                 description: 購物車所屬使用者 ID，必須與當前登入者相同
 *               consignee:
 *                 type: string
 *                 description: 收件人姓名
 *               tel:
 *                 type: string
 *                 description: 收件人電話
 *               address:
 *                 type: string
 *                 description: 收件地址
 *     responses:
 *       201:
 *         description: 訂單建立成功，並已清空購物車
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: "訂單建立成功"
 *                 orderNumber:
 *                   type: string
 *                   example: "8450291736"
 *       400:
 *         description: 欄位不完整、購物車為空或 userId 無效
 *       403:
 *         description: 操作使用者與目標 userId 不一致
 *       500:
 *         description: 伺服器錯誤
 */
router.post('/orders', checkLogin(false), authorizeOwnerOrAdmin({ source: 'body', key: 'userId' }), async (req, res) => {
  // 從 middleware 拿到實際登入者 ID
    const userId = req.effectiveUserId;
    const { consignee, tel, address } = req.body;

    if (!consignee || !tel || !address) {
        return res.status(400).json({ error: '請提供 consignee、tel、address' });
    }

    let conn;
    try {
        conn = await pool.getConnection();
        await conn.beginTransaction();

        // 取出該 userId 的購物車所有項目
        const [cartItems] = await conn.query(
            `SELECT 
                c.productId, p.title AS productName, p.salePrice, c.qty
            FROM cart c
            JOIN products p ON c.productId = p.id
            WHERE c.userId = ?`,
            [userId]
        );
        if (cartItems.length === 0) {
            await conn.rollback();
            return res.status(400).json({ error: '購物車為空，無法結帳' });
        }

        // 隨機生成 10 位訂單編號
        let orderNumber = '';
        for (let i = 0; i < 10; i++) {
            orderNumber += Math.floor(Math.random() * 10);
        }
        const status = '已付款';

        // 插入訂單主檔
        await conn.query(
            `INSERT INTO orderCustomers
                (orderNumber, checkTime, userId, consignee, tel, address, status)
            VALUES (?, NOW(), ?, ?, ?, ?, ?)`,
            [orderNumber, userId, consignee, tel, address, status]
        );

        // 插入每筆訂單明細
        for (const item of cartItems) {
        await conn.query(
            `INSERT INTO orderInfor
            (orderNumber, productId, productName, salePrice, qty)
            VALUES (?, ?, ?, ?, ?)`,
            [orderNumber, item.productId, item.productName, item.salePrice, item.qty]
        );
        }

        // 清空購物車
        await conn.query(`DELETE FROM cart WHERE userId = ?`, [userId]);

        await conn.commit();
        res.status(201).json({ message: '訂單建立成功', orderNumber });
    } catch (err) {
        if (conn) {
            await conn.rollback();
        }
        res.status(500).json({ error: err.message });
    } finally {
        if (conn) {
            conn.release();
        }
    }
});

module.exports = router;
