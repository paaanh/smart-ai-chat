import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { counselingAPI } from '../services/api';
import { ArrowLeft, HeartHandshake, Send, ShieldAlert, PhoneCall } from 'lucide-react';

export default function CounselingPage() {
    const navigate = useNavigate();

    const [categories, setCategories] = useState([]);
    const [hotlines, setHotlines] = useState([]);
    const [disclaimer, setDisclaimer] = useState('');

    const [sessions, setSessions] = useState([]);
    const [activeSessionId, setActiveSessionId] = useState(null);
    const [activeSession, setActiveSession] = useState(null);

    const [draft, setDraft] = useState('');
    const [loading, setLoading] = useState(true);
    const [sending, setSending] = useState(false);

    const activeCategoryTitle = useMemo(() => {
        const found = categories.find((item) => item.key === activeSession?.category);
        return found?.title || 'Tư vấn hỗ trợ';
    }, [categories, activeSession?.category]);

    const loadBootstrap = async () => {
        setLoading(true);
        try {
            const [categoryRes, sessionRes] = await Promise.all([
                counselingAPI.getCategories(),
                counselingAPI.getSessions(),
            ]);

            setCategories(categoryRes.data.categories || []);
            setHotlines(categoryRes.data.hotlines || []);
            setDisclaimer(categoryRes.data.disclaimer || '');

            const list = sessionRes.data.sessions || [];
            setSessions(list);
            if (list.length > 0) {
                setActiveSessionId(list[0]._id);
            }
        } catch (error) {
            console.error('Load counseling bootstrap failed:', error);
        } finally {
            setLoading(false);
        }
    };

    const loadSession = async (sessionId) => {
        if (!sessionId) return;
        try {
            const { data } = await counselingAPI.getSession(sessionId);
            setActiveSession(data.session || null);
        } catch (error) {
            console.error('Load counseling session failed:', error);
        }
    };

    useEffect(() => {
        loadBootstrap();
    }, []);

    useEffect(() => {
        loadSession(activeSessionId);
    }, [activeSessionId]);

    const handleCreateSession = async (category) => {
        try {
            const { data } = await counselingAPI.createSession({
                category,
                isAnonymous: true,
            });

            const newSession = data.session;
            setSessions((prev) => [
                {
                    _id: newSession._id,
                    category: newSession.category,
                    title: newSession.title || 'Phiên tư vấn mới',
                    status: newSession.status,
                    isAnonymous: newSession.isAnonymous,
                    messageCount: newSession.messages?.length || 0,
                    lastMessage: newSession.messages?.[newSession.messages.length - 1],
                    updatedAt: newSession.updatedAt,
                },
                ...prev,
            ]);
            setActiveSessionId(newSession._id);
            setActiveSession(newSession);
        } catch (error) {
            console.error('Create counseling session failed:', error);
        }
    };

    const handleSend = async () => {
        const content = draft.trim();
        if (!activeSessionId || !content || sending) return;

        setSending(true);
        setDraft('');
        try {
            const { data } = await counselingAPI.sendMessage(activeSessionId, content);
            setActiveSession(data.session || null);

            setSessions((prev) => prev.map((item) => {
                if (item._id !== activeSessionId) return item;
                const updated = data.session;
                return {
                    ...item,
                    title: updated.title || item.title,
                    status: updated.status,
                    messageCount: updated.messages?.length || item.messageCount,
                    lastMessage: updated.messages?.[updated.messages.length - 1] || item.lastMessage,
                    updatedAt: updated.updatedAt,
                };
            }));
        } catch (error) {
            console.error('Send counseling message failed:', error);
            setDraft(content);
        } finally {
            setSending(false);
        }
    };

    const handleCloseSession = async () => {
        if (!activeSessionId) return;
        try {
            const { data } = await counselingAPI.closeSession(activeSessionId);
            setActiveSession(data.session);
            setSessions((prev) => prev.map((item) => (
                item._id === activeSessionId
                    ? { ...item, status: 'closed' }
                    : item
            )));
        } catch (error) {
            console.error('Close counseling session failed:', error);
        }
    };

    return (
        <div className="h-dvh bg-linear-to-br from-emerald-50 via-orange-50 to-white flex flex-col">
            <div className="h-14 border-b border-emerald-100 bg-white/80 backdrop-blur px-4 flex items-center justify-between">
                <button
                    onClick={() => navigate('/')}
                    className="inline-flex items-center gap-2 text-sm text-gray-600 hover:text-gray-900"
                >
                    <ArrowLeft size={16} />
                    Quay lại chat
                </button>
                <div className="inline-flex items-center gap-2 text-emerald-700 font-semibold">
                    <HeartHandshake size={18} />
                    Tư vấn hỗ trợ
                </div>
                <div className="text-xs text-gray-500">Ẩn danh mặc định</div>
            </div>

            <div className="flex-1 min-h-0 grid grid-cols-1 md:grid-cols-[320px_1fr]">
                <aside className="border-r border-emerald-100 bg-white/80 backdrop-blur p-3 overflow-y-auto">
                    <div className="rounded-xl bg-amber-50 border border-amber-200 p-3 mb-3">
                        <div className="inline-flex items-center gap-2 text-amber-700 font-semibold text-sm mb-1">
                            <ShieldAlert size={15} />
                            Lưu ý quan trọng
                        </div>
                        <p className="text-xs text-amber-700 leading-relaxed">
                            {disclaimer || 'AI chỉ hỗ trợ tham khảo thông tin, không thay thế chuyên gia.'}
                        </p>
                    </div>

                    <h3 className="text-sm font-semibold text-gray-700 mb-2">Bắt đầu phiên mới</h3>
                    <div className="space-y-2 mb-4">
                        {categories.map((item) => (
                            <button
                                key={item.key}
                                onClick={() => handleCreateSession(item.key)}
                                className="w-full text-left p-2.5 rounded-lg border border-emerald-100 hover:border-emerald-300 hover:bg-emerald-50 transition"
                            >
                                <p className="text-sm font-medium text-gray-800">{item.title}</p>
                                <p className="text-xs text-gray-500 mt-0.5">{item.description}</p>
                            </button>
                        ))}
                    </div>

                    <h3 className="text-sm font-semibold text-gray-700 mb-2">Phiên đã tạo</h3>
                    <div className="space-y-2 mb-4">
                        {loading && <p className="text-sm text-gray-400">Đang tải phiên tư vấn...</p>}
                        {!loading && sessions.length === 0 && (
                            <p className="text-sm text-gray-400">Bạn chưa có phiên tư vấn nào.</p>
                        )}
                        {sessions.map((session) => (
                            <button
                                key={session._id}
                                onClick={() => setActiveSessionId(session._id)}
                                className={`w-full text-left p-2.5 rounded-lg border transition ${
                                    activeSessionId === session._id
                                        ? 'border-emerald-400 bg-emerald-50'
                                        : 'border-gray-200 hover:border-gray-300 bg-white'
                                }`}
                            >
                                <p className="text-sm font-medium text-gray-800 truncate">{session.title || 'Phiên tư vấn'}</p>
                                <p className="text-xs text-gray-500 mt-0.5 truncate">{session.lastMessage?.content || 'Chưa có tin nhắn'}</p>
                                <p className="text-[11px] mt-1 text-gray-400">
                                    {session.status === 'closed' ? 'Đã đóng' : 'Đang hoạt động'}
                                </p>
                            </button>
                        ))}
                    </div>

                    <h3 className="text-sm font-semibold text-gray-700 mb-2">Đường dây nóng</h3>
                    <div className="space-y-2">
                        {hotlines.map((item) => (
                            <div key={item.phone} className="rounded-lg border border-orange-200 bg-orange-50 p-2.5">
                                <p className="text-xs text-orange-700">{item.name}</p>
                                <p className="text-sm font-semibold text-orange-800 inline-flex items-center gap-1">
                                    <PhoneCall size={13} />
                                    {item.phone}
                                </p>
                            </div>
                        ))}
                    </div>
                </aside>

                <section className="min-h-0 flex flex-col">
                    <div className="h-14 border-b border-gray-100 px-4 flex items-center justify-between bg-white/60">
                        <div>
                            <p className="text-sm text-gray-500">Danh mục</p>
                            <h2 className="font-semibold text-gray-800">{activeCategoryTitle}</h2>
                        </div>
                        {activeSession && activeSession.status !== 'closed' && (
                            <button
                                onClick={handleCloseSession}
                                className="text-xs px-3 py-1.5 rounded-full border border-gray-300 text-gray-600 hover:bg-gray-50"
                            >
                                Đóng phiên
                            </button>
                        )}
                    </div>

                    <div className="flex-1 min-h-0 overflow-y-auto px-4 py-3 space-y-3 bg-white/40">
                        {!activeSession && (
                            <div className="h-full flex items-center justify-center text-gray-400 text-sm">
                                Hãy chọn một phiên hoặc tạo phiên tư vấn mới.
                            </div>
                        )}
                        {(activeSession?.messages || []).map((msg, idx) => (
                            <div
                                key={`${msg.timestamp || idx}-${idx}`}
                                className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
                            >
                                <div className={`max-w-[85%] rounded-2xl px-3 py-2 text-sm ${
                                    msg.role === 'user'
                                        ? 'bg-emerald-600 text-white'
                                        : msg.role === 'assistant'
                                            ? 'bg-white border border-emerald-100 text-gray-800'
                                            : 'bg-amber-50 border border-amber-200 text-amber-800'
                                }`}>
                                    <p className="whitespace-pre-wrap leading-relaxed">{msg.content}</p>
                                </div>
                            </div>
                        ))}
                    </div>

                    <div className="border-t border-gray-200 p-3 bg-white/80">
                        <div className="flex items-end gap-2">
                            <textarea
                                value={draft}
                                onChange={(e) => setDraft(e.target.value)}
                                onKeyDown={(e) => {
                                    if (e.key === 'Enter' && !e.shiftKey) {
                                        e.preventDefault();
                                        handleSend();
                                    }
                                }}
                                rows={2}
                                disabled={!activeSession || activeSession.status === 'closed' || sending}
                                className="flex-1 resize-none rounded-xl border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-300 disabled:bg-gray-100"
                                placeholder={activeSession?.status === 'closed' ? 'Phiên đã đóng' : 'Nhập câu hỏi của bạn...'}
                            />
                            <button
                                onClick={handleSend}
                                disabled={!activeSession || activeSession.status === 'closed' || !draft.trim() || sending}
                                className="h-10 w-10 rounded-full bg-emerald-600 text-white flex items-center justify-center disabled:opacity-40"
                                title="Gửi"
                            >
                                <Send size={16} />
                            </button>
                        </div>
                    </div>
                </section>
            </div>
        </div>
    );
}
