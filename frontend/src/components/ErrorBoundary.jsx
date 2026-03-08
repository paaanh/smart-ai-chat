import { Component } from 'react';

export default class ErrorBoundary extends Component {
    constructor(props) {
        super(props);
        this.state = { hasError: false, error: null, errorInfo: null };
    }

    static getDerivedStateFromError(error) {
        return { hasError: true, error };
    }

    componentDidCatch(error, errorInfo) {
        this.setState({ errorInfo });
        console.error('[ErrorBoundary] Caught:', error, errorInfo);
    }

    handleReload = () => {
        window.location.reload();
    };

    handleReset = () => {
        this.setState({ hasError: false, error: null, errorInfo: null });
    };

    render() {
        if (this.state.hasError) {
            return (
                <div className="h-screen flex items-center justify-center bg-gray-50 p-4">
                    <div className="bg-white rounded-2xl shadow-lg p-8 max-w-lg w-full text-center">
                        <div className="text-5xl mb-4">⚠️</div>
                        <h2 className="text-xl font-bold text-gray-900 mb-2">
                            Đã xảy ra lỗi
                        </h2>
                        <p className="text-gray-500 mb-4 text-sm">
                            Ứng dụng gặp sự cố. Vui lòng thử lại.
                        </p>
                        {this.state.error && (
                            <pre className="bg-red-50 text-red-600 rounded-lg p-3 text-xs text-left overflow-auto mb-4 max-h-40">
                                {this.state.error.toString()}
                                {this.state.errorInfo?.componentStack &&
                                    `\n\nComponent Stack:${this.state.errorInfo.componentStack}`}
                            </pre>
                        )}
                        <div className="flex gap-3 justify-center">
                            <button
                                onClick={this.handleReset}
                                className="px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg font-medium text-sm transition"
                            >
                                Thử lại
                            </button>
                            <button
                                onClick={this.handleReload}
                                className="px-4 py-2 bg-[var(--color-primary)] hover:bg-[var(--color-primary-hover)] text-white rounded-lg font-medium text-sm transition"
                            >
                                Tải lại trang
                            </button>
                        </div>
                    </div>
                </div>
            );
        }

        return this.props.children;
    }
}
