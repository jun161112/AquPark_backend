// authorizeOwnerOrAdmin.js

/**
 * authorizeOwnerOrAdmin Middleware Generator
 * @param {Object} options
 * @param {'body'|'query'|'params'|'headers'|'cookies'} options.source
 * @param {string} options.key
 */
function authorizeOwnerOrAdmin({ source, key }) {
  return (req, res, next) => {
    // 1. 從指定來源取值
    let rawValue;
    switch (source) {
      case 'body':
        rawValue = req.body[key];
        break;
      case 'query':
        rawValue = req.query[key];
        break;
      case 'params':
        rawValue = req.params[key];
        break;
      case 'headers':
        rawValue = req.get(key);
        break;
      case 'cookies':
        rawValue = req.cookies[key];
        break;
      default:
        return res.status(400).json({ error: 'Invalid authorization source' });
    }

    // 2. 判定操作目標 userId
    const targetUserId = rawValue !== undefined
      ? Number(rawValue)
      : Number(req.userId);

    // 3. 權限檢查：必須是本人或管理員
    if (targetUserId !== Number(req.userId) && !req.isAdmin) {
      return res.status(403).json({ error: '權限不足' });
    }

    // 4. 將最終使用者 ID 掛在 req 上，方便後續 handler 使用
    req.effectiveUserId = targetUserId;
    next();
  };
}

module.exports = authorizeOwnerOrAdmin;

