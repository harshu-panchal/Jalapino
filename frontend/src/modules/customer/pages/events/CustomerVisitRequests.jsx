import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import CalendarTodayIcon from '@mui/icons-material/CalendarToday';
import AccessTimeIcon from '@mui/icons-material/AccessTime';
import LocationOnIcon from '@mui/icons-material/LocationOn';
import AssignmentIcon from '@mui/icons-material/Assignment';
import InfoIcon from '@mui/icons-material/Info';
import BusinessIcon from '@mui/icons-material/Business';
import { venueApi } from '../../services/venueApi';
import { toast } from 'sonner';

const CustomerVisitRequests = () => {
    const navigate = useNavigate();
    const [requests, setRequests] = useState([]);
    const [isLoading, setIsLoading] = useState(true);

    const fetchRequests = async () => {
        setIsLoading(true);
        try {
            const res = await venueApi.getVisitRequestsMine();
            setRequests(res.data.result || []);
        } catch (err) {
            toast.error("Failed to load visit requests");
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        fetchRequests();
    }, []);

    const handleAction = async (id, status, details = {}) => {
        try {
            await venueApi.updateVisitRequestStatus(id, { status, ...details });
            toast.success(`Request ${status.toLowerCase()} successfully`);
            fetchRequests();
        } catch (err) {
            toast.error(err.response?.data?.message || `Failed to update status`);
        }
    };

    const getStatusStyle = (status) => {
        switch (status) {
            case 'Requested': return 'bg-amber-50 text-amber-700 border-amber-200';
            case 'Accepted': return 'bg-blue-50 text-blue-700 border-blue-200';
            case 'Rescheduled': return 'bg-purple-50 text-purple-700 border-purple-200';
            case 'Confirmed': return 'bg-emerald-50 text-emerald-700 border-emerald-200';
            case 'Completed': return 'bg-slate-100 text-slate-700 border-slate-200';
            case 'Cancelled': return 'bg-rose-50 text-rose-600 border-rose-200';
            case 'Rejected': return 'bg-red-50 text-red-600 border-red-200';
            default: return 'bg-slate-50 text-slate-600 border-slate-200';
        }
    };

    return (
        <div className="min-h-screen bg-slate-50 flex flex-col font-sans">
            {/* Header */}
            <div className="sticky top-0 bg-white z-40 border-b border-slate-100 px-4 py-3 flex items-center shadow-sm">
                <button onClick={() => navigate('/profile')} className="p-2 rounded-full hover:bg-slate-100 transition-colors mr-2">
                    <ArrowBackIcon />
                </button>
                <h1 className="text-lg font-black text-slate-800">My Physical Visit Requests</h1>
            </div>

            <div className="flex-1 max-w-3xl mx-auto w-full px-4 py-6">
                {isLoading ? (
                    <div className="flex flex-col items-center justify-center py-20">
                        <div className="w-8 h-8 border-4 border-slate-900 border-t-transparent rounded-full animate-spin"></div>
                        <p className="text-sm font-semibold text-slate-500 mt-4">Loading requests...</p>
                    </div>
                ) : requests.length === 0 ? (
                    <div className="text-center py-20 bg-white rounded-3xl p-8 border border-slate-100 shadow-sm">
                        <AssignmentIcon className="text-slate-300 mb-4" sx={{ fontSize: 60 }} />
                        <h3 className="text-base font-black text-slate-800">No Visit Requests Found</h3>
                        <p className="text-xs text-slate-500 font-medium mt-1">Discover venues and request physical visits to get started.</p>
                        <button 
                            onClick={() => navigate('/plan-my-event/venues')}
                            className="mt-6 px-6 py-2.5 bg-slate-900 text-white text-xs font-black rounded-xl hover:bg-black shadow-lg"
                        >
                            Explore Venues
                        </button>
                    </div>
                ) : (
                    <div className="space-y-6">
                        {requests.map((req) => (
                            <div key={req._id} className="bg-white rounded-3xl border border-slate-100 p-5 shadow-sm space-y-4">
                                {/* Header Info */}
                                <div className="flex items-start justify-between">
                                    <div className="flex gap-3">
                                        <img 
                                            src={req.venueId?.mainImage || 'https://images.unsplash.com/photo-1519167758481-83f550bb49b3?auto=format&fit=crop&w=150&q=80'} 
                                            alt={req.venueId?.name} 
                                            className="h-12 w-12 rounded-xl object-cover"
                                        />
                                        <div>
                                            <h3 className="text-sm font-black text-slate-800">{req.venueId?.name || 'Venue'}</h3>
                                            <p className="text-xs text-slate-500 font-bold">{req.sellerId?.shopName || 'Venue Provider'}</p>
                                        </div>
                                    </div>
                                    <span className={`text-[10px] font-black uppercase px-2.5 py-1 rounded-md border ${getStatusStyle(req.status)}`}>
                                        {req.status}
                                    </span>
                                </div>

                                {/* Visit Details */}
                                <div className="grid grid-cols-2 gap-3 text-xs bg-slate-50 rounded-2xl p-3 border border-slate-100">
                                    <p className="font-semibold text-slate-600 flex items-center gap-1.5">
                                        <CalendarTodayIcon sx={{ fontSize: 14 }} className="text-slate-400" />
                                        <span>Date: {new Date(req.preferredDate).toLocaleDateString()}</span>
                                    </p>
                                    <p className="font-semibold text-slate-600 flex items-center gap-1.5">
                                        <AccessTimeIcon sx={{ fontSize: 14 }} className="text-slate-400" />
                                        <span>Slot: {req.preferredTimeSlot}</span>
                                    </p>
                                    <p className="col-span-2 font-semibold text-slate-600 flex items-start gap-1.5">
                                        <LocationOnIcon sx={{ fontSize: 14 }} className="text-slate-400 mt-0.5" />
                                        <span>Location: {req.venueId?.venueAddress || 'Address not listed'}, {req.venueId?.venueCity || 'City'}</span>
                                    </p>
                                </div>

                                {/* Rescheduled proposal handling */}
                                {req.status === 'Rescheduled' && req.rescheduledDetails?.proposedBy === 'seller' && (
                                    <div className="bg-purple-50 rounded-2xl p-4 border border-purple-100 space-y-3">
                                        <div className="flex gap-2">
                                            <InfoIcon className="text-purple-600 mt-0.5" fontSize="small" />
                                            <div>
                                                <h4 className="text-xs font-black text-purple-900">Seller Proposed a Reschedule</h4>
                                                <p className="text-[11px] text-purple-700 font-medium">The seller suggested visit on:</p>
                                            </div>
                                        </div>
                                        <div className="text-xs font-bold text-purple-900 pl-7 space-y-1">
                                            <p>New Date: {new Date(req.rescheduledDetails.date).toLocaleDateString()}</p>
                                            <p>New Slot: {req.rescheduledDetails.timeSlot}</p>
                                        </div>
                                        <div className="flex gap-2 pl-7 pt-1">
                                            <button 
                                                onClick={() => handleAction(req._id, 'Confirmed')}
                                                className="px-4 py-2 bg-purple-700 text-white text-[10px] font-black rounded-lg"
                                            >
                                                Accept Proposal
                                            </button>
                                            <button 
                                                onClick={() => handleAction(req._id, 'Cancelled')}
                                                className="px-4 py-2 bg-white border border-purple-200 text-purple-700 text-[10px] font-black rounded-lg"
                                            >
                                                Cancel Visit
                                            </button>
                                        </div>
                                    </div>
                                )}

                                {/* Visit Notes */}
                                {req.notes && (
                                    <div className="text-xs text-slate-500 font-medium pl-1">
                                        <span className="font-bold">Your Notes:</span> "{req.notes}"
                                    </div>
                                )}

                                {/* Action Buttons */}
                                {['Requested', 'Accepted', 'Rescheduled'].includes(req.status) && (
                                    <div className="flex items-center justify-end gap-2 border-t border-slate-50 pt-3">
                                        <button 
                                            onClick={() => handleAction(req._id, 'Cancelled')}
                                            className="px-4 py-2 text-slate-500 hover:text-rose-600 text-xs font-black rounded-xl transition-all"
                                        >
                                            Cancel Request
                                        </button>
                                    </div>
                                )}
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
};

export default CustomerVisitRequests;
