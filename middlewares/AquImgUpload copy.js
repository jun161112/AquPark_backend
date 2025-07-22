/*
此程式碼是為了儲存圖片而存在的。
功能:
 - 將檔案重新命名。
 - 存至指定位置 'C:/Users/work/Desktop/AquPark/img/uploads'
   原先是直接存在Docker內資料夾 '/var/lib/mysql/uploads'
   ，但系統只抓的到本機端。
 - 文章跟商品的存取位置不一樣，引用時要記得將兩個不同的資料區分開。
*/

const multer = require('multer');
const path = require('path');
const fs = require('fs');

// 自動亂數檔名（6位英文+數字）
function generateFileName(ext) {
    const random = Math.random().toString(36).substring(2, 8); // 6碼
    return `img_${random}${ext}`;
}

// 儲存位置_文章
const uploadDir = 'C:/Users/work/Desktop/AquPark/img/uploads';

// 確保資料夾存在（避免第一次跑就錯）
if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir, { recursive: true });
}

// multer 設定
const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        cb(null, uploadDir);
    },
    filename: function (req, file, cb) {
        const ext = path.extname(file.originalname);
        cb(null, generateFileName(ext));
    }
});

const upload = multer({ storage });

// 儲存位置_商品_另一種寫法(功能完全一樣)
const productUploadDir = 'C:/Users/work/Desktop/AquPark/img/uploads/products';
if (!fs.existsSync(productUploadDir)) fs.mkdirSync(productUploadDir, { recursive: true });

const productStorage = multer.diskStorage({
    destination: (req, file, cb) => cb(null, productUploadDir),
    filename: (req, file, cb) => cb(null, generateFileName(path.extname(file.originalname)))
});
const productUpload = multer({ storage: productStorage });

module.exports = {
    upload,
    productUpload
};