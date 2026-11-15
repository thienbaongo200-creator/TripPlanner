-- Reset sạch sẽ các bảng
DROP TABLE IF EXISTS bookings CASCADE;
DROP TABLE IF EXISTS tours CASCADE;
DROP TABLE IF EXISTS categories CASCADE;
DROP TABLE IF EXISTS attractions CASCADE;
DROP TABLE IF EXISTS users CASCADE;

-- 1. Bảng Người dùng (Phân quyền Khách hàng & Quản trị viên)
CREATE TABLE IF NOT EXISTS users (
    id SERIAL PRIMARY KEY,
    username VARCHAR(50) UNIQUE NOT NULL,
    email VARCHAR(100) UNIQUE NOT NULL,
    password VARCHAR(255) NOT NULL,
    full_name VARCHAR(100) NOT NULL,
    phone VARCHAR(20),
    role VARCHAR(20) DEFAULT 'customer',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 2. Bảng Danh mục Tour
CREATE TABLE IF NOT EXISTS tour_categories (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    description TEXT
);

-- 3. Bảng Tour du lịch chính
CREATE TABLE IF NOT EXISTS tours (
    id SERIAL PRIMARY KEY,
    category_id INT REFERENCES tour_categories(id) ON DELETE SET NULL,
    title VARCHAR(255) NOT NULL,
    destination VARCHAR(100) NOT NULL,
    price NUMERIC(12, 2) NOT NULL,
    duration VARCHAR(50) NOT NULL,
    max_participants INT DEFAULT 20,
    description TEXT,
    image_url TEXT,
    is_featured BOOLEAN DEFAULT false,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

ALTER TABLE tours
ADD COLUMN IF NOT EXISTS gallery_images JSONB NOT NULL DEFAULT '[]'::jsonb;

-- 4. Bảng Lịch trình mẫu mặc định của Tour
CREATE TABLE IF NOT EXISTS tour_itinerary_templates (
    id SERIAL PRIMARY KEY,
    tour_id INT REFERENCES tours(id) ON DELETE CASCADE,
    day_number INT NOT NULL,
    title VARCHAR(255) NOT NULL,
    activities TEXT NOT NULL
);

-- 5. Bảng Kho điểm tham quan (Hỗ trợ tính năng Lập lịch trình tự động)
CREATE TABLE IF NOT EXISTS attractions (
    id SERIAL PRIMARY KEY,
    name VARCHAR(150) NOT NULL,
    city VARCHAR(50) NOT NULL,
    category VARCHAR(50),
    suggested_time VARCHAR(20),
    address VARCHAR(255),
    description TEXT,
    image_url TEXT
);

-- 6. Bảng Đơn đặt tour (Bookings)
CREATE TABLE IF NOT EXISTS bookings (
    id SERIAL PRIMARY KEY,
    user_id INT REFERENCES users(id) ON DELETE SET NULL,
    tour_id INT REFERENCES tours(id) ON DELETE CASCADE,
    customer_name VARCHAR(100) NOT NULL,
    phone VARCHAR(20) NOT NULL,
    email VARCHAR(100),
    number_of_guests INT DEFAULT 1,
    total_price NUMERIC(12, 2) NOT NULL,
    booking_date DATE NOT NULL,
    payment_status VARCHAR(30) DEFAULT 'Chưa thanh toán',
    status VARCHAR(30) DEFAULT 'Chờ duyệt',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 7. Bảng Đánh giá tour (Reviews)
CREATE TABLE IF NOT EXISTS reviews (
    id SERIAL PRIMARY KEY,
    tour_id INT NOT NULL REFERENCES tours(id) ON DELETE CASCADE,
    user_id INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    rating INT NOT NULL CHECK (rating BETWEEN 1 AND 5),
    comment TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS reviews_tour_created_idx ON reviews(tour_id, created_at DESC);
CREATE INDEX IF NOT EXISTS reviews_user_tour_idx ON reviews(user_id, tour_id);

-- Persistent Express sessions (the store also creates this table if schema.sql has not run yet).
CREATE TABLE IF NOT EXISTS user_sessions (
    sid VARCHAR(255) PRIMARY KEY,
    sess JSONB NOT NULL,
    expire TIMESTAMPTZ NOT NULL
);
CREATE INDEX IF NOT EXISTS user_sessions_expire_idx ON user_sessions(expire);

-- 8. Bảng Lưu lịch trình cá nhân do khách tự tạo
CREATE TABLE IF NOT EXISTS user_custom_itineraries (
    id SERIAL PRIMARY KEY,
    user_id INT REFERENCES users(id) ON DELETE SET NULL,
    city VARCHAR(50) NOT NULL,
    num_days INT NOT NULL,
    title VARCHAR(150) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS itinerary_items (
    id SERIAL PRIMARY KEY,
    itinerary_id INT REFERENCES user_custom_itineraries(id) ON DELETE CASCADE,
    day_number INT NOT NULL,
    session_time VARCHAR(20) NOT NULL,
    attraction_id INT REFERENCES attractions(id) ON DELETE CASCADE,
    custom_note TEXT
);

-- --- THÊM DỮ LIỆU MẪU ---
INSERT INTO users (username, email, password, full_name, phone, role) VALUES
('admin', 'admin@travelsmart.com', '123456', 'Quản Trị Viên', '0901234567', 'admin'),
('nguyenvanA', 'a@gmail.com', '123456', 'Nguyễn Văn A', '0987654321', 'customer')
ON CONFLICT (username) DO NOTHING;

INSERT INTO tour_categories (name, description) VALUES
('Khám phá thành phố', 'Trải nghiệm văn hóa, lịch sử và ẩm thực tại các đô thị lớn.'),
('Nghỉ dưỡng biển đảo', 'Tận hưởng làn nước trong xanh và các resort cao cấp.')
ON CONFLICT DO NOTHING;

INSERT INTO tours (category_id, title, destination, price, duration, max_participants, description, image_url, is_featured) VALUES
(1, 'Khám phá Sài Gòn - TP.HCM', 'Ho Chi Minh', 1500000, '2 Ngày 1 Đêm', 20, 'Trải nghiệm văn hóa, lịch sử hào hùng và ẩm thực đặc sắc tại trung tâm thành phố.', 'https://images.unsplash.com/photo-1583417319070-4a69db38a482', true),
(2, 'Hành trình Đà Nẵng - Hội An', 'Da Nang', 3200000, '3 Ngày 2 Đêm', 25, 'Thưởng ngoạn phố cổ lung linh sắc đèn và bãi biển Mỹ Khê tuyệt đẹp.', 'https://images.unsplash.com/photo-1559592413-7cec4d0cae2b', true),
(1, 'Khám phá thủ đô Hà Nội', 'Ha Noi', 2800000, '3 Ngày 2 Đêm', 20, 'Dạo quanh 36 phố phường, thăm Lăng Bác.', 'https://images.unsplash.com/photo-1509042239860-f550ce710b93', false),
(1, 'Sài Gòn - Chợ Lớn & Vẫn Còn Nhớ Bến Thành', 'Ho Chi Minh', 850000, '1 Ngày', 15, 'Trải nghiệm nét cổ kính của Chợ Lớn và nhịp sống sầm uất Sài Gòn.', 'https://images.unsplash.com/photo-1583417319070-4a69db38a482', false),
(2, 'Thiên Đường Biển Vũng Tàu - Cần Giờ Eco', 'Vung Tau', 1250000, '2 Ngày 1 Đêm', 20, 'Thư giãn bãi biển Bãi Sau và tham quan Rừng Sác Cần Giờ.', 'https://images.unsplash.com/photo-1507525428034-b723cf961d3e', true),
(2, 'Khám Phá Mũi Né - Đồi Cát Bay Phan Thiết', 'Phan Thiet', 2100000, '2 Ngày 1 Đêm', 20, 'Trải nghiệm trượt cát, xe Jeep dạo suối Tiên và nghỉ dưỡng ven biển.', 'https://images.unsplash.com/photo-1507525428034-b723cf961d3e', false),
(2, 'Đảo Ngọc Phú Quốc - Grand World & VinWonders', 'Phu Quoc', 4800000, '3 Ngày 2 Đêm', 30, 'Vui chơi bất tận tại thành phố không ngủ Grand World và lặn ngắm san hô.', 'https://images.unsplash.com/photo-1540555700478-4be289fbecef', true),
(1, 'Đà Lạt Mộng Mơ - Thành Phố Ngàn Hoa', 'Da Lat', 2900000, '3 Ngày 2 Đêm', 25, 'Săn mây Cầu Đất, ghé thăm Thung Lũng Tình Yêu và thưởng thức cà phê chill.', 'https://images.unsplash.com/photo-1506744038136-46273834b3fb', true),
(2, 'Nha Trang Biển Xanh - VinWonders & Vịnh Vân Phong', 'Nha Trang', 3500000, '3 Ngày 2 Đêm', 25, 'Khám phá Viện Hải dương học, bãi biển Tiên và các đảo hoang sơ.', 'https://images.unsplash.com/photo-1507525428034-b723cf961d3e', true),
(1, 'Quy Nhơn - Eo Gió & Kỳ Co Nắng Vàng', 'Quy Nhon', 3200000, '3 Ngày 2 Đêm', 20, 'Chiêm ngưỡng Malibu của Việt Nam với con đường đi bộ ven biển ngoạn mục.', 'https://images.unsplash.com/photo-1519046904884-53103b34b206', false),
(1, 'Hội An - Đèn Lồng Lung Linh & Rừng Dừa Bảy Mẫu', 'Hoi An', 2500000, '2 Ngày 1 Đêm', 20, 'Đi thuyền thúng rạch dừa và thưởng thức cao lầu phố cổ.', 'https://images.unsplash.com/photo-1559592413-7cec4d0cae2b', true),
(1, 'Đà Nẵng - Bà Nà Hills & Cầu Vàng Huyền Thoại', 'Da Nang', 3800000, '3 Ngày 2 Đêm', 30, 'Check-in Cầu Vàng, trải nghiệm cáp treo đạt kỷ lục thế giới.', 'https://images.unsplash.com/photo-1559592413-7cec4d0cae2b', true),
(1, 'Cố Đô Huế - Dấu Ấn Triều Nguyễn & Sông Hương', 'Hue', 2700000, '2 Ngày 1 Đêm', 20, 'Thăm Đại Nội, các lăng tẩm vua triều Nguyễn và nghe ca Huế trên sông.', 'https://images.unsplash.com/photo-1509042239860-f550ce710b93', false),
(1, 'Phong Nha Kẻ Bàng - Động Thiên Đường Quảng Bình', 'Quang Binh', 4200000, '3 Ngày 2 Đêm', 15, 'Thám hiểm hệ thống hang động thạch nhũ kỳ vĩ nhất thế giới.', 'https://images.unsplash.com/photo-1506744038136-46273834b3fb', false),
(1, 'Ninh Bình - Tràng An & Múa Hang Múa', 'Ninh Binh', 1800000, '1 Ngày', 25, 'Đi thuyền ngoạn cảnh Tràng An - Di sản văn hóa và thiên nhiên thế giới.', 'https://images.unsplash.com/photo-1506744038136-46273834b3fb', true),
(1, 'Hà Nội 36 Phố Phường & Lăng Bác', 'Ha Noi', 1500000, '2 Ngày 1 Đêm', 20, 'Hành trình văn hóa tâm linh và ẩm thực phố cổ Hà Nội.', 'https://images.unsplash.com/photo-1509042239860-f550ce710b93', false),
(2, 'Vịnh Hạ Long - Du Thuyền 5 Sao Đẳng Cấp', 'Ha Long', 4500000, '2 Ngày 1 Đêm', 30, 'Nghỉ đêm trên du thuyền hạng sang, chèo kayak khám phá hang Luồn.', 'https://images.unsplash.com/photo-1528127269322-539801943592', true),
(1, 'Sapa - Chinh Phục Đỉnh Fansipan Hùng Vĩ', 'Sapa', 3600000, '3 Ngày 2 Đêm', 25, 'Tận hưởng khí hậu ôn đới, đi cáp treo lên Nóc nhà Đông Dương.', 'https://images.unsplash.com/photo-1506744038136-46273834b3fb', true),
(1, 'Mù Cang Chải - Mùa Vàng Ruộng Bậc Thang', 'Yen Bai', 2800000, '2 Ngày 1 Đêm', 20, 'Săn ảnh ruộng bậc thang mút tầm mắt tại Đèo Khau Phạ.', 'https://images.unsplash.com/photo-1506744038136-46273834b3fb', false),
(1, 'Hà Giang - Mã Pí Lèng & Cột Cờ Lũng Cú', 'Ha Giang', 3900000, '3 Ngày 2 Đêm', 18, 'Chinh phục một trong tứ đại đỉnh đèo và hẻm vực Tu Sản.', 'https://images.unsplash.com/photo-1506744038136-46273834b3fb', true),
(1, 'Cao Bằng - Thác Bản Giốc & Động Ngườm Ngao', 'Cao Bang', 3400000, '3 Ngày 2 Đêm', 20, 'Chiêm ngưỡng thác nước biên giới kỳ vĩ nhất Đông Nam Á.', 'https://images.unsplash.com/photo-1506744038136-46273834b3fb', false),
(1, 'Cần Thơ - Chợ Nổi Cái Răng & Miệt Vườn Miền Tây', 'Can Tho', 1600000, '2 Ngày 1 Đêm', 25, 'Trải nghiệm văn hóa sông nước miền Tây và thưởng thức trái cây tại vườn.', 'https://images.unsplash.com/photo-1583417319070-4a69db38a482', false),
(1, 'Côn Đảo - Trải Nghiệm Tâm Linh & Biển Hoang Sơ', 'Con Dao', 5200000, '3 Ngày 2 Đêm', 15, 'Viếng mộ cô Sáu và lặn ngాం san hô tại hòn Bảy Cạnh.', 'https://images.unsplash.com/photo-1540555700478-4be289fbecef', true);

INSERT INTO attractions (name, city, category, suggested_time, address, image_url) VALUES
('Dinh Độc Lập', 'Ho Chi Minh', 'Lịch sử', 'Sáng', '135 Nam Kỳ Khởi Nghĩa, Quận 1', 'https://images.unsplash.com/photo-1583417319070-4a69db38a482'),
('Bưu điện trung tâm Sài Gòn', 'Ho Chi Minh', 'Kiến trúc', 'Sáng', '2 Công xã Paris, Quận 1', 'https://images.unsplash.com/photo-1590523277543-a94d2e4eb00b'),
('Chợ Bến Thành', 'Ho Chi Minh', 'Mua sắm', 'Chiều', 'Lê Thánh Tôn, Quận 1', 'https://images.unsplash.com/photo-1555396273-367ea4eb4db5'),
('Bến Nhà Rồng', 'Ho Chi Minh', 'Lịch sử', 'Chiều', '01 Nguyễn Tất Thành, Quận 4', 'https://images.unsplash.com/photo-1542314831-068cd1dbfeeb'),
('Phố đi bộ Nguyễn Huệ', 'Ho Chi Minh', 'Giải trí', 'Tối', 'Đường Nguyễn Huệ, Quận 1', 'https://images.unsplash.com/photo-1509042239860-f550ce710b93'),
('Bãi biển Mỹ Khê', 'Da Nang', 'Nghỉ dưỡng', 'Sáng', 'Đường Võ Nguyên Giáp, Đà Nẵng', 'https://images.unsplash.com/photo-1507525428034-b723cf961d3e'),
('Ngũ Hành Sơn', 'Da Nang', 'Danh thắng', 'Chiều', 'Hòa Hải, Ngũ Hành Sơn, Đà Nẵng', 'https://images.unsplash.com/photo-1519046904884-53103b34b206'),
('Phố cổ Hội An', 'Da Nang', 'Văn hóa', 'Tối', 'Quảng Nam', 'https://images.unsplash.com/photo-1559592413-7cec4d0cae2b'),
('Phở Hòa Pasteur', 'Ho Chi Minh', 'Ẩm thực', 'Sáng', '260C Pasteur, Quận 3', 'https://images.unsplash.com/photo-1582878826629-29b7ad1cdc43'),
('Bảo tàng Chứng tích Chiến tranh', 'Ho Chi Minh', 'Lịch sử', 'Chiều', '28 Võ Văn Tần, Quận 3', 'https://images.unsplash.com/photo-1542314831-068cd1dbfeeb'),
('Du thuyền sông Sài Gòn & Ăn tối', 'Ho Chi Minh', 'Trải nghiệm', 'Tối', 'Cảng Sài Gòn, Quận 4', 'https://images.unsplash.com/photo-1509042239860-f550ce710b93'),
('Bún chả Hương Liên (Obama)', 'Ha Noi', 'Ẩm thực', 'Sáng', '24 Lê Văn Hưu, Hai Bà Trưng', 'https://images.unsplash.com/photo-1582878826629-29b7ad1cdc43'),
('Văn Miếu - Quốc Tử Giám', 'Ha Noi', 'Văn hóa', 'Chiều', '58 Quốc Tử Giám, Đống Đa', 'https://images.unsplash.com/photo-1509042239860-f550ce710b93'),
('Xem múa rối nước Thăng Long', 'Ha Noi', 'Nghệ thuật', 'Tối', '57B Đinh Tiên Hoàng, Hoàn Kiếm', 'https://images.unsplash.com/photo-1555396273-367ea4eb4db5');

-- Normalize legacy external image links to a bundled local fallback image.
UPDATE tours
SET image_url = '/images/tours/default-tour.svg'
WHERE image_url IS NULL OR image_url = '' OR image_url LIKE 'http%';

ALTER TABLE users 
ADD COLUMN IF NOT EXISTS reset_password_token VARCHAR(255),
ADD COLUMN IF NOT EXISTS reset_password_expires TIMESTAMP;
