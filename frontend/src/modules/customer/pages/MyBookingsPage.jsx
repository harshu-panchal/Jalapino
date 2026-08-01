import React, { useState, useEffect } from 'react';
import { customerApi } from '../services/customerApi';
import { toast } from 'sonner';

const statusColors = {
  Booked: 'bg-emerald-100 text-emerald-700',
  Marked: 'bg-amber-100 text-amber-700',
  'Enquiry Only': 'bg-slate-100 text-slate-500',
  Cancelled: 'bg-rose-100 text-rose-600',
};

const visitColors = {
  None: '',
  Requested: 'bg-amber-50 text-amber-600',
  Confirmed: 'bg-blue-50 text-blue-600',
  Completed: 'bg-emerald-50 text-emerald-700',
};

const StarRating = ({ value, onChange }) => (
  <div className="flex gap-1">
    {[1, 2, 3, 4, 5].map((star) => (
      <button
        key={star}
        type="button"
        onClick={() => onChange(star)}
        className={`text-2xl transition-all ${star <= value ? 'text-amber-400' : 'text-slate-200'}`}
      >
        ★
      </button>
    ))}
  </div>
);

const MyBookingsPage = () => {
  const [bookings, setBookings] = useState([]);
  const [isLoading, setIsLoading] = useState(true);

  // Review modal state
  const [isReviewOpen, setIsReviewOpen] = useState(false);
  const [reviewBooking, setReviewBooking] = useState(null);
  const [reviewRating, setReviewRating] = useState(5);
  const [reviewText, setReviewText] = useState('');

  useEffect(() => {
    fetchBookings();
  }, []);

  const fetchBookings = async () => {
    setIsLoading(true);
    try {
      const res = await customerApi.getMyBookings();
      setBookings(res.data.result || []);
    } catch {
      toast.error('Could not load your bookings');
    } finally {
      setIsLoading(false);
    }
  };

  const handleCancelBooking = async (booking) => {
    const bookingTime = new Date(booking.bookingDate).getTime();
    const diffHours = (bookingTime - Date.now()) / (1000 * 60 * 60);

    const msg = diffHours > 0
      ? `Cancel this booking? Refund will be calculated based on seller's cancellation policy (${Math.round(diffHours)} hours remaining).`
      : 'Cancel this booking? The booking date has passed, so a refund may not be available.';

    if (!window.confirm(msg)) return;

    try {
      const res = await customerApi.cancelMyBooking(booking._id);
      const { refundAmount, refundPercent } = res.data.result || {};
      toast.success(`Booking cancelled. Refund: ₹${refundAmount || 0} (${refundPercent || 0}%)`);
      fetchBookings();
    } catch (error) {
      toast.error(error.response?.data?.message || 'Failed to cancel booking');
    }
  };

  const handleOpenReview = (booking) => {
    setReviewBooking(booking);
    setReviewRating(5);
    setReviewText('');
    setIsReviewOpen(true);
  };

  const handleReviewSubmit = async (e) => {
    e.preventDefault();
    try {
      await customerApi.submitSellerReview(reviewBooking._id, {
        rating: reviewRating,
        review: reviewText,
      });
      toast.success('Review submitted successfully!');
      setIsReviewOpen(false);
      fetchBookings();
    } catch (error) {
      toast.error(error.response?.data?.message || 'Failed to submit review');
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <div className="text-slate-400 text-sm animate-pulse">Loading your bookings...</div>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto px-4 py-8 pb-24">
      <h1 className="text-2xl font-extrabold text-slate-900 mb-1">My Bookings</h1>
      <p className="text-xs text-slate-500 mb-6">View, cancel, and rate your service bookings.</p>

      {bookings.length === 0 ? (
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm py-16 text-center">
          <div className="text-4xl mb-3">📅</div>
          <p className="text-slate-500 font-medium">No bookings found</p>
          <p className="text-xs text-slate-400 mt-1">Your booked services will appear here.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {bookings.map((b) => (
            <div key={b._id} className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
              {/* Header */}
              <div className="flex items-start justify-between px-5 pt-5 pb-3">
                <div>
                  <div className="text-base font-bold text-slate-800">{b.customerName}</div>
                  <div className="text-xs text-slate-400 mt-0.5">📞 {b.mobileNumber}</div>
                  {b.address && <div className="text-xs text-slate-400 mt-0.5">📍 {b.address}</div>}
                </div>
                <span className={`px-2.5 py-1 rounded-full text-[10px] font-bold uppercase ${statusColors[b.bookingStatus] || 'bg-slate-100 text-slate-500'}`}>
                  {b.bookingStatus}
                </span>
              </div>

              <div className="border-t border-slate-50 px-5 py-3 grid grid-cols-2 gap-3 text-xs">
                <div>
                  <div className="text-slate-400 font-medium uppercase tracking-wide text-[10px]">Booking Date</div>
                  <div className="font-bold text-slate-700 mt-0.5">{new Date(b.bookingDate).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}</div>
                </div>
                <div>
                  <div className="text-slate-400 font-medium uppercase tracking-wide text-[10px]">Time Slot</div>
                  <div className="font-bold text-slate-700 mt-0.5">⏰ {b.timeSlot}</div>
                </div>
                <div>
                  <div className="text-slate-400 font-medium uppercase tracking-wide text-[10px]">Total Amount</div>
                  <div className="font-bold text-slate-700 mt-0.5">₹{b.totalBookingAmount}</div>
                </div>
                <div>
                  <div className="text-slate-400 font-medium uppercase tracking-wide text-[10px]">Amount Due</div>
                  <div className="font-bold text-rose-500 mt-0.5">₹{b.paymentDueAmount}</div>
                </div>
              </div>

              {/* Physical Visit */}
              {b.physicalVisitRequired && (
                <div className={`mx-5 mb-3 px-3 py-2 rounded-xl text-xs font-semibold ${visitColors[b.physicalVisitStatus] || ''}`}>
                  🏠 Physical Visit: <span className="font-bold">{b.physicalVisitStatus}</span>
                </div>
              )}

              {/* Cancellation Info */}
              {b.bookingStatus === 'Cancelled' && (
                <div className="mx-5 mb-3 px-3 py-2 rounded-xl bg-rose-50 border border-rose-100 text-xs">
                  <span className="font-semibold text-rose-600">Cancelled</span>
                  {b.refundAmount > 0 && (
                    <span className="ml-2 text-rose-500">— Refund: ₹{b.refundAmount}</span>
                  )}
                  {b.cancellationDate && (
                    <span className="ml-2 text-rose-400">on {new Date(b.cancellationDate).toLocaleDateString()}</span>
                  )}
                </div>
              )}

              {/* Seller Review (submitted) */}
              {b.sellerRatingByCustomer && (
                <div className="mx-5 mb-3 px-3 py-2 rounded-xl bg-amber-50 border border-amber-100 text-xs">
                  <span className="font-semibold text-amber-600">Your Review</span>
                  <span className="ml-2">{'★'.repeat(b.sellerRatingByCustomer)}{'☆'.repeat(5 - b.sellerRatingByCustomer)}</span>
                  {b.sellerReviewByCustomer && <p className="mt-1 text-slate-600 italic">"{b.sellerReviewByCustomer}"</p>}
                </div>
              )}

              {/* Remarks */}
              {b.remarks && (
                <div className="mx-5 mb-3 px-3 py-2 rounded-xl bg-slate-50 border border-slate-100 text-xs text-slate-500 italic">
                  📝 {b.remarks}
                </div>
              )}

              {/* Actions */}
              <div className="px-5 pb-5 flex flex-wrap gap-2">
                {b.bookingStatus !== 'Cancelled' && (
                  <button
                    onClick={() => handleCancelBooking(b)}
                    className="flex-1 py-2 rounded-xl bg-rose-50 text-rose-600 text-xs font-bold border border-rose-100 hover:bg-rose-100 transition-all"
                  >
                    Cancel Booking
                  </button>
                )}
                {b.physicalVisitStatus === 'Completed' && !b.sellerRatingByCustomer && (
                  <button
                    onClick={() => handleOpenReview(b)}
                    className="flex-1 py-2 rounded-xl bg-amber-50 text-amber-600 text-xs font-bold border border-amber-100 hover:bg-amber-100 transition-all"
                  >
                    ⭐ Rate Seller
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Rate Seller Modal */}
      {isReviewOpen && reviewBooking && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-6">
            <h3 className="text-lg font-bold text-slate-900 mb-1">Rate Your Experience</h3>
            <p className="text-xs text-slate-400 mb-4">
              How was your physical visit with <strong>{reviewBooking.customerName}</strong>?
            </p>
            <form onSubmit={handleReviewSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Your Rating</label>
                <StarRating value={reviewRating} onChange={setReviewRating} />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Write a Review</label>
                <textarea
                  required
                  value={reviewText}
                  onChange={(e) => setReviewText(e.target.value)}
                  placeholder="Share your experience..."
                  rows={3}
                  className="w-full border border-slate-200 rounded-xl p-3 text-sm outline-none focus:ring-2 focus:ring-amber-200"
                />
              </div>
              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setIsReviewOpen(false)}
                  className="flex-1 py-2 rounded-xl border border-slate-200 text-slate-500 text-sm font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 py-2 rounded-xl bg-amber-500 text-white text-sm font-bold hover:bg-amber-600 transition-all"
                >
                  Submit Review
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default MyBookingsPage;
