const { Resend } = require('resend');

const resend = new Resend(process.env.RESEND_API_KEY);

// ─── Kiểm tra config ─────────────────────────────
const ensureMailConfig = () => {
    if (!process.env.RESEND_API_KEY) {
        const error = new Error('Thiếu RESEND_API_KEY.');
        error.statusCode = 500;
        throw error;
    }
};

// ─── Gửi mail chung ───────────────────────────────
const sendMail = async ({ to, subject, html }) => {
    ensureMailConfig();

    try {
        console.log(`📧 [Mailer] Sending email via Resend (to: ${to})`);

        const data = await resend.emails.send({
            from: process.env.MAIL_FROM || 'onboarding@resend.dev',
            to,
            subject,
            html,
        });

        console.log(`✅ [Mailer] Email sent (id: ${data.id})`);
        return data;

    } catch (error) {
        console.error('❌ [Mailer] Send failed:', error);

        const mailError = new Error('Không thể gửi email. Vui lòng thử lại sau.');
        mailError.statusCode = 500;
        throw mailError;
    }
};

/**
 * OTP reset password
 */
async function sendOTPEmail(toEmail, otp) {
    await sendMail({
        to: toEmail,
        subject: 'Mã xác nhận đặt lại mật khẩu - Smart AI Chat',
        html: `
        <div style="font-family: sans-serif; max-width: 480px; margin: auto;">
            <h2>🔒 Smart AI Chat</h2>
            <p>Mã OTP của bạn:</p>
            <h1 style="letter-spacing: 6px;">${otp}</h1>
            <p>Mã có hiệu lực trong 5 phút.</p>
        </div>
        `,
    });
}

/**
 * OTP đăng ký
 */
async function sendRegistrationOTPEmail(toEmail, otp) {
    await sendMail({
        to: toEmail,
        subject: 'Xác thực email đăng ký - Smart AI Chat',
        html: `
        <div style="font-family: sans-serif; max-width: 480px; margin: auto;">
            <h2>🎉 Chào mừng!</h2>
            <p>Mã xác thực của bạn:</p>
            <h1 style="letter-spacing: 6px;">${otp}</h1>
            <p>Mã có hiệu lực trong 5 phút.</p>
        </div>
        `,
    });
}

/**
 * SMS giả lập
 */
async function sendSMSOTP(phoneNumber, otp) {
    console.log(`[SMS OTP] ${otp} -> ${phoneNumber}`);
    return { success: true };
}

module.exports = {
    sendOTPEmail,
    sendRegistrationOTPEmail,
    sendSMSOTP,
    ensureMailConfig,
};