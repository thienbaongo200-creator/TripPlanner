const pool = require('../config/database');

const ReviewModel = {
    async getTourReviews(tourId, limit = 30) {
        const result = await pool.query(
            `SELECT r.id, r.rating, r.comment, r.created_at,
                    COALESCE(u.full_name, u.username, 'Khách hàng') AS reviewer_name
             FROM reviews r JOIN users u ON u.id = r.user_id
             WHERE r.tour_id = $1
             ORDER BY r.created_at DESC, r.id DESC LIMIT $2`,
            [tourId, limit]
        );
        return result.rows;
    },

    async getTourSummary(tourId) {
        const result = await pool.query(
            `SELECT COALESCE(ROUND(AVG(rating)::numeric, 1), 0)::numeric AS average_rating,
                    COUNT(rating)::int AS review_count FROM reviews WHERE tour_id = $1`,
            [tourId]
        );
        return result.rows[0];
    },

    async canUserReview(tourId, userId) {
        const result = await pool.query(
            `SELECT EXISTS (SELECT 1 FROM bookings
             WHERE tour_id = $1 AND user_id = $2 AND booking_date < CURRENT_DATE
               AND status = 'Đã duyệt') AS eligible`,
            [tourId, userId]
        );
        return result.rows[0].eligible;
    },

    async getUserReview(tourId, userId) {
        const result = await pool.query(
            `SELECT id, rating, comment FROM reviews WHERE tour_id = $1 AND user_id = $2
             ORDER BY created_at DESC, id DESC LIMIT 1`,
            [tourId, userId]
        );
        return result.rows[0] || null;
    },

    async saveReview({ tourId, userId, rating, comment }) {
        const client = await pool.connect();
        try {
            await client.query('BEGIN');
            const tour = await client.query('SELECT id FROM tours WHERE id = $1 FOR UPDATE', [tourId]);
            if (!tour.rowCount) throw new Error('TOUR_NOT_FOUND');

            const eligibility = await client.query(
                `SELECT EXISTS (SELECT 1 FROM bookings
                 WHERE tour_id = $1 AND user_id = $2 AND booking_date < CURRENT_DATE
                   AND status = 'Đã duyệt') AS eligible`,
                [tourId, userId]
            );
            if (!eligibility.rows[0].eligible) throw new Error('REVIEW_NOT_ELIGIBLE');

            const existing = await client.query(
                `SELECT id FROM reviews WHERE tour_id = $1 AND user_id = $2
                 ORDER BY created_at DESC, id DESC LIMIT 1`,
                [tourId, userId]
            );
            if (existing.rowCount) {
                await client.query(
                    'UPDATE reviews SET rating = $1, comment = $2, created_at = CURRENT_TIMESTAMP WHERE id = $3',
                    [rating, comment, existing.rows[0].id]
                );
            } else {
                await client.query(
                    'INSERT INTO reviews (tour_id, user_id, rating, comment) VALUES ($1, $2, $3, $4)',
                    [tourId, userId, rating, comment]
                );
            }
            await client.query('COMMIT');
        } catch (error) {
            await client.query('ROLLBACK');
            throw error;
        } finally {
            client.release();
        }
    }
};

module.exports = ReviewModel;
