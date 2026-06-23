import React, { useState, useEffect } from 'react';
import axiosInstance from '@core/api/axios';
import { motion } from 'framer-motion';

const EventBookingsPage = () => {
    const [bookings, setBookings] = useState([]);
    const [isLoading, setIsLoading] = useState(true);
    const [page, setPage] = useState(1);
    const [totalPages, setTotalPages] = useState(1);
    const limit = 10;

    useEffect(() => {
        fetchBookings();
    }, [page]);

    const fetchBookings = async () => {
        setIsLoading(true);
        try {
            const res = await axiosInstance.get(`/admin/event-config/bookings?page=${page}&limit=${limit}`);
            const data = res.data?.result || res.data?.results || res.data?.data;
            if (data && data.bookings) {
                setBookings(data.bookings);
                setTotalPages(data.pagination?.totalPages || 1);
            } else {
                setBookings(data || []);
            }
        } catch (error) {
            console.error('Failed to fetch bookings:', error);
        } finally {
            setIsLoading(false);
        }
    };

    const handleDelete = async (id) => {
        if (!window.confirm("Are you sure you want to delete this booking?")) return;
        try {
            await axiosInstance.delete(`/admin/event-config/bookings/${id}`);
            if (bookings.length === 1 && page > 1) {
                setPage(page - 1);
            } else {
                fetchBookings();
            }
        } catch (error) {
            console.error('Failed to delete booking:', error);
            alert('Failed to delete booking');
        }
    };

    return (
        <div className="p-6 bg-slate-50 min-h-screen">
            <div className="mb-6">
                <h1 className="text-2xl font-bold text-slate-800">All Event Bookings</h1>
                <p className="text-slate-500">Monitor all customer event reservations</p>
            </div>

            <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
                {isLoading ? (
                    <div className="p-10 text-center text-slate-500">Loading bookings...</div>
                ) : bookings.length === 0 ? (
                    <div className="p-10 text-center text-slate-500">No bookings found on the platform yet.</div>
                ) : (
                    <table className="w-full text-left text-sm text-slate-600">
                        <thead className="bg-slate-50 text-slate-700 font-bold uppercase text-xs">
                            <tr>
                                <th className="px-6 py-4">Booking ID</th>
                                <th className="px-6 py-4">Customer</th>
                                <th className="px-6 py-4">Event Details</th>
                                <th className="px-6 py-4">Assigned Sellers</th>
                                <th className="px-6 py-4">Payment</th>
                                <th className="px-6 py-4">Status</th>
                                <th className="px-6 py-4 text-right">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                            {bookings.map(booking => (
                                <tr key={booking._id} className="hover:bg-slate-50">
                                    <td className="px-6 py-4 font-semibold text-purple-600">
                                        {booking.bookingId}
                                    </td>
                                    <td className="px-6 py-4">
                                        <div className="font-bold text-slate-800">{booking.customer?.name}</div>
                                        <div className="text-xs text-slate-500">{booking.customer?.phone}</div>
                                    </td>
                                    <td className="px-6 py-4">
                                        <div><span className="font-semibold">Type:</span> {booking.eventType}</div>
                                        <div><span className="font-semibold">Date:</span> {new Date(booking.eventDate).toLocaleDateString()}</div>
                                        <div><span className="font-semibold">Guests:</span> {booking.guestCount}</div>
                                        <div className="text-xs text-slate-500">{booking.location?.address}</div>
                                    </td>
                                    <td className="px-6 py-4">
                                        {booking.services.map((s, idx) => (
                                            <div key={idx} className="text-xs bg-slate-100 px-2 py-1 rounded mb-1">
                                                <span className="font-bold">{s.categoryName}:</span> {s.sellerName}
                                                <span className={`ml-2 px-1 rounded text-[10px] ${s.status === 'ACCEPTED' ? 'bg-green-100 text-green-700' : 'bg-yellow-100 text-yellow-700'}`}>{s.status}</span>
                                            </div>
                                        ))}
                                    </td>
                                    <td className="px-6 py-4">
                                        <div className="font-bold">₹{booking.totalAmount}</div>
                                        <div className="text-xs text-slate-500">{booking.paymentMode} ({booking.paymentStatus})</div>
                                    </td>
                                    <td className="px-6 py-4">
                                        <span className={`px-3 py-1 rounded-full text-xs font-bold ${booking.overallStatus === 'CONFIRMED' ? 'bg-green-100 text-green-700' : 'bg-slate-100 text-slate-700'}`}>
                                            {booking.overallStatus}
                                        </span>
                                    </td>
                                    <td className="px-6 py-4 text-right">
                                        <button 
                                            onClick={() => handleDelete(booking._id)}
                                            className="px-3 py-1 bg-red-50 text-red-600 rounded-lg text-xs font-bold hover:bg-red-100 transition-colors"
                                        >
                                            Delete
                                        </button>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                )}
            </div>

            {/* Pagination */}
            {!isLoading && totalPages > 1 && (
                <div className="flex justify-center items-center gap-4 mt-6">
                    <button 
                        disabled={page === 1}
                        onClick={() => setPage(page - 1)}
                        className="px-4 py-2 bg-white border border-slate-200 rounded-lg text-sm font-bold text-slate-700 disabled:opacity-50 hover:bg-slate-50 transition-colors"
                    >
                        Previous
                    </button>
                    <span className="text-sm font-semibold text-slate-600">
                        Page {page} of {totalPages}
                    </span>
                    <button 
                        disabled={page === totalPages}
                        onClick={() => setPage(page + 1)}
                        className="px-4 py-2 bg-white border border-slate-200 rounded-lg text-sm font-bold text-slate-700 disabled:opacity-50 hover:bg-slate-50 transition-colors"
                    >
                        Next
                    </button>
                </div>
            )}
        </div>
    );
};

export default EventBookingsPage;
