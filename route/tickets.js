const express = require('express');
const pool = require('../db');
const {checkLogin} = require('../middlewares/authMiddleware');

const router = express.Router();

// 訂購票券
/**
 * @openapi
 * /tickets/orders:
 *   post:
 *     summary: 訂購票券
 *     description: 會員可透過此 API 訂購票券
 *     tags: [Tickets]
 *     security:
 *       - groupHeader: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - ticketId
 *               - selectedDate
 *               - qty
 *             properties:
 *               ticketId:
 *                 type: integer
 *                 example: 1
 *               selectedDate:
 *                 type: string
 *                 format: date
 *                 example: "2025-08-01"
 *               qty:
 *                 type: integer
 *                 example: 2
 *     responses:
 *       201:
 *         description: 訂購成功
 *       400:
 *         description: 缺少必要欄位
 *       500:
 *         description: 伺服器錯誤
 */
router.post('/tickets/orders', checkLogin, async (req, res) => {
    const { ticketId, selectedDate, qty } = req.body;
    const userId = req.userId;

    if (!ticketId || !selectedDate || !qty) {
        return res.status(400).json({ error: '請提供票種ID、選擇日期與數量' });
    }

    try {
        const conn = await pool.getConnection();
        await conn.query(
            'INSERT INTO ticketsOrders (ticketNumber, selectedData, checkTime, userId, ticketId, qty) VALUES (?, ?, NOW(), ?, ?, ?)',
            [Math.floor(Math.random() * 1000000), selectedDate, userId, ticketId, qty]
        );
        conn.release();

        res.status(201).json({ message: '票券訂購成功' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

module.exports = router;
