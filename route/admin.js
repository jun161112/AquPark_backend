const express = require('express');

const { upload, productUpload } = require('../middlewares/AquImgUpload');
const {checkLogin} = require('../middlewares/authMiddleware');
const handleMulterErrors = require('../middlewares/handleMulterErrors');
const pool = require('../db');

const router = express.Router();

// 新增文章(含圖)
/** 
 * @openapi
 * /admin/articles:
 *   post:
 *     summary: 新增文章
 *     description: 需有管理員權限才可新增文章
 *     tags: [Admin - 文章管理]
 *     security:
 *       - groupHeader: []
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             required:
 *               - kind
 *               - title
 *             properties:
 *               kind:
 *                 type: string
 *                 description: 文章類別
 *                 example: "test"
 *               title:
 *                 type: string
 *                 description: 文章標題
 *                 example: "測試文章標題"
 *               content:
 *                 type: string
 *                 description: 文章內容
 *                 example: "測試文章內文"
 *               startDate:
 *                 type: string
 *                 format: date
 *                 description: 活動開始日期
 *                 example: "2025-04-01"
 *               endDate:
 *                 type: string
 *                 format: date
 *                 description: 活動結束日期
 *                 example: "2025-04-02"
 *               image:
 *                 type: string
 *                 format: binary
 *                 description: 上傳圖片檔案
 *     responses:
 *       201:
 *         description: 新增成功，回傳訊息與圖片路徑
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: "文章新增成功"
 *                 imageFilename:
 *                   type: string
 *                   example: "/uploads/summer-event.jpg"
 *       500:
 *         description: 伺服器錯誤，新增文章失敗
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 error:
 *                   type: string
 *                   example: "資料庫連線失敗"
*/
router.post('/articles', checkLogin(true), 
    handleMulterErrors(upload.single('image')),  
    async (req, res) => {
        const { kind, title, content, startDate, endDate } = req.body;
        const imageFilename = req.file ? `/uploads/${req.file.filename}` : null;

        try {
            const conn = await pool.getConnection();
            await conn.query(
                'INSERT INTO articles (kind, title, content, startData, endData, imgurl, editTime, createdAt) VALUES (?, ?, ?, ?, ?, ?, NOW(), NOW())',
                [kind, title, content, startDate, endDate, imageFilename]
            );
            conn.release();

            res.status(201).json({ message: '文章新增成功', imageFilename });
        } catch (err) {
            res.status(500).json({ error: err.message });
        }
    }
);

// 修改文章(含圖)
/**
 * @openapi
 * /admin/articles/{id}:
 *   patch:
 *     summary: 修改文章
 *     description: 修改指定 ID 的文章內容與圖片（可選）。
 *     tags: [Admin - 文章管理]
 *     security:
 *       - groupHeader: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: 文章 ID
 *     requestBody:
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             properties:
 *               kind:
 *                 type: string
 *               title:
 *                 type: string
 *               content:
 *                 type: string
 *               startDate:
 *                 type: string
 *                 format: date
 *               endDate:
 *                 type: string
 *                 format: date
 *               image:
 *                 type: string
 *                 format: binary
 *     responses:
 *       200:
 *         description: 文章已更新
 *       400:
 *         description: 無更新欄位
 *       500:
 *         description: 伺服器錯誤
 */
router.patch('/articles/:id', 
    checkLogin(true), 
    upload.single('image'), 
    async (req, res) => {
        const { id } = req.params;
        const { kind, title, content, startDate, endDate } = req.body;
        const imgurl = req.file ? `/uploads/${req.file.filename}` : null;

        try {
            const conn = await pool.getConnection();

            // 動態構建 SQL 更新欄位
            const fieldsToUpdate = [];
            const values = [];

            if (kind) {
                fieldsToUpdate.push('kind = ?');
                values.push(kind);
            }
            if (title) {
                fieldsToUpdate.push('title = ?');
                values.push(title);
            }
            if (content) {
                fieldsToUpdate.push('content = ?');
                values.push(content);
            }
            if (startDate) {
                fieldsToUpdate.push('startData = ?');
                values.push(startDate);
            }
            if (endDate) {
                fieldsToUpdate.push('endData = ?');
                values.push(endDate);
            }
            if (imgurl) {
                fieldsToUpdate.push('imgurl = ?');
                values.push(imgurl);
            }

            if (fieldsToUpdate.length === 0) {
                conn.release();
                return res.status(400).json({ error: '沒有需要更新的欄位' });
            }

            fieldsToUpdate.push('editTime = NOW()'); // 確保更新時間更新
            const sql = `UPDATE articles SET ${fieldsToUpdate.join(', ')} WHERE id = ?`;
            values.push(id);

            await conn.query(sql, values);
            conn.release();

            res.json({ message: '文章已更新' });
        } catch (err) {
            res.status(500).json({ error: err.message });
        }
    }
);

// 刪除文章
/**
 * @openapi
 * /admin/articles/{id}:
 *   delete:
 *     summary: 刪除文章
 *     description: 管理員可刪除指定 ID 的文章。
 *     tags: [Admin - 文章管理]
 *     security:
 *       - groupHeader: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: 要刪除的文章 ID
 *     responses:
 *       200:
 *         description: 成功刪除文章
 *       500:
 *         description: 伺服器錯誤
 */
router.delete('/articles/:id', checkLogin(true), async (req, res) => {
    const { id } = req.params;

    try {
        const conn = await pool.getConnection();
        await conn.query('DELETE FROM articles WHERE id = ?', [id]);
        conn.release();

        res.json({ message: '文章已刪除' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// 取得文章列表
/**
 * @openapi
 * /admin/articles:
 *   get:
 *     summary: 取得文章列表
 *     description: 取得所有文章列表，可指定分頁筆數與頁碼。
 *     tags: [Admin - 文章管理]
 *     parameters:
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           default: 1
 *         description: 頁碼（從 1 開始）
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 5
 *         description: 每頁顯示筆數，預設5筆，可自由輸入整數。
 *     responses:
 *       200:
 *         description: 成功取得文章列表
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 total:
 *                   type: integer
 *                   example: 56
 *                 page:
 *                   type: integer
 *                   example: 1
 *                 limit:
 *                   type: integer
 *                   example: 10
 *                 articles:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       id:
 *                         type: integer
 *                       title:
 *                         type: string
 *                       kind:
 *                         type: string
 *                       content:
 *                         type: string
 *                       startData:
 *                         type: string
 *                         format: date
 *                       endData:
 *                         type: string
 *                         format: date
 *                       imgurl:
 *                         type: string
 *                       editTime:
 *                         type: string
 *                         format: date-time
 *                       createdAt:
 *                         type: string
 *                         format: date-time
 *       500:
 *         description: 伺服器錯誤
 */
router.get('/articles', async (req, res) => {
    const page = Math.max(parseInt(req.query.page, 10) || 1, 1);
    const limit = Math.max(parseInt(req.query.limit, 10) || 5, 1);
    const offset = (page - 1) * limit;
    let conn;

    try {
        conn = await pool.getConnection();
        const [totalRows] = await conn.query('SELECT COUNT(*) AS total FROM articles');
        const [articles] = await conn.query(
            'SELECT * FROM articles ORDER BY createdAt ASC LIMIT ? OFFSET ?',
            [limit, offset]
        );

        res.json({
            total: totalRows[0].total,
            page,
            limit,
            articles
        });
    } catch (err) {
        res.status(500).json({ error: err.message });
    } finally {
    if (conn) conn.release();
  }
});

// 查詢文章
/**
 * @openapi
 * /admin/articles/{id}:
 *   get:
 *     summary: 查詢文章
 *     description: 管理員可查詢指定 ID 的文章詳細資料。
 *     tags: [Admin - 文章管理]
 *     security:
 *       - groupHeader: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: 文章 ID
 *     responses:
 *       200:
 *         description: 成功取得文章
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 id:
 *                   type: integer
 *                 title:
 *                   type: string
 *                 kind:
 *                   type: string
 *                 content:
 *                   type: string
 *                 startData:
 *                   type: string
 *                   format: date
 *                 endData:
 *                   type: string
 *                   format: date
 *                 imgurl:
 *                   type: string
 *                 editTime:
 *                   type: string
 *                   format: date-time
 *                 createdAt:
 *                   type: string
 *                   format: date-time
 *       404:
 *         description: 找不到指定文章
 *       500:
 *         description: 伺服器錯誤
 */
router.get('/articles/:id', checkLogin(true), async (req, res) => {
    const { id } = req.params;

    try {
        const conn = await pool.getConnection();
        const [rows] = await conn.query('SELECT * FROM articles WHERE id = ?', [id]);
        conn.release();

        if (rows.length === 0) {
            return res.status(404).json({ error: '文章不存在' });
        }

        res.json(rows[0]);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});


// 新增商品
/**
 * @openapi
 * /admin/products:
 *   post:
 *     summary: 新增商品
 *     description: 管理員新增商品，可包含圖片。
 *     tags: [Admin - 商品管理]
 *     security:
 *       - groupHeader: []
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             required:
 *               - itemGroup
 *               - title
 *               - content
 *               - price
 *               - salePrice
 *               - sell
 *             properties:
 *               itemGroup:
 *                 type: string
 *               title:
 *                 type: string
 *               content:
 *                 type: string
 *               price:
 *                 type: number
 *               salePrice:
 *                 type: number
 *               sell:
 *                 type: integer
 *                 enum: [0, 1]
 *                 example: 1
 *                 description: "是否上架（1=上架, 0=下架）"
 *               image:
 *                 type: string
 *                 format: binary
 *     responses:
 *       201:
 *         description: 商品新增成功
 *       500:
 *         description: 新增失敗
 */
router.post('/products', checkLogin(true), productUpload.single('image'), async (req, res) => {
    const { itemGroup, title, content, price, salePrice, sell } = req.body;
    const imgFilename = req.file ? `/uploads/products/${req.file.filename}` : null;

    try {
        const conn = await pool.getConnection();
        await conn.query(
            'INSERT INTO products (itemGroup, title, content, price, salePrice, imgUrls, sell, editTime, createdAt) VALUES (?, ?, ?, ?, ?, ?, ?, NOW(), NOW())',
            [itemGroup, title, content, price, salePrice, imgFilename, sell]
        );
        conn.release();

        res.status(201).json({ message: '產品新增成功', imgFilename });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// 修改商品
/**
 * @openapi
 * /admin/products/{id}:
 *   patch:
 *     summary: 修改商品資訊
 *     description: 可選擇更新任意欄位與圖片（圖片限制：圖檔，最大5MB）
 *     tags: [Admin - 商品管理]
 *     security:
 *       - groupHeader: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: 商品 ID
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             properties:
 *               itemGroup:
 *                 type: string
 *                 example: "紀念品"
 *               title:
 *                 type: string
 *                 example: "可愛海豹玩偶"
 *               content:
 *                 type: string
 *                 example: "超柔軟材質，限量發售"
 *               price:
 *                 type: number
 *                 example: 599
 *               salePrice:
 *                 type: number
 *                 example: 499
 *               sell:
 *                 type: integer
 *                 enum: [0, 1]
 *                 example: 1
 *                 description: "是否上架（1=上架, 0=下架）"
 *               image:
 *                 type: string
 *                 format: binary
 *                 description: 商品圖片（jpg/png/webp/gif/svg，最大5MB）
 *     responses:
 *       200:
 *         description: 商品已更新
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: "產品已更新"
 *                 imgFilename:
 *                   type: string
 *                   example: "/uploads/products/img_12efgh.png"
 *       400:
 *         description: 沒有需要更新的欄位
 *       413:
 *         description: 圖片檔案過大（超過5MB）
 *       415:
 *         description: 上傳非圖片檔案
 *       500:
 *         description: 伺服器錯誤
 */
router.patch('/products/:id', 
    checkLogin(true), 
    handleMulterErrors(productUpload.single('image')), 
    async (req, res) => {
        const { id } = req.params;
        const { itemGroup, title, content, price, salePrice, sell } = req.body;
        const imgFilename = req.file ? `/uploads/products/${req.file.filename}` : null;

        try {
            const conn = await pool.getConnection();
            const fieldsToUpdate = [];
            const values = [];

            if (itemGroup) fieldsToUpdate.push('itemGroup = ?'), values.push(itemGroup);
            if (title) fieldsToUpdate.push('title = ?'), values.push(title);
            if (content) fieldsToUpdate.push('content = ?'), values.push(content);
            if (price) fieldsToUpdate.push('price = ?'), values.push(price);
            if (salePrice) fieldsToUpdate.push('salePrice = ?'), values.push(salePrice);
            if (sell) fieldsToUpdate.push('sell = ?'), values.push(sell);
            if (imgFilename) fieldsToUpdate.push('imgUrls = ?'), values.push(imgFilename);

            if (fieldsToUpdate.length === 0) {
                conn.release();
                return res.status(400).json({ error: '沒有需要更新的欄位' });
            }

            fieldsToUpdate.push('editTime = NOW()');
            const sql = `UPDATE products SET ${fieldsToUpdate.join(', ')} WHERE id = ?`;
            values.push(id);

            await conn.query(sql, values);
            conn.release();

            res.json({ message: '產品已更新', imgFilename });
        } catch (err) {
            res.status(500).json({ error: err.message });
        }
    }
);

// 刪除商品
/**
 * @openapi
 * /admin/products/{id}:
 *   delete:
 *     summary: 刪除商品
 *     description: 管理員可刪除指定 ID 的商品。
 *     tags: [Admin - 商品管理]
 *     security:
 *       - groupHeader: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: 要刪除的商品 ID
 *     responses:
 *       200:
 *         description: 成功刪除商品
 *       500:
 *         description: 伺服器錯誤
 */
router.delete('/products/:id', checkLogin(true), async (req, res) => {
    const { id } = req.params;

    try {
        const conn = await pool.getConnection();
        await conn.query('DELETE FROM products WHERE id = ?', [id]);
        conn.release();

        res.json({ message: '產品已刪除' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// 顯示所有商品
/**
 * @openapi
 * /admin/products:
 *   get:
 *     summary: 查詢商品列表
 *     description: 管理員可依條件查詢商品列表，支援分頁、分類過濾、模糊搜尋、販售狀態與排序方式。
 *     tags: [Admin - 商品管理]
 *     security:
 *       - groupHeader: []
 *     parameters:
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           default: 1
 *         description: 頁碼（從 1 開始）
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           enum: [5, 10, 20]
 *           default: 10
 *         description: 每頁顯示筆數（5、10 或 20）
 *       - in: query
 *         name: itemGroup
 *         schema:
 *           type: string
 *         description: 商品分類（itemGroup），若未指定則顯示全部
 *       - in: query
 *         name: search
 *         schema:
 *           type: string
 *         description: 模糊搜尋商品標題與內容
 *       - in: query
 *         name: sell
 *         schema:
 *           type: string
 *           enum: [true, false]
 *         description: 是否販售中（true：上架中，false：下架）
 *       - in: query
 *         name: sortPrice
 *         schema:
 *           type: string
 *           enum: [asc, desc]
 *         description: 價格排序方式（asc：低到高，desc：高到低）
 *       - in: query
 *         name: sortById
 *         schema:
 *           type: string
 *           enum: [true, false]
 *           default: true
 *         description: 是否依商品編號排序（預設 true）
 *     responses:
 *       200:
 *         description: 成功取得商品列表
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 total:
 *                   type: integer
 *                   example: 42
 *                 page:
 *                   type: integer
 *                   example: 1
 *                 limit:
 *                   type: integer
 *                   example: 10
 *                 products:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       id:
 *                         type: integer
 *                       itemGroup:
 *                         type: string
 *                       title:
 *                         type: string
 *                       content:
 *                         type: string
 *                       price:
 *                         type: number
 *                       salePrice:
 *                         type: number
 *                       imgUrls:
 *                         type: string
 *                       sell:
 *                         type: boolean
 *                       editTime:
 *                         type: string
 *                         format: date-time
 *                       createdAt:
 *                         type: string
 *                         format: date-time
 *       500:
 *         description: 伺服器錯誤
 */
router.get('/products', checkLogin(true), async (req, res) => {
  const {
    itemGroup,
    search,
    sell,
    sortPrice,
    sortById = 'true',
    page = 1,
    limit = 10
  } = req.query;

  const offset = (Math.max(1, parseInt(page)) - 1) * parseInt(limit);
  const filters = [];
  const params = [];

  // 分類過濾
  if (itemGroup) {
    filters.push('itemGroup = ?');
    params.push(itemGroup);
  }

  // 模糊搜尋
  if (search) {
    filters.push('(title LIKE ? OR content LIKE ?)');
    const keyword = `%${search}%`;
    params.push(keyword, keyword);
  }

  // 是否販售中
  if (sell === 'true') filters.push('sell = 1');
  if (sell === 'false') filters.push('sell = 0');

  const whereClause = filters.length ? `WHERE ${filters.join(' AND ')}` : '';

  // 排序邏輯
  let orderClause = 'ORDER BY id ASC'; // 預設使用商品編號排序

  if (sortPrice === 'asc') {
    orderClause = 'ORDER BY price ASC';
  } else if (sortPrice === 'desc') {
    orderClause = 'ORDER BY price DESC';
  } else if (sortById === 'false') {
    orderClause = ''; // 若不想依編號排序
  }

  try {
    const conn = await pool.getConnection();

    // 取得總筆數
    const [countRows] = await conn.query(
      `SELECT COUNT(*) AS total FROM products ${whereClause}`,
      params
    );

    // 取得資料內容
    const [products] = await conn.query(
      `SELECT * FROM products ${whereClause} ${orderClause} LIMIT ? OFFSET ?`,
      [...params, parseInt(limit), offset]
    );

    conn.release();

    res.json({
      total: countRows[0].total,
      page: parseInt(page),
      limit: parseInt(limit),
      products
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 查詢商品
/**
 * @openapi
 * /admin/products/search:
 *   get:
 *     summary: 商品查詢（精準 + 模糊）
 *     description: 管理員可依條件查詢商品，固定一次顯示 5 筆，支援精準搜尋與模糊搜尋。
 *     tags: [Admin - 商品管理]
 *     security:
 *       - groupHeader: []
 *     parameters:
 *       - in: query
 *         name: id
 *         schema:
 *           type: integer
 *         description: 精準搜尋 - 商品 ID
 *       - in: query
 *         name: itemGroup
 *         schema:
 *           type: string
 *         description: 精準搜尋 - 商品分類
 *       - in: query
 *         name: keyword
 *         schema:
 *           type: string
 *         description: 模糊搜尋關鍵字（會比對標題與內容）
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           default: 1
 *         description: 頁碼（從 1 開始）
 *     responses:
 *       200:
 *         description: 查詢成功
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 total:
 *                   type: integer
 *                   example: 12
 *                 page:
 *                   type: integer
 *                   example: 1
 *                 limit:
 *                   type: integer
 *                   example: 5
 *                 products:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       id:
 *                         type: integer
 *                       itemGroup:
 *                         type: string
 *                       title:
 *                         type: string
 *                       content:
 *                         type: string
 *                       price:
 *                         type: number
 *                       salePrice:
 *                         type: number
 *                       imgUrls:
 *                         type: string
 *                       sell:
 *                         type: boolean
 *                       editTime:
 *                         type: string
 *                         format: date-time
 *                       createdAt:
 *                         type: string
 *                         format: date-time
 *       500:
 *         description: 伺服器錯誤
 */
router.get('/products/search', checkLogin(true), async (req, res) => {
  const { id, itemGroup, keyword, page = 1 } = req.query;
  const limit = 5;
  const offset = (Math.max(1, parseInt(page)) - 1) * limit;

  const filters = [];
  const params = [];

  // 精準搜尋條件
  if (id) {
    filters.push('id = ?');
    params.push(id);
  }
  if (itemGroup) {
    filters.push('itemGroup = ?');
    params.push(itemGroup);
  }

  // 模糊搜尋條件
  if (keyword) {
    filters.push('(title LIKE ? OR content LIKE ?)');
    const kw = `%${keyword}%`;
    params.push(kw, kw);
  }

  const whereClause = filters.length ? `WHERE ${filters.join(' OR ')}` : '';

  try {
    const conn = await pool.getConnection();

    // 總筆數
    const [countRows] = await conn.query(
      `SELECT COUNT(*) AS total FROM products ${whereClause}`,
      params
    );

    // 查詢資料
    const [products] = await conn.query(
      `SELECT * FROM products ${whereClause} ORDER BY id ASC LIMIT ? OFFSET ?`,
      [...params, limit, offset]
    );

    conn.release();

    res.json({
      total: countRows[0].total,
      page: parseInt(page),
      limit,
      products
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});


// 新增訂單 < 測試用(也可直接上機)
/**
 * @openapi
 * /admin/orders:
 *   post:
 *     summary: 新增訂單（測試用）
 *     description: 新增訂單資料與商品細項。僅管理員可操作。
 *     tags: [Admin - 訂單管理]
 *     security:
 *       - groupHeader: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - orderNumber
 *               - userId
 *               - consignee
 *               - tel
 *               - address
 *               - status
 *               - products
 *             properties:
 *               orderNumber:
 *                 type: string
 *                 example: "AQ20250620001"
 *               userId:
 *                 type: integer
 *                 example: 3
 *               consignee:
 *                 type: string
 *                 example: "王小明"
 *               tel:
 *                 type: string
 *                 example: "0912345678"
 *               address:
 *                 type: string
 *                 example: "台北市信義區101號"
 *               status:
 *                 type: string
 *                 example: "已付款"
 *               products:
 *                 type: array
 *                 items:
 *                   type: object
 *                   required:
 *                     - productId
 *                     - productName
 *                     - salePrice
 *                     - qty
 *                   properties:
 *                     productId:
 *                       type: integer
 *                       example: 101
 *                     productName:
 *                       type: string
 *                       example: "鯊魚玩偶"
 *                     salePrice:
 *                       type: number
 *                       example: 499
 *                     qty:
 *                       type: integer
 *                       example: 2
 *     responses:
 *       201:
 *         description: 訂單新增成功
 *       500:
 *         description: 伺服器錯誤
 */
router.post('/orders', checkLogin(true), async (req, res) => {
    const { orderNumber, userId, consignee, tel, address, status, products } = req.body;

    try {
        const conn = await pool.getConnection();

        // 新增訂單基本資料到 orderCustomers 表
        await conn.query(
            `INSERT INTO orderCustomers (orderNumber, checkTime, userId, consignee, tel, address, status) 
             VALUES (?, NOW(), ?, ?, ?, ?, ?)`,
            [orderNumber, userId, consignee, tel, address, status]
        );

        // 新增商品明細到 orderInfor 表
        for (const product of products) {
            const { productId, productName, salePrice, qty } = product;
            await conn.query(
                `INSERT INTO orderInfor (orderNumber, productId, productName, salePrice, qty) 
                 VALUES (?, ?, ?, ?, ?)`,
                [orderNumber, productId, productName, salePrice, qty]
            );
        }

        conn.release();
        res.status(201).json({ message: '訂單新增成功' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// 查看訂單資訊(單筆)
/**
 * @openapi
 * /admin/orders/{orderNumber}:
 *   get:
 *     summary: 查看訂單資訊（單筆）
 *     description: 
 *       - 根據訂單編號查詢收件人與商品明細
 *       - 一般會員只能查看自己的訂單  
 *       - 管理員可查看所有訂單
 *     tags: [Admin - 訂單管理]
 *     security:
 *       - groupHeader: []
 *     parameters:
 *       - in: path
 *         name: orderNumber
 *         required: true
 *         schema:
 *           type: string
 *         description: 訂單編號
 *     responses:
 *       200:
 *         description: 成功回傳訂單資訊
 *       403:
 *         description: 權限不足
 *       404:
 *         description: 找不到該訂單
 *       500:
 *         description: 伺服器錯誤
 */
router.get('/orders/:orderNumber', checkLogin(false), async (req, res) => {
    const { orderNumber } = req.params;
    const currentUserId = req.userId;
    const isAdmin = req.isAdmin;
    let conn;

    try {
        const conn = await pool.getConnection();

        // 1. 查訂單擁有者
        const [ownerRows] = await conn.query(
            'SELECT userId FROM orderCustomers WHERE orderNumber = ?',
            [orderNumber]
        );
        if (ownerRows.length === 0) {
            return res.status(404).json({ error: '找不到該訂單' });
        }

        // 2. 權限檢查
        const ownerId = ownerRows[0].userId;
        if (!isAdmin && ownerId !== currentUserId) {
            return res.status(403).json({ error: '權限不足' });
        }

        // 3. 取得訂單明細
        const [rows] = await conn.query(`
            SELECT 
                oc.orderNumber,
                oc.consignee AS recipientName,
                oc.tel AS recipientPhone,
                oc.address AS recipientAddress,
                oi.productName,
                oi.salePrice,
                oi.qty,
                (oi.salePrice * oi.qty) AS productSubtotal
            FROM orderCustomers AS oc
            JOIN orderInfor AS oi ON oc.orderNumber = oi.orderNumber
            WHERE oc.orderNumber = ?
        `, [orderNumber]);

        if (rows.length === 0) {
            return res.status(404).json({ error: '找不到該訂單' });
        }

        // 4. 聚合回傳單一訂單的資料
        const order = {
            orderNumber: rows[0].orderNumber,
            recipientName: rows[0].recipientName,
            recipientPhone: rows[0].recipientPhone,
            recipientAddress: rows[0].recipientAddress,
            items: [],
            totalAmount: 0
        };

        rows.forEach(row => {
            order.items.push({
                productName: row.productName,
                salePrice: row.salePrice,
                qty: row.qty,
                productSubtotal: row.productSubtotal
            });
            order.totalAmount += row.productSubtotal;
        });

        res.json(order);
    } catch (err) {
        res.status(500).json({ error: err.message });
    } finally {
        if (conn) conn.release();
    }
});

// 修改訂單狀態
/**
 * @openapi
 * /admin/orders/{orderNumber}:
 *   patch:
 *     summary: 修改訂單狀態
 *     description: 根據訂單編號更新狀態（例如：已付款、已出貨、已取消）。
 *     tags: [Admin - 訂單管理]
 *     security:
 *       - groupHeader: []
 *     parameters:
 *       - in: path
 *         name: orderNumber
 *         required: true
 *         schema:
 *           type: string
 *         description: 訂單編號
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - status
 *             properties:
 *               status:
 *                 type: string
 *                 example: "已出貨"
 *     responses:
 *       200:
 *         description: 訂單狀態已更新
 *       400:
 *         description: 未提供狀態
 *       404:
 *         description: 找不到該訂單
 *       500:
 *         description: 伺服器錯誤
 */
router.patch('/orders/:orderNumber', checkLogin(true), async (req, res) => {
    const { orderNumber } = req.params;
    const { status } = req.body; // 狀態：已付款、已出貨、已取消

    try {
        const conn = await pool.getConnection();

        if (!status) {
            conn.release();
            return res.status(400).json({ error: '必須提供訂單狀態' });
        }

        const [result] = await conn.query(
            `UPDATE orderCustomers SET status = ?, checkTime = NOW() WHERE orderNumber = ?`,
            [status, orderNumber]
        );
        conn.release();

        if (result.affectedRows === 0) {
            return res.status(404).json({ error: '找不到該訂單，請確認訂單編號是否正確' });
        }

        res.json({ message: '訂單狀態已更新' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

module.exports = router;
