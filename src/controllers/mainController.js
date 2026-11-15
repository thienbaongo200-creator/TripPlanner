const TourModel = require('../models/tourModel');
const BookingModel = require('../models/bookingModel');
const ReviewModel = require('../models/reviewModel');
const ItineraryService = require('../services/itineraryService');

const MainController = {
    async getHomePage(req, res) {
        try {
            const requestedPage = Number.parseInt(req.query.page, 10) || 1;
            const destinations = await TourModel.getDestinations();
            const destinationInput = String(req.query.destination || '').trim();
            const q = String(req.query.q || '').trim().slice(0, 100);
            const parsePrice = value => {
                if (value === undefined || value === '') return null;
                const parsed = Number(value);
                return Number.isFinite(parsed) && parsed >= 0 ? parsed : null;
            };
            let minPrice = parsePrice(req.query.minPrice);
            let maxPrice = parsePrice(req.query.maxPrice);
            if (minPrice !== null && maxPrice !== null && minPrice > maxPrice) {
                [minPrice, maxPrice] = [maxPrice, minPrice];
            }
            const rawDays = Number(req.query.days);
            const days = Number.isInteger(rawDays) && rawDays >= 1 && rawDays <= 30 ? rawDays : null;
            const filters = {
                q,
                destination: destinations.includes(destinationInput) ? destinationInput : '',
                minPrice,
                maxPrice,
                days
            };
            const { featuredTours, pageTours, pagination } = await TourModel.getHomeSections(requestedPage, 10, filters);
            res.render('index', { featuredTours, pageTours, pagination, destinations, filters, path: '/' });
        } catch (err) {
            console.error(err);
            res.status(500).send('Lỗi Server');
        }
    },

    async getTourDetail(req, res) {
        try {
            const tourId = req.params.id;
            const tour = await TourModel.getTourById(tourId);
            if (!tour) return res.status(404).send('Không tìm thấy tour');
            const userId = req.session?.userId;
            const [reviews, reviewSummary, userReview, canReview] = await Promise.all([
                ReviewModel.getTourReviews(tourId),
                ReviewModel.getTourSummary(tourId),
                userId ? ReviewModel.getUserReview(tourId, userId) : null,
                userId ? ReviewModel.canUserReview(tourId, userId) : false
            ]);
            res.render('tour_detail', {
                tour, reviews, reviewSummary, userReview, canReview, isLoggedIn: Boolean(userId),
                reviewSubmitted: req.query.review === 'success', path: '/tours'
            });
        } catch (err) {
            console.error(err);
            res.status(500).send('Lỗi Server');
        }
    },

    async postReview(req, res) {
        const tourId = Number.parseInt(req.params.id, 10);
        const rating = Number.parseInt(req.body.rating, 10);
        const comment = String(req.body.comment || '').trim();
        if (!Number.isInteger(tourId) || tourId < 1 || !Number.isInteger(rating) || rating < 1 || rating > 5 || comment.length > 1000) {
            return res.status(400).send('Đánh giá không hợp lệ. Nội dung tối đa 1.000 ký tự.');
        }
        try {
            await ReviewModel.saveReview({ tourId, userId: req.session.userId, rating, comment });
            return res.redirect(`/tour/${tourId}?review=success#reviews`);
        } catch (error) {
            if (error.message === 'TOUR_NOT_FOUND') return res.status(404).send('Không tìm thấy tour.');
            if (error.message === 'REVIEW_NOT_ELIGIBLE') return res.status(403).send('Bạn chỉ có thể đánh giá sau khi tour đã khởi hành và được duyệt.');
            console.error(error);
            return res.status(500).send('Không thể lưu đánh giá lúc này.');
        }
    },

    async bookTour(req, res) {
        try {
            const tourId = req.params.id;
            const { customer_name, phone, email, number_of_guests, booking_date } = req.body;
            
            const tour = await TourModel.getTourById(tourId);
            if (!tour) return res.status(404).send('Không tìm thấy tour');
            const guests = Number.parseInt(number_of_guests, 10);
            if (!Number.isInteger(guests) || guests < 1 || !customer_name || !phone || !booking_date) {
                return res.status(400).send('Thông tin đặt tour không hợp lệ');
            }
            const totalPrice = Math.round(Number(tour.price) * guests);

            // Lưu booking vào database
            const newBooking = await BookingModel.createBooking(
                tourId, req.session.userId, customer_name, phone, email, guests, totalPrice, booking_date
            );
            
            // Lấy thông tin ngân hàng từ file .env hoặc dùng giá trị mặc định
            const bankInfo = {
                bankId: process.env.BANK_ID || 'VCB',
                accountNo: process.env.ACCOUNT_NO || '1041847421',
                accountName: process.env.ACCOUNT_NAME || 'NGO QUOC THIEN BAO'
            };
            const amount = Math.round(Number(newBooking.total_price));
            const transferNote = `DATTOUR ${newBooking.id}`;
            const qrUrl = `https://img.vietqr.io/image/${encodeURIComponent(bankInfo.bankId)}-${encodeURIComponent(bankInfo.accountNo)}-compact2.png` +
                `?amount=${amount}&addInfo=${encodeURIComponent(transferNote)}&accountName=${encodeURIComponent(bankInfo.accountName.trim())}`;

            // Render giao diện kèm dữ liệu booking và bankInfo
            res.render('booking_success', { booking: newBooking, bankInfo, qrUrl });
        } catch (err) {
            console.error(err);
            res.status(500).send('Lỗi đặt tour');
        }
    },    

    async getItineraryPage(req, res) {
        res.render('itinerary', { schedule: null, selectedCity: 'Ho Chi Minh', selectedDays: 2, path: '/itinerary' });
    },

    async postItineraryPage(req, res) {
        try {
            const { city, num_days } = req.body;
            const days = Number.parseInt(num_days, 10);
            if (!['Ho Chi Minh', 'Da Nang', 'Ha Noi'].includes(city) || ![1, 2, 3].includes(days)) {
                return res.status(400).send('Thành phố hoặc số ngày không hợp lệ');
            }
            const schedule = await ItineraryService.generateSchedule(city, days);
            res.render('itinerary', { schedule, selectedCity: city, selectedDays: days, path: '/itinerary' });
        } catch (err) {
            console.error(err);
            res.status(500).send('Lỗi tạo lịch trình');
        }
    }
};

module.exports = MainController;
