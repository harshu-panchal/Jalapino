import React, { useState, useEffect } from "react";
import { Edit2, Eye, CheckCircle } from "lucide-react";
import Button from "@shared/components/ui/Button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import Badge from "@shared/components/ui/Badge";
import { adminCateringApi } from "../../services/api/cateringApi";

export default function CateringBookings() {
  const [bookings, setBookings] = useState([]);
  const [loading, setLoading] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedBooking, setSelectedBooking] = useState(null);
  const [showSuccess, setShowSuccess] = useState(false);
  
  // Filters
  const [statusFilter, setStatusFilter] = useState("All");
  const [search, setSearch] = useState("");

  const [updateData, setUpdateData] = useState({
    status: "",
    paidAmount: 0,
    paymentMode: "COD"
  });

  const fetchBookings = async () => {
    try {
      setLoading(true);
      const res = await adminCateringApi.getCateringBookings({ status: statusFilter, search });
      setBookings(res.data.results?.items || res.data.result?.items || res.data?.items || []);
    } catch (err) {
      console.error("Failed to fetch Bookings", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchBookings();
  }, [statusFilter, search]);

  const handleOpenModal = (booking) => {
    setSelectedBooking(booking);
    setUpdateData({
      status: booking.status,
      paidAmount: 0, // Additional payment
      paymentMode: "COD"
    });
    setIsModalOpen(true);
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
    setSelectedBooking(null);
  };

  const triggerSuccessAnimation = () => {
    setShowSuccess(true);
    setTimeout(() => {
      setShowSuccess(false);
    }, 2500);
  };

  const handleStatusUpdate = async () => {
    try {
      await adminCateringApi.updateCateringBookingStatus(selectedBooking._id, { status: updateData.status });
      fetchBookings();
      handleCloseModal();
    } catch (err) {
      alert("Failed to update status");
    }
  };

  const handlePaymentUpdate = async () => {
    try {
      if (updateData.paymentMode === "COD") {
        await adminCateringApi.updateCateringPaymentStatus(selectedBooking._id, { paidAmount: updateData.paidAmount });
        fetchBookings();
        handleCloseModal();
        triggerSuccessAnimation();
      } else if (updateData.paymentMode === "Razorpay") {
        // Razorpay Flow
        const orderRes = await adminCateringApi.createRazorpayOrder({
          amount: updateData.paidAmount,
          bookingId: selectedBooking._id
        });

        const options = {
          key: "rzp_test_S3IcSS1NbymL6D", 
          amount: orderRes.data.result.amount,
          currency: "INR",
          name: "Jalapino Catering",
          description: `Payment for ${selectedBooking.bookingId}`,
          order_id: orderRes.data.result.id,
          handler: async function (response) {
            try {
              await adminCateringApi.verifyRazorpayPayment({
                ...response,
                amount: updateData.paidAmount,
                bookingId: selectedBooking._id
              });
              fetchBookings();
              handleCloseModal();
              triggerSuccessAnimation();
            } catch (err) {
              alert("Payment verification failed");
            }
          },
          prefill: {
            name: selectedBooking.customerName,
            contact: selectedBooking.mobileNumber
          },
          theme: {
            color: "#f59e0b"
          }
        };

        const rzp = new window.Razorpay(options);
        rzp.on('payment.failed', function (response){
          alert("Payment failed: " + response.error.description);
        });
        rzp.open();
      }
    } catch (err) {
      alert("Failed to initiate payment");
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold tracking-tight text-slate-900">Catering Bookings</h1>
      </div>

      <div className="flex gap-4 items-center mb-4">
        <input 
          type="text" 
          placeholder="Search by ID, Name or Mobile..." 
          className="border rounded-md px-3 py-2 w-64"
          value={search}
          onChange={e => setSearch(e.target.value)}
        />
        <select 
          className="border rounded-md px-3 py-2"
          value={statusFilter}
          onChange={e => setStatusFilter(e.target.value)}
        >
          <option value="All">All Statuses</option>
          <option value="Pending">Pending</option>
          <option value="Confirmed">Confirmed</option>
          <option value="In Progress">In Progress</option>
          <option value="Completed">Completed</option>
          <option value="Cancelled">Cancelled</option>
        </select>
      </div>

      <Card>
        <CardContent className="p-0">
          <table className="w-full text-sm text-left">
            <thead className="bg-slate-50 border-b border-slate-200">
              <tr>
                <th className="px-6 py-3 font-semibold text-slate-600">Booking ID</th>
                <th className="px-6 py-3 font-semibold text-slate-600">Customer</th>
                <th className="px-6 py-3 font-semibold text-slate-600">Event Date</th>
                <th className="px-6 py-3 font-semibold text-slate-600">Amount</th>
                <th className="px-6 py-3 font-semibold text-slate-600">Status</th>
                <th className="px-6 py-3 font-semibold text-slate-600">Payment</th>
                <th className="px-6 py-3 text-right font-semibold text-slate-600">Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan="7" className="px-6 py-4 text-center">Loading...</td>
                </tr>
              ) : bookings.length === 0 ? (
                <tr>
                  <td colSpan="7" className="px-6 py-4 text-center text-slate-500">No Bookings found</td>
                </tr>
              ) : (
                bookings.map((booking) => (
                  <tr key={booking._id} className="border-b border-slate-100 last:border-0 hover:bg-slate-50">
                    <td className="px-6 py-4 font-bold">{booking.bookingId}</td>
                    <td className="px-6 py-4">
                      <div>{booking.customerName}</div>
                      <div className="text-xs text-slate-500">{booking.mobileNumber}</div>
                    </td>
                    <td className="px-6 py-4">{new Date(booking.eventDate).toLocaleDateString()}</td>
                    <td className="px-6 py-4">₹{booking.packageAmount}</td>
                    <td className="px-6 py-4">
                      <Badge variant={booking.status === 'Confirmed' ? 'primary' : booking.status === 'Completed' ? 'success' : 'default'}>
                        {booking.status}
                      </Badge>
                    </td>
                    <td className="px-6 py-4">
                      <Badge variant={booking.paymentStatus === 'Paid' ? 'success' : booking.paymentStatus === 'Partial' ? 'warning' : 'default'}>
                        {booking.paymentStatus}
                      </Badge>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <Button variant="ghost" size="sm" onClick={() => handleOpenModal(booking)}>
                        <Eye className="h-4 w-4 text-blue-600" />
                      </Button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </CardContent>
      </Card>

      {isModalOpen && selectedBooking && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <Card className="w-full max-w-lg shadow-xl">
            <CardHeader>
              <CardTitle>Booking Details - {selectedBooking.bookingId}</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4 text-sm bg-slate-50 p-4 rounded-lg">
                  <div>
                    <p className="text-slate-500 text-xs">Customer</p>
                    <p className="font-bold">{selectedBooking.customerName}</p>
                    <p>{selectedBooking.mobileNumber}</p>
                  </div>
                  <div>
                    <p className="text-slate-500 text-xs">Event Date</p>
                    <p className="font-bold">{new Date(selectedBooking.eventDate).toLocaleDateString()} {selectedBooking.eventTime}</p>
                    <p>{selectedBooking.numberOfGuests} Guests</p>
                  </div>
                  <div className="col-span-2">
                    <p className="text-slate-500 text-xs">Address</p>
                    <p>{selectedBooking.eventAddress}</p>
                  </div>
                  <div className="col-span-2">
                    <p className="text-slate-500 text-xs">Service / Package</p>
                    <p>{selectedBooking.serviceId?.name || selectedBooking.packageId?.name || "N/A"}</p>
                  </div>
                </div>

                <div className="border-t pt-4">
                  <h4 className="font-bold mb-2">Update Status</h4>
                  <div className="flex flex-col sm:flex-row gap-2">
                    <select 
                      className="border rounded-md px-3 py-2 flex-1"
                      value={updateData.status}
                      onChange={e => setUpdateData({...updateData, status: e.target.value})}
                    >
                      <option value="Pending">Pending</option>
                      <option value="Confirmed">Confirmed</option>
                      <option value="In Progress">In Progress</option>
                      <option value="Completed">Completed</option>
                      <option value="Cancelled">Cancelled</option>
                    </select>
                    <Button onClick={handleStatusUpdate}>Update Status</Button>
                  </div>
                </div>

                <div className="border-t pt-4">
                  <h4 className="font-bold mb-2">Payment Info</h4>
                  <div className="flex justify-between text-sm mb-2">
                    <span>Total Amount: ₹{selectedBooking.packageAmount}</span>
                    <span>Paid Amount: ₹{selectedBooking.paidAmount}</span>
                    <span className="text-rose-600 font-bold">Pending: ₹{selectedBooking.pendingAmount}</span>
                  </div>
                  <div className="flex flex-col sm:flex-row gap-2">
                    <select 
                      className="border rounded-md px-3 py-2 flex-1"
                      value={updateData.paymentMode}
                      onChange={e => setUpdateData({...updateData, paymentMode: e.target.value})}
                    >
                      <option value="COD">COD (Offline / Cash)</option>
                      <option value="Razorpay">Razorpay (Online)</option>
                    </select>
                    <input 
                      type="number" 
                      placeholder="Add Payment Amount"
                      className="border rounded-md px-3 py-2 flex-1"
                      value={updateData.paidAmount}
                      onChange={e => setUpdateData({...updateData, paidAmount: e.target.value})}
                    />
                    <Button onClick={handlePaymentUpdate} disabled={updateData.paidAmount <= 0}>Add Payment</Button>
                  </div>
                </div>

                <div className="flex justify-end pt-4">
                  <Button type="button" variant="outline" onClick={handleCloseModal}>Close</Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Success Animation Overlay */}
      {showSuccess && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm transition-opacity duration-300">
          <div className="bg-white p-10 rounded-3xl shadow-2xl flex flex-col items-center justify-center transform scale-100 transition-transform duration-500 min-w-[320px]">
            
            <svg className="checkmark w-24 h-24 rounded-full block mb-6" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 52 52">
              <circle className="checkmark__circle" cx="26" cy="26" r="25" fill="none" />
              <path className="checkmark__check" fill="none" d="M14.1 27.2l7.1 7.2 16.7-16.8" />
            </svg>

            <h2 className="text-2xl font-black text-slate-800 mb-2">Payment Successful!</h2>
            <p className="text-slate-500 font-medium">Transaction has been recorded.</p>

            <style dangerouslySetInnerHTML={{__html: `
              .checkmark__circle {
                stroke-dasharray: 166;
                stroke-dashoffset: 166;
                stroke-width: 2;
                stroke-miterlimit: 10;
                stroke: #22c55e;
                fill: none;
                animation: stroke 0.6s cubic-bezier(0.65, 0, 0.45, 1) forwards;
              }
              .checkmark {
                stroke-width: 4;
                stroke: #fff;
                stroke-miterlimit: 10;
                box-shadow: inset 0px 0px 0px #22c55e;
                animation: fill .4s ease-in-out .4s forwards, scale .3s ease-in-out .9s both;
              }
              .checkmark__check {
                transform-origin: 50% 50%;
                stroke-dasharray: 48;
                stroke-dashoffset: 48;
                animation: stroke 0.3s cubic-bezier(0.65, 0, 0.45, 1) 0.8s forwards;
              }
              @keyframes stroke {
                100% { stroke-dashoffset: 0; }
              }
              @keyframes scale {
                0%, 100% { transform: none; }
                50% { transform: scale3d(1.1, 1.1, 1); }
              }
              @keyframes fill {
                100% { box-shadow: inset 0px 0px 0px 50px #22c55e; }
              }
            `}} />
          </div>
        </div>
      )}
    </div>
  );
}
