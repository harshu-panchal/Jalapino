import React, { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { motion } from "framer-motion";
import { useNavigate } from "react-router-dom";
import { resolveImageUrl } from "@/core/utils/imageUtils";
import { cn } from "@/lib/utils";
import { customerApi } from "../../services/customerApi";

import { useLocation } from "../../context/LocationContext";

const FooterBannerCarousel = () => {
  const { currentLocation } = useLocation();
  const navigate = useNavigate();
  const [banners, setBanners] = useState([]);
  const [activeIndex, setActiveIndex] = useState(0);
  const [zoomImageUrl, setZoomImageUrl] = useState(null);
  const [zoomScale, setZoomScale] = useState(1);

  useEffect(() => {
    const fetchBanners = async () => {
      try {
        const res = await customerApi.getOfferSections({
          lat: currentLocation?.latitude,
          lng: currentLocation?.longitude
        });
        const sections = res.data.results || res.data.result || [];
        
        // Extract all customImageUrls from all active sections
        const allBanners = sections.flatMap(section => 
          (section.customImageUrls || []).map(url => ({
            imageUrl: url,
            link: `/categories/${section.categoryId?._id || ''}` // simple fallback link if needed
          }))
        ).slice(0, 5); // ensure max 5 banners in footer
        
        setBanners(allBanners);
      } catch (error) {
        console.error("Failed to load footer banners:", error);
      }
    };
    fetchBanners();
  }, [currentLocation]);

  useEffect(() => {
    if (banners.length <= 1) return;
    const interval = setInterval(() => {
      setActiveIndex((prev) => (prev + 1) % banners.length);
    }, 10000); // 10 seconds auto scroll
    return () => clearInterval(interval);
  }, [banners.length]);

  if (banners.length === 0) return null;

  const currentBanner = banners[activeIndex];

  return (
    <div className="w-full relative">
      <div className="w-full aspect-[1448/650] transition-opacity duration-300 relative overflow-hidden bg-slate-100 group">
        {currentBanner.link ? (
          <a href={currentBanner.link} target="_blank" rel="noopener noreferrer" className="block w-full h-full">
            <img
              src={resolveImageUrl(currentBanner.imageUrl)}
              alt={currentBanner.title || "Footer Banner"}
              className="w-full h-full object-cover object-top"
            />
          </a>
        ) : (
          <img
            src={resolveImageUrl(currentBanner.imageUrl)}
            alt={currentBanner.title || "Footer Banner"}
            className="w-full h-full object-cover object-top"
          />
        )}
        
        {/* Become Seller button for the second banner (idx === 1) */}
        {activeIndex === 1 && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              navigate('/seller/auth?mode=signup');
            }}
            className="absolute bottom-4 left-4 md:bottom-6 md:left-6 bg-[#D92B2B] hover:bg-[#B72424] text-white text-[12px] md:text-lg font-black px-4 md:px-6 py-2 md:py-3 rounded-xl uppercase tracking-wider shadow-lg z-20 border border-white/20 transition-all hover:scale-105 active:scale-95"
          >
            Become Seller
          </button>
        )}
        
        <button
          onClick={(e) => {
            e.stopPropagation();
            setZoomImageUrl(currentBanner.imageUrl);
            setZoomScale(1);
          }}
          className="absolute bottom-4 right-4 bg-black/60 hover:bg-black/80 backdrop-blur-md text-white/95 text-[10px] font-bold px-2.5 py-1.5 rounded-full flex items-center gap-1 shadow-md z-25 cursor-pointer active:scale-95 transition-transform"
        >
          🔍 Tap to Zoom
        </button>
      </div>

      {/* Indicators */}
      {banners.length > 1 && (
        <div className="absolute bottom-4 left-0 right-0 flex justify-center gap-2 z-10 pointer-events-none">
          {banners.map((_, idx) => (
            <button
              key={idx}
              onClick={(e) => {
                e.stopPropagation();
                setActiveIndex(idx);
              }}
              className={`w-2 h-2 rounded-full transition-all pointer-events-auto ${
                idx === activeIndex ? "bg-white scale-125 w-4" : "bg-white/50"
              }`}
            />
          ))}
        </div>
      )}

      {/* Zoom Modal */}
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
              src={resolveImageUrl(zoomImageUrl)}
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

export default FooterBannerCarousel;
