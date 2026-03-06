import { useContext } from 'react';
import { CallContext } from '../contexts';

export const useCall = () => {
    const ctx = useContext(CallContext);
    if (!ctx) throw new Error('useCall must be inside CallProvider');
    return ctx;
};
