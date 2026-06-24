import React, { useState, useEffect } from 'react';
import { sellerEventApi } from '../../services/sellerEventApi';
import { sellerCalendarApi } from '../../services/sellerCalendarApi';
import { HiOutlineCalendar, HiOutlinePlus, HiChevronLeft, HiChevronRight } from 'react-icons/hi2';

const EventCalendar = () => {
    const [reservations, setReservations] = useState([]);
    const [blockedDates, setBlockedDates] = useState([]);
    const [currentDate, setCurrentDate] = useState(new Date());
    const [isSaving, setIsSaving] = useState(false);

    useEffect(() => {
        fetchData();
    }, []);

    const fetchData = async () => {
        try {
            const [resData, calData] = await Promise.all([
                sellerEventApi.getReservations(),
                sellerCalendarApi.getCalendarConfig()
            ]);
            
            setReservations(resData.filter(r => {
                const s = r.status?.toLowerCase() || '';
                return ['confirmed', 'active', 'completed', 'accepted'].includes(s);
            }));
            
            if (calData && calData.blockedDates) {
                // Convert string dates back to standard local midnight Date objects
                const dates = calData.blockedDates.map(d => new Date(d));
                setBlockedDates(dates);
            }
        } catch (error) {
            console.error("Failed to fetch calendar data", error);
        }
    };

    const handleSaveBlockedDates = async () => {
        setIsSaving(true);
        try {
            // Send as YYYY-MM-DD strings to avoid timezone shift issues
            const formattedDates = blockedDates.map(d => {
                const offset = d.getTimezoneOffset() * 60000;
                const localDate = new Date(d.getTime() - offset);
                return localDate.toISOString().split('T')[0];
            });
            await sellerCalendarApi.updateBlockedDates(formattedDates);
            alert("Calendar updated successfully!");
        } catch (error) {
            console.error(error);
            alert("Failed to save blocked dates.");
        } finally {
            setIsSaving(false);
        }
    };

    const toggleDate = (dayDate) => {
        const isPast = dayDate < new Date(new Date().setHours(0, 0, 0, 0));
        if (isPast) return; // cannot block past dates

        const dateStr = dayDate.toDateString();
        const exists = blockedDates.find(d => d.toDateString() === dateStr);

        if (exists) {
            setBlockedDates(blockedDates.filter(d => d.toDateString() !== dateStr));
        } else {
            setBlockedDates([...blockedDates, dayDate]);
        }
    };

    const nextMonth = () => {
        setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 1));
    };

    const prevMonth = () => {
        setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() - 1, 1));
    };

    // Calendar logic
    const daysInMonth = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 0).getDate();
    const firstDayOfMonth = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1).getDay();
    
    const renderCalendarDays = () => {
        const days = [];
        const today = new Date();
        today.setHours(0,0,0,0);

        // Blanks for first row
        for (let i = 0; i < firstDayOfMonth; i++) {
            days.push(<div key={`blank-${i}`} className="h-24 bg-transparent border border-transparent"></div>);
        }

        // Actual days
        for (let d = 1; d <= daysInMonth; d++) {
            const dayDate = new Date(currentDate.getFullYear(), currentDate.getMonth(), d);
            const dateStr = dayDate.toDateString();
            
            const isBlocked = blockedDates.some(bd => bd.toDateString() === dateStr);
            const dayReservations = reservations.filter(r => new Date(r.eventDate).toDateString() === dateStr);
            const isPast = dayDate < today;

            days.push(
                <div 
                    key={`day-${d}`} 
                    onClick={() => toggleDate(dayDate)}
                    className={`min-h-[6rem] p-2 border border-slate-100 rounded-xl relative cursor-pointer transition-all ${
                        isPast ? 'bg-slate-50 opacity-50 cursor-not-allowed' : 
                        isBlocked ? 'bg-red-50 border-red-200' : 'bg-white hover:border-slate-300 hover:shadow-sm'
                    }`}
                >
                    <div className="flex justify-between items-start">
                        <span className={`font-bold ${isBlocked ? 'text-red-700' : isPast ? 'text-slate-400' : 'text-slate-700'}`}>{d}</span>
                        {isBlocked && <span className="text-[10px] bg-red-200 text-red-800 px-1.5 py-0.5 rounded font-bold uppercase">Blocked</span>}
                    </div>
                    <div className="mt-1 space-y-1">
                        {dayReservations.map(res => (
                            <div key={res._id} className="text-[10px] bg-green-100 text-green-800 px-1.5 py-1 rounded leading-tight font-medium truncate">
                                {res.customerInfo?.name?.split(' ')[0]} - {res.guestCount}g
                            </div>
                        ))}
                    </div>
                </div>
            );
        }

        return days;
    };

    const monthNames = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

    return (
        <div className="max-w-6xl mx-auto pb-12">
            <div className="flex justify-between items-center mb-6">
                <div>
                    <h1 className="text-2xl font-bold text-slate-800">Event Calendar</h1>
                    <p className="text-sm text-slate-500 mt-1">Block dates to prevent new bookings or view existing events.</p>
                </div>
                <button 
                    onClick={handleSaveBlockedDates}
                    disabled={isSaving}
                    className="bg-slate-900 text-white px-6 py-2.5 rounded-xl font-bold hover:bg-slate-800 transition-colors disabled:opacity-50"
                >
                    {isSaving ? 'Saving...' : 'Save Calendar'}
                </button>
            </div>

            <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm mb-6">
                <div className="flex justify-between items-center mb-6">
                    <button onClick={prevMonth} className="p-2 rounded-xl hover:bg-slate-100 transition-colors">
                        <HiChevronLeft className="w-6 h-6 text-slate-600" />
                    </button>
                    <h2 className="text-xl font-bold text-slate-800">
                        {monthNames[currentDate.getMonth()]} {currentDate.getFullYear()}
                    </h2>
                    <button onClick={nextMonth} className="p-2 rounded-xl hover:bg-slate-100 transition-colors">
                        <HiChevronRight className="w-6 h-6 text-slate-600" />
                    </button>
                </div>

                <div className="grid grid-cols-7 gap-2 mb-2 text-center font-bold text-slate-400 text-xs tracking-wider uppercase">
                    <div>Sun</div><div>Mon</div><div>Tue</div><div>Wed</div><div>Thu</div><div>Fri</div><div>Sat</div>
                </div>
                
                <div className="grid grid-cols-7 gap-2">
                    {renderCalendarDays()}
                </div>
            </div>

            {reservations.length > 0 && (
                <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm">
                    <h4 className="font-bold text-slate-800 mb-4 border-b border-slate-100 pb-2">Upcoming Events List</h4>
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
    );
};

export default EventCalendar;
