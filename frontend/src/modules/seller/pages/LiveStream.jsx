import React, { useState, useEffect, useRef } from 'react';
import { ZegoUIKitPrebuilt } from '@zegocloud/zego-uikit-prebuilt';
import { sellerApi } from '../services/sellerApi';
import { toast } from 'sonner';

// ZegoCloud credentials
const ZEGO_APP_ID = 1732820129;
const ZEGO_SERVER_SECRET = "40d2982f470a4fd09949979efbadc1be";

const LiveStream = () => {
    const [seller, setSeller] = useState(null);
    const [isLive, setIsLive] = useState(false);
    const [isLoading, setIsLoading] = useState(true);
    const containerRef = useRef(null);
    const zegoInitialized = useRef(false);
    const zpRef = useRef(null);

    // Step 1: Fetch Seller Profile
    useEffect(() => {
        const fetchSeller = async () => {
            try {
                const res = await sellerApi.getProfile();
                if (res.data?.success) {
                    setSeller(res.data.result);
                }
            } catch (error) {
                console.error("Failed to fetch seller profile:", error);
                toast.error("Failed to load seller information.");
            } finally {
                setIsLoading(false);
            }
        };
        fetchSeller();
    }, []);

    // Step 2: Start ZegoCloud AFTER seller data loaded + Go Live button clicked
    const startZegoLive = async () => {
        if (!seller || !containerRef.current || zegoInitialized.current) return;

        try {
            const roomID = `room_${seller._id}`;

            // Mark seller as live in backend DB
            await sellerApi.startLiveStream({
                roomId: roomID,
                title: `${seller.shopName || seller.name}'s Live Show`
            });

            zegoInitialized.current = true;
            setIsLive(true);

            // Validate credentials
            if (!ZEGO_APP_ID || !ZEGO_SERVER_SECRET) {
                toast.error("ZegoCloud credentials missing.");
                zegoInitialized.current = false;
                setIsLive(false);
                await sellerApi.endLiveStream();
                return;
            }

            const kitToken = ZegoUIKitPrebuilt.generateKitTokenForTest(
                ZEGO_APP_ID,
                ZEGO_SERVER_SECRET,
                roomID,
                seller._id,
                seller.name || 'Seller'
            );

            const zp = ZegoUIKitPrebuilt.create(kitToken);
            zpRef.current = zp;

            zp.joinRoom({
                container: containerRef.current,
                scenario: {
                    mode: ZegoUIKitPrebuilt.LiveStreaming,
                    config: {
                        role: ZegoUIKitPrebuilt.Host,
                    },
                },
                showPreJoinView: false,
                turnOnCameraWhenJoining: true,
                turnOnMicrophoneWhenJoining: true,
                onLeaveRoom: async () => {
                    await handleStopLive();
                }
            });

            toast.success("You are now LIVE!");

        } catch (error) {
            zegoInitialized.current = false;
            setIsLive(false);
            console.error("ZegoCloud Error:", error);
            toast.error("Failed to start live stream. Please try again.");
        }
    };

    const handleStopLive = async () => {
        try {
            if (zpRef.current) {
                try { zpRef.current.destroy(); } catch (e) { /* ignore */ }
                zpRef.current = null;
            }
            zegoInitialized.current = false;
            await sellerApi.endLiveStream();
            setIsLive(false);
            toast.success("Live Stream Ended");
        } catch (error) {
            console.error("Failed to end live stream:", error);
        }
    };

    if (isLoading) {
        return <div className="p-8 text-center text-slate-500">Loading live streaming setup...</div>;
    }

    return (
        <div className="max-w-6xl mx-auto space-y-6">
            <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-6 md:p-8">
                <div className="flex items-center justify-between mb-6 border-b border-slate-100 pb-6">
                    <div>
                        <h2 className="text-2xl font-black text-slate-900 tracking-tight flex items-center gap-3">
                            <span className="relative flex h-4 w-4">
                                <span className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${isLive ? 'bg-red-400' : 'bg-slate-400'}`}></span>
                                <span className={`relative inline-flex rounded-full h-4 w-4 ${isLive ? 'bg-red-500' : 'bg-slate-400'}`}></span>
                            </span>
                            {isLive ? '🔴 You are Live!' : 'Live Commerce Dashboard'}
                        </h2>
                        <p className="text-sm text-slate-500 font-medium mt-1">
                            {isLive ? 'Customers can watch your stream now' : 'Broadcast your products directly to customers'}
                        </p>
                    </div>

                    {!isLive ? (
                        <button
                            onClick={startZegoLive}
                            className="px-6 py-3 bg-red-500 text-white font-bold rounded-xl hover:bg-red-600 transition-all shadow-lg shadow-red-500/20 active:scale-[0.98]"
                        >
                            🔴 Start Live Stream
                        </button>
                    ) : (
                        <button
                            onClick={handleStopLive}
                            className="px-6 py-3 bg-slate-900 text-white font-bold rounded-xl hover:bg-slate-800 transition-all active:scale-[0.98]"
                        >
                            End Stream
                        </button>
                    )}
                </div>

                {/* Container ALWAYS visible — overlay shown on top when not live */}
                <div className="bg-slate-900 rounded-2xl overflow-hidden relative" style={{ minHeight: '500px' }}>
                    {/* Camera Off Overlay */}
                    {!isLive && (
                        <div className="absolute inset-0 flex flex-col items-center justify-center text-center z-10 bg-slate-900 rounded-2xl">
                            <div className="w-16 h-16 bg-white/10 rounded-full flex items-center justify-center mx-auto mb-4">
                                <svg className="w-8 h-8 text-white/50" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
                                </svg>
                            </div>
                            <p className="text-white font-medium">Camera is off.</p>
                            <p className="text-white/50 text-sm mt-1">Click "Start Live Stream" to go live.</p>
                        </div>
                    )}
                    {/* ZegoCloud mounts here — always in DOM and visible */}
                    <div
                        ref={containerRef}
                        style={{ width: '100%', height: '500px' }}
                    />
                </div>
            </div>
        </div>
    );
};

export default LiveStream;
