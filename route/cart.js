const express = require('express');
const pool = require('../db');
const checkLogin = require('../middlewares/authMiddleware');

const router = express.Router();

// 新增至購物車
/**
 * @openapi
 * /cart:
 *   post:
 *     summary: 加入購物車
 *     description: 將商品加入使用者的購物車中
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
 *                 example: 1
 *     responses:
 *       201:
 *         description: 加入成功
 *       400:
 *         description: 請提供必要欄位
 *       500:
 *         description: 伺服器錯誤
 */
router.post('/cart', checkLogin, async (req, res) => {
    const { productId, qty } = req.body;
    const userId = req.userId;

    if (!productId || !qty) {
        return res.status(400).json({ error: '請提供商品ID與數量' });
    }

    try {
        const conn = await pool.getConnection();
        await conn.query(
            'INSERT INTO cart (userId, productId, qty) VALUES (?, ?, ?)',
            [userId, productId, qty]
        );
        conn.release();

        res.status(201).json({ message: '已新增至購物車' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// 更新購物車
/**
 * @openapi
 * /cart/{id}:
 *   put:
 *     summary: 更新購物車數量
 *     description: 根據購物車項目 ID 更新數量
 *     tags: [Cart]
 *     security:
 *       - groupHeader: []
 *     parameters:
 *       - name: id
 *         in: path
 *         required: true
 *         schema:
 *           type: integer
 *         description: 購物車項目 ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - qty
 *             properties:
 *               qty:
 *                 type: integer
 *                 example: 2
 *     responses:
 *       200:
 *         description: 更新成功
 *       400:
 *         description: 缺少數量欄位
 *       500:
 *         description: 伺服器錯誤
 */
router.put('/cart/:id', checkLogin, async (req, res) => {
    const { id } = req.params;
    const { qty } = req.body;

    if (!qty) {
        return res.status(400).json({ error: '請提供數量' });
    }

    try {
        const conn = await pool.getConnection();
        await conn.query(
            'UPDATE cart SET qty = ? WHERE id = ?',
            [qty, id]
        );
        conn.release();

        res.json({ message: '購物車已更新' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// 刪除購物車項目
/**
 * @openapi
 * /cart/{id}:
 *   delete:
 *     summary: 刪除購物車項目
 *     description: 根據購物車項目 ID 刪除對應資料
 *     tags: [Cart]
 *     security:
 *       - groupHeader: []
 *     parameters:
 *       - name: id
 *         in: path
 *         required: true
 *         schema:
 *           type: integer
 *         description: 購物車項目 ID
 *     responses:
 *       200:
 *         description: 刪除成功
 *       500:
 *         description: 伺服器錯誤
 */
router.delete('/cart/:id', checkLogin, async (req, res) => {
    const { id } = req.params;

    try {
        const conn = await pool.getConnection();
        await conn.query(
            'DELETE FROM cart WHERE id = ?',
            [id]
        );
        conn.release();

        res.json({ message: '購物車項目已刪除' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

module.exports = router;
