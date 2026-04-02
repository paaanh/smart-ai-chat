export default function SkeletonBlock({ className = '' }) {
    return <div className={`skeleton-shimmer ${className}`.trim()} aria-hidden="true" />;
}
