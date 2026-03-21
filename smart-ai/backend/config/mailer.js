const dns = require('dns');
const nodemailer = require('nodemailer');
const { Resend } = require('resend'); // ✅ thêm

if (typeof dns.setDefaultResultOrder === 'function') {
    dns.setDefaultResultOrder('ipv4first');
}

// ❗ giữ transporter nhưng KHÔNG dùng nữa (để không phá code cũ)
const transporter = nodemailer.createTransport({
    host: 'smtp.gmail.com',
    port: 465,
    secure: true,
    family: 4,
    auth: {
        user: process.env.MAIL_USER || process.env.EMAIL_USER,
        pass: process.env.MAIL_APP_PASSWORD || process.env.EMAIL_PASS,
    },
});

// ✅ dùng resend — lazy init để không crash khi thiếu key
let resend = null;

const getResend = () => {
    if (!resend) {
        if (!process.env.RESEND_API_KEY) {
            const error = new Error('Thiếu RESEND_API_KEY.');
            error.statusCode = 500;
            throw error;
        }
        resend = new Resend(process.env.RESEND_API_KEY);
    }
    return resend;
};

const ensureMailConfig = () => {
    if (!process.env.RESEND_API_KEY) {
        const error = new Error('Thiếu RESEND_API_KEY.');
        error.statusCode = 500;
        throw error;
    }
};

const sendMail = async (mailOptions) => {
    ensureMailConfig();

    try {
        console.log(`📧 Sending email via Resend (to: ${mailOptions.to})`);

        // ✅ CHỈ SỬA ĐOẠN NÀY (core fix)
        return await getResend().emails.send({
            from: mailOptions.from || 'onboarding@resend.dev',
            to: mailOptions.to,
            subject: mailOptions.subject,
            html: mailOptions.html,
        });

    } catch (error) {
        console.error('❌ Mail send failed:', error);

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
        from: `"Smart AI Chat" <onboarding@resend.dev>`, // ⚠️ đổi domain resend
        to: toEmail,
        subject: 'Mã xác nhận đặt lại mật khẩu - Smart AI Chat',
        html: `
            <div style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; max-width: 480px; margin: 0 auto; padding: 32px; border: 1px solid #e5e7eb; border-radius: 16px;">
                <h2>Smart AI Chat</h2>
                <p>Mã OTP của bạn:</p>
                <h1>${otp}</h1>
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
        from: `"Smart AI Chat" <onboarding@resend.dev>`,
        to: toEmail,
        subject: 'Xác thực email đăng ký - Smart AI Chat',
        html: `
            <div style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; max-width: 480px; margin: 0 auto; padding: 32px;">
                <h2>Smart AI Chat</h2>
                <p>Mã OTP của bạn:</p>
                <h1>${otp}</h1>
            </div>
        `,
    };

    await sendMail(mailOptions);
}

/**
 * Gửi OTP qua SMS (stub)
 */
async function sendSMSOTP(phoneNumber, otp) {
    console.log(`[SMS OTP] Gửi mã ${otp} đến số ${phoneNumber}`);
    return { success: true, message: `OTP đã gửi đến ${phoneNumber} (giả lập)` };
}

module.exports = {
    transporter, // giữ nguyên
    sendOTPEmail,
    sendRegistrationOTPEmail,
    sendSMSOTP,
    ensureMailConfig
};
