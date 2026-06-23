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

const EventDashboard = () => {
    const navigate = useNavigate();
    const [stats, setStats] = useState(null);
    const [isLoading, setIsLoading] = useState(true);

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
                                        <div className="flex items-center gap-3 mb-1">
                                            <h3 className="font-bold text-slate-800 text-lg">{req.customerInfo?.name || "Customer"}</h3>
                                            <span className={`text-xs px-2.5 py-1 rounded-full font-bold uppercase tracking-wide
                                                ${req.status === 'pending' ? 'bg-amber-100 text-amber-700' : 
                                                  req.status === 'confirmed' ? 'bg-green-100 text-green-700' : 
                                                  req.status === 'rejected' ? 'bg-red-100 text-red-700' : 
                                                  'bg-slate-100 text-slate-700'}`}
                                            >
                                                {req.status}
                                            </span>
                                        </div>
                                        <p className="text-sm text-slate-500 font-medium">
                                            {new Date(req.eventDate).toLocaleDateString('en-IN', { weekday: 'short', year: 'numeric', month: 'short', day: 'numeric' })} • {req.guestCount} Guests
                                        </p>
                                    </div>
                                    <button 
                                        onClick={() => navigate('/seller/reservations')}
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
        </div>
    );
};

export default EventDashboard;
