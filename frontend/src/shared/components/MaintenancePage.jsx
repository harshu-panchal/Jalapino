import React, { useEffect, useState } from 'react';
import { AlertTriangle, RefreshCcw } from 'lucide-react';
import axiosInstance from '@core/api/axios';

const MaintenancePage = () => {
    const [checking, setChecking] = useState(false);

    const checkStatus = async () => {
        setChecking(true);
        try {
            // Attempt to hit a public endpoint to see if maintenance is lifted
            const res = await axiosInstance.get('/categories');
            if (res.status === 200) {
                window.location.href = '/';
            }
        } catch (error) {
            // If still 503, do nothing
        } finally {
            setChecking(false);
        }
    };

    return (
        <div className="min-h-screen bg-[#FAF8F6] flex flex-col items-center justify-center p-4">
            <div className="bg-white p-8 rounded-3xl shadow-xl max-w-md w-full text-center border border-slate-100">
                <div className="w-20 h-20 bg-rose-50 rounded-full flex items-center justify-center mx-auto mb-6 text-rose-500">
                    <AlertTriangle size={40} />
                </div>
                <h1 className="text-2xl font-black text-slate-900 mb-2">We'll be right back</h1>
                <p className="text-slate-500 mb-8 font-medium">
                    Jalapino is currently undergoing scheduled maintenance to improve your experience. Please check back soon!
                </p>
                <button
                    onClick={checkStatus}
                    disabled={checking}
                    className="w-full bg-slate-900 text-white font-bold py-3.5 rounded-xl hover:bg-slate-800 transition-colors flex items-center justify-center gap-2 shadow-lg shadow-slate-900/20 disabled:opacity-70"
                >
                    <RefreshCcw size={18} className={checking ? 'animate-spin' : ''} />
                    {checking ? 'Checking Status...' : 'Refresh Page'}
                </button>
            </div>
            <p className="mt-8 text-sm font-bold text-slate-400">Jalapino Operations Team</p>
        </div>
    );
};

export default MaintenancePage;
