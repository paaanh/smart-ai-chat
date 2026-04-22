import { useCallback, useEffect, useMemo, useState } from 'react';
import { topicAPI } from '../../services/api';
import { useTheme } from '../../hooks/useTheme';
import { useAuth } from '../../hooks/useAuth';
import { Compass, Plus, Users, Search, Loader2, Pencil, Check, X } from 'lucide-react';

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
    const { themeId } = useTheme();
    const { user } = useAuth();
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

    // Inline edit state
    const [editingTopicId, setEditingTopicId] = useState(null);
    const [editForm, setEditForm] = useState({ title: '', description: '' });
    const [savingEdit, setSavingEdit] = useState(false);

    const isGlassTheme = themeId === 'glassmorphism' || themeId === 'neon-night';
    const isPixelTheme = themeId === 'pixel-art';

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

    const startEditing = (topic) => {
        setEditingTopicId(topic._id);
        setEditForm({ title: topic.title || '', description: topic.description || '' });
    };

    const cancelEditing = () => {
        setEditingTopicId(null);
        setEditForm({ title: '', description: '' });
    };

    const handleUpdateSettings = async () => {
        if (!editingTopicId || !editForm.title.trim()) return;
        try {
            setSavingEdit(true);
            await topicAPI.updateSettings(editingTopicId, {
                title: editForm.title.trim(),
                description: editForm.description.trim(),
            });
            setEditingTopicId(null);
            await loadTopics();
        } catch (error) {
            console.error('Update topic settings failed:', error);
        } finally {
            setSavingEdit(false);
        }
    };

    const canEditTopic = (topic) => {
        if (!user?._id) return false;
        // Creator
        if (topic.creator?._id === user._id || topic.creator === user._id) return true;
        // Admin in room
        const memberEntry = topic.room?.members?.find((m) => {
            const uid = m.user?._id || m.user;
            return uid === user._id;
        });
        return memberEntry?.role === 'admin';
    };

    return (
        <div
            className={`h-full flex flex-col ${isGlassTheme ? 'glass-panel' : ''} ${isPixelTheme ? 'font-pixel' : ''}`}
            style={{
                backgroundColor: 'var(--bg-card)',
                borderColor: 'var(--border-color)',
            }}
        >
            <div
                className="p-4 border-b"
                style={{
                    borderColor: 'var(--border-color)',
                    backgroundColor: isGlassTheme ? 'rgba(255,255,255,0.05)' : undefined,
                }}
            >
                <div className="flex items-center justify-between mb-3">
                    <h2
                        className="text-xl font-bold inline-flex items-center gap-2"
                        style={{ color: 'var(--text-primary)' }}
                    >
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
                    <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: 'var(--text-tertiary)' }} />
                    <input
                        value={q}
                        onChange={(e) => setQ(e.target.value)}
                        placeholder="Tìm theo tiêu đề hoặc tag"
                        className="w-full pl-8 pr-3 py-2 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-primary-ring)]"
                        style={{
                            backgroundColor: 'var(--bg-secondary)',
                            color: 'var(--text-primary)',
                            borderColor: 'var(--border-color)',
                        }}
                    />
                </div>

                <select
                    value={category}
                    onChange={(e) => setCategory(e.target.value)}
                    className="w-full rounded-lg text-sm px-3 py-2 focus:outline-none"
                    style={{
                        backgroundColor: 'var(--bg-secondary)',
                        color: 'var(--text-primary)',
                    }}
                >
                    {CATEGORY_OPTIONS.map((option) => (
                        <option key={option.value} value={option.value}>{option.label}</option>
                    ))}
                </select>
            </div>

            {showCreate && (
                <div
                    className="p-3 border-b space-y-2"
                    style={{
                        borderColor: 'var(--border-color)',
                        backgroundColor: 'var(--bg-secondary)',
                    }}
                >
                    <input
                        value={createForm.title}
                        onChange={(e) => setCreateForm((prev) => ({ ...prev, title: e.target.value }))}
                        placeholder="Tên phòng chủ đề"
                        className="w-full border rounded-lg px-3 py-2 text-sm"
                        style={{
                            borderColor: 'var(--border-color)',
                            backgroundColor: 'var(--bg-input, var(--bg-card))',
                            color: 'var(--text-primary)',
                        }}
                    />
                    <textarea
                        value={createForm.description}
                        onChange={(e) => setCreateForm((prev) => ({ ...prev, description: e.target.value }))}
                        placeholder="Mô tả ngắn"
                        rows={2}
                        className="w-full border rounded-lg px-3 py-2 text-sm resize-none"
                        style={{
                            borderColor: 'var(--border-color)',
                            backgroundColor: 'var(--bg-input, var(--bg-card))',
                            color: 'var(--text-primary)',
                        }}
                    />
                    <div className="grid grid-cols-2 gap-2">
                        <select
                            value={createForm.category}
                            onChange={(e) => setCreateForm((prev) => ({ ...prev, category: e.target.value }))}
                            className="border rounded-lg px-2 py-2 text-sm"
                            style={{
                                borderColor: 'var(--border-color)',
                                backgroundColor: 'var(--bg-input, var(--bg-card))',
                                color: 'var(--text-primary)',
                            }}
                        >
                            {CATEGORY_OPTIONS.filter((x) => x.value).map((option) => (
                                <option key={option.value} value={option.value}>{option.label}</option>
                            ))}
                        </select>
                        <input
                            value={createForm.tags}
                            onChange={(e) => setCreateForm((prev) => ({ ...prev, tags: e.target.value }))}
                            placeholder="tags, cách, dấu, phẩy"
                            className="border rounded-lg px-2 py-2 text-sm"
                            style={{
                                borderColor: 'var(--border-color)',
                                backgroundColor: 'var(--bg-input, var(--bg-card))',
                                color: 'var(--text-primary)',
                            }}
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
                    <div className="py-8 text-center text-sm" style={{ color: 'var(--text-tertiary)' }}>
                        <Loader2 size={16} className="animate-spin mx-auto mb-2" />
                        Đang tải chủ đề...
                    </div>
                )}

                {!loading && myTopics.length > 0 && (
                    <div
                        className="p-3 border-b"
                        style={{ borderColor: 'var(--border-color)' }}
                    >
                        <p
                            className="text-xs font-semibold uppercase mb-2"
                            style={{ color: 'var(--text-tertiary)' }}
                        >
                            Chủ đề của bạn
                        </p>
                        <div className="space-y-2">
                            {myTopics.map((topic) => (
                                <div key={topic._id}>
                                    {editingTopicId === topic._id ? (
                                        /* Inline edit form */
                                        <div
                                            className="p-2.5 rounded-lg border space-y-2"
                                            style={{
                                                borderColor: 'var(--color-primary)',
                                                backgroundColor: 'var(--bg-secondary)',
                                            }}
                                        >
                                            <input
                                                value={editForm.title}
                                                onChange={(e) => setEditForm((prev) => ({ ...prev, title: e.target.value }))}
                                                placeholder="Tên phòng"
                                                className="w-full border rounded-md px-2 py-1.5 text-sm"
                                                style={{
                                                    borderColor: 'var(--border-color)',
                                                    backgroundColor: 'var(--bg-input, var(--bg-card))',
                                                    color: 'var(--text-primary)',
                                                }}
                                                autoFocus
                                                onKeyDown={(e) => {
                                                    if (e.key === 'Enter') handleUpdateSettings();
                                                    if (e.key === 'Escape') cancelEditing();
                                                }}
                                            />
                                            <input
                                                value={editForm.description}
                                                onChange={(e) => setEditForm((prev) => ({ ...prev, description: e.target.value }))}
                                                placeholder="Mô tả"
                                                className="w-full border rounded-md px-2 py-1.5 text-xs"
                                                style={{
                                                    borderColor: 'var(--border-color)',
                                                    backgroundColor: 'var(--bg-input, var(--bg-card))',
                                                    color: 'var(--text-primary)',
                                                }}
                                                onKeyDown={(e) => {
                                                    if (e.key === 'Enter') handleUpdateSettings();
                                                    if (e.key === 'Escape') cancelEditing();
                                                }}
                                            />
                                            <div className="flex justify-end gap-1.5">
                                                <button
                                                    onClick={cancelEditing}
                                                    className="p-1 rounded-md transition"
                                                    style={{ color: 'var(--text-secondary)' }}
                                                    title="Hủy"
                                                >
                                                    <X size={14} />
                                                </button>
                                                <button
                                                    onClick={handleUpdateSettings}
                                                    disabled={savingEdit || !editForm.title.trim()}
                                                    className="p-1 rounded-md text-white disabled:opacity-50"
                                                    style={{ backgroundColor: 'var(--color-primary)' }}
                                                    title="Lưu"
                                                >
                                                    {savingEdit ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />}
                                                </button>
                                            </div>
                                        </div>
                                    ) : (
                                        /* Normal display */
                                        <div className="flex items-center gap-1">
                                            <button
                                                onClick={() => onSelectRoom?.(topic.room?._id)}
                                                className={`flex-1 text-left p-2.5 rounded-lg border transition ${isGlassTheme
                                                    ? 'bg-white/10 border-white/20 hover:bg-white/20'
                                                    : ''
                                                }`}
                                                style={isGlassTheme ? undefined : {
                                                    backgroundColor: 'color-mix(in srgb, var(--color-primary) 8%, var(--bg-card))',
                                                    borderColor: 'color-mix(in srgb, var(--color-primary) 20%, var(--border-color))',
                                                }}
                                            >
                                                <p
                                                    className="text-sm font-medium truncate"
                                                    style={{ color: 'var(--color-primary)' }}
                                                >
                                                    {topic.title}
                                                </p>
                                                <p
                                                    className="text-xs truncate"
                                                    style={{ color: 'var(--text-secondary)' }}
                                                >
                                                    {topic.description || 'Không có mô tả'}
                                                </p>
                                            </button>
                                            {canEditTopic(topic) && (
                                                <button
                                                    onClick={() => startEditing(topic)}
                                                    className="p-1.5 rounded-full transition shrink-0"
                                                    style={{ color: 'var(--text-secondary)' }}
                                                    title="Đổi tên"
                                                >
                                                    <Pencil size={13} />
                                                </button>
                                            )}
                                        </div>
                                    )}
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                {!loading && (
                    <div className="p-3 space-y-2">
                        {filteredTopics.length === 0 && (
                            <div className="py-8 text-center text-sm" style={{ color: 'var(--text-tertiary)' }}>
                                Không có phòng chủ đề phù hợp.
                            </div>
                        )}

                        {filteredTopics.map((topic) => (
                            <div
                                key={topic._id}
                                className={`p-3 rounded-xl border transition ${isGlassTheme
                                    ? 'bg-white/5 border-white/10 hover:bg-white/15 hover:border-white/25'
                                    : ''
                                }`}
                                style={isGlassTheme ? undefined : {
                                    borderColor: 'var(--border-color)',
                                    backgroundColor: 'var(--bg-card)',
                                }}
                            >
                                <div className="flex items-start justify-between gap-2">
                                    <div className="min-w-0">
                                        <p
                                            className="text-sm font-semibold truncate"
                                            style={{ color: 'var(--text-primary)' }}
                                        >
                                            {topic.title}
                                        </p>
                                        <p
                                            className="text-xs mt-0.5 line-clamp-2"
                                            style={{ color: 'var(--text-secondary)' }}
                                        >
                                            {topic.description || 'Không có mô tả'}
                                        </p>
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
                                            <span
                                                key={tag}
                                                className="text-[11px] px-2 py-0.5 rounded-full"
                                                style={{
                                                    backgroundColor: 'var(--bg-secondary)',
                                                    color: 'var(--text-secondary)',
                                                }}
                                            >
                                                #{tag}
                                            </span>
                                        ))}
                                    </div>
                                    <span
                                        className="text-[11px] inline-flex items-center gap-1"
                                        style={{ color: 'var(--text-tertiary)' }}
                                    >
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
