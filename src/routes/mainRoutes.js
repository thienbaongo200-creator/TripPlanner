const express = require('express');
const router = express.Router();
const MainController = require('../controllers/mainController');
const AuthController = require('../controllers/authController');
const AuthMiddleware = require('../middlewares/authMiddleware');
const BookingModel = require('../models/bookingModel');

router.get('/login', AuthController.getLogin);
router.post('/login', AuthMiddleware.authRateLimit, AuthController.postLogin);
router.get('/register', AuthController.getRegister);
router.post('/register', AuthMiddleware.authRateLimit, AuthController.postRegister);
router.post('/logout', AuthMiddleware.isLoggedIn, AuthController.logout);
router.get('/', MainController.getHomePage);
router.get('/tour/:id', MainController.getTourDetail);
router.post('/tour/:id/book', MainController.bookTour);
router.post('/tour/:id/reviews', AuthMiddleware.isLoggedIn, MainController.postReview);
router.get('/itinerary', MainController.getItineraryPage);
router.post('/itinerary', MainController.postItineraryPage);
router.get('/my-bookings', AuthMiddleware.isLoggedIn, async (req, res) => {
    try {
        const bookings = await BookingModel.getBookingsByUserId(req.session.userId);
        res.render('my_booking', { bookings });
    } catch (err) {
        console.error(err);
        res.status(500).send('Lỗi tải danh sách đặt tour');
    }
});

module.exports = router;
