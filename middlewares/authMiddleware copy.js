// 檢測是否登入
const checkLogin = (req, res, next) => {
    const userId = req.headers['x-group']; // 檢查是否有userId

    if (!userId){
        return res.status(401).json({ error: '請登入後操作，謝謝。'});
    }
    if (userId !== '1') { // 確認登入的是否為管理員
        return res.status(403).json({ error: '您沒有權限訪問此資源。' }); // 非1，返回拒絕訪問
    }

    req.userId = userId; // 有登入且是管理員身分，設置到 req 供後續使用
    next();
};

module.exports = checkLogin;