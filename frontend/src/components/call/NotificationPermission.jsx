import { useEffect, useState } from 'react';
import { useAuth } from '../../hooks/useAuth';
import { Bell } from 'lucide-react';

/**
 * Renders a small prompt to request Notification permission
 * the first time an authenticated user loads the app.
 * Once granted/denied, hides itself permanently.
 */
export default function NotificationPermission() {
    const { user } = useAuth();
    const [show, setShow] = useState(false);

    useEffect(() => {
        if (!user) return;
        if (!('Notification' in window)) return;
        if (Notification.permission === 'default') {
            setShow(true);
        }
    }, [user]);

    const handleAllow = async () => {
        const result = await Notification.requestPermission();
        console.log('[Notification] Permission:', result);
        setShow(false);
    };

    const handleDismiss = () => setShow(false);

    if (!show) return null;

    return (
        <div className="fixed bottom-4 right-4 z-[100] bg-white rounded-xl shadow-2xl border border-gray-200 p-4 max-w-xs animate-slide-up">
            <div className="flex items-start gap-3">
                <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center shrink-0">
                    <Bell size={20} className="text-blue-600" />
                </div>
                <div className="flex-1">
                    <p className="text-sm font-medium text-gray-900">Bật thông báo cuộc gọi</p>
                    <p className="text-xs text-gray-500 mt-1">
                        Cho phép thông báo để nhận cuộc gọi đến khi bạn đang ở tab khác.
                    </p>
                    <div className="flex gap-2 mt-3">
                        <button
                            onClick={handleAllow}
                            className="px-3 py-1.5 bg-blue-600 text-white text-xs rounded-lg hover:bg-blue-700 transition"
                        >
                            Cho phép
                        </button>
                        <button
                            onClick={handleDismiss}
                            className="px-3 py-1.5 bg-gray-100 text-gray-600 text-xs rounded-lg hover:bg-gray-200 transition"
                        >
                            Để sau
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}
