import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ZegoUIKitPrebuilt } from '@zegocloud/zego-uikit-prebuilt';
import { ArrowLeft } from 'lucide-react';
import { customerApi } from '../services/customerApi';

// ZegoCloud credentials
const ZEGO_APP_ID = 1732820129;
const ZEGO_SERVER_SECRET = "40d2982f470a4fd09949979efbadc1be";

const WatchLive = () => {
    const { sellerId } = useParams();
    const navigate = useNavigate();
    const containerRef = useRef(null);
    const zpRef = useRef(null);
    const hasJoined = useRef(false);

    const [sellerData, setSellerData] = useState(null);
    const [error, setError] = useState(null);
    const [isLoading, setIsLoading] = useState(true);

    // Fetch seller & join on mount
    useEffect(() => {
        let cancelled = false;

        const init = async () => {
            try {
                const res = await customerApi.getActiveLiveSellers();
                const sellers = res.data?.data || [];
                const seller = sellers.find(s => String(s._id) === String(sellerId));

                if (!seller || !seller.liveStreaming?.isLive) {
                    if (!cancelled) {
                        setError("This seller is not live right now.");
                        setIsLoading(false);
                    }
                    return;
                }

                if (!cancelled) {
                    setSellerData(seller);
                    setIsLoading(false); // Trigger render to mount containerRef
                }

                // Wait for next paint so containerRef is populated
                await new Promise(r => setTimeout(r, 200)); // Increased timeout slightly for safety
                if (cancelled || !containerRef.current || hasJoined.current) return;

                hasJoined.current = true;

                // GUARANTEE same Room ID as seller
                const roomID = `room_${sellerId}`;
                const viewerID = `viewer_${Date.now()}_${Math.floor(Math.random() * 10000)}`;
                const viewerName = `Guest_${Math.floor(Math.random() * 9000) + 1000}`;

                const kitToken = ZegoUIKitPrebuilt.generateKitTokenForTest(
                    ZEGO_APP_ID,
                    ZEGO_SERVER_SECRET,
                    roomID,
                    viewerID,
                    viewerName
                );

                console.log("WatchLive: Joining Room as Audience", roomID);

                const zp = ZegoUIKitPrebuilt.create(kitToken);
                zpRef.current = zp;

                zp.joinRoom({
                    container: containerRef.current,
                    scenario: {
                        mode: ZegoUIKitPrebuilt.LiveStreaming,
                        config: { 
                            role: ZegoUIKitPrebuilt.Audience 
                        },
                    },
                    showPreJoinView: false,
                    turnOnCameraWhenJoining: false,
                    turnOnMicrophoneWhenJoining: false,
                    showUserList: true,
                    onLeaveRoom: () => navigate(-1),
                    onJoinRoom: () => {
                        console.log("WatchLive: Successfully joined room!");
                    }
                });

            } catch (err) {
                console.error("WatchLive error:", err);
                if (!cancelled) {
                    setError("Could not connect to live stream.");
                    setIsLoading(false);
                }
            }
        };

        init();

        return () => {
            cancelled = true;
            if (zpRef.current) {
                try { zpRef.current.destroy(); } catch (e) { /* ignore */ }
                zpRef.current = null;
            }
            hasJoined.current = false;
        };
    }, [sellerId, navigate]);

    if (isLoading) {
        return (
            <div className="w-full h-screen bg-black flex flex-col items-center justify-center">
                <div className="w-12 h-12 border-4 border-red-500 border-t-transparent rounded-full animate-spin mb-4" />
                <p className="text-sm font-bold text-zinc-400">Joining Live Stream...</p>
            </div>
        );
    }

    if (error) {
        return (
            <div className="w-full h-screen bg-black flex flex-col items-center justify-center text-white text-center px-8">
                <div className="w-16 h-16 bg-white/10 rounded-full flex items-center justify-center mb-4">
                    <svg className="w-8 h-8 text-white/40" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
                    </svg>
                </div>
                <p className="text-white font-bold text-lg">{error}</p>
                <button onClick={() => navigate('/')} className="mt-6 px-6 py-2.5 bg-white/10 rounded-full text-sm font-bold">Go Home</button>
            </div>
        );
    }

    return (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: '#000', zIndex: 9999 }}>
            {/* Header overlay */}
            <div style={{ position: 'absolute', top: 0, left: 0, right: 0, zIndex: 10, display: 'flex', alignItems: 'center', gap: '12px', padding: '16px', paddingTop: 'max(50px, env(safe-area-inset-top, 50px))', paddingLeft: 'max(16px, env(safe-area-inset-left, 16px))', background: 'linear-gradient(to bottom, rgba(0,0,0,0.6), transparent)', pointerEvents: 'none' }}>
                <button
                    onClick={() => navigate('/')}
                    style={{ padding: '8px', background: 'rgba(255,255,255,0.2)', borderRadius: '50%', color: 'white', pointerEvents: 'auto', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center' }}
                >
                    <ArrowLeft size={18} />
                </button>
                <span style={{ background: '#ef4444', color: 'white', fontSize: '11px', fontWeight: 'bold', padding: '3px 10px', borderRadius: '9999px' }}>
                    🔴 LIVE
                </span>
                <span style={{ color: 'white', fontWeight: 'bold', fontSize: '14px' }}>
                    {sellerData?.shopName || sellerData?.name || 'Live Stream'}
                </span>
            </div>

            {/* ZegoCloud Audience Container — full screen */}
            <div
                ref={containerRef}
                style={{ width: '100vw', height: '100vh' }}
            />
        </div>
    );
};

export default WatchLive;
