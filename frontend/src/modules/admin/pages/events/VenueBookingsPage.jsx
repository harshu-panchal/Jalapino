import React, { useState, useEffect } from 'react';
import axiosInstance from '@core/api/axios';
import { motion, AnimatePresence } from 'framer-motion';
import { toast } from 'sonner';

const VenueBookingsPage = () => {
    const [bookings, setBookings] = useState([]);
    const [isLoading, setIsLoading] = useState(true);
    const [page, setPage] = useState(1);
    const [totalPages, setTotalPages] = useState(1);
    const [selectedBooking, setSelectedBooking] = useState(null);
    const limit = 10;

    useEffect(() => {
        fetchBookings();
    }, [page]);

    const fetchBookings = async () => {
        setIsLoading(true);
        try {
            const res = await axiosInstance.get(`/admin/event-config/venue-bookings?page=${page}&limit=${limit}`);
            const data = res.data?.result || res.data?.data;
            if (data && data.bookings) {
                setBookings(data.bookings);
                setTotalPages(data.pagination?.totalPages || 1);
            } else {
                setBookings(data || []);
            }
        } catch (error) {
            console.error('Failed to fetch venue bookings:', error);
            toast.error('Failed to load venue bookings');
        } finally {
            setIsLoading(false);
        }
    };

    const handleDelete = async (id) => {
        if (!window.confirm("Are you sure you want to delete this venue booking? All associated tickets will be deleted.")) return;
        try {
            await axiosInstance.delete(`/admin/event-config/venue-bookings/${id}`);
            toast.success("Venue booking deleted successfully");
            if (bookings.length === 1 && page > 1) {
                setPage(page - 1);
            } else {
                fetchBookings();
            }
        } catch (error) {
            console.error('Failed to delete booking:', error);
            toast.error('Failed to delete booking');
        }
    };

    return (
        <div className="p-6 bg-slate-50 min-h-screen font-sans">
            <div className="mb-6 flex justify-between items-center">
                <div>
                    <h1 className="text-2xl font-black text-slate-800">Venue & Ticket Bookings</h1>
                    <p className="text-slate-500 text-sm">Monitor venue ticket bookings and real-time check-in status</p>
                </div>
            </div>

            <div className="bg-white rounded-3xl shadow-sm border border-slate-100 overflow-hidden">
                {isLoading ? (
                    <div className="p-20 text-center flex flex-col items-center justify-center">
                        <div className="w-8 h-8 border-4 border-purple-600 border-t-transparent rounded-full animate-spin"></div>
                        <p className="text-xs font-semibold text-slate-400 mt-4">Loading venue bookings...</p>
                    </div>
                ) : bookings.length === 0 ? (
                    <div className="p-20 text-center text-slate-400 text-sm font-semibold">No venue bookings found on the platform yet.</div>
                ) : (
                    <div className="overflow-x-auto w-full" style={{ WebkitOverflowScrolling: 'touch' }}>
                        <table className="w-full min-w-[900px] text-left text-sm text-slate-600">
                            <thead className="bg-slate-50 text-slate-700 font-bold uppercase text-[10px] tracking-wider border-b border-slate-100">
                                <tr>
                                    <th className="px-6 py-4">Booking ID</th>
                                    <th className="px-6 py-4">Customer</th>
                                    <th className="px-6 py-4">Venue Details</th>
                                    <th className="px-6 py-4">Total Amount</th>
                                    <th className="px-6 py-4">Payment</th>
                                    <th className="px-6 py-4">Check-In Status</th>
                                    <th className="px-6 py-4 text-right">Actions</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                                {bookings.map(booking => {
                                    const checkedInCount = booking.tickets.filter(t => t.status === 'Checked-In').length;
                                    const totalTickets = booking.tickets.length;
                                    return (
                                        <tr key={booking._id} className="hover:bg-slate-50/50 transition-colors">
                                            <td className="px-6 py-4 font-black text-purple-600 text-xs">
                                                {booking.bookingId}
                                            </td>
                                            <td className="px-6 py-4">
                                                <div className="font-bold text-slate-800 text-xs">{booking.customer?.name}</div>
                                                <div className="text-[10px] text-slate-500">{booking.customer?.phone}</div>
                                            </td>
                                            <td className="px-6 py-4">
                                                <div className="font-semibold text-slate-700 text-xs">{booking.venueName}</div>
                                                <div className="text-[10px] text-slate-500">{booking.venueCity} (Date: {new Date(booking.bookingDate).toLocaleDateString()})</div>
                                            </td>
                                            <td className="px-6 py-4 font-black text-slate-900 text-xs">
                                                ₹{booking.totalAmount}
                                            </td>
                                            <td className="px-6 py-4">
                                                <span className={`px-2 py-0.5 rounded-full text-[9px] font-black uppercase ${
                                                    booking.paymentStatus === 'Completed' || booking.paymentStatus === 'success' || booking.paymentStatus === 'paid'
                                                        ? 'bg-emerald-50 text-emerald-700 border border-emerald-100'
                                                        : 'bg-amber-50 text-amber-700 border border-amber-100'
                                                }`}>
                                                    {booking.paymentStatus} ({booking.paymentMode})
                                                </span>
                                            </td>
                                            <td className="px-6 py-4">
                                                <div className="flex items-center gap-2">
                                                    <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                                                        checkedInCount === totalTickets 
                                                            ? 'bg-emerald-50 text-emerald-700' 
                                                            : checkedInCount > 0 
                                                                ? 'bg-purple-50 text-purple-700' 
                                                                : 'bg-slate-100 text-slate-600'
                                                    }`}>
                                                        {checkedInCount} / {totalTickets} Checked In
                                                    </span>
                                                </div>
                                            </td>
                                            <td className="px-6 py-4">
                                                <div className="flex flex-col sm:flex-row items-center justify-end gap-2">
                                                    <button 
                                                        onClick={() => setSelectedBooking(booking)}
                                                        className="w-full sm:w-auto px-3.5 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-xl text-[10px] font-black transition-all active:scale-[0.97] uppercase tracking-wider shadow-sm shadow-purple-600/10"
                                                    >
                                                        View Tickets
                                                    </button>
                                                    <button 
                                                        onClick={() => handleDelete(booking._id)}
                                                        className="w-full sm:w-auto px-3.5 py-2 bg-rose-100 hover:bg-rose-200 text-rose-600 rounded-xl text-[10px] font-black transition-all active:scale-[0.97] uppercase tracking-wider"
                                                    >
                                                        Delete
                                                    </button>
                                                </div>
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>

            {/* Pagination */}
            {!isLoading && totalPages > 1 && (
                <div className="flex justify-center items-center gap-4 mt-6">
                    <button 
                        disabled={page === 1}
                        onClick={() => setPage(page - 1)}
                        className="px-4 py-2 bg-white border border-slate-200 rounded-xl text-xs font-black text-slate-700 disabled:opacity-50 hover:bg-slate-50 transition-colors uppercase tracking-wider"
                    >
                        Previous
                    </button>
                    <span className="text-xs font-black text-slate-600">
                        Page {page} of {totalPages}
                    </span>
                    <button 
                        disabled={page === totalPages}
                        onClick={() => setPage(page + 1)}
                        className="px-4 py-2 bg-white border border-slate-200 rounded-xl text-xs font-black text-slate-700 disabled:opacity-50 hover:bg-slate-50 transition-colors uppercase tracking-wider"
                    >
                        Next
                    </button>
                </div>
            )}

            {/* Details Modal */}
            <AnimatePresence>
                {selectedBooking && (
                    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                        <motion.div 
                            initial={{ scale: 0.95, opacity: 0 }}
                            animate={{ scale: 1, opacity: 1 }}
                            exit={{ scale: 0.95, opacity: 0 }}
                            className="bg-white rounded-3xl w-full max-w-lg p-6 overflow-hidden shadow-2xl border border-slate-100"
                        >
                            <div className="flex justify-between items-center border-b border-slate-100 pb-4 mb-4">
                                <div>
                                    <h3 className="text-base font-black text-slate-800">Tickets - Booking {selectedBooking.bookingId}</h3>
                                    <p className="text-xs text-slate-400">{selectedBooking.venueName} ({selectedBooking.venueCity})</p>
                                </div>
                                <button 
                                    onClick={() => setSelectedBooking(null)}
                                    className="p-2 hover:bg-slate-100 rounded-full transition-colors font-bold text-slate-400 text-sm"
                                >
                                    ✕
                                </button>
                            </div>

                            <div className="space-y-4 max-h-[350px] overflow-y-auto pr-1">
                                {selectedBooking.tickets.map((t, index) => (
                                    <div key={t.ticketId} className="bg-slate-50 border border-slate-100 rounded-2xl p-4 flex justify-between items-center">
                                        <div className="space-y-0.5">
                                            <div className="flex items-center gap-2">
                                                <span className="text-xs font-black text-slate-800">{index + 1}. {t.memberName}</span>
                                                <span className="text-[10px] text-slate-500 font-bold bg-slate-200/60 px-1.5 py-0.5 rounded">
                                                    {t.ticketId}
                                                </span>
                                            </div>
                                            <div className="text-[10px] text-slate-400 font-bold uppercase">
                                                Age: {t.age} Yrs | Gender: {t.gender}
                                            </div>
                                            {t.scannedAt && (
                                                <div className="text-[9px] text-emerald-600 font-black">
                                                    Scanned: {new Date(t.scannedAt).toLocaleString()}
                                                </div>
                                            )}
                                        </div>
                                        <div>
                                            <span className={`px-2.5 py-1 rounded-full text-[10px] font-black uppercase ${
                                                t.status === 'Checked-In'
                                                    ? 'bg-emerald-100 text-emerald-800'
                                                    : 'bg-slate-200 text-slate-700'
                                            }`}>
                                                {t.status === 'Checked-In' ? '✅ Checked-In' : 'Confirmed'}
                                            </span>
                                        </div>
                                    </div>
                                ))}
                            </div>

                            <div className="border-t border-slate-100 pt-4 mt-6 flex justify-end">
                                <button 
                                    onClick={() => setSelectedBooking(null)}
                                    className="px-5 py-2.5 bg-slate-900 text-white font-black text-xs rounded-xl hover:bg-slate-800 transition-colors uppercase tracking-wider"
                                >
                                    Close Details
                                </button>
                            </div>
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>
        </div>
    );
};

export default VenueBookingsPage;
