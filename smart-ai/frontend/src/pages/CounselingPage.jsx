import { useEffect, useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { counselingAPI } from '../services/api';
import { ArrowLeft, HeartHandshake, ShieldAlert, Stethoscope } from 'lucide-react';
import SkeletonBlock from '../components/ui/SkeletonBlock';
import { useAuth } from '../hooks/useAuth';

export default function CounselingPage() {
    const navigate = useNavigate();
    const { user } = useAuth();
    const isExpert = ['expert', 'sub_admin', 'super_admin'].includes(user?.role);

    const [categories, setCategories] = useState([]);
    const [disclaimer, setDisclaimer] = useState('');
    const [sessions, setSessions] = useState([]);
    const [loading, setLoading] = useState(true);

    const loadBootstrap = async () => {
        setLoading(true);
        try {
            const [categoryRes, sessionRes] = await Promise.all([
                counselingAPI.getCategories(),
                counselingAPI.getSessions(),
            ]);

            setCategories(categoryRes.data.categories || []);
            setDisclaimer(categoryRes.data.disclaimer || '');
            setSessions(sessionRes.data.sessions || []);
        } catch (error) {
            console.error('Load counseling bootstrap failed:', error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        loadBootstrap();
    }, []);

    const creatingRef = useRef(false);
    const handleCreateSession = async (category) => {
        if (creatingRef.current) return;
        creatingRef.current = true;
        try {
            const { data } = await counselingAPI.createSession({
                category,
                isAnonymous: true,
            });
            navigate('/', { state: { roomId: data.roomId } });
        } catch (error) {
            console.error('Create counseling session failed:', error);
        } finally {
            creatingRef.current = false;
        }
    };

    const handleOpenSession = (roomId) => {
        if (!roomId) return;
        navigate('/', { state: { roomId } });
    };

    return (
        <div className="h-dvh flex flex-col theme-muted-surface font-sans">
            <div className="h-14 border-b px-4 flex items-center justify-between" style={{ borderColor: 'var(--border-color)', backgroundColor: 'var(--bg-card)' }}>
                <button
                    onClick={() => navigate('/')}
                    className="inline-flex items-center gap-2 text-sm transition"
                    style={{ color: 'var(--text-secondary)' }}
                >
                    <ArrowLeft size={16} />
                    Quay lại chat
                </button>
                <div className="inline-flex items-center gap-2 font-semibold" style={{ color: 'var(--color-primary)' }}>
                    <HeartHandshake size={18} />
                    Tư vấn AI & Chuyên gia
                </div>
                {isExpert ? (
                    <button
                        onClick={() => navigate('/counseling/expert')}
                        className="inline-flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-full bg-blue-600 text-white hover:bg-blue-700 transition shadow"
                    >
                        <Stethoscope size={13} /> Bảng chuyên gia
                    </button>
                ) : (
                    <div className="text-xs" style={{ color: 'var(--text-tertiary)' }}>Ẩn danh mặc định</div>
                )}
            </div>

            <div className="flex-1 min-h-0 overflow-y-auto p-4 md:p-8">
                <div className="max-w-4xl mx-auto grid grid-cols-1 md:grid-cols-2 gap-8">
                    
                    {/* Left Column: Categories */}
                    <div className="space-y-6">
                        <div className="rounded-xl p-4 border" style={{ backgroundColor: 'color-mix(in srgb, var(--color-warning) 10%, var(--bg-card))', borderColor: 'color-mix(in srgb, var(--color-warning) 30%, transparent)' }}>
                            <div className="inline-flex items-center gap-2 font-semibold text-sm mb-1.5" style={{ color: 'var(--color-warning)' }}>
                                <ShieldAlert size={16} />
                                Lưu ý quan trọng
                            </div>
                            <p className="text-sm leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
                                {disclaimer || 'AI chỉ hỗ trợ tham khảo thông tin, không thay thế chuyên gia.'}
                            </p>
                        </div>

                        <div>
                            <h3 className="text-lg font-bold mb-4" style={{ color: 'var(--text-primary)' }}>Chọn chủ đề tư vấn</h3>
                            <div className="grid gap-3">
                                {categories.map((item) => (
                                    <button
                                        key={item.key}
                                        onClick={() => handleCreateSession(item.key)}
                                        className="text-left p-4 rounded-xl border transition hover:-translate-y-0.5"
                                        style={{ 
                                            backgroundColor: 'var(--bg-card)', 
                                            borderColor: 'var(--border-color)'
                                        }}
                                        onMouseEnter={(e) => {
                                            e.currentTarget.style.borderColor = 'var(--color-primary)';
                                            e.currentTarget.style.boxShadow = '0 4px 12px rgba(0,0,0,0.05)';
                                        }}
                                        onMouseLeave={(e) => {
                                            e.currentTarget.style.borderColor = 'var(--border-color)';
                                            e.currentTarget.style.boxShadow = 'none';
                                        }}
                                    >
                                        <p className="font-semibold text-[15px] mb-1" style={{ color: 'var(--text-primary)' }}>{item.title}</p>
                                        <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>{item.description}</p>
                                    </button>
                                ))}
                            </div>
                        </div>
                    </div>

                    {/* Right Column: Active Sessions */}
                    <div>
                        <h3 className="text-lg font-bold mb-4" style={{ color: 'var(--text-primary)' }}>Phiên tư vấn của bạn</h3>
                        <div className="space-y-3">
                            {loading ? (
                                Array.from({ length: 3 }).map((_, i) => (
                                    <SkeletonBlock key={i} className="h-20 w-full rounded-xl" />
                                ))
                            ) : sessions.length === 0 ? (
                                <div className="text-center p-8 rounded-xl border border-dashed" style={{ borderColor: 'var(--border-color)', color: 'var(--text-tertiary)' }}>
                                    Bạn chưa có phiên tư vấn nào.
                                </div>
                            ) : (
                                sessions.map((session) => (
                                    <button
                                        key={session._id}
                                        onClick={() => handleOpenSession(session.room?._id)}
                                        className="w-full text-left p-4 rounded-xl border transition hover:bg-black/5 dark:hover:bg-white/5"
                                        style={{ backgroundColor: 'var(--bg-card)', borderColor: 'var(--border-color)' }}
                                    >
                                        <div className="flex items-start justify-between mb-2">
                                            <p className="font-semibold text-[15px] truncate pr-3" style={{ color: 'var(--color-primary)' }}>
                                                {session.title || 'Phiên tư vấn'}
                                            </p>
                                            <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase shrink-0 ${session.status === 'active' ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400' : 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400'}`}>
                                                {session.status === 'active' ? 'Đang mở' : 'Đã đóng'}
                                            </span>
                                        </div>
                                        <div className="flex items-center gap-4 text-xs" style={{ color: 'var(--text-secondary)' }}>
                                            <span>Danh mục: {categories.find(c => c.key === session.category)?.title || session.category}</span>
                                            {session.expert && (
                                                <span className="inline-flex items-center gap-1 text-[var(--color-primary)]">
                                                    <HeartHandshake size={12} /> Có chuyên gia
                                                </span>
                                            )}
                                        </div>
                                    </button>
                                ))
                            )}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
