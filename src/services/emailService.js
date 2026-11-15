const nodemailer = require('nodemailer');

const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS
    }
});

const sendResetOTP = async (email, otp) => {
    const mailOptions = {
        from: '"TravelSmart Support" <no-reply@travelsmart.com>',
        to: email,
        subject: '[TravelSmart] Mã xác nhận khôi phục mật khẩu',
        html: `
            <h3>Yêu cầu đặt lại mật khẩu</h3>
            <p>Mã OTP của bạn là: <b style="font-size: 20px; color: #d9534f;">${otp}</b></p>
            <p>Mã này có hiệu lực trong 15 phút.</p>
        `
    };
    return await transporter.sendMail(mailOptions);
};

module.exports = { sendResetOTP };