const DEFAULT_ORIGINS = [
    'http://localhost:3000',
    'http://localhost:5173',
    'http://localhost:80',
    'http://localhost',
    'https://smart-ai-chat.me',
    'https://www.smart-ai-chat.me',
    'https://p-chater-q.vercel.app',
].join(',');
const DEFAULT_ORIGIN_PATTERNS = 'https://*.vercel.app';

const normalizeOrigin = (origin) => String(origin || '').replace(/\/+$/, '');

const parseCsv = (value) => String(value || '')
    .split(',')
    .map(item => item.trim())
    .filter(Boolean);

const escapeRegex = (value) => value.replace(/[|\\{}()[\]^$+?.]/g, '\\$&');

const patternToRegex = (pattern) => new RegExp(
    `^${escapeRegex(normalizeOrigin(pattern)).replace(/\*/g, '.*')}$`,
    'i'
);

const allowedOrigins = Array.from(
    new Set([
        ...parseCsv(DEFAULT_ORIGINS),
        ...parseCsv(process.env.CORS_ORIGINS),
    ].map(normalizeOrigin))
);

const allowedOriginPatterns = parseCsv(process.env.CORS_ORIGIN_PATTERNS || DEFAULT_ORIGIN_PATTERNS)
    .map(patternToRegex);

console.log('🌐 CORS allowed origins:', allowedOrigins);
console.log(
    '🌐 CORS allowed origin patterns:',
    allowedOriginPatterns.map((pattern) => pattern.toString())
);

const isOriginAllowed = (origin) => {
    const normalizedOrigin = normalizeOrigin(origin);

    if (allowedOrigins.includes(normalizedOrigin)) {
        return true;
    }

    return allowedOriginPatterns.some(pattern => pattern.test(normalizedOrigin));
};

const corsOptions = {
    origin: function (origin, callback) {
        // Cho phép requests không có origin (mobile apps, curl, Postman...)
        if (!origin) return callback(null, true);

        if (isOriginAllowed(origin)) {
            callback(null, true);
        } else {
            console.warn(`⚠️ CORS blocked origin: ${origin}`);
            console.warn('⚠️ Allowed origins snapshot:', allowedOrigins);
            console.warn(
                '⚠️ Allowed patterns snapshot:',
                allowedOriginPatterns.map((pattern) => pattern.toString())
            );
            callback(new Error('Not allowed by CORS'));
        }
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'Accept', 'X-Requested-With'],
    optionsSuccessStatus: 204,
};

module.exports = { corsOptions, allowedOrigins, allowedOriginPatterns, isOriginAllowed };
