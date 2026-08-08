import React, { useEffect } from "react";
import { Routes, Route, Navigate } from "react-router-dom";
import DashboardLayout from "@shared/layout/DashboardLayout";
import { setActiveRole, ROLES } from "@core/auth/activeRoleStore";
import { useAuth } from "@core/context/AuthContext";
import { HiOutlineCalendar, HiOutlineClipboardDocumentList } from "react-icons/hi2";
import Orders from "../pages/Orders";
import {
  HiOutlineSquares2X2,
  HiOutlineCube,
  HiOutlineCurrencyDollar,
  HiOutlineUser,
  HiOutlineTruck,
  HiOutlineArchiveBox,
  HiOutlineChartBarSquare,
  HiOutlineCreditCard,
  HiOutlineMapPin,
  HiOutlineVideoCamera
} from "react-icons/hi2";

const Dashboard = React.lazy(() => import("../pages/Dashboard"));
const ProductManagement = React.lazy(
  () => import("../pages/ProductManagement"),
);
const StockManagement = React.lazy(() => import("../pages/StockManagement"));
const AddProduct = React.lazy(() => import("../pages/AddProduct"));
// Note: Orders is imported eagerly above to avoid dynamic import issues
const Returns = React.lazy(() => import("../pages/Returns"));
const Earnings = React.lazy(() => import("../pages/Earnings"));
const Analytics = React.lazy(() => import("../pages/Analytics"));
const Transactions = React.lazy(() => import("../pages/Transactions"));
const DeliveryTracking = React.lazy(() => import("../pages/DeliveryTracking"));
const Profile = React.lazy(() => import("../pages/Profile"));
const PrivacyPolicy = React.lazy(() => import("../pages/PrivacyPolicy"));
const Withdrawals = React.lazy(() => import("../pages/Withdrawals"));
const LiveStream = React.lazy(() => import("../pages/LiveStream"));
const CustomerImageReview = React.lazy(() => import("../pages/CustomerImageReview"));
const AdvanceBookings = React.lazy(() => import("../pages/AdvanceBookings"));
const BookingManagement = React.lazy(() => import("../pages/BookingManagement"));
const SellerVisitManagement = React.lazy(() => import("../pages/SellerVisitManagement"));
const QRScannerView = React.lazy(() => import("../pages/QRScannerView"));

// Event Seller Pages
const EventDashboard = React.lazy(() => import("../pages/event/EventDashboard"));
const EventPackages = React.lazy(() => import("../pages/event/EventPackages"));
const EventReservations = React.lazy(() => import("../pages/event/EventReservations"));
const EventCalendar = React.lazy(() => import("../pages/event/EventCalendar"));

const EventRequests = React.lazy(() => import("../pages/event/EventRequests"));

const navItems = [
  { label: "Dashboard", path: "/seller", icon: HiOutlineSquares2X2, end: true },
  { label: "Go Live", path: "/seller/live", icon: HiOutlineVideoCamera },
  { label: "Products", path: "/seller/products", icon: HiOutlineCube },
  { label: "Stock", path: "/seller/inventory", icon: HiOutlineArchiveBox },
  { label: "Customer Images", path: "/seller/customer-images", icon: HiOutlineClipboardDocumentList },
  { label: "Advance Bookings", path: "/seller/advance-bookings", icon: HiOutlineCalendar },
  { label: "Bookings", path: "/seller/booking-management", icon: HiOutlineClipboardDocumentList },
  { label: "Orders", path: "/seller/orders", icon: HiOutlineTruck },
  { label: "Returns", path: "/seller/returns", icon: HiOutlineArchiveBox },
  { label: "Track Orders", path: "/seller/tracking", icon: HiOutlineMapPin },
  {
    label: "Sales Reports",
    path: "/seller/analytics",
    icon: HiOutlineChartBarSquare,
  },
  {
    label: "Money Request",
    path: "/seller/withdrawals",
    icon: HiOutlineCurrencyDollar,
  },
  {
    label: "Payment History",
    path: "/seller/transactions",
    icon: HiOutlineCreditCard,
  },
  {
    label: "Earnings",
    path: "/seller/earnings",
    icon: HiOutlineCurrencyDollar,
  },
  { label: "Physical Visits", path: "/seller/visit-requests", icon: HiOutlineCalendar },
  { label: "Ticket Scanner", path: "/seller/scanner", icon: HiOutlineClipboardDocumentList },
  { label: "Profile", path: "/seller/profile", icon: HiOutlineUser },
];

const eventNavItems = [
  { label: "Dashboard", path: "/seller", icon: HiOutlineSquares2X2, end: true },
  { label: "Go Live", path: "/seller/live", icon: HiOutlineVideoCamera },
  { label: "Event Requests", path: "/seller/event-requests", icon: HiOutlineClipboardDocumentList },
  { label: "Customer Images", path: "/seller/customer-images", icon: HiOutlineClipboardDocumentList },
  { label: "Advance Bookings", path: "/seller/advance-bookings", icon: HiOutlineCalendar },
  { label: "Bookings", path: "/seller/booking-management", icon: HiOutlineClipboardDocumentList },
  { label: "Packages", path: "/seller/packages", icon: HiOutlineCube },
  { label: "Reservations", path: "/seller/reservations", icon: HiOutlineClipboardDocumentList },
  { label: "Calendar", path: "/seller/calendar", icon: HiOutlineCalendar },
  { label: "Physical Visits", path: "/seller/visit-requests", icon: HiOutlineCalendar },
  { label: "Ticket Scanner", path: "/seller/scanner", icon: HiOutlineClipboardDocumentList },
  { label: "Profile", path: "/seller/profile", icon: HiOutlineUser },
];

const SellerRoutes = () => {
  const { user } = useAuth();

  useEffect(() => {
    setActiveRole(ROLES.SELLER);
  }, []);

  const isEventSeller = user?.isEventSeller === true || user?.planMyEventEnabled === true;
  const hasProductAccess = user?.hasProductAccess !== false && user?.retailEnabled !== false;

  let activeNavItems = isEventSeller ? eventNavItems : navItems;

  if (user?.customerImageReviewEnabled !== true) {
    activeNavItems = activeNavItems.filter(item => !['Customer Images'].includes(item.label));
  }

  if (user?.advanceBookingEnabled !== true) {
    activeNavItems = activeNavItems.filter(item => !['Advance Bookings', 'Bookings'].includes(item.label));
  }

  if (!isEventSeller) {
    if (user?.productsEnabled === false) {
      activeNavItems = activeNavItems.filter(item => !['Products'].includes(item.label));
    }
    if (user?.stockEnabled === false) {
      activeNavItems = activeNavItems.filter(item => !['Stock'].includes(item.label));
    }
    if (user?.ordersEnabled === false) {
      activeNavItems = activeNavItems.filter(item => !['Orders', 'Returns', 'Track Orders'].includes(item.label));
    }
    if (user?.walletEnabled === false) {
      activeNavItems = activeNavItems.filter(item => !['Earnings', 'Money Request', 'Payment History'].includes(item.label));
    }
    if (user?.analyticsEnabled === false) {
      activeNavItems = activeNavItems.filter(item => !['Sales Reports'].includes(item.label));
    }
  }

  return (
    <DashboardLayout navItems={activeNavItems} title={isEventSeller ? "Event Management" : "Seller Panel"}>
      <Routes>
        {isEventSeller ? (
          <>
            <Route path="/" element={<EventDashboard />} />
            <Route path="/event-requests" element={<EventRequests />} />
            <Route path="/customer-images" element={<CustomerImageReview />} />
            <Route path="/packages" element={<EventPackages />} />
            <Route path="/reservations" element={<EventReservations />} />
            <Route path="/calendar" element={<EventCalendar />} />
            <Route path="/booking-management" element={<BookingManagement />} />
            <Route path="/visit-requests" element={<SellerVisitManagement />} />
            <Route path="/scanner" element={<QRScannerView />} />
            <Route path="/live" element={<LiveStream />} />
            <Route path="/profile" element={<Profile />} />
            <Route path="/privacy-policy" element={<PrivacyPolicy />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </>
        ) : (
          <>
            <Route path="/" element={<Dashboard />} />
            <Route path="/products" element={<ProductManagement />} />
            <Route path="/products/add" element={<AddProduct />} />
            <Route path="/inventory" element={<StockManagement />} />
            <Route path="/customer-images" element={<CustomerImageReview />} />
            <Route path="/advance-bookings" element={<AdvanceBookings />} />
            <Route path="/booking-management" element={<BookingManagement />} />
            <Route path="/visit-requests" element={<SellerVisitManagement />} />
            <Route path="/scanner" element={<QRScannerView />} />
            <Route path="/orders" element={<Orders />} />
            <Route path="/returns" element={<Returns />} />
            <Route path="/tracking" element={<DeliveryTracking />} />
            <Route path="/analytics" element={<Analytics />} />
            <Route path="/transactions" element={<Transactions />} />
            <Route path="/earnings" element={<Earnings />} />
            <Route path="/withdrawals" element={<Withdrawals />} />
            <Route path="/live" element={<LiveStream />} />
            <Route path="/profile" element={<Profile />} />
            <Route path="/privacy-policy" element={<PrivacyPolicy />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </>
        )}
      </Routes>
    </DashboardLayout>
  );
};

export default SellerRoutes;
