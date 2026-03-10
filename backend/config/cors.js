const DEFAULT_ORIGINS = 'http://localhost:5173,http://localhost:80,http://localhost';

const normalizeOrigin = (origin) => origin.replace(/\/+$/, '');

const allowedOrigins = (process.env.CORS_ORIGINS || DEFAULT_ORIGINS)
    .split(',')
    .map(origin => origin.trim())
    .filter(Boolean)
    .map(normalizeOrigin);

const corsOptions = {
    origin: function (origin, callback) {
        // Cho phép requests không có origin (mobile apps, curl, Postman...)
        if (!origin) return callback(null, true);

        const normalizedOrigin = normalizeOrigin(origin);

        if (allowedOrigins.includes(normalizedOrigin)) {
            callback(null, true);
        } else {
            console.warn(`⚠️ CORS blocked origin: ${origin}`);
            callback(new Error('Not allowed by CORS'));
        }
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'Accept', 'X-Requested-With'],
    optionsSuccessStatus: 204,
};

module.exports = { corsOptions, allowedOrigins };
