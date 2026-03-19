const dns = require('dns');
const nodemailer = require('nodemailer');

if (typeof dns.setDefaultResultOrder === 'function') {
    dns.setDefaultResultOrder('ipv4first');
}

const transporter = nodemailer.createTransport({
    host: 'smtp.gmail.com',
    port: 465,
    secure: true,
    family: 4,
    auth: {
        user: process.env.MAIL_USER || process.env.EMAIL_USER,
        pass: process.env.MAIL_APP_PASSWORD || process.env.EMAIL_PASS,
    },
    connectionTimeout: 15000,
    greetingTimeout: 15000,
    socketTimeout: 20000,
    tls: {
        rejectUnauthorized: false,
    },
});

const ensureMailConfig = () => {
    const user = process.env.MAIL_USER || process.env.EMAIL_USER;
    const pass = process.env.MAIL_APP_PASSWORD || process.env.EMAIL_PASS;
    if (!user || !pass) {
        const error = new Error('Dịch vụ email chưa được cấu hình. Thiếu MAIL_USER hoặc MAIL_APP_PASSWORD.');
        error.statusCode = 500;
        throw error;
    }
};

const sendMail = async (mailOptions) => {
    ensureMailConfig();

    try {
        const user = process.env.MAIL_USER || process.env.EMAIL_USER;
        console.log(`Attempting to send email via Port 465... (from: ${user}, to: ${mailOptions.to})`);
        return await transporter.sendMail(mailOptions);
    } catch (error) {
        console.error('❌ Mail send failed:', error.message);
        const mailError = new Error('Không thể gửi mã OTP qua email. Vui lòng thử lại sau.');
        mailError.statusCode = 500;
        throw mailError;
    }
};

/**
 * Gửi email OTP reset password
 */
async function sendOTPEmail(toEmail, otp) {
    const mailOptions = {
        from: `"Smart AI Chat" <${process.env.MAIL_USER}>`,
        to: toEmail,
        subject: 'Mã xác nhận đặt lại mật khẩu - Smart AI Chat',
        html: `
            <div style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; max-width: 480px; margin: 0 auto; padding: 32px; border: 1px solid #e5e7eb; border-radius: 16px;">
                <div style="text-align: center; margin-bottom: 24px;">
                    <h2 style="color: #1f2937; margin: 0;">Smart AI Chat</h2>
                    <p style="color: #6b7280; font-size: 14px; margin-top: 4px;">Đặt lại mật khẩu</p>
                </div>
                <p style="color: #374151; font-size: 15px; line-height: 1.6;">
                    Xin chào,<br/>
                    Bạn đã yêu cầu đặt lại mật khẩu. Vui lòng sử dụng mã OTP bên dưới:
                </p>
                <div style="text-align: center; margin: 28px 0;">
                    <span style="display: inline-block; font-size: 32px; font-weight: 700; letter-spacing: 8px; color: #2563eb; background: #eff6ff; padding: 16px 32px; border-radius: 12px; border: 2px dashed #93c5fd;">
                        ${otp}
                    </span>
                </div>
                <p style="color: #6b7280; font-size: 13px; text-align: center;">
                    Mã có hiệu lực trong <strong>5 phút</strong>.<br/>
                    Nếu bạn không yêu cầu, hãy bỏ qua email này.
                </p>
            </div>
        `,
    };

    await sendMail(mailOptions);
}

/**
 * Gửi email OTP xác thực đăng ký
 */
async function sendRegistrationOTPEmail(toEmail, otp) {
    const mailOptions = {
        from: `"Smart AI Chat" <${process.env.MAIL_USER}>`,
        to: toEmail,
        subject: 'Xác thực email đăng ký - Smart AI Chat',
        html: `
            <div style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; max-width: 480px; margin: 0 auto; padding: 32px; border: 1px solid #e5e7eb; border-radius: 16px;">
                <div style="text-align: center; margin-bottom: 24px;">
                    <h2 style="color: #1f2937; margin: 0;">Smart AI Chat</h2>
                    <p style="color: #6b7280; font-size: 14px; margin-top: 4px;">Xác thực đăng ký tài khoản</p>
                </div>
                <p style="color: #374151; font-size: 15px; line-height: 1.6;">
                    Xin chào,<br/>
                    Cảm ơn bạn đã đăng ký Smart AI Chat. Vui lòng nhập mã OTP bên dưới để xác thực email:
                </p>
                <div style="text-align: center; margin: 28px 0;">
                    <span style="display: inline-block; font-size: 32px; font-weight: 700; letter-spacing: 8px; color: #16a34a; background: #f0fdf4; padding: 16px 32px; border-radius: 12px; border: 2px dashed #86efac;">
                        ${otp}
                    </span>
                </div>
                <p style="color: #6b7280; font-size: 13px; text-align: center;">
                    Mã có hiệu lực trong <strong>5 phút</strong>.<br/>
                    Nếu bạn không yêu cầu, hãy bỏ qua email này.
                </p>
            </div>
        `,
    };

    await sendMail(mailOptions);
}

/**
 * Gửi OTP qua SMS (stub - chuẩn bị cho tương lai)
 * Hiện tại chỉ log ra console, sẽ tích hợp Twilio/SMS gateway sau.
 */
async function sendSMSOTP(phoneNumber, otp) {
    // TODO: Tích hợp Twilio hoặc SMS gateway thực tế
    console.log(`[SMS OTP] Gửi mã ${otp} đến số ${phoneNumber}`);
    return { success: true, message: `OTP đã gửi đến ${phoneNumber} (giả lập)` };
}

module.exports = { transporter, sendOTPEmail, sendRegistrationOTPEmail, sendSMSOTP, ensureMailConfig };
