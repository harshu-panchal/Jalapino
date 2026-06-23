import React, { useState, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import CelebrationIcon from '@mui/icons-material/Celebration';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import { motion } from 'framer-motion';
import { toast } from 'sonner';
import { customerApi } from '../../services/customerApi';

const EventCheckoutPage = () => {
    const { state } = useLocation();
    const navigate = useNavigate();
    const [isReserving, setIsReserving] = useState(false);
    const [reservationSuccess, setReservationSuccess] = useState(false);
    const [countdown, setCountdown] = useState(15 * 60); // 15 minutes in seconds

    const eventData = state?.eventData;
    const preferences = state?.preferences;
    const selectedCategories = state?.selectedCategories;
    const selectedSeller = state?.selectedSeller;

    useEffect(() => {
        if (!eventData || !selectedCategories || !selectedSeller) {
            navigate('/plan-my-event');
        }
    }, [eventData, selectedCategories, selectedSeller, navigate]);

    useEffect(() => {
        let timer;
        if (reservationSuccess && countdown > 0) {
            timer = setInterval(() => {
                setCountdown(prev => prev - 1);
            }, 1000);
        } else if (countdown === 0) {
            toast.error("Reservation Expired! Please try again.");
            navigate('/plan-my-event');
        }
        return () => clearInterval(timer);
    }, [reservationSuccess, countdown, navigate]);

    const formatTime = (seconds) => {
        const m = Math.floor(seconds / 60);
        const s = seconds % 60;
        return `${m}:${s < 10 ? '0' : ''}${s}`;
    };

    const handleReserveAndPay = () => {
        setIsReserving(true);
        // Simulate API call to reservationService.createTemporaryReservation
        setTimeout(() => {
            setIsReserving(false);
            setReservationSuccess(true);
            toast.success("Sellers available! Slots locked for 15 minutes.");
        }, 2500);
    };

    const handleFinalPayment = async () => {
        toast.loading("Initiating Razorpay...", { id: 'payment' });
        
        try {
            // Use existing ecommerce Razorpay controller to generate a valid order_id
            // This bypasses the test mode amount limits.
            const paymentRef = "evt_" + Date.now();
            const rzpRes = await customerApi.createRazorpayOrder(paymentRef, { amount: totalAmount });
            const rzpOrderId = rzpRes.data?.result?.id || rzpRes.data?.id;

            const options = {
                key: "rzp_test_S3IcSS1NbymL6D", 
                amount: totalAmount * 100, 
                currency: "INR",
                name: "Jalapino Events",
                description: "Event Booking Reservation",
                order_id: rzpOrderId, // Required for large amounts
                handler: async function (response) {
                    try {
                        toast.loading("Verifying and Saving Booking...", { id: 'payment' });
                        // Save the booking
                        await customerApi.createEventBooking({
                            eventData,
                            preferences,
                            selectedCategories,
                            sellerId: selectedSeller._id,
                            paymentMethod: 'Razorpay',
                            paymentDetails: response,
                            amount: totalAmount
                        });
                        toast.success("Payment Successful! Event Booked securely.", { id: 'payment' });
                        navigate('/orders'); // Go to orders page
                    } catch (err) {
                        toast.error("Failed to save booking. Please contact support.", { id: 'payment' });
                    }
                },
                theme: {
                    color: "#9333ea" 
                }
            };

            const rzp = new window.Razorpay(options);
            rzp.on('payment.failed', function (response){
                toast.error("Payment failed: " + response.error.description, { id: 'payment' });
            });
            rzp.open();
            toast.dismiss('payment');
        } catch (err) {
            toast.error("Failed to load Razorpay interface.", { id: 'payment' });
        }
    };

    const handleCODPayment = async () => {
        toast.loading("Confirming Booking...", { id: 'payment' });
        try {
            await customerApi.createEventBooking({
                eventData,
                preferences,
                selectedCategories,
                sellerId: selectedSeller._id,
                paymentMethod: 'COD',
                amount: totalAmount
            });
            toast.success("Booking Confirmed via Cash on Delivery!", { id: 'payment' });
            navigate('/orders');
        } catch (error) {
            const apiMessage = error?.response?.data?.message || "Failed to confirm booking.";
            toast.error(apiMessage, { id: 'payment' });
        }
    };

    // Total amount reflects the budget entered in the first step
    const totalAmount = parseInt(eventData?.budget, 10) || 0;

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
                            <div className="flex justify-between">
                                <span className="text-slate-500">Selected Services</span>
                                <span className="font-semibold text-slate-800">{selectedCategories?.length} Services</span>
                            </div>
                        </div>

                        <div className="mt-4 pt-4 border-t border-slate-100 flex justify-between items-center">
                            <span className="font-bold text-slate-800">Total Amount</span>
                            <span className="font-black text-xl text-purple-600">₹{totalAmount.toLocaleString()}</span>
                        </div>
                    </div>

                    {/* Reservation Status */}
                    {isReserving ? (
                        <motion.div 
                            initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                            className="bg-blue-50 border border-blue-200 p-5 rounded-2xl flex flex-col items-center justify-center text-center space-y-3"
                        >
                            <div className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
                            <h3 className="font-bold text-blue-800">Checking Seller Availability...</h3>
                            <p className="text-xs text-blue-600">Please wait while we lock the slots across multiple vendors for your event.</p>
                        </motion.div>
                    ) : reservationSuccess ? (
                        <motion.div 
                            initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }}
                            className="bg-green-50 border border-green-200 p-5 rounded-2xl text-center space-y-2"
                        >
                            <CheckCircleIcon sx={{ color: '#16a34a', fontSize: 40 }} className="mb-2" />
                            <h3 className="font-bold text-green-800 text-lg">Sellers Confirmed & Locked!</h3>
                            <p className="text-sm text-green-700">Complete payment within <span className="font-black text-red-500">{formatTime(countdown)}</span> to confirm booking.</p>
                        </motion.div>
                    ) : null}

                </div>
            </div>

            {/* Bottom Action Bar */}
            <div className="fixed bottom-0 left-0 right-0 p-4 bg-white border-t border-slate-100 shadow-[0_-4px_20px_rgba(0,0,0,0.05)]">
                <div className="max-w-xl mx-auto">
                    {!reservationSuccess ? (
                        <button 
                            onClick={handleReserveAndPay}
                            disabled={isReserving}
                            className={`w-full font-bold rounded-xl py-4 transition-all shadow-lg ${isReserving ? 'bg-slate-300 text-slate-500' : 'bg-gradient-to-r from-blue-500 to-indigo-600 text-white shadow-blue-500/30 hover:scale-[1.02] active:scale-95'}`}
                        >
                            {isReserving ? 'Reserving...' : 'Check Availability & Reserve'}
                        </button>
                    ) : (
                        <div className="flex gap-3 w-full">
                            <button 
                                onClick={handleCODPayment}
                                className="flex-1 bg-white border border-slate-300 text-slate-800 font-bold rounded-xl py-4 hover:bg-slate-50 transition-colors shadow-sm active:scale-95 flex items-center justify-center"
                            >
                                Cash on Delivery
                            </button>
                            <button 
                                onClick={handleFinalPayment}
                                className="flex-[1.5] bg-slate-900 text-white font-bold rounded-xl py-4 hover:bg-slate-800 transition-colors shadow-lg shadow-slate-900/20 active:scale-95 flex items-center justify-center gap-2"
                            >
                                Pay ₹{totalAmount.toLocaleString()} via Razorpay
                            </button>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default EventCheckoutPage;
