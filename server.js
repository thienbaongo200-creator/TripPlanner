const express = require('express');
const session = require('express-session');
const path = require('path');
const crypto = require('crypto');
require('dotenv').config();

const mainRoutes = require('./src/routes/mainRoutes');
const adminRoutes = require('./src/routes/adminRoutes');
const PostgresSessionStore = require('./src/config/postgresSessionStore');
const AuthMiddleware = require('./src/middlewares/authMiddleware');
const pool = require('./src/config/database');

const app = express();
const PORT = process.env.PORT || 3000;
const isProduction = process.env.NODE_ENV === 'production';
if (isProduction && (!process.env.SESSION_SECRET || process.env.SESSION_SECRET.length < 32)) {
    throw new Error('Production requires SESSION_SECRET with at least 32 characters.');
}
if (process.env.TRUST_PROXY === '1') app.set('trust proxy', 1);
app.disable('x-powered-by');

// Cấu hình View Engine EJS
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'src/views'));

// Middleware cơ bản
app.use(express.urlencoded({ extended: true, limit: '50kb' }));
app.use(express.json({ limit: '50kb' }));
app.use(express.static(path.join(__dirname, 'src/public')));

// Cấu hình Session
app.use(session({
    name: 'travelsmart.sid',
    secret: process.env.SESSION_SECRET || crypto.randomBytes(32).toString('hex'),
    store: new PostgresSessionStore(),
    resave: false,
    saveUninitialized: false,
    rolling: true,
    cookie: {
        httpOnly: true,
        secure: isProduction,
        sameSite: 'lax',
        maxAge: 2 * 60 * 60 * 1000
    }
}));

app.use(AuthMiddleware.sameOrigin);

// Middleware truyền dữ liệu session ra view (Đặt sau cấu hình session và trước các Routes)
app.use((req, res, next) => {
    res.locals.user = req.session.userId ? {
        id: req.session.userId,
        username: req.session.username,
        role: req.session.role,
        fullName: req.session.fullName
    } : null;
    next();
});

// Đăng ký Routes
app.use('/', mainRoutes);
app.use('/admin', adminRoutes);

app.use((req, res, next) => {
    const error = new Error('Not Found');
    error.status = 404;
    next(error);
});

app.use((error, req, res, next) => {
    if (res.headersSent) return next(error);
    let status = Number(error.statusCode || error.status) || 500;
    if (error.code === 'LIMIT_FILE_SIZE' || error.name === 'MulterError') status = 400;
    if (status < 400 || status > 599) status = 500;
    if (status >= 500) {
        console.error('Request failed:', req.method, req.originalUrl, error);
    }
    const message = status === 404
        ? 'Không tìm thấy trang.'
        : status === 400
            ? 'Dữ liệu gửi lên không hợp lệ hoặc tệp vượt quá giới hạn.'
            : status === 403
                ? 'Bạn không có quyền thực hiện yêu cầu này.'
                : 'Hệ thống đang gặp sự cố. Vui lòng thử lại sau.';
    return res.status(status).send(message);
});

// Khởi động Server
const server = app.listen(PORT, () => {
    console.log(`🚀 Server đang chạy tại: http://localhost:${PORT}`);
});

for (const signal of ['SIGINT', 'SIGTERM']) {
    process.on(signal, () => {
        server.close(() => pool.end().finally(() => process.exit(0)));
    });
}
