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

// 取得文章列表(顯示文章)
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

// 列出單筆文章
/**
 * @openapi
 * /admin/articles/{id}:
 *   get:
 *     summary: 列出單筆文章(暫時廢棄不用)
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

// 顯示所有商品/查詢商品
/**
 * @openapi
 * /admin/products:
 *   get:
 *     summary: 顯示所有商品/查詢商品
 *     description: |
 *       - 依條件查詢商品列表，支援分頁、分類過濾、模糊搜尋、販售狀態與排序方式。
 *       - 未輸入任何資訊則顯示所有商品。
 *     tags: [Admin - 商品管理]
 *     parameters:
 *       - in: query
 *         name: id
 *         schema:
 *           type: integer
 *         description: 商品 ID，提供時回傳單筆商品
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
 *           default: 10
 *           maximum: 100
 *         description: 每頁顯示筆數。使用者可自訂，必須為正整數；若超過上限 100 則以 100 處理；若未提供則以 10 為預設（僅在未提供 id 時使用）
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
 *               oneOf:
 *                 - type: object
 *                   properties:
 *                     id:
 *                       type: integer
 *                     itemGroup:
 *                       type: string
 *                     title:
 *                       type: string
 *                     content:
 *                       type: string
 *                     price:
 *                       type: number
 *                     salePrice:
 *                       type: number
 *                     imgUrls:
 *                       type: string
 *                     sell:
 *                       type: boolean
 *                     editTime:
 *                       type: string
 *                       format: date-time
 *                     createdAt:
 *                       type: string
 *                       format: date-time
 *                 - type: object
 *                   properties:
 *                     total:
 *                       type: integer
 *                       example: 42
 *                     page:
 *                       type: integer
 *                       example: 1
 *                     limit:
 *                       type: integer
 *                       example: 10
 *                     products:
 *                       type: array
 *                       items:
 *                         type: object
 *                         properties:
 *                           id:
 *                             type: integer
 *                           itemGroup:
 *                             type: string
 *                           title:
 *                             type: string
 *                           content:
 *                             type: string
 *                           price:
 *                             type: number
 *                           salePrice:
 *                             type: number
 *                           imgUrls:
 *                             type: string
 *                           sell:
 *                             type: boolean
 *                           editTime:
 *                             type: string
 *                             format: date-time
 *                           createdAt:
 *                             type: string
 *                             format: date-time
 *       404:
 *         description: 找不到指定的商品（當使用 id 查詢且無結果時）
 *       500:
 *         description: 伺服器錯誤
 */
router.get('/products', async (req, res) => {
  const {
    id,
    itemGroup,
    search,
    sell,
    sortPrice,
    sortById = 'true',
    page = 1,
    limit
  } = req.query;

  let conn;
  try {
    conn = await pool.getConnection();

    if (id){
      const [rows] = await conn.query(
        `SELECT
           id,
           itemGroup,
           title,
           content,
           price,
           salePrice,
           CAST(imgUrls AS CHAR) AS imgUrls,
           sell,
           DATE_FORMAT(editTime, '%Y-%m-%d %H:%i:%s') AS editTime,
           DATE_FORMAT(createdAt, '%Y-%m-%d %H:%i:%s') AS createdAt
         FROM products
         WHERE id = ?
         LIMIT 1`,
        [id]
      );

      if (!rows || rows.length === 0) {
        return res.status(404).json({ error: '找不到該商品' });
      }

      return res.json(rows[0]);
    }

    const pageNum = Math.max(1, parseInt(page, 10) || 1);

    const DEFAULT_LIMIT = 10;
    const MAX_LIMIT = 100;

    let perPage;
    if (limit === undefined || limit === null || limit === '') {
      perPage = DEFAULT_LIMIT;
    } else {
      const parsed = parseInt(limit, 10);
      if (Number.isNaN(parsed) || parsed <= 0) {
        return res.status(400).json({ error: 'limit 必須為正整數' });
      }
      perPage = Math.min(parsed, MAX_LIMIT);
    }

    const offset = (pageNum - 1) * perPage;
  
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

    // 排序
    let orderClause = 'ORDER BY id ASC'; // 預設使用商品編號排序

    if (sortPrice === 'asc') {
      orderClause = 'ORDER BY price ASC';
    } else if (sortPrice === 'desc') {
      orderClause = 'ORDER BY price DESC';
    } else if (sortById === 'false') {
      orderClause = ''; // 若不想依編號排序
    }

    // 取得總筆數
    const [countRows] = await conn.query(
      `SELECT COUNT(*) AS total FROM products ${whereClause}`,
      params
    );
    const total = countRows[0] ? countRows[0].total : 0;

    // 取得資料內容
    const [products] = await conn.query(
      `SELECT
         id,
         itemGroup,
         title,
         content,
         price,
         salePrice,
         CAST(imgUrls AS CHAR) AS imgUrls,
         sell,
         DATE_FORMAT(editTime, '%Y-%m-%d %H:%i:%s') AS editTime,
         DATE_FORMAT(createdAt, '%Y-%m-%d %H:%i:%s') AS createdAt
       FROM products
       ${whereClause}
       ${orderClause}
       LIMIT ? OFFSET ?`,
      [...params, perPage, offset]
    );

    res.json({
      total,
      page: pageNum,
      limit: perPage,
      products
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  } finally {
    if (conn) conn.release();
  }
});


// 新增訂單
/**
 * @openapi
 * /admin/orders:
 *   post:
 *     summary: 新增訂單
 *     description: |
 *       新增訂單資料與商品細項，僅管理員可操作。  
 *       訂單編號自動產生，不須手動輸入。  
 *       一般用戶要新增請使用 [Cart - 購物車] /cart/orders
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
 *               - userId
 *               - consignee
 *               - tel
 *               - address
 *               - status
 *               - products
 *             properties:
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
 *         description: 訂單新增成功，並回傳訂單內容
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: "訂單新增成功"
 *                 order:
 *                   type: object
 *                   properties:
 *                     orderNumber:
 *                       type: string
 *                       example: "123456789"
 *                     userId:
 *                       type: integer
 *                       example: 3
 *                     consignee:
 *                       type: string
 *                       example: "王小明"
 *                     tel:
 *                       type: string
 *                       example: "0912345678"
 *                     address:
 *                       type: string
 *                       example: "台北市信義區101號"
 *                     status:
 *                       type: string
 *                       example: "已付款"
 *                     products:
 *                       type: array
 *                       items:
 *                         type: object
 *                         properties:
 *                           productId:
 *                             type: integer
 *                             example: 101
 *                           productName:
 *                             type: string
 *                             example: "鯊魚玩偶"
 *                           salePrice:
 *                             type: number
 *                             example: 499
 *                           qty:
 *                             type: integer
 *                             example: 2
 *                           imgUrls:
 *                             type: string
 *                             example: "/uploads/products/img_5g6wrd.png"
 *       500:
 *         description: 伺服器錯誤
 */
router.post('/orders', checkLogin(true), async (req, res) => {
  const { userId, consignee, tel, address, status, products } = req.body;

  // 自動生成 9 碼訂單編號
  let orderNumber = '';
  for (let i = 0; i < 9; i++) {
      orderNumber += Math.floor(Math.random() * 10);
  }

  let conn;
  try {
    conn = await pool.getConnection();
    await conn.beginTransaction();

    // 新增訂單基本資料到 orderCustomers 表
    await conn.query(
      `INSERT INTO orderCustomers (orderNumber, checkTime, userId, consignee, tel, address, status) 
        VALUES (?, NOW(), ?, ?, ?, ?, ?)`,
      [orderNumber, userId, consignee, tel, address, status]
    );

    // 抓取圖片路徑
    const productIds = products.map(p => p.productId);
    const [images] = await conn.query(
      `SELECT id AS productId, imgUrls 
         FROM products 
         WHERE id IN (?)`,
      [productIds]
    );

    // 建立商品與網址的對應，只存字串
    const imgMap = {};
    images.forEach(row => {
      imgMap[row.productId] = row.imgUrls;
    });

    // 新增商品明細到 orderInfor 表
    const insertedProducts = [];
    for (const item of products) {
      const { productId, productName, salePrice, qty } = item;
      const raw = imgMap[productId];

      let imgUrlsToStore = '';
      // 如果 raw 是物件或陣列，就 stringify；若是字串直接存；若 undefined 則存空字串
      if (typeof raw === 'object') {
        imgUrlsToStore = JSON.stringify(raw);
      } else if (typeof raw === 'string') {
        imgUrlsToStore = raw;
      }
      
      await conn.query(
        `INSERT INTO orderInfor (orderNumber, productId, productName, salePrice, qty, imgUrls) 
          VALUES (?, ?, ?, ?, ?, ?)`,
        [orderNumber, productId, productName, salePrice, qty, imgUrlsToStore]
      );

      insertedProducts.push({
        productId,
        productName,
        salePrice,
        qty,
        imgUrls: imgUrlsToStore
      });
    }

    await conn.commit();
    
    res.status(201).json({
      message: '訂單新增成功',
      order: {
        orderNumber,
        userId,
        consignee,
        tel,
        address,
        status,
        products: insertedProducts
      }
    });
  } catch (err) {
    if (conn) await conn.rollback();
    res.status(500).json({ error: err.message });
  } finally {
    if (conn) conn.release();
  }
});

// 查看訂單資訊(單獨用戶所有訂單)
/**
 * @openapi
 * /admin/orders:
 *   get:
 *     summary: 查看使用者所有訂單
 *     description: |
 *       - 一般會員只會看到自己的所有訂單  
 *       - 管理員可透過 query.userId 指定要查看的使用者  
 *     tags: [Admin - 訂單管理]
 *     security:
 *       - groupHeader: []
 *     parameters:
 *       - in: query
 *         name: userId
 *         schema:
 *           type: integer
 *         description: 管理員可指定要查詢的使用者 ID；一般會員此參數無效
 *     responses:
 *       200:
 *         description: 成功回傳訂單列表
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 type: object
 *                 properties:
 *                   orderNumber:
 *                     type: string
 *                     example: "123456789"
 *                   checkTime:
 *                     type: string
 *                     format: date-time
 *                   consignee:
 *                     type: string
 *                     example: "王小明"
 *                   tel:
 *                     type: string
 *                     example: "0912345678"
 *                   address:
 *                     type: string
 *                     example: "台北市信義區101號"
 *                   status:
 *                     type: string
 *                     example: "已付款"
 *                   items:
 *                     type: array
 *                     items:
 *                       type: object
 *                       properties:
 *                         productName:
 *                           type: string
 *                           example: "鯊魚玩偶"
 *                         salePrice:
 *                           type: number
 *                           example: 499
 *                         qty:
 *                           type: integer
 *                           example: 2
 *                         productSubtotal:
 *                           type: number
 *                           example: 998
 *                         imgUrls:
 *                           type: string
 *                           description: "圖片網址"
 *                           example: "/uploads/products/img_5g6wrd.png"
 *                   totalAmount:
 *                     type: number
 *                     example: 998
 *       403:
 *         description: 權限不足
 *       404:
 *         description: 該使用者無任何訂單
 *       500:
 *         description: 伺服器錯誤
 */
router.get('/orders', checkLogin(false), async (req, res) => {
  const currentUserId = req.userId;
  const isAdmin       = req.isAdmin;
  const queryUserId   = Number(req.query.userId);

  // 管理員可指定 userId，一般會員強制是自己的
  const targetUserId  = isAdmin && queryUserId ? queryUserId : currentUserId;
  let conn;

  try {
    conn = await pool.getConnection();

    // 撈取所有訂單與其明細，SQL 先按 checkTime DESC 排序
    const [rows] = await conn.query(
      `SELECT
         oc.orderNumber,
         DATE_FORMAT(oc.checkTime, '%Y-%m-%d %H:%i:%s') AS checkTime,
         oc.consignee,
         oc.tel,
         oc.address,
         oc.status,
         oi.productName,
         oi.salePrice,
         oi.qty,
         (oi.salePrice * oi.qty) AS productSubtotal,
         oi.imgUrls
       FROM orderCustomers AS oc
       JOIN orderInfor    AS oi
         ON oc.orderNumber = oi.orderNumber
       WHERE oc.userId = ?
       ORDER BY oc.checkTime DESC`,
      [targetUserId]
    );

    if (rows.length === 0) {
      return res.status(404).json({ error: '該使用者無任何訂單' });
    }

    // 聚合同一張訂單的 items
    const ordersMap = {};
    rows.forEach(r => {
      if (!ordersMap[r.orderNumber]) {
        ordersMap[r.orderNumber] = {
          orderNumber:  r.orderNumber,
          checkTime:    r.checkTime,
          consignee:    r.consignee,
          tel:          r.tel,
          address:      r.address,
          status:       r.status,
          items:        [],
          totalAmount:  0
        };
      }
      const ord = ordersMap[r.orderNumber];
      ord.items.push({
        productName:     r.productName,
        salePrice:       r.salePrice,
        qty:             r.qty,
        productSubtotal: r.productSubtotal,
        imgUrls:         r.imgUrls || ''   
      });
      ord.totalAmount += r.productSubtotal;
    });

    // 轉成陣列，並再次用 JS 按時間排序
    const orders = Object.values(ordersMap)
      .sort((a, b) => new Date(b.checkTime) - new Date(a.checkTime));

    res.json(orders);

  } catch (err) {
    res.status(500).json({ error: err.message });
  } finally {
    if (conn) conn.release();
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
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 orderNumber:
 *                   type: string
 *                 recipientName:
 *                   type: string
 *                 recipientPhone:
 *                   type: string
 *                 recipientAddress:
 *                   type: string
 *                 items:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       productName:
 *                         type: string
 *                       salePrice:
 *                         type: number
 *                       qty:
 *                         type: integer
 *                       productSubtotal:
 *                         type: number
 *                       imgUrls:
 *                         type: string
 *                         description: "圖片網址"
 *                 totalAmount:
 *                   type: number
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
    conn = await pool.getConnection();

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
        (oi.salePrice * oi.qty) AS productSubtotal,
        oi.imgUrls
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
        productSubtotal: row.productSubtotal,
        imgUrls: row.imgUrls || ''
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
