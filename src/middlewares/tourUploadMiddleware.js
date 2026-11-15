const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const multer = require('multer');

const toursDirectory = path.join(__dirname, '..', 'public', 'images', 'tours');
const stagingDirectory = path.join(toursDirectory, '.staging');

const storage = multer.diskStorage({
    destination(req, _file, callback) {
        req.uploadStageDir = path.join(stagingDirectory, req.uploadBatchId);
        fs.mkdir(req.uploadStageDir, { recursive: true }, error => callback(error, req.uploadStageDir));
    },
    filename(req, file, callback) {
        if (file.fieldname === 'mainImage') return callback(null, 'main.jpg');
        req.subImageNumber = (req.subImageNumber || 0) + 1;
        callback(null, `sub_${req.subImageNumber}.jpg`);
    }
});

const upload = multer({
    storage,
    limits: { fileSize: 5 * 1024 * 1024, files: 5, fields: 12, fieldSize: 16 * 1024 },
    fileFilter(_req, file, callback) {
        const hasJpegExtension = /\.jpe?g$/i.test(file.originalname);
        if (file.mimetype !== 'image/jpeg' || !hasJpegExtension) {
            return callback(new Error('Chỉ nhận ảnh JPEG (.jpg hoặc .jpeg).'));
        }
        callback(null, true);
    }
}).fields([
    { name: 'mainImage', maxCount: 1 },
    { name: 'subImages', maxCount: 4 }
]);

function startUploadBatch(req, _res, next) {
    req.uploadBatchId = crypto.randomUUID();
    req.subImageNumber = 0;
    req.uploadStageDir = path.join(stagingDirectory, req.uploadBatchId);
    fs.mkdir(req.uploadStageDir, { recursive: true }, next);
}

function receiveTourImages(req, res, next) {
    upload(req, res, async error => {
        if (!error) return next();
        if (req.uploadStageDir) {
            await fs.promises.rm(req.uploadStageDir, { recursive: true, force: true }).catch(() => {});
        }
        const statusCode = error instanceof multer.MulterError ? 400 : 415;
        res.status(statusCode).send(error.message);
    });
}

module.exports = { startUploadBatch, receiveTourImages };
