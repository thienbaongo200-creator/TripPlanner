const pool = require('../config/database');

const withLocalImage = tour => ({
    ...tour,
    image_url: tour.image_url && tour.image_url.startsWith('/images/tours/')
        ? tour.image_url
        : '/images/tours/default-tour.svg'
});

const tourStatsQuery = `
    WITH booking_stats AS (
        SELECT tour_id, COUNT(*)::int AS booking_count
        FROM bookings
        WHERE status <> 'Đã hủy'
        GROUP BY tour_id
    ), review_stats AS (
        SELECT tour_id, ROUND(AVG(rating)::numeric, 1) AS average_rating,
               COUNT(rating)::int AS review_count
        FROM reviews
        GROUP BY tour_id
    )
    SELECT t.*, COALESCE(bs.booking_count, 0) AS booking_count,
           COALESCE(rs.average_rating, 0)::numeric AS average_rating,
           COALESCE(rs.review_count, 0) AS review_count
    FROM tours t
    LEFT JOIN booking_stats bs ON bs.tour_id = t.id
    LEFT JOIN review_stats rs ON rs.tour_id = t.id
`;

function buildTourWhere(filters = {}) {
    const clauses = [];
    const values = [];
    const add = (clause, value) => {
        values.push(value);
        clauses.push(clause.replace(/\?/g, () => `$${values.length}`));
    };

    if (filters.destination) add('t.destination = ?', filters.destination);
    if (filters.q) add("(t.title ILIKE ? OR t.destination ILIKE ?)", `%${filters.q}%`);
    if (filters.minPrice !== null && filters.minPrice !== undefined) add('t.price >= ?', filters.minPrice);
    if (filters.maxPrice !== null && filters.maxPrice !== undefined) add('t.price <= ?', filters.maxPrice);
    if (filters.days) add("substring(t.duration FROM '([0-9]+)')::int = ?", filters.days);

    return { sql: clauses.length ? `WHERE ${clauses.join(' AND ')}` : '', values };
}

const TourModel = {
    async getDestinations() {
        const result = await pool.query(
            "SELECT DISTINCT destination FROM tours WHERE destination IS NOT NULL AND destination <> '' ORDER BY destination"
        );
        return result.rows.map(row => row.destination);
    },

    async getHomeSections(requestedPage = 1, pageSize = 10, filters = {}) {
        const where = buildTourWhere(filters);
        const countResult = await pool.query(`SELECT COUNT(*)::int AS total FROM tours t ${where.sql}`, where.values);
        const totalTours = countResult.rows[0].total;
        const totalPages = Math.max(1, Math.ceil(totalTours / pageSize));
        const currentPage = Math.min(Math.max(Number.parseInt(requestedPage, 10) || 1, 1), totalPages);
        const offset = (currentPage - 1) * pageSize;

        const pageValues = [...where.values, pageSize, offset];
        const limitParameter = pageValues.length - 1;
        const offsetParameter = pageValues.length;
        const [pageResult, featuredResult] = await Promise.all([
            pool.query(`${tourStatsQuery} ${where.sql} ORDER BY t.is_featured DESC, COALESCE(bs.booking_count, 0) DESC, t.id DESC LIMIT $${limitParameter} OFFSET $${offsetParameter}`, pageValues),
            pool.query(`${tourStatsQuery} WHERE t.is_featured = true OR COALESCE(bs.booking_count, 0) > 0 ORDER BY COALESCE(bs.booking_count, 0) DESC, average_rating DESC, t.id DESC LIMIT 10`)
        ]);
        return {
            featuredTours: featuredResult.rows.map(withLocalImage),
            pageTours: pageResult.rows.map(withLocalImage),
            pagination: { currentPage, totalPages, totalTours, pageSize }
        };
    },

    async getAllTours() {
        const result = await pool.query('SELECT * FROM tours ORDER BY id DESC');
        return result.rows.map(withLocalImage);
    },

    async getTourById(id) {
        const result = await pool.query('SELECT * FROM tours WHERE id = $1', [id]);
        return result.rows[0] ? withLocalImage(result.rows[0]) : undefined;
    },

    async createTour({ title, destination, price, duration, description, isFeatured }) {
        const query = `
            INSERT INTO tours (title, destination, price, duration, description, image_url, gallery_images, is_featured)
            VALUES ($1, $2, $3, $4, $5, '/images/tours/default-tour.svg', '[]'::jsonb, $6)
            RETURNING *;
        `;
        const result = await pool.query(query, [title, destination, price, duration, description, isFeatured]);
        return result.rows[0];
    },

    async updateTour(id, tour, imageUrl, galleryImages) {
        const query = `
            UPDATE tours
            SET title = $1, destination = $2, price = $3, duration = $4,
                description = $5, is_featured = $6, image_url = $7, gallery_images = $8::jsonb
            WHERE id = $9
            RETURNING *;
        `;
        const values = [tour.title, tour.destination, tour.price, tour.duration,
            tour.description, tour.isFeatured, imageUrl, JSON.stringify(galleryImages), id];
        const result = await pool.query(query, values);
        return result.rows[0];
    },

    async updateTourImages(id, imageUrl, galleryImages) {
        const result = await pool.query(
            'UPDATE tours SET image_url = $1, gallery_images = $2::jsonb WHERE id = $3 RETURNING *',
            [imageUrl, JSON.stringify(galleryImages), id]
        );
        return result.rows[0];
    },

    async deleteTour(id) {
        const result = await pool.query('DELETE FROM tours WHERE id = $1 RETURNING id', [id]);
        return result.rows[0];
    }
};

module.exports = TourModel;
