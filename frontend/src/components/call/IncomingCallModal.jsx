import { useCall } from '../../hooks/useCall';
import { Phone, PhoneOff, Video } from 'lucide-react';

export default function IncomingCallModal() {
    const { callState, acceptCall, rejectCall } = useCall();

    if (!callState.incoming) return null;

    const callerName = callState.caller?.username || 'Unknown';
    const callerAvatar = callState.caller?.avatar;
    const isVideoCall = callState.callType === 'video';

    return (
        <div className="fixed inset-0 bg-black/70 z-[60] flex items-center justify-center p-4">
            <div className="bg-white rounded-3xl p-8 text-center shadow-2xl max-w-sm w-full animate-bounce-in">
                {/* Avatar */}
                {callerAvatar ? (
                    <img
                        src={callerAvatar}
                        alt={callerName}
                        className="w-20 h-20 rounded-full mx-auto mb-4 object-cover ring-4 ring-green-400 animate-pulse"
                    />
                ) : (
                    <div className="w-20 h-20 rounded-full bg-blue-500 flex items-center justify-center text-white text-3xl font-bold mx-auto mb-4 animate-pulse">
                        {callerName.charAt(0).toUpperCase()}
                    </div>
                )}

                {/* Caller info */}
                <h2 className="text-xl font-bold text-gray-900 mb-1">{callerName}</h2>
                <p className="text-gray-500 mb-8 flex items-center justify-center gap-1">
                    {isVideoCall ? <Video size={16} /> : <Phone size={16} />}
                    {isVideoCall ? 'Cuộc gọi video đến...' : 'Cuộc gọi thoại đến...'}
                </p>

                {/* Actions */}
                <div className="flex items-center justify-center gap-8">
                    <button
                        onClick={rejectCall}
                        className="flex flex-col items-center gap-2"
                    >
                        <div className="w-14 h-14 bg-red-500 hover:bg-red-600 rounded-full flex items-center justify-center transition">
                            <PhoneOff size={24} className="text-white" />
                        </div>
                        <span className="text-xs text-gray-500">Từ chối</span>
                    </button>

                    <button
                        onClick={acceptCall}
                        className="flex flex-col items-center gap-2"
                    >
                        <div className="w-14 h-14 bg-green-500 hover:bg-green-600 rounded-full flex items-center justify-center transition animate-bounce">
                            <Phone size={24} className="text-white" />
                        </div>
                        <span className="text-xs text-gray-500">Chấp nhận</span>
                    </button>
                </div>
            </div>
        </div>
    );
}
