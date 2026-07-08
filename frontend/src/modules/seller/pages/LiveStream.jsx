import React, { useState } from 'react';
import { HiOutlineVideoCamera } from 'react-icons/hi2';
import { sellerApi } from '../services/sellerApi';
import { toast } from 'sonner';

const LiveStream = () => {
    const [liveStreamUrl, setLiveStreamUrl] = useState("");
    const [isLoading, setIsLoading] = useState(false);

    const handleStreamSubmit = async () => {
        if (!liveStreamUrl) return;
        setIsLoading(true);
        try {
            const res = await sellerApi.updateLiveStreamUrl(null, liveStreamUrl);
            if (res.data.success) {
                toast.success('Live Stream published to User Reels successfully!');
            }
        } catch (error) {
            console.error("Live Stream Upload Error:", error);
            toast.error(error.response?.data?.message || 'Failed to update Live Stream');
        } finally {
            setIsLoading(false);
        }
    };

    const handleStopStream = async () => {
        setIsLoading(true);
        try {
            const res = await sellerApi.updateLiveStreamUrl(null, "");
            if (res.data.success) {
                setLiveStreamUrl("");
                toast.success('Live Stream stopped successfully!');
            }
        } catch (error) {
            console.error("Live Stream Stop Error:", error);
            toast.error(error.response?.data?.message || 'Failed to stop Live Stream');
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="max-w-4xl mx-auto space-y-6">
            <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-6 md:p-8">
                <div className="flex items-center gap-3 mb-6">
                    <div className="w-12 h-12 rounded-xl bg-red-50 text-red-500 flex items-center justify-center relative">
                        <HiOutlineVideoCamera className="w-6 h-6" />
                        <span className="absolute -top-1 -right-1 w-3 h-3 bg-red-500 rounded-full animate-pulse border-2 border-white"></span>
                    </div>
                    <div>
                        <h2 className="text-xl font-black text-slate-900 tracking-tight">Go Live</h2>
                        <p className="text-sm text-slate-500 font-medium">Broadcast directly to the customer app Reels feed</p>
                    </div>
                </div>

                <div className="bg-slate-50 p-6 rounded-xl border border-slate-100 space-y-4">
                    <label className="text-xs font-bold text-slate-500 uppercase tracking-wider block">
                        Live Stream URL (YouTube)
                    </label>
                    <input 
                        type="text" 
                        value={liveStreamUrl}
                        onChange={(e) => setLiveStreamUrl(e.target.value)}
                        placeholder="e.g., https://youtube.com/live/..." 
                        className="w-full px-4 py-3 border border-slate-200 rounded-xl text-sm focus:outline-none focus:border-red-500 focus:ring-4 focus:ring-red-50 transition-all bg-white"
                    />
                    
                    <div className="flex gap-3 pt-4">
                        <button 
                            onClick={handleStreamSubmit}
                            disabled={isLoading || !liveStreamUrl}
                            className="flex-1 px-6 py-3 bg-red-500 text-white text-sm font-bold rounded-xl hover:bg-red-600 transition-all disabled:opacity-50 disabled:hover:bg-red-500 shadow-lg shadow-red-500/20 active:scale-[0.98]"
                        >
                            {isLoading ? "Publishing..." : "Go Live Now"}
                        </button>
                        
                        <button 
                            onClick={handleStopStream}
                            disabled={isLoading}
                            className="px-6 py-3 bg-slate-100 text-slate-700 text-sm font-bold rounded-xl hover:bg-slate-200 transition-all disabled:opacity-50 active:scale-[0.98]"
                        >
                            Stop Stream
                        </button>
                    </div>
                </div>
                
                <div className="mt-8 bg-blue-50/50 rounded-xl p-5 border border-blue-100">
                    <h4 className="text-sm font-bold text-blue-900 mb-2 flex items-center gap-2">
                        <span className="w-1.5 h-1.5 rounded-full bg-blue-500"></span>
                        How it works
                    </h4>
                    <p className="text-sm text-blue-800/80 leading-relaxed font-medium">
                        When you paste a YouTube Live link and click "Go Live Now", your stream will instantly appear in the <strong>Reels</strong> section of the customer app. Users will see a "LIVE" badge and can watch your broadcast seamlessly. To remove your stream from the Reels feed, simply click "Stop Stream".
                    </p>
                </div>
            </div>
        </div>
    );
};

export default LiveStream;
