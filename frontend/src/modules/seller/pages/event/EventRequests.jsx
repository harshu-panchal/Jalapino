import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { sellerApi } from '../../services/sellerApi';
import { toast } from 'sonner';
import { HiOutlineCheckCircle, HiOutlineXCircle, HiOutlineClock } from 'react-icons/hi2';
import { resolveImageUrl } from '@/core/utils/imageUtils';

const EventRequests = () => {
    const [requests, setRequests] = useState([]);
    const [quoteForms, setQuoteForms] = useState({});
    const [isLoading, setIsLoading] = useState(true);

    const fetchRequests = async () => {
        try {
            const res = await sellerApi.getEventRequests();
            const list = res.data?.results || res.data?.data || res.data?.result || [];
            setRequests(Array.isArray(list) ? list : []);
        } catch (err) {
            toast.error("Failed to load event requests");
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        fetchRequests();
    }, []);

    const handleUpdateStatus = async (id, status) => {
        toast.loading(`Marking as ${status}...`, { id: 'status' });
        try {
            await sellerApi.updateEventRequestStatus(id, { status });
            toast.success(`Request ${status.toLowerCase()} successfully`, { id: 'status' });
            fetchRequests(); // refresh the list
        } catch (err) {
            toast.error(err?.response?.data?.message || "Failed to update request", { id: 'status' });
        }
    };

    const handleSendQuotation = async (req) => {
        const form = quoteForms[req._id] || {};
        try {
            await sellerApi.sendEventQuotation(req._id, { amount: form.amount, note: form.note || '' });
            toast.success('Quotation sent to this customer');
            fetchRequests();
        } catch (err) {
            toast.error(err?.response?.data?.message || 'Failed to send quotation');
        }
    };

    const formatPreferenceValue = (value) => {
        if (value === null || value === undefined || value === '') return '';
        if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') return String(value);
        if (Array.isArray(value)) return value.map(item => typeof item === 'object' ? Object.values(item).filter(Boolean).join(' · ') : String(item)).join(', ');
        return Object.entries(value).filter(([, item]) => item !== null && item !== undefined && typeof item !== 'object').map(([key, item]) => `${key}: ${item}`).join(' · ');
    };

    const getBookingProductName = (req, productId) => {
        const bookingProducts = Array.isArray(req.selectedProducts) ? req.selectedProducts : [];
        const requestedId = productId && typeof productId === 'object'
            ? (productId._id || productId.id || productId.toHexString?.())
            : productId;
        const resolvedName = req.productNamesById?.[String(requestedId)];
        if (resolvedName) return resolvedName;
        const product = bookingProducts.find(item => {
            const itemProductId = item.productId && typeof item.productId === 'object'
                ? (item.productId._id || item.productId.id)
                : item.productId;
            return String(itemProductId || item._id) === String(requestedId);
        });
        if (productId && typeof productId === 'object' && (productId.name || productId.productName)) {
            return productId.name || productId.productName;
        }
        return product?.productId?.name || product?.productName || product?.name || 'Product details unavailable';
    };

    if (isLoading) {
        return <div className="flex justify-center items-center h-64"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div></div>;
    }

    return (
        <div className="p-6 max-w-6xl mx-auto">
            <div className="mb-8">
                <h1 className="text-2xl font-bold text-slate-800">Event Requests</h1>
                <p className="text-slate-500 mt-1">Manage incoming booking requests from customers</p>
            </div>

            {requests.length === 0 ? (
                <div className="bg-white rounded-2xl p-12 text-center border border-slate-200">
                    <div className="w-16 h-16 bg-slate-50 rounded-full flex items-center justify-center mx-auto mb-4">
                        <HiOutlineClock className="w-8 h-8 text-slate-400" />
                    </div>
                    <h3 className="text-lg font-bold text-slate-800">No Pending Requests</h3>
                    <p className="text-slate-500 mt-2">You don't have any incoming event requests right now.</p>
                </div>
            ) : (
                <div className="grid gap-6">
                    {requests.map((req) => (
                        <motion.div
                            key={req._id}
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            className="bg-white rounded-2xl p-6 border border-slate-200 shadow-sm flex flex-col md:flex-row gap-6 justify-between items-start md:items-center"
                        >
                            <div className="space-y-3 flex-1">
                                <div className="flex items-center gap-3">
                                    <span className={`px-3 py-1 rounded-full text-xs font-bold ${req.myServiceStatus === 'PENDING_APPROVAL' ? 'bg-orange-100 text-orange-700' :
                                            req.myServiceStatus === 'ACCEPTED' ? 'bg-green-100 text-green-700' :
                                                'bg-red-100 text-red-700'
                                        }`}>
                                        {req.myServiceStatus.replace('_', ' ')}
                                    </span>
                                    <span className="text-sm font-medium text-slate-500">Booking ID: {req.bookingId}</span>
                                </div>

                                <div>
                                    <h3 className="text-xl font-bold text-slate-800 capitalize">{req.eventType} Event</h3>
                                    <p className="text-slate-600 mt-1">
                                        For <strong>{req.eventInfo?.primaryContactName || req.eventInfo?.name || (req.eventInfo?.bookingType === 'corporate' ? (req.eventInfo?.corporateCompanyName || req.eventInfo?.corporateContactPerson) : req.eventInfo?.coupleNames) || req.customer?.name || 'Customer'}</strong> • {req.guestCount} Guests
                                        {req.customer?.phone ? ` • 📞 ${req.customer.phone}` : ''}
                                    </p>
                                </div>

                                <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-4 bg-slate-50 p-4 rounded-xl">
                                    <div>
                                        <p className="text-xs text-slate-500 font-medium uppercase">Date & Time</p>
                                        <p className="text-sm font-bold text-slate-800">
                                            {req.eventDate ? new Date(req.eventDate).toLocaleDateString() : 'N/A'} {req.eventTime ? `at ${req.eventTime}` : ''}
                                            {req.remarks ? ` (${req.remarks})` : ''}
                                        </p>
                                    </div>
                                    <div>
                                        <p className="text-xs text-slate-500 font-medium uppercase">Total / Advance</p>
                                        <p className="text-sm font-bold text-slate-800">
                                            ₹{(req.totalAmount || 0).toLocaleString('en-IN')}
                                            {req.advancePaymentAmount > 0 ? (
                                                <span className="text-xs text-purple-600 block">
                                                    (Adv: ₹{req.advancePaymentAmount.toLocaleString('en-IN')})
                                                </span>
                                            ) : null}
                                        </p>
                                    </div>
                                    <div>
                                        <p className="text-xs text-slate-500 font-medium uppercase">Location</p>
                                        <p className="text-sm font-bold text-slate-800 truncate" title={req.location?.address || 'N/A'}>
                                            {req.location?.address || 'N/A'}
                                        </p>
                                    </div>
                                    <div>
                                        <p className="text-xs text-slate-500 font-medium uppercase">Overall Status</p>
                                        <p className="text-sm font-bold text-slate-800">{req.overallStatus}</p>
                                    </div>
                                </div>

                                {Array.isArray(req.serviceDetails?.preferences) && req.serviceDetails.preferences.length > 0 && (
                                    <div className="mt-3 p-4 rounded-xl border border-fuchsia-100 bg-fuchsia-50/50">
                                        <p className="text-[11px] font-black uppercase tracking-wider text-fuchsia-900 mb-3">Customer Customization Request</p>
                                        <div className="grid sm:grid-cols-2 gap-3">
                                            {req.serviceDetails.preferences.map((preference, index) => {
                                                const label = String(preference.fieldName || 'Request')
                                                    .replace(/([A-Z])/g, ' $1')
                                                    .replace(/^./, character => character.toUpperCase());
                                                const value = formatPreferenceValue(preference.value);
                                                const urls = Array.isArray(preference.fileUrls) ? preference.fileUrls : [];
                                                const isSelectedProducts = preference.fieldName === 'selectedProducts' && Array.isArray(preference.value);
                                                const isSelectedQuantities = preference.fieldName === 'selectedProductQuantities' && Array.isArray(preference.value);
                                                const isSelectedColors = preference.fieldName === 'selectedProductColors' && Array.isArray(preference.value);
                                                const referenceImageUrl = preference.fieldName === 'referencePhoto' && typeof preference.value === 'string'
                                                    ? resolveImageUrl(preference.value)
                                                    : '';
                                                if ((!value || (Array.isArray(preference.value) && preference.value.length === 0)) && urls.length === 0) return null;
                                                return (
                                                    <div key={`${preference.fieldName || 'request'}-${index}`} className="rounded-lg bg-white border border-fuchsia-100 p-3">
                                                        <p className="text-[10px] font-bold uppercase text-slate-500">{label}</p>
                                                        {isSelectedProducts && <ul className="text-sm text-slate-800 mt-1 space-y-1">{preference.value.map((id, productIndex) => <li key={`${id}-${productIndex}`}>{getBookingProductName(req, typeof id === 'object' ? (id.productId || id._id) : id)}</li>)}</ul>}
                                                        {isSelectedQuantities && <ul className="text-sm text-slate-800 mt-1 space-y-2">{preference.value.map((line, lineIndex) => <li key={`${line.productId || line._id || lineIndex}`}>
                                                            <span className="font-semibold">{getBookingProductName(req, line.productId || line._id)} × {line.quantity || 1}</span>
                                                            {(line.selectedVariant?.name || line.selectedVariant?.shopNo) && <span className="text-xs text-slate-500"> · {line.selectedVariant.name || `Shop ${line.selectedVariant.shopNo}`}</span>}
                                                            {Array.isArray(line.selectedAddOns) && line.selectedAddOns.length > 0 && <span className="block text-xs text-slate-600">Add-ons: {line.selectedAddOns.map(addOn => `${addOn.name}${addOn.price ? ` (₹${addOn.price})` : ''}`).join(', ')}</span>}
                                                        </li>)}</ul>}
                                                        {isSelectedColors && <ul className="text-sm text-slate-800 mt-1 space-y-1">{preference.value.map((line, lineIndex) => <li key={`${line.productId || lineIndex}`}>{line.productName || getBookingProductName(req, line.productId)}: {(line.colors || []).join(', ')}</li>)}</ul>}
                                                        {!isSelectedProducts && !isSelectedQuantities && !isSelectedColors && value && (
                                                            referenceImageUrl ? <a href={referenceImageUrl} target="_blank" rel="noreferrer" className="inline-block mt-2">
                                                                <img src={referenceImageUrl} alt="Customer reference" className="max-h-48 max-w-full rounded-lg border border-fuchsia-100 object-contain" />
                                                                <span className="block text-xs font-bold text-purple-700 mt-1">Open reference image</span>
                                                            </a> : <p className="text-sm text-slate-800 mt-1 break-words">{value}</p>
                                                        )}
                                                        {urls.map((url, urlIndex) => (
                                                            <a key={`${url}-${urlIndex}`} href={url} target="_blank" rel="noreferrer" className="block text-xs font-bold text-purple-700 hover:underline mt-1">View attachment {urlIndex + 1}</a>
                                                        ))}
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    </div>
                                )}

                                {Array.isArray(req.selectedProducts) && req.selectedProducts.length > 0 && (
                                    <div className="mt-3 p-3 bg-purple-50/60 rounded-xl border border-purple-100">
                                        <p className="text-[11px] font-black uppercase text-purple-900 tracking-wider mb-1.5">
                                            🛍️ Selected Items ({req.selectedProducts.length})
                                        </p>
                                        <div className="space-y-1">
                                            {req.selectedProducts.map((p, pIdx) => (
                                                <div key={pIdx} className="flex flex-wrap items-center justify-between text-xs text-slate-700">
                                                    <span className="font-semibold">
                                                        {p.productName || 'Product'} {p.selectedVariant?.name ? `(${p.selectedVariant.name})` : ''} × {p.quantity}
                                                    </span>
                                                    <span className="font-bold text-purple-700">
                                                        ₹{((p.price || p.unitPrice || 0) * (p.quantity || 1) + (p.selectedAddOns || []).reduce((s, a) => s + (Number(a.price) || 0), 0)).toLocaleString('en-IN')}
                                                    </span>
                                                    {p.selectedAddOns && p.selectedAddOns.length > 0 && (
                                                        <div className="w-full flex flex-wrap gap-1 mt-0.5 pl-2">
                                                            {p.selectedAddOns.map((ad, aIdx) => (
                                                                <span key={aIdx} className="text-[10px] bg-white border border-purple-200 px-1.5 py-0.2 rounded text-purple-700">
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

                                {req.serviceDetails?.quotePermissions?.sellerQuotation && (
                                    <div className="mt-4 p-4 rounded-xl border border-indigo-100 bg-indigo-50/50 space-y-3">
                                        <p className="text-xs font-black uppercase tracking-wider text-indigo-800">Seller quotation</p>
                                        {req.serviceDetails.quotation?.status !== 'NOT_SENT' && (
                                            <p className="text-sm text-slate-700">Current quote: ₹{Number(req.serviceDetails.quotation?.amount || 0).toLocaleString('en-IN')} · {req.serviceDetails.quotation?.status?.replaceAll('_', ' ')}</p>
                                        )}
                                        {req.serviceDetails.quotation?.status === 'REVISION_REQUESTED' && <p className="text-xs text-amber-700">Customer revision request: {req.serviceDetails.quotation.revisionNote || 'No note provided'}</p>}
                                        {['NOT_SENT', 'REVISION_REQUESTED'].includes(req.serviceDetails.quotation?.status || 'NOT_SENT') && (
                                            <div className="grid sm:grid-cols-[1fr_2fr_auto] gap-2">
                                                <input type="number" min="0" placeholder="Quote amount (₹)" value={quoteForms[req._id]?.amount ?? req.serviceDetails.quotation?.amount ?? ''} onChange={e => setQuoteForms(prev => ({ ...prev, [req._id]: { ...prev[req._id], amount: e.target.value } }))} className="rounded-lg border px-3 py-2 text-sm" />
                                                <input placeholder="Message / quotation details" value={quoteForms[req._id]?.note ?? (req.serviceDetails.quotation?.note || '')} onChange={e => setQuoteForms(prev => ({ ...prev, [req._id]: { ...prev[req._id], note: e.target.value } }))} className="rounded-lg border px-3 py-2 text-sm" />
                                                <button onClick={() => handleSendQuotation(req)} className="rounded-lg bg-indigo-600 text-white px-4 py-2 text-sm font-bold">{req.serviceDetails.quotation?.status === 'REVISION_REQUESTED' ? 'Send revision' : 'Send quote'}</button>
                                            </div>
                                        )}
                                    </div>
                                )}
                            </div>

                            {req.myServiceStatus === 'PENDING_APPROVAL' && (
                                <div className="flex gap-3 w-full md:w-auto">
                                    <button
                                        onClick={() => handleUpdateStatus(req._id, 'REJECTED')}
                                        className="flex-1 md:flex-none px-6 py-3 rounded-xl border border-red-200 text-red-600 font-bold hover:bg-red-50 flex items-center justify-center gap-2 transition-colors"
                                    >
                                        <HiOutlineXCircle className="w-5 h-5" />
                                        Reject
                                    </button>
                                    {(!req.serviceDetails?.quotePermissions?.sellerQuotation || req.serviceDetails?.quotation?.status === 'APPROVED') ? <button
                                        onClick={() => handleUpdateStatus(req._id, 'ACCEPTED')}
                                        className="flex-1 md:flex-none px-6 py-3 rounded-xl bg-green-600 text-white font-bold hover:bg-green-700 flex items-center justify-center gap-2 transition-colors shadow-lg shadow-green-600/20"
                                    >
                                        <HiOutlineCheckCircle className="w-5 h-5" />
                                        Accept Request
                                    </button> : <span className="text-xs text-amber-700 self-center">You can accept this request after the customer approves the quotation.</span>}
                                </div>
                            )}
                        </motion.div>
                    ))}
                </div>
            )}
        </div>
    );
};

export default EventRequests;
