import React, { useEffect, useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Package, ChevronRight, Clock, CheckCircle, Loader2, ChevronLeft, Edit2, XCircle, X, AlertCircle } from 'lucide-react';
import { customerApi } from '../services/customerApi';
import { getOrderStatusLabel, getLegacyStatusFromOrder } from '@/shared/utils/orderStatus';
import { applyCloudinaryTransform } from '@/core/utils/imageUtils';
import { useSettings } from '@/core/context/SettingsContext';
import { toast } from 'sonner';

const OrdersPage = () => {
    const navigate = useNavigate();
    const { settings } = useSettings();
    const [activeTab, setActiveTab] = useState(() => {
        return sessionStorage.getItem('jalapino_orders_tab') || 'orders';
    });

    useEffect(() => {
        sessionStorage.setItem('jalapino_orders_tab', activeTab);
    }, [activeTab]);
    const [orders, setOrders] = useState([]);
    const [eventBookings, setEventBookings] = useState([]);
    const [loading, setLoading] = useState(true);
    const [editingEvent, setEditingEvent] = useState(null);
    const [editFormData, setEditFormData] = useState({ guestCount: '', budget: '', date: '', time: '', location: '' });

    // Alternative Seller States
    const [altModalOpen, setAltModalOpen] = useState(false);
    const [altLoading, setAltLoading] = useState(false);
    const [altSellers, setAltSellers] = useState([]);
    const [selectedServiceForAlt, setSelectedServiceForAlt] = useState(null);
    const [selectedAltBookingId, setSelectedAltBookingId] = useState(null);

    // Support Ticket State
    const [ticketModalOpen, setTicketModalOpen] = useState(false);
    const [ticketFormData, setTicketFormData] = useState({ subject: '', category: 'booking', description: '', priority: 'medium' });

    useEffect(() => {
        const fetchOrders = async () => {
            try {
                const response = await customerApi.getMyOrders();
                const payload = response?.data;
                const items =
                    payload?.result?.items ||
                    payload?.results ||
                    [];
                setOrders(Array.isArray(items) ? items : []);
                
                try {
                    const eventRes = await customerApi.getMyEventBookings();
                    const eventItems = eventRes.data?.results || eventRes.data?.result || [];
                    setEventBookings(Array.isArray(eventItems) ? eventItems : []);
                } catch (err) {
                    console.warn("[OrdersPage] Event API error:", err?.response?.data?.message);
                }

            } catch (error) {
                console.error("Failed to fetch orders:", error);
            } finally {
                setLoading(false);
            }
        };

        fetchOrders();
    }, []);

    const handleCancelEvent = async (id) => {
        if (!window.confirm("Are you sure you want to cancel this event booking?")) return;
        try {
            toast.loading("Cancelling booking...", { id: 'cancel' });
            await customerApi.cancelEventBooking(id);
            setEventBookings(prev => prev.map(b => b._id === id ? { ...b, overallStatus: 'CANCELLED' } : b));
            toast.success("Booking cancelled successfully", { id: 'cancel' });
        } catch (error) {
            toast.error("Failed to cancel booking", { id: 'cancel' });
        }
    };

    const handleEditClick = (booking) => {
        setEditingEvent(booking);
        setEditFormData({
            guestCount: booking.guestCount || '',
            budget: booking.budget || '',
            date: booking.eventDate ? new Date(booking.eventDate).toISOString().split('T')[0] : '',
            time: booking.eventTime || '',
            location: booking.location?.address || booking.location || ''
        });
    };

    const handleSaveEdit = async () => {
        try {
            toast.loading("Saving changes...", { id: 'edit' });
            const { data } = await customerApi.updateEventBooking(editingEvent._id, { eventData: editFormData });
            setEventBookings(prev => prev.map(b => b._id === editingEvent._id ? (data.result || data) : b));
            setEditingEvent(null);
            toast.success("Event updated successfully", { id: 'edit' });
        } catch (error) {
            toast.error("Failed to update event", { id: 'edit' });
        }
    };

    const handleCODPayment = async (booking) => {
        toast.loading("Confirming Booking...", { id: 'payment' });
        try {
            await customerApi.updateEventBooking(booking._id, { paymentMode: 'COD', paymentStatus: 'PENDING', overallStatus: 'CONFIRMED' });
            toast.success("Booking Confirmed via Cash on Delivery!", { id: 'payment' });
            const eventRes = await customerApi.getMyEventBookings();
            setEventBookings(eventRes.data?.results || eventRes.data?.result || []);
        } catch (error) {
            toast.error("Failed to confirm booking.", { id: 'payment' });
        }
    };

    const handleRazorpayPayment = async (booking) => {
        try {
            toast.loading("Initiating Gateway...", { id: 'payment' });
            
            // GASP: Calculate Advance Amount
            const advanceLimit = settings?.bookingControl?.advanceBookingLimitPercent ?? 20;
            const advanceAmount = Math.round((booking.totalAmount * advanceLimit) / 100);

            // 1. Create Gateway Order
            const rzpRes = await customerApi.createRazorpayOrder(booking._id, { amount: advanceAmount });
            
            if (!rzpRes.data || !rzpRes.data.result) {
                throw new Error("Failed to create Razorpay order");
            }

            const options = {
                key: "rzp_test_S3IcSS1NbymL6D", 
                amount: rzpRes.data.result.amount,
                currency: "INR",
                name: "Jalapino Events",
                description: `Payment for Booking ${booking.bookingId}`,
                order_id: rzpRes.data.result.id,
                handler: async function (response) {
                    try {
                        toast.loading("Verifying payment...", { id: 'payment' });
                        // We trust Razorpay success and update the booking
                        await customerApi.updateEventBooking(booking._id, { 
                            paymentMode: 'ONLINE', 
                            paymentStatus: 'ADVANCE_PAID', 
                            overallStatus: 'CONFIRMED' 
                        });
                        
                        toast.success("Advance Payment successful! Booking confirmed.", { id: 'payment' });
                        setEventBookings(prev => prev.map(b => b._id === booking._id 
                            ? { ...b, paymentMode: 'ONLINE', paymentStatus: 'ADVANCE_PAID', overallStatus: 'CONFIRMED' } 
                            : b));
                    } catch (err) {
                        toast.error("Failed to confirm booking after payment.", { id: 'payment' });
                    }
                },
                theme: {
                    color: "#9333ea" // purple-600
                }
            };

            const rzp = new window.Razorpay(options);
            rzp.on('payment.failed', function (response){
                toast.error("Payment failed: " + response.error.description, { id: 'payment' });
            });
            rzp.open();
            toast.dismiss('payment');
        } catch (error) {
            toast.error(error.message || "Failed to initiate Razorpay payment", { id: 'payment' });
        }
    };

    const handleOpenAlternative = async (bookingId, service) => {
        setSelectedServiceForAlt(service);
        setSelectedAltBookingId(bookingId);
        setAltModalOpen(true);
        setAltLoading(true);
        try {
            const res = await customerApi.getAlternativeSellers(bookingId, service.category._id || service.category);
            setAltSellers(res.data?.result || res.data || []);
        } catch (error) {
            toast.error("Failed to fetch alternative sellers");
        } finally {
            setAltLoading(false);
        }
    };

    const handleReassignSeller = async (newSellerId) => {
        toast.loading("Reassigning seller...", { id: 'reassign' });
        try {
            await customerApi.reassignSeller(selectedAltBookingId, {
                categoryId: selectedServiceForAlt.category._id || selectedServiceForAlt.category,
                newSellerId: newSellerId
            });
            toast.success("Seller reassigned successfully! Waiting for their approval.", { id: 'reassign' });
            setAltModalOpen(false);
            
            // Refresh bookings
            const eventRes = await customerApi.getMyEventBookings();
            setEventBookings(eventRes.data?.results || eventRes.data?.result || []);
        } catch (error) {
            toast.error(error.response?.data?.message || "Failed to reassign seller", { id: 'reassign' });
        }
    };

    if (loading) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-[#FAF8F6]">
                <div className="flex items-center gap-3 px-4 py-3 rounded-2xl bg-white shadow-sm border border-slate-100">
                    <Loader2 className="animate-spin text-brand-600" size={22} />
                    <span className="text-sm font-medium text-slate-600">Loading your orders…</span>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-[#FAF8F6] pb-24">
            <div 
                style={{
                    background: "var(--customer-header-gradient)",
                    backdropFilter: "blur(20px) saturate(180%)",
                    WebkitBackdropFilter: "blur(20px) saturate(180%)",
                    borderBottom: "1px solid rgba(255, 255, 255, 0.08)",
                    borderBottomLeftRadius: "20px",
                    borderBottomRightRadius: "20px",
                }}
                className="sticky top-0 z-30 px-4 py-3 flex items-center gap-2 mb-4 shadow-[0_8px_32px_rgba(0,0,0,0.12)]"
            >
                <button
                    onClick={() => navigate(-1)}
                    className="w-10 h-10 flex items-center justify-center hover:bg-white/10 rounded-full transition-colors -ml-1"
                >
                    <ChevronLeft size={22} className="text-white" />
                </button>
                <h1 className="text-xl font-bold text-white tracking-tight font-['Inter']">My Orders</h1>
            </div>

            <div className="flex bg-white px-4 pt-2 border-b border-slate-100 mb-4 shadow-sm sticky top-[64px] z-20">
                <button 
                    onClick={() => setActiveTab('orders')}
                    className={`flex-1 py-3 text-sm font-bold border-b-2 transition-colors ${activeTab === 'orders' ? 'border-brand-600 text-brand-600' : 'border-transparent text-slate-500'}`}
                >
                    Retail / Wholesale
                </button>
                <button 
                    onClick={() => setActiveTab('events')}
                    className={`flex-1 py-3 text-sm font-bold border-b-2 transition-colors ${activeTab === 'events' ? 'border-brand-600 text-brand-600' : 'border-transparent text-slate-500'}`}
                >
                    Event Bookings
                </button>
            </div>

            <div className="space-y-4 px-4 pb-2">
                {activeTab === 'orders' && orders.length === 0 && (
                    <div className="flex flex-col items-center justify-center py-20 text-center">
                        <Package size={56} className="text-slate-300 mb-4" />
                        <h3 className="text-base font-semibold text-slate-900 mb-1">No orders yet</h3>
                        <p className="text-slate-500 text-sm mb-6 max-w-[260px]">
                            When you place an order, it will appear here so you can track it easily.
                        </p>
                        <Link to="/" className="bg-primary hover:bg-[#0a6d19] text-white px-7 py-2.5 rounded-full font-semibold text-sm shadow-sm transition-colors">
                            Start Shopping
                        </Link>
                    </div>
                )}

                {activeTab === 'orders' && orders.length > 0 && (
                    orders.map((order) => {
                        const legacy = getLegacyStatusFromOrder(order);
                        return (
                        <Link
                            to={`/orders/${order.orderId}`}
                            key={order._id}
                            className="block bg-white rounded-2xl px-4 py-3.5 shadow-[0_8px_24px_rgba(15,23,42,0.06)] border border-slate-100/80 active:scale-[0.985] transition-transform cursor-pointer hover:shadow-[0_10px_30px_rgba(15,23,42,0.08)]"
                        >
                            <div className="flex justify-between items-start gap-3 mb-3.5">
                                <div className="flex gap-3.5 flex-1 min-w-0">
                                    <div className="h-12 w-12 rounded-xl overflow-hidden flex items-center justify-center bg-slate-50 ring-1 ring-slate-200/90 shrink-0">
                                        {order.items[0]?.image ? (
                                            <img
                                                src={applyCloudinaryTransform(order.items[0].image)}
                                                alt={order.items[0]?.name || 'Order thumbnail'}
                                                loading="lazy"
                                                className="w-full h-full object-cover"
                                            />
                                        ) : (
                                            <Package size={22} className="text-slate-400" />
                                        )}
                                    </div>
                                    <div className="min-w-0">
                                        <h3 className="font-semibold text-slate-900 text-sm tracking-tight leading-snug">
                                            Order #{order.orderId.slice(-6)}
                                        </h3>
                                        <p className="mt-0.5 text-[11px] text-slate-500 font-medium leading-tight">
                                            {new Date(order.createdAt).toLocaleDateString('en-IN', {
                                                day: 'numeric',
                                                month: 'short',
                                            })}{' '}
                                            <span className="mx-1 text-slate-400">•</span>
                                            {new Date(order.createdAt).toLocaleTimeString('en-IN', {
                                                hour: '2-digit',
                                                minute: '2-digit',
                                            })}
                                        </p>
                                    </div>
                                </div>
                                <div className="flex flex-col items-end gap-1 shrink-0 text-right">
                                    <span
                                        className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.12em] ${
                                            legacy === 'delivered'
                                                ? 'bg-brand-50 text-brand-700 border-brand-100'
                                                : legacy === 'cancelled'
                                                    ? 'bg-rose-50 text-rose-700 border-rose-100'
                                                    : 'bg-brand-50 text-brand-700 border-brand-100'
                                        }`}
                                    >
                                        <span className="flex h-4 w-4 items-center justify-center rounded-full bg-white/80">
                                            <CheckCircle
                                                size={9}
                                                className={`${
                                                    legacy === 'delivered'
                                                        ? 'text-brand-600'
                                                        : legacy === 'cancelled'
                                                            ? 'text-rose-500'
                                                            : 'text-brand-500'
                                                }`}
                                            />
                                        </span>
                                        <span>{getOrderStatusLabel(order).toUpperCase()}</span>
                                    </span>
                                    <span className="inline-flex items-center text-[10px] font-medium text-slate-400">
                                        <span className="h-1 w-1 rounded-full bg-slate-300 mr-1" />
                                        Tap to view details
                                    </span>
                                </div>
                            </div>

                            <div className="border-t border-slate-100 pt-3 flex justify-between items-center gap-3">
                                <div className="text-[11px] text-slate-500 font-medium truncate max-w-[230px]">
                                    {order.items.map((i) => i.name).join(', ')}
                                </div>
                                <div className="flex items-center gap-1.5 shrink-0">
                                    <span className="text-[11px] font-medium text-slate-400">Total</span>
                                    <span className="text-sm font-semibold text-slate-900">
                                    ₹{order.pricing.total}
                                    </span>
                                    <ChevronRight size={16} className="text-slate-300" />
                                </div>
                            </div>
                        </Link>
                        );
                    })
                )}

                {activeTab === 'events' && eventBookings.length === 0 && (
                    <div className="flex flex-col items-center justify-center py-20 text-center">
                        <Clock size={56} className="text-slate-300 mb-4" />
                        <h3 className="text-base font-semibold text-slate-900 mb-1">No event bookings yet</h3>
                        <p className="text-slate-500 text-sm mb-6 max-w-[260px]">
                            You haven't planned any events yet. Let Jalapino make your next event memorable!
                        </p>
                        <Link to="/plan-my-event" className="bg-purple-600 hover:bg-purple-700 text-white px-7 py-2.5 rounded-full font-semibold text-sm shadow-sm transition-colors">
                            Plan an Event
                        </Link>
                    </div>
                )}

                {activeTab === 'events' && eventBookings.length > 0 && (
                    eventBookings.map((booking) => (
                        <div
                            key={booking._id}
                            className="block bg-white rounded-2xl px-4 py-3.5 shadow-[0_8px_24px_rgba(15,23,42,0.06)] border border-slate-100/80 mb-4"
                        >
                            <div className="flex justify-between items-start mb-3">
                                <div>
                                    <h3 className="font-bold text-slate-900 capitalize text-sm">
                                        {booking.eventType} Event
                                    </h3>
                                    <p className="text-xs text-slate-500 mt-0.5">
                                        {new Date(booking.eventDate).toLocaleDateString()} at {booking.eventTime}
                                    </p>
                                </div>
                                <span className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[10px] font-bold uppercase ${booking.overallStatus === 'CANCELLED' ? 'bg-rose-50 text-rose-700 border-rose-100' : 'bg-purple-50 text-purple-700 border-purple-100'}`}>
                                    {booking.overallStatus || booking.status}
                                </span>
                            </div>
                            <div className="text-xs text-slate-600 mb-3 space-y-1">
                                <p><span className="font-medium">Location:</span> {booking.location?.address || booking.location || 'Pending Location'}</p>
                                <p><span className="font-medium">Guests:</span> {booking.guestCount} People</p>
                            </div>

                            <div className="mb-4">
                                <p className="text-xs font-bold text-slate-700 mb-2 uppercase tracking-wider">Requested Services</p>
                                <div className="space-y-2">
                                    {(booking.services || []).map((service, idx) => (
                                        <div key={idx} className="bg-slate-50 p-3 rounded-xl border border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                                            <div>
                                                <p className="text-sm font-bold text-slate-800">{service.category?.name || 'Category'}</p>
                                                <p className="text-[11px] text-slate-500">Provider: {service.seller?.name || service.seller?.businessName || 'Assigned Seller'}</p>
                                            </div>
                                            <div className="flex items-center gap-2">
                                                <span className={`text-[10px] font-bold px-2 py-1 rounded-md uppercase ${
                                                    service.status === 'ACCEPTED' ? 'bg-green-100 text-green-700' :
                                                    service.status === 'REJECTED' ? 'bg-rose-100 text-rose-700' :
                                                    'bg-amber-100 text-amber-700'
                                                }`}>
                                                    {service.status || 'PENDING'}
                                                </span>
                                                {service.status === 'REJECTED' && (
                                                    <button 
                                                        onClick={() => handleOpenAlternative(booking._id, service)}
                                                        className="text-[10px] font-bold bg-purple-100 text-purple-700 px-3 py-1 rounded-md hover:bg-purple-200 transition-colors whitespace-nowrap"
                                                    >
                                                        Find Alternative
                                                    </button>
                                                )}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>

                            <div className="border-t border-slate-100 pt-3 flex justify-between items-center mb-3">
                                <span className="text-[11px] font-medium text-slate-500">
                                    Payment: {booking.paymentMode || 'ONLINE'} ({booking.paymentStatus})
                                </span>
                                <span className="text-sm font-bold text-slate-900">
                                    ₹{booking.totalAmount?.toLocaleString()}
                                </span>
                            </div>

                            {booking.overallStatus === 'PAYMENT_PENDING' && (
                                <div className="flex gap-2 border-t border-slate-100 pt-3 flex-col sm:flex-row">
                                    <button 
                                        onClick={() => handleCODPayment(booking)}
                                        className="flex-1 flex items-center justify-center py-2.5 text-xs font-bold text-slate-700 bg-white border border-slate-300 rounded-xl hover:bg-slate-50 transition-colors"
                                    >
                                        Cash on Delivery
                                    </button>
                                </div>
                            )}
                            
                            {booking.overallStatus === 'PENDING' && booking.paymentStatus === 'PENDING' && (settings?.paymentControl?.paymentGateway && settings?.paymentControl?.paymentGateway !== 'none') && (
                                <div className="border-t border-slate-100 pt-3">
                                    <button
                                        onClick={() => handleRazorpayPayment(booking)}
                                        className="w-full flex items-center justify-center gap-2 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 text-white py-3 rounded-xl text-sm font-bold transition-all shadow-lg shadow-purple-200"
                                    >
                                        <CreditCard className="h-4 w-4" />
                                        Pay ₹{Math.round((booking.totalAmount * (settings?.bookingControl?.advanceBookingLimitPercent ?? 20)) / 100).toLocaleString()} Advance ({settings?.bookingControl?.advanceBookingLimitPercent ?? 20}%) via {settings?.paymentControl?.paymentGateway === 'stripe' ? 'Stripe' : 'Razorpay'}
                                    </button>
                                </div>
                            )}

                            {booking.overallStatus !== 'CANCELLED' && booking.overallStatus !== 'PAYMENT_PENDING' && (
                                <div className="flex gap-2 border-t border-slate-100 pt-3">
                                    <button 
                                        onClick={() => handleEditClick(booking)}
                                        className="flex-1 flex items-center justify-center gap-1 py-2 text-xs font-semibold text-purple-600 bg-purple-50 rounded-lg hover:bg-purple-100 transition-colors"
                                    >
                                        <Edit2 size={14} /> Edit
                                    </button>
                                    <button 
                                        onClick={() => handleCancelEvent(booking._id)}
                                        className="flex-1 flex items-center justify-center gap-1 py-2 text-xs font-semibold text-rose-600 bg-rose-50 rounded-lg hover:bg-rose-100 transition-colors"
                                    >
                                        <XCircle size={14} /> Cancel
                                    </button>
                                    <button 
                                        onClick={() => {
                                            setSelectedAltBookingId(booking._id);
                                            setTicketModalOpen(true);
                                        }}
                                        className="flex-1 flex items-center justify-center gap-1 py-2 text-xs font-semibold text-blue-600 bg-blue-50 rounded-lg hover:bg-blue-100 transition-colors"
                                    >
                                        <AlertCircle size={14} /> Help
                                    </button>
                                </div>
                            )}
                        </div>
                    ))
                )}
            </div>

            {editingEvent && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm">
                    <div className="bg-white rounded-2xl w-full max-w-sm overflow-hidden shadow-2xl">
                        <div className="flex justify-between items-center p-4 border-b border-slate-100">
                            <h3 className="font-bold text-slate-800">Edit Event Details</h3>
                            <button onClick={() => setEditingEvent(null)} className="p-1 hover:bg-slate-100 rounded-full"><X size={20} className="text-slate-500" /></button>
                        </div>
                        <div className="p-4 space-y-4">
                            <div>
                                <label className="block text-xs font-semibold text-slate-600 mb-1">
                                    Guest Count {editingEvent?.paymentMode === 'ONLINE' && <span className="text-[10px] text-rose-500 font-normal ml-1">(Locked for Online Payments)</span>}
                                </label>
                                <input 
                                    type="number" 
                                    value={editFormData.guestCount} 
                                    onChange={(e) => setEditFormData({...editFormData, guestCount: e.target.value})} 
                                    disabled={editingEvent?.paymentMode === 'ONLINE'}
                                    className="w-full text-sm p-2.5 border rounded-xl disabled:bg-slate-100 disabled:text-slate-400 disabled:cursor-not-allowed" 
                                />
                            </div>
                            <div>
                                <label className="block text-xs font-semibold text-slate-600 mb-1">
                                    Budget (₹) {editingEvent?.paymentMode === 'ONLINE' && <span className="text-[10px] text-rose-500 font-normal ml-1">(Locked for Online Payments)</span>}
                                </label>
                                <input 
                                    type="number" 
                                    value={editFormData.budget} 
                                    onChange={(e) => setEditFormData({...editFormData, budget: e.target.value})} 
                                    disabled={editingEvent?.paymentMode === 'ONLINE'}
                                    className="w-full text-sm p-2.5 border rounded-xl disabled:bg-slate-100 disabled:text-slate-400 disabled:cursor-not-allowed" 
                                />
                            </div>
                            <div className="flex gap-3">
                                <div className="flex-1">
                                    <label className="block text-xs font-semibold text-slate-600 mb-1">Date</label>
                                    <input type="date" value={editFormData.date} onChange={(e) => setEditFormData({...editFormData, date: e.target.value})} className="w-full text-sm p-2.5 border rounded-xl" />
                                </div>
                                <div className="flex-1">
                                    <label className="block text-xs font-semibold text-slate-600 mb-1">Time</label>
                                    <input type="time" value={editFormData.time} onChange={(e) => setEditFormData({...editFormData, time: e.target.value})} className="w-full text-sm p-2.5 border rounded-xl" />
                                </div>
                            </div>
                            <div>
                                <label className="block text-xs font-semibold text-slate-600 mb-1">Location</label>
                                <input type="text" value={editFormData.location} onChange={(e) => setEditFormData({...editFormData, location: e.target.value})} className="w-full text-sm p-2.5 border rounded-xl" />
                            </div>
                            <button onClick={handleSaveEdit} className="w-full py-3 bg-purple-600 hover:bg-purple-700 text-white font-bold rounded-xl shadow-sm transition-colors mt-2">
                                Save Changes
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Alternative Seller Modal */}
            {altModalOpen && (
                <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-slate-900/50 backdrop-blur-sm">
                    <div className="bg-white rounded-t-3xl sm:rounded-2xl w-full max-w-md overflow-hidden shadow-2xl flex flex-col max-h-[85vh]">
                        <div className="flex justify-between items-center p-4 sm:p-5 border-b border-slate-100 bg-white sticky top-0 z-10">
                            <div>
                                <h3 className="font-bold text-slate-800">Find Alternative Provider</h3>
                                <p className="text-xs text-slate-500">For {selectedServiceForAlt?.category?.name || 'Service'}</p>
                            </div>
                            <button onClick={() => setAltModalOpen(false)} className="p-2 hover:bg-slate-100 rounded-full transition-colors">
                                <X size={20} className="text-slate-500" />
                            </button>
                        </div>
                        
                        <div className="p-4 sm:p-5 overflow-y-auto">
                            {altLoading ? (
                                <div className="flex flex-col items-center justify-center py-10">
                                    <Loader2 className="w-8 h-8 text-purple-600 animate-spin mb-3" />
                                    <p className="text-sm font-medium text-slate-500">Searching available providers...</p>
                                </div>
                            ) : altSellers.length === 0 ? (
                                <div className="text-center py-10">
                                    <p className="text-slate-500 text-sm">No alternative providers found for this date and category.</p>
                                    <button 
                                        onClick={() => setAltModalOpen(false)}
                                        className="mt-4 text-sm font-bold text-purple-600 bg-purple-50 px-6 py-2 rounded-xl"
                                    >
                                        Go Back
                                    </button>
                                </div>
                            ) : (
                                <div className="space-y-3">
                                    {altSellers.map(seller => (
                                        <div key={seller._id} className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm hover:border-purple-300 transition-colors">
                                            <div className="flex justify-between items-start mb-2">
                                                <div>
                                                    <h4 className="font-bold text-slate-800 text-sm">{seller.businessName || seller.name}</h4>
                                                    <p className="text-xs text-slate-500 line-clamp-1">{seller.description || 'Premium Service Provider'}</p>
                                                </div>
                                                <div className="bg-green-50 text-green-700 text-[10px] font-bold px-2 py-1 rounded uppercase tracking-wider whitespace-nowrap">
                                                    Available
                                                </div>
                                            </div>
                                            
                                            {/* Packages if any */}
                                            {seller.packages && seller.packages.length > 0 && (
                                                <div className="mt-3 bg-slate-50 rounded-lg p-2.5 mb-3">
                                                    <p className="text-[10px] font-bold text-slate-500 uppercase mb-1.5">Starting Package</p>
                                                    <div className="flex justify-between items-center">
                                                        <p className="text-xs font-semibold text-slate-700">{seller.packages[0].name}</p>
                                                        <p className="text-xs font-bold text-slate-900">₹{seller.packages[0].price}</p>
                                                    </div>
                                                </div>
                                            )}

                                            <button 
                                                onClick={() => handleReassignSeller(seller._id)}
                                                className="w-full mt-2 bg-slate-900 text-white font-bold text-xs py-2.5 rounded-lg hover:bg-slate-800 transition-colors shadow-md shadow-slate-900/10"
                                            >
                                                Select & Request Booking
                                            </button>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            )}

            {/* Raise Support Ticket Modal */}
            {ticketModalOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm">
                    <div className="bg-white rounded-2xl w-full max-w-sm overflow-hidden shadow-2xl">
                        <div className="flex justify-between items-center p-4 border-b border-slate-100">
                            <h3 className="font-bold text-slate-800 flex items-center gap-2"><AlertCircle size={18} className="text-blue-500"/> Get Help</h3>
                            <button onClick={() => setTicketModalOpen(false)} className="p-1 hover:bg-slate-100 rounded-full"><X size={20} className="text-slate-500" /></button>
                        </div>
                        <div className="p-4 space-y-4">
                            <div>
                                <label className="block text-xs font-semibold text-slate-600 mb-1">Subject</label>
                                <input 
                                    type="text" 
                                    value={ticketFormData.subject} 
                                    onChange={(e) => setTicketFormData({...ticketFormData, subject: e.target.value})} 
                                    placeholder="e.g. Need to change date"
                                    className="w-full text-sm p-2.5 border rounded-xl" 
                                />
                            </div>
                            <div>
                                <label className="block text-xs font-semibold text-slate-600 mb-1">Category</label>
                                <select 
                                    value={ticketFormData.category} 
                                    onChange={(e) => setTicketFormData({...ticketFormData, category: e.target.value})} 
                                    className="w-full text-sm p-2.5 border rounded-xl bg-white"
                                >
                                    <option value="booking">Booking Issue</option>
                                    <option value="payment">Payment Issue</option>
                                    <option value="seller">Seller Issue</option>
                                    <option value="other">Other</option>
                                </select>
                            </div>
                            <div>
                                <label className="block text-xs font-semibold text-slate-600 mb-1">Description</label>
                                <textarea 
                                    value={ticketFormData.description} 
                                    onChange={(e) => setTicketFormData({...ticketFormData, description: e.target.value})} 
                                    placeholder="Explain your issue in detail..."
                                    rows={3}
                                    className="w-full text-sm p-2.5 border rounded-xl resize-none" 
                                />
                            </div>
                            <button 
                                onClick={async () => {
                                    if(!ticketFormData.subject || !ticketFormData.description) return toast.error("Please fill all fields");
                                    toast.loading("Submitting ticket...", { id: 'ticket' });
                                    try {
                                        const res = await customerApi.createSupportTicket({ ...ticketFormData, relatedBookingId: selectedAltBookingId });
                                        if(res.data?.success) {
                                            toast.success("Ticket submitted! Our team will contact you soon.", { id: 'ticket' });
                                            setTicketModalOpen(false);
                                            setTicketFormData({ subject: '', category: 'booking', description: '', priority: 'medium' });
                                        } else {
                                            toast.error(res.data?.message || "Failed to submit ticket", { id: 'ticket' });
                                        }
                                    } catch(e) {
                                        toast.error("Failed to submit ticket", { id: 'ticket' });
                                    }
                                }} 
                                className="w-full py-3 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl shadow-sm transition-colors mt-2"
                            >
                                Submit Ticket
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default OrdersPage;
