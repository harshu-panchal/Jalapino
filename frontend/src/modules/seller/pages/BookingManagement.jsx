import React, { useState, useEffect } from 'react';
import Badge from '@shared/components/ui/Badge';
import Button from '@shared/components/ui/Button';
import { toast } from 'sonner';
import { sellerApi } from '../services/sellerApi';
import { HiOutlinePlus, HiOutlinePrinter, HiOutlineDocumentArrowDown, HiOutlinePhone, HiOutlineUser, HiOutlineCalendar, HiOutlineClock, HiOutlineMapPin, HiOutlineCog8Tooth, HiOutlineTrash } from 'react-icons/hi2';

const BookingManagement = () => {
  const [bookings, setBookings] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('all'); // 'all', 'booked', 'marked', 'enquiry', 'policy'
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingBooking, setEditingBooking] = useState(null);

  // Categories list (fetched dynamically)
  const [categories, setCategories] = useState([]);

  // Cancellation policies state
  const [policies, setPolicies] = useState([]);

  // Review modal state
  const [isReviewModalOpen, setIsReviewModalOpen] = useState(false);
  const [selectedBookingForReview, setSelectedBookingForReview] = useState(null);
  const [reviewRating, setReviewRating] = useState(5);
  const [reviewComment, setReviewComment] = useState('');

  // Form states
  const [customerName, setCustomerName] = useState('');
  const [address, setAddress] = useState('');
  const [mobileNumber, setMobileNumber] = useState('');
  const [bookingDate, setBookingDate] = useState('');
  const [timeSlot, setTimeSlot] = useState('2 Hours');
  const [bookingStatus, setBookingStatus] = useState('Enquiry Only');
  const [guestsCount, setGuestsCount] = useState(0);
  const [paymentEntryDate, setPaymentEntryDate] = useState('');
  const [advancePaymentAmount, setAdvancePaymentAmount] = useState(0);
  const [totalBookingAmount, setTotalBookingAmount] = useState(0);
  const [totalPaidAmount, setTotalPaidAmount] = useState(0);
  const [remarks, setRemarks] = useState('');
  const [physicalVisitRequired, setPhysicalVisitRequired] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState('');

  // Auto calculate due amount
  const dueAmount = Math.max(0, totalBookingAmount - totalPaidAmount);

  useEffect(() => {
    fetchBookings();
    fetchCategories();
    fetchPolicies();
  }, []);

  const fetchBookings = async () => {
    setIsLoading(true);
    try {
      const res = await sellerApi.getBookings();
      setBookings(res.data.result || []);
    } catch (error) {
      toast.error('Failed to load bookings');
    } finally {
      setIsLoading(false);
    }
  };

  const fetchCategories = async () => {
    try {
      const res = await sellerApi.getCategories();
      const data = res.data;
      // Handle all possible response shapes
      let cats = data?.result ?? data?.categories ?? data?.data ?? data;
      if (!Array.isArray(cats)) cats = [];
      setCategories(cats);
    } catch (error) {
      console.error('Failed to load categories');
      setCategories([]);
    }
  };

  const fetchPolicies = async () => {
    try {
      const res = await sellerApi.getCancellationPolicies();
      const data = res.data;
      let pols = data?.result ?? data?.data ?? data;
      if (!Array.isArray(pols)) pols = [];
      setPolicies(pols);
    } catch (error) {
      console.error('Failed to load policies');
      setPolicies([]);
    }
  };

  const handleOpenAddModal = () => {
    setEditingBooking(null);
    setCustomerName('');
    setAddress('');
    setMobileNumber('');
    setBookingDate('');
    setTimeSlot('2 Hours');
    setBookingStatus('Enquiry Only');
    setGuestsCount(0);
    setPaymentEntryDate('');
    setAdvancePaymentAmount(0);
    setTotalBookingAmount(0);
    setTotalPaidAmount(0);
    setRemarks('');
    setPhysicalVisitRequired(false);
    setSelectedCategory(categories[0]?._id || '');
    setIsModalOpen(true);
  };

  const handleOpenEditModal = (booking) => {
    setEditingBooking(booking);
    setCustomerName(booking.customerName || '');
    setAddress(booking.address || '');
    setMobileNumber(booking.mobileNumber || '');
    setBookingDate(booking.bookingDate ? new Date(booking.bookingDate).toISOString().split('T')[0] : '');
    setTimeSlot(booking.timeSlot || '2 Hours');
    setBookingStatus(booking.bookingStatus || 'Enquiry Only');
    setGuestsCount(booking.guestsCount || 0);
    setPaymentEntryDate(booking.paymentEntryDate ? new Date(booking.paymentEntryDate).toISOString().split('T')[0] : '');
    setAdvancePaymentAmount(booking.advanceAmountPaid || 0);
    setTotalBookingAmount(booking.totalBookingAmount || 0);
    setTotalPaidAmount(booking.totalPaidAmount || 0);
    setRemarks(booking.remarks || '');
    setPhysicalVisitRequired(booking.physicalVisitRequired || false);
    setSelectedCategory(booking.categoryId || categories[0]?._id || '');
    setIsModalOpen(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const data = {
      customerName,
      address,
      mobileNumber,
      bookingDate,
      timeSlot,
      bookingStatus,
      guestsCount: Number(guestsCount),
      paymentEntryDate: paymentEntryDate || undefined,
      advancePaymentAmount: Number(advancePaymentAmount),
      totalBookingAmount: Number(totalBookingAmount),
      totalPaidAmount: Number(totalPaidAmount),
      remarks,
      physicalVisitRequired,
      physicalVisitStatus: physicalVisitRequired ? 'Requested' : 'None',
      categoryId: selectedCategory || undefined
    };

    try {
      if (editingBooking) {
        await sellerApi.updateBookingDetails(editingBooking._id, data);
        toast.success('Booking updated successfully');
      } else {
        await sellerApi.createBooking(data);
        toast.success('Booking created successfully');
      }
      setIsModalOpen(false);
      fetchBookings();
    } catch (error) {
      toast.error(error.response?.data?.message || 'Action failed');
    }
  };

  const handleConfirmVisit = async (id) => {
    try {
      await sellerApi.confirmPhysicalVisit(id);
      toast.success('Physical visit confirmed successfully');
      fetchBookings();
    } catch (error) {
      toast.error('Failed to confirm visit');
    }
  };

  const handleCompleteVisit = async (id) => {
    try {
      await sellerApi.completePhysicalVisit(id);
      toast.success('Physical visit marked as completed');
      fetchBookings();
    } catch (error) {
      toast.error('Failed to complete visit');
    }
  };

  const handleOpenReviewModal = (booking) => {
    setSelectedBookingForReview(booking);
    setReviewRating(5);
    setReviewComment('');
    setIsReviewModalOpen(true);
  };

  const handleReviewSubmit = async (e) => {
    e.preventDefault();
    try {
      await sellerApi.submitCustomerReview(selectedBookingForReview._id, {
        rating: reviewRating,
        review: reviewComment
      });
      toast.success('Customer rated successfully');
      setIsReviewModalOpen(false);
      fetchBookings();
    } catch (error) {
      toast.error('Failed to submit review');
    }
  };

  const handleCancelBooking = async (booking) => {
    // Calculate refund preview locally before cancel
    const bookingTime = new Date(booking.bookingDate).getTime();
    const currentTime = Date.now();
    const diffHours = (bookingTime - currentTime) / (1000 * 60 * 60);

    let refundPercent = 0;
    const policy = policies.find(p => String(p.categoryId) === String(booking.categoryId));
    if (policy && policy.rules) {
      const sortedRules = [...policy.rules].sort((a, b) => b.hoursBefore - a.hoursBefore);
      const matchedRule = sortedRules.find(r => diffHours >= r.hoursBefore);
      if (matchedRule) {
        refundPercent = matchedRule.refundPercentage;
      }
    }

    const estimatedRefund = Math.max(0, Number(booking.totalPaidAmount || 0) * (refundPercent / 100));

    if (window.confirm(`Are you sure you want to cancel this booking? Estimated Refund: ₹${estimatedRefund} (${refundPercent}% based on policy).`)) {
      try {
        await sellerApi.cancelBooking(booking._id);
        toast.success('Booking cancelled successfully');
        fetchBookings();
      } catch (error) {
        toast.error('Failed to cancel booking');
      }
    }
  };

  const handleSavePolicies = async (e) => {
    e.preventDefault();
    try {
      await sellerApi.updateCancellationPolicies({ policies });
      toast.success('Cancellation policies updated successfully');
    } catch (error) {
      toast.error('Failed to save policies');
    }
  };

  const handleAddPolicyRule = (catId) => {
    setPolicies(prev => {
      const existing = prev.find(p => String(p.categoryId) === String(catId));
      if (existing) {
        return prev.map(p => {
          if (String(p.categoryId) === String(catId)) {
            return {
              ...p,
              rules: [...p.rules, { hoursBefore: 24, refundPercentage: 100 }]
            };
          }
          return p;
        });
      } else {
        return [...prev, { categoryId: catId, rules: [{ hoursBefore: 24, refundPercentage: 100 }] }];
      }
    });
  };

  const handleRemovePolicyRule = (catId, index) => {
    setPolicies(prev => prev.map(p => {
      if (String(p.categoryId) === String(catId)) {
        return {
          ...p,
          rules: p.rules.filter((_, idx) => idx !== index)
        };
      }
      return p;
    }));
  };

  const handleRuleChange = (catId, index, field, value) => {
    setPolicies(prev => prev.map(p => {
      if (String(p.categoryId) === String(catId)) {
        const newRules = p.rules.map((rule, idx) => {
          if (idx === index) {
            return { ...rule, [field]: Number(value) };
          }
          return rule;
        });
        return { ...p, rules: newRules };
      }
      return p;
    }));
  };

  const handleDelete = async (id) => {
    if (window.confirm('Are you sure you want to delete this booking?')) {
      try {
        await sellerApi.deleteBookingDetails(id);
        toast.success('Booking deleted');
        fetchBookings();
      } catch (error) {
        toast.error('Failed to delete booking');
      }
    }
  };

  const exportReport = () => {
    const headers = ['Customer Name', 'Mobile', 'Address', 'Date', 'Time Slot', 'Status', 'Physical Visit', 'Total Amount', 'Paid Amount', 'Due Amount'];
    const rows = bookings.map(b => [
      b.customerName,
      b.mobileNumber,
      b.address || '',
      new Date(b.bookingDate).toLocaleDateString(),
      b.timeSlot,
      b.bookingStatus,
      b.physicalVisitRequired ? `Required (${b.physicalVisitStatus})` : 'No',
      b.totalBookingAmount,
      b.totalPaidAmount,
      b.paymentDueAmount
    ]);

    const csvContent = "data:text/csv;charset=utf-8," 
      + [headers.join(','), ...rows.map(e => e.join(','))].join('\n');
    
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `bookings_report_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const triggerPrint = () => {
    window.print();
  };

  const filteredBookings = bookings.filter(b => {
    if (activeTab === 'all') return true;
    if (activeTab === 'booked') return b.bookingStatus === 'Booked';
    if (activeTab === 'marked') return b.bookingStatus === 'Marked';
    if (activeTab === 'enquiry') return b.bookingStatus === 'Enquiry Only';
    return true;
  });

  return (
    <div className="space-y-6 p-6 max-w-7xl mx-auto printable-area">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 non-printable">
        <div>
          <h1 className="text-3xl font-extrabold text-slate-900 tracking-tight">Booking Management</h1>
          <p className="text-sm text-slate-500 mt-1">Manage online and offline bookings, physical visits, and cancellation policies.</p>
        </div>
        <div className="flex flex-wrap gap-2.5">
          <Button onClick={handleOpenAddModal} className="bg-primary text-white flex items-center gap-2 rounded-xl py-2 px-4 shadow-sm hover:bg-primary-dark transition-all">
            <HiOutlinePlus className="h-4 w-4" />
            <span>New Booking</span>
          </Button>
          <Button onClick={exportReport} variant="outline" className="flex items-center gap-2 rounded-xl border border-slate-200">
            <HiOutlineDocumentArrowDown className="h-4 w-4" />
            <span>Export CSV</span>
          </Button>
          <Button onClick={triggerPrint} variant="outline" className="flex items-center gap-2 rounded-xl border border-slate-200">
            <HiOutlinePrinter className="h-4 w-4" />
            <span>Print Report</span>
          </Button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 border-b border-slate-100 pb-px non-printable">
        {[
          { id: 'all', label: 'All Bookings' },
          { id: 'booked', label: 'Booked (Locked)' },
          { id: 'marked', label: 'Marked' },
          { id: 'enquiry', label: 'Enquiry Follow-ups' },
          { id: 'policy', label: 'Cancellation Settings' },
        ].map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`px-4 py-2.5 text-sm font-semibold border-b-2 transition-all ${
              activeTab === tab.id
                ? 'border-primary text-primary font-bold'
                : 'border-transparent text-slate-500 hover:text-slate-700'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Bookings List / Cancellation Policies Editor */}
      {activeTab === 'policy' ? (
        <form onSubmit={handleSavePolicies} className="space-y-6 non-printable">
          <div className="bg-white rounded-xl border border-slate-100 p-6 space-y-6 shadow-sm">
            <div>
              <h3 className="text-lg font-bold text-slate-800">Setup Refund & Cancellation Policies</h3>
              <p className="text-xs text-slate-500 mt-1">Configure refund percentages based on cancellation hours before booking date category-wise.</p>
            </div>
            
            <div className="space-y-6 divide-y divide-slate-100">
              {categories.map((cat) => {
                const policy = policies.find(p => String(p.categoryId) === String(cat._id)) || { rules: [] };
                return (
                  <div key={cat._id} className="pt-6 first:pt-0">
                    <div className="flex justify-between items-center mb-3">
                      <span className="font-bold text-slate-700">{cat.name}</span>
                      <Button type="button" onClick={() => handleAddPolicyRule(cat._id)} className="py-1 px-3 text-xs bg-indigo-50 text-indigo-600 border border-indigo-100 hover:bg-indigo-100 rounded-lg">
                        + Add Rule
                      </Button>
                    </div>

                    {policy.rules.length === 0 ? (
                      <p className="text-xs text-slate-400">No policy rules configured. Default is 0% refund on cancellation.</p>
                    ) : (
                      <div className="space-y-2">
                        {policy.rules.map((rule, idx) => (
                          <div key={idx} className="flex items-center gap-4 bg-slate-50 p-2.5 rounded-xl border border-slate-100 w-full max-w-xl">
                            <span className="text-xs text-slate-500 font-medium">If cancelled before</span>
                            <input
                              type="number"
                              value={rule.hoursBefore}
                              onChange={(e) => handleRuleChange(cat._id, idx, 'hoursBefore', e.target.value)}
                              className="w-20 border rounded-lg p-1.5 text-xs text-center outline-none bg-white font-bold"
                            />
                            <span className="text-xs text-slate-500 font-medium">hours, refund</span>
                            <input
                              type="number"
                              value={rule.refundPercentage}
                              onChange={(e) => handleRuleChange(cat._id, idx, 'refundPercentage', e.target.value)}
                              className="w-16 border rounded-lg p-1.5 text-xs text-center outline-none bg-white font-bold"
                            />
                            <span className="text-xs text-slate-500 font-medium">%</span>
                            <button type="button" onClick={() => handleRemovePolicyRule(cat._id, idx)} className="text-rose-500 hover:text-rose-700 ml-auto">
                              Remove
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
            
            <div className="pt-4 border-t flex justify-end">
              <Button type="submit" className="bg-primary text-white rounded-xl py-2 px-6">
                Save Policies
              </Button>
            </div>
          </div>
        </form>
      ) : isLoading ? (
        <div className="text-center py-12 text-slate-400">Loading bookings...</div>
      ) : filteredBookings.length === 0 ? (
        <div className="bg-white rounded-xl border border-slate-100 shadow-sm">
          <div className="py-16 text-center text-slate-400 font-semibold">
            No bookings found. Click "New Booking" to add one manually.
          </div>
        </div>
      ) : (
        <div className="overflow-hidden rounded-xl border border-slate-100 bg-white shadow-sm">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-100">
                <th className="px-6 py-4 text-xs font-bold uppercase tracking-wider text-slate-500">Customer</th>
                <th className="px-6 py-4 text-xs font-bold uppercase tracking-wider text-slate-500">Date & Slot</th>
                <th className="px-6 py-4 text-xs font-bold uppercase tracking-wider text-slate-500">Status</th>
                <th className="px-6 py-4 text-xs font-bold uppercase tracking-wider text-slate-500">Physical Visit</th>
                <th className="px-6 py-4 text-xs font-bold uppercase tracking-wider text-slate-500">Payment</th>
                <th className="px-6 py-4 text-xs font-bold uppercase tracking-wider text-slate-500 text-right non-printable">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredBookings.map((b) => (
                <tr key={b._id} className="hover:bg-slate-50/50 transition-colors">
                  <td className="px-6 py-4">
                    <div className="font-bold text-slate-800 flex items-center gap-1.5">
                      <HiOutlineUser className="h-3.5 w-3.5 text-slate-400" />
                      {b.customerName}
                    </div>
                    <div className="text-xs text-slate-500 mt-0.5 flex items-center gap-1.5">
                      <HiOutlinePhone className="h-3 w-3 text-slate-400" />
                      {b.mobileNumber}
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <div className="text-sm font-semibold text-slate-700 flex items-center gap-1.5">
                      <HiOutlineCalendar className="h-3.5 w-3.5 text-slate-400" />
                      {new Date(b.bookingDate).toLocaleDateString('en-GB')}
                    </div>
                    <div className="text-xs text-slate-500 mt-0.5 flex items-center gap-1.5">
                      <HiOutlineClock className="h-3 w-3 text-slate-400" />
                      {b.timeSlot}
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <Badge variant={b.bookingStatus === 'Booked' ? 'success' : b.bookingStatus === 'Marked' ? 'warning' : b.bookingStatus === 'Cancelled' ? 'danger' : 'secondary'}>
                      {b.bookingStatus}
                    </Badge>
                    {b.bookingStatus === 'Cancelled' && (
                      <div className="text-[10px] text-rose-500 font-bold mt-1">Refund: ₹{b.refundAmount || 0}</div>
                    )}
                  </td>
                  <td className="px-6 py-4">
                    {b.physicalVisitRequired ? (
                      <div className="flex flex-col gap-1">
                        <Badge variant={b.physicalVisitStatus === 'Completed' ? 'success' : b.physicalVisitStatus === 'Confirmed' ? 'info' : 'warning'} className="w-fit">
                          {b.physicalVisitStatus}
                        </Badge>
                        {b.physicalVisitStatus === 'Requested' && (
                          <Button onClick={() => handleConfirmVisit(b._id)} className="py-0.5 px-2 text-[10px] bg-indigo-600 text-white rounded-md mt-1 w-fit">
                            Confirm Visit
                          </Button>
                        )}
                        {b.physicalVisitStatus === 'Confirmed' && (
                          <Button onClick={() => handleCompleteVisit(b._id)} className="py-0.5 px-2 text-[10px] bg-emerald-600 text-white rounded-md mt-1 w-fit">
                            Complete Visit
                          </Button>
                        )}
                        {b.physicalVisitStatus === 'Completed' && !b.customerRatingBySeller && (
                          <Button onClick={() => handleOpenReviewModal(b)} className="py-0.5 px-2 text-[10px] bg-amber-500 text-white rounded-md mt-1 w-fit">
                            Rate Customer
                          </Button>
                        )}
                        {b.customerRatingBySeller && (
                          <div className="text-[10px] text-amber-600 font-bold mt-1">
                            ⭐ {b.customerRatingBySeller}/5 Rated
                          </div>
                        )}
                      </div>
                    ) : (
                      <span className="text-xs text-slate-400">Not Required</span>
                    )}
                  </td>
                  <td className="px-6 py-4">
                    <div className="text-xs font-medium text-slate-500">
                      Paid: <span className="font-bold text-slate-700">₹{b.totalPaidAmount}</span>
                    </div>
                    <div className="text-xs font-medium text-slate-500">
                      Due: <span className="font-bold text-rose-600">₹{b.paymentDueAmount}</span>
                    </div>
                  </td>
                  <td className="px-6 py-4 text-right align-middle non-printable">
                    <div className="flex items-center justify-end gap-2">
                      {b.bookingStatus !== 'Cancelled' && (
                        <>
                          <Button onClick={() => handleOpenEditModal(b)} variant="outline" className="py-1 px-2.5 text-xs border border-slate-200">
                            Edit
                          </Button>
                          <Button onClick={() => handleCancelBooking(b)} variant="destructive" className="py-1 px-2.5 text-xs">
                            Cancel
                          </Button>
                        </>
                      )}
                      {b.type === 'offline' && b.bookingStatus === 'Cancelled' && (
                        <Button onClick={() => handleDelete(b._id)} variant="destructive" className="py-1 px-2.5 text-xs">
                          Delete
                        </Button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Manual Booking Add/Edit Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-xl max-h-[90vh] overflow-y-auto p-6 animate-in fade-in zoom-in-95 duration-150">
            <h3 className="text-xl font-bold text-slate-900 mb-4">{editingBooking ? 'Edit Booking' : 'New Booking'}</h3>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="md:col-span-2">
                  <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Customer Name</label>
                  <input
                    type="text"
                    required
                    value={customerName}
                    onChange={(e) => setCustomerName(e.target.value)}
                    className="w-full border rounded-xl p-2 text-sm outline-none focus:ring-2 focus:ring-primary/20"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Mobile Number</label>
                  <input
                    type="text"
                    required
                    value={mobileNumber}
                    onChange={(e) => setMobileNumber(e.target.value)}
                    className="w-full border rounded-xl p-2 text-sm outline-none focus:ring-2 focus:ring-primary/20"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Address</label>
                  <input
                    type="text"
                    value={address}
                    onChange={(e) => setAddress(e.target.value)}
                    className="w-full border rounded-xl p-2 text-sm outline-none focus:ring-2 focus:ring-primary/20"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Booking Date</label>
                  <input
                    type="date"
                    required
                    value={bookingDate}
                    onChange={(e) => setBookingDate(e.target.value)}
                    className="w-full border rounded-xl p-2 text-sm outline-none focus:ring-2 focus:ring-primary/20"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Time Slot</label>
                  <select
                    value={timeSlot}
                    onChange={(e) => setTimeSlot(e.target.value)}
                    className="w-full border rounded-xl p-2 text-sm outline-none focus:ring-2 focus:ring-primary/20"
                  >
                    <option value="2 Hours">2 Hours</option>
                    <option value="4 Hours">4 Hours</option>
                    <option value="24 Hours">24 Hours</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Booking Status</label>
                  <select
                    value={bookingStatus}
                    onChange={(e) => setBookingStatus(e.target.value)}
                    className="w-full border rounded-xl p-2 text-sm outline-none focus:ring-2 focus:ring-primary/20"
                  >
                    <option value="Enquiry Only">Enquiry Only</option>
                    <option value="Marked">Marked</option>
                    <option value="Booked">Booked</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Category</label>
                  <select
                    value={selectedCategory}
                    onChange={(e) => setSelectedCategory(e.target.value)}
                    className="w-full border rounded-xl p-2 text-sm outline-none focus:ring-2 focus:ring-primary/20"
                  >
                    {categories.map((cat) => (
                      <option key={cat._id} value={cat._id}>{cat.name}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Number of Guests</label>
                  <input
                    type="number"
                    value={guestsCount}
                    onChange={(e) => setGuestsCount(Number(e.target.value))}
                    className="w-full border rounded-xl p-2 text-sm outline-none focus:ring-2 focus:ring-primary/20"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Payment Entry Date</label>
                  <input
                    type="date"
                    value={paymentEntryDate}
                    onChange={(e) => setPaymentEntryDate(e.target.value)}
                    className="w-full border rounded-xl p-2 text-sm outline-none focus:ring-2 focus:ring-primary/20"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Advance Payment</label>
                  <input
                    type="number"
                    value={advancePaymentAmount}
                    onChange={(e) => setAdvancePaymentAmount(Number(e.target.value))}
                    className="w-full border rounded-xl p-2 text-sm outline-none focus:ring-2 focus:ring-primary/20"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Total Booking Amount</label>
                  <input
                    type="number"
                    value={totalBookingAmount}
                    onChange={(e) => setTotalBookingAmount(Number(e.target.value))}
                    className="w-full border rounded-xl p-2 text-sm outline-none focus:ring-2 focus:ring-primary/20"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Total Paid Amount</label>
                  <input
                    type="number"
                    value={totalPaidAmount}
                    onChange={(e) => setTotalPaidAmount(Number(e.target.value))}
                    className="w-full border rounded-xl p-2 text-sm outline-none focus:ring-2 focus:ring-primary/20"
                  />
                </div>
                <div className="md:col-span-2">
                  <div className="bg-slate-50 p-3 rounded-xl border border-slate-100 flex justify-between items-center text-sm font-semibold">
                    <span className="text-slate-500">Payment Due Amount (Auto Calculated):</span>
                    <span className="text-rose-600 font-extrabold text-lg">₹{dueAmount}</span>
                  </div>
                </div>
                <div className="md:col-span-2 flex items-center gap-2 bg-indigo-50/50 p-3.5 rounded-xl border border-indigo-100/50">
                  <input
                    type="checkbox"
                    id="physicalVisit"
                    checked={physicalVisitRequired}
                    onChange={(e) => setPhysicalVisitRequired(e.target.checked)}
                    className="h-4 w-4 rounded text-primary focus:ring-primary/20"
                  />
                  <label htmlFor="physicalVisit" className="text-sm font-semibold text-slate-700 cursor-pointer">
                    Physical Visit Required
                  </label>
                </div>
                <div className="md:col-span-2">
                  <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Remarks / Notes</label>
                  <textarea
                    value={remarks}
                    onChange={(e) => setRemarks(e.target.value)}
                    rows={2}
                    className="w-full border rounded-xl p-2 text-sm outline-none focus:ring-2 focus:ring-primary/20"
                  />
                </div>
              </div>
              <div className="flex justify-end gap-3 pt-3 border-t">
                <Button type="button" onClick={() => setIsModalOpen(false)} variant="outline" className="rounded-xl border border-slate-200">
                  Cancel
                </Button>
                <Button type="submit" className="bg-primary text-white rounded-xl">
                  {editingBooking ? 'Update Booking' : 'Save Booking'}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Seller Reviewing Customer Modal */}
      {isReviewModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-6 animate-in fade-in zoom-in-95 duration-150">
            <h3 className="text-xl font-bold text-slate-900 mb-3">Rate Customer</h3>
            <p className="text-xs text-slate-500 mb-4">Rate the customer experience for this physical visit booking.</p>
            <form onSubmit={handleReviewSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Rating</label>
                <div className="flex gap-2">
                  {[1, 2, 3, 4, 5].map((star) => (
                    <button
                      key={star}
                      type="button"
                      onClick={() => setReviewRating(star)}
                      className={`text-2xl transition-all ${star <= reviewRating ? 'text-amber-400' : 'text-slate-200'}`}
                    >
                      ★
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Review Description</label>
                <textarea
                  required
                  value={reviewComment}
                  onChange={(e) => setReviewComment(e.target.value)}
                  placeholder="Share details of physical visit check..."
                  rows={3}
                  className="w-full border rounded-xl p-2 text-sm outline-none focus:ring-2 focus:ring-primary/20"
                />
              </div>
              <div className="flex justify-end gap-3 pt-3 border-t">
                <Button type="button" onClick={() => setIsReviewModalOpen(false)} variant="outline" className="rounded-xl border border-slate-200">
                  Cancel
                </Button>
                <Button type="submit" className="bg-amber-500 text-white rounded-xl">
                  Submit Rating
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default BookingManagement;
