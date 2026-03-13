const mongoose = require('mongoose');
const { User } = require('../models/User');

async function main() {
    const target = process.argv[2]; // email or userId
    const uriFromArg = process.argv[3];
    const uri = uriFromArg || process.env.MONGODB_URI || 'mongodb://localhost:27017/smart-ai-chat';

    if (!target) {
        console.log('Usage: node scripts/promoteSuperAdmin.js <email|userId> [mongodb-uri]');
        process.exit(1);
    }

    try {
        await mongoose.connect(uri, { serverSelectionTimeoutMS: 10000 });

        const query = target.includes('@')
            ? { email: target.toLowerCase().trim() }
            : { _id: target };

        const user = await User.findOne(query);
        if (!user) {
            console.error('User not found for target:', target);
            process.exit(1);
        }

        user.role = 'super_admin';
        user.accountStatus = 'active';
        user.is_locked = false;
        user.lock_until = null;
        await user.save();

        console.log('Promoted successfully:');
        console.log(JSON.stringify({
            id: user._id,
            email: user.email,
            username: user.username,
            role: user.role,
            accountStatus: user.accountStatus,
        }, null, 2));
    } catch (error) {
        console.error('Promote super admin failed:', error.message);
        process.exit(1);
    } finally {
        await mongoose.disconnect();
    }
}

main();
