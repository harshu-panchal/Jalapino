import React, { useState, useEffect } from 'react';
import { sellerEventApi } from '../../services/sellerEventApi';
import { HiOutlineCalendar, HiOutlinePlus } from 'react-icons/hi2';

const EventCalendar = () => {
    const [reservations, setReservations] = useState([]);
    
    useEffect(() => {
        fetchReservations();
    }, []);

    const fetchReservations = async () => {
        try {
            const data = await sellerEventApi.getReservations();
            // Filter only confirmed/active ones for calendar
            setReservations(data.filter(r => ['confirmed', 'active', 'completed'].includes(r.status)));
        } catch (error) {
            console.error("Failed to fetch reservations", error);
        }
    };

    return (
        <div className="max-w-6xl mx-auto">
            <div className="flex justify-between items-center mb-6">
                <div>
                    <h1 className="text-2xl font-bold text-slate-800">Event Calendar</h1>
                    <p className="text-sm text-slate-500 mt-1">View your confirmed events and manage availability.</p>
                </div>
                <button className="bg-slate-900 text-white px-5 py-2.5 rounded-xl font-bold flex items-center gap-2 hover:bg-slate-800 transition-colors">
                    <HiOutlinePlus className="w-5 h-5" /> Block Dates
                </button>
            </div>

            <div className="bg-white rounded-2xl border border-slate-200 p-8 shadow-sm text-center">
                <div className="w-20 h-20 bg-slate-50 rounded-full flex items-center justify-center mx-auto mb-4 border border-slate-100">
                    <HiOutlineCalendar className="w-10 h-10 text-slate-300" />
                </div>
                <h3 className="text-xl font-bold text-slate-700 mb-2">Calendar View Coming Soon</h3>
                <p className="text-slate-500 max-w-md mx-auto mb-6">
                    A full interactive calendar to visualize your bookings, holidays, and availability is being developed.
                </p>
                
                {reservations.length > 0 && (
                    <div className="text-left mt-8 max-w-2xl mx-auto">
                        <h4 className="font-bold text-slate-800 mb-4 border-b border-slate-100 pb-2">Upcoming Confirmed Events</h4>
                        <div className="space-y-3">
                            {reservations.map(res => (
                                <div key={res._id} className="flex justify-between items-center p-4 bg-slate-50 rounded-xl border border-slate-100">
                                    <div className="flex items-center gap-4">
                                        <div className="w-12 h-12 bg-green-100 text-green-700 rounded-xl flex items-center justify-center font-bold text-lg">
                                            {new Date(res.eventDate).getDate()}
                                        </div>
                                        <div>
                                            <p className="font-bold text-slate-800">{res.customerInfo?.name}</p>
                                            <p className="text-xs text-slate-500 font-medium">
                                                {new Date(res.eventDate).toLocaleDateString('en-US', { month: 'short', year: 'numeric' })} • {res.eventTime || 'TBD'}
                                            </p>
                                        </div>
                                    </div>
                                    <div className="text-right">
                                        <span className="text-[10px] bg-white border border-slate-200 text-slate-600 px-2.5 py-1 rounded-md font-bold uppercase tracking-wider">
                                            {res.guestCount} Guests
                                        </span>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

export default EventCalendar;
