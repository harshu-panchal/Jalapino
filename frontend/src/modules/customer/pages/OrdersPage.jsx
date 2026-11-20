import React, { useEffect, useState } from 'react';
import { useNavigate, Link, useLocation as useRouterLocation } from 'react-router-dom';
import { Package, ChevronRight, Clock, CheckCircle, Loader2, ChevronLeft, Edit2, XCircle, X, AlertCircle, CreditCard, Star, Download } from 'lucide-react';
import { customerApi } from '../services/customerApi';
import { getOrderStatusLabel, getLegacyStatusFromOrder } from '@/shared/utils/orderStatus';
import { applyCloudinaryTransform } from '@/core/utils/imageUtils';
import { useSettings } from '@/core/context/SettingsContext';
import { toast } from 'sonner';
import { useLocation } from '../context/LocationContext';
import { useCustomerMode } from '../context/CustomerModeContext';
import CustomizationRequestsList from '../components/events/CustomizationRequestsList';

// "Your Event Details" as [label, value] rows, ONLY for fields the customer filled
// (same rows as the Plan Summary and Checkout).
const getEventDetailRows = (info = {}) => {
    const type = String(info?.bookingType || '').toLowerCase();
    const fmtDate = (v) => (/^\d{4}-\d{2}-\d{2}/.test(String(v || ''))
        ? new Date(`${String(v).slice(0, 10)}T00:00:00`).toLocaleDateString('en-IN')
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

// RedBus-style refund slabs -> readable rows ("48+ hrs: 100% refund", ...).
const formatRefundRules = (rules = []) => {
    const sorted = [...rules].sort((a, b) => b.hoursBefore - a.hoursBefore);
    if (sorted.length === 0) return [];
    const rows = sorted.map((r, i) => `${i === 0 ? `${r.hoursBefore}+ hrs` : `${r.hoursBefore}–${sorted[i - 1].hoursBefore} hrs`} before event: ${Number(r.refundPercent) > 0 ? `${r.refundPercent}% refund` : 'No refund'}`);
    const last = sorted[sorted.length - 1];
    if (Number(last.hoursBefore) > 0) rows.push(`Less than ${last.hoursBefore} hrs before event: No refund`);
    return rows;
};

// Same calculation as the backend (event start in India time, % of amount paid).
const previewEventRefund = (booking) => {
    const minutesOf = (time) => {
        const m = String(time || '').trim().split('-')[0].trim().match(/^(\d{1,2})(?::(\d{2}))?\s*(AM|PM)?$/i);
        if (!m) return 0;
        let h = Number(m[1]);
        const min = Number(m[2] || 0);
        const p = m[3]?.toUpperCase();
        if (p) { if (h === 12) h = p === 'AM' ? 0 : 12; else if (p === 'PM') h += 12; }
        return h * 60 + min;
    };
    // Hours are counted from the event date at first payment (same as backend).
    const baseDate = booking.refundBaseEventDate || booking.eventDate;
    const baseTime = booking.refundBaseEventDate ? booking.refundBaseEventTime : booking.eventTime;
    const dateStr = baseDate ? new Date(baseDate).toISOString().slice(0, 10) : '';
    const mins = minutesOf(baseTime);
    const start = dateStr ? new Date(`${dateStr}T${String(Math.floor(mins / 60)).padStart(2, '0')}:${String(mins % 60).padStart(2, '0')}:00+05:30`) : null;
    const hoursLeft = start ? (start.getTime() - Date.now()) / 3600000 : 0;
    const total = Number(booking.totalAmount) || 0;
    const verifiedPaid = Math.min(total, Number(booking.amountPaid) || 0);
    const legacyPaid = booking.paymentStatus === 'PAID' ? total : booking.paymentStatus === 'ADVANCE_PAID' ? Math.min(total, Number(booking.advancePaymentAmount) || 0) : 0;
    const isVerified = verifiedPaid > 0;
    const paid = isVerified ? verifiedPaid : legacyPaid;
    const lines = (booking.selectedProducts || []).map(line => {
        const addOns = (line.selectedAddOns || []).reduce((s, a) => s + (Number(a.price) || 0), 0);
        const lineTotal = (Number(line.price || line.unitPrice) || 0) * (Number(line.quantity) || 1) + addOns;
        const rules = [...(line.cancellationRules || [])].sort((a, b) => b.hoursBefore - a.hoursBefore);
        const slab = rules.find(r => hoursLeft >= Number(r.hoursBefore));
        const refundPercent = slab ? Math.min(100, Math.max(0, Number(slab.refundPercent) || 0)) : 0;
        const linePaid = total > 0 ? paid * (lineTotal / total) : 0;
        return { name: line.productId?.name || line.productName || 'Product', refundPercent, refundAmount: Math.round(linePaid * refundPercent) / 100, hasRules: rules.length > 0 };
    });
    const refundAmount = Math.round(lines.reduce((s, l) => s + l.refundAmount, 0) * 100) / 100;
    // COD cash part can only go to the wallet; the online part can go back to the account.
    const codShare = isVerified && verifiedPaid > 0
        ? Math.round(refundAmount * Math.min(1, (Number(booking.codAmountCollected) || 0) / verifiedPaid) * 100) / 100
        : 0;
    return { hoursLeft, paid, lines, isVerified, refundAmount, onlineRefund: Math.round((refundAmount - codShare) * 100) / 100, codRefund: codShare };
};

const OrdersPage = () => {
    const navigate = useNavigate();
    const routerLocation = useRouterLocation();
    const { settings } = useSettings();

    // Event bookings carry the seller's configured advance percentage.
    // Fall back to the global setting only for legacy bookings without it.
    const getEventAdvancePercentage = (booking) => {
        const bookingPercentage = Number(booking?.advancePaymentPercentage);
        if (Number.isFinite(bookingPercentage) && bookingPercentage >= 0) return bookingPercentage;
        return Number(settings?.bookingControl?.advanceBookingLimitPercent ?? 20);
    };
    const { currentLocation, availableModules } = useLocation();
    const { toggleMode } = useCustomerMode();

    // Check if a specific tab was requested via route state or URL params (e.g., /orders?tab=events)
    const queryTab = new URLSearchParams(routerLocation.search).get('tab');
    const initialTab = routerLocation.state?.tab || queryTab || sessionStorage.getItem('jalapino_orders_tab') || 'retail';

    const [activeTab, setActiveTab] = useState(initialTab);

    useEffect(() => {
        if (routerLocation.state?.tab) {
            setActiveTab(routerLocation.state.tab);
        } else if (queryTab) {
            setActiveTab(queryTab);
        }
    }, [routerLocation.state, queryTab]);

    // Determine enabled tabs based on current location DB settings & platform settings
    const isRetailVisible = availableModules ? Boolean(availableModules.retailEnabled && settings?.platformControl?.retailEnabled !== false) : true;
    const isWholesaleVisible = availableModules ? Boolean(availableModules.wholesaleEnabled && settings?.platformControl?.wholesaleEnabled !== false) : false;
    const isEventsVisible = availableModules ? Boolean(availableModules.planMyEventEnabled && settings?.platformControl?.planMyEventEnabled !== false) : true;

    // Auto-select valid active tab if current active tab is not visible in current location
    useEffect(() => {
        if (activeTab === 'retail' && !isRetailVisible) {
            if (isWholesaleVisible) setActiveTab('wholesale');
            else if (isEventsVisible) setActiveTab('events');
        } else if (activeTab === 'wholesale' && !isWholesaleVisible) {
            if (isRetailVisible) setActiveTab('retail');
            else if (isEventsVisible) setActiveTab('events');
        } else if (activeTab === 'events' && !isEventsVisible) {
            if (isRetailVisible) setActiveTab('retail');
            else if (isWholesaleVisible) setActiveTab('wholesale');
        }
    }, [activeTab, isRetailVisible, isWholesaleVisible, isEventsVisible]);
    const [orders, setOrders] = useState([]);
    const [eventBookings, setEventBookings] = useState([]);
    const [loading, setLoading] = useState(true);
    const [editingEvent, setEditingEvent] = useState(null);
    const [editFormData, setEditFormData] = useState({ guestCount: '', budget: '', date: '', time: '', location: '' });
    const [quotationBusy, setQuotationBusy] = useState('');
    // Cancel popup with Wallet / Account refund choice (only for sellers allowed by admin).
    const [refundChoice, setRefundChoice] = useState(null);

    const handleQuotationResponse = async (booking, service, action) => {
        let note = '';
        if (action === 'REQUEST_REVISION') {
            note = window.prompt('Seller ko revision ke liye kya update chahiye?') || '';
            if (!note.trim()) return;
        }
        const busyKey = `${booking._id}:${service.seller?._id || service.seller}`;
        setQuotationBusy(busyKey);
        try {
            const { data } = await customerApi.respondToEventQuotation(booking._id, { sellerId: service.seller?._id || service.seller, action, note });
            const updated = data?.result || data?.data || data;
            setEventBookings(prev => prev.map(item => String(item._id) === String(booking._id) ? updated : item));
            toast.success(action === 'APPROVE' ? 'Quotation approved' : 'Revision requested');
        } catch (error) {
            toast.error(error?.response?.data?.message || 'Quotation response failed');
        } finally {
            setQuotationBusy('');
        }
    };

    const filteredRetailOrders = orders.filter(order => {
        if (order.moduleType === 'wholesale') return false; // Default to retail if missing
        if (!currentLocation?.city) return true;
        const sellerCity = order.seller?.address?.city || order.items?.[0]?.product?.seller?.address?.city || order.address?.city || '';
        return sellerCity.toLowerCase().includes(currentLocation.city.toLowerCase());
    });

    const filteredWholesaleOrders = orders.filter(order => {
        if (order.moduleType !== 'wholesale') return false;
        if (!currentLocation?.city) return true;
        const sellerCity = order.seller?.address?.city || order.items?.[0]?.product?.seller?.address?.city || order.address?.city || '';
        return sellerCity.toLowerCase().includes(currentLocation.city.toLowerCase());
    });

    const filteredEventBookings = eventBookings.filter(booking => {
        if (!currentLocation?.city) return true;
        const bookingLocation = booking.location?.address || booking.location || '';
        return bookingLocation.toLowerCase().includes(currentLocation.city.toLowerCase());
    });

    // Alternative Seller States
    const [altModalOpen, setAltModalOpen] = useState(false);
    const [altLoading, setAltLoading] = useState(false);
    const [altSellers, setAltSellers] = useState([]);
    const [selectedServiceForAlt, setSelectedServiceForAlt] = useState(null);
    const [selectedAltBookingId, setSelectedAltBookingId] = useState(null);

    // Support Ticket State
    const [ticketModalOpen, setTicketModalOpen] = useState(false);
    const [ticketFormData, setTicketFormData] = useState({ subject: '', category: 'booking', description: '', priority: 'medium' });

    // Event Seller Review States
    const [reviewModalOpen, setReviewModalOpen] = useState(false);
    const [selectedReviewBooking, setSelectedReviewBooking] = useState(null);
    const [reviewRating, setReviewRating] = useState(5);
    const [reviewHoverRating, setReviewHoverRating] = useState(0);
    const [reviewText, setReviewText] = useState('');
    const [isSubmittingReview, setIsSubmittingReview] = useState(false);

    // Auto-open review modal if reviewBookingId in query params
    const reviewBookingId = new URLSearchParams(routerLocation.search).get('reviewBookingId');
    useEffect(() => {
        if (reviewBookingId && eventBookings.length > 0) {
            const targetBooking = eventBookings.find(b => String(b._id) === String(reviewBookingId));
            if (targetBooking) {
                setActiveTab('events');
                setSelectedReviewBooking(targetBooking);
                setReviewRating(targetBooking.sellerRating || 5);
                setReviewText(targetBooking.sellerReview || '');
                setReviewModalOpen(true);
            }
        }
    }, [reviewBookingId, eventBookings]);

    const handleOpenReviewModal = (booking) => {
        setSelectedReviewBooking(booking);
        setReviewRating(booking.sellerRating || 5);
        setReviewText(booking.sellerReview || '');
        setReviewModalOpen(true);
    };

    const handleSubmitReview = async (e) => {
        e?.preventDefault();
        if (!selectedReviewBooking) return;
        if (!reviewRating || reviewRating < 1 || reviewRating > 5) {
            return toast.error("Please select a rating between 1 and 5 stars");
        }
        setIsSubmittingReview(true);
        toast.loading("Submitting review...", { id: 'review' });
        try {
            const res = await customerApi.submitEventBookingReview(selectedReviewBooking._id, {
                rating: reviewRating,
                review: reviewText
            });
            if (res.data?.success) {
                toast.success("Thank you! Your review has been saved in database.", { id: 'review' });
                setEventBookings(prev => prev.map(b => {
                    if (b._id === selectedReviewBooking._id) {
                        return {
                            ...b,
                            sellerRating: reviewRating,
                            sellerReview: reviewText,
                            sellerReviewedAt: new Date()
                        };
                    }
                    return b;
                }));
                setReviewModalOpen(false);
                setSelectedReviewBooking(null);
            } else {
                toast.error(res.data?.message || "Failed to submit review", { id: 'review' });
            }
        } catch (err) {
            console.error("Submit review error:", err);
            toast.error(err.response?.data?.message || "Failed to submit review", { id: 'review' });
        } finally {
            setIsSubmittingReview(false);
        }
    };

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
        // Show the seller's policy + the refund the customer will get if they cancel now.
        const booking = eventBookings.find(b => b._id === id);
        const policies = (booking?.selectedProducts || [])
            .filter(p => String(p.cancellationPolicy || '').trim() !== '')
            .map(p => `• ${p.productId?.name || p.productName || 'Product'}: ${String(p.cancellationPolicy).trim()}`);
        const preview = booking ? previewEventRefund(booking) : null;
        const refundLines = preview && preview.lines.some(l => l.hasRules)
            ? [
                `Refund if you cancel now:`,
                ...preview.lines.filter(l => l.hasRules).map(l => `• ${l.name}: ${l.refundPercent}%`),
                preview.paid > 0
                    ? (preview.isVerified
                        ? `Total refund to wallet: ₹${preview.refundAmount.toLocaleString('en-IN')} (of ₹${preview.paid.toLocaleString('en-IN')} paid)`
                        : `Refund of ₹${preview.refundAmount.toLocaleString('en-IN')} will be reviewed before it is credited.`)
                    : 'No payment made yet, so nothing to refund.',
            ]
            : [];
        // Admin allowed "Refund to Account" for this seller and there is an online amount
        // to send back -> let the customer choose Wallet or Account.
        const canChooseAccount = !!preview?.isVerified && Number(preview?.onlineRefund) > 0
            && (booking?.services || []).some(s => s?.seller?.accountRefundEnabled === true);
        if (canChooseAccount) {
            setRefundChoice({ id, policies, preview, method: 'WALLET' });
            return;
        }
        const confirmText = [
            policies.length > 0 ? `Cancellation & Refund Policy:\n${policies.join('\n')}` : '',
            refundLines.join('\n'),
            'Are you sure you want to cancel this event booking?',
        ].filter(Boolean).join('\n\n');
        if (!window.confirm(confirmText)) return;
        await performCancelEvent(id);
    };

    const performCancelEvent = async (id, refundMethod) => {
        try {
            toast.loading("Cancelling booking...", { id: 'cancel' });
            const res = await customerApi.cancelEventBooking(id, refundMethod ? { refundMethod } : undefined);
            const cancellationRefund = res?.data?.result?.cancellationRefund || res?.data?.data?.cancellationRefund;
            const refunded = ['CREDITED_TO_WALLET', 'REFUNDED_TO_ACCOUNT', 'ACCOUNT_AND_WALLET'].includes(cancellationRefund?.refundStatus);
            setEventBookings(prev => prev.map(b => b._id === id
                ? { ...b, overallStatus: 'CANCELLED', ...(cancellationRefund ? { cancellationRefund, paymentStatus: refunded ? 'REFUNDED' : b.paymentStatus } : {}) }
                : b));
            const fmt = (v) => `₹${Number(v || 0).toLocaleString('en-IN')}`;
            if (cancellationRefund?.refundStatus === 'REFUNDED_TO_ACCOUNT') {
                toast.success(`Booking cancelled. ${fmt(cancellationRefund.accountRefundAmount)} will be refunded to your original payment method in 5-7 working days.`, { id: 'cancel' });
                return;
            }
            if (cancellationRefund?.refundStatus === 'ACCOUNT_AND_WALLET') {
                toast.success(`Booking cancelled. ${fmt(cancellationRefund.accountRefundAmount)} to your account (5-7 working days) and ${fmt(cancellationRefund.walletRefundAmount)} to your wallet.`, { id: 'cancel' });
                return;
            }
            if (cancellationRefund?.refundStatus === 'CREDITED_TO_WALLET') {
                toast.success(`Booking cancelled. ${fmt(cancellationRefund.walletRefundAmount || cancellationRefund.refundAmount)} refunded to your wallet.`, { id: 'cancel' });
                return;
            }
            if (cancellationRefund?.refundStatus === 'PENDING_REVIEW') {
                toast.success(`Booking cancelled. Refund of ₹${Number(cancellationRefund.refundAmount).toLocaleString('en-IN')} is under review.`, { id: 'cancel' });
                return;
            }
            toast.success("Booking cancelled successfully", { id: 'cancel' });
        } catch (error) {
            toast.error("Failed to cancel booking", { id: 'cancel' });
        }
    };

    // Bill PDF for one event booking, built from the same booking data (from DB) shown on the card.
    const handleDownloadEventBill = async (booking) => {
        try {
            const { jsPDF } = await import('jspdf');
            const doc = new jsPDF('p', 'mm', 'a4');
            const W = doc.internal.pageSize.getWidth();
            const H = doc.internal.pageSize.getHeight();
            const M = 14;
            let y = 16;
            const rs = (v) => `Rs. ${Number(v || 0).toLocaleString('en-IN', { maximumFractionDigits: 2 })}`;
            const ensure = (h) => { if (y + h > H - 16) { doc.addPage(); y = 16; } };
            const line = () => { doc.setDrawColor(226, 232, 240); doc.line(M, y, W - M, y); y += 5; };
            const heading = (t) => { ensure(10); doc.setFont('helvetica', 'bold'); doc.setFontSize(10); doc.setTextColor(88, 28, 135); doc.text(t.toUpperCase(), M, y); y += 6; doc.setTextColor(30, 41, 59); };
            const row = (label, value) => {
                const text = doc.splitTextToSize(String(value ?? ''), W - M * 2 - 45);
                ensure(text.length * 4.5 + 1);
                doc.setFont('helvetica', 'bold'); doc.setFontSize(9); doc.text(`${label}:`, M, y);
                doc.setFont('helvetica', 'normal'); doc.text(text, M + 45, y);
                y += text.length * 4.5 + 0.5;
            };

            const total = Number(booking.totalAmount) || 0;
            const advance = Math.round((total * getEventAdvancePercentage(booking)) / 100);
            const paid = Number(booking.amountPaid) > 0
                ? Math.min(total, Number(booking.amountPaid))
                : booking.paymentStatus === 'PAID' ? total : booking.paymentStatus === 'ADVANCE_PAID' ? advance : 0;
            const service = (booking.services || [])[0] || {};
            const seller = service.seller || {};

            // Header
            doc.setFont('helvetica', 'bold'); doc.setFontSize(18); doc.setTextColor(185, 28, 28);
            doc.text(settings?.appName || 'Jalpaino', M, y);
            doc.setFontSize(12); doc.setTextColor(30, 41, 59);
            doc.text('BOOKING BILL', W - M, y, { align: 'right' });
            y += 6;
            doc.setFont('helvetica', 'normal'); doc.setFontSize(9); doc.setTextColor(100, 116, 139);
            doc.text(`Booking ID: #${booking.bookingId || booking._id}`, W - M, y, { align: 'right' });
            y += 4.5;
            if (booking.createdAt) doc.text(`Booked on: ${new Date(booking.createdAt).toLocaleString('en-IN')}`, W - M, y, { align: 'right' });
            y += 4.5;
            doc.text(`Status: ${booking.overallStatus || ''}`, W - M, y, { align: 'right' });
            y += 6; doc.setTextColor(30, 41, 59); line();

            heading('Seller');
            row('Name', seller.name || seller.businessName || 'Assigned Seller');
            if (seller.phone || seller.mobile) row('Mobile', seller.phone || seller.mobile);
            // Company name + address of the seller (from DB)
            const companyName = seller.shopName || seller.businessName || service.category?.name;
            if (companyName) row('Company Name', companyName);
            const sellerAddress = [seller.address, seller.locality, seller.city, seller.pincode]
                .map(v => String(v || '').trim())
                .filter((v, i, arr) => v && !arr.slice(0, i).some(prev => prev.toLowerCase().includes(v.toLowerCase())))
                .join(', ');
            if (sellerAddress) row('Address', sellerAddress);
            y += 2; line();

            heading('Event Details');
            row('Event', `${booking.eventType || ''} Event`);
            if (Array.isArray(booking.multipleEvents) && booking.multipleEvents.length > 0) {
                // Every date with its own time & remarks (remarks only if filled).
                booking.multipleEvents.forEach((item, idx) => {
                    const dateText = item.date ? new Date(`${String(item.date).slice(0, 10)}T00:00:00`).toLocaleDateString('en-IN') : '';
                    const remarks = String(item.remarks || '').trim();
                    row(`Date ${idx + 1}`, `${item.typeName ? `${item.typeName}: ` : ''}${dateText}${item.time ? ` at ${item.time}` : ''}${remarks ? ` - ${remarks}` : ''}`);
                });
            } else if (booking.eventDate) {
                // Same labels as the booking form / order card: Booking Date + Booking Time Slot
                row('Booking Date', new Date(booking.eventDate).toLocaleDateString('en-IN', { day: '2-digit', month: '2-digit', year: 'numeric' }));
                if (booking.eventTime) row('Booking Time Slot', booking.eventTime);
                if (String(booking.remarks || '').trim()) row('Remarks / Occasion', String(booking.remarks).trim());
            }
            const rows = getEventDetailRows(booking.eventInfo || {});
            const address = typeof booking.location === 'string' ? booking.location : booking.location?.address;
            if (!rows.some(([label]) => label.endsWith('Location')) && address && !['Pending Address', 'Pending Location'].includes(address)) rows.push(['Location', address]);
            rows.forEach(([label, value]) => row(label, value));
            if (booking.selectedShop?.uniqueCode || booking.selectedShop?.shopNo) {
                row('Shop / Area', `${booking.selectedShop.uniqueCode || `Shop ${booking.selectedShop.shopNo || ''}`}${booking.selectedShop.bookingType ? ` (${booking.selectedShop.bookingType})` : ''}`);
            }
            y += 2; line();

            // Products table
            heading('Products');
            const cols = [M, W - M - 75, W - M - 50, W - M];
            ensure(8);
            doc.setFillColor(245, 243, 255); doc.rect(M, y - 4, W - M * 2, 7, 'F');
            doc.setFont('helvetica', 'bold'); doc.setFontSize(9);
            doc.text('Item', cols[0] + 1, y); doc.text('Qty', cols[1], y); doc.text('Rate', cols[2], y); doc.text('Amount', cols[3] - 1, y, { align: 'right' });
            y += 7;
            doc.setFont('helvetica', 'normal');
            (booking.selectedProducts || []).forEach((p) => {
                const name = `${p.productId?.name || p.productName || 'Product'}${p.selectedVariant?.name ? ` (${p.selectedVariant.name})` : ''}`;
                const nameLines = doc.splitTextToSize(name, cols[1] - cols[0] - 4);
                const rate = Number(p.price || p.unitPrice || 0);
                const amount = Number(p.lineTotal || (rate * (p.quantity || 1)));
                ensure(nameLines.length * 4.5 + 2);
                doc.setFontSize(9);
                doc.text(nameLines, cols[0] + 1, y);
                doc.text(String(p.quantity || 1), cols[1], y);
                doc.text(rs(rate), cols[2], y);
                doc.text(rs(amount), cols[3] - 1, y, { align: 'right' });
                y += nameLines.length * 4.5;
                if (p.selectedAddOns?.length > 0) {
                    const addOns = doc.splitTextToSize(`Add-ons: ${p.selectedAddOns.map(a => `${a.name} (${rs(a.price)})`).join(', ')}`, W - M * 2 - 6);
                    ensure(addOns.length * 4);
                    doc.setFontSize(8); doc.setTextColor(100, 116, 139);
                    doc.text(addOns, cols[0] + 3, y); y += addOns.length * 4;
                    doc.setTextColor(30, 41, 59);
                }
                const refundRows = formatRefundRules(p.cancellationRules);
                const policy = String(p.cancellationPolicy || '').trim();
                if (refundRows.length > 0 || policy) {
                    const txt = doc.splitTextToSize(`Cancellation & Refund: ${[refundRows.join(' | '), policy].filter(Boolean).join(' - ')}`, W - M * 2 - 6);
                    ensure(txt.length * 4);
                    doc.setFontSize(8); doc.setTextColor(159, 18, 57);
                    doc.text(txt, cols[0] + 3, y); y += txt.length * 4;
                    doc.setTextColor(30, 41, 59);
                }
                y += 2;
            });
            line();

            // Totals (same numbers as the booking card)
            const totalRow = (label, value, bold = false) => {
                ensure(6);
                doc.setFont('helvetica', bold ? 'bold' : 'normal'); doc.setFontSize(bold ? 11 : 9.5);
                doc.text(label, W - M - 60, y); doc.text(value, W - M - 1, y, { align: 'right' });
                y += bold ? 6.5 : 5.5;
            };
            totalRow('Total Amount', rs(total), true);
            doc.setFont('helvetica', 'normal'); doc.setFontSize(8); doc.setTextColor(100, 116, 139);
            doc.text('Inclusive of all taxes', W - M - 1, y - 2, { align: 'right' });
            doc.setTextColor(30, 41, 59); y += 2;
            totalRow('Payment Mode', String(booking.paymentMode || 'ONLINE'));
            totalRow('Payment Status', String(booking.paymentStatus || 'PENDING'));
            totalRow('Amount Paid', rs(paid));
            if (booking.overallStatus !== 'CANCELLED') totalRow('Balance Due', rs(Math.max(0, total - paid)), true);

            const cr = booking.cancellationRefund;
            if (booking.overallStatus === 'CANCELLED' && cr?.cancelledAt) {
                y += 2; line();
                heading('Cancellation & Refund');
                row('Cancelled on', new Date(cr.cancelledAt).toLocaleString('en-IN'));
                row('Refund Amount', rs(cr.refundAmount));
                const status = {
                    CREDITED_TO_WALLET: 'Refunded to wallet',
                    REFUNDED_TO_ACCOUNT: `Refunded to original payment method (${rs(cr.accountRefundAmount)})`,
                    ACCOUNT_AND_WALLET: `${rs(cr.accountRefundAmount)} to account + ${rs(cr.walletRefundAmount)} to wallet`,
                    PROCESSING: 'Refund is being processed',
                    PENDING_REVIEW: 'Refund under review',
                }[cr.refundStatus] || 'No refund';
                row('Refund Status', status);
            }

            ensure(14); y += 6;
            doc.setFont('helvetica', 'italic'); doc.setFontSize(8); doc.setTextColor(148, 163, 184);
            doc.text('This is a computer-generated bill and does not need a signature.', W / 2, y, { align: 'center' });

            doc.save(`Bill_${booking.bookingId || booking._id}.pdf`);
            toast.success('Bill downloaded');
        } catch (error) {
            console.error('Bill PDF failed:', error);
            toast.error('Failed to download bill');
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
            toast.error(error?.response?.data?.message || "Failed to update event", { id: 'edit' });
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
            toast.error(error?.response?.data?.message || "Failed to confirm booking.", { id: 'payment' });
        }
    };

    const handleRazorpayPayment = async (booking) => {
        try {
            toast.loading("Initiating Gateway...", { id: 'payment' });
            
            // GASP: Calculate Advance Amount
            const advanceLimit = getEventAdvancePercentage(booking);
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
                name: "Jalpaino Events",
                description: `Payment for Booking ${booking.bookingId}`,
                order_id: rzpRes.data.result.id,
                handler: async function (response) {
                    try {
                        toast.loading("Verifying payment...", { id: 'payment' });
                        // Server verifies the payment with Razorpay before marking it paid.
                        const { data } = await customerApi.verifyEventPayment(booking._id, {
                            razorpay_order_id: response.razorpay_order_id,
                            razorpay_payment_id: response.razorpay_payment_id,
                            razorpay_signature: response.razorpay_signature,
                        });
                        const updated = data?.result || data?.data;
                        toast.success(updated?.paymentStatus === 'PAID' ? "Payment successful! Booking confirmed." : "Advance Payment successful! Booking confirmed.", { id: 'payment' });
                        setEventBookings(prev => prev.map(b => b._id === booking._id
                            ? { ...b, ...(updated ? { paymentMode: updated.paymentMode, paymentStatus: updated.paymentStatus, overallStatus: updated.overallStatus, amountPaid: updated.amountPaid, refundBaseEventDate: updated.refundBaseEventDate, refundBaseEventTime: updated.refundBaseEventTime } : {}) }
                            : b));
                    } catch (err) {
                        toast.error(err?.response?.data?.message || "Failed to confirm booking after payment.", { id: 'payment' });
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
            toast.error(error?.response?.data?.message || error.message || "Failed to initiate Razorpay payment", { id: 'payment' });
        }
    };

    const handleRemainingPayment = async (booking) => {
        try {
            toast.loading("Initiating Gateway...", { id: 'payment' });
            
            const advanceLimit = getEventAdvancePercentage(booking);
            const advanceAmount = Math.round((booking.totalAmount * advanceLimit) / 100);
            const remainingAmount = booking.totalAmount - advanceAmount;

            const rzpRes = await customerApi.createRazorpayOrder(booking._id, { amount: remainingAmount });
            
            if (!rzpRes.data || !rzpRes.data.result) {
                throw new Error("Failed to create Razorpay order");
            }

            const options = {
                key: "rzp_test_S3IcSS1NbymL6D", 
                amount: rzpRes.data.result.amount,
                currency: "INR",
                name: "Jalpaino Events",
                description: `Remaining Payment for Booking ${booking.bookingId}`,
                order_id: rzpRes.data.result.id,
                handler: async function (response) {
                    try {
                        toast.loading("Verifying payment...", { id: 'payment' });
                        // Server verifies the payment with Razorpay before marking it paid.
                        const { data } = await customerApi.verifyEventPayment(booking._id, {
                            razorpay_order_id: response.razorpay_order_id,
                            razorpay_payment_id: response.razorpay_payment_id,
                            razorpay_signature: response.razorpay_signature,
                        });
                        const updated = data?.result || data?.data;
                        toast.success("Remaining Payment successful!", { id: 'payment' });
                        setEventBookings(prev => prev.map(b => b._id === booking._id
                            ? { ...b, ...(updated ? { paymentStatus: updated.paymentStatus, overallStatus: updated.overallStatus, amountPaid: updated.amountPaid } : { paymentStatus: 'PAID' }) }
                            : b));
                    } catch (err) {
                        toast.error(err?.response?.data?.message || "Failed to confirm payment.", { id: 'payment' });
                    }
                },
                theme: { color: "#9333ea" }
            };

            const rzp = new window.Razorpay(options);
            rzp.on('payment.failed', function (response){
                toast.error("Payment failed: " + response.error.description, { id: 'payment' });
            });
            rzp.open();
            toast.dismiss('payment');
        } catch (error) {
            toast.error(error.message || "Failed to initiate payment", { id: 'payment' });
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
                    onClick={() => {
                        if (activeTab === 'events') {
                            navigate('/plan-my-event');
                        } else if (activeTab === 'wholesale') {
                            if (toggleMode) toggleMode('whole');
                            navigate('/');
                        } else {
                            if (toggleMode) toggleMode('retail');
                            navigate('/');
                        }
                    }}
                    className="w-10 h-10 flex items-center justify-center hover:bg-white/10 rounded-full transition-colors -ml-1"
                >
                    <ChevronLeft size={22} className="text-white" />
                </button>
                <h1 className="text-xl font-bold text-white tracking-tight font-['Inter']">My Orders</h1>
            </div>

            <div className="flex bg-white px-4 pt-2 border-b border-slate-100 mb-4 shadow-sm sticky top-[64px] z-20">
                {isRetailVisible && (
                    <button 
                        onClick={() => setActiveTab('retail')}
                        className={`flex-1 py-3 text-[13px] font-bold border-b-2 transition-colors ${activeTab === 'retail' ? 'border-brand-600 text-brand-600' : 'border-transparent text-slate-500'}`}
                    >
                        Retail
                    </button>
                )}
                {isWholesaleVisible && (
                    <button 
                        onClick={() => setActiveTab('wholesale')}
                        className={`flex-1 py-3 text-[13px] font-bold border-b-2 transition-colors ${activeTab === 'wholesale' ? 'border-brand-600 text-brand-600' : 'border-transparent text-slate-500'}`}
                    >
                        Wholesale
                    </button>
                )}
                {isEventsVisible && (
                    <button 
                        onClick={() => setActiveTab('events')}
                        className={`flex-1 py-3 text-[13px] font-bold border-b-2 transition-colors ${activeTab === 'events' ? 'border-brand-600 text-brand-600' : 'border-transparent text-slate-500'}`}
                    >
                        Events
                    </button>
                )}
            </div>

            <div className="space-y-4 px-4 pb-2">
                {activeTab === 'retail' && filteredRetailOrders.length === 0 && (
                    <div className="flex flex-col items-center justify-center py-20 text-center">
                        <Package size={56} className="text-slate-300 mb-4" />
                        <h3 className="text-base font-semibold text-slate-900 mb-1">No retail orders yet</h3>
                        <p className="text-slate-500 text-sm mb-6 max-w-[260px]">
                            When you place a retail order, it will appear here so you can track it easily.
                        </p>
                        <Link to="/" className="bg-primary hover:bg-[#0a6d19] text-white px-7 py-2.5 rounded-full font-semibold text-sm shadow-sm transition-colors">
                             Start Shopping
                        </Link>
                    </div>
                )}

                {activeTab === 'retail' && filteredRetailOrders.length > 0 && (
                    filteredRetailOrders.map((order) => {
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

                {activeTab === 'wholesale' && filteredWholesaleOrders.length === 0 && (
                    <div className="flex flex-col items-center justify-center py-20 text-center">
                        <Package size={56} className="text-slate-300 mb-4" />
                        <h3 className="text-base font-semibold text-slate-900 mb-1">No wholesale orders yet</h3>
                        <p className="text-slate-500 text-sm mb-6 max-w-[260px]">
                            When you place a wholesale order, it will appear here so you can track it easily.
                        </p>
                        <Link to="/" className="bg-primary hover:bg-[#0a6d19] text-white px-7 py-2.5 rounded-full font-semibold text-sm shadow-sm transition-colors">
                             Start Wholesale Shopping
                        </Link>
                    </div>
                )}

                {activeTab === 'wholesale' && filteredWholesaleOrders.length > 0 && (
                    filteredWholesaleOrders.map((order) => {
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

                {/* Customization & Quotation requests (separate from bookings) */}
                {activeTab === 'events' && <CustomizationRequestsList />}

                {activeTab === 'events' && filteredEventBookings.length === 0 && (
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

                {activeTab === 'events' && filteredEventBookings.length > 0 && (
                    filteredEventBookings.map((booking) => (
                        <div
                            key={booking._id}
                            className="block bg-white rounded-2xl px-4 py-3.5 shadow-[0_8px_24px_rgba(15,23,42,0.06)] border border-slate-100/80 mb-4"
                        >
                            <div className="flex justify-between items-start mb-3 gap-2">
                                <div className="min-w-0 flex-1">
                                    <div className="flex items-center gap-2 flex-wrap mb-1">
                                        <h3 className="font-bold text-slate-900 capitalize text-sm">
                                            {booking.eventType} Event
                                        </h3>
                                        <span className="text-[11px] font-bold text-purple-700 bg-purple-50 border border-purple-200/80 px-2 py-0.5 rounded-md">
                                            Order ID: #{booking.bookingId || booking._id}
                                        </span>
                                    </div>
                                    {/* Event date & time slot the customer booked (same date/slot the seller sees) */}
                                    <p className="text-xs text-slate-500 mt-0.5">
                                        <span className="font-semibold text-slate-600">Booking Date:</span> {booking.eventDate ? new Date(booking.eventDate).toLocaleDateString('en-IN', { day: '2-digit', month: '2-digit', year: 'numeric' }) : '-'}
                                        {booking.eventTime ? <><span className="mx-1">·</span><span className="font-semibold text-slate-600">Booking Time Slot:</span> {booking.eventTime}</> : null}
                                    </p>
                                </div>
                                <div className="flex flex-col items-end gap-1 shrink-0">
                                    <span className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[10px] font-bold uppercase shrink-0 ${booking.overallStatus === 'CANCELLED' ? 'bg-rose-50 text-rose-700 border-rose-100' : 'bg-purple-50 text-purple-700 border-purple-100'}`}>
                                        {booking.overallStatus || booking.status}
                                    </span>
                                    {/* Booking date & time (same as the seller's reservation card) */}
                                    {booking.createdAt && !isNaN(new Date(booking.createdAt).getTime()) && (
                                        <span className="text-[11px] font-semibold text-slate-400 whitespace-nowrap">
                                            {`Ordered on: ${new Date(booking.createdAt).toLocaleDateString('en-IN', { day: '2-digit', month: '2-digit', year: 'numeric' })}, ${new Date(booking.createdAt).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}`}
                                        </span>
                                    )}
                                </div>
                            </div>
                            {/* Multiple dates: every date with its own time & remarks (remarks only if filled). */}
                            {Array.isArray(booking.multipleEvents) && booking.multipleEvents.length > 0 && (
                                <div className="mb-3 rounded-xl border border-amber-100 bg-amber-50/60 p-3 text-xs">
                                    <p className="mb-1.5 font-bold uppercase tracking-wider text-amber-800">Dates & Remarks</p>
                                    <div className="space-y-1">
                                        {booking.multipleEvents.map((item, idx) => (
                                            <div key={item.id || idx} className="flex flex-col gap-0.5 text-slate-700 sm:flex-row sm:justify-between sm:gap-2">
                                                <span className="font-semibold">{item.typeName || `Date ${idx + 1}`}</span>
                                                <span className="min-w-0 break-words font-semibold sm:text-right">
                                                    {`${item.date ? new Date(`${String(item.date).slice(0, 10)}T00:00:00`).toLocaleDateString('en-IN') : ''}${item.time ? ` at ${item.time}` : ''}`}
                                                    {String(item.remarks || '').trim() && <span className="block text-[11px] font-medium italic text-slate-500">📝 {item.remarks}</span>}
                                                </span>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}
                            {/* Same event details the customer filled (only filled fields). */}
                            <div className="text-xs text-slate-600 mb-3 space-y-1">
                                {(() => {
                                    const rows = getEventDetailRows(booking.eventInfo || {});
                                    const address = typeof booking.location === 'string' ? booking.location : booking.location?.address;
                                    const hasLocationRow = rows.some(([label]) => label.endsWith('Location'));
                                    if (!hasLocationRow && address && !['Pending Address', 'Pending Location'].includes(address)) {
                                        rows.push(['Location', address]);
                                    }
                                    return rows.map(([label, value]) => (
                                        <p key={label} className="break-words"><span className="font-medium">{label}:</span> {value}</p>
                                    ));
                                })()}
                            </div>

                            {/* Only when a shop/hall was really selected (DB keeps an empty object otherwise) */}
                            {(booking.selectedShop?.uniqueCode || booking.selectedShop?.shopNo) && (
                                <div className="mb-3 flex items-center justify-between gap-3 rounded-xl border border-purple-200 bg-purple-50 p-3 text-xs">
                                    <span className="font-black text-purple-900">📍 Selected Shop / Area</span>
                                    <span className="font-extrabold text-purple-700">
                                        {booking.selectedShop.uniqueCode || `Shop ${booking.selectedShop.shopNo || ''}`} {booking.selectedShop.bookingType ? `(${booking.selectedShop.bookingType})` : ''}
                                    </span>
                                </div>
                            )}

                            {Array.isArray(booking.selectedProducts) && booking.selectedProducts.length > 0 && (
                                <div className="mb-4 rounded-xl border border-purple-100 bg-purple-50/60 p-3">
                                    <p className="mb-1.5 text-xs font-bold uppercase tracking-wider text-purple-900">Selected Products</p>
                                    <div className="space-y-1.5">
                                        {booking.selectedProducts.map((product, productIndex) => (
                                            <div key={productIndex} className="text-xs text-slate-700">
                                                <div className="flex items-center justify-between gap-3">
                                                    <span className="font-semibold">
                                                        {product.productId?.name || product.productName || 'Product'}{product.selectedVariant?.name ? ` (${product.selectedVariant.name})` : ''} × {product.quantity}
                                                    </span>
                                                    <span className="font-bold text-purple-700">₹{Number(product.lineTotal || ((product.price || product.unitPrice || 0) * (product.quantity || 1))).toLocaleString('en-IN')}</span>
                                                </div>
                                                <div className="pl-2 text-[10px] font-semibold text-slate-500">({product.quantity || 1} × ₹{Number(product.price || product.unitPrice || 0).toLocaleString('en-IN')})</div>
                                                {product.selectedAddOns?.length > 0 && <div className="pl-2 text-[10px] text-purple-700">Add-ons: {product.selectedAddOns.map(addOn => `${addOn.name} (₹${addOn.price})`).join(', ')}</div>}
                                                {(String(product.cancellationPolicy || '').trim() !== '' || (product.cancellationRules || []).length > 0) && (
                                                    <div className="mt-1 ml-2 rounded-md border border-rose-100 bg-rose-50/70 px-2 py-1 text-[10px] text-rose-800 whitespace-pre-line">
                                                        <span className="font-bold uppercase tracking-wider">Cancellation & Refund: </span>
                                                        {formatRefundRules(product.cancellationRules).length > 0 && (
                                                            <div className="font-semibold">{formatRefundRules(product.cancellationRules).join(' · ')}</div>
                                                        )}
                                                        {String(product.cancellationPolicy || '').trim() !== '' && <div>{product.cancellationPolicy}</div>}
                                                    </div>
                                                )}
                                            </div>
                                        ))}
                                    </div>
                                    <button
                                        type="button"
                                        onClick={() => handleDownloadEventBill(booking)}
                                        className="mt-3 inline-flex w-full sm:w-auto items-center justify-center gap-1.5 rounded-lg border border-purple-200 bg-white px-3 py-2 text-xs font-bold text-purple-700 hover:bg-purple-100 transition-colors"
                                    >
                                        <Download size={14} /> Download Bill (PDF)
                                    </button>
                                </div>
                            )}

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
                                            {service.quotation?.status && service.quotation.status !== 'NOT_SENT' && (
                                                <div className="w-full mt-2 rounded-lg border border-indigo-100 bg-indigo-50 p-3">
                                                    <p className="text-xs font-bold text-indigo-900">Seller Quotation: ₹{Number(service.quotation.amount || 0).toLocaleString('en-IN')} · {service.quotation.status.replaceAll('_', ' ')}</p>
                                                    {service.quotation.note && <p className="text-xs text-slate-600 mt-1">{service.quotation.note}</p>}
                                                    {(service.quotation.status === 'PENDING_CUSTOMER' || (service.quotation.status === 'APPROVED' && service.quotePermissions?.revision && service.status !== 'ACCEPTED')) && (
                                                        <div className="flex flex-wrap gap-2 mt-3">
                                                            {service.quotation.status === 'PENDING_CUSTOMER' && service.quotePermissions?.customerApproval && <button disabled={quotationBusy === `${booking._id}:${service.seller?._id || service.seller}`} onClick={() => handleQuotationResponse(booking, service, 'APPROVE')} className="px-3 py-1.5 rounded-lg bg-green-600 text-white text-xs font-bold disabled:opacity-50">Customer Approval · Approve</button>}
                                                            {service.quotePermissions?.revision && <button disabled={quotationBusy === `${booking._id}:${service.seller?._id || service.seller}`} onClick={() => handleQuotationResponse(booking, service, 'REQUEST_REVISION')} className="px-3 py-1.5 rounded-lg border border-amber-300 bg-white text-amber-800 text-xs font-bold disabled:opacity-50">Quote Revision</button>}
                                                        </div>
                                                    )}
                                                </div>
                                            )}
                                        </div>
                                    ))}
                                </div>
                            </div>

                            <div className="border-t border-slate-100 pt-3 flex flex-col gap-1 mb-3">
                                <div className="flex justify-between items-center">
                                    <span className="text-[11px] font-medium text-slate-500">
                                        Payment: {booking.paymentMode || 'ONLINE'} ({booking.paymentStatus})
                                    </span>
                                    <span className="text-sm font-bold text-slate-900">
                                        Total: ₹{booking.totalAmount?.toLocaleString()}
                                    </span>
                                </div>
                                <p className="text-right text-[10px] font-medium text-slate-400 -mt-1">Inclusive of all taxes</p>
                                {/* Amount actually paid (same as seller's booking view): online / COD cash / total / balance */}
                                {booking.overallStatus !== 'CANCELLED' && (() => {
                                    const total = Number(booking.totalAmount || 0);
                                    const mode = String(booking.paymentMode || 'ONLINE').toUpperCase();
                                    const status = String(booking.paymentStatus || 'PENDING').toUpperCase();
                                    let cod = Number(booking.codAmountCollected) || 0;
                                    let online = Math.max(0, (Number(booking.amountPaid) || 0) - cod);
                                    if (cod === 0 && online === 0) {
                                        if (status === 'PAID') { if (mode === 'COD') cod = total; else online = total; }
                                        else if (status === 'ADVANCE_PAID') online = Number(booking.advancePaymentAmount) > 0 ? Number(booking.advancePaymentAmount) : Math.round((total * getEventAdvancePercentage(booking)) / 100);
                                    }
                                    if (mode === 'COD' && status === 'PAID' && cod === 0 && online < total) cod = total - online;
                                    const paid = Math.min(total, cod + online);
                                    const balance = Math.max(0, total - paid);
                                    // COD booked, nothing paid yet: advance to give in cash (same advance as online).
                                    const advancePct = Number(booking.advancePaymentPercentage) > 0 ? Number(booking.advancePaymentPercentage) : 30;
                                    const codAdvance = Number(booking.advancePaymentAmount) > 0 ? Number(booking.advancePaymentAmount) : Math.round((total * advancePct) / 100);
                                    const showCodAdvance = mode === 'COD' && paid <= 0 && codAdvance > 0 && codAdvance < total && booking.overallStatus !== 'PAYMENT_PENDING';
                                    const rows = [
                                        showCodAdvance && [`Advance to pay in Cash (${advancePct}%)`, codAdvance, 'text-purple-700'],
                                        online > 0 && ['Paid Online', online, 'text-purple-700'],
                                        cod > 0 && ['Paid in Cash (COD)', cod, 'text-emerald-700'],
                                        ['Total Paid', paid, 'text-slate-900'],
                                        balance > 0 && [mode === 'COD' ? 'Balance Due (Cash)' : 'Balance Due', balance, 'text-amber-700'],
                                    ].filter(Boolean);
                                    return (
                                        <div className="mt-1.5 rounded-lg border border-slate-200 bg-white px-3 py-2 space-y-1">
                                            {rows.map(([label, value, color]) => (
                                                <div key={label} className="flex justify-between items-center gap-3">
                                                    <span className="text-[11px] font-semibold text-slate-500">{label}</span>
                                                    <span className={`text-xs font-extrabold ${color}`}>₹{Number(value).toLocaleString('en-IN')}/-</span>
                                                </div>
                                            ))}
                                        </div>
                                    );
                                })()}
                            </div>

                            {booking.overallStatus === 'PAYMENT_PENDING' && (
                                <div className="flex gap-2 border-t border-slate-100 pt-3 flex-col sm:flex-row">
                                    <button 
                                        onClick={() => handleCODPayment(booking)}
                                        className="flex-1 flex items-center justify-center py-2.5 text-xs font-bold text-slate-700 bg-white border border-slate-300 rounded-xl hover:bg-slate-50 transition-colors"
                                    >
                                        Cash on Delivery
                                    </button>
                                    
                                    {(settings?.paymentControl?.paymentGateway && settings?.paymentControl?.paymentGateway !== 'none') && (
                                        <button
                                            onClick={() => handleRazorpayPayment(booking)}
                                            className="flex-1 flex items-center justify-center gap-2 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 text-white py-2.5 rounded-xl text-xs font-bold transition-all shadow-lg shadow-purple-200"
                                        >
                                            <CreditCard className="h-4 w-4" />
                                            Pay ₹{Math.round((booking.totalAmount * getEventAdvancePercentage(booking)) / 100).toLocaleString()} Online
                                        </button>
                                    )}
                                </div>
                            )}

                            {/* Closed automatically: another customer paid for the same slot */}
                            {booking.overallStatus === 'CANCELLED' && (booking.services || []).some(s => s?.sellerNotes === 'Slot booked by another customer (payment done).') && (
                                <div className="mb-3 rounded-xl border border-rose-200 bg-rose-50 p-3 text-xs font-bold text-rose-700">
                                    🚫 Slot booked by another customer (payment done). Please choose another date or time.
                                </div>
                            )}

                            {/* Refund result after cancellation (worked out from the refund rules) */}
                            {booking.overallStatus === 'CANCELLED' && booking.cancellationRefund?.cancelledAt && (
                                <div className={`mb-3 rounded-xl border p-3 text-xs ${['CREDITED_TO_WALLET', 'REFUNDED_TO_ACCOUNT', 'ACCOUNT_AND_WALLET'].includes(booking.cancellationRefund.refundStatus) ? 'border-emerald-200 bg-emerald-50 text-emerald-800' : ['PENDING_REVIEW', 'PROCESSING'].includes(booking.cancellationRefund.refundStatus) ? 'border-amber-200 bg-amber-50 text-amber-800' : 'border-slate-200 bg-slate-50 text-slate-600'}`}>
                                    <p className="font-bold">
                                        {booking.cancellationRefund.refundStatus === 'REFUNDED_TO_ACCOUNT'
                                            ? `₹${Number(booking.cancellationRefund.accountRefundAmount || 0).toLocaleString('en-IN')} refunded to your original payment method (5-7 working days)`
                                            : booking.cancellationRefund.refundStatus === 'ACCOUNT_AND_WALLET'
                                            ? `₹${Number(booking.cancellationRefund.accountRefundAmount || 0).toLocaleString('en-IN')} to your account (5-7 working days) + ₹${Number(booking.cancellationRefund.walletRefundAmount || 0).toLocaleString('en-IN')} to your wallet`
                                            : booking.cancellationRefund.refundStatus === 'PROCESSING'
                                            ? `Refund of ₹${Number(booking.cancellationRefund.refundAmount).toLocaleString('en-IN')} is being processed`
                                            : booking.cancellationRefund.refundStatus === 'CREDITED_TO_WALLET'
                                            ? `₹${Number(booking.cancellationRefund.refundAmount).toLocaleString('en-IN')} refunded to your wallet`
                                            : booking.cancellationRefund.refundStatus === 'PENDING_REVIEW'
                                                ? `Refund of ₹${Number(booking.cancellationRefund.refundAmount).toLocaleString('en-IN')} is under review`
                                                : 'No refund for this cancellation'}
                                    </p>
                                    <p className="text-[10px] mt-0.5 opacity-80">
                                        Cancelled {Math.max(0, Math.floor(booking.cancellationRefund.hoursBeforeEvent || 0))} hrs before the event · Paid ₹{Number(booking.cancellationRefund.paidAmount || 0).toLocaleString('en-IN')}
                                    </p>
                                    {(booking.cancellationRefund.lines || []).filter(l => l.hasRules).map((l, i) => (
                                        <p key={i} className="text-[10px]">• {l.productName}: {l.refundPercent}% (₹{Number(l.refundAmount || 0).toLocaleString('en-IN')})</p>
                                    ))}
                                </div>
                            )}

                            {booking.overallStatus !== 'CANCELLED' && booking.overallStatus !== 'PAYMENT_PENDING' && (
                                <div className="flex gap-2 border-t border-slate-100 pt-3 flex-wrap">
                                    {booking.paymentStatus === 'ADVANCE_PAID' && booking.overallStatus === 'COMPLETED' && (
                                        <button 
                                            onClick={() => handleRemainingPayment(booking)}
                                            className="w-full flex items-center justify-center gap-2 bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-600 hover:to-teal-600 text-white py-2.5 rounded-xl text-xs font-bold transition-all shadow-md shadow-emerald-200 mb-1"
                                        >
                                            <CreditCard size={14} /> 
                                            Pay Remaining ₹{(booking.totalAmount - Math.round((booking.totalAmount * getEventAdvancePercentage(booking)) / 100)).toLocaleString()} Online
                                        </button>
                                    )}

                                    {booking.overallStatus === 'COMPLETED' && (
                                        <div className="w-full mb-1">
                                            {booking.sellerRating ? (
                                                <div className="bg-amber-50/80 border border-amber-200/70 rounded-xl p-2.5 flex items-center justify-between text-xs">
                                                    <div className="flex items-center gap-1.5 text-amber-800 font-bold">
                                                        <Star size={15} className="fill-amber-400 text-amber-500" />
                                                        <span>Your Review: {booking.sellerRating}/5 Stars</span>
                                                    </div>
                                                    {booking.sellerReview && (
                                                        <span className="text-slate-600 truncate max-w-[200px] text-[11px] italic" title={booking.sellerReview}>
                                                            "{booking.sellerReview}"
                                                        </span>
                                                    )}
                                                </div>
                                            ) : (
                                                <button
                                                    onClick={() => handleOpenReviewModal(booking)}
                                                    className="w-full flex items-center justify-center gap-1.5 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 text-white py-2.5 rounded-xl text-xs font-bold transition-all shadow-md shadow-amber-200"
                                                >
                                                    <Star size={14} className="fill-white" />
                                                    Rate & Review Seller
                                                </button>
                                            )}
                                        </div>
                                    )}
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
                            {(() => {
                                // Date & time are locked once payment is done (same rule as backend).
                                const dateTimeLocked = (Number(editingEvent?.amountPaid) || 0) > 0
                                    || ['ADVANCE_PAID', 'PAID', 'REFUNDED'].includes(editingEvent?.paymentStatus)
                                    || (editingEvent?.paymentMode === 'COD' && ['CONFIRMED', 'IN_PROGRESS', 'COMPLETED'].includes(editingEvent?.overallStatus));
                                return (
                                    <div>
                                        <div className="flex gap-3">
                                            <div className="flex-1">
                                                <label className="block text-xs font-semibold text-slate-600 mb-1">Date</label>
                                                <input type="date" value={editFormData.date} disabled={dateTimeLocked} onChange={(e) => setEditFormData({...editFormData, date: e.target.value})} className="w-full text-sm p-2.5 border rounded-xl disabled:bg-slate-100 disabled:text-slate-400 disabled:cursor-not-allowed" />
                                            </div>
                                            <div className="flex-1">
                                                <label className="block text-xs font-semibold text-slate-600 mb-1">Time</label>
                                                <input type="time" value={editFormData.time} disabled={dateTimeLocked} onChange={(e) => setEditFormData({...editFormData, time: e.target.value})} className="w-full text-sm p-2.5 border rounded-xl disabled:bg-slate-100 disabled:text-slate-400 disabled:cursor-not-allowed" />
                                            </div>
                                        </div>
                                        {dateTimeLocked && (
                                            <p className="mt-1 text-[10px] text-rose-500 font-semibold">Date & time are locked after payment.</p>
                                        )}
                                    </div>
                                );
                            })()}
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
            {refundChoice && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm">
                    <div className="bg-white rounded-2xl w-full max-w-sm max-h-[90vh] overflow-y-auto shadow-2xl">
                        <div className="flex justify-between items-center p-4 border-b border-slate-100">
                            <h3 className="font-bold text-slate-800 flex items-center gap-2"><XCircle size={18} className="text-red-500" /> Cancel Booking</h3>
                            <button onClick={() => setRefundChoice(null)} className="p-1 hover:bg-slate-100 rounded-full"><X size={20} className="text-slate-500" /></button>
                        </div>
                        <div className="p-4 space-y-3 text-sm">
                            {refundChoice.policies.length > 0 && (
                                <div className="rounded-xl bg-slate-50 p-3 text-xs text-slate-600">
                                    <p className="font-bold text-slate-700 mb-1">Cancellation & Refund Policy</p>
                                    {refundChoice.policies.map((p, i) => <p key={i}>{p}</p>)}
                                </div>
                            )}
                            <div className="rounded-xl bg-emerald-50 border border-emerald-200 p-3 text-xs text-emerald-800">
                                {refundChoice.preview.lines.filter(l => l.hasRules).map((l, i) => <p key={i}>• {l.name}: {l.refundPercent}%</p>)}
                                <p className="font-bold mt-1">Refund if you cancel now: ₹{refundChoice.preview.refundAmount.toLocaleString('en-IN')} (of ₹{refundChoice.preview.paid.toLocaleString('en-IN')} paid)</p>
                            </div>
                            <p className="text-xs font-semibold text-slate-600">Where do you want your refund?</p>
                            {[
                                { key: 'WALLET', title: 'Wallet', note: 'Instant credit to your wallet' },
                                { key: 'ACCOUNT', title: 'Bank / Original payment method', note: refundChoice.preview.codRefund > 0
                                    ? `₹${refundChoice.preview.onlineRefund.toLocaleString('en-IN')} in 5-7 working days · Cash (COD) part ₹${refundChoice.preview.codRefund.toLocaleString('en-IN')} goes to wallet`
                                    : '5-7 working days' },
                            ].map(opt => (
                                <label key={opt.key} className={`flex items-start gap-3 rounded-xl border p-3 cursor-pointer ${refundChoice.method === opt.key ? 'border-blue-500 bg-blue-50' : 'border-slate-200'}`}>
                                    <input
                                        type="radio"
                                        name="refundMethod"
                                        className="mt-1"
                                        checked={refundChoice.method === opt.key}
                                        onChange={() => setRefundChoice(prev => ({ ...prev, method: opt.key }))}
                                    />
                                    <span>
                                        <span className="block font-semibold text-slate-800">{opt.title}</span>
                                        <span className="block text-[11px] text-slate-500">{opt.note}</span>
                                    </span>
                                </label>
                            ))}
                            <div className="flex gap-2 pt-1">
                                <button onClick={() => setRefundChoice(null)} className="flex-1 py-2.5 rounded-xl border border-slate-200 font-semibold text-slate-600 hover:bg-slate-50">Keep Booking</button>
                                <button
                                    onClick={async () => {
                                        const { id, method } = refundChoice;
                                        setRefundChoice(null);
                                        await performCancelEvent(id, method);
                                    }}
                                    className="flex-1 py-2.5 rounded-xl bg-red-600 hover:bg-red-700 text-white font-bold"
                                >
                                    Cancel Booking
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

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
