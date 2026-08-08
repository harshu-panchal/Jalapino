import React, { useState } from 'react';
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

    const handleVerify = async (e) => {
        e.preventDefault();
        if (!qrInput.trim()) {
            toast.error("Please enter a valid QR token or ticket ID.");
            return;
        }

        setIsLoading(true);
        setScanResult(null);
        try {
            const res = await generalBookingApi.scanTicket({ secureQrToken: qrInput.trim(), confirm: false });
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
                {/* Visual Scanner Frame Mock */}
                <div className="relative border-4 border-dashed border-purple-500/40 rounded-3xl p-6 bg-slate-950/50 shadow-2xl flex flex-col items-center justify-center text-center w-full min-h-[16rem] sm:min-h-[18rem] h-auto mx-auto py-8">
                    <div className="absolute inset-0 bg-gradient-to-t from-purple-900/10 to-transparent pointer-events-none"></div>
                    
                    <AnimatePresence mode="wait">
                        {!scanResult && !isLoading && (
                            <motion.div 
                                initial={{ opacity: 0, y: 10 }}
                                animate={{ opacity: 1, y: 0 }}
                                exit={{ opacity: 0, y: -10 }}
                                className="space-y-4"
                            >
                                <QrCodeScannerIcon className="text-purple-400" sx={{ fontSize: 80 }} />
                                <div>
                                    <h3 className="text-lg font-black">Scan Ticket QR</h3>
                                    <p className="text-xs text-slate-400 max-w-xs mt-1">
                                        Enter the secure QR token below to verify the customer ticket in real time.
                                    </p>
                                </div>
                            </motion.div>
                        )}

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
