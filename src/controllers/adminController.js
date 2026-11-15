const UserModel = require('../models/userModel');
const TourModel = require('../models/tourModel');
const BookingModel = require('../models/bookingModel');
const TourImageService = require('../services/tourImageService');

function parseTourForm(body) {
    const tour = {
        title: String(body.title || '').trim(),
        destination: String(body.destination || '').trim(),
        price: Number(body.price),
        duration: String(body.duration || '').trim(),
        description: String(body.description || '').trim(),
        isFeatured: body.is_featured === 'on'
    };

    if (!tour.title || tour.title.length > 255) return { error: 'Tên tour là bắt buộc và tối đa 255 ký tự.' };
    if (!tour.destination || tour.destination.length > 100) return { error: 'Điểm đến là bắt buộc và tối đa 100 ký tự.' };
    if (!Number.isFinite(tour.price) || tour.price <= 0 || tour.price > 9999999999) return { error: 'Giá tour phải lớn hơn 0 và hợp lệ.' };
    if (!tour.duration || tour.duration.length > 50) return { error: 'Thời lượng là bắt buộc và tối đa 50 ký tự.' };
    return { tour };
}

function publicTour(tour) {
    return { ...tour, image_url: tour.image_url || '/images/tours/default-tour.svg' };
}

async function reportError(res, error, fallbackMessage) {
    console.error(error);
    return res.status(error.statusCode || 500).send(error.statusCode ? error.message : fallbackMessage);
}

const AdminController = {
    getLoginPage(req, res) {
        res.render('admin_login', { error: null, path: '/admin' });
    },

    async postLogin(req, res, next) {
        try {
            const username = String(req.body.username || '').trim();
            const password = typeof req.body.password === 'string' ? req.body.password : '';
            if (!username || username.length > 50 || !password || password.length > 200) {
                return res.status(400).render('admin_login', { error: 'Thông tin đăng nhập không hợp lệ.', path: '/admin' });
            }
            const admin = await UserModel.findAdminByUsername(username);
            if (!admin || !(await UserModel.verifyPassword(password, admin.password, admin.id))) {
                return res.status(401).render('admin_login', { error: 'Tên đăng nhập hoặc mật khẩu không đúng.', path: '/admin' });
            }
            req.clearAuthAttempts?.();

            req.session.regenerate(error => {
                if (error) return next(error);
                req.session.userId = admin.id;
                req.session.username = admin.username;
                req.session.role = admin.role;
                req.session.fullName = admin.full_name;
                req.session.save(saveError => {
                    if (saveError) return next(saveError);
                    res.redirect('/admin/dashboard');
                });
            });
        } catch (error) {
            return next(error);
        }
    },

    async getDashboard(req, res, next) {
        try {
            const [tours, bookings] = await Promise.all([
                TourModel.getAllTours(),
                BookingModel.getAllBookings()
            ]);
            res.render('admin_dashboard', { tours, bookings, path: '/admin' });
        } catch (error) {
            next(error);
        }
    },

    async getToursPage(req, res, next) {
        try {
            const tours = await TourModel.getAllTours();
            res.render('admin_tours', { tours, path: '/admin/tours' });
        } catch (error) {
            next(error);
        }
    },

    getNewTourPage(req, res) {
        res.render('admin_tour_form', {
            tour: { title: '', destination: '', price: '', duration: '', description: '', is_featured: false },
            isEditing: false,
            error: null,
            path: '/admin/tours'
        });
    },

    async getEditTourPage(req, res, next) {
        try {
            const tour = await TourModel.getTourById(req.params.id);
            if (!tour) return res.status(404).send('Không tìm thấy tour.');
            res.render('admin_tour_form', { tour, isEditing: true, error: null, path: '/admin/tours' });
        } catch (error) {
            next(error);
        }
    },

    async createTour(req, res) {
        const parsed = parseTourForm(req.body);
        const mainImage = req.files?.mainImage?.[0];
        if (parsed.error || !mainImage) {
            await TourImageService.cleanupStage(req.uploadStageDir).catch(cleanupError => console.error(cleanupError));
            return res.status(400).render('admin_tour_form', {
                tour: { ...req.body, is_featured: req.body.is_featured === 'on' },
                isEditing: false,
                error: parsed.error || 'Vui lòng chọn ảnh bìa JPEG cho tour.',
                path: '/admin/tours'
            });
        }

        let createdTour;
        try {
            createdTour = await TourModel.createTour(parsed.tour);
            const assets = await TourImageService.installNewTourImages(createdTour.id, req.uploadStageDir, req.files || {});
            const savedTour = await TourModel.updateTourImages(createdTour.id, assets.imageUrl, assets.galleryImages);
            if (!savedTour) throw new Error('Không thể lưu ảnh của tour vừa tạo.');
            await TourImageService.cleanupStage(req.uploadStageDir).catch(cleanupError => console.error(cleanupError));
            return res.redirect('/admin/tours');
        } catch (error) {
            if (createdTour) {
                await TourModel.deleteTour(createdTour.id).catch(cleanupError => console.error(cleanupError));
                await TourImageService.removeTourImages(createdTour.id).catch(cleanupError => console.error(cleanupError));
            }
            await TourImageService.cleanupStage(req.uploadStageDir).catch(cleanupError => console.error(cleanupError));
            return reportError(res, error, 'Không thể tạo tour. Vui lòng thử lại.');
        }
    },

    async updateTour(req, res) {
        const parsed = parseTourForm(req.body);
        if (parsed.error) {
            await TourImageService.cleanupStage(req.uploadStageDir).catch(cleanupError => console.error(cleanupError));
            const tour = publicTour({ ...req.body, id: req.params.id, is_featured: req.body.is_featured === 'on' });
            return res.status(400).render('admin_tour_form', { tour, isEditing: true, error: parsed.error, path: '/admin/tours' });
        }

        try {
            const tour = await TourModel.getTourById(req.params.id);
            if (!tour) {
                await TourImageService.cleanupStage(req.uploadStageDir).catch(cleanupError => console.error(cleanupError));
                return res.status(404).send('Không tìm thấy tour.');
            }

            await TourImageService.replaceTourImages(
                tour,
                req.uploadStageDir,
                req.files || {},
                req.body.remove_gallery === 'on',
                async (imageUrl, galleryImages) => {
                    const updatedTour = await TourModel.updateTour(req.params.id, parsed.tour, imageUrl, galleryImages);
                    if (!updatedTour) throw new Error('Tour không còn tồn tại.');
                    return updatedTour;
                }
            );
            await TourImageService.cleanupStage(req.uploadStageDir).catch(cleanupError => console.error(cleanupError));
            return res.redirect('/admin/tours');
        } catch (error) {
            await TourImageService.cleanupStage(req.uploadStageDir).catch(cleanupError => console.error(cleanupError));
            return reportError(res, error, 'Không thể cập nhật tour. Vui lòng thử lại.');
        }
    },

    async deleteTour(req, res, next) {
        try {
            const deleted = await TourModel.deleteTour(req.params.id);
            if (!deleted) return res.status(404).send('Không tìm thấy tour.');
            await TourImageService.removeTourImages(deleted.id);
            res.redirect('/admin/tours');
        } catch (error) {
            next(error);
        }
    },

    async updateBooking(req, res, next) {
        try {
            const { id, status } = req.params;
            if (!/^\d+$/.test(id) || !['approve', 'cancel'].includes(status)) {
                return res.status(400).send('Yêu cầu cập nhật đơn không hợp lệ.');
            }
            const newStatus = status === 'approve' ? 'Đã duyệt' : 'Đã hủy';
            await BookingModel.updateBookingStatus(id, newStatus);
            res.redirect('/admin/dashboard');
        } catch (error) {
            next(error);
        }
    },

    logout(req, res, next) {
        req.session.destroy(error => {
            if (error) return next(error);
            res.clearCookie('travelsmart.sid', {
                path: '/', httpOnly: true, sameSite: 'lax',
                secure: process.env.NODE_ENV === 'production'
            });
            res.redirect('/admin/login');
        });
    }
};

module.exports = AdminController;
