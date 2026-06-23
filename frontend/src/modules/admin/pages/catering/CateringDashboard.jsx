import React, { useState, useEffect } from "react";
import { adminApi } from "../../services/adminApi";
import { toast } from "sonner";
import Card from "@shared/components/ui/Card";
import Badge from "@shared/components/ui/Badge";
import {
  HiOutlineClipboardDocumentList,
  HiOutlineCheckCircle,
  HiOutlineClock,
  HiOutlineXCircle,
  HiOutlineCurrencyRupee,
  HiOutlineCalendar
} from "react-icons/hi2";

const CateringDashboard = () => {
  const [stats, setStats] = useState({
    totalBookings: 0,
    pendingBookings: 0,
    confirmedBookings: 0,
    completedBookings: 0,
    cancelledBookings: 0,
    totalRevenue: 0,
    upcomingEvents: []
  });
  const [isLoading, setIsLoading] = useState(true);

  const fetchStats = async () => {
    try {
      setIsLoading(true);
      const res = await adminApi.getCateringDashboardStats();
      if (res.data?.success) {
        setStats(res.data.results || res.data.result || stats);
      }
    } catch (error) {
      toast.error("Failed to fetch catering dashboard stats");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchStats();
  }, []);

  const statCards = [
    { label: "Total Bookings", value: stats.totalBookings, icon: HiOutlineClipboardDocumentList, color: "text-blue-600", bg: "bg-blue-50" },
    { label: "Pending", value: stats.pendingBookings, icon: HiOutlineClock, color: "text-amber-600", bg: "bg-amber-50" },
    { label: "Confirmed", value: stats.confirmedBookings, icon: HiOutlineCheckCircle, color: "text-emerald-600", bg: "bg-emerald-50" },
    { label: "Completed", value: stats.completedBookings, icon: HiOutlineCheckCircle, color: "text-brand-600", bg: "bg-brand-50" },
    { label: "Cancelled", value: stats.cancelledBookings, icon: HiOutlineXCircle, color: "text-rose-600", bg: "bg-rose-50" },
    { label: "Total Revenue", value: `₹${stats.totalRevenue.toLocaleString()}`, icon: HiOutlineCurrencyRupee, color: "text-violet-600", bg: "bg-violet-50" },
  ];

  return (
    <div className="space-y-6 pb-16">
      <div>
        <h1 className="text-2xl font-bold text-gray-800">Catering Dashboard</h1>
        <p className="text-gray-500 mt-1">Overview of catering bookings and revenue.</p>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
        {statCards.map((stat, idx) => (
          <Card key={idx} className="border-none shadow-sm ring-1 ring-slate-100 p-4">
            <div className="flex items-center gap-3">
              <div className={`h-10 w-10 rounded-xl flex items-center justify-center ${stat.bg} ${stat.color}`}>
                <stat.icon className="h-5 w-5" />
              </div>
              <div>
                <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">{stat.label}</p>
                <h4 className="text-lg font-black text-slate-800">{stat.value}</h4>
              </div>
            </div>
          </Card>
        ))}
      </div>

      <div className="grid grid-cols-1 gap-6">
        <Card className="border-none shadow-sm ring-1 ring-slate-100 p-6">
          <div className="flex items-center gap-2 mb-6">
            <HiOutlineCalendar className="h-5 w-5 text-brand-600" />
            <h2 className="text-lg font-bold text-gray-800">Upcoming Events</h2>
          </div>
          
          {isLoading ? (
            <div className="animate-pulse flex flex-col gap-4">
              {[1, 2, 3].map(i => <div key={i} className="h-16 bg-slate-100 rounded-xl w-full" />)}
            </div>
          ) : stats.upcomingEvents?.length > 0 ? (
            <div className="space-y-4">
              {stats.upcomingEvents.map((event) => (
                <div key={event._id} className="flex items-center justify-between p-4 bg-slate-50 rounded-xl border border-slate-100">
                  <div>
                    <h4 className="text-sm font-bold text-slate-800">{event.customerName}</h4>
                    <p className="text-xs text-slate-500 mt-1">
                      {new Date(event.eventDate).toLocaleDateString()} at {event.eventTime} • {event.numberOfGuests} Guests
                    </p>
                    <p className="text-[10px] font-bold text-brand-600 mt-1">{event.serviceId?.name || "Catering Service"}</p>
                  </div>
                  <Badge variant={event.status === "Confirmed" ? "primary" : "indigo"}>
                    {event.status}
                  </Badge>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-12 bg-slate-50 rounded-xl border border-slate-100 border-dashed">
              <HiOutlineCalendar className="h-12 w-12 text-slate-300 mx-auto mb-3" />
              <h3 className="text-sm font-bold text-slate-600">No upcoming events</h3>
              <p className="text-xs text-slate-400 mt-1">There are no confirmed upcoming events at the moment.</p>
            </div>
          )}
        </Card>
      </div>
    </div>
  );
};

export default CateringDashboard;
