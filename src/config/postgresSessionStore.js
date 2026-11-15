const session = require('express-session');
const pool = require('./database');

const DEFAULT_TTL_MS = 24 * 60 * 60 * 1000;

class PostgresSessionStore extends session.Store {
    constructor() {
        super();
        this.ready = pool.query(`
            CREATE TABLE IF NOT EXISTS user_sessions (
                sid VARCHAR(255) PRIMARY KEY,
                sess JSONB NOT NULL,
                expire TIMESTAMPTZ NOT NULL
            )
        `).then(() => pool.query(
            'CREATE INDEX IF NOT EXISTS user_sessions_expire_idx ON user_sessions(expire)'
        ));
        this.cleanupTimer = setInterval(() => {
            pool.query('DELETE FROM user_sessions WHERE expire <= NOW()').catch(error => {
                console.error('Không thể dọn session hết hạn:', error.message);
            });
        }, 60 * 60 * 1000);
        this.cleanupTimer.unref?.();
    }

    expiry(sessionData) {
        const cookieExpiry = sessionData?.cookie?.expires;
        const expiry = cookieExpiry ? new Date(cookieExpiry) : new Date(Date.now() + DEFAULT_TTL_MS);
        return Number.isNaN(expiry.getTime()) ? new Date(Date.now() + DEFAULT_TTL_MS) : expiry;
    }

    get(sid, callback) {
        this.ready.then(async () => {
            const result = await pool.query(
                'SELECT sess FROM user_sessions WHERE sid = $1 AND expire > NOW()', [sid]
            );
            callback(null, result.rows[0]?.sess || null);
        }).catch(callback);
    }

    set(sid, sessionData, callback = () => {}) {
        this.ready.then(() => pool.query(
            `INSERT INTO user_sessions (sid, sess, expire) VALUES ($1, $2::jsonb, $3)
             ON CONFLICT (sid) DO UPDATE SET sess = EXCLUDED.sess, expire = EXCLUDED.expire`,
            [sid, JSON.stringify(sessionData), this.expiry(sessionData)]
        )).then(() => callback(null)).catch(callback);
    }

    touch(sid, sessionData, callback = () => {}) {
        this.ready.then(() => pool.query(
            'UPDATE user_sessions SET expire = $1 WHERE sid = $2',
            [this.expiry(sessionData), sid]
        )).then(() => callback(null)).catch(callback);
    }

    destroy(sid, callback = () => {}) {
        this.ready.then(() => pool.query('DELETE FROM user_sessions WHERE sid = $1', [sid]))
            .then(() => callback(null)).catch(callback);
    }
}

module.exports = PostgresSessionStore;
