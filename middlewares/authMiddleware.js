/*
此程式碼是為了判斷用戶是否登入，並確認是否有管理員資格(可關閉)
*/
/**
 * 檢查使用者是否已登入，並（可選）檢查管理員
 * @param {boolean} requireAdmin
 */
function checkLogin(requireAdmin = false) {
  return async (req, res, next) => {
    const userId = req.headers['x-group'];
    if (!userId) {
      return res.status(401).json({ error: '請先登入後操作' });
    }
    try {
      const conn = await pool.getConnection();
      const [rows] = await conn.query(
        'SELECT admin FROM users WHERE id = ?',
        [userId]
      );
      conn.release();
      if (rows.length === 0) {
        return res.status(404).json({ error: '用戶不存在' });
      }

      const isAdmin = rows[0].admin === 1;
      if (requireAdmin && !isAdmin) {
        return res.status(403).json({ error: '您沒有管理員權限' });
      }

      req.userId = Number(userId);
      req.isAdmin = isAdmin;
      next();
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  };
}

module.exports = { checkLogin };