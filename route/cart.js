const express = require('express');
const pool = require('../db');
const {checkLogin} = require('../middlewares/authMiddleware');
const authorizeOwnerOrAdmin = require('../middlewares/authorizeOwnerOrAdmin');

const router = express.Router();

// 取得購物車內容
/**
 * @openapi
 * /cart:
 *   get:
 *     summary: 取得購物車列表
 *     description: 僅能查看自己的購物車內容。
 *     tags: [Cart]
 *     security:
 *       - groupHeader: []
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
router.get('/', checkLogin(false), async (req, res) => {
    const userId = req.userId;

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
 *     description: 只能新增到自己的購物車。若項目已存在則累加數量。
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
 *     responses:
 *       201:
 *         description: 加入成功
 *       400:
 *         description: 欄位不完整
 *       404:
 *         description: 商品不存在或未上架
 *       500:
 *         description: 伺服器錯誤
 */
router.post('/', checkLogin(false), async (req, res) => {
  const userId = req.userId;
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

    // 檢查是否已在購物車，重覆則累加
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
 *       僅能更新自己的購物車。  
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
 *                 example: 13
 *               qty:
 *                 type: integer
 *                 example: 2
 *     responses:
 *       200:
 *         description: 更新/刪除成功
 *       400:
 *         description: 欄位錯誤或 qty < 0
 *       404:
 *         description: 購物車中不存在此商品
 *       500:
 *         description: 伺服器錯誤
 */
router.patch('/', checkLogin(false), async (req, res) => {
    const userId = req.userId;
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
 * /cart:
 *   delete:
 *     summary: 清空購物車
 *     description: 僅可清空自己的購物車，會刪除所有項目
 *     tags: [Cart]
 *     security:
 *       - groupHeader: []
 *     responses:
 *       200:
 *         description: 購物車已清空
 *       500:
 *         description: 伺服器錯誤
 */
router.delete('/', checkLogin(false), async (req, res) => {
    const userId = req.userId;
    let conn;

    try {
        conn = await pool.getConnection();
        await conn.query(
            'DELETE FROM cart WHERE userId = ?',
            [userId]
        );
        res.json({ message: '購物車已清空' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    } finally { if (conn) conn.release(); }
});

// 建立訂單並清空購物車
/**
 * @openapi
 * /cart/orders:
 *   post:
 *     summary: 結帳並建立訂單
 *     description: 僅可對自己購物車結帳，成功後自動清空該購物車。
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
 *               - consignee
 *               - tel
 *               - address
 *             properties:
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
 *                   example: "123456789"
 *       400:
 *         description: 欄位不完整或購物車為空
 *       500:
 *         description: 伺服器錯誤
 */
router.post('/orders', checkLogin(false), async (req, res) => {
  // 從 middleware 拿到實際登入者 ID
    const userId = req.userId;
    const { consignee, tel, address } = req.body;

    if (!consignee || !tel || !address) {
        return res.status(400).json({ error: '請提供 收件人姓名、電話、地址' });
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

        // 隨機生成 9 位訂單編號
        let orderNumber = '';
        for (let i = 0; i < 9; i++) {
            orderNumber += Math.floor(Math.random() * 10);
        }
        const status = '已付款';

        // 建立訂單主檔
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
        res.status(201).json({
            message: '訂單建立成功',
            order: {
                orderNumber,
                userId,
                consignee,
                tel,
                address,
                status,
                products: cartItems
            }
        });
    } catch (err) {
        if (conn) {
            await conn.rollback();
        }
        res.status(500).json({ error: err.message });
    } finally {
        if (conn) { conn.release(); }
    }
});

module.exports = router;
