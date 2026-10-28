import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { sellerApi } from '../../services/sellerApi';
import { toast } from 'sonner';
import { HiOutlineCheckCircle, HiOutlineXCircle, HiOutlineClock } from 'react-icons/hi2';

const EventRequests = () => {
    const [requests, setRequests] = useState([]);
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

                                {req.selectedProducts && req.selectedProducts.length > 0 && (
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
                                    <button
                                        onClick={() => handleUpdateStatus(req._id, 'ACCEPTED')}
                                        className="flex-1 md:flex-none px-6 py-3 rounded-xl bg-green-600 text-white font-bold hover:bg-green-700 flex items-center justify-center gap-2 transition-colors shadow-lg shadow-green-600/20"
                                    >
                                        <HiOutlineCheckCircle className="w-5 h-5" />
                                        Accept Request
                                    </button>
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
