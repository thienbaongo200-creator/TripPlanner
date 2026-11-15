const UserModel = require('../models/userModel');

function regenerateUserSession(req, user, res, next, redirectTo) {
    req.session.regenerate(error => {
        if (error) return next(error);
        req.session.userId = user.id;
        req.session.username = user.username;
        req.session.role = user.role;
        req.session.fullName = user.full_name;
        req.session.save(saveError => {
            if (saveError) return next(saveError);
            return res.redirect(redirectTo);
        });
    });
}

const AuthController = {
    getLogin(req, res) {
        res.render('auth/login', { error: null });
    },

    async postLogin(req, res, next) {
        try {
            const username = String(req.body.username || '').trim();
            const password = typeof req.body.password === 'string' ? req.body.password : '';
            if (!username || username.length > 50 || !password || password.length > 200) {
                return res.status(400).render('auth/login', { error: 'Vui lòng nhập tên đăng nhập và mật khẩu hợp lệ.' });
            }

            const user = await UserModel.findByUsername(username);
            if (!user || !(await UserModel.verifyPassword(password, user.password, user.id))) {
                return res.status(401).render('auth/login', { error: 'Tên đăng nhập hoặc mật khẩu không đúng!' });
            }
            req.clearAuthAttempts?.();
            return regenerateUserSession(req, user, res, next, user.role === 'admin' ? '/admin/dashboard' : '/');
        } catch (error) {
            return next(error);
        }
    },

    getRegister(req, res) {
        res.render('auth/register', { error: null });
    },

    async postRegister(req, res, next) {
        const username = String(req.body.username || '').trim();
        const email = String(req.body.email || '').trim().toLowerCase();
        const fullName = String(req.body.full_name || '').trim();
        const phone = String(req.body.phone || '').trim();
        const password = typeof req.body.password === 'string' ? req.body.password : '';
        const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

        if (!/^[a-zA-Z0-9_.-]{3,50}$/.test(username)
            || !emailPattern.test(email) || email.length > 100
            || !fullName || fullName.length > 100
            || phone.length > 20 || (phone && !/^[0-9+()\-\s]+$/.test(phone))
            || password.length < 8 || password.length > 200) {
            return res.status(400).render('auth/register', {
                error: 'Thông tin chưa hợp lệ. Tên đăng nhập 3–50 ký tự; mật khẩu tối thiểu 8 ký tự.'
            });
        }

        try {
            if (await UserModel.findByUsername(username)) {
                return res.status(409).render('auth/register', { error: 'Tên đăng nhập đã tồn tại!' });
            }
            if (await UserModel.findByEmail(email)) {
                return res.status(409).render('auth/register', { error: 'Email đã được sử dụng!' });
            }
            await UserModel.createUser(username, email, password, fullName, phone || null);
            return res.redirect('/login?success=true');
        } catch (error) {
            if (error.code === '23505') {
                return res.status(409).render('auth/register', { error: 'Tên đăng nhập hoặc email đã được sử dụng.' });
            }
            return next(error);
        }
    },

    logout(req, res, next) {
        req.session.destroy(error => {
            if (error) return next(error);
            res.clearCookie('travelsmart.sid', {
                path: '/',
                httpOnly: true,
                secure: process.env.NODE_ENV === 'production',
                sameSite: 'lax'
            });
            return res.redirect('/login');
        });
    }
};

module.exports = AuthController;
