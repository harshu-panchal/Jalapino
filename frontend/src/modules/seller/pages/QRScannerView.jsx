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
    const [scanResult, setScanResult] = useState(null); // { success: boolean, checkedIn: boolean, message: string, ticket: object }
    const [isLoading, setIsLoading] = useState(false);
    const [isCheckingIn, setIsCheckingIn] = useState(false);
    const [isScannerReady, setIsScannerReady] = useState(false);

    const html5QrCodeRef = useRef(null);

    useEffect(() => {
        let isMounted = true;
        
        const startScanner = async () => {
            if (!scanResult && !isLoading) {
                try {
                    const html5QrCode = new Html5Qrcode("reader");
                    html5QrCodeRef.current = html5QrCode;
                    
                    await html5QrCode.start(
                        { facingMode: "environment" }, // back camera
                        { fps: 10 }, // removed qrbox to remove the ugly black overlay
                        (decodedText) => {
                            if (decodedText && decodedText.trim() !== '') {
                                setQrInput(decodedText.trim());
                                // Stop scanning
                                if (html5QrCodeRef.current?.isScanning) {
                                    html5QrCodeRef.current.stop().then(() => {
                                        verifyTokenDirect(decodedText.trim());
                                    }).catch(err => console.error(err));
                                }
                            }
                        },
                        (errorMessage) => {
                            // ignored
                        }
                    );
                    
                    if (isMounted) setIsScannerReady(true);
                } catch (err) {
                    console.warn("Camera could not be started", err);
                }
            }
        };

        startScanner();

        return () => {
            isMounted = false;
            if (html5QrCodeRef.current && html5QrCodeRef.current.isScanning) {
                html5QrCodeRef.current.stop().catch(err => console.error("Failed to stop scanner", err));
            }
        };
    }, [scanResult, isLoading]);

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
            {/* Header */}
            <div className="px-4 py-4 border-b border-slate-800 flex items-center bg-slate-950/80 backdrop-blur-md sticky top-0 z-40">
                <h1 className="text-base font-black flex items-center gap-2">
                    <QrCodeScannerIcon className="text-purple-500 animate-pulse" />
                    Ticket QR Scanner / Verifier
                </h1>
            </div>

            <div className="max-w-md mx-auto w-full px-4 py-6 flex flex-col space-y-6">
                {/* Visual Scanner Frame */}
                <div className="relative border-4 border-dashed border-purple-500/40 rounded-3xl bg-slate-950/50 shadow-2xl flex flex-col items-center justify-center text-center w-full min-h-[16rem] sm:min-h-[18rem] h-auto mx-auto overflow-hidden p-0">
                    <div className="absolute inset-0 bg-gradient-to-t from-purple-900/10 to-transparent pointer-events-none"></div>
                    
                    <AnimatePresence mode="wait">
                        <div 
                            style={{ display: (!scanResult && !isLoading) ? 'block' : 'none' }}
                            className="w-full h-full min-h-[16rem] rounded-2xl overflow-hidden relative shadow-inner bg-black"
                        >
                            {/* Native App Scanner Overlay */}
                            <div className="absolute inset-0 pointer-events-none z-20 flex items-center justify-center">
                                {/* Scanner Target Box */}
                                <div className="w-[200px] h-[200px] border-2 border-white/20 rounded-xl relative overflow-hidden">
                                    {/* Corner Accents */}
                                    <div className="absolute top-0 left-0 w-8 h-8 border-t-4 border-l-4 border-purple-500 rounded-tl-lg"></div>
                                    <div className="absolute top-0 right-0 w-8 h-8 border-t-4 border-r-4 border-purple-500 rounded-tr-lg"></div>
                                    <div className="absolute bottom-0 left-0 w-8 h-8 border-b-4 border-l-4 border-purple-500 rounded-bl-lg"></div>
                                    <div className="absolute bottom-0 right-0 w-8 h-8 border-b-4 border-r-4 border-purple-500 rounded-br-lg"></div>
                                    
                                    {/* Animated Scan Line */}
                                    <div className="absolute top-0 left-0 w-full h-1 bg-purple-500 shadow-[0_0_15px_3px_rgba(168,85,247,0.8)] animate-[scan_2s_ease-in-out_infinite]"></div>
                                </div>
                            </div>

                            {!isScannerReady && !scanResult && !isLoading && (
                                <div className="absolute inset-0 flex flex-col items-center justify-center bg-slate-900 z-10 text-slate-400">
                                    <QrCodeScannerIcon sx={{ fontSize: 60 }} className="mb-2 opacity-50 animate-pulse" />
                                    <p className="text-xs font-bold uppercase tracking-wider">Starting Camera...</p>
                                </div>
                            )}
                            <div id="reader" className="w-full h-full text-slate-800 [&_video]:object-cover [&_video]:w-full [&_video]:h-full [&_video]:absolute [&_video]:inset-0" style={{ border: 'none' }}></div>
                        </div>

                        {isLoading && (
                            <motion.div 
                                key="loading"
                                initial={{ opacity: 0 }}
                                animate={{ opacity: 1 }}
                                exit={{ opacity: 0 }}
                                className="flex flex-col items-center gap-3"
                            >
                                <div className="w-10 h-10 border-4 border-purple-500 border-t-transparent rounded-full animate-spin"></div>
                                <p className="text-xs text-purple-400 font-bold uppercase tracking-wider">Verifying Ticket...</p>
                            </motion.div>
                        )}

                        {scanResult && (
                            <motion.div 
                                key="result"
                                initial={{ scale: 0.9, opacity: 0 }}
                                animate={{ scale: 1, opacity: 1 }}
                                exit={{ scale: 0.9, opacity: 0 }}
                                className="space-y-4 w-full"
                            >
                                {scanResult.success ? (
                                    <>
                                        {scanResult.checkedIn ? (
                                            <CheckCircleIcon className="text-emerald-500 animate-bounce" sx={{ fontSize: 70 }} />
                                        ) : (
                                            <HelpCenterIcon className="text-amber-500 animate-pulse" sx={{ fontSize: 70 }} />
                                        )}
                                        <h3 className={`text-lg font-black ${scanResult.checkedIn ? 'text-emerald-400' : 'text-amber-400'}`}>{scanResult.message}</h3>
                                        {scanResult.ticket && (
                                            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 text-left text-xs space-y-1.5 max-w-xs mx-auto">
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
                                                className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-2xl py-3.5 transition-all active:scale-[0.98] disabled:opacity-60 text-xs mt-2 uppercase tracking-widest shadow-lg shadow-emerald-600/20"
                                            >
                                                {isCheckingIn ? "Submitting Check-In..." : "Confirm & Submit Check-In"}
                                            </button>
                                        )}
                                    </>
                                ) : (
                                    <>
                                        <CancelIcon className="text-rose-500" sx={{ fontSize: 70 }} />
                                        <h3 className="text-lg font-black text-rose-400">{scanResult.message}</h3>
                                    </>
                                )}
                                <button 
                                    onClick={() => setScanResult(null)}
                                    className="px-6 py-2 bg-slate-800 text-xs font-bold rounded-xl hover:bg-slate-700 mt-4 transition-colors"
                                >
                                    Scan Another Ticket
                                </button>
                            </motion.div>
                        )}
                    </AnimatePresence>
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
