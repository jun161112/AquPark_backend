const swaggerJSDoc = require("swagger-jsdoc");

const options = {
  definition: {
    openapi: "3.0.0",
    info: {
      title: "AquPark 水遊館",
      version: "0.0.1",
      description: "水遊館 API 文件，部分API需驗證(x-group)\n\n[水游館前端網頁](https://karinnnya.github.io/vuefinallyhw/#/)"
    },
    servers: [
      {
        url: "http://localhost:3000/",
        description: "本地伺服器"
      }
    ],
    components: {
      securitySchemes: {
        groupHeader: {
          type: "apiKey",
          in: "header",
          name: "x-group",
          description: "請輸入會員 ID (x-group)"
        }
      }
    },
    security: [], // 全域預設無需驗證金鑰，個別 API 可以單獨上鎖
    tags: [
      {
        name: 'Test - 測試用',
        description: '測試用 API，如商品列表與文章列表'
      },
      {
        name: 'Users - 會員管理',
        description: '會員功能：登入、註冊、修改會員資料'
      },
      {
        name: 'Admin - 文章管理',
        description: '管理員操作園區文章，包括新增、修改與刪除'
      },
      {
        name: 'Admin - 商品管理',
        description: '管理員操作商品資訊，包括新增、修改與刪除'
      },
      {
        name: 'Admin - 訂單管理',
        description: '管理員查看與修改訂單狀態'
      },
      {
        name: 'Tickets',
        description: '票券訂購與相關查詢'
      },
      {
        name: 'Cart',
        description: '購物車相關操作'
      }
    ]
  },
  apis: [
    "./server.js", 
    "./route/users.js",
    "./route/admin.js",
    "./route/tickets.js",
    "./route/cart.js"
  ]
};

const swaggerSpec = swaggerJSDoc(options);
module.exports = swaggerSpec;
