import { useCallback, useEffect, useMemo, useState } from 'react';
import { topicAPI } from '../../services/api';
import { Compass, Plus, Users, Search, Loader2 } from 'lucide-react';

const CATEGORY_OPTIONS = [
    { value: '', label: 'Tất cả' },
    { value: 'tam_ly', label: 'Tâm lý' },
    { value: 'suc_khoe', label: 'Sức khỏe' },
    { value: 'phap_luat', label: 'Pháp luật' },
    { value: 'giao_duc', label: 'Giáo dục' },
    { value: 'cong_nghe', label: 'Công nghệ' },
    { value: 'giai_tri', label: 'Giải trí' },
];

export default function TopicPanel({ onSelectRoom }) {
    const [topics, setTopics] = useState([]);
    const [myTopics, setMyTopics] = useState([]);
    const [loading, setLoading] = useState(true);
    const [joiningId, setJoiningId] = useState(null);

    const [q, setQ] = useState('');
    const [category, setCategory] = useState('');

    const [creating, setCreating] = useState(false);
    const [showCreate, setShowCreate] = useState(false);
    const [createForm, setCreateForm] = useState({
        title: '',
        description: '',
        category: 'tam_ly',
        tags: '',
    });

    const loadTopics = useCallback(async () => {
        setLoading(true);
        try {
            const [publicRes, mineRes] = await Promise.all([
                topicAPI.getAll({ category }),
                topicAPI.getMyTopics(),
            ]);
            setTopics(publicRes.data.topics || []);
            setMyTopics(mineRes.data.topics || []);
        } catch (error) {
            console.error('Load topics failed:', error);
        } finally {
            setLoading(false);
        }
    }, [category]);

    useEffect(() => {
        loadTopics();
    }, [loadTopics]);

    const filteredTopics = useMemo(() => {
        if (!q.trim()) return topics;
        const needle = q.trim().toLowerCase();
        return topics.filter((item) => {
            return item.title?.toLowerCase().includes(needle)
                || item.description?.toLowerCase().includes(needle)
                || (item.tags || []).some((tag) => String(tag).toLowerCase().includes(needle));
        });
    }, [topics, q]);

    const handleJoinTopic = async (topic) => {
        try {
            setJoiningId(topic._id);
            const { data } = await topicAPI.join(topic._id);
            onSelectRoom?.(data.roomId || topic.room?._id);
            await loadTopics();
        } catch (error) {
            console.error('Join topic failed:', error);
        } finally {
            setJoiningId(null);
        }
    };

    const handleCreateTopic = async () => {
        if (!createForm.title.trim() || !createForm.category) return;
        try {
            setCreating(true);
            const { data } = await topicAPI.create({
                title: createForm.title.trim(),
                description: createForm.description.trim(),
                category: createForm.category,
                tags: createForm.tags,
            });

            setShowCreate(false);
            setCreateForm({ title: '', description: '', category: 'tam_ly', tags: '' });
            await loadTopics();
            if (data.topic?.room?._id) {
                onSelectRoom?.(data.topic.room._id);
            }
        } catch (error) {
            console.error('Create topic failed:', error);
        } finally {
            setCreating(false);
        }
    };

    return (
        <div className="h-full flex flex-col border-r border-gray-200 bg-white">
            <div className="p-4 border-b border-gray-100">
                <div className="flex items-center justify-between mb-3">
                    <h2 className="text-xl font-bold text-gray-900 inline-flex items-center gap-2">
                        <Compass size={18} />
                        Chủ đề
                    </h2>
                    <button
                        onClick={() => setShowCreate((prev) => !prev)}
                        className="p-2 rounded-full text-[var(--color-primary)] bg-[var(--color-primary-light)] hover:bg-[var(--color-primary-medium)]"
                        title="Tạo phòng chủ đề"
                    >
                        <Plus size={16} />
                    </button>
                </div>

                <div className="relative mb-2">
                    <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                    <input
                        value={q}
                        onChange={(e) => setQ(e.target.value)}
                        placeholder="Tìm theo tiêu đề hoặc tag"
                        className="w-full pl-8 pr-3 py-2 bg-gray-100 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-primary-ring)]"
                    />
                </div>

                <select
                    value={category}
                    onChange={(e) => setCategory(e.target.value)}
                    className="w-full bg-gray-100 rounded-lg text-sm px-3 py-2 focus:outline-none"
                >
                    {CATEGORY_OPTIONS.map((option) => (
                        <option key={option.value} value={option.value}>{option.label}</option>
                    ))}
                </select>
            </div>

            {showCreate && (
                <div className="p-3 border-b border-gray-100 bg-gray-50 space-y-2">
                    <input
                        value={createForm.title}
                        onChange={(e) => setCreateForm((prev) => ({ ...prev, title: e.target.value }))}
                        placeholder="Tên phòng chủ đề"
                        className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
                    />
                    <textarea
                        value={createForm.description}
                        onChange={(e) => setCreateForm((prev) => ({ ...prev, description: e.target.value }))}
                        placeholder="Mô tả ngắn"
                        rows={2}
                        className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm resize-none"
                    />
                    <div className="grid grid-cols-2 gap-2">
                        <select
                            value={createForm.category}
                            onChange={(e) => setCreateForm((prev) => ({ ...prev, category: e.target.value }))}
                            className="border border-gray-300 rounded-lg px-2 py-2 text-sm"
                        >
                            {CATEGORY_OPTIONS.filter((x) => x.value).map((option) => (
                                <option key={option.value} value={option.value}>{option.label}</option>
                            ))}
                        </select>
                        <input
                            value={createForm.tags}
                            onChange={(e) => setCreateForm((prev) => ({ ...prev, tags: e.target.value }))}
                            placeholder="tags, cách, dấu, phẩy"
                            className="border border-gray-300 rounded-lg px-2 py-2 text-sm"
                        />
                    </div>
                    <button
                        onClick={handleCreateTopic}
                        disabled={creating || !createForm.title.trim()}
                        className="w-full py-2 rounded-lg bg-[var(--color-primary)] text-white text-sm font-medium disabled:opacity-50"
                    >
                        {creating ? 'Đang tạo...' : 'Tạo phòng chủ đề'}
                    </button>
                </div>
            )}

            <div className="flex-1 overflow-y-auto">
                {loading && (
                    <div className="py-8 text-center text-gray-400 text-sm">
                        <Loader2 size={16} className="animate-spin mx-auto mb-2" />
                        Đang tải chủ đề...
                    </div>
                )}

                {!loading && myTopics.length > 0 && (
                    <div className="p-3 border-b border-gray-100">
                        <p className="text-xs font-semibold text-gray-400 uppercase mb-2">Chủ đề của bạn</p>
                        <div className="space-y-2">
                            {myTopics.map((topic) => (
                                <button
                                    key={topic._id}
                                    onClick={() => onSelectRoom?.(topic.room?._id)}
                                    className="w-full text-left p-2.5 rounded-lg bg-emerald-50 border border-emerald-100 hover:bg-emerald-100 transition"
                                >
                                    <p className="text-sm font-medium text-emerald-800 truncate">{topic.title}</p>
                                    <p className="text-xs text-emerald-600 truncate">{topic.description || 'Không có mô tả'}</p>
                                </button>
                            ))}
                        </div>
                    </div>
                )}

                {!loading && (
                    <div className="p-3 space-y-2">
                        {filteredTopics.length === 0 && (
                            <div className="py-8 text-center text-gray-400 text-sm">
                                Không có phòng chủ đề phù hợp.
                            </div>
                        )}

                        {filteredTopics.map((topic) => (
                            <div key={topic._id} className="p-3 rounded-xl border border-gray-200 hover:border-gray-300 transition">
                                <div className="flex items-start justify-between gap-2">
                                    <div className="min-w-0">
                                        <p className="text-sm font-semibold text-gray-800 truncate">{topic.title}</p>
                                        <p className="text-xs text-gray-500 mt-0.5 line-clamp-2">{topic.description || 'Không có mô tả'}</p>
                                    </div>
                                    <button
                                        onClick={() => handleJoinTopic(topic)}
                                        disabled={joiningId === topic._id}
                                        className="shrink-0 px-3 py-1.5 rounded-full text-xs font-medium bg-[var(--color-primary-light)] text-[var(--color-primary)] hover:bg-[var(--color-primary-medium)] disabled:opacity-50"
                                    >
                                        {joiningId === topic._id ? 'Đang vào...' : (topic.isJoined ? 'Mở chat' : 'Tham gia')}
                                    </button>
                                </div>

                                <div className="flex items-center justify-between mt-2">
                                    <div className="flex flex-wrap gap-1">
                                        {(topic.tags || []).slice(0, 3).map((tag) => (
                                            <span key={tag} className="text-[11px] px-2 py-0.5 rounded-full bg-gray-100 text-gray-500">#{tag}</span>
                                        ))}
                                    </div>
                                    <span className="text-[11px] text-gray-400 inline-flex items-center gap-1">
                                        <Users size={12} />
                                        {topic.memberCount || topic.room?.members?.length || 0}
                                    </span>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
}
