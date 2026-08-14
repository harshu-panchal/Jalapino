import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useNavigate, useLocation } from 'react-router-dom';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import EventIcon from '@mui/icons-material/Event';
import PeopleIcon from '@mui/icons-material/People';
import CurrencyRupeeIcon from '@mui/icons-material/CurrencyRupee';
import WhatsAppIcon from '@mui/icons-material/WhatsApp';
import InfoIcon from '@mui/icons-material/Info';
import CalendarMonthIcon from '@mui/icons-material/CalendarMonth';
import AccessTimeIcon from '@mui/icons-material/AccessTime';
import DeleteIcon from '@mui/icons-material/Delete';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import { generalBookingApi } from '../../services/generalBookingApi';
import { eventConfigApi } from '../../services/eventConfigApi';
import { toast } from 'sonner';

const GeneralBookingForm = () => {
    const navigate = useNavigate();
    const routerLocation = useLocation();
    const { venue } = routerLocation.state || {}; // Pass selected venue from discover screen

    const [bookingType, setBookingType] = useState('Family');
    const [bookingDate, setBookingDate] = useState('');
    const [timeSlot, setTimeSlot] = useState('');
    const [members, setMembers] = useState([
        { name: '', age: '', gender: 'Male', mobileNumber: '' }
    ]);
    const [paymentMethod, setPaymentMethod] = useState('COD');
    const [isLoading, setIsLoading] = useState(false);
    const [isSuccess, setIsSuccess] = useState(false);
    const [bookingResult, setBookingResult] = useState(null);
    const [addonDecoration, setAddonDecoration] = useState(false);
    const [addonBridal, setAddonBridal] = useState(false);
    const [addonCatering, setAddonCatering] = useState(false);

    useEffect(() => {
        if (!venue) {
            toast.error("Please select a venue first.");
            navigate('/plan-my-event/venues');
        }
    }, [venue]);

    const handleAddMember = () => {
        setMembers([...members, { name: '', age: '', gender: 'Male', mobileNumber: '' }]);
    };

    const handleRemoveMember = (index) => {
        if (members.length === 1) return;
        setMembers(members.filter((_, i) => i !== index));
    };

    const handleMemberChange = (index, field, value) => {
        const updated = [...members];
        updated[index][field] = value;
        setMembers(updated);
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!bookingDate || !timeSlot) {
            toast.error("Please select date and time slot.");
            return;
        }

        // Validate all member details
        for (let i = 0; i < members.length; i++) {
            const m = members[i];
            if (!m.name || !m.age || !m.mobileNumber) {
                toast.error(`Please fill details for member #${i + 1}`);
                return;
            }
            if (m.mobileNumber.length !== 10) {
                toast.error(`Mobile number for member #${i + 1} must be exactly 10 digits.`);
                return;
            }
            if (Number(m.age) < 5) {
                toast.error(`Member ${m.name} is below 5 years minimum age limit.`);
                return;
            }
        }

        setIsLoading(true);
        try {
            const res = await generalBookingApi.createBooking({
                venueId: venue._id,
                bookingType,
                bookingDate,
                timeSlot,
                members,
                paymentMethod,
                addons: {
                    decoration: addonDecoration,
                    bridal: addonBridal,
                    catering: addonCatering
                }
            });

            if (paymentMethod === 'Razorpay') {
                const orderData = res.data.result;
                const options = {
                    key: orderData.keyId,
                    amount: orderData.amount * 100,
                    currency: 'INR',
                    name: 'Jalapino Venues',
                    description: `Event Booking for ${venue.name}`,
                    order_id: orderData.razorpayOrderId,
                    handler: async (response) => {
                        try {
                            await generalBookingApi.verifyPayment({
                                bookingId: orderData.bookingId,
                                razorpay_order_id: response.razorpay_order_id,
                                razorpay_payment_id: response.razorpay_payment_id,
                                razorpay_signature: response.razorpay_signature,
                                members
                            });
                            toast.success("Payment successful! Tickets generated.");
                            setBookingResult({
                                bookingId: orderData.bookingId,
                                venueName: venue.name,
                                bookingDate,
                                timeSlot,
                                totalAmount,
                                paymentMethod,
                                membersCount: members.length,
                                members: members
                            });
                            setIsSuccess(true);
                        } catch (err) {
                            toast.error("Payment verification failed");
                        }
                    },
                    prefill: {
                        name: members[0].name,
                        contact: members[0].mobileNumber
                    },
                    theme: {
                        color: '#9333ea'
                    }
                };

                const rzp = new window.Razorpay(options);
                rzp.open();
            } else {
                toast.success("Booking placed successfully under COD!");
                setBookingResult({
                    bookingId: res.data.result?.bookingId || 'COD-Booking',
                    venueName: venue.name,
                    bookingDate,
                    timeSlot,
                    totalAmount,
                    paymentMethod,
                    membersCount: members.length,
                    members: members
                });
                setIsSuccess(true);
            }
        } catch (err) {
            toast.error(err.response?.data?.message || "Booking failed");
        } finally {
            setIsLoading(false);
        }
    };

    if (!venue) return null;

    const pricePerMember = venue.price || 1000;
    
    // Add-on prices calculation
    const decorationPrice = (venue.sellerId?.addonDecorationEnabled && addonDecoration) ? (venue.sellerId.addonDecorationPrice || 0) : 0;
    const bridalPrice = (venue.sellerId?.addonBridalEnabled && addonBridal) ? (venue.sellerId.addonBridalPrice || 0) : 0;
    const cateringPrice = (venue.sellerId?.addonCateringEnabled && addonCatering) ? (venue.sellerId.addonCateringPrice || 0) : 0;
    
    const baseAmount = pricePerMember * members.length;
    const addonsAmount = decorationPrice + bridalPrice + cateringPrice;
    const totalAmount = baseAmount + addonsAmount;

    if (isSuccess && bookingResult) {
        return (
            <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center font-sans p-4">
                <motion.div 
                    initial={{ scale: 0.9, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    className="bg-white rounded-3xl p-8 max-w-md w-full shadow-xl border border-slate-100 text-center space-y-6"
                >
                    <div className="flex justify-center">
                        <motion.div
                            initial={{ scale: 0 }}
                            animate={{ scale: 1 }}
                            transition={{ type: "spring", stiffness: 200, damping: 15, delay: 0.2 }}
                            className="h-20 w-20 bg-green-50 rounded-full flex items-center justify-center text-green-500 shadow-inner"
                        >
                            <CheckCircleIcon sx={{ fontSize: 48 }} />
                        </motion.div>
                    </div>

                    <div className="space-y-2">
                        <h2 className="text-2xl font-black text-slate-800">Booking Confirmed!</h2>
                        <p className="text-xs text-slate-400 font-bold">Your booking has been successfully placed.</p>
                    </div>

                    <div className="bg-slate-50 rounded-2xl p-5 text-left space-y-3.5 border border-slate-100">
                        <div className="flex justify-between items-center text-xs">
                            <span className="text-slate-400 font-bold">Venue Name</span>
                            <span className="text-slate-800 font-black text-right max-w-[200px] truncate">{bookingResult.venueName}</span>
                        </div>
                        <div className="flex justify-between items-center text-xs">
                            <span className="text-slate-400 font-bold">Preferred Date</span>
                            <span className="text-slate-800 font-black">{bookingResult.bookingDate}</span>
                        </div>
                        <div className="flex justify-between items-center text-xs">
                            <span className="text-slate-400 font-bold">Time Slot</span>
                            <span className="text-slate-800 font-black">{bookingResult.timeSlot}</span>
                        </div>
                        <div className="flex justify-between items-center text-xs">
                            <span className="text-slate-400 font-bold">Total Members</span>
                            <span className="text-slate-800 font-black">{bookingResult.membersCount} Member(s)</span>
                        </div>
                        {bookingResult.members && bookingResult.members.length > 0 && (
                            <div className="border-t border-slate-100 pt-3 mt-2 space-y-1.5">
                                <span className="text-[10px] text-slate-400 font-black uppercase block mb-1">Booked Members</span>
                                {bookingResult.members.map((m, idx) => (
                                    <div key={idx} className="flex justify-between text-xs font-semibold text-slate-700">
                                        <span>{idx + 1}. {m.name}</span>
                                        <span className="text-slate-500">{m.age} Yrs ({m.gender})</span>
                                    </div>
                                ))}
                            </div>
                        )}
                        <div className="flex justify-between items-center text-xs border-t border-slate-200/60 pt-3">
                            <span className="text-slate-500 font-black">Amount Paid ({bookingResult.paymentMethod})</span>
                            <span className="text-purple-600 font-black text-sm">₹{bookingResult.totalAmount}</span>
                        </div>
                    </div>

                    <button 
                        onClick={() => navigate('/profile/tickets', { replace: true })}
                        className="w-full py-4 bg-purple-600 hover:bg-purple-700 text-white font-black text-xs rounded-2xl shadow-lg shadow-purple-600/20 transition-all uppercase tracking-wider"
                    >
                        Go to Ticket Wallet
                    </button>
                </motion.div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-slate-50 flex flex-col font-sans">
            {/* Header */}
            <div className="sticky top-0 bg-white z-40 border-b border-slate-100 px-4 py-3 flex items-center shadow-sm">
                <button onClick={() => navigate(-1)} className="p-2 rounded-full hover:bg-slate-100 transition-colors mr-2">
                    <ArrowBackIcon />
                </button>
                <div>
                    <h1 className="text-base font-black text-slate-800">Event / Venue Booking</h1>
                    <p className="text-[11px] text-slate-500 font-bold">{venue.name}</p>
                </div>
            </div>

            <div className="flex-1 max-w-2xl mx-auto w-full px-4 py-6 pb-24">
                <form onSubmit={handleSubmit} className="space-y-6">
                    {/* Booking Details Card */}
                    <div className="bg-white rounded-3xl p-6 border border-slate-100 shadow-sm space-y-4">
                        <h3 className="text-sm font-black text-slate-800 flex items-center gap-1.5">
                            <EventIcon className="text-purple-600" fontSize="small" />
                            Booking Schedule & Details
                        </h3>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            <div>
                                <label className="block text-xs font-black uppercase text-slate-500 mb-1.5">Booking Type</label>
                                <select 
                                    value={bookingType}
                                    onChange={(e) => setBookingType(e.target.value)}
                                    className="w-full border border-slate-200 rounded-xl p-2.5 text-sm outline-none focus:ring-2 focus:ring-purple-600 bg-white"
                                >
                                    <option value="Family">Family</option>
                                    <option value="Group">Group</option>
                                    <option value="Corporate">Corporate</option>
                                    <option value="School">School</option>
                                    <option value="Others">Others</option>
                                </select>
                            </div>

                            <div>
                                <label className="block text-xs font-black uppercase text-slate-500 mb-1.5">Preferred Date</label>
                                <div className="relative">
                                    <CalendarMonthIcon className="absolute left-3 top-3 text-slate-400" fontSize="small" />
                                    <input 
                                        type="date"
                                        required
                                        min={new Date().toISOString().split('T')[0]}
                                        value={bookingDate}
                                        onChange={(e) => setBookingDate(e.target.value)}
                                        className="w-full pl-10 pr-4 py-2.5 border border-slate-200 rounded-xl text-sm outline-none focus:ring-2 focus:ring-purple-600 text-slate-700 bg-white"
                                    />
                                </div>
                            </div>

                            <div className="sm:col-span-2">
                                <label className="block text-xs font-black uppercase text-slate-500 mb-1.5">Time Slot</label>
                                <div className="relative">
                                    <AccessTimeIcon className="absolute left-3 top-3 text-slate-400" fontSize="small" />
                                    <select 
                                        required
                                        value={timeSlot}
                                        onChange={(e) => setTimeSlot(e.target.value)}
                                        className="w-full pl-10 pr-4 py-2.5 border border-slate-200 rounded-xl text-sm outline-none focus:ring-2 focus:ring-purple-600 text-slate-700 bg-white"
                                    >
                                        <option value="">Select Time Slot</option>
                                        <option value="10:00 AM - 12:00 PM">10:00 AM - 12:00 PM</option>
                                        <option value="12:00 PM - 02:00 PM">12:00 PM - 02:00 PM</option>
                                        <option value="02:00 PM - 04:00 PM">02:00 PM - 04:00 PM</option>
                                        <option value="04:00 PM - 06:00 PM">04:00 PM - 06:00 PM</option>
                                    </select>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Member Details list */}
                    <div className="bg-white rounded-3xl p-6 border border-slate-100 shadow-sm space-y-4">
                        <div className="flex items-center justify-between">
                            <h3 className="text-sm font-black text-slate-800 flex items-center gap-1.5">
                                <PeopleIcon className="text-purple-600" fontSize="small" />
                                Member Profiles
                            </h3>
                            <button 
                                type="button"
                                onClick={handleAddMember}
                                className="text-xs font-black text-purple-600 hover:text-purple-700 bg-purple-50 px-3 py-1.5 rounded-lg"
                            >
                                + Add Member
                            </button>
                        </div>

                        <div className="space-y-4">
                            {members.map((member, index) => (
                                <div key={index} className="p-4 border border-slate-100 rounded-2xl relative bg-slate-50/50 space-y-3">
                                    {members.length > 1 && (
                                        <button 
                                            type="button"
                                            onClick={() => handleRemoveMember(index)}
                                            className="absolute top-3 right-4 p-1.5 bg-rose-50 hover:bg-rose-100 text-rose-600 rounded-xl transition-colors"
                                            title="Remove Member"
                                        >
                                            <DeleteIcon sx={{ fontSize: 16 }} />
                                        </button>
                                    )}
                                    <p className="text-[10px] font-black uppercase text-slate-400">Member #{index + 1}</p>
                                    
                                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                                        <div className="sm:col-span-2">
                                            <input 
                                                type="text"
                                                placeholder="Full Name"
                                                required
                                                value={member.name}
                                                onChange={(e) => handleMemberChange(index, 'name', e.target.value)}
                                                className="w-full border border-slate-200 rounded-xl p-2.5 text-xs outline-none focus:ring-2 focus:ring-purple-600 bg-white"
                                            />
                                        </div>
                                        <div>
                                            <input 
                                                type="number"
                                                placeholder="Age"
                                                required
                                                min="1"
                                                value={member.age}
                                                onChange={(e) => handleMemberChange(index, 'age', e.target.value)}
                                                className="w-full border border-slate-200 rounded-xl p-2.5 text-xs outline-none focus:ring-2 focus:ring-purple-600 bg-white"
                                            />
                                        </div>
                                        <div>
                                            <select 
                                                value={member.gender}
                                                onChange={(e) => handleMemberChange(index, 'gender', e.target.value)}
                                                className="w-full border border-slate-200 rounded-xl p-2.5 text-xs outline-none focus:ring-2 focus:ring-purple-600 bg-white text-slate-700"
                                            >
                                                <option value="Male">Male</option>
                                                <option value="Female">Female</option>
                                                <option value="Other">Other</option>
                                            </select>
                                        </div>
                                        <div className="sm:col-span-2 relative">
                                            <WhatsAppIcon className="absolute left-3 top-3 text-slate-400" fontSize="small" />
                                            <input 
                                                type="tel"
                                                placeholder="WhatsApp / Mobile Number"
                                                required
                                                value={member.mobileNumber}
                                                onChange={(e) => {
                                                    const val = e.target.value.replace(/\D/g, '').slice(0, 10);
                                                    handleMemberChange(index, 'mobileNumber', val);
                                                }}
                                                className="w-full pl-10 pr-4 py-2.5 border border-slate-200 rounded-xl text-xs outline-none focus:ring-2 focus:ring-purple-600 bg-white"
                                            />
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* Optional Add-on Services */}
                    {(venue.sellerId?.addonDecorationEnabled || venue.sellerId?.addonBridalEnabled || venue.sellerId?.addonCateringEnabled) && (
                        <div className="bg-white rounded-3xl p-6 border border-slate-100 shadow-sm space-y-4">
                            <h3 className="text-sm font-black text-slate-800 flex items-center gap-1.5">
                                <InfoIcon className="text-purple-600" fontSize="small" />
                                Customize Booking with Add-ons
                            </h3>
                            <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Select optional services to enhance your experience</p>

                            <div className="space-y-3">
                                {venue.sellerId?.addonDecorationEnabled && (
                                    <div 
                                        onClick={() => setAddonDecoration(!addonDecoration)}
                                        className={`p-4 border-2 rounded-2xl cursor-pointer flex items-center justify-between transition-all ${addonDecoration ? 'border-purple-600 bg-purple-50/20' : 'border-slate-100 hover:bg-slate-50'}`}
                                    >
                                        <div>
                                            <p className="text-xs font-black text-slate-800">Decoration Service</p>
                                            <p className="text-[10px] text-slate-500 font-medium">Beautiful customized decoration at the venue</p>
                                        </div>
                                        <div className="text-right flex flex-col items-end justify-center">
                                            <span className="text-xs font-black text-purple-600">+₹{venue.sellerId.addonDecorationPrice || 0}</span>
                                            <div className={`w-5 h-5 rounded-md border-2 mt-1.5 flex items-center justify-center transition-all ${addonDecoration ? 'bg-purple-600 border-purple-600' : 'border-slate-300'}`}>
                                                {addonDecoration && <span className="text-white text-[10px]">✓</span>}
                                            </div>
                                        </div>
                                    </div>
                                )}

                                {venue.sellerId?.addonBridalEnabled && (
                                    <div 
                                        onClick={() => setAddonBridal(!addonBridal)}
                                        className={`p-4 border-2 rounded-2xl cursor-pointer flex items-center justify-between transition-all ${addonBridal ? 'border-purple-600 bg-purple-50/20' : 'border-slate-100 hover:bg-slate-50'}`}
                                    >
                                        <div>
                                            <p className="text-xs font-black text-slate-800">Bridal Room / Package</p>
                                            <p className="text-[10px] text-slate-500 font-medium">Exclusive room and facilities for bride/groom</p>
                                        </div>
                                        <div className="text-right flex flex-col items-end justify-center">
                                            <span className="text-xs font-black text-purple-600">+₹{venue.sellerId.addonBridalPrice || 0}</span>
                                            <div className={`w-5 h-5 rounded-md border-2 mt-1.5 flex items-center justify-center transition-all ${addonBridal ? 'bg-purple-600 border-purple-600' : 'border-slate-300'}`}>
                                                {addonBridal && <span className="text-white text-[10px]">✓</span>}
                                            </div>
                                        </div>
                                    </div>
                                )}

                                {venue.sellerId?.addonCateringEnabled && (
                                    <div 
                                        onClick={() => setAddonCatering(!addonCatering)}
                                        className={`p-4 border-2 rounded-2xl cursor-pointer flex items-center justify-between transition-all ${addonCatering ? 'border-purple-600 bg-purple-50/20' : 'border-slate-100 hover:bg-slate-50'}`}
                                    >
                                        <div>
                                            <p className="text-xs font-black text-slate-800">Catering Service</p>
                                            <p className="text-[10px] text-slate-500 font-medium">Premium food and catering service for all members</p>
                                        </div>
                                        <div className="text-right flex flex-col items-end justify-center">
                                            <span className="text-xs font-black text-purple-600">+₹{venue.sellerId.addonCateringPrice || 0}</span>
                                            <div className={`w-5 h-5 rounded-md border-2 mt-1.5 flex items-center justify-center transition-all ${addonCatering ? 'bg-purple-600 border-purple-600' : 'border-slate-300'}`}>
                                                {addonCatering && <span className="text-white text-[10px]">✓</span>}
                                            </div>
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>
                    )}

                    {/* Payment Option Selection */}
                    <div className="bg-white rounded-3xl p-6 border border-slate-100 shadow-sm space-y-4">
                        <h3 className="text-sm font-black text-slate-800 flex items-center gap-1.5">
                            <CurrencyRupeeIcon className="text-purple-600" fontSize="small" />
                            Payment Method
                        </h3>
                        <div className={`grid gap-4 ${[
                            venue.sellerId?.acceptsCOD !== false,
                            venue.sellerId?.acceptsRazorpay !== false,
                            venue.sellerId?.physicalPaymentEnabled
                        ].filter(Boolean).length === 3 ? 'grid-cols-3' : [
                            venue.sellerId?.acceptsCOD !== false,
                            venue.sellerId?.acceptsRazorpay !== false,
                            venue.sellerId?.physicalPaymentEnabled
                        ].filter(Boolean).length === 2 ? 'grid-cols-2' : 'grid-cols-1'}`}>
                            {venue.sellerId?.acceptsCOD !== false && (
                                <div 
                                    onClick={() => setPaymentMethod('COD')}
                                    className={`p-4 border-2 rounded-2xl cursor-pointer text-center transition-all ${paymentMethod === 'COD' ? 'border-purple-600 bg-purple-50/30' : 'border-slate-100 hover:bg-slate-50'}`}
                                >
                                    <p className="text-sm font-black text-slate-800">COD</p>
                                    <p className="text-[10px] text-slate-500 font-bold mt-1">Cash on Delivery</p>
                                </div>
                            )}
                            {venue.sellerId?.acceptsRazorpay !== false && (
                                <div 
                                    onClick={() => setPaymentMethod('Razorpay')}
                                    className={`p-4 border-2 rounded-2xl cursor-pointer text-center transition-all ${paymentMethod === 'Razorpay' ? 'border-purple-600 bg-purple-50/30' : 'border-slate-100 hover:bg-slate-50'}`}
                                >
                                    <p className="text-sm font-black text-slate-800">Online Pay</p>
                                    <p className="text-[10px] text-slate-500 font-bold mt-1">Razorpay / UPI / Cards</p>
                                </div>
                            )}
                            {venue.sellerId?.physicalPaymentEnabled && (
                                <div 
                                    onClick={() => setPaymentMethod('Physical')}
                                    className={`p-4 border-2 rounded-2xl cursor-pointer text-center transition-all ${paymentMethod === 'Physical' ? 'border-purple-600 bg-purple-50/30' : 'border-slate-100 hover:bg-slate-50'}`}
                                >
                                    <p className="text-sm font-black text-slate-800">Physical / QR</p>
                                    <p className="text-[10px] text-slate-500 font-bold mt-1">Scan Code at Venue</p>
                                </div>
                            )}
                        </div>

                        {paymentMethod === 'Physical' && venue.sellerId?.paymentQrCode && (
                            <div className="mt-4 border border-dashed border-purple-200 rounded-2xl p-4 bg-purple-50/10 text-center space-y-2">
                                <p className="text-xs font-black text-slate-700">Scan QR Code to Pay</p>
                                <img src={venue.sellerId.paymentQrCode} alt="Seller Payment QR" className="mx-auto h-48 w-48 object-contain rounded-xl border border-slate-100 bg-white p-2 shadow-sm" />
                                <p className="text-[10px] text-slate-500 font-medium">Please scan the QR code using any UPI app and confirm booking.</p>
                            </div>
                        )}

                        {/* Invoice details */}
                        <div className="border-t border-slate-100 pt-4 space-y-2">
                            <div className="flex justify-between items-center text-xs text-slate-500 font-bold">
                                <span>Ticket Price ({members.length} x ₹{pricePerMember})</span>
                                <span>₹{baseAmount}</span>
                            </div>
                            {addonDecoration && (
                                <div className="flex justify-between items-center text-xs text-slate-500 font-bold">
                                    <span>Decoration Service Add-on</span>
                                    <span>+₹{venue.sellerId.addonDecorationPrice}</span>
                                </div>
                            )}
                            {addonBridal && (
                                <div className="flex justify-between items-center text-xs text-slate-500 font-bold">
                                    <span>Bridal Room Add-on</span>
                                    <span>+₹{venue.sellerId.addonBridalPrice}</span>
                                </div>
                            )}
                            {addonCatering && (
                                <div className="flex justify-between items-center text-xs text-slate-500 font-bold">
                                    <span>Catering Service Add-on</span>
                                    <span>+₹{venue.sellerId.addonCateringPrice}</span>
                                </div>
                            )}
                            <div className="flex justify-between items-center border-t border-slate-100 pt-2 text-sm font-black text-slate-800">
                                <span>Total Payable</span>
                                <span className="text-lg font-black text-slate-900">₹{totalAmount}</span>
                            </div>
                        </div>
                    </div>

                    {/* Submit Booking Button */}
                    <button 
                        type="submit"
                        disabled={isLoading}
                        className="w-full bg-slate-900 text-white font-bold rounded-2xl py-4 hover:bg-black transition-all active:scale-[0.98] disabled:opacity-60 text-sm shadow-md"
                    >
                        {isLoading ? 'Processing Booking...' : `Confirm & Pay ₹${totalAmount}`}
                    </button>
                </form>
            </div>
        </div>
    );
};

export default GeneralBookingForm;
