import { useState, useRef, useEffect, useCallback } from 'react';
import { Play, Pause } from 'lucide-react';

function formatTime(sec) {
    const m = Math.floor(sec / 60);
    const s = Math.floor(sec % 60);
    return `${m}:${s.toString().padStart(2, '0')}`;
}

export default function VoiceMessage({ url, isOwn }) {
    const audioRef = useRef(null);
    const [playing, setPlaying] = useState(false);
    const [duration, setDuration] = useState(0);
    const [currentTime, setCurrentTime] = useState(0);

    useEffect(() => {
        const audio = audioRef.current;
        if (!audio) return;

        const onLoaded = () => {
            if (audio.duration && isFinite(audio.duration)) setDuration(audio.duration);
        };
        const onTime = () => setCurrentTime(audio.currentTime);
        const onEnded = () => { setPlaying(false); setCurrentTime(0); };
        const onDurationChange = () => {
            if (audio.duration && isFinite(audio.duration)) setDuration(audio.duration);
        };

        audio.addEventListener('loadedmetadata', onLoaded);
        audio.addEventListener('durationchange', onDurationChange);
        audio.addEventListener('timeupdate', onTime);
        audio.addEventListener('ended', onEnded);
        return () => {
            audio.removeEventListener('loadedmetadata', onLoaded);
            audio.removeEventListener('durationchange', onDurationChange);
            audio.removeEventListener('timeupdate', onTime);
            audio.removeEventListener('ended', onEnded);
        };
    }, []);

    const togglePlay = useCallback(() => {
        const audio = audioRef.current;
        if (!audio) return;
        if (playing) {
            audio.pause();
            setPlaying(false);
        } else {
            audio.play();
            setPlaying(true);
        }
    }, [playing]);

    const handleSeek = (e) => {
        const audio = audioRef.current;
        if (!audio || !duration) return;
        const rect = e.currentTarget.getBoundingClientRect();
        const ratio = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
        audio.currentTime = ratio * duration;
        setCurrentTime(audio.currentTime);
    };

    const progress = duration > 0 ? (currentTime / duration) * 100 : 0;

    return (
        <div className="flex items-center gap-3 min-w-[200px] max-w-[260px]">
            <audio ref={audioRef} src={url} preload="metadata" />

            {/* Play/Pause button */}
            <button
                onClick={togglePlay}
                className={`w-9 h-9 rounded-full flex items-center justify-center shrink-0 transition
                    ${isOwn
                        ? 'bg-white/25 hover:bg-white/35 text-white'
                        : 'bg-[var(--color-primary-light)] hover:bg-[var(--color-primary-medium)] text-[var(--color-primary)]'
                    }`}
            >
                {playing ? <Pause size={16} /> : <Play size={16} className="ml-0.5" />}
            </button>

            {/* Waveform / progress */}
            <div className="flex-1 flex flex-col gap-1">
                <div
                    className={`relative h-2 rounded-full cursor-pointer ${isOwn ? 'bg-white/20' : 'bg-gray-300'}`}
                    onClick={handleSeek}
                >
                    <div
                        className={`absolute top-0 left-0 h-full rounded-full transition-[width] duration-100 ${isOwn ? 'bg-white/70' : 'bg-[var(--color-primary)]'}`}
                        style={{ width: `${progress}%` }}
                    />
                </div>
                <span className={`text-[10px] ${isOwn ? 'text-white/60' : 'text-gray-400'}`}>
                    {playing || currentTime > 0 ? formatTime(currentTime) : formatTime(duration)}
                </span>
            </div>
        </div>
    );
}
