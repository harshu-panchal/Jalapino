import React, { useEffect, useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Package, ChevronRight, Clock, CheckCircle, Loader2, ChevronLeft, Edit2, XCircle, X } from 'lucide-react';
import { customerApi } from '../services/customerApi';
import { getOrderStatusLabel, getLegacyStatusFromOrder } from '@/shared/utils/orderStatus';
import { applyCloudinaryTransform } from '@/core/utils/imageUtils';
import { toast } from 'sonner';

const OrdersPage = () => {
    const navigate = useNavigate();
    const [activeTab, setActiveTab] = useState('orders'); // 'orders' or 'events'
    const [orders, setOrders] = useState([]);
    const [eventBookings, setEventBookings] = useState([]);
    const [loading, setLoading] = useState(true);
    const [editingEvent, setEditingEvent] = useState(null);
    const [editFormData, setEditFormData] = useState({ guestCount: '', budget: '', date: '', time: '', location: '' });

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
                                <p><span className="font-medium">Services:</span> {booking.services?.length || 0} Categories</p>
                            </div>
                            <div className="border-t border-slate-100 pt-3 flex justify-between items-center mb-3">
                                <span className="text-[11px] font-medium text-slate-500">
                                    Payment: {booking.paymentMode || 'COD'} ({booking.paymentStatus})
                                </span>
                                <span className="text-sm font-bold text-slate-900">
                                    ₹{booking.totalAmount?.toLocaleString()}
                                </span>
                            </div>
                            {booking.overallStatus !== 'CANCELLED' && (
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
        </div>
    );
};

export default OrdersPage;
