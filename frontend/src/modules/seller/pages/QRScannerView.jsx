import React, { useState, useEffect, useRef } from 'react';
import { Html5Qrcode } from 'html5-qrcode';
import { motion, AnimatePresence } from 'framer-motion';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import QrCodeScannerIcon from '@mui/icons-material/QrCodeScanner';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import CancelIcon from '@mui/icons-material/Cancel';
import HelpCenterIcon from '@mui/icons-material/HelpCenter';
import InfoIcon from '@mui/icons-material/Info';
import { generalBookingApi } from '../../customer/services/generalBookingApi';
import { toast } from 'sonner';

const QRScannerView = () => {
    const [qrInput, setQrInput] = useState('');
    const [scanResult, setScanResult] = useState(null);
    const [isLoading, setIsLoading] = useState(false);
    const [isCheckingIn, setIsCheckingIn] = useState(false);
    const [cameraError, setCameraError] = useState(null);

    const html5QrCodeRef = useRef(null);
    const isProcessingRef = useRef(false);

    const isInitializingRef = useRef(false);

    const stopScanner = async () => {
        if (html5QrCodeRef.current) {
            try {
                if (html5QrCodeRef.current.isScanning) {
                    await html5QrCodeRef.current.stop();
                }
                html5QrCodeRef.current.clear();
            } catch (e) { console.warn("Stop scanner error:", e); }
            html5QrCodeRef.current = null;
        }
    };

    const startScanner = async () => {
        if (isInitializingRef.current) return;
        isInitializingRef.current = true;
        setCameraError(null);
        isProcessingRef.current = false;

        try {
            await stopScanner();
            // Small delay to ensure previous instance is fully cleared from DOM
            await new Promise(r => setTimeout(r, 100));
            
            const html5QrCode = new Html5Qrcode("reader");
            html5QrCodeRef.current = html5QrCode;

            await html5QrCode.start(
                { facingMode: "environment" },
                {
                    fps: 15,
                    qrbox: { width: 250, height: 250 },
                    aspectRatio: 1.0,
                },
                async (decodedText) => {
                    if (isProcessingRef.current) return;
                    if (decodedText && decodedText.trim() !== '') {
                        isProcessingRef.current = true;
                        setQrInput(decodedText.trim());
                        await stopScanner();
                        verifyTokenDirect(decodedText.trim());
                    }
                },
                () => { /* ignore scan errors */ }
            );
        } catch (err) {
            console.warn("Camera start error:", err);
            setCameraError("Camera access denied or unavailable.");
        } finally {
            isInitializingRef.current = false;
        }
    };

    useEffect(() => {
        startScanner();
        return () => { stopScanner(); };
    }, []);

    const verifyTokenDirect = async (token) => {
        setIsLoading(true);
        setScanResult(null);
        try {
            const res = await generalBookingApi.scanTicket({ secureQrToken: token, confirm: false });
            setScanResult({
                success: true,
                checkedIn: false,
                message: "Ticket Validated: Ready for Check-In",
                ticket: res.data.result
            });
            toast.success("Ticket details verified! Please confirm check-in.");
        } catch (err) {
            setScanResult({
                success: false,
                checkedIn: false,
                message: err.response?.data?.message || "Invalid or unauthorized ticket code."
            });
            toast.error(err.response?.data?.message || "Scan verification failed");
        } finally {
            setIsLoading(false);
        }
    };

    const handleVerify = async (e) => {
        e.preventDefault();
        if (!qrInput.trim()) {
            toast.error("Please enter a valid QR token or ticket ID.");
            return;
        }
        verifyTokenDirect(qrInput.trim());
    };

    const handleConfirmCheckIn = async () => {
        if (!scanResult || !scanResult.ticket) return;
        setIsCheckingIn(true);
        try {
            const res = await generalBookingApi.scanTicket({ 
                secureQrToken: scanResult.ticket.secureQrToken, 
                confirm: true 
            });
            setScanResult({
                success: true,
                checkedIn: true,
                message: "Checked-In Successfully!",
                ticket: res.data.result
            });
            toast.success("Check-In submitted! Admin notified & User notified.");
            setQrInput('');
        } catch (err) {
            toast.error(err.response?.data?.message || "Failed to confirm check-in.");
        } finally {
            setIsCheckingIn(false);
        }
    };

    return (
        <div className="min-h-screen bg-slate-900 text-white font-sans flex flex-col overflow-y-auto">
            <style>{`
                @keyframes scanMove {
                    0%   { top: 0%; }
                    50%  { top: calc(100% - 4px); }
                    100% { top: 0%; }
                }
                .scan-line {
                    animation: scanMove 2s ease-in-out infinite;
                }
            `}</style>
            {/* Header */}
            <div className="px-4 py-4 border-b border-slate-800 flex items-center bg-slate-950/80 backdrop-blur-md sticky top-0 z-40">
                <h1 className="text-base font-black flex items-center gap-2">
                    <QrCodeScannerIcon className="text-purple-500 animate-pulse" />
                    Ticket QR Scanner / Verifier
                </h1>
            </div>

            <div className="max-w-md mx-auto w-full px-4 py-6 flex flex-col space-y-6">
                {/* Camera Scanner Area */}
                <div className="relative border-4 border-dashed border-purple-500/40 rounded-3xl bg-slate-950/50 shadow-2xl w-[280px] h-[280px] mx-auto overflow-hidden flex items-center justify-center">
                    <div className="absolute inset-0 bg-gradient-to-t from-purple-900/10 to-transparent pointer-events-none z-10"></div>

                    {/* Scan target overlay (Only the animated line, html5qrcode handles the brackets) */}
                    {!scanResult && !isLoading && !cameraError && (
                        <div className="absolute inset-0 pointer-events-none z-20 flex items-center justify-center">
                            <div className="w-[250px] h-[250px] relative overflow-hidden">
                                <div className="absolute top-0 left-0 w-full h-1 bg-purple-500 shadow-[0_0_15px_3px_rgba(168,85,247,0.8)] scan-line"></div>
                            </div>
                        </div>
                    )}

                    {/* Camera error state */}
                    {cameraError && (
                        <div className="absolute inset-0 flex flex-col items-center justify-center bg-slate-900 z-20 p-6 text-center">
                            <QrCodeScannerIcon sx={{ fontSize: 60 }} className="mb-3 text-red-500 opacity-70" />
                            <p className="text-xs font-bold text-red-400 mb-4">{cameraError}</p>
                            <button onClick={startScanner} className="px-5 py-2.5 bg-purple-600 text-white text-xs font-bold rounded-xl">Retry Camera</button>
                        </div>
                    )}

                    {/* Loading */}
                    {isLoading && (
                        <div className="absolute inset-0 flex flex-col items-center justify-center bg-slate-900 z-20">
                            <div className="w-10 h-10 border-4 border-purple-500 border-t-transparent rounded-full animate-spin mb-3"></div>
                            <p className="text-xs text-purple-400 font-bold uppercase tracking-wider">Verifying Ticket...</p>
                        </div>
                    )}

                    {/* Scan Result */}
                    {scanResult && !isLoading && (
                        <div className="absolute inset-0 flex flex-col items-center justify-center bg-slate-900 z-20 p-6 text-center space-y-4">
                            {scanResult.success ? (
                                <>
                                    {scanResult.checkedIn ? (
                                        <CheckCircleIcon className="text-emerald-500 animate-bounce" sx={{ fontSize: 70 }} />
                                    ) : (
                                        <HelpCenterIcon className="text-amber-500 animate-pulse" sx={{ fontSize: 70 }} />
                                    )}
                                    <h3 className={`text-base font-black ${scanResult.checkedIn ? 'text-emerald-400' : 'text-amber-400'}`}>{scanResult.message}</h3>
                                    {scanResult.ticket && (
                                        <div className="bg-slate-800 border border-slate-700 rounded-2xl p-4 text-left text-xs space-y-1.5 w-full max-w-xs">
                                            <p><span className="text-slate-400 font-bold uppercase">Name:</span> {scanResult.ticket.memberName}</p>
                                            <p><span className="text-slate-400 font-bold uppercase">Ticket ID:</span> {scanResult.ticket.ticketId}</p>
                                            <p><span className="text-slate-400 font-bold uppercase">Age:</span> {scanResult.ticket.age} ({scanResult.ticket.category})</p>
                                            <p><span className="text-slate-400 font-bold uppercase">Gender:</span> {scanResult.ticket.gender}</p>
                                        </div>
                                    )}
                                    {!scanResult.checkedIn && (
                                        <button
                                            onClick={handleConfirmCheckIn}
                                            disabled={isCheckingIn}
                                            className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-2xl py-3.5 transition-all active:scale-[0.98] disabled:opacity-60 text-xs uppercase tracking-widest shadow-lg"
                                        >
                                            {isCheckingIn ? "Submitting..." : "Confirm & Submit Check-In"}
                                        </button>
                                    )}
                                </>
                            ) : (
                                <>
                                    <CancelIcon className="text-rose-500" sx={{ fontSize: 70 }} />
                                    <h3 className="text-base font-black text-rose-400">{scanResult.message}</h3>
                                </>
                            )}
                            <button
                                onClick={() => { setScanResult(null); setQrInput(''); startScanner(); }}
                                className="px-6 py-2.5 bg-slate-800 text-xs font-bold rounded-xl hover:bg-slate-700 transition-colors"
                            >
                                🔄 Scan Another Ticket
                            </button>
                        </div>
                    )}

                    {/* Html5Qrcode video renders here — always in DOM */}
                    <div
                        id="reader"
                        style={{ width: '280px', height: '280px' }}
                        className="[&_video]:object-cover"
                    />
                </div>

                {/* Input form */}
                <form onSubmit={handleVerify} className="space-y-4">
                    <div className="space-y-1">
                        <label className="block text-xs font-black uppercase text-slate-400">Secure QR Token</label>
                        <input 
                            type="text"
                            placeholder="Paste ticket secureQrToken here..."
                            value={qrInput}
                            onChange={(e) => setQrInput(e.target.value)}
                            disabled={isLoading}
                            className="w-full bg-slate-950 border border-slate-800 rounded-2xl p-4 text-sm outline-none focus:ring-2 focus:ring-purple-600 text-white placeholder-slate-600"
                        />
                    </div>
                    <button 
                        type="submit"
                        disabled={isLoading}
                        className="w-full bg-purple-600 hover:bg-purple-700 text-white font-bold rounded-2xl py-4 transition-all active:scale-[0.98] disabled:opacity-60 text-sm"
                    >
                        Verify & Check-In
                    </button>
                </form>

                {/* Info block */}
                <div className="bg-slate-950/40 border border-slate-800 rounded-2xl p-4 flex gap-3 text-xs text-slate-400">
                    <InfoIcon className="text-purple-400 mt-0.5 shrink-0" fontSize="small" />
                    <p className="leading-relaxed">
                        Each member ticket generates a unique securely hashed QR code. Scanning it updates their check-in status on the server. Double check-ins are automatically rejected.
                    </p>
                </div>
            </div>
        </div>
    );
};

export default QRScannerView;
