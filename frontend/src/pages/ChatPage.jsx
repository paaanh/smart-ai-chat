import { useState, useCallback } from 'react';
import { useAuth } from '../hooks/useAuth';
import { useAI } from '../hooks/useAI';
import RoomList from '../components/room/RoomList';
import ChatWindow from '../components/chat/ChatWindow';
import ChatInfoSidebar from '../components/chat/ChatInfoSidebar';
import FriendPanel from '../components/friend/FriendPanel';
import MiniAIChatBox from '../components/chat/MiniAIChatBox';
import NoteBubbles from '../components/chat/NoteBubbles';
// CallModal + IncomingCallModal are now rendered globally in App.jsx
import { LogOut, Settings, MessageCircle, Users, ShieldCheck } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

export default function ChatPage() {
    const { user, logout } = useAuth();
    const navigate = useNavigate();
    const [activeRoomId, setActiveRoomId] = useState(null);
    const [showSidebar, setShowSidebar] = useState(true);
    const [sidebarTab, setSidebarTab] = useState('chats'); // 'chats' | 'friends'
    const [pendingRequestCount, setPendingRequestCount] = useState(0);
    const handleRequestCountChange = useCallback((count) => setPendingRequestCount(count), []);
    const [infoRoom, setInfoRoom] = useState(null); // room object for ChatInfoSidebar
    const [aiBotEnabled, setAiBotEnabled] = useState(false);
    const [autoTranslate, setAutoTranslate] = useState(false);
    const { toggleBot } = useAI(activeRoomId);

    const handleSelectRoom = (roomId) => {
        setActiveRoomId(roomId);
        setSidebarTab('chats');
        setInfoRoom(null);
        // On mobile, hide sidebar when room selected
        if (window.innerWidth < 1024) {
            setShowSidebar(false);
        }
    };

    const handleBack = () => {
        setShowSidebar(true);
        setActiveRoomId(null);
        setInfoRoom(null);
    };

    const handleToggleInfo = (room) => {
        setInfoRoom((prev) => (prev ? null : room));
    };

    return (
        <div className="h-screen flex bg-gray-100">
            {/* Sidebar */}
            <div
                className={`${showSidebar ? 'flex' : 'hidden'
                    } lg:flex flex-col w-full lg:w-80 xl:w-96 shrink-0`}
            >
                {/* User bar */}
                <div className="bg-white border-b border-gray-200 px-4 py-3 flex items-center gap-3">
                    <div
                        className="w-9 h-9 rounded-full bg-[var(--color-primary)] flex items-center justify-center text-white font-semibold text-sm cursor-pointer hover:ring-2 hover:ring-[var(--color-primary-ring)] transition overflow-hidden shrink-0"
                        onClick={() => navigate(`/profile/${user?._id}`)}
                        title="Trang cá nhân"
                    >
                        {user?.avatar ? (
                            <img src={user.avatar} alt={user.username} className="w-full h-full object-cover" />
                        ) : (
                            user?.username?.charAt(0).toUpperCase()
                        )}
                    </div>
                    <div className="flex-1 min-w-0">
                        <p className="font-medium text-gray-900 text-sm truncate">{user?.username}</p>
                        <p className="text-xs text-gray-400">{user?.preferredLanguageLabel || user?.preferredLanguage}</p>
                    </div>
                    {user?.role && user.role !== 'user' && (
                        <button
                            onClick={() => navigate('/admin')}
                            className="p-1.5 hover:bg-gray-100 rounded-full text-blue-500 transition"
                            title="Admin Dashboard"
                        >
                            <ShieldCheck size={18} />
                        </button>
                    )}
                    <button
                        onClick={() => navigate('/settings')}
                        className="p-1.5 hover:bg-gray-100 rounded-full text-gray-400 transition"
                        title="Cài đặt"
                    >
                        <Settings size={18} />
                    </button>
                    <button
                        onClick={logout}
                        className="p-1.5 hover:bg-gray-100 rounded-full text-gray-400 transition"
                        title="Đăng xuất"
                    >
                        <LogOut size={18} />
                    </button>
                </div>

                {/* Sidebar Tabs */}
                <div className="bg-white border-b border-gray-200 flex">
                    <button
                        onClick={() => setSidebarTab('chats')}
                        className={`flex-1 py-2.5 text-sm font-medium transition flex items-center justify-center gap-1.5 ${sidebarTab === 'chats'
                            ? 'text-[var(--color-primary)] border-b-2 border-[var(--color-primary)]'
                            : 'text-gray-500 hover:text-gray-700'
                            }`}
                    >
                        <MessageCircle size={16} />
                        Tin nhắn
                    </button>
                    <button
                        onClick={() => setSidebarTab('friends')}
                        className={`flex-1 py-2.5 text-sm font-medium transition flex items-center justify-center gap-1.5 relative ${sidebarTab === 'friends'
                            ? 'text-[var(--color-primary)] border-b-2 border-[var(--color-primary)]'
                            : 'text-gray-500 hover:text-gray-700'
                            }`}
                    >
                        <Users size={16} />
                        Bạn bè
                        {pendingRequestCount > 0 && (
                            <span className="absolute -top-0.5 right-2 min-w-[18px] h-[18px] bg-red-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center px-1">
                                {pendingRequestCount > 99 ? '99+' : pendingRequestCount}
                            </span>
                        )}
                    </button>
                </div>

                {/* Mini AI ChatBox — shows when AI bot is enabled */}
                {aiBotEnabled && activeRoomId && (
                    <MiniAIChatBox
                        roomId={activeRoomId}
                        onClose={() => {
                            setAiBotEnabled(false);
                            setAutoTranslate(false);
                            toggleBot(false);
                        }}
                        onAutoTranslateChange={setAutoTranslate}
                    />
                )}

                {/* Room list or Friend panel — both always mounted for socket listeners */}
                <div className="flex-1 overflow-hidden">
                    <div className={sidebarTab === 'chats' ? 'h-full flex flex-col' : 'hidden'}>
                        <NoteBubbles onSelectRoom={handleSelectRoom} />
                        <div className="flex-1 overflow-hidden">
                            <RoomList activeRoomId={activeRoomId} onSelectRoom={handleSelectRoom} />
                        </div>
                    </div>
                    <div className={sidebarTab === 'friends' ? 'h-full' : 'hidden'}>
                        <FriendPanel onSelectRoom={handleSelectRoom} onRequestCountChange={handleRequestCountChange} />
                    </div>
                </div>
            </div>

            {/* Chat area */}
            <div
                className={`${!showSidebar ? 'flex' : 'hidden'
                    } lg:flex flex-1 min-w-0`}
            >
                <ChatWindow roomId={activeRoomId} onBack={handleBack} onToggleInfo={handleToggleInfo} aiBotEnabled={aiBotEnabled} onAIToggle={setAiBotEnabled} autoTranslate={autoTranslate} />

                {/* Chat Info Sidebar */}
                {infoRoom && (
                    <ChatInfoSidebar
                        room={infoRoom}
                        onClose={() => setInfoRoom(null)}
                        onRoomUpdate={(updatedRoom) => {
                            if (updatedRoom === null) {
                                setActiveRoomId(null);
                                setInfoRoom(null);
                            } else {
                                setInfoRoom(updatedRoom);
                            }
                        }}
                    />
                )}
            </div>

        </div>
    );
}
