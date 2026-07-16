import React, { useRef, useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { applyCloudinaryTransform } from "@/core/utils/imageUtils";
import { cn } from "@/lib/utils";

const QuickCategorySlider = ({ categories, onCategoryClick }) => {
  const scrollRef = useRef(null);
  const containerRef = useRef(null);
  const navigate = useNavigate();
  const [isStuck, setIsStuck] = useState(false);

  useEffect(() => {
    const handleScroll = () => {
      if (!containerRef.current) return;
      const rect = containerRef.current.getBoundingClientRect();
      const stickyThreshold = window.innerWidth >= 768 ? 166 : 228;
      // Trigger sticky state when the bottom of the category block hits the header
      // This ensures the original circles have fully scrolled under the header
      setIsStuck(rect.bottom <= stickyThreshold);
    };

    window.addEventListener("scroll", handleScroll, { passive: true, capture: true });
    document.addEventListener("scroll", handleScroll, { passive: true, capture: true });
    handleScroll(); // Initial check
    return () => {
      window.removeEventListener("scroll", handleScroll, { capture: true });
      document.removeEventListener("scroll", handleScroll, { capture: true });
    };
  }, []);

  const scrollCards = (direction) => {
    if (scrollRef.current) {
      const scrollAmount = direction === "left" ? -300 : 300;
      scrollRef.current.scrollLeft += scrollAmount;
    }
  };

  if (!categories || categories.length === 0) return null;

  return (
    <div ref={containerRef} className="relative w-full z-20">
      {/* 1. Original Circles View (Slides under header naturally) */}
      <div 
        className="relative bg-[#FAF8F6] pt-0 pb-5 md:pb-6 w-full font-['Inter'] transition-all duration-300"
      >
        <div className="container mx-auto px-4 md:px-8 lg:px-[50px] relative">
          <div className="flex justify-between items-center mb-6 md:mb-8 px-1">
            <h2 className="text-lg md:text-[22px] font-black tracking-tight text-primary leading-none font-['Inter']">
              Shop by Categories
            </h2>
            <button
              onClick={() => navigate("/categories")}
              className="flex items-center gap-0.5 text-xs font-bold text-primary hover:opacity-80 transition-opacity cursor-pointer leading-none">
              View All
              <ChevronRight size={12} strokeWidth={3} className="ml-0.5" />
            </button>
          </div>

          {/* Categories container */}
          <div
            ref={scrollRef}
            className="relative z-10 flex items-start gap-4 md:gap-6 overflow-x-auto no-scrollbar pb-2 pt-1 snap-x scroll-smooth">
            {categories.map((cat) => (
              <div
                key={cat.id}
                onClick={() => !isStuck && onCategoryClick(cat.id)}
                className="flex flex-col items-center cursor-pointer group/item snap-start min-w-[70px] sm:min-w-[88px] max-w-[96px] transition-transform active:scale-95"
              >
                <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-full bg-[#FFFFFF] border border-[#E7DDD5] flex items-center justify-center transition-all duration-300 group-hover/item:scale-105 group-hover/item:border-[#d0bfb2] shadow group-hover/item:shadow-md">
                  {cat.icon || cat.image ? (
                    <img
                      src={applyCloudinaryTransform(cat.icon || cat.image, "f_auto,q_auto,w_150")}
                      alt={cat.name}
                      loading="eager"
                      className="h-10 w-10 sm:h-12 sm:w-12 object-contain mix-blend-multiply"
                    />
                  ) : (
                    <div className="h-6 w-6 rounded-full bg-slate-300" />
                  )}
                </div>
                <span className="text-center text-[10px] sm:text-[11px] md:text-xs font-bold text-[#374151] line-clamp-2 leading-tight block mt-2.5 w-full px-1 group-hover/item:text-primary transition-colors">
                  {cat.name}
                </span>
              </div>
            ))}
          </div>

          {/* Left Scroll Button */}
          <div className="absolute left-1 top-[60%] -translate-y-1/2 z-50 hidden md:flex pointer-events-auto">
            <button
              onClick={(e) => { e.preventDefault(); e.stopPropagation(); scrollCards("left"); }}
              className="h-8 w-8 bg-white/90 backdrop-blur-md shadow-md rounded-full flex items-center justify-center border border-gray-100 cursor-pointer hover:bg-white text-primary transition-all active:scale-90">
              <ChevronLeft size={18} strokeWidth={3} />
            </button>
          </div>

          {/* Right Scroll Button */}
          <div className="absolute right-1 top-[60%] -translate-y-1/2 z-50 hidden md:flex pointer-events-auto">
            <button
              onClick={(e) => { e.preventDefault(); e.stopPropagation(); scrollCards("right"); }}
              className="h-8 w-8 bg-white/90 backdrop-blur-md shadow-md rounded-full flex items-center justify-center border border-gray-100 cursor-pointer hover:bg-white text-primary transition-all active:scale-90">
              <ChevronRight size={18} strokeWidth={3} />
            </button>
          </div>
        </div>
      </div>

      {/* 2. Sticky Collapsed View (Text only, visible only on scroll, like Flipkart) */}
      <div 
        className={cn(
          "fixed top-[228px] md:top-[166px] left-0 right-0 z-[190] bg-white shadow-sm border-b border-gray-200 transition-all duration-300",
          isStuck ? "opacity-100 translate-y-0" : "opacity-0 translate-y-0 pointer-events-none"
        )}
      >
        <div className="container mx-auto px-4 md:px-8 lg:px-[50px]">
          <div className="flex items-center gap-4 md:gap-8 overflow-x-auto no-scrollbar">
            {categories.map((cat) => (
              <div
                key={cat.id}
                onClick={() => isStuck && onCategoryClick(cat.id)}
                className="flex flex-col items-center justify-center cursor-pointer group/item transition-all duration-150 py-3 border-b-2 border-transparent hover:border-primary"
              >
                <span className="text-slate-700 group-hover/item:text-primary text-[13px] md:text-sm font-semibold whitespace-nowrap">
                  {cat.name}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

export default React.memo(QuickCategorySlider);
