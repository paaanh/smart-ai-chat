const dns = require('dns');
const nodemailer = require('nodemailer');

if (typeof dns.setDefaultResultOrder === 'function') {
    dns.setDefaultResultOrder('ipv4first');
}

// ─── Nodemailer transporter (Gmail SMTP) ────────────────────────────
let transporter = null;

const getTransporter = () => {
    if (!transporter) {
        const user = process.env.MAIL_USER || process.env.EMAIL_USER;
        const pass = process.env.MAIL_APP_PASSWORD || process.env.EMAIL_PASS;

        if (!user || !pass) {
            console.error('❌ [Mailer] MAIL_USER hoặc MAIL_APP_PASSWORD chưa được cấu hình.');
            const error = new Error('Thiếu cấu hình email (MAIL_USER / MAIL_APP_PASSWORD).');
            error.statusCode = 500;
            throw error;
        }

        transporter = nodemailer.createTransport({
            host: 'smtp.gmail.com',
            port: 465,
            secure: true,
            family: 4,
            auth: { user, pass },
        });

        console.log(`✅ [Mailer] Nodemailer configured (user: ${user})`);
    }
    return transporter;
};

// ─── Kiểm tra cấu hình ─────────────────────────────────────────────
const ensureMailConfig = () => {
    const user = process.env.MAIL_USER || process.env.EMAIL_USER;
    const pass = process.env.MAIL_APP_PASSWORD || process.env.EMAIL_PASS;
    if (!user || !pass) {
        const error = new Error('Thiếu cấu hình email (MAIL_USER / MAIL_APP_PASSWORD).');
        error.statusCode = 500;
        throw error;
    }
};

// ─── Gửi mail chung ────────────────────────────────────────────────
const sendMail = async (mailOptions) => {
    ensureMailConfig();

    try {
        const from = mailOptions.from || `"Smart AI Chat" <${process.env.MAIL_USER}>`;
        console.log(`📧 [Mailer] Sending email via Gmail SMTP (to: ${mailOptions.to})`);

        const info = await getTransporter().sendMail({
            from,
            to: mailOptions.to,
            subject: mailOptions.subject,
            html: mailOptions.html,
        });

        console.log(`✅ [Mailer] Email sent (messageId: ${info.messageId})`);
        return info;
    } catch (error) {
        console.error('❌ [Mailer] Send failed:', error.message);

        const mailError = new Error('Không thể gửi mã OTP qua email. Vui lòng thử lại sau.');
        mailError.statusCode = 500;
        throw mailError;
    }
};

/**
 * Gửi email OTP reset password
 */
async function sendOTPEmail(toEmail, otp) {
    await sendMail({
        to: toEmail,
        subject: 'Mã xác nhận đặt lại mật khẩu - Smart AI Chat',
        html: `
            <div style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; max-width: 480px; margin: 0 auto; padding: 32px; border: 1px solid #e5e7eb; border-radius: 16px;">
                <h2 style="color: #6366f1;">🔒 Smart AI Chat</h2>
                <p>Xin chào,</p>
                <p>Bạn vừa yêu cầu đặt lại mật khẩu. Đây là mã xác nhận của bạn:</p>
                <div style="text-align: center; margin: 24px 0;">
                    <span style="display: inline-block; padding: 16px 32px; background: #6366f1; color: white; font-size: 28px; font-weight: bold; border-radius: 12px; letter-spacing: 6px;">${otp}</span>
                </div>
                <p style="color: #6b7280; font-size: 13px;">⏳ Mã có hiệu lực trong 5 phút. Không chia sẻ mã này với bất kỳ ai.</p>
                <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 24px 0;">
                <p style="color: #9ca3af; font-size: 12px;">Nếu bạn không yêu cầu đặt lại mật khẩu, hãy bỏ qua email này.</p>
            </div>
        `,
    });
}

/**
 * Gửi email OTP xác thực đăng ký
 */
async function sendRegistrationOTPEmail(toEmail, otp) {
    await sendMail({
        to: toEmail,
        subject: 'Xác thực email đăng ký - Smart AI Chat',
        html: `
            <div style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; max-width: 480px; margin: 0 auto; padding: 32px; border: 1px solid #e5e7eb; border-radius: 16px;">
                <h2 style="color: #6366f1;">🎉 Chào mừng đến Smart AI Chat!</h2>
                <p>Cảm ơn bạn đã đăng ký. Nhập mã bên dưới để xác thực email:</p>
                <div style="text-align: center; margin: 24px 0;">
                    <span style="display: inline-block; padding: 16px 32px; background: #10b981; color: white; font-size: 28px; font-weight: bold; border-radius: 12px; letter-spacing: 6px;">${otp}</span>
                </div>
                <p style="color: #6b7280; font-size: 13px;">⏳ Mã có hiệu lực trong 5 phút. Không chia sẻ mã này với bất kỳ ai.</p>
                <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 24px 0;">
                <p style="color: #9ca3af; font-size: 12px;">Nếu bạn không đăng ký tài khoản, hãy bỏ qua email này.</p>
            </div>
        `,
    });
}

/**
 * Gửi OTP qua SMS (stub)
 */
async function sendSMSOTP(phoneNumber, otp) {
    console.log(`[SMS OTP] Gửi mã ${otp} đến số ${phoneNumber}`);
    return { success: true, message: `OTP đã gửi đến ${phoneNumber} (giả lập)` };
}

module.exports = {
    transporter: { sendMail }, // backward-compatible
    sendOTPEmail,
    sendRegistrationOTPEmail,
    sendSMSOTP,
    ensureMailConfig,
};
