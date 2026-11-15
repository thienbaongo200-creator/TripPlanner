const pool = require('../config/database');

const BookingModel = {
    async createBooking(tourId, customerId, customerName, phone, email, guests, totalPrice, bookingDate) {
        const query = `
            INSERT INTO bookings (tour_id, user_id, customer_name, phone, email, number_of_guests, total_price, booking_date)
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING *;
        `;
        const values = [tourId, customerId || null, customerName, phone, email, guests, totalPrice, bookingDate];
        const result = await pool.query(query, values);
        return result.rows[0];
    },

    async getAllBookings() {
        const query = `
            SELECT b.*, t.title AS tour_title 
            FROM bookings b
            JOIN tours t ON b.tour_id = t.id
            ORDER BY b.id DESC;
        `;
        const result = await pool.query(query);
        return result.rows;
    },

    async updateBookingStatus(id, status) {
        const query = `UPDATE bookings SET status = $1 WHERE id = $2 RETURNING *;`;
        const result = await pool.query(query, [status, id]);
        return result.rows[0];
    },

    async getBookingsByUserId(userId) {
        const query = `
            SELECT b.*, t.title AS tour_title, t.image_url
            FROM bookings b
            JOIN tours t ON b.tour_id = t.id
            WHERE b.user_id = $1
            ORDER BY b.id DESC;
        `;
        const result = await pool.query(query, [userId]);
        return result.rows;
    }
};

module.exports = BookingModel;
