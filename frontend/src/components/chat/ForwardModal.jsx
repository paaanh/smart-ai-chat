import { useState, useEffect } from 'react';
import { X, Loader2, Forward, Search } from 'lucide-react';
import { roomAPI, resolveMediaUrl } from '../../services/api';

export default function ForwardModal({ message, onClose, onForward }) {
    const [rooms, setRooms] = useState([]);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState('');
    const [forwarding, setForwarding] = useState(false);

    useEffect(() => {
        const load = async () => {
            try {
                const { data } = await roomAPI.getAll();
                setRooms(data.rooms || []);
            } catch (err) {
                console.error(err);
            } finally {
                setLoading(false);
            }
        };
        load();
    }, []);

    const filtered = rooms.filter(r => {
        const name = r.name || r.members?.map(m => m.user?.username).join(', ') || '';
        return name.toLowerCase().includes(search.toLowerCase());
    });

    const handleForward = async (roomId) => {
        setForwarding(true);
        try {
            await onForward(message._id, roomId);
            onClose();
        } catch {
            setForwarding(false);
        }
    };

    return (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={onClose}>
            <div className="bg-white rounded-2xl w-full max-w-sm max-h-[70vh] flex flex-col" onClick={e => e.stopPropagation()}>
                <div className="flex items-center justify-between p-4 border-b">
                    <h3 className="text-lg font-bold text-gray-800 flex items-center gap-2">
                        <Forward size={20} /> Chuyển tiếp tin nhắn
                    </h3>
                    <button onClick={onClose} className="p-1 hover:bg-gray-100 rounded-lg"><X size={20} /></button>
                </div>

                <div className="p-3 border-b">
                    <div className="relative">
                        <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                        <input type="text" placeholder="Tìm cuộc trò chuyện..." value={search}
                            onChange={e => setSearch(e.target.value)}
                            className="w-full pl-9 pr-3 py-2 bg-gray-100 rounded-lg text-sm outline-none focus:ring-2 focus:ring-blue-500" />
                    </div>
                </div>

                <div className="flex-1 overflow-y-auto p-2">
                    {loading ? (
                        <div className="flex justify-center py-8"><Loader2 size={24} className="animate-spin text-gray-400" /></div>
                    ) : filtered.length === 0 ? (
                        <p className="text-center py-8 text-gray-400 text-sm">Không tìm thấy</p>
                    ) : filtered.map(room => {
                        const roomName = room.name || room.members?.map(m => m.user?.username).filter(Boolean).join(', ') || 'Unknown';
                        const avatar = room.type === 'group' ? room.groupAvatar : room.members?.[0]?.user?.avatar;
                        return (
                            <button key={room._id} onClick={() => handleForward(room._id)} disabled={forwarding}
                                className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg hover:bg-gray-50 transition text-left disabled:opacity-50">
                                <div className="w-10 h-10 rounded-full bg-blue-500 flex items-center justify-center text-white font-bold overflow-hidden shrink-0">
                                    {avatar ? <img src={resolveMediaUrl(avatar)} alt="" className="w-full h-full object-cover" /> : roomName.charAt(0).toUpperCase()}
                                </div>
                                <div className="min-w-0 flex-1">
                                    <p className="font-medium text-gray-800 truncate text-sm">{roomName}</p>
                                    <p className="text-xs text-gray-400">{room.type === 'group' ? 'Nhóm' : 'Cá nhân'}</p>
                                </div>
                            </button>
                        );
                    })}
                </div>
            </div>
        </div>
    );
}
