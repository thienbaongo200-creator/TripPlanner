const AttractionModel = require('../models/attractionModel');

const CITY_NAMES = {
    'Ho Chi Minh': 'TP. Hồ Chí Minh',
    'Da Nang': 'Đà Nẵng – Hội An',
    'Ha Noi': 'Hà Nội'
};

const normalize = value => String(value || '')
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();

function location(attraction, fallbackName, fallbackAddress) {
    return {
        name: attraction?.name || fallbackName,
        address: attraction?.address || fallbackAddress,
        description: attraction?.description || ''
    };
}

const ItineraryService = {
    async generateSchedule(city, numDays) {
        if (!CITY_NAMES[city] || !Number.isInteger(numDays) || numDays < 1 || numDays > 3) {
            throw new Error('Thành phố hoặc số ngày không hợp lệ');
        }

        const attractions = await AttractionModel.getAttractionsByCity(city);
        const food = attractions.filter(item => normalize(item.category).includes('am thuc'));
        const visit = attractions.filter(item => !food.includes(item));
        const byTime = (time, categoryHint) => visit.filter(item =>
            normalize(item.suggested_time).includes(normalize(time)) ||
            (categoryHint && normalize(item.category).includes(normalize(categoryHint)))
        );
        const mornings = byTime('Sáng', 'di tích');
        const afternoons = byTime('Chiều', 'văn hóa');
        const evenings = byTime('Tối', 'giải trí');
        const pick = (items, index, fallback, address) => location(items[index % Math.max(items.length, 1)], fallback, address);

        const days = Array.from({ length: numDays }, (_, index) => ({
            day: index + 1,
            activities: [
                { time: '07:30–08:30', label: 'Ăn sáng', icon: 'fa-mug-hot', ...pick(food, index, 'Quán ăn sáng địa phương', `Trung tâm ${CITY_NAMES[city]}`) },
                { time: '08:30–11:30', label: 'Tham quan', icon: 'fa-landmark', ...pick(mornings.length ? mornings : visit, index, 'Tham quan và khám phá thành phố', `Trung tâm ${CITY_NAMES[city]}`) },
                { time: '12:00–13:30', label: 'Ăn trưa', icon: 'fa-utensils', ...pick(food, index + 1, 'Nhà hàng đặc sản địa phương', `Trung tâm ${CITY_NAMES[city]}`) },
                { time: '14:00–17:00', label: 'Khám phá', icon: 'fa-compass', ...pick(afternoons.length ? afternoons : visit, index + 1, 'Khám phá điểm đến nổi bật', `Trung tâm ${CITY_NAMES[city]}`) },
                { time: '18:30–21:00', label: 'Buổi tối', icon: 'fa-moon', ...pick(evenings.length ? evenings : visit, index + 2, 'Dạo phố và thưởng thức ẩm thực', `Trung tâm ${CITY_NAMES[city]}`) }
            ]
        }));

        return { cityName: CITY_NAMES[city], days };
    }
};

module.exports = ItineraryService;
