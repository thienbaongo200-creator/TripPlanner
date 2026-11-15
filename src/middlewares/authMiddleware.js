const loginAttempts = new Map();

function authRateLimit(req, res, next) {
    const key = `${req.path}:${req.ip}`;
    const now = Date.now();
    const windowMs = 15 * 60 * 1000;
    const maxAttempts = 10;
    let attempt = loginAttempts.get(key);
    if (!attempt || attempt.resetAt <= now) {
        attempt = { count: 0, resetAt: now + windowMs };
        loginAttempts.set(key, attempt);
    }
    if (attempt.count >= maxAttempts) {
        res.set('Retry-After', String(Math.ceil((attempt.resetAt - now) / 1000)));
        return res.status(429).send('Quá nhiều yêu cầu đăng nhập. Vui lòng thử lại sau ít phút.');
    }
    attempt.count += 1;
    req.clearAuthAttempts = () => loginAttempts.delete(key);
    if (loginAttempts.size > 5000) {
        for (const [attemptKey, value] of loginAttempts) {
            if (value.resetAt <= now) loginAttempts.delete(attemptKey);
        }
    }
    return next();
}

const AuthMiddleware = {
    authRateLimit,

    sameOrigin(req, res, next) {
        if (!['POST', 'PUT', 'PATCH', 'DELETE'].includes(req.method)) return next();
        const origin = req.get('origin');
        const referer = req.get('referer');
        const source = origin || referer;
        if (!source) return next();
        try {
            if (new URL(source).host !== req.get('host')) {
                return res.status(403).send('Yêu cầu không hợp lệ.');
            }
            return next();
        } catch {
            return res.status(403).send('Yêu cầu không hợp lệ.');
        }
    },

    isLoggedIn(req, res, next) {
        if (req.session?.userId) return next();
        return res.redirect('/login');
    },

    isAdmin(req, res, next) {
        if (req.session?.userId && req.session.role === 'admin') return next();
        if (!req.session?.userId) return res.redirect('/admin/login');
        return res.status(403).send('Bạn không có quyền truy cập khu vực quản trị.');
    }
};

module.exports = AuthMiddleware;
