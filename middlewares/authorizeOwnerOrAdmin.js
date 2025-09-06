/**
 * authorizeOwnerOrAdmin Middleware Generator
 *
 * options.source: 'body' | 'query' | 'params'
 * options.key: 欲讀取的 targetUserId 欄位名稱，預設 'targetUserId'
 */
function authorizeOwnerOrAdmin(options = {}) {
  const { source = 'body', key = 'targetUserId' } = options;

  return (req, res, next) => {
    const currentUserId = Number(req.userId);
    const isAdmin = Boolean(req.isAdmin);

    // 1. 從指定來源讀 targetUserId
    let rawTargetId;
    if (source === 'body') rawTargetId = req.body[key];
    else if (source === 'query') rawTargetId = req.query[key];
    else if (source === 'params') rawTargetId = req.params[key];

    // 2. 決定 effectiveUserId
    const targetUserId =
      rawTargetId !== undefined ? Number(rawTargetId) : currentUserId;

    // 3. 授權檢查：非管理員且操作他人則拒絕
    if (!isAdmin && targetUserId !== currentUserId) {
      return res.status(403).json({ error: '權限不足' });
    }

    // 4. 將結果掛到 req
    req.effectiveUserId = targetUserId;
    next();
  };
}

module.exports = authorizeOwnerOrAdmin;
