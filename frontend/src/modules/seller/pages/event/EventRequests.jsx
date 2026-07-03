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
            setRequests(res.data.data || []);
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
                                        For <strong>{req.customer?.name || 'Customer'}</strong> • {req.guestCount} Guests
                                    </p>
                                </div>

                                <div className="grid grid-cols-2 gap-4 mt-4 bg-slate-50 p-4 rounded-xl">
                                    <div>
                                        <p className="text-xs text-slate-500 font-medium uppercase">Date & Time</p>
                                        <p className="text-sm font-bold text-slate-800">{new Date(req.eventDate).toLocaleDateString()} at {req.eventTime}</p>
                                    </div>
                                    <div>
                                        <p className="text-xs text-slate-500 font-medium uppercase">Overall Status</p>
                                        <p className="text-sm font-bold text-slate-800">{req.overallStatus}</p>
                                    </div>
                                </div>
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
