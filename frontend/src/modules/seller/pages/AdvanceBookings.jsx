import React, { useState, useEffect } from 'react';
import Badge from '@shared/components/ui/Badge';
import Button from '@shared/components/ui/Button';
import { toast } from 'sonner';
import { sellerApi } from '../services/sellerApi';

const AdvanceBookings = () => {
    const [bookings, setBookings] = useState([]);
    const [isLoading, setIsLoading] = useState(true);
    const [statusFilter, setStatusFilter] = useState('all');

    useEffect(() => {
        fetchBookings();
    }, [statusFilter]);

    const fetchBookings = async () => {
        setIsLoading(true);
        try {
            const response = await sellerApi.getAdvanceBookings({ status: statusFilter });
            setBookings(response.data.result.bookings || []);
        } catch (error) {
            toast.error(error.response?.data?.message || 'Failed to fetch bookings');
        } finally {
            setIsLoading(false);
        }
    };

    const handleAccept = async (id) => {
        try {
            await sellerApi.acceptAdvanceBooking(id);
            toast.success('Booking accepted');
            fetchBookings();
        } catch (error) {
            toast.error(error.response?.data?.message || 'Failed to accept booking');
        }
    };

    const handleComplete = async (id) => {
        try {
            await sellerApi.completeDecoration(id);
            toast.success('Decoration marked as complete. Customer notified.');
            fetchBookings();
        } catch (error) {
            toast.error(error.response?.data?.message || 'Failed to complete decoration');
        }
    };

    const getStatusBadge = (status) => {
        switch (status) {
            case 'pending':
                return <Badge variant="warning">Pending</Badge>;
            case 'accepted':
                return <Badge variant="info">Accepted</Badge>;
            case 'decoration_complete':
                return <Badge variant="primary">Ready for Approval</Badge>;
            case 'customer_confirmed':
                return <Badge variant="success">Confirmed</Badge>;
            case 'completed':
                return <Badge variant="success">Completed</Badge>;
            case 'cancelled':
                return <Badge variant="destructive">Cancelled</Badge>;
            default:
                return <Badge variant="secondary">{status}</Badge>;
        }
    };

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center">
                <h2 className="text-2xl font-semibold text-slate-800">Advance Bookings</h2>
                <div className="flex items-center gap-2">
                    <select 
                        className="px-3 py-2 border rounded-md"
                        value={statusFilter}
                        onChange={(e) => setStatusFilter(e.target.value)}
                    >
                        <option value="all">All Bookings</option>
                        <option value="pending">Pending</option>
                        <option value="accepted">Accepted</option>
                        <option value="decoration_complete">Ready</option>
                        <option value="customer_confirmed">Confirmed</option>
                    </select>
                </div>
            </div>

            {isLoading ? (
                <div>Loading bookings...</div>
            ) : bookings.length === 0 ? (
                <div className="bg-white border rounded-xl p-6 shadow-sm">
                    <div className="py-10 text-center text-slate-500">
                        No advance bookings found for the selected status.
                    </div>
                </div>
            ) : (
                <div className="grid gap-4">
                    {bookings.map((booking) => (
                        <div key={booking._id} className="bg-white border rounded-xl shadow-sm">
                            <div className="p-4 flex flex-col md:flex-row md:items-center justify-between gap-4">
                                <div>
                                    <h3 className="font-medium text-slate-900 text-lg">
                                        Booking ID: {booking._id.slice(-6).toUpperCase()}
                                    </h3>
                                    <div className="text-sm text-slate-500 mt-1">
                                        Customer: {booking.customerId?.name || 'Guest'} <br />
                                        Delivery Date: {new Date(booking.deliveryDate).toLocaleDateString()}
                                    </div>
                                    <div className="mt-2 text-slate-700">
                                        Product Code: <span className="font-semibold">{booking.productCode || 'N/A'}</span>
                                    </div>
                                    <div className="mt-1 font-medium text-primary">
                                        Advance Paid: ₹{booking.advanceAmountPaid} / Total: ₹{booking.totalAmount}
                                    </div>
                                </div>
                                <div className="flex flex-col items-end gap-3">
                                    {getStatusBadge(booking.bookingStatus)}
                                    <div className="flex gap-2">
                                        {booking.bookingStatus === 'pending' && (
                                            <Button onClick={() => handleAccept(booking._id)} variant="default">
                                                Accept Booking
                                            </Button>
                                        )}
                                        {booking.bookingStatus === 'accepted' && (
                                            <Button onClick={() => handleComplete(booking._id)} variant="primary">
                                                Mark Decoration Complete
                                            </Button>
                                        )}
                                    </div>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
};

export default AdvanceBookings;
