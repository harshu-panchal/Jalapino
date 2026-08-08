import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import CalendarTodayIcon from '@mui/icons-material/CalendarToday';
import AccessTimeIcon from '@mui/icons-material/AccessTime';
import LocationOnIcon from '@mui/icons-material/LocationOn';
import ConfirmationNumberIcon from '@mui/icons-material/ConfirmationNumber';
import InfoIcon from '@mui/icons-material/Info';
import { generalBookingApi } from '../../services/generalBookingApi';
import { toast } from 'sonner';

const MyTickets = () => {
    const navigate = useNavigate();
    const [tickets, setTickets] = useState([]);
    const [isLoading, setIsLoading] = useState(true);
    
    // Edit States
    const [isEditModalOpen, setIsEditModalOpen] = useState(false);
    const [editingTicket, setEditingTicket] = useState(null);
    const [editForm, setEditForm] = useState({ name: '', age: '', gender: 'Male', mobileNumber: '' });

    const fetchTickets = async () => {
        setIsLoading(true);
        try {
            const res = await generalBookingApi.getMyTickets();
            setTickets(res.data.results || res.data.result || []);
        } catch (err) {
            toast.error("Failed to load tickets");
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        fetchTickets();
    }, []);

    const handleOpenEditModal = (tkt) => {
        setEditingTicket(tkt);
        setEditForm({
            name: tkt.memberName,
            age: tkt.age,
            gender: tkt.gender,
            mobileNumber: tkt.mobileNumber
        });
        setIsEditModalOpen(true);
    };

    const handleSaveEdit = async (e) => {
        e.preventDefault();
        if (!editForm.name || !editForm.age || !editForm.mobileNumber) {
            toast.error("Please fill all fields.");
            return;
        }
        if (editForm.mobileNumber.length !== 10) {
            toast.error("Mobile number must be exactly 10 digits.");
            return;
        }
        try {
            await generalBookingApi.updateTicketDetails(editingTicket._id, editForm);
            toast.success("Ticket details updated successfully!");
            setIsEditModalOpen(false);
            fetchTickets();
        } catch (err) {
            toast.error("Failed to update ticket");
        }
    };

    const handleCancelTicket = async (id) => {
        if (window.confirm("Are you sure you want to cancel this ticket? It will be invalidated immediately.")) {
            try {
                await generalBookingApi.cancelTicket(id);
                toast.success("Ticket cancelled successfully!");
                fetchTickets();
            } catch (err) {
                toast.error("Failed to cancel ticket");
            }
        }
    };

    const getStatusStyle = (status) => {
        switch (status) {
            case 'Pending': return 'bg-amber-50 text-amber-700 border-amber-200';
            case 'Confirmed': return 'bg-purple-50 text-purple-700 border-purple-200';
            case 'Checked-In': return 'bg-emerald-50 text-emerald-700 border-emerald-200';
            case 'Completed': return 'bg-slate-100 text-slate-700 border-slate-200';
            case 'Cancelled': return 'bg-rose-50 text-rose-600 border-rose-200';
            default: return 'bg-slate-50 text-slate-600 border-slate-200';
        }
    };

    return (
        <div className="min-h-screen bg-slate-50 flex flex-col font-sans">
            {/* Header */}
            <div className="sticky top-0 bg-white z-40 border-b border-slate-100 px-4 py-3 flex items-center shadow-sm">
                <button onClick={() => navigate('/profile', { replace: true })} className="p-2 rounded-full hover:bg-slate-100 transition-colors mr-2">
                    <ArrowBackIcon />
                </button>
                <h1 className="text-lg font-black text-slate-800">My Booking Tickets</h1>
            </div>

            <div className="flex-1 max-w-2xl mx-auto w-full px-4 py-6">
                {isLoading ? (
                    <div className="flex flex-col items-center justify-center py-20">
                        <div className="w-8 h-8 border-4 border-slate-900 border-t-transparent rounded-full animate-spin"></div>
                        <p className="text-sm font-semibold text-slate-500 mt-4">Loading your tickets...</p>
                    </div>
                ) : tickets.length === 0 ? (
                    <div className="text-center py-20 bg-white rounded-3xl p-8 border border-slate-100 shadow-sm">
                        <ConfirmationNumberIcon className="text-slate-300 mb-4" sx={{ fontSize: 60 }} />
                        <h3 className="text-base font-black text-slate-800">No Tickets Found</h3>
                        <p className="text-xs text-slate-500 font-medium mt-1">Book an event or venue ticket to see them here.</p>
                        <button 
                            onClick={() => navigate('/plan-my-event/venues')}
                            className="mt-6 px-6 py-2.5 bg-slate-900 text-white text-xs font-black rounded-xl hover:bg-black shadow-lg"
                        >
                            Find Venues
                        </button>
                    </div>
                ) : (
                    <div className="space-y-6">
                        {tickets.map((ticket) => (
                            <div key={ticket._id} className="bg-white rounded-3xl border border-slate-100 overflow-hidden shadow-sm flex flex-col md:flex-row">
                                {/* Ticket Info */}
                                <div className="p-6 flex-1 space-y-4">
                                    <div className="flex items-start justify-between">
                                        <div>
                                            <span className={`text-[9px] font-black uppercase px-2 py-0.5 rounded-md border ${getStatusStyle(ticket.status)}`}>
                                                {ticket.status}
                                            </span>
                                            <h3 className="text-base font-black text-slate-900 mt-2">{ticket.venueId?.name || 'Event Booking'}</h3>
                                            <p className="text-xs text-slate-500 font-bold">{ticket.sellerId?.shopName || 'Provider'}</p>
                                        </div>
                                    </div>

                                    {/* Member and slot details */}
                                    <div className="grid grid-cols-2 gap-3 text-xs bg-slate-50 rounded-2xl p-4 border border-slate-100">
                                        <p className="font-semibold text-slate-600">
                                            <span className="text-[10px] text-slate-400 block uppercase font-bold">Ticket ID</span>
                                            <span className="font-bold text-slate-800">{ticket.ticketId}</span>
                                        </p>
                                        <p className="font-semibold text-slate-600">
                                            <span className="text-[10px] text-slate-400 block uppercase font-bold">Member Name</span>
                                            <span className="font-bold text-slate-800">{ticket.memberName} ({ticket.age} Yrs - {ticket.gender})</span>
                                        </p>
                                        <p className="font-semibold text-slate-600">
                                            <span className="text-[10px] text-slate-400 block uppercase font-bold">Date</span>
                                            <span className="font-bold text-slate-800 flex items-center gap-1 mt-0.5">
                                                <CalendarTodayIcon sx={{ fontSize: 13 }} className="text-slate-400" />
                                                {new Date(ticket.createdAt).toLocaleDateString()}
                                            </span>
                                        </p>
                                        <p className="font-semibold text-slate-600">
                                            <span className="text-[10px] text-slate-400 block uppercase font-bold">Time Slot</span>
                                            <span className="font-bold text-slate-800 flex items-center gap-1 mt-0.5">
                                                <AccessTimeIcon sx={{ fontSize: 13 }} className="text-slate-400" />
                                                {ticket.bookingId?.timeSlot || 'Slot'}
                                            </span>
                                        </p>
                                        <p className="col-span-2 font-semibold text-slate-600">
                                            <span className="text-[10px] text-slate-400 block uppercase font-bold">Location</span>
                                            <span className="font-bold text-slate-800 flex items-start gap-1 mt-0.5">
                                                <LocationOnIcon sx={{ fontSize: 13 }} className="text-slate-400 mt-0.5" />
                                                {ticket.venueId?.venueAddress || 'Address not listed'}, {ticket.venueId?.venueCity}
                                            </span>
                                        </p>
                                    </div>
                                    
                                    {['Confirmed', 'Pending'].includes(ticket.status) && (
                                        <div className="flex gap-3 pt-2">
                                            <button 
                                                onClick={() => handleOpenEditModal(ticket)}
                                                className="px-4 py-2 border border-purple-200 text-purple-600 text-[10px] font-black rounded-xl hover:bg-purple-50 transition-colors uppercase tracking-wider"
                                            >
                                                Edit Details
                                            </button>
                                            <button 
                                                onClick={() => handleCancelTicket(ticket._id)}
                                                className="px-4 py-2 border border-rose-100 text-rose-500 text-[10px] font-black rounded-xl hover:bg-rose-50 transition-colors uppercase tracking-wider"
                                            >
                                                Cancel Ticket
                                            </button>
                                        </div>
                                    )}
                                </div>

                                {/* QR Code Display Section */}
                                <div className="p-6 bg-slate-50 border-t md:border-t-0 md:border-l border-slate-100 flex flex-col items-center justify-center min-w-[200px] shrink-0">
                                    {['Confirmed', 'Pending'].includes(ticket.status) ? (
                                        <>
                                            <div 
                                                className="bg-white p-3 rounded-2xl shadow-sm border border-slate-100 cursor-pointer hover:scale-105 transition-transform"
                                                title="Click to copy QR token for testing scanner"
                                                onClick={() => {
                                                    navigator.clipboard.writeText(ticket.secureQrToken);
                                                    toast.success("QR token copied to clipboard! Paste it in the seller scanner.");
                                                }}
                                            >
                                                <img 
                                                    src={`https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=${ticket.secureQrToken}`} 
                                                    alt="Ticket QR Code" 
                                                    className="w-32 h-32"
                                                />
                                            </div>
                                            <p className="text-[10px] text-slate-400 font-bold uppercase mt-3 tracking-wider">Click to copy QR Token</p>
                                        </>
                                    ) : ticket.status === 'Checked-In' ? (
                                        <div className="text-center py-6">
                                            <span className="text-3xl">✅</span>
                                            <p className="text-xs font-black text-emerald-600 uppercase mt-2">Scanned & checked-In</p>
                                            <p className="text-[10px] text-slate-400 font-medium mt-1">Scanned at: {ticket.scannedAt ? new Date(ticket.scannedAt).toLocaleTimeString() : 'N/A'}</p>
                                        </div>
                                    ) : (
                                        <div className="text-center py-6">
                                            <span className="text-3xl">🚫</span>
                                            <p className="text-xs font-black text-rose-500 uppercase mt-2">Ticket Inactive</p>
                                            <p className="text-[10px] text-slate-400 font-medium mt-1">Status: {ticket.status}</p>
                                        </div>
                                    )}
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>

            {/* Edit Ticket Modal */}
            <AnimatePresence>
                {isEditModalOpen && (
                    <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                        <motion.div 
                            initial={{ scale: 0.95, opacity: 0 }}
                            animate={{ scale: 1, opacity: 1 }}
                            exit={{ scale: 0.95, opacity: 0 }}
                            className="bg-white rounded-3xl w-full max-w-sm overflow-hidden shadow-2xl flex flex-col"
                        >
                            <div className="p-6 border-b border-slate-100 flex items-center justify-between">
                                <h3 className="text-base font-black text-slate-800">Edit Member Details</h3>
                                <button onClick={() => setIsEditModalOpen(false)} className="p-1 rounded-full hover:bg-slate-100 text-slate-500 font-bold">✕</button>
                            </div>
                            
                            <form onSubmit={handleSaveEdit} className="p-6 space-y-4">
                                <div>
                                    <label className="block text-xs font-black uppercase text-slate-500 mb-1.5">Member Name</label>
                                    <input 
                                        type="text"
                                        required
                                        value={editForm.name}
                                        onChange={e => setEditForm({ ...editForm, name: e.target.value })}
                                        className="w-full border border-slate-200 rounded-xl p-2.5 text-xs outline-none focus:ring-2 focus:ring-purple-600"
                                    />
                                </div>
                                <div className="grid grid-cols-2 gap-3">
                                    <div>
                                        <label className="block text-xs font-black uppercase text-slate-500 mb-1.5">Age</label>
                                        <input 
                                            type="number"
                                            required
                                            min="5"
                                            value={editForm.age}
                                            onChange={e => setEditForm({ ...editForm, age: e.target.value })}
                                            className="w-full border border-slate-200 rounded-xl p-2.5 text-xs outline-none focus:ring-2 focus:ring-purple-600"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-xs font-black uppercase text-slate-500 mb-1.5">Gender</label>
                                        <select 
                                            value={editForm.gender}
                                            onChange={e => setEditForm({ ...editForm, gender: e.target.value })}
                                            className="w-full border border-slate-200 rounded-xl p-2.5 text-xs outline-none focus:ring-2 focus:ring-purple-600 bg-white"
                                        >
                                            <option value="Male">Male</option>
                                            <option value="Female">Female</option>
                                            <option value="Other">Other</option>
                                        </select>
                                    </div>
                                </div>
                                <div>
                                    <label className="block text-xs font-black uppercase text-slate-500 mb-1.5">Mobile Number</label>
                                    <input 
                                        type="tel"
                                        required
                                        value={editForm.mobileNumber}
                                        onChange={e => setEditForm({ ...editForm, mobileNumber: e.target.value.replace(/\D/g, '').slice(0, 10) })}
                                        className="w-full border border-slate-200 rounded-xl p-2.5 text-xs outline-none focus:ring-2 focus:ring-purple-600"
                                    />
                                </div>
                                <div className="pt-4 border-t border-slate-100 flex items-center justify-between gap-3">
                                    <button 
                                        type="button" 
                                        onClick={() => setIsEditModalOpen(false)}
                                        className="flex-1 py-3 border border-slate-200 text-slate-700 text-xs font-black rounded-2xl hover:bg-slate-50"
                                    >
                                        Cancel
                                    </button>
                                    <button 
                                        type="submit"
                                        className="flex-1 py-3 bg-purple-600 text-white text-xs font-black rounded-2xl hover:bg-purple-700"
                                    >
                                        Save Changes
                                    </button>
                                </div>
                            </form>
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>
        </div>
    );
};

export default MyTickets;
