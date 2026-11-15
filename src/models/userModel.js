const pool = require('../config/database');
const bcrypt = require('bcryptjs');

const UserModel = {
    async findAdminByUsername(username) {
        const query = `SELECT * FROM users WHERE username = $1 AND role = 'admin';`;
        const result = await pool.query(query, [username]);
        return result.rows[0];
    },

    // Đăng ký tài khoản khách hàng mới
    async createUser(username, email, password, fullName, phone) {
        const hashedPassword = await bcrypt.hash(password, 10);
        const query = `
            INSERT INTO users (username, email, password, full_name, phone, role)
            VALUES ($1, $2, $3, $4, $5, 'customer')
            RETURNING id, username, email, full_name, role;
        `;
        const values = [username, email, hashedPassword, fullName, phone];
        const result = await pool.query(query, values);
        return result.rows[0];
    },

    // Tìm user theo username
    async findByUsername(username) {
        const query = `SELECT * FROM users WHERE username = $1;`;
        const result = await pool.query(query, [username]);
        return result.rows[0];
    },

    async findByEmail(email) {
        const result = await pool.query('SELECT id FROM users WHERE email = $1', [email]);
        return result.rows[0] || null;
    },

    // Kiểm tra mật khẩu
    async verifyPassword(inputPassword, storedPassword, userId) {
        if (/^\$2[aby]\$/.test(storedPassword)) {
            return bcrypt.compare(inputPassword, storedPassword);
        }

        // Upgrade accounts created by the original plaintext demo seed on first login.
        if (inputPassword === storedPassword && userId) {
            const upgradedHash = await bcrypt.hash(inputPassword, 10);
            await pool.query(
                'UPDATE users SET password = $1 WHERE id = $2 AND password = $3',
                [upgradedHash, userId, storedPassword]
            );
            return true;
        }
        return false;
    }
};

module.exports = UserModel;
