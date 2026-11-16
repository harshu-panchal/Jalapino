import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import {
    HiOutlineClipboardDocumentList,
    HiOutlineCalendar,
    HiOutlineCurrencyDollar,
    HiOutlineClock,
    HiOutlineCheckCircle
} from 'react-icons/hi2';
import { sellerEventApi } from '../../services/sellerEventApi';
import CircularProgress from '@mui/material/CircularProgress';
import SellerModuleInfoCard from '../../components/SellerModuleInfoCard';

const EventDashboard = () => {
    const navigate = useNavigate();
    const [stats, setStats] = useState(null);
    const [isLoading, setIsLoading] = useState(true);
    // Ticket booking opened from "Manage" (tickets have no separate seller page).
    const [selectedTicket, setSelectedTicket] = useState(null);

    useEffect(() => {
        fetchStats();
    }, []);

    const fetchStats = async () => {
        try {
            const data = await sellerEventApi.getDashboardStats();
            setStats(data);
        } catch (error) {
            console.error("Failed to fetch dashboard stats", error);
        } finally {
            setIsLoading(false);
        }
    };

    if (isLoading) {
        return (
            <div className="flex items-center justify-center h-[70vh]">
                <CircularProgress sx={{ color: '#ef4444' }} />
            </div>
        );
    }

    const statCards = [
        {
            title: "Pending Requests",
            value: stats?.pendingRequests || 0,
            icon: <HiOutlineClock className="w-8 h-8 text-amber-500" />,
            bg: "bg-amber-50",
            border: "border-amber-100"
        },
        {
            title: "Upcoming Events",
            value: stats?.upcomingEvents || 0,
            icon: <HiOutlineCalendar className="w-8 h-8 text-blue-500" />,
            bg: "bg-blue-50",
            border: "border-blue-100"
        },
        {
            title: "Total Reservations",
            value: stats?.totalReservations || 0,
            icon: <HiOutlineClipboardDocumentList className="w-8 h-8 text-purple-500" />,
            bg: "bg-purple-50",
            border: "border-purple-100"
        }
    ];

    return (
        <div className="max-w-6xl mx-auto space-y-6">
            <div>
                <h1 className="text-2xl font-bold text-slate-800">Event Dashboard</h1>
                <p className="text-sm text-slate-500 mt-1">Overview of your event management business.</p>
            </div>

            <SellerModuleInfoCard />

            {/* Stats Grid */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {statCards.map((card, i) => (
                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: i * 0.1 }}
                        key={i}
                        className={`p-6 rounded-2xl border ${card.bg} ${card.border} flex items-center justify-between`}
                    >
                        <div>
                            <p className="text-sm font-bold text-slate-500 uppercase tracking-wider">{card.title}</p>
                            <p className="text-4xl font-black text-slate-800 mt-2">{card.value}</p>
                        </div>
                        <div className="p-4 bg-white rounded-xl shadow-sm">
                            {card.icon}
                        </div>
                    </motion.div>
                ))}
            </div>

            {/* Recent Requests */}
            <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden mt-8 shadow-sm">
                <div className="px-6 py-5 border-b border-slate-200 flex justify-between items-center bg-slate-50">
                    <h2 className="text-lg font-bold text-slate-800">Recent Booking Requests</h2>
                    <button
                        onClick={() => navigate('/seller/reservations')}
                        className="text-sm font-bold text-red-500 hover:text-red-600 transition-colors"
                    >
                        View All
                    </button>
                </div>

                <div className="p-0">
                    {stats?.recentRequests && stats.recentRequests.length > 0 ? (
                        <div className="divide-y divide-slate-100">
                            {stats.recentRequests.map(req => (
                                <div key={req._id} className="p-6 hover:bg-slate-50 transition-colors flex items-center justify-between group">
                                    <div>
                                        <div className="flex items-center gap-3 mb-1 flex-wrap">
                                            <h3 className="font-bold text-slate-800 text-lg">{req.customerInfo?.name || "Customer"}</h3>
                                            <span className={`text-[10px] px-2 py-0.5 rounded-md font-bold uppercase tracking-wide ${req.type === 'ticket' ? 'bg-purple-100 text-purple-700' : 'bg-blue-100 text-blue-700'}`}>
                                                {req.type === 'ticket' ? '🎟️ Ticket' : '🎉 Event'}
                                            </span>
                                            <span className={`text-xs px-2.5 py-1 rounded-full font-bold uppercase tracking-wide
                                                ${req.status === 'pending' ? 'bg-amber-100 text-amber-700' :
                                                    req.status === 'confirmed' ? 'bg-green-100 text-green-700' :
                                                        (req.status === 'rejected' || req.status === 'cancelled') ? 'bg-red-100 text-red-700' :
                                                            'bg-slate-100 text-slate-700'}`}
                                            >
                                                {req.status}
                                            </span>
                                        </div>
                                        <p className="text-sm text-slate-500 font-medium">
                                            {new Date(req.eventDate).toLocaleDateString('en-IN', { weekday: 'short', year: 'numeric', month: 'short', day: 'numeric' })}
                                            {req.type === 'ticket'
                                                ? <> • {req.guestCount} Ticket(s){req.venueName ? ` • ${req.venueName}` : ''}</>
                                                : (req.guestCount ? <> • {req.guestCount} Guests</> : null)}
                                        </p>
                                    </div>
                                    <button
                                        onClick={() => {
                                            if (req.type === 'ticket') {
                                                setSelectedTicket(req);
                                                return;
                                            }
                                            sessionStorage.setItem('openReservationId', req._id);
                                            navigate(`/seller/reservations?id=${req._id}`);
                                        }}
                                        className="px-5 py-2 bg-slate-100 text-slate-700 font-bold rounded-xl opacity-0 group-hover:opacity-100 transition-all hover:bg-slate-200"
                                    >
                                        Manage
                                    </button>
                                </div>
                            ))}
                        </div>
                    ) : (
                        <div className="p-10 text-center">
                            <HiOutlineClipboardDocumentList className="w-12 h-12 text-slate-300 mx-auto mb-3" />
                            <p className="text-slate-500 font-medium">No recent booking requests.</p>
                        </div>
                    )}
                </div>
            </div>

            {/* Ticket booking details (opened from "Manage") */}
            {selectedTicket && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm" onClick={() => setSelectedTicket(null)}>
                    <div className="bg-white rounded-2xl w-full max-w-md overflow-hidden shadow-2xl" onClick={(e) => e.stopPropagation()}>
                        <div className="flex justify-between items-center px-5 py-4 border-b border-slate-100">
                            <h3 className="font-bold text-slate-800">🎟️ Ticket Booking</h3>
                            <button onClick={() => setSelectedTicket(null)} className="text-slate-400 hover:text-slate-600 text-xl leading-none" aria-label="Close">×</button>
                        </div>
                        <div className="p-5 space-y-3 text-sm">
                            {[
                                ['Customer', selectedTicket.customerInfo?.name || 'Customer'],
                                ['Phone', selectedTicket.customerInfo?.phone || '—'],
                                ['Ticket / Venue', selectedTicket.venueName || '—'],
                                ['Date', selectedTicket.eventDate ? new Date(selectedTicket.eventDate).toLocaleDateString('en-IN', { weekday: 'short', year: 'numeric', month: 'short', day: 'numeric' }) : '—'],
                                ['Time Slot', selectedTicket.timeSlot || '—'],
                                ['Booking Type', selectedTicket.bookingType || '—'],
                                ['Tickets', selectedTicket.guestCount || 1],
                                ['Amount', `₹${Number(selectedTicket.totalAmount || 0).toLocaleString('en-IN')}`],
                                ['Payment', `${selectedTicket.paymentMethod || '—'} • ${selectedTicket.paymentStatus || '—'}`],
                                ['Status', selectedTicket.status],
                            ].map(([label, value]) => (
                                <div key={label} className="flex justify-between gap-4">
                                    <span className="text-slate-500 font-medium">{label}</span>
                                    <span className="font-bold text-slate-800 text-right capitalize">{value}</span>
                                </div>
                            ))}
                            {selectedTicket.ticketIds?.length > 0 && (
                                <div className="pt-3 border-t border-slate-100">
                                    <p className="text-slate-500 font-medium mb-1">Ticket IDs</p>
                                    <div className="flex flex-wrap gap-1.5">
                                        {selectedTicket.ticketIds.map(id => (
                                            <span key={id} className="text-[11px] font-bold bg-purple-50 text-purple-700 border border-purple-200 px-2 py-0.5 rounded">{id}</span>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default EventDashboard;
