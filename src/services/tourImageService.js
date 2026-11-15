const fs = require('fs/promises');
const path = require('path');

const toursDirectory = path.resolve(__dirname, '..', 'public', 'images', 'tours');
const defaultImageUrl = '/images/tours/default-tour.svg';

function tourDirectory(tourId) {
    if (!Number.isSafeInteger(Number(tourId)) || Number(tourId) < 1) {
        throw new Error('Mã tour không hợp lệ');
    }
    return path.join(toursDirectory, `tour-${Number(tourId)}`);
}

function localImagePath(imageUrl) {
    if (typeof imageUrl !== 'string' || !imageUrl.startsWith('/images/tours/')) return null;
    const resolved = path.resolve(toursDirectory, imageUrl.slice('/images/tours/'.length));
    if (!resolved.startsWith(`${toursDirectory}${path.sep}`)) return null;
    return resolved;
}

async function assertJpeg(file) {
    if (!file) return;
    const handle = await fs.open(file.path, 'r');
    try {
        const signature = Buffer.alloc(3);
        const { bytesRead } = await handle.read(signature, 0, 3, 0);
        if (bytesRead !== 3 || signature[0] !== 0xff || signature[1] !== 0xd8 || signature[2] !== 0xff) {
            const error = new Error(`Tệp ${file.originalname} không phải ảnh JPEG hợp lệ`);
            error.statusCode = 400;
            throw error;
        }
    } finally {
        await handle.close();
    }
}

async function copyUpload(file, outputPath) {
    await assertJpeg(file);
    await fs.copyFile(file.path, outputPath);
}

async function copyExistingImage(imageUrl, outputPath) {
    const source = localImagePath(imageUrl);
    if (!source) return false;
    try {
        await fs.copyFile(source, outputPath);
        return true;
    } catch (error) {
        if (error.code === 'ENOENT') return false;
        throw error;
    }
}

function imageUrl(tourId, fileName) {
    return `/images/tours/tour-${Number(tourId)}/${fileName}`;
}

async function installNewTourImages(tourId, stageDir, files) {
    const mainFile = files.mainImage?.[0];
    if (!mainFile) {
        const error = new Error('Chưa chọn ảnh bìa cho tour');
        error.statusCode = 400;
        throw error;
    }

    const finalDirectory = tourDirectory(tourId);
    const preparedDirectory = path.join(stageDir, 'prepared');
    await fs.mkdir(preparedDirectory, { recursive: true });
    await copyUpload(mainFile, path.join(preparedDirectory, 'main.jpg'));

    const galleryFiles = files.subImages || [];
    for (let index = 0; index < galleryFiles.length; index += 1) {
        await copyUpload(galleryFiles[index], path.join(preparedDirectory, `sub_${index + 1}.jpg`));
    }

    await fs.rename(preparedDirectory, finalDirectory);
    return {
        imageUrl: imageUrl(tourId, 'main.jpg'),
        galleryImages: galleryFiles.map((_file, index) => imageUrl(tourId, `sub_${index + 1}.jpg`))
    };
}

async function replaceTourImages(tour, stageDir, files, removeGallery, saveImages) {
    const finalDirectory = tourDirectory(tour.id);
    const preparedDirectory = path.join(stageDir, 'prepared');
    const backupDirectory = path.join(stageDir, 'previous');
    const uploadedMain = files.mainImage?.[0];
    const uploadedGallery = files.subImages || [];
    const existingGallery = Array.isArray(tour.gallery_images) ? tour.gallery_images.slice(0, 4) : [];

    await fs.mkdir(preparedDirectory, { recursive: true });
    let nextImageUrl = tour.image_url || defaultImageUrl;
    if (uploadedMain) {
        await copyUpload(uploadedMain, path.join(preparedDirectory, 'main.jpg'));
        nextImageUrl = imageUrl(tour.id, 'main.jpg');
    } else if (await copyExistingImage(tour.image_url, path.join(preparedDirectory, 'main.jpg'))) {
        nextImageUrl = imageUrl(tour.id, 'main.jpg');
    }

    let nextGallery = [];
    if (uploadedGallery.length) {
        for (let index = 0; index < uploadedGallery.length; index += 1) {
            await copyUpload(uploadedGallery[index], path.join(preparedDirectory, `sub_${index + 1}.jpg`));
            nextGallery.push(imageUrl(tour.id, `sub_${index + 1}.jpg`));
        }
    } else if (!removeGallery) {
        for (const galleryUrl of existingGallery) {
            const index = nextGallery.length + 1;
            const copied = await copyExistingImage(galleryUrl, path.join(preparedDirectory, `sub_${index}.jpg`));
            if (copied) nextGallery.push(imageUrl(tour.id, `sub_${index}.jpg`));
        }
    }

    let previousDirectoryMoved = false;
    let newDirectoryInstalled = false;
    try {
        await fs.rename(finalDirectory, backupDirectory);
        previousDirectoryMoved = true;
    } catch (error) {
        if (error.code !== 'ENOENT') throw error;
    }

    try {
        const hasPreparedFiles = (await fs.readdir(preparedDirectory)).length > 0;
        if (hasPreparedFiles) {
            await fs.rename(preparedDirectory, finalDirectory);
            newDirectoryInstalled = true;
        }
        await saveImages(nextImageUrl, nextGallery);
        if (previousDirectoryMoved) {
            await fs.rm(backupDirectory, { recursive: true, force: true }).catch(() => {});
        }
        return { imageUrl: nextImageUrl, galleryImages: nextGallery };
    } catch (error) {
        if (newDirectoryInstalled) await fs.rm(finalDirectory, { recursive: true, force: true }).catch(() => {});
        if (previousDirectoryMoved) await fs.rename(backupDirectory, finalDirectory).catch(() => {});
        throw error;
    }
}

async function removeTourImages(tourId) {
    await fs.rm(tourDirectory(tourId), { recursive: true, force: true });
}

async function cleanupStage(stageDir) {
    if (stageDir) await fs.rm(stageDir, { recursive: true, force: true });
}

module.exports = { installNewTourImages, replaceTourImages, removeTourImages, cleanupStage };
