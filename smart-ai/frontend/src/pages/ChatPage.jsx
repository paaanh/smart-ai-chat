import { useState, useCallback } from 'react';
import { useAuth } from '../hooks/useAuth';
import { useAI } from '../hooks/useAI';
import RoomList from '../components/room/RoomList';
import ChatWindow from '../components/chat/ChatWindow';
import ChatInfoSidebar from '../components/chat/ChatInfoSidebar';
import FriendPanel from '../components/friend/FriendPanel';
import MiniAIChatBox from '../components/chat/MiniAIChatBox';
import NoteBubbles from '../components/chat/NoteBubbles';
import ThemedSurface from '../components/ui/ThemedSurface';
import SkeletonBlock from '../components/ui/SkeletonBlock';
// CallModal + IncomingCallModal are now rendered globally in App.jsx
import { LogOut, Settings, MessageCircle, Users, ShieldCheck } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useLanguage } from '../hooks/useLanguage';

export default function ChatPage() {
    const { user, logout } = useAuth();
    const { t } = useLanguage();
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
        if (window.innerWidth < 768) {
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
        <div className="h-dvh min-h-0 flex theme-muted-surface theme-page-enter overflow-hidden">
            {/* Sidebar */}
            <ThemedSurface
                className={`${showSidebar ? 'flex' : 'hidden'
                    } md:flex flex-col w-full md:w-80 xl:w-96 shrink-0 min-h-0`}
                elevated
            >
                {/* User bar */}
                <div
                    className="border-b border-gray-200 px-4 py-3 flex items-center gap-3"
                    style={{
                        backgroundColor: 'var(--bg-card)',
                        borderColor: 'var(--border-color)',
                    }}
                >
                    {user ? (
                        <>
                            <div
                                className="w-9 h-9 rounded-full bg-[var(--color-primary)] flex items-center justify-center text-white font-semibold text-sm cursor-pointer hover:ring-2 hover:ring-[var(--color-primary-ring)] transition overflow-hidden shrink-0"
                                onClick={() => navigate(`/profile/${user?._id}`)}
                                title={t('common.profile')}
                            >
                                {user?.avatar ? (
                                    <img src={user.avatar} alt={user.username} className="w-full h-full object-cover" />
                                ) : (
                                    user?.username?.charAt(0).toUpperCase()
                                )}
                            </div>
                            <div className="flex-1 min-w-0 flex flex-col gap-0.5">
                                <p className="font-medium text-sm truncate leading-tight" style={{ color: 'var(--text-primary)' }}>{user?.username}</p>
                                <p className="text-xs leading-tight" style={{ color: 'var(--text-secondary)' }}>{user?.preferredLanguageLabel || user?.preferredLanguage}</p>
                            </div>
                        </>
                    ) : (
                        <>
                            <SkeletonBlock className="w-9 h-9 rounded-full shrink-0" />
                            <div className="flex-1 min-w-0 space-y-1">
                                <SkeletonBlock className="h-3.5 w-28 rounded-md" />
                                <SkeletonBlock className="h-3 w-16 rounded-md" />
                            </div>
                        </>
                    )}
                    {user?.role && user.role !== 'user' && (
                        <button
                            onClick={() => navigate('/admin')}
                            className="p-1.5 rounded-full transition"
                            style={{ color: 'var(--color-primary)' }}
                            title={t('chatPage.adminDashboard')}
                        >
                            <ShieldCheck size={18} />
                        </button>
                    )}
                    <button
                        onClick={() => navigate('/settings')}
                        className="p-1.5 rounded-full transition"
                        style={{ color: 'var(--text-secondary)' }}
                        title={t('chatPage.settings')}
                    >
                        <Settings size={18} />
                    </button>
                    <button
                        onClick={logout}
                        className="p-1.5 rounded-full transition"
                        style={{ color: 'var(--text-secondary)' }}
                        title={t('chatPage.logout')}
                    >
                        <LogOut size={18} />
                    </button>
                </div>

                {/* Sidebar Tabs */}
                <div
                    className="border-b border-gray-200 flex"
                    style={{
                        backgroundColor: 'var(--bg-card)',
                        borderColor: 'var(--border-color)',
                    }}
                >
                    <button
                        onClick={() => setSidebarTab('chats')}
                        className={`flex-1 py-2.5 text-sm font-medium transition flex items-center justify-center gap-1.5 ${sidebarTab === 'chats'
                            ? 'text-[var(--color-primary)] border-b-2 border-[var(--color-primary)]'
                            : 'hover:opacity-90'
                            }`}
                        style={sidebarTab === 'chats' ? undefined : { color: 'var(--text-secondary)' }}
                    >
                        <MessageCircle size={16} />
                        {t('chatPage.messages')}
                    </button>
                    <button
                        onClick={() => setSidebarTab('friends')}
                        className={`flex-1 py-2.5 text-sm font-medium transition flex items-center justify-center gap-1.5 relative ${sidebarTab === 'friends'
                            ? 'text-[var(--color-primary)] border-b-2 border-[var(--color-primary)]'
                            : 'hover:opacity-90'
                            }`}
                        style={sidebarTab === 'friends' ? undefined : { color: 'var(--text-secondary)' }}
                    >
                        <Users size={16} />
                        {t('chatPage.friends')}
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
                <div className="flex-1 min-h-0 overflow-hidden">
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
            </ThemedSurface>

            {/* Chat area */}
            <div
                className={`${!showSidebar ? 'flex' : 'hidden'
                    } md:flex flex-1 min-w-0 min-h-0`}
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
