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
  HiOutlineVideoCamera,
  HiOutlineChatBubbleLeftRight
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
const VideoSubscriptions = React.lazy(() => import("../pages/VideoSubscriptions"));

// Event Seller Pages
const EventDashboard = React.lazy(() => import("../pages/event/EventDashboard"));
const EventPackages = React.lazy(() => import("../pages/event/EventPackages"));
const EventReservations = React.lazy(() => import("../pages/event/EventReservations"));
const EventCalendar = React.lazy(() => import("../pages/event/EventCalendar"));

const EventRequests = React.lazy(() => import("../pages/event/EventRequests"));
const SellerChatInbox = React.lazy(() => import("../pages/event/SellerChatInbox"));

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
  { label: "Messages", path: "/seller/chat-inbox", icon: HiOutlineChatBubbleLeftRight },
  { label: "Video Plans", path: "/seller/video-subscriptions", icon: HiOutlineVideoCamera },
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
  { label: "Messages", path: "/seller/chat-inbox", icon: HiOutlineChatBubbleLeftRight },
  { label: "Video Plans", path: "/seller/video-subscriptions", icon: HiOutlineVideoCamera },
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
  const hasRetailAccess = user?.retailEnabled !== false;

  let activeNavItems = [];

  if (isEventSeller && hasRetailAccess) {
    // Seller has both retail and event enabled. Combine them.
    activeNavItems = [...eventNavItems];
    const missingRetailItems = navItems.filter(item => !activeNavItems.some(active => active.label === item.label));
    // Insert retail items like Products, Orders, etc. right after 'Go Live'
    activeNavItems.splice(2, 0, ...missingRetailItems);
  } else {
    activeNavItems = isEventSeller ? [...eventNavItems] : [...navItems];
  }

  if (user?.customerImageReviewEnabled !== true) {
    activeNavItems = activeNavItems.filter(item => !['Customer Images'].includes(item.label));
  }

  if (user?.advanceBookingEnabled !== true) {
    activeNavItems = activeNavItems.filter(item => !['Advance Bookings', 'Bookings'].includes(item.label));
  }

  if (user?.videoUploadEnabled !== true) {
    activeNavItems = activeNavItems.filter(item => !['Video Plans'].includes(item.label));
  }

  if (hasRetailAccess) {
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
  } else {
    // If not retail, remove all retail-specific items just in case
    activeNavItems = activeNavItems.filter(item => !['Products', 'Stock', 'Orders', 'Returns', 'Track Orders', 'Sales Reports', 'Money Request', 'Payment History', 'Earnings'].includes(item.label));
  }

  return (
    <DashboardLayout navItems={activeNavItems} title={isEventSeller && !hasRetailAccess ? "Event Management" : hasRetailAccess && !isEventSeller ? "Seller Panel" : "Seller & Event Dashboard"}>
      <Routes>
        <Route path="/" element={isEventSeller && !hasRetailAccess ? <EventDashboard /> : <Dashboard />} />
        
        {/* Retail Routes */}
        {hasRetailAccess && (
          <>
            <Route path="/products" element={<ProductManagement />} />
            <Route path="/products/add" element={<AddProduct />} />
            <Route path="/inventory" element={<StockManagement />} />
            <Route path="/orders" element={<Orders />} />
            <Route path="/returns" element={<Returns />} />
            <Route path="/tracking" element={<DeliveryTracking />} />
            <Route path="/analytics" element={<Analytics />} />
            <Route path="/transactions" element={<Transactions />} />
            <Route path="/earnings" element={<Earnings />} />
            <Route path="/withdrawals" element={<Withdrawals />} />
          </>
        )}

        {/* Event Routes */}
        {isEventSeller && (
          <>
            <Route path="/event-requests" element={<EventRequests />} />
            <Route path="/packages" element={<EventPackages />} />
            <Route path="/reservations" element={<EventReservations />} />
            <Route path="/calendar" element={<EventCalendar />} />
          </>
        )}

        {/* Common Routes */}
        <Route path="/customer-images" element={<CustomerImageReview />} />
        <Route path="/advance-bookings" element={<AdvanceBookings />} />
        <Route path="/chat-inbox" element={<SellerChatInbox />} />
        <Route path="/booking-management" element={<BookingManagement />} />
        <Route path="/visit-requests" element={<SellerVisitManagement />} />
        <Route path="/scanner" element={<QRScannerView />} />
        <Route path="/live" element={<LiveStream />} />
        <Route path="/video-subscriptions" element={<VideoSubscriptions />} />
        <Route path="/profile" element={<Profile />} />
        <Route path="/privacy-policy" element={<PrivacyPolicy />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </DashboardLayout>
  );
};

export default SellerRoutes;
