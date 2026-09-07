import React, { useState, useEffect } from 'react';
import { sellerEventApi } from '../../services/sellerEventApi';
import { sellerCalendarApi } from '../../services/sellerCalendarApi';
import { HiOutlineCalendar, HiChevronLeft, HiChevronRight, HiOutlineInformationCircle } from 'react-icons/hi2';

const EventCalendar = () => {
    const [reservations, setReservations] = useState([]);
    const [blockedDates, setBlockedDates] = useState([]);
    const [currentDate, setCurrentDate] = useState(new Date());
    const [isSaving, setIsSaving] = useState(false);
    const [selectedDayBookings, setSelectedDayBookings] = useState(null); // { date, bookings[] }

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
                return ['confirmed', 'active', 'completed', 'accepted', 'pending'].includes(s);
            }));
            
            if (calData && calData.blockedDates) {
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
        if (isPast) return;

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

    const daysInMonth = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 0).getDate();
    const firstDayOfMonth = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1).getDay();
    
    const renderCalendarDays = () => {
        const days = [];
        const today = new Date();
        today.setHours(0,0,0,0);

        for (let i = 0; i < firstDayOfMonth; i++) {
            days.push(<div key={`blank-${i}`} className="bg-transparent"></div>);
        }

        for (let d = 1; d <= daysInMonth; d++) {
            const dayDate = new Date(currentDate.getFullYear(), currentDate.getMonth(), d);
            const dateStr = dayDate.toDateString();
            
            const isBlocked = blockedDates.some(bd => bd.toDateString() === dateStr);
            const dayReservations = reservations.filter(r => new Date(r.eventDate).toDateString() === dateStr);
            const isPast = dayDate < today;
            const isSelected = selectedDayBookings?.date === dateStr;

            days.push(
                <div 
                    key={`day-${d}`} 
                    onClick={() => {
                        toggleDate(dayDate);
                        if (dayReservations.length > 0) {
                            setSelectedDayBookings(isSelected ? null : { date: dateStr, bookings: dayReservations });
                        }
                    }}
                    className={`aspect-square sm:aspect-auto sm:min-h-[5rem] p-1 sm:p-2 border rounded-lg sm:rounded-xl relative cursor-pointer transition-all ${
                        isPast ? 'bg-slate-50 opacity-50 cursor-not-allowed' : 
                        isSelected ? 'bg-blue-50 border-blue-400 ring-1 ring-blue-300' :
                        isBlocked ? 'bg-red-50 border-red-200' : 
                        dayReservations.length > 0 ? 'bg-green-50 border-green-200 hover:border-green-400' :
                        'bg-white border-slate-100 hover:border-slate-300'
                    }`}
                >
                    <div className="flex flex-col h-full">
                        <div className="flex justify-between items-start">
                            <span className={`font-bold text-xs sm:text-sm leading-none ${isBlocked ? 'text-red-700' : isPast ? 'text-slate-400' : dayReservations.length > 0 ? 'text-green-700' : 'text-slate-700'}`}>{d}</span>
                            {/* Mobile: colored dot indicator. Desktop: text badge */}
                            {isBlocked && (
                                <>
                                    <span className="sm:hidden w-2 h-2 rounded-full bg-red-400 mt-0.5 shrink-0"></span>
                                    <span className="hidden sm:inline text-[9px] bg-red-200 text-red-800 px-1 py-0.5 rounded font-bold uppercase">Blocked</span>
                                </>
                            )}
                            {dayReservations.length > 0 && !isBlocked && (
                                <>
                                    <span className="sm:hidden w-2 h-2 rounded-full bg-green-400 mt-0.5 shrink-0"></span>
                                    <span className="hidden sm:inline text-[9px] bg-green-200 text-green-800 px-1.5 py-0.5 rounded-full font-bold">{dayReservations.length}</span>
                                </>
                            )}
                        </div>
                        {/* Only show booking pills on desktop */}
                        <div className="hidden sm:flex mt-1 flex-col gap-0.5">
                            {dayReservations.slice(0, 2).map(res => (
                                <div key={res._id} className="text-[9px] bg-green-100 text-green-800 px-1.5 py-0.5 rounded leading-tight font-medium truncate">
                                    {res.eventTime ? `🕐 ${res.eventTime.split(' - ')[0]}` : ''}
                                    {res.eventType ? ` · ${res.eventType}` : ''}
                                </div>
                            ))}
                            {dayReservations.length > 2 && (
                                <div className="text-[9px] text-green-600 font-bold px-1">+{dayReservations.length - 2}</div>
                            )}
                        </div>
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
                    <p className="text-sm text-slate-500 mt-1">View your bookings and block dates to prevent new ones.</p>
                </div>
                <button 
                    onClick={handleSaveBlockedDates}
                    disabled={isSaving}
                    className="bg-slate-900 text-white px-6 py-2.5 rounded-xl font-bold hover:bg-slate-800 transition-colors disabled:opacity-50"
                >
                    {isSaving ? 'Saving...' : 'Save Calendar'}
                </button>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Calendar */}
                <div className="lg:col-span-2 bg-white rounded-2xl border border-slate-200 p-6 shadow-sm">
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

                    <div className="grid grid-cols-7 gap-1 mb-2 text-center font-bold text-slate-400 text-xs tracking-wider uppercase">
                        <div>Sun</div><div>Mon</div><div>Tue</div><div>Wed</div><div>Thu</div><div>Fri</div><div>Sat</div>
                    </div>
                    
                    <div className="grid grid-cols-7 gap-1">
                        {renderCalendarDays()}
                    </div>

                    {/* Legend */}
                    <div className="flex gap-4 mt-4 pt-4 border-t border-slate-100">
                        <div className="flex items-center gap-1.5"><div className="w-3 h-3 rounded bg-green-100 border border-green-300"></div><span className="text-[10px] text-slate-500 font-medium">Has Booking</span></div>
                        <div className="flex items-center gap-1.5"><div className="w-3 h-3 rounded bg-red-100 border border-red-300"></div><span className="text-[10px] text-slate-500 font-medium">Blocked</span></div>
                        <div className="flex items-center gap-1.5"><div className="w-3 h-3 rounded bg-blue-50 border border-blue-400 ring-1 ring-blue-300"></div><span className="text-[10px] text-slate-500 font-medium">Selected</span></div>
                    </div>
                </div>

                {/* Booking detail sidebar */}
                <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm flex flex-col">
                    <h4 className="font-bold text-slate-800 mb-4 border-b border-slate-100 pb-2 flex items-center gap-2">
                        <HiOutlineInformationCircle className="w-5 h-5 text-green-600" />
                        {selectedDayBookings ? `Bookings — ${selectedDayBookings.date}` : 'Booking Details'}
                    </h4>

                    {selectedDayBookings ? (
                        <div className="space-y-3">
                            <button onClick={() => setSelectedDayBookings(null)} className="text-[10px] text-slate-400 hover:text-slate-700 font-bold flex items-center gap-1 mb-2">← Back to all</button>
                            {selectedDayBookings.bookings.map(res => (
                                <div key={res._id} className="bg-slate-50 rounded-xl p-3 border border-slate-100">
                                    <div className="flex items-center justify-between mb-2">
                                        <p className="font-bold text-slate-800 text-sm">{res.customerInfo?.name}</p>
                                        <span className={`text-[9px] px-2 py-0.5 rounded-full font-bold uppercase ${res.status === 'confirmed' ? 'bg-green-100 text-green-700' : res.status === 'pending' ? 'bg-amber-100 text-amber-700' : 'bg-slate-100 text-slate-600'}`}>
                                            {res.status}
                                        </span>
                                    </div>
                                    <div className="space-y-1">
                                        {res.eventTime && <p className="text-xs text-slate-600 font-medium">🕐 {res.eventTime}</p>}
                                        {res.guestCount && <p className="text-xs text-slate-600 font-medium">👥 {res.guestCount} Guests</p>}
                                        {res.location?.address && <p className="text-xs text-slate-500">📍 {res.location.address}</p>}
                                        {res.amount && <p className="text-xs font-bold text-green-700">₹{res.amount.toLocaleString()}</p>}
                                    </div>
                                </div>
                            ))}
                        </div>
                    ) : (
                        <>
                            <div className="flex-1 flex flex-col items-center justify-center text-center py-8">
                                <HiOutlineCalendar className="w-10 h-10 text-slate-200 mb-3" />
                                <p className="text-slate-400 text-sm font-medium">Click a date with bookings<br/>to see full details</p>
                            </div>

                            {reservations.length > 0 && (
                                <div className="mt-2 pt-4 border-t border-slate-100">
                                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-wider mb-3">All Upcoming ({reservations.length})</p>
                                    <div className="space-y-2">
                                        {reservations.slice(0, 6).map(res => (
                                            <div key={res._id} className="flex items-center gap-3 p-2 bg-slate-50 rounded-lg border border-slate-100">
                                                <div className="w-9 h-9 bg-green-100 text-green-700 rounded-lg flex items-center justify-center font-bold text-sm shrink-0">
                                                    {new Date(res.eventDate).getDate()}
                                                </div>
                                                <div className="min-w-0">
                                                    <p className="font-bold text-slate-800 text-xs truncate">{res.customerInfo?.name}</p>
                                                    <p className="text-[10px] text-slate-500 truncate">
                                                        {new Date(res.eventDate).toLocaleDateString('en-IN', { month: 'short', day: 'numeric' })}
                                                        {res.eventTime ? ` · ${res.eventTime.split(' - ')[0]}` : ''}
                                                        {res.guestCount ? ` · ${res.guestCount}g` : ''}
                                                    </p>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </>
                    )}
                </div>
            </div>
        </div>
    );
};

export default EventCalendar;
