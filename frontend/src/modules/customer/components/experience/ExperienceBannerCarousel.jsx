import React from "react";
import { useNavigate } from "react-router-dom";
import { createPortal } from "react-dom";
import { cn } from "@/lib/utils";
import { motion, useMotionValue } from "framer-motion";
import { toast } from "sonner";
import {
  applyCloudinaryTransform,
  buildCloudinarySrcSet,
  isCloudinaryUrl,
} from "@/core/utils/imageUtils";

import { isMobileOrWebView } from "@/core/utils/deviceUtils";

const BANNER_CHUNK_SIZE = 20;

const ExperienceBannerCarousel = ({ section, items, fullWidth = false, slideGap = 0, edgeToEdge = false }) => {
  if (!items.length) return null;

  const navigate = useNavigate();
  const [activeIndex, setActiveIndex] = React.useState(0);
  const [visibleCount, setVisibleCount] = React.useState(() =>
    Math.min(items.length, BANNER_CHUNK_SIZE)
  );
  const visibleItems = items.slice(0, visibleCount);
  const totalItems = visibleItems.length;
  const x = useMotionValue(0);
  const containerRef = React.useRef(null);
  const hasMore = visibleCount < items.length;

  const [zoomImageUrl, setZoomImageUrl] = React.useState(null);
  const [zoomScale, setZoomScale] = React.useState(1);

  const loadMore = React.useCallback(() => {
    setVisibleCount((prev) => Math.min(items.length, prev + BANNER_CHUNK_SIZE));
  }, [items.length]);

  React.useEffect(() => {
    setVisibleCount(Math.min(items.length, BANNER_CHUNK_SIZE));
    setActiveIndex(0);
  }, [items.length]);

  // Auto-play logic
  React.useEffect(() => {
    if (totalItems <= 1) return;

    const intervalId = setInterval(() => {
      setActiveIndex((prev) => (prev + 1) % totalItems);
    }, 10000);

    return () => clearInterval(intervalId);
  }, [totalItems]);

  React.useEffect(() => {
    if (!hasMore) return;
    if (activeIndex >= totalItems - 2) {
      loadMore();
    }
  }, [activeIndex, totalItems, hasMore, loadMore]);

  const handleDragEnd = (_, info) => {
    const threshold = 50;
    if (info.offset.x < -threshold) {
      // Swipe left -> Next
      setActiveIndex((prev) => Math.min(prev + 1, totalItems - 1));
    } else if (info.offset.x > threshold) {
      // Swipe right -> Prev
      setActiveIndex((prev) => Math.max(prev - 1, 0));
    }
  };

  const getBannerOptimizedSrc = React.useCallback((url) => {
    if (!url) return url;
    if (!isCloudinaryUrl(url)) return url;
    return applyCloudinaryTransform(url, "f_auto,q_auto,c_fill,g_north,w_1448,h_650");
  }, []);

  const handleBannerClick = React.useCallback((banner) => {
    if (!banner.linkType || banner.linkType === "none" || !banner.linkValue) {
      toast.error("No Product");
      return;
    }

    if (banner.linkType === "url") {
      window.open(banner.linkValue, "_blank", "noopener,noreferrer");
    } else if (banner.linkType === "product") {
      navigate(`/product/${banner.linkValue}`);
    } else {
      navigate(`/category/${banner.linkValue}`);
    }
  }, [navigate]);

  return (
    <div className={cn("overflow-hidden touch-pan-y relative", fullWidth && "w-screen relative left-1/2 right-1/2 -ml-[50vw] -mr-[50vw]")}>
      <motion.div
        ref={containerRef}
        drag="x"
        dragConstraints={{ left: 0, right: 0 }}
        dragElastic={0.2}
        onDragEnd={handleDragEnd}
        animate={{ x: `-${(activeIndex / totalItems) * 100}%` }}
        transition={isMobileOrWebView() ? { type: "tween", ease: "easeInOut", duration: 0.3 } : { type: "spring", stiffness: 300, damping: 30 }}
        className="flex"
        style={{ width: `${totalItems * 100}%` }}
      >
        {visibleItems.map((banner, idx) => (
          <div
            key={idx}
            className={cn(
              "relative shrink-0 flex items-center justify-center box-border",
              fullWidth
                ? "aspect-[1448/450] w-full rounded-none px-0 overflow-hidden"
                : "aspect-[1448/450] w-[92vw] max-w-[1400px] px-2 md:px-4",
              "cursor-pointer hover:brightness-95 transition-all"
            )}
            style={{ width: `${100 / totalItems}%` }}
            onClick={() => handleBannerClick(banner)}
          >
            {fullWidth ? (
              <>
                <motion.img
                  animate={{ scale: idx === activeIndex ? 1.06 : 1 }}
                  transition={{ duration: 3.5, ease: "easeOut" }}
                  whileHover={{ scale: 1.08 }}
                  whileTap={{ scale: 1.04 }}
                  src={getBannerOptimizedSrc(banner.imageUrl)}
                  srcSet={
                    isCloudinaryUrl(banner.imageUrl)
                      ? buildCloudinarySrcSet(banner.imageUrl, [
                          { w: 412 },
                          { w: 824 },
                          { w: 1248 },
                          { w: 1448 }
                        ], "f_auto,q_auto,c_limit")
                      : undefined
                  }
                  sizes="100vw"
                  alt={banner.title || section?.title || "Banner"}
                  className="w-full h-full object-cover object-top pointer-events-none origin-center"
                  width={1448}
                  height={450}
                  loading={idx === 0 ? "eager" : "lazy"}
                  fetchPriority={idx === 0 ? "high" : "low"}
                  decoding="async"
                />
                {idx === 1 && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      navigate('/seller/auth?mode=signup');
                    }}
                    className="absolute bottom-4 left-4 bg-[#D92B2B] hover:bg-[#B91C1C] text-white text-[12px] md:text-lg font-black px-4 py-2 rounded-xl uppercase tracking-wider shadow-lg z-10 border border-white/20 active:scale-95 transition-transform"
                  >
                    Become Seller
                  </button>
                )}
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setZoomImageUrl(banner.imageUrl);
                    setZoomScale(1);
                  }}
                  className="absolute bottom-4 right-4 bg-black/60 hover:bg-black/80 backdrop-blur-md text-white/95 text-[10px] font-bold px-2.5 py-1.5 rounded-full flex items-center gap-1 shadow-md z-25 cursor-pointer active:scale-95 transition-transform"
                >
                  🔍 Tap to Zoom
                </button>
              </>
            ) : (
              <div className="w-full aspect-[1448/450] rounded-3xl shadow-[0_8px_24px_rgba(0,0,0,0.05),_0_2px_8px_rgba(0,0,0,0.03)] bg-white relative overflow-hidden">
                <motion.img
                  animate={{ scale: idx === activeIndex ? 1.06 : 1 }}
                  transition={{ duration: 3.5, ease: "easeOut" }}
                  whileHover={{ scale: 1.08 }}
                  whileTap={{ scale: 1.04 }}
                  src={getBannerOptimizedSrc(banner.imageUrl)}
                  srcSet={
                    isCloudinaryUrl(banner.imageUrl)
                      ? buildCloudinarySrcSet(banner.imageUrl, [
                          { w: 560 },
                          { w: 1120 },
                          { w: 1448 }
                        ], "f_auto,q_auto,c_limit")
                      : undefined
                  }
                  sizes="(max-width: 768px) 100vw, 1448px"
                  alt={banner.title || section?.title || "Banner"}
                  className="w-full h-full object-cover object-top pointer-events-none rounded-3xl origin-center"
                  width={1448}
                  height={450}
                  loading={idx === 0 ? "eager" : "lazy"}
                  fetchPriority={idx === 0 ? "high" : "low"}
                  decoding="async"
                />
                {idx === 1 && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      navigate('/seller/auth?mode=signup');
                    }}
                    className="absolute bottom-4 left-4 bg-[#D92B2B] hover:bg-[#B91C1C] text-white text-[12px] md:text-lg font-black px-4 py-2 rounded-xl uppercase tracking-wider shadow-lg z-10 border border-white/20 active:scale-95 transition-transform"
                  >
                    Become Seller
                  </button>
                )}
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setZoomImageUrl(banner.imageUrl);
                    setZoomScale(1);
                  }}
                  className="absolute bottom-4 right-4 bg-black/60 hover:bg-black/80 backdrop-blur-md text-white/95 text-[10px] font-bold px-2.5 py-1.5 rounded-full flex items-center gap-1 shadow-md z-25 cursor-pointer active:scale-95 transition-transform"
                >
                  🔍 Tap to Zoom
                </button>
                {/* Subtle burgundy border overlay */}
                <div className="absolute inset-0 border border-[var(--customer-header-base-color)]/15 rounded-3xl pointer-events-none" />
              </div>
            )}
          </div>
        ))}
      </motion.div>

      {zoomImageUrl && createPortal(
        <div className="fixed inset-0 z-[9999] bg-black/95 flex flex-col items-center justify-center select-none backdrop-blur-md">
          {/* Header controls */}
          <div className="absolute top-4 left-4 right-4 flex items-center justify-between z-[10000]">
            <span className="text-white/80 text-xs font-semibold uppercase tracking-wider bg-white/10 px-3 py-1.5 rounded-full backdrop-blur-md">
              Zoom Mode ({Math.round(zoomScale * 100)}%)
            </span>
            <div className="flex gap-2">
              <button
                onClick={(e) => { e.stopPropagation(); setZoomScale(prev => Math.min(prev + 0.5, 4)); }}
                className="w-10 h-10 rounded-full bg-white/10 hover:bg-white/20 active:scale-95 text-white flex items-center justify-center font-bold text-lg backdrop-blur-md transition-all cursor-pointer"
              >
                ＋
              </button>
              <button
                onClick={(e) => { e.stopPropagation(); setZoomScale(prev => Math.max(prev - 0.5, 1)); }}
                className="w-10 h-10 rounded-full bg-white/10 hover:bg-white/20 active:scale-95 text-white flex items-center justify-center font-bold text-lg backdrop-blur-md transition-all cursor-pointer"
              >
                －
              </button>
              <button
                onClick={(e) => { e.stopPropagation(); setZoomScale(1); }}
                className="px-3 h-10 rounded-full bg-white/10 hover:bg-white/20 active:scale-95 text-white flex items-center justify-center font-semibold text-xs backdrop-blur-md transition-all cursor-pointer"
              >
                Reset
              </button>
              <button
                onClick={(e) => { e.stopPropagation(); setZoomImageUrl(null); setZoomScale(1); }}
                className="w-10 h-10 rounded-full bg-white/20 hover:bg-white/30 active:scale-95 text-white flex items-center justify-center font-bold text-lg backdrop-blur-md transition-all cursor-pointer"
              >
                ✕
              </button>
            </div>
          </div>

          {/* Image container */}
          <div className="w-full h-full overflow-hidden flex items-center justify-center p-4" onClick={() => { setZoomImageUrl(null); setZoomScale(1); }}>
            <motion.img
              src={zoomImageUrl}
              onClick={(e) => e.stopPropagation()}
              drag={zoomScale > 1}
              dragConstraints={{ left: -400, right: 400, top: -400, bottom: 400 }}
              animate={{ scale: zoomScale }}
              transition={{ type: "spring", stiffness: 200, damping: 25 }}
              onDoubleClick={(e) => { e.stopPropagation(); setZoomScale(prev => prev > 1 ? 1 : 2.5); }}
              className={cn(
                "max-w-full max-h-[85vh] object-contain transition-shadow duration-300 rounded-lg shadow-2xl",
                zoomScale > 1 ? "cursor-grab active:cursor-grabbing" : "cursor-zoom-in"
              )}
              alt="Zoomed Banner"
            />
          </div>

          <div className="absolute bottom-6 text-center text-white/50 text-[10px] pointer-events-none">
            Double click/tap to quick-zoom. Drag to pan when zoomed in.
          </div>
        </div>,
        document.body
      )}
    </div>
  );
};

export default ExperienceBannerCarousel;
