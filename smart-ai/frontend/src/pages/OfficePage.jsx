import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Building2, ExternalLink } from 'lucide-react';

export default function OfficePage() {
    const navigate = useNavigate();
    const officeUrl = import.meta.env.VITE_SKYOFFICE_URL || 'http://localhost:3000';

    return (
        <div className="h-dvh flex flex-col theme-muted-surface">
            <div
                className="h-14 border-b px-4 flex items-center justify-between"
                style={{ borderColor: 'var(--border-color)', backgroundColor: 'var(--bg-card)' }}
            >
                <button
                    onClick={() => navigate('/')}
                    className="inline-flex items-center gap-2 text-sm transition"
                    style={{ color: 'var(--text-secondary)' }}
                >
                    <ArrowLeft size={16} />
                    Quay lại chat
                </button>
                <div className="inline-flex items-center gap-2 font-semibold" style={{ color: 'var(--color-primary)' }}>
                    <Building2 size={18} />
                    Sky Office
                </div>
                <a
                    href={officeUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-full border transition"
                    style={{ borderColor: 'var(--border-color)', color: 'var(--text-secondary)' }}
                >
                    <ExternalLink size={12} />
                    Mở tab mới
                </a>
            </div>

            <div className="flex-1 min-h-0">
                <iframe
                    title="SkyOffice"
                    src={officeUrl}
                    allow="camera; microphone; autoplay; fullscreen; clipboard-read; clipboard-write"
                    allowFullScreen
                    className="w-full h-full border-0"
                />
            </div>
        </div>
    );
}
