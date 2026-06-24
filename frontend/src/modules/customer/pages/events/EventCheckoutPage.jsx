import React, { useState, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import CelebrationIcon from '@mui/icons-material/Celebration';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import { motion } from 'framer-motion';
import { toast } from 'sonner';
import { customerApi } from '../../services/customerApi';
import { useSettings } from '@core/context/SettingsContext';

const EventCheckoutPage = () => {
    const { state } = useLocation();
    const navigate = useNavigate();
    const { settings } = useSettings();
    const eventData = state?.eventData;
    const preferences = state?.preferences;
    const selectedCategories = state?.selectedCategories;
    const selectedSeller = state?.selectedSeller;
    const selectedPackage = state?.selectedPackage;

    useEffect(() => {
        if (!eventData || !selectedCategories || !selectedSeller) {
            navigate('/plan-my-event');
        }
    }, [eventData, selectedCategories, selectedSeller, navigate]);

    const [isSending, setIsSending] = useState(false);

    // Calculate total amount based on package or budget
    const totalAmount = selectedPackage
        ? selectedPackage.pricing * (parseInt(eventData?.guestCount, 10) || 1)
        : parseInt(eventData?.budget, 10) || 0;

    const handleSendRequest = async () => {
        setIsSending(true);
        toast.loading("Sending Request to Providers...", { id: 'booking' });
        try {
            await customerApi.createEventBooking({
                eventData,
                preferences,
                selectedCategories,
                sellerId: selectedSeller._id,
                packageId: selectedPackage?._id,
                paymentMethod: 'ONLINE', // Will be finalized at payment time
                amount: totalAmount
            });
            toast.success("Request Sent! Awaiting Seller Approval.", { id: 'booking' });
            navigate('/orders'); // Go to orders page
        } catch (error) {
            const apiMessage = error?.response?.data?.message || "Failed to send request.";
            toast.error(apiMessage, { id: 'booking' });
            setIsSending(false);
        }
    };

    return (
        <div className="min-h-screen bg-slate-50 flex flex-col font-sans">
            <div className="sticky top-0 left-0 right-0 h-16 bg-white z-50 flex items-center px-4 shadow-sm shrink-0">
                <button onClick={() => navigate(-1)} className="p-2 -ml-2 rounded-full hover:bg-slate-100 transition-colors">
                    <ArrowBackIcon />
                </button>
                <div className="ml-2">
                    <h1 className="text-lg font-bold text-slate-800 leading-tight">Event Checkout</h1>
                    <p className="text-[10px] text-slate-500 font-medium">Secure your booking</p>
                </div>
            </div>

            <div className="flex-1 overflow-y-auto pb-32">
                <div className="max-w-xl mx-auto p-4 space-y-6">

                    {/* Summary Card */}
                    <div className="bg-white p-5 rounded-2xl shadow-sm border border-slate-100">
                        <h2 className="font-bold text-lg text-slate-800 mb-4 border-b pb-2">Booking Summary</h2>
                        <div className="space-y-3">
                            <div className="flex justify-between">
                                <span className="text-slate-500">Event Type</span>
                                <span className="font-semibold text-slate-800 capitalize">{eventData?.eventType}</span>
                            </div>
                            <div className="flex justify-between">
                                <span className="text-slate-500">Date & Time</span>
                                <span className="font-semibold text-slate-800">{eventData?.date} at {eventData?.time}</span>
                            </div>
                            <div className="flex justify-between">
                                <span className="text-slate-500">Guests</span>
                                <span className="font-semibold text-slate-800">{eventData?.guestCount} People</span>
                            </div>
                            {selectedPackage ? (
                                <div className="flex justify-between border-t pt-3 mt-3">
                                    <span className="text-slate-500">Selected Package</span>
                                    <div className="text-right">
                                        <span className="font-bold text-slate-800 block">{selectedPackage.template?.packageName}</span>
                                        <span className="text-xs text-slate-500">₹{selectedPackage.pricing}/guest</span>
                                    </div>
                                </div>
                            ) : (
                                <div className="flex justify-between">
                                    <span className="text-slate-500">Selected Services</span>
                                    <span className="font-semibold text-slate-800">{selectedCategories?.length} Services</span>
                                </div>
                            )}
                        </div>

                        <div className="mt-4 pt-4 border-t border-slate-100 flex flex-col space-y-2">
                            <div className="flex justify-between items-center">
                                <span className="font-bold text-slate-800">Total Amount</span>
                                <span className="font-bold text-lg text-slate-500">₹{totalAmount.toLocaleString()}</span>
                            </div>
                            <div className="flex justify-between items-center bg-purple-50 p-3 rounded-xl border border-purple-100">
                                <div className="flex flex-col">
                                    <span className="font-black text-purple-900">Advance Token to Pay Later</span>
                                    <span className="text-[10px] text-purple-600 font-bold uppercase tracking-wider">
                                        ({settings?.bookingControl?.advanceBookingLimitPercent ?? 20}% required to confirm)
                                    </span>
                                </div>
                                <span className="font-black text-xl text-purple-700">
                                    ₹{Math.round((totalAmount * (settings?.bookingControl?.advanceBookingLimitPercent ?? 20)) / 100).toLocaleString()}
                                </span>
                            </div>
                        </div>
                    </div>

                    {/* Reservation Status Removed for Request Flow */}

                </div>
            </div>

            {/* Bottom Action Bar */}
            <div className="fixed bottom-0 left-0 right-0 p-4 bg-white border-t border-slate-100 shadow-[0_-4px_20px_rgba(0,0,0,0.05)]">
                <div className="max-w-xl mx-auto">
                    <button
                        onClick={handleSendRequest}
                        disabled={isSending}
                        className={`w-full font-bold rounded-xl py-4 transition-all shadow-lg ${isSending ? 'bg-slate-300 text-slate-500' : 'bg-gradient-to-r from-purple-600 to-indigo-600 text-white shadow-purple-500/30 hover:scale-[1.02] active:scale-95'}`}
                    >
                        {isSending ? 'Sending Request...' : 'Send Request to Provider'}
                    </button>
                </div>
            </div>
        </div>
    );
};

export default EventCheckoutPage;
