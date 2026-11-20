import React, { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { sellerEventApi } from '../../services/sellerEventApi';
import CircularProgress from '@mui/material/CircularProgress';
import { motion, AnimatePresence } from 'framer-motion';
import Dialog from '@mui/material/Dialog';
import { HiOutlineCheck, HiOutlineXMark, HiOutlineCalendarDays, HiOutlineUserGroup, HiOutlineMapPin, HiOutlineClock, HiOutlineCamera, HiOutlineVideoCamera } from 'react-icons/hi2';
import axiosInstance from '@core/api/axios';

// One date / time format on this screen: "20 Nov 2026" and "10:30 AM".
const formatResDate = (value) => {
    if (!value) return '';
    const text = String(value);
    const d = /^\d{4}-\d{2}-\d{2}/.test(text) ? new Date(`${text.slice(0, 10)}T00:00:00`) : new Date(value);
    return Number.isNaN(d.getTime()) ? text : d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
};
// "10:30" / "23:11" / "6:00 pm - 10:30 PM" -> "10:30 AM" / "11:11 PM" / "06:00 PM - 10:30 PM"
const formatResTime = (value) => {
    if (!value) return '';
    return String(value).split('-').map((part) => {
        const m = part.trim().match(/^(\d{1,2}):(\d{2})\s*(AM|PM)?$/i);
        if (!m) return part.trim();
        let h = Number(m[1]);
        const min = m[2];
        let period = m[3] ? m[3].toUpperCase() : (h >= 12 ? 'PM' : 'AM');
        if (!m[3]) h = h % 12 || 12;
        return `${String(h).padStart(2, '0')}:${min} ${period}`;
    }).join(' - ');
};

// Customer's "Your Event Details" as [label, value] rows, ONLY for filled fields
// (same rows the customer sees in Plan Summary / Checkout / My Orders).
const getEventDetailRows = (info = {}) => {
    const type = String(info?.bookingType || '').toLowerCase();
    const fmtDate = (v) => (/^\d{4}-\d{2}-\d{2}/.test(String(v || ''))
        ? formatResDate(v)
        : (v || ''));
    const cap = (v) => (v ? String(v).charAt(0).toUpperCase() + String(v).slice(1) : '');
    const isSellerLocation = info?.serviceLocationType === 'seller';
    const rows = [
        ['Booking Type', cap(type)],
        ...(type === 'corporate' ? [
            ['Company Name', info?.corporateCompanyName],
            ['Contact Person', info?.corporateContactPerson],
            ['Mobile', info?.corporateMobile],
            ['GST Number', info?.corporateGstNumber],
        ] : type === 'couple' ? [
            ['Couple Names', info?.coupleNames || info?.primaryContactName],
            ['Marriage Anniversary Date', fmtDate(info?.anniversaryDate)],
        ] : [
            ['Primary Contact', info?.primaryContactName || info?.name],
            ['Gender', cap(info?.gender)],
            ['Date of Birth', fmtDate(info?.dateOfBirth)],
        ]),
        ['Phone', type !== 'corporate' ? info?.primaryPhone : ''],
        ['No. of Guests', info?.noOfGuests],
        [isSellerLocation ? 'Seller Location' : 'Function Location', isSellerLocation ? (info?.sellerLocation || info?.functionLocation) : info?.functionLocation],
    ];
    return rows.filter(([, value]) => value !== undefined && value !== null && String(value).trim() !== '' && String(value).trim() !== '0');
};

// Amount shown next to TOTAL, by payment mode:
// - Online: advance amount (as before)
// - COD: full cash the seller collects (minus any online part already paid);
//   after "Save COD Paid" it shows as collected. No "advance" for COD.
const getSecondAmount = (res) => {
    const total = Number(res?.amount || res?.totalAmount || 0);
    const mode = String(res?.paymentMode || 'COD').toUpperCase();
    const pct = Number(res?.advancePaymentPercentage && res.advancePaymentPercentage > 0 ? res.advancePaymentPercentage : 30);
    const advance = (res?.advancePaymentAmount !== undefined && res?.advancePaymentAmount !== null && Number(res.advancePaymentAmount) > 0)
        ? Number(res.advancePaymentAmount)
        : Math.round((total * pct) / 100);
    if (mode === 'COD') {
        const codCollected = Number(res?.codAmountCollected) || 0;
        const isCollected = String(res?.paymentStatus || '').toUpperCase() === 'PAID';
        if (isCollected) {
            const onlinePaid = Math.max(0, (Number(res?.amountPaid) || 0) - codCollected);
            const cash = codCollected > 0 ? codCollected : Math.max(0, total - onlinePaid);
            return { label: 'COD Collected (Cash)', value: cash, isCod: true };
        }
        // Not fully paid yet: advance to take in cash (same advance as online).
        return { label: `Advance Amount (${pct}%) · Cash`, value: advance, isCod: true };
    }
    return { label: `Advance Amount (${pct}%)`, value: advance, isCod: false };
};

// How much has actually been paid, split into online and COD (cash).
const getPaidBreakdown = (res) => {
    const total = Number(res?.amount || res?.totalAmount || 0);
    const mode = String(res?.paymentMode || 'COD').toUpperCase();
    const status = String(res?.paymentStatus || 'PENDING').toUpperCase();
    let cod = Number(res?.codAmountCollected) || 0;
    let online = Math.max(0, (Number(res?.amountPaid) || 0) - cod);
    // Older bookings (before paid amounts were recorded): work it out from the status.
    if (cod === 0 && online === 0) {
        if (status === 'PAID') {
            if (mode === 'COD') cod = total; else online = total;
        } else if (status === 'ADVANCE_PAID') {
            online = Number(res?.advancePaymentAmount) || 0;
        }
    }
    // Just marked "COD Paid" on this screen: the rest was collected in cash.
    if (mode === 'COD' && status === 'PAID' && cod === 0 && online < total) cod = total - online;
    const paid = Math.min(total, cod + online);
    return { online, cod, paid, balance: Math.max(0, total - paid), isCod: mode === 'COD' };
};

// When the booked event ends, in India time (same rule as the backend):
// slot "10:30 AM - 4:00 PM" -> 4:00 PM, single (start) time or no time -> end of
// that day (23:59), slot past midnight -> next day, multiple dates -> the latest one.
const getEventEndIST = (res) => {
    const toMinutes = (value) => {
        const m = String(value || '').trim().match(/^(\d{1,2})(?::(\d{2}))?\s*(AM|PM)?$/i);
        if (!m) return null;
        let h = Number(m[1]);
        const min = Number(m[2] || 0);
        const p = m[3]?.toUpperCase();
        if (p) { if (h === 12) h = p === 'AM' ? 0 : 12; else if (p === 'PM') h += 12; }
        return h * 60 + min;
    };
    const toDateStr = (value) => {
        if (!value) return '';
        const text = String(value);
        if (/^\d{4}-\d{2}-\d{2}/.test(text)) return text.slice(0, 10);
        const d = new Date(value);
        return Number.isNaN(d.getTime()) ? '' : d.toISOString().slice(0, 10);
    };
    const endOf = (dateValue, time) => {
        const dateStr = toDateStr(dateValue);
        if (!dateStr) return null;
        const parts = String(time || '').split('-').map(p => p.trim()).filter(Boolean);
        const startMin = parts.length ? toMinutes(parts[0]) : null;
        let endMin = parts.length > 1 ? toMinutes(parts[parts.length - 1]) : null;
        if (endMin === null) endMin = 23 * 60 + 59;
        const end = new Date(`${dateStr}T${String(Math.floor(endMin / 60)).padStart(2, '0')}:${String(endMin % 60).padStart(2, '0')}:00+05:30`);
        if (Number.isNaN(end.getTime())) return null;
        if (parts.length > 1 && startMin !== null && endMin < startMin) end.setTime(end.getTime() + 24 * 60 * 60 * 1000);
        return end;
    };
    const ends = [
        endOf(res?.eventDate, res?.eventTime),
        ...((res?.multipleEvents || []).map(e => endOf(e?.date || res?.eventDate, e?.time || res?.eventTime))),
    ].filter(Boolean);
    return ends.length ? new Date(Math.max(...ends.map(d => d.getTime()))) : null;
};

// When the booked slot starts, in India time (same rule as the backend):
// slot "10:30 AM - 4:00 PM" -> 10:30 AM, single time -> that time, no time -> 00:00,
// multiple dates -> the latest date's start.
const getEventStartIST = (res) => {
    const toMinutes = (value) => {
        const m = String(value || '').trim().match(/^(d{1,2})(?::(d{2}))?s*(AM|PM)?$/i);
        if (!m) return null;
        let h = Number(m[1]);
        const min = Number(m[2] || 0);
        const p = m[3]?.toUpperCase();
        if (p) { if (h === 12) h = p === 'AM' ? 0 : 12; else if (p === 'PM') h += 12; }
        return h * 60 + min;
    };
    const toDateStr = (value) => {
        if (!value) return '';
        const text = String(value);
        if (/^d{4}-d{2}-d{2}/.test(text)) return text.slice(0, 10);
        const d = new Date(value);
        return Number.isNaN(d.getTime()) ? '' : d.toISOString().slice(0, 10);
    };
    const startOf = (dateValue, time) => {
        const dateStr = toDateStr(dateValue);
        if (!dateStr) return null;
        const parts = String(time || '').split('-').map(p => p.trim()).filter(Boolean);
        let startMin = parts.length ? toMinutes(parts[0]) : null;
        if (startMin === null) startMin = 0;
        const start = new Date(`${dateStr}T${String(Math.floor(startMin / 60)).padStart(2, '0')}:${String(startMin % 60).padStart(2, '0')}:00+05:30`);
        return Number.isNaN(start.getTime()) ? null : start;
    };
    const starts = [
        startOf(res?.eventDate, res?.eventTime),
        ...((res?.multipleEvents || []).map(e => startOf(e?.date || res?.eventDate, e?.time || res?.eventTime))),
    ].filter(Boolean);
    return starts.length ? new Date(Math.max(...starts.map(d => d.getTime()))) : null;
};

const EventReservations = () => {
    const [reservations, setReservations] = useState([]);
    const [isLoading, setIsLoading] = useState(true);
    const [selectedRes, setSelectedRes] = useState(null);
    const [modalOpen, setModalOpen] = useState(false);
    const [actionLoading, setActionLoading] = useState(false);
    const [loadingResId, setLoadingResId] = useState(null);
    const [filter, setFilter] = useState('all');
    const [searchParams] = useSearchParams();

    // Restore modal state from URL or session storage on initial load
    useEffect(() => {
        if (reservations.length > 0) {
            const urlResId = searchParams.get('id');
            const savedResId = urlResId || sessionStorage.getItem('openReservationId');
            if (savedResId) {
                const res = reservations.find(r => String(r._id) === String(savedResId));
                if (res && !modalOpen) {
                    setSelectedRes(res);
                    setModalOpen(true);
                    sessionStorage.setItem('openReservationId', res._id);
                }
            }
        }
    }, [reservations, searchParams]);

    // Live Kitchen State
    const [liveStreamUrl, setLiveStreamUrl] = useState('');
    const [livePhotoDescription, setLivePhotoDescription] = useState('');
    const [livePhoto, setLivePhoto] = useState(null);
    const [isLiveKitchenLoading, setIsLiveKitchenLoading] = useState(false);

    // Helper to fix localhost port mismatches for uploaded images
    const getResolvedImageUrl = (url) => {
        if (!url) return '';
        if (typeof url === 'string') {
            const baseUrl = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';
            const origin = baseUrl.replace(/\/api\/?$/, '');
            
            if (url.includes('localhost:7000')) {
                return url.replace('http://localhost:7000', origin);
            }
            if (url.startsWith('/images/')) {
                return `${origin}${url}`;
            }
        }
        return url;
    };

    useEffect(() => {
        fetchReservations();
    }, []);

    const fetchReservations = async () => {
        try {
            const data = await sellerEventApi.getReservations();
            setReservations(data);
        } catch (error) {
            console.error("Failed to fetch reservations", error);
        } finally {
            setIsLoading(false);
        }
    };

    const handleStatusUpdate = async (id, status) => {
        setActionLoading(true);
        try {
            await sellerEventApi.updateReservationStatus(id, status);
            // Update local state
            setReservations(prev => prev.map(r => r._id === id ? { ...r, status } : r));
            if (selectedRes?._id === id) {
                setSelectedRes({ ...selectedRes, status });
            }
        } catch (error) {
            alert(error?.response?.data?.message || 'Failed to update status');
        } finally {
            setActionLoading(false);
        }
    };

    const handleStreamSubmit = async () => {
        if (!liveStreamUrl) return;
        setIsLiveKitchenLoading(true);
        try {
            await axiosInstance.post('/kitchen/stream', { orderId: selectedRes._id, streamUrl: liveStreamUrl });
            alert('Live stream URL updated successfully!');
            setLiveStreamUrl('');
        } catch (error) {
            alert('Failed to update stream URL');
        } finally {
            setIsLiveKitchenLoading(false);
        }
    };

    const handlePhotoSubmit = async () => {
        if (!livePhoto) return;
        setIsLiveKitchenLoading(true);
        try {
            // First, upload the image to the generic media endpoint
            const formData = new FormData();
            formData.append('file', livePhoto);
            
            const uploadRes = await axiosInstance.post('/media/upload', formData, {
                headers: { 'Content-Type': 'multipart/form-data' }
            });
            
            const imageUrl = uploadRes.data?.url || uploadRes.data?.data?.url || uploadRes.data?.result?.url || uploadRes.data;

            if (typeof imageUrl !== 'string') {
                throw new Error("Invalid image URL received from upload endpoint");
            }

            // Save to Live Kitchen
            await axiosInstance.post('/kitchen/photo', { 
                orderId: selectedRes._id, 
                imageUrl: imageUrl, 
                description: livePhotoDescription 
            });

            alert('Photo uploaded successfully to Live Kitchen!');
            setLivePhoto(null);
            setLivePhotoDescription('');
        } catch (error) {
            console.error("Live Kitchen Upload Error:", error);
            alert('Failed to upload photo update. Please ensure the media endpoint is running.');
        } finally {
            setIsLiveKitchenLoading(false);
        }
    };

    const handleConfirmCOD = async (id, part) => {
        setLoadingResId(id);
        try {
            const response = await sellerEventApi.confirmCODPayment(id, part);
            const saved = response?.result || response?.data || {};
            const patch = {
                paymentStatus: saved.paymentStatus || (part === 'advance' ? 'ADVANCE_PAID' : 'PAID'),
                status: 'confirmed',
                ...(saved.amountPaid !== undefined ? { amountPaid: saved.amountPaid } : {}),
                ...(saved.codAmountCollected !== undefined ? { codAmountCollected: saved.codAmountCollected } : {}),
                ...(saved.overallStatus ? { overallStatus: saved.overallStatus } : {}),
            };
            setReservations(prev => prev.map(r => r._id === id ? { ...r, ...patch } : r));
            if (selectedRes?._id === id) {
                setSelectedRes(prev => ({ ...prev, ...patch }));
            }
        } catch (error) {
            console.error('Failed to confirm COD payment:', error);
            alert('Failed to confirm COD payment');
        } finally {
            setLoadingResId(null);
        }
    };

    if (isLoading) {
        return (
            <div className="flex items-center justify-center h-[70vh]">
                <CircularProgress sx={{ color: '#ef4444' }} />
            </div>
        );
    }

    const formatCreatedDateTime = (dateStr) => {
        if (!dateStr) return '';
        const d = new Date(dateStr);
        if (isNaN(d.getTime())) return '';
        const datePart = formatResDate(d);
        const timePart = d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true });
        return `${datePart} · ${timePart}`;
    };

    const getDisplayStatus = (res) => {
        if (!res) return { label: 'REQUESTED', color: 'bg-amber-100 text-amber-700 border-amber-200' };
        if (res.status === 'rejected') {
            return { label: 'REJECTED', color: 'bg-red-100 text-red-700 border-red-200' };
        }
        if (res.status === 'cancelled' || res.overallStatus === 'CANCELLED') {
            return { label: 'CANCELLED', color: 'bg-red-100 text-red-700 border-red-200' };
        }
        // COMPLETED only after the seller pressed "Mark as Completed" (after the event).
        if (res.status === 'completed') {
            return { label: 'COMPLETED', color: 'bg-blue-100 text-blue-700 border-blue-200' };
        }
        // CONFIRMED only after the seller accepted AND the customer paid (advance / full,
        // or COD booking confirmed by the customer). Accepted but not paid -> still REQUESTED.
        const payStatus = String(res.paymentStatus || '').toUpperCase();
        const overall = String(res.overallStatus || '').toUpperCase();
        const customerPaid = Number(res.amountPaid) > 0
            || payStatus === 'ADVANCE_PAID' || payStatus === 'PAID'
            || (String(res.paymentMode || '').toUpperCase() === 'COD' && ['CONFIRMED', 'IN_PROGRESS', 'COMPLETED'].includes(overall));
        if (res.status === 'confirmed' && customerPaid) {
            return { label: 'CONFIRMED', color: 'bg-green-100 text-green-700 border-green-200' };
        }
        return { label: 'REQUESTED', color: 'bg-amber-100 text-amber-700 border-amber-200' };
    };

    const getPaymentBadge = (res) => {
        if (!res) return { label: 'COD Pending', color: 'bg-amber-100 text-amber-800 border-amber-200', isPendingCOD: true };
        const mode = String(res.paymentMode || 'COD').toUpperCase();
        const status = String(res.paymentStatus || 'PENDING').toUpperCase();

        if (mode === 'COD') {
            if (status === 'PAID') {
                return { label: 'COD Paid', color: 'bg-emerald-100 text-emerald-800 border-emerald-200', isPendingCOD: false };
            }
            if (status === 'ADVANCE_PAID') {
                return { label: 'Advance Paid (COD)', color: 'bg-purple-100 text-purple-800 border-purple-200', isPendingCOD: true };
            }
            return { label: 'COD Pending', color: 'bg-amber-100 text-amber-800 border-amber-200', isPendingCOD: true };
        }

        // Online mode
        if (status === 'PAID') {
            return { label: 'Paid (Online)', color: 'bg-emerald-100 text-emerald-800 border-emerald-200', isPendingCOD: false };
        }
        if (status === 'ADVANCE_PAID') {
            return { label: 'Advance Paid (Online)', color: 'bg-purple-100 text-purple-800 border-purple-200', isPendingCOD: false };
        }
        return { label: 'Payment Pending', color: 'bg-amber-100 text-amber-800 border-amber-200', isPendingCOD: false };
    };

    // Each tab shows exactly the bookings whose badge (shown on the card) matches it.
    const filteredReservations = reservations.filter(r => {
        if (filter === 'all') return true;
        const disp = getDisplayStatus(r).label.toLowerCase();
        if (filter === 'pending') return disp === 'requested';
        if (filter === 'confirmed') return disp === 'confirmed';
        // No separate "Cancelled" tab, so cancelled bookings are listed under Rejected.
        if (filter === 'rejected') return disp === 'rejected' || disp === 'cancelled';
        if (filter === 'completed') return disp === 'completed';
        return disp === filter;
    });

    const getStatusColor = (status) => {
        switch(status) {
            case 'pending': return 'bg-amber-100 text-amber-700 border-amber-200';
            case 'confirmed': case 'active': return 'bg-green-100 text-green-700 border-green-200';
            case 'rejected': case 'cancelled': return 'bg-red-100 text-red-700 border-red-200';
            case 'completed': return 'bg-blue-100 text-blue-700 border-blue-200';
            default: return 'bg-slate-100 text-slate-700 border-slate-200';
        }
    };

    return (
        <div className="max-w-7xl mx-auto space-y-6">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-end gap-4">
                <div>
                    <h1 className="text-2xl font-bold text-slate-800">Event Reservations</h1>
                    <p className="text-sm text-slate-500 mt-1">Manage your event bookings and requests.</p>
                </div>
                
                <div className="flex gap-2 bg-white p-1 rounded-xl shadow-sm border border-slate-200 overflow-x-auto w-full sm:w-auto">
                    {[
                        { key: 'all', label: 'All' },
                        { key: 'pending', label: 'Requested' },
                        { key: 'confirmed', label: 'Confirmed' },
                        { key: 'rejected', label: 'Rejected' },
                        { key: 'completed', label: 'Completed' }
                    ].map(f => (
                        <button 
                            key={f.key}
                            onClick={() => setFilter(f.key)}
                            className={`px-3 sm:px-4 py-2 rounded-lg text-xs sm:text-sm font-bold whitespace-nowrap transition-colors ${filter === f.key ? 'bg-slate-800 text-white' : 'text-slate-600 hover:bg-slate-100'}`}
                        >
                            {f.label}
                        </button>
                    ))}
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
                <AnimatePresence>
                    {filteredReservations.map((res, i) => {
                        const displayStatus = getDisplayStatus(res);
                        const paymentBadge = getPaymentBadge(res);
                        const totalAmt = Number(res.amount || res.totalAmount || 0);

                        return (
                            <motion.div 
                                layout
                                initial={{ opacity: 0, scale: 0.9 }}
                                animate={{ opacity: 1, scale: 1 }}
                                exit={{ opacity: 0, scale: 0.9 }}
                                key={res._id}
                                onClick={() => { setSelectedRes(res); setModalOpen(true); sessionStorage.setItem('openReservationId', res._id); }}
                                className="bg-white border border-slate-200 rounded-2xl p-4 sm:p-5 shadow-sm cursor-pointer hover:shadow-md transition-shadow hover:border-red-200 group flex flex-col justify-between"
                            >
                                <div>
                                    {/* Top Row: Date/Time & Status */}
                                    <div className="flex justify-between items-start mb-3 gap-2">
                                        <div className="flex items-center gap-1.5 flex-wrap">
                                            <span className={`text-[10px] px-2.5 py-1 rounded-md font-bold uppercase tracking-wider border shrink-0 ${displayStatus.color}`}>
                                                {displayStatus.label}
                                            </span>
                                            <span className="text-[10px] font-bold text-slate-600 bg-slate-100 px-2 py-0.5 rounded border border-slate-200">
                                                #{res.bookingId || String(res._id).slice(-8)}
                                            </span>
                                        </div>
                                        <span className="text-xs text-slate-500 font-semibold whitespace-nowrap">
                                            {formatCreatedDateTime(res.createdAt) || new Date(res.createdAt).toLocaleDateString()}
                                        </span>
                                    </div>

                                    {res.closedReason && (
                                        <p className="mb-3 rounded-lg border border-rose-200 bg-rose-50 px-2.5 py-1.5 text-[11px] font-bold text-rose-700">🚫 {res.closedReason}</p>
                                    )}

                                    {/* Customer Details */}
                                    <h3 className="text-lg sm:text-xl font-black text-slate-800 mb-1 group-hover:text-red-600 transition-colors break-words">
                                        {res.customerInfo?.name || "Customer Name"}
                                    </h3>
                                    <p className="text-xs sm:text-sm font-medium text-slate-500 mb-4 break-words">
                                        {res.customerInfo?.phone || "No Phone"} • {res.customerInfo?.email || "No Email"}
                                    </p>

                                    {/* Event Details */}
                                    <div className="space-y-2 mb-4">
                                        <div className="flex items-center gap-3 text-xs sm:text-sm text-slate-600">
                                            <HiOutlineCalendarDays className="w-4 h-4 text-slate-400 shrink-0" />
                                            <span className="font-semibold text-slate-700">
                                                {formatResDate(res.eventDate)}
                                            </span>
                                        </div>
                                        <div className="flex items-center gap-3 text-xs sm:text-sm text-slate-600">
                                            <HiOutlineClock className="w-4 h-4 text-slate-400 shrink-0" />
                                            <span className="font-semibold text-slate-700">{formatResTime(res.eventTime) || "Time not specified"}</span>
                                        </div>
                                        {/* Guests: only reflect if guestCount is active / > 0 */}
                                        {Boolean(res.guestCount && Number(res.guestCount) > 0) && (
                                            <div className="flex items-center gap-3 text-xs sm:text-sm text-slate-600">
                                                <HiOutlineUserGroup className="w-4 h-4 text-slate-400 shrink-0" />
                                                <span className="font-semibold text-slate-700">
                                                    {res.guestCount} {Number(res.guestCount) === 1 ? 'Guest' : 'Guests'}
                                                </span>
                                            </div>
                                        )}
                                    </div>

                                    {/* Financial Breakdown & Payment Status Box (Matching Client Spec) */}
                                    <div className="bg-slate-50 border border-slate-200/90 rounded-xl p-3 mb-2 text-xs">
                                        <div className="grid grid-cols-2 gap-2 pb-2.5 border-b border-slate-200">
                                            <div>
                                                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                                                    TOTAL Amount
                                                </span>
                                                <span className="text-xs sm:text-sm font-black text-slate-900">
                                                    ₹{totalAmt.toLocaleString('en-IN')}/-
                                                </span>
                                            </div>
                                            <div>
                                                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                                                    {getSecondAmount(res).label}
                                                </span>
                                                <span className={`text-xs sm:text-sm font-black ${getSecondAmount(res).isCod ? 'text-amber-700' : 'text-purple-700'}`}>
                                                    ₹{getSecondAmount(res).value.toLocaleString('en-IN')}/-
                                                </span>
                                            </div>
                                        </div>

                                        <div className="pt-2.5 flex items-center justify-between gap-2 flex-wrap">
                                            <div>
                                                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-0.5">
                                                    Payment Status
                                                </span>
                                                <span className={`inline-flex items-center px-2 py-0.5 rounded text-[11px] font-bold border ${paymentBadge.color}`}>
                                                    {paymentBadge.label}
                                                </span>
                                            </div>

                                            {/* Save Button for COD confirmation */}
                                            {paymentBadge.isPendingCOD && (
                                                <button
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        handleConfirmCOD(res._id);
                                                    }}
                                                    disabled={loadingResId === res._id}
                                                    className="px-2.5 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold shadow-sm transition-all flex items-center gap-1.5 disabled:opacity-50"
                                                    title="Save COD confirmation"
                                                >
                                                    {loadingResId === res._id ? (
                                                        <CircularProgress size={12} color="inherit" />
                                                    ) : (
                                                        <HiOutlineCheck className="w-3.5 h-3.5" />
                                                    )}
                                                    Save COD Paid
                                                </button>
                                            )}
                                        </div>
                                    </div>
                                </div>

                                {res.status === 'pending' && (
                                    <div className="flex gap-3 mt-3 pt-3 border-t border-slate-100">
                                        <button 
                                            onClick={(e) => { e.stopPropagation(); handleStatusUpdate(res._id, 'confirmed'); }}
                                            disabled={actionLoading}
                                            className="flex-1 bg-green-50 text-green-700 hover:bg-green-100 hover:text-green-800 py-2.5 rounded-xl font-bold flex items-center justify-center gap-2 transition-colors disabled:opacity-50"
                                        >
                                            <HiOutlineCheck className="w-5 h-5" /> Accept
                                        </button>
                                        <button 
                                            onClick={(e) => { e.stopPropagation(); handleStatusUpdate(res._id, 'rejected'); }}
                                            disabled={actionLoading}
                                            className="flex-1 bg-red-50 text-red-700 hover:bg-red-100 hover:text-red-800 py-2.5 rounded-xl font-bold flex items-center justify-center gap-2 transition-colors disabled:opacity-50"
                                        >
                                            <HiOutlineXMark className="w-5 h-5" /> Reject
                                        </button>
                                    </div>
                                )}
                            </motion.div>
                        );
                    })}
                </AnimatePresence>
                
                {filteredReservations.length === 0 && (
                    <div className="col-span-full py-20 text-center">
                        <p className="text-slate-500 font-medium text-lg">No {filter !== 'all' ? filter : ''} reservations found.</p>
                    </div>
                )}
            </div>

            {/* Detail Modal */}
            <Dialog
                open={modalOpen}
                onClose={() => {
                    setModalOpen(false);
                    sessionStorage.removeItem('openReservationId');
                }}
                maxWidth="sm"
                fullWidth
                PaperProps={{
                    sx: {
                        borderRadius: { xs: 3, sm: 4 },
                        margin: { xs: 2, sm: 4 },
                        maxHeight: { xs: 'calc(100% - 32px)', sm: 'calc(100% - 64px)' },
                        overflowY: 'auto'
                    }
                }}
            >
                {selectedRes && (
                    <div className="p-4 sm:p-6 overflow-y-auto max-h-[85vh]">
                        <div className="flex justify-between items-start mb-4 sm:mb-6 gap-2">
                            <div className="min-w-0 flex-1">
                                <span className="text-[11px] font-bold text-purple-700 bg-purple-50 px-2 py-0.5 rounded border border-purple-100 mb-1 inline-block">
                                    Order ID: #{selectedRes.bookingId || selectedRes._id}
                                </span>
                                <h2 className="text-xl sm:text-2xl font-black text-slate-800 break-words">{selectedRes.customerInfo?.name}</h2>
                                <p className="text-xs sm:text-sm text-slate-500 font-medium break-all">{selectedRes.customerInfo?.phone} • {selectedRes.customerInfo?.email}</p>
                            </div>
                            <span className={`text-[10px] sm:text-xs px-2.5 sm:px-3 py-1 sm:py-1.5 rounded-lg font-bold uppercase tracking-wider border shrink-0 ${getDisplayStatus(selectedRes).color}`}>
                                {getDisplayStatus(selectedRes).label}
                            </span>
                        </div>

                        {selectedRes.closedReason && (
                            <p className="mb-4 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-xs font-bold text-rose-700">🚫 {selectedRes.closedReason}</p>
                        )}

                        <div className="bg-slate-50 rounded-2xl p-4 sm:p-5 space-y-4 mb-5 border border-slate-100">
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                                <div>
                                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Booking Date</p>
                                    <p className="font-bold text-slate-700 flex items-center gap-2 text-xs sm:text-sm">
                                        <HiOutlineCalendarDays className="w-4 h-4 text-red-500 shrink-0" />
                                        {formatResDate(selectedRes.eventDate)}
                                    </p>
                                </div>
                                <div>
                                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Booking Time Slot</p>
                                    <p className="font-bold text-slate-700 flex items-center gap-2 text-xs sm:text-sm">
                                        <HiOutlineClock className="w-4 h-4 text-red-500 shrink-0" />
                                        {formatResTime(selectedRes.eventTime)}
                                    </p>
                                </div>
                                {Boolean(selectedRes.guestCount && Number(selectedRes.guestCount) > 0) && (
                                    <div>
                                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Guests</p>
                                        <p className="font-bold text-slate-700 flex items-center gap-2 text-xs sm:text-sm">
                                            <HiOutlineUserGroup className="w-4 h-4 text-red-500 shrink-0" />
                                            {selectedRes.guestCount} {Number(selectedRes.guestCount) === 1 ? 'Guest' : 'Guests'}
                                        </p>
                                    </div>
                                )}
                                {/* Location only if the customer actually filled it */}
                                {selectedRes.location?.address && !['Pending Address', 'Pending Location', 'Not specified'].includes(selectedRes.location.address) && (
                                    <div>
                                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Location</p>
                                        <p className="font-bold text-slate-700 flex items-center gap-2 text-xs sm:text-sm">
                                            <HiOutlineMapPin className="w-4 h-4 text-red-500 shrink-0" />
                                            <span className="truncate">{selectedRes.location.address}</span>
                                        </p>
                                    </div>
                                )}
                                <div>
                                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">TOTAL Amount</p>
                                    <p className="font-extrabold text-slate-800 text-xs sm:text-sm">
                                        ₹{Number(selectedRes.amount || selectedRes.totalAmount || 0).toLocaleString('en-IN')}/-
                                    </p>
                                </div>
                                <div>
                                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">
                                        {getSecondAmount(selectedRes).label}
                                    </p>
                                    <p className={`font-extrabold text-xs sm:text-sm ${getSecondAmount(selectedRes).isCod ? 'text-amber-700' : 'text-purple-700'}`}>
                                        ₹{getSecondAmount(selectedRes).value.toLocaleString('en-IN')}/-
                                    </p>
                                </div>
                                <div className="col-span-1 sm:col-span-2">
                                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Payment Status</p>
                                    <div className="flex items-center gap-2.5 flex-wrap">
                                        <span className={`inline-flex items-center px-2.5 py-1 rounded-md text-xs font-bold border ${getPaymentBadge(selectedRes).color}`}>
                                            {getPaymentBadge(selectedRes).label}
                                        </span>
                                        {getPaymentBadge(selectedRes).isPendingCOD && getPaidBreakdown(selectedRes).paid <= 0 && getSecondAmount(selectedRes).value > 0 && getSecondAmount(selectedRes).value < Number(selectedRes.amount || selectedRes.totalAmount || 0) && (
                                            <button
                                                onClick={() => handleConfirmCOD(selectedRes._id, 'advance')}
                                                disabled={loadingResId === selectedRes._id}
                                                className="px-3 py-1 bg-purple-600 hover:bg-purple-700 text-white rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 disabled:opacity-50"
                                            >
                                                <HiOutlineCheck className="w-3.5 h-3.5" />
                                                Save Advance Paid (₹{getSecondAmount(selectedRes).value.toLocaleString('en-IN')} Cash)
                                            </button>
                                        )}
                                        {getPaymentBadge(selectedRes).isPendingCOD && (
                                            <button
                                                onClick={() => handleConfirmCOD(selectedRes._id)}
                                                disabled={loadingResId === selectedRes._id}
                                                className="px-3 py-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 disabled:opacity-50"
                                            >
                                                {loadingResId === selectedRes._id ? (
                                                    <CircularProgress size={12} color="inherit" />
                                                ) : (
                                                    <HiOutlineCheck className="w-3.5 h-3.5" />
                                                )}
                                                Save COD Paid
                                            </button>
                                        )}
                                    </div>
                                    {/* Amount actually paid (online / COD cash) */}
                                    {(() => {
                                        const p = getPaidBreakdown(selectedRes);
                                        const rows = [
                                            p.online > 0 && ['Paid Online', p.online, 'text-purple-700'],
                                            p.cod > 0 && ['Paid in Cash (COD)', p.cod, 'text-emerald-700'],
                                            ['Total Paid', p.paid, 'text-slate-900'],
                                            p.balance > 0 && [p.isCod ? 'Balance Due (Cash)' : 'Balance Due', p.balance, 'text-amber-700'],
                                        ].filter(Boolean);
                                        return (
                                            <div className="mt-2.5 rounded-lg border border-slate-200 bg-white px-3 py-2 space-y-1 text-xs">
                                                {rows.map(([label, value, color]) => (
                                                    <div key={label} className="flex items-center justify-between gap-3">
                                                        <span className="font-semibold text-slate-500">{label}</span>
                                                        <span className={`font-extrabold ${color}`}>₹{Number(value).toLocaleString('en-IN')}/-</span>
                                                    </div>
                                                ))}
                                            </div>
                                        );
                                    })()}
                                </div>
                                {selectedRes.eventType && (
                                    <div>
                                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Event Type</p>
                                        <p className="font-bold text-slate-700 capitalize text-xs sm:text-sm">
                                            {selectedRes.eventType}
                                        </p>
                                    </div>
                                )}
                                {Array.isArray(selectedRes.multipleEvents) && selectedRes.multipleEvents.length > 0 ? (
                                    <div className="col-span-1 sm:col-span-2">
                                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Dates & Remarks</p>
                                        <div className="space-y-1">
                                            {selectedRes.multipleEvents.map((item, idx) => (
                                                <div key={item.id || idx} className="flex flex-col gap-0.5 rounded-lg bg-slate-50 px-2 py-1.5 text-xs sm:flex-row sm:justify-between sm:gap-2 sm:text-sm">
                                                    <span className="font-bold text-slate-700">{item.typeName || ''}</span>
                                                    <span className="min-w-0 break-words font-semibold text-slate-700 sm:text-right">
                                                        {`${item.date ? formatResDate(item.date) : ''}${item.time ? ` · ${formatResTime(item.time)}` : ''}`}
                                                        {String(item.remarks || '').trim() && <span className="block text-[11px] font-medium italic text-slate-500">📝 {item.remarks}</span>}
                                                    </span>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                ) : selectedRes.remarks && (
                                    <div className="col-span-1 sm:col-span-2">
                                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Remarks / Occasion</p>
                                        <p className="font-semibold text-slate-700 text-xs sm:text-sm">
                                            {selectedRes.remarks}
                                        </p>
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* Customer Event Details (Primary Contact, Gender, DOB, etc.) */}
                        {selectedRes.eventInfo && typeof selectedRes.eventInfo === 'object' && Object.keys(selectedRes.eventInfo).length > 0 && (
                            <div className="mb-5 bg-purple-50/50 rounded-2xl p-3.5 sm:p-4 border border-purple-100">
                                <h3 className="text-xs font-black text-purple-900 uppercase tracking-wider mb-3 pb-1 border-b border-purple-200">
                                    👤 Event & Contact Details
                                </h3>
                                {/* Same details the customer filled (only filled fields). */}
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 sm:gap-3 text-xs">
                                    {getEventDetailRows(selectedRes.eventInfo).map(([label, value]) => (
                                        <div key={label} className="min-w-0">
                                            <span className="text-[10px] text-slate-400 uppercase block font-bold">{label}</span>
                                            <span className="font-bold text-slate-800 break-words">{value}</span>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}

                        {/* Selected Products & Add-ons */}
                        {Array.isArray(selectedRes.selectedProducts) && selectedRes.selectedProducts.length > 0 && (
                            <div className="mb-6 bg-slate-50 rounded-2xl p-4 border border-slate-200">
                                <h3 className="text-xs font-black text-slate-800 uppercase tracking-wider mb-3 pb-1 border-b border-slate-200">
                                    🛍️ Selected Items ({selectedRes.selectedProducts.length})
                                </h3>
                                <div className="space-y-2">
                                    {selectedRes.selectedProducts.map((p, pIdx) => (
                                        <div key={pIdx} className="bg-white p-2.5 rounded-xl border border-slate-200 text-xs">
                                            <div className="flex justify-between font-bold text-slate-800">
                                                <span>{p.productName || 'Product'} {p.selectedVariant?.name ? `(${p.selectedVariant.name})` : ''} × {p.quantity || 1}</span>
                                                <span className="text-purple-700">₹{((p.price || p.unitPrice || 0) * (p.quantity || 1) + (p.selectedAddOns || []).reduce((s, a) => s + (Number(a.price) || 0), 0)).toLocaleString('en-IN')}</span>
                                            </div>
                                            <div className="text-[10px] font-semibold text-slate-500 pl-1 mt-0.5">
                                                ({p.quantity || 1} × ₹{Number(p.price || p.unitPrice || 0).toLocaleString('en-IN')})
                                            </div>
                                            {Array.isArray(p.selectedAddOns) && p.selectedAddOns.length > 0 && (
                                                <div className="flex flex-wrap gap-1 mt-1.5 pl-1">
                                                    {p.selectedAddOns.map((ad, aIdx) => (
                                                        <span key={aIdx} className="text-[10px] bg-purple-50 text-purple-700 border border-purple-200 px-1.5 py-0.2 rounded font-semibold">
                                                            + {ad.name} (₹{ad.price})
                                                        </span>
                                                    ))}
                                                </div>
                                            )}
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}

                        {selectedRes.customerPreferences && typeof selectedRes.customerPreferences === 'object' && Object.entries(selectedRes.customerPreferences).filter(([k, v]) => {
                            if (v === null || v === undefined) return false;
                            // Hide legacy product internal fields that are already properly shown in SELECTED ITEMS
                            const lowerKey = k.toLowerCase().replace(/[^a-z]/g, '');
                            if (lowerKey === 'selectedproducts' || lowerKey === 'selectedproductquantities' || lowerKey === 'selectedproductcolors') return false;
                            if (typeof v === 'string') return v.trim() !== '';
                            if (Array.isArray(v)) return v.length > 0;
                            if (typeof v === 'object') return Object.keys(v).length > 0;
                            return true;
                        }).length > 0 && (
                            <div className="mb-8">
                                <h3 className="text-sm font-bold text-slate-800 uppercase tracking-wider mb-3 pb-2 border-b border-slate-100">Customer Preferences</h3>
                                <div className="space-y-3">
                                    {Object.entries(selectedRes.customerPreferences)
                                        .filter(([k, v]) => {
                                            if (v === null || v === undefined) return false;
                                            const lowerKey = k.toLowerCase().replace(/[^a-z]/g, '');
                                            if (lowerKey === 'selectedproducts' || lowerKey === 'selectedproductquantities' || lowerKey === 'selectedproductcolors') return false;
                                            if (typeof v === 'string') return v.trim() !== '';
                                            if (Array.isArray(v)) return v.length > 0;
                                            if (typeof v === 'object') return Object.keys(v).length > 0;
                                            return true;
                                        })
                                        .map(([key, value]) => (
                                        <div key={key} className="flex flex-col bg-white p-3 rounded-xl border border-slate-200">
                                            <span className="text-xs font-bold text-slate-400 capitalize mb-1">{key.replace(/([A-Z])/g, ' $1').trim()}</span>
                                            {typeof value === 'string' && (value.startsWith('http') || value.match(/\.(jpeg|jpg|gif|png|webp)$/i)) ? (
                                                <a href={getResolvedImageUrl(value)} target="_blank" rel="noreferrer" className="block max-w-xs overflow-hidden rounded-lg border border-slate-100 shadow-sm mt-1 hover:opacity-90 transition-opacity">
                                                    <img src={getResolvedImageUrl(value)} alt={key} className="w-full h-auto object-cover max-h-48" onError={(e) => { e.target.style.display = 'none'; e.target.insertAdjacentHTML('afterend', `<span class="text-xs text-red-500">Image failed to load: ${value}</span>`); }} />
                                                </a>
                                            ) : key === "Theme Color" || (typeof value === 'string' && value.startsWith('#') && value.length === 7) ? (
                                                <div className="flex items-center gap-2">
                                                    <div className="w-6 h-6 rounded-md shadow-sm border border-slate-200" style={{ backgroundColor: value }}></div>
                                                    <span className="text-sm font-bold text-slate-800 uppercase">{value}</span>
                                                </div>
                                            ) : (value !== null && typeof value === 'object' && !Array.isArray(value)) ? (
                                                // Handle corrupted old data fallback
                                                <div className="space-y-2 mt-1">
                                                    {Object.entries(value).map(([subKey, subVal]) => (
                                                        <div key={subKey}>
                                                            <span className="text-xs font-bold text-slate-500 capitalize">{subKey}: </span>
                                                            {typeof subVal === 'string' && subVal.startsWith('http') ? (
                                                                <a href={getResolvedImageUrl(subVal)} target="_blank" rel="noreferrer" className="inline-block mt-1">
                                                                    <img src={getResolvedImageUrl(subVal)} alt={subKey} className="w-32 h-auto object-cover rounded-lg border border-slate-200 shadow-sm" onError={(e) => { e.target.style.display = 'none'; }} />
                                                                </a>
                                                            ) : subKey === "Theme Color" ? (
                                                                <div className="inline-flex items-center gap-2 align-middle">
                                                                    <div className="w-4 h-4 rounded shadow-sm border border-slate-200" style={{ backgroundColor: subVal }}></div>
                                                                    <span className="text-sm font-bold text-slate-800 uppercase">{subVal}</span>
                                                                </div>
                                                            ) : (
                                                                <span className="text-sm font-medium text-slate-800">{String(subVal ?? '')}</span>
                                                            )}
                                                        </div>
                                                    ))}
                                                </div>
                                            ) : (
                                                <span className="text-sm font-medium text-slate-800">
                                                    {String(value ?? '')}
                                                </span>
                                            )}
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}


                        {selectedRes.sellerRating > 0 && (
                            <div className="mb-6 bg-amber-50/70 border border-amber-200/80 rounded-2xl p-4">
                                <h3 className="text-xs font-black text-amber-900 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                                    ⭐ Customer Review & Rating
                                </h3>
                                <div className="flex items-center gap-2 mb-1.5">
                                    <div className="flex text-amber-400 text-sm">
                                        {[1, 2, 3, 4, 5].map((star) => (
                                            <span key={star} className={star <= selectedRes.sellerRating ? 'text-amber-500' : 'text-slate-200'}>
                                                ★
                                            </span>
                                        ))}
                                    </div>
                                    <span className="text-xs font-bold text-slate-800">{selectedRes.sellerRating} / 5</span>
                                    {selectedRes.sellerReviewedAt && (
                                        <span className="text-[10px] text-slate-400">
                                            • {new Date(selectedRes.sellerReviewedAt).toLocaleDateString()}
                                        </span>
                                    )}
                                </div>
                                {selectedRes.sellerReview && (
                                    <p className="text-xs text-slate-700 italic bg-white p-2.5 rounded-xl border border-amber-100">
                                        "{selectedRes.sellerReview}"
                                    </p>
                                )}
                            </div>
                        )}

                        <div className="flex flex-col sm:flex-row gap-2.5 sm:gap-3 mt-6 sm:mt-8">
                            <button 
                                onClick={() => {
                                    setModalOpen(false);
                                    sessionStorage.removeItem('openReservationId');
                                }}
                                className="px-5 py-2.5 sm:py-3 bg-slate-100 text-slate-700 rounded-xl font-bold hover:bg-slate-200 transition-colors w-full text-xs sm:text-sm"
                            >
                                Close
                            </button>
                            {selectedRes.status === 'pending' && (
                                <>
                                    <button 
                                        onClick={() => { 
                                            handleStatusUpdate(selectedRes._id, 'rejected'); 
                                            setModalOpen(false); 
                                            sessionStorage.removeItem('openReservationId');
                                        }}
                                        disabled={actionLoading}
                                        className="px-5 py-2.5 sm:py-3 bg-red-50 text-red-600 rounded-xl font-bold hover:bg-red-100 transition-colors w-full disabled:opacity-50 text-xs sm:text-sm"
                                    >
                                        Reject
                                    </button>
                                    <button 
                                        onClick={() => { 
                                            handleStatusUpdate(selectedRes._id, 'confirmed'); 
                                            setModalOpen(false); 
                                            sessionStorage.removeItem('openReservationId');
                                        }}
                                        disabled={actionLoading}
                                        className="px-5 py-2.5 sm:py-3 bg-slate-900 text-white rounded-xl font-bold hover:bg-slate-800 transition-colors w-full disabled:opacity-50 text-xs sm:text-sm"
                                    >
                                        Accept Booking
                                    </button>
                                </>
                            )}
                            {selectedRes.status === 'confirmed' && getDisplayStatus(selectedRes).label === 'CONFIRMED' && (() => {
                                // Allowed only after the booked slot's start date & time.
                                const eventEnd = getEventStartIST(selectedRes);
                                const notEndedYet = Boolean(eventEnd) && Date.now() < eventEnd.getTime();
                                const endLabel = eventEnd
                                    ? eventEnd.toLocaleString('en-IN', { timeZone: 'Asia/Kolkata', day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })
                                    : '';
                                return (
                                    <div className="w-full flex flex-col gap-1">
                                        <button
                                            onClick={() => { handleStatusUpdate(selectedRes._id, 'completed'); setModalOpen(false); }}
                                            disabled={actionLoading || notEndedYet}
                                            className="px-5 py-2.5 sm:py-3 bg-blue-600 text-white rounded-xl font-bold hover:bg-blue-700 transition-colors w-full disabled:opacity-50 disabled:cursor-not-allowed text-xs sm:text-sm"
                                        >
                                            Mark as Completed
                                        </button>
                                        {notEndedYet && (
                                            <p className="text-[11px] font-semibold text-slate-500 text-center">
                                                Available after the event starts ({endLabel})
                                            </p>
                                        )}
                                    </div>
                                );
                            })()}
                        </div>
                    </div>
                )}
            </Dialog>
        </div>
    );
};

export default EventReservations;
