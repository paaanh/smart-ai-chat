const mongoose = require('mongoose');

const adminLogSchema = new mongoose.Schema({
    admin: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true,
    },
    action: {
        type: String,
        required: true,
        enum: [
            'ban_user', 'unban_user', 'lock_user', 'unlock_user',
            'delete_user', 'reset_password', 'mute_user', 'unmute_user',
            'update_user', 'toggle_verified', 'resolve_report', 'dismiss_report',
            'add_bad_word', 'remove_bad_word', 'update_config',
        ],
    },
    targetUser: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        default: null,
    },
    details: {
        type: String,
        default: '',
    },
    ip: {
        type: String,
        default: '',
    },
}, { timestamps: true });

adminLogSchema.index({ admin: 1 });
adminLogSchema.index({ action: 1 });
adminLogSchema.index({ createdAt: -1 });

module.exports = mongoose.model('AdminLog', adminLogSchema);
