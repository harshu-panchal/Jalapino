import React, { useEffect } from "react";
import { Routes, Route, Navigate } from "react-router-dom";
import DashboardLayout from "@shared/layout/DashboardLayout";
import { setActiveRole, ROLES } from "@core/auth/activeRoleStore";
import { useAuth } from "@core/context/AuthContext";
import { HiOutlineCalendar, HiOutlineClipboardDocumentList } from "react-icons/hi2";
import { requestNotificationPermission } from "../../../utils/firebase";
import { sellerApi } from "../services/sellerApi";
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
    
    // Request notification permission and save token to backend
    const setupNotifications = async () => {
      try {
        const token = await requestNotificationPermission();
        if (token) {
          await sellerApi.saveFcmToken({ fcmToken: token, platform: 'web' });
          console.log("FCM token saved successfully.");
        }
      } catch (err) {
        console.error("Failed to setup notifications:", err);
      }
    };
    
    setupNotifications();
  }, []);

  const isEventSeller = user?.isEventSeller === true || user?.planMyEventEnabled === true;
  const isRetailEnabled = user?.retailEnabled !== false;

  const canAccessProducts = (isRetailEnabled || user?.productsEnabled === true) && user?.productsEnabled !== false;
  const canAccessStock = canAccessProducts && user?.stockEnabled !== false;
  const canAccessOrders = (isRetailEnabled || user?.ordersEnabled === true) && user?.ordersEnabled !== false;
  const canAccessWallet = user?.walletEnabled !== false;
  const canAccessAnalytics = user?.analyticsEnabled !== false;

  let activeNavItems = [];

  if (isEventSeller) {
    activeNavItems = [...eventNavItems];
    
    // Dynamically insert enabled retail items into event seller nav menu
    const extraItems = [];
    if (canAccessProducts) extraItems.push(navItems.find(i => i.label === "Products"));
    if (canAccessStock) extraItems.push(navItems.find(i => i.label === "Stock"));
    if (canAccessOrders) {
      extraItems.push(navItems.find(i => i.label === "Orders"));
      extraItems.push(navItems.find(i => i.label === "Returns"));
      extraItems.push(navItems.find(i => i.label === "Track Orders"));
    }
    if (canAccessAnalytics) extraItems.push(navItems.find(i => i.label === "Sales Reports"));
    if (canAccessWallet) {
      extraItems.push(navItems.find(i => i.label === "Money Request"));
      extraItems.push(navItems.find(i => i.label === "Payment History"));
      extraItems.push(navItems.find(i => i.label === "Earnings"));
    }

    const filteredExtra = extraItems.filter(Boolean).filter(item => !activeNavItems.some(active => active.label === item.label));
    activeNavItems.splice(2, 0, ...filteredExtra);
  } else {
    activeNavItems = [...navItems];
    if (!canAccessProducts) activeNavItems = activeNavItems.filter(i => !['Products'].includes(i.label));
    if (!canAccessStock) activeNavItems = activeNavItems.filter(i => !['Stock'].includes(i.label));
    if (!canAccessOrders) activeNavItems = activeNavItems.filter(i => !['Orders', 'Returns', 'Track Orders'].includes(i.label));
    if (!canAccessWallet) activeNavItems = activeNavItems.filter(i => !['Earnings', 'Money Request', 'Payment History'].includes(i.label));
    if (!canAccessAnalytics) activeNavItems = activeNavItems.filter(i => !['Sales Reports'].includes(i.label));
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

  if (user?.bookingSlotsEnabled !== true) {
    activeNavItems = activeNavItems.filter(item => !['Physical Visits'].includes(item.label));
  }

  return (
    <DashboardLayout navItems={activeNavItems} title={isEventSeller && !isRetailEnabled ? "Event Management" : isRetailEnabled && !isEventSeller ? "Seller Panel" : "Seller & Event Dashboard"}>
      <Routes>
        <Route path="/" element={isEventSeller && !isRetailEnabled ? <EventDashboard /> : <Dashboard />} />
        
        {/* Product & Catalog Routes */}
        {canAccessProducts && (
          <>
            <Route path="/products" element={<ProductManagement />} />
            <Route path="/products/add" element={<AddProduct />} />
          </>
        )}

        {/* Stock & Inventory Routes */}
        {canAccessStock && (
          <Route path="/inventory" element={<StockManagement />} />
        )}

        {/* Orders Routes */}
        {canAccessOrders && (
          <>
            <Route path="/orders" element={<Orders />} />
            <Route path="/returns" element={<Returns />} />
            <Route path="/tracking" element={<DeliveryTracking />} />
          </>
        )}

        {/* Analytics Routes */}
        {canAccessAnalytics && (
          <Route path="/analytics" element={<Analytics />} />
        )}

        {/* Wallet & Financial Routes */}
        {canAccessWallet && (
          <>
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
