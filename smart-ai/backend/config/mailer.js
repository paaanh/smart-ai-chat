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
            from: process.env.MAIL_FROM || 'Smart AI Chat <no-reply@smart-ai-chat.me>',
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
            <div style="background:#f4f6f8;padding:40px 0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
            <div style="max-width:480px;margin:auto;background:#ffffff;border-radius:16px;padding:32px;text-align:center;box-shadow:0 10px 30px rgba(0,0,0,0.08);">
                
                <h2 style="margin-bottom:8px;color:#111;">🔒 Smart AI Chat</h2>
                <p style="color:#666;margin-bottom:24px;">Yêu cầu đặt lại mật khẩu</p>

                <p style="font-size:14px;color:#888;">Mã OTP của bạn</p>

                <div style="font-size:32px;font-weight:bold;letter-spacing:8px;background:#f1f3f5;padding:16px 24px;border-radius:12px;display:inline-block;margin:16px 0;color:#111;">
                ${otp}
                </div>

                <p style="font-size:13px;color:#999;margin-top:20px;">
                Mã có hiệu lực trong <b>5 phút</b>
                </p>

                <hr style="margin:24px 0;border:none;border-top:1px solid #eee;">

                <p style="font-size:12px;color:#aaa;">
                Nếu bạn không yêu cầu, hãy bỏ qua email này.
                </p>

            </div>
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
        <div style="background:linear-gradient(135deg,#667eea,#764ba2);padding:40px 0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
        <div style="max-width:480px;margin:auto;background:#ffffff;border-radius:16px;padding:32px;text-align:center;box-shadow:0 10px 30px rgba(0,0,0,0.15);">
            
            <h2 style="margin-bottom:8px;color:#111;">🎉 Chào mừng đến với Smart AI Chat</h2>
            <p style="color:#666;margin-bottom:24px;">Xác thực email của bạn để bắt đầu</p>

            <p style="font-size:14px;color:#888;">Mã xác thực</p>

            <div style="font-size:32px;font-weight:bold;letter-spacing:8px;background:linear-gradient(135deg,#667eea,#764ba2);color:#fff;padding:16px 24px;border-radius:12px;display:inline-block;margin:16px 0;">
            ${otp}
            </div>

            <p style="font-size:13px;color:#999;margin-top:20px;">
            Mã có hiệu lực trong <b>5 phút</b>
            </p>

            <hr style="margin:24px 0;border:none;border-top:1px solid #eee;">

            <p style="font-size:12px;color:#aaa;">
            Nếu bạn không đăng ký, hãy bỏ qua email này.
            </p>

        </div>
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