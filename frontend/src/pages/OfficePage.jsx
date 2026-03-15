import { useNavigate } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import VirtualOffice from '../components/office/VirtualOffice';

export default function OfficePage() {
    const navigate = useNavigate();

    return (
        <div className="h-screen flex flex-col bg-[var(--color-bg-primary)]">
            {/* Top navigation */}
            <div className="flex items-center gap-3 px-4 py-2 bg-[var(--color-bg-secondary)] border-b border-[var(--color-border)]">
                <button
                    onClick={() => navigate('/')}
                    className="p-1.5 rounded-lg hover:bg-[var(--color-bg-hover)] transition-colors text-[var(--color-text-primary)]"
                    title="Back to Chat"
                >
                    <ArrowLeft size={20} />
                </button>
                <span className="text-sm text-[var(--color-text-secondary)]">Back to Chat</span>
            </div>

            {/* Virtual Office */}
            <div className="flex-1 overflow-hidden">
                <VirtualOffice />
            </div>
        </div>
    );
}
