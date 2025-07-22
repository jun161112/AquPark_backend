const multer = require('multer');

/**
 * 包裝 multer 的錯誤處理中介函式。
 * @param {*} uploadMiddleware - multer 的 single 或 array 等中介函式
 * @returns 包裝後可安全處理錯誤的中介函式
 */
function handleMulterErrors(uploadMiddleware) {
    return (req, res, next) => {
        uploadMiddleware(req, res, (err) => {
            if (err instanceof multer.MulterError) {
                // 處理上傳限制（如檔案大小）
                return res.status(413).json({ error: '圖片大小超過限制 (5MB)' });
            } else if (err) {
                // 非預期錯誤（如檔案格式錯誤）
                return res.status(415).json({ error: err.message || '圖片格式錯誤' });
            }
            next();
        });
    };
}

module.exports = handleMulterErrors;