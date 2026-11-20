import React from "react";
import { createPortal } from "react-dom";
import { useNavigate } from "react-router-dom";
import { AnimatePresence } from "framer-motion";
import NotificationsNoneOutlinedIcon from "@mui/icons-material/NotificationsNoneOutlined";
import axiosInstance from "@core/api/axios";
import { getStoredAuthToken } from "@core/utils/authStorage";
import { STORAGE_KEYS } from "@core/utils/storageKeys";
import { onNotificationNew } from "@core/services/orderSocket";
import NotificationPopup from "@shared/layout/NotificationPopup";

// Customer header bell. category "retail" -> retail notifications only,
// "event" -> Plan My Event booking notifications only (all from DB, live via socket).
const isEventType = (type) => /^(NEW_)?EVENT_/.test(String(type || "").toUpperCase());

const CustomerNotificationBell = ({ category = "retail", className = "", iconSize = 24, variant = "header", inactiveClassName = "text-gray-400" }) => {
  const navigate = useNavigate();
  const ref = React.useRef(null);
  const popupRef = React.useRef(null);
  // Mobile header bell: popup opens just below the bell, on top of the header (not over it).
  const [mobileStyle, setMobileStyle] = React.useState(null);
  const [open, setOpen] = React.useState(false);
  const [notifications, setNotifications] = React.useState([]);
  const [count, setCount] = React.useState(0);

  const getToken = React.useCallback(() => getStoredAuthToken(STORAGE_KEYS.AUTH_CUSTOMER), []);
  const authHeaders = React.useCallback(() => {
    const token = getToken();
    return token ? { Authorization: `Bearer ${token}` } : {};
  }, [getToken]);

  const fetchNotifications = React.useCallback(async () => {
    if (!getToken()) return;
    try {
      const res = await axiosInstance.get("/notifications", {
        params: { category, limit: 50 },
        headers: authHeaders(),
      });
      const result = res?.data?.result || {};
      setNotifications(Array.isArray(result.notifications) ? result.notifications : []);
      // Same as seller panel: total notifications in this section.
      setCount(Number(result.total ?? result.unreadCount ?? 0));
    } catch (error) {
      /* not logged in / network - keep the bell quiet */
    }
  }, [category, getToken, authHeaders]);

  // Load + live refresh when a new notification of this section arrives.
  React.useEffect(() => {
    fetchNotifications();
    if (!getToken()) return undefined;
    const off = onNotificationNew(getToken, (payload) => {
      const wantEvent = category === "event";
      if (isEventType(payload?.eventType) === wantEvent) fetchNotifications();
    });
    const onFocus = () => fetchNotifications();
    window.addEventListener("focus", onFocus);
    return () => {
      if (typeof off === "function") off();
      window.removeEventListener("focus", onFocus);
    };
  }, [category, fetchNotifications, getToken]);

  // Close when clicking outside.
  React.useEffect(() => {
    if (!open) return undefined;
    const onDown = (e) => {
      if (ref.current && !ref.current.contains(e.target) && !(popupRef.current && popupRef.current.contains(e.target))) setOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [open]);

  const markRead = async (ids) => {
    const list = ids.filter(Boolean);
    if (!list.length) return;
    try {
      await axiosInstance.patch("/notifications/read", { notificationIds: list }, { headers: authHeaders() });
    } catch (error) {
      /* ignore */
    }
    fetchNotifications();
  };

  const getRoute = (notif) => {
    const data = notif?.data || {};
    if (isEventType(notif?.type || data.eventType)) {
      const bookingId = data.bookingId || "";
      return { path: `/orders?tab=events${bookingId ? `&bookingId=${encodeURIComponent(bookingId)}` : ""}`, state: { tab: "events" } };
    }
    if (data.link) {
      try {
        const url = new URL(String(data.link), window.location.origin);
        if (!url.pathname.startsWith("/seller") && !url.pathname.startsWith("/admin") && !url.pathname.startsWith("/delivery")) {
          return { path: url.pathname + url.search };
        }
      } catch (e) {
        /* bad link -> fallback */
      }
    }
    if (data.orderId) return { path: `/orders/${encodeURIComponent(data.orderId)}` };
    return null;
  };

  const handleOpen = async (notif) => {
    const id = notif?._id || notif?.id;
    if (id && !notif.isRead) await markRead([id]);
    const route = getRoute(notif);
    if (route) {
      setOpen(false);
      navigate(route.path, route.state ? { state: route.state } : undefined);
    }
  };

  const toggleOpen = () => {
    if (!open && variant === "header" && typeof window !== "undefined" && window.innerWidth < 768 && ref.current) {
      const top = Math.round(ref.current.getBoundingClientRect().bottom + 10);
      setMobileStyle({ top, maxHeight: `calc(100vh - ${top}px - 16px)` });
    } else if (!open) {
      setMobileStyle(null);
    }
    setOpen((v) => !v);
  };

  if (!getToken()) return null;

  const popup = (
    <NotificationPopup
      notifications={notifications}
      onMarkAsRead={(id) => markRead([id])}
      onMarkAllAsRead={() => markRead(notifications.filter((n) => !n.isRead).map((n) => n._id || n.id))}
      onClose={() => setOpen(false)}
      onOpen={handleOpen}
      style={mobileStyle || undefined}
    />
  );

  return (
    <div className={`relative ${className}`} ref={ref}>
      {variant === "bottomnav" ? (
        // Mobile bottom bar item (same look as Home / Orders / Profile)
        <button
          type="button"
          aria-label="Notifications"
          onClick={toggleOpen}
          className="w-full h-full flex flex-col items-center justify-center"
        >
          <span className="relative flex items-center justify-center">
            <NotificationsNoneOutlinedIcon sx={{ fontSize: 26 }} className={open ? "text-primary" : inactiveClassName} />
            {count > 0 && (
              <span className="absolute -top-1.5 -right-2 min-w-[16px] h-[16px] px-1 flex items-center justify-center bg-rose-500 text-white text-[9px] font-bold leading-none rounded-full ring-2 ring-white">
                {count > 99 ? "99+" : count}
              </span>
            )}
          </span>
          <span className={`text-[10px] font-bold tracking-tight mt-1 ${open ? "text-primary" : inactiveClassName}`}>
            Alerts
          </span>
        </button>
      ) : (
        <button
          type="button"
          aria-label="Notifications"
          onClick={toggleOpen}
          className="relative flex items-center transition-all text-white hover:opacity-80"
        >
          <NotificationsNoneOutlinedIcon sx={{ fontSize: iconSize }} />
          {count > 0 && (
            <span className="absolute -top-1.5 -right-1.5 min-w-[18px] h-[18px] px-1 flex items-center justify-center bg-rose-500 text-white text-[10px] font-bold leading-none rounded-full ring-2 ring-white shadow-sm">
              {count > 99 ? "99+" : count}
            </span>
          )}
        </button>
      )}
      <AnimatePresence>
        {open && !mobileStyle && popup}
      </AnimatePresence>
      {open && mobileStyle && createPortal(
        <div ref={popupRef} className="md:hidden">{popup}</div>,
        document.body
      )}
    </div>
  );
};

export default CustomerNotificationBell;
