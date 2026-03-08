import { MapPin, ExternalLink } from 'lucide-react';

export default function LocationMessage({ location, isOwn }) {
    if (!location?.lat || !location?.lng) return null;

    const { lat, lng, address } = location;
    const mapsUrl = `https://www.google.com/maps?q=${lat},${lng}`;

    // OpenStreetMap static tile (no API key needed)
    const staticMapUrl = `https://staticmap.thistle.workers.dev/${lng},${lat},15/300x200.png`;

    return (
        <div className="w-[280px] flex flex-col rounded-2xl overflow-hidden">
            {/* Map area */}
            <a
                href={mapsUrl}
                target="_blank"
                rel="noopener noreferrer"
                className={`relative block w-full h-[150px] ${isOwn ? 'bg-white/15' : 'bg-gray-200'}`}
            >
                <img
                    src={staticMapUrl}
                    alt="Location map"
                    className="absolute inset-0 w-full h-full object-cover"
                    onError={(e) => { e.target.style.display = 'none'; }}
                />
                {/* Pin overlay — always visible */}
                <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                    <div className="bg-red-500 text-white rounded-full p-2.5 shadow-lg">
                        <MapPin size={22} />
                    </div>
                </div>
            </a>

            {/* Info section */}
            <div className={`flex flex-col gap-2 p-3 ${isOwn ? 'bg-black/10' : 'bg-white'}`}>
                {address && (
                    <p className={`text-xs leading-relaxed ${isOwn ? 'text-white/85' : 'text-gray-600'}`}>
                        {address}
                    </p>
                )}
                <a
                    href={mapsUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className={`flex items-center justify-center gap-1.5 text-xs font-semibold py-2 rounded-lg transition
                        ${isOwn
                            ? 'bg-white/20 text-white hover:bg-white/30'
                            : 'bg-[var(--color-primary-light)] text-[var(--color-primary)] hover:bg-[var(--color-primary-medium)]'
                        }`}
                >
                    <ExternalLink size={13} />
                    Xem trên Google Maps
                </a>
            </div>
        </div>
    );
}
