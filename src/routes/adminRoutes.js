const express = require('express');
const router = express.Router();
const AdminController = require('../controllers/adminController');
const AuthMiddleware = require('../middlewares/authMiddleware');
const { startUploadBatch, receiveTourImages } = require('../middlewares/tourUploadMiddleware');

function validateTourId(req, res, next) {
    if (!/^\d+$/.test(req.params.id)) return res.status(400).send('Mã tour không hợp lệ.');
    next();
}

// Login must remain public. Every management route below is admin-only.
router.get('/login', AdminController.getLoginPage);
router.post('/login', AuthMiddleware.authRateLimit, AdminController.postLogin);
router.use(AuthMiddleware.isAdmin);

router.get('/dashboard', AdminController.getDashboard);
router.get('/tours', AdminController.getToursPage);
router.get('/tours/new', AdminController.getNewTourPage);
router.post('/tours', startUploadBatch, receiveTourImages, AdminController.createTour);
router.get('/tours/:id/edit', validateTourId, AdminController.getEditTourPage);
router.post('/tours/:id/update', validateTourId, startUploadBatch, receiveTourImages, AdminController.updateTour);
router.post('/tours/:id/delete', validateTourId, AdminController.deleteTour);
router.post('/booking/:id/:status', AdminController.updateBooking);
router.post('/logout', AdminController.logout);

module.exports = router;
