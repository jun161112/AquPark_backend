require('dotenv').config();
const express = require('express');
const cors = require('cors');
const pool = require('./db');

// API & Swagger
const usersRouter = require('./route/users');
const adminRouter = require('./route/admin');
const ticketsRouter = require('./route/tickets');
const cartRouter = require('./route/cart');
const checkLogin = require('./middlewares/authMiddleware');
const swaggerUi = require("swagger-ui-express");
const swaggerSpec = require("./swagger");


const app = express();
app.use(express.json());
app.use(cors());


// 全商品資訊(測試用)
/**
 * @openapi
 * /products:
 *   get:
 *     summary: 取得所有商品
 *     description: 獲取所有商品的詳細資訊。
 *     tags:
 *       - Test - 測試用
 *     responses:
 *       200:
 *         description: 成功取得商品資訊
 */
app.get('/products', async(req, res) => {
    try {
        const conn = await pool.getConnection();
        const [rows] = await conn.query('SELECT id, itemGroup, title, content, price, salePrice, imgUrls, sell, editTime, createdAt FROM products');
        conn.release();
        res.json(rows);
    } catch (err){
        res.status(500).json({ error: err.message });
    }
});

// 全園區消息(測試用)
/**
 * @openapi
 * /articles:
 *   get:
 *     summary: 取得所有文章
 *     description: 獲取所有文章的詳細資訊。(測試上鎖)
 *     tags:
 *       - Test - 測試用
 *     security:
 *       - groupHeader: []
 *     responses:
 *       200:
 *         description: 成功取得文章資訊
 */
app.get('/articles', checkLogin(true), async (req, res) => {
    try {
        const conn = await pool.getConnection();
        const [rows] = await conn.query('SELECT id, kind, title, content, startData, endData, imgurl, createdAt FROM articles');
        conn.release();
        res.json(rows);
    } catch (err){
        res.status(500).json({ error: err.message });
    }
});


// 載入其他功能模組
app.use('/users', usersRouter); // 會員功能_登入、註冊、改資料
app.use('/admin', adminRouter); // 管理員功能_文章&商品(增改刪)、訂單(增查改)
app.use('/tickets', ticketsRouter);  // 票券訂購
app.use('/cart', cartRouter);  // 購物車功能
app.use('/uploads', express.static('C:/Users/work/Desktop/AquPark/img/uploads')); // 圖片讀取功能

// 使用 Swagger UI
app.use("/api", swaggerUi.serve, swaggerUi.setup(swaggerSpec));

// 啟動伺服器
const PORT = process.env.PORT || 3000;
app.listen(PORT, '0.0.0.0', () => {
    console.log(`伺服器運行於 PORT:${PORT}`);
});
