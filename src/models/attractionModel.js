const pool = require('../config/database');

const AttractionModel = {
    async getAttractionsByCity(city) {
        const query = `SELECT * FROM attractions WHERE city = $1 ORDER BY id;`;
        const result = await pool.query(query, [city]);
        return result.rows;
    }
};

module.exports = AttractionModel;
