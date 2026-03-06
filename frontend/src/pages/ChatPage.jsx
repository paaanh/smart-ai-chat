import { useState } from 'react';
import { useAuth } from '../hooks/useAuth';
import RoomList from '../components/room/RoomList';
import ChatWindow from '../components/chat/ChatWindow';
import FriendPanel from '../components/friend/FriendPanel';
// CallModal + IncomingCallModal are now rendered globally in App.jsx
import { LogOut, Settings, MessageCircle, Users } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

export default function ChatPage() {
    const { user, logout } = useAuth();
    const navigate = useNavigate();
    const [activeRoomId, setActiveRoomId] = useState(null);
    const [showSidebar, setShowSidebar] = useState(true);
    const [sidebarTab, setSidebarTab] = useState('chats'); // 'chats' | 'friends'

    const handleSelectRoom = (roomId) => {
        setActiveRoomId(roomId);
        setSidebarTab('chats');
        // On mobile, hide sidebar when room selected
        if (window.innerWidth < 1024) {
            setShowSidebar(false);
        }
    };

    const handleBack = () => {
        setShowSidebar(true);
        setActiveRoomId(null);
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
                    <div className="w-9 h-9 rounded-full bg-blue-500 flex items-center justify-center text-white font-semibold text-sm">
                        {user?.username?.charAt(0).toUpperCase()}
                    </div>
                    <div className="flex-1 min-w-0">
                        <p className="font-medium text-gray-900 text-sm truncate">{user?.username}</p>
                        <p className="text-xs text-gray-400">{user?.preferredLanguageLabel || user?.preferredLanguage}</p>
                    </div>
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
                            ? 'text-blue-600 border-b-2 border-blue-600'
                            : 'text-gray-500 hover:text-gray-700'
                            }`}
                    >
                        <MessageCircle size={16} />
                        Tin nhắn
                    </button>
                    <button
                        onClick={() => setSidebarTab('friends')}
                        className={`flex-1 py-2.5 text-sm font-medium transition flex items-center justify-center gap-1.5 ${sidebarTab === 'friends'
                            ? 'text-blue-600 border-b-2 border-blue-600'
                            : 'text-gray-500 hover:text-gray-700'
                            }`}
                    >
                        <Users size={16} />
                        Bạn bè
                    </button>
                </div>

                {/* Room list or Friend panel */}
                <div className="flex-1 overflow-hidden">
                    {sidebarTab === 'chats' ? (
                        <RoomList activeRoomId={activeRoomId} onSelectRoom={handleSelectRoom} />
                    ) : (
                        <FriendPanel onSelectRoom={handleSelectRoom} />
                    )}
                </div>
            </div>

            {/* Chat area */}
            <div
                className={`${!showSidebar ? 'flex' : 'hidden'
                    } lg:flex flex-1 min-w-0`}
            >
                <ChatWindow roomId={activeRoomId} onBack={handleBack} />
            </div>

        </div>
    );
}
