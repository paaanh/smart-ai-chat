import { useCall } from '../../hooks/useCall';
import { Phone, PhoneOff, Video, Loader2 } from 'lucide-react';
import { resolveMediaUrl } from '../../services/api';
import { useState, useEffect } from 'react';

export default function IncomingCallModal() {
    const { callState, acceptCall, rejectCall } = useCall();
    const [accepting, setAccepting] = useState(false);

    // Reset local state khi có cuộc gọi mới đến
    // (component không unmount vì nằm cố định trong App.jsx,
    //  nên state cũ sẽ tồn tại nếu không reset thủ công)
    useEffect(() => {
        if (callState.incoming) {
            setAccepting(false);
        }
    }, [callState.incoming]);

    if (!callState.incoming) return null;

    const callerName = callState.caller?.username || 'Unknown';
    const callerAvatar = resolveMediaUrl(callState.caller?.avatar || callState.caller?.googlePicture);
    const isVideoCall = callState.callType === 'video';
    const isGroup = callState.isGroup;
    const roomName = callState.roomName;

    return (
        <div className="fixed inset-0 bg-black/70 z-[60] flex items-center justify-center p-4">
            <div className="bg-white rounded-3xl p-8 text-center shadow-2xl max-w-sm w-full animate-bounce-in">
                {/* Avatar */}
                {isGroup ? (
                    <div className="w-20 h-20 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-white text-3xl font-bold mx-auto mb-4 animate-pulse">
                        {roomName?.charAt(0)?.toUpperCase() || '👥'}
                    </div>
                ) : callerAvatar ? (
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
                <h2 className="text-xl font-bold text-gray-900 mb-1">
                    {isGroup ? (roomName || 'Cuộc gọi nhóm') : callerName}
                </h2>
                <p className="text-gray-500 mb-8 flex items-center justify-center gap-1">
                    {isVideoCall ? <Video size={16} /> : <Phone size={16} />}
                    {isGroup
                        ? `${callerName} đang gọi ${isVideoCall ? 'video' : 'thoại'} nhóm...`
                        : (isVideoCall ? 'Cuộc gọi video đến...' : 'Cuộc gọi thoại đến...')}
                </p>

                {/* Actions */}
                <div className="flex items-center justify-center gap-8">
                    <button
                        onClick={rejectCall}
                        disabled={accepting}
                        className="flex flex-col items-center gap-2"
                    >
                        <div className={`w-14 h-14 bg-red-500 hover:bg-red-600 rounded-full flex items-center justify-center transition ${accepting ? 'opacity-50 cursor-not-allowed' : ''}`}>
                            <PhoneOff size={24} className="text-white" />
                        </div>
                        <span className="text-xs text-gray-500">Từ chối</span>
                    </button>

                    <button
                        onClick={() => {
                            if (accepting) return;
                            setAccepting(true);
                            acceptCall();
                        }}
                        disabled={accepting}
                        className="flex flex-col items-center gap-2"
                    >
                        <div className={`w-14 h-14 bg-green-500 hover:bg-green-600 rounded-full flex items-center justify-center transition ${accepting ? 'opacity-75' : 'animate-bounce'}`}>
                            {accepting ? (
                                <Loader2 size={24} className="text-white animate-spin" />
                            ) : (
                                <Phone size={24} className="text-white" />
                            )}
                        </div>
                        <span className="text-xs text-gray-500">{accepting ? 'Đang kết nối...' : 'Chấp nhận'}</span>
                    </button>
                </div>
            </div>
        </div>
    );
}
