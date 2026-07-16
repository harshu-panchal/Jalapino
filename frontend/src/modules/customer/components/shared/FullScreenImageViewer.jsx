import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, ChevronLeft, ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils';
import { applyCloudinaryTransform } from '@/core/utils/imageUtils';

const FullScreenImageViewer = ({ isOpen, images = [], initialIndex = 0, onClose }) => {
    const [activeIndex, setActiveIndex] = useState(initialIndex);
    const [touchStart, setTouchStart] = useState(null);
    const [touchEnd, setTouchEnd] = useState(null);

    const minSwipeDistance = 50;

    // Sync activeIndex with initialIndex when opened
    useEffect(() => {
        if (isOpen) {
            setActiveIndex(initialIndex);
            document.body.style.overflow = 'hidden';
        } else {
            document.body.style.overflow = '';
        }
        return () => {
            document.body.style.overflow = '';
        };
    }, [isOpen, initialIndex]);

    // Keyboard navigation
    useEffect(() => {
        if (!isOpen) return;

        const handleKeyDown = (e) => {
            if (e.key === 'Escape') {
                onClose();
            } else if (e.key === 'ArrowLeft') {
                handlePrev();
            } else if (e.key === 'ArrowRight') {
                handleNext();
            }
        };

        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [isOpen, activeIndex, images]);

    if (!isOpen || images.length === 0) return null;

    const handlePrev = () => {
        setActiveIndex((prev) => (prev === 0 ? images.length - 1 : prev - 1));
    };

    const handleNext = () => {
        setActiveIndex((prev) => (prev === images.length - 1 ? 0 : prev + 1));
    };

    // Touch handlers for mobile swipe
    const handleTouchStart = (e) => {
        setTouchEnd(null);
        setTouchStart(e.targetTouches[0].clientX);
    };

    const handleTouchMove = (e) => {
        setTouchEnd(e.targetTouches[0].clientX);
    };

    const handleTouchEnd = () => {
        if (!touchStart || !touchEnd) return;
        const distance = touchStart - touchEnd;
        const isLeftSwipe = distance > minSwipeDistance;
        const isRightSwipe = distance < -minSwipeDistance;
        if (isLeftSwipe) {
            handleNext();
        } else if (isRightSwipe) {
            handlePrev();
        }
    };

    return (
        <AnimatePresence>
            {isOpen && (
                <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="fixed inset-0 z-[999] bg-white flex flex-col justify-between select-none"
                >
                    {/* Header with Close Button */}
                    <div className="absolute top-0 left-0 right-0 p-4 z-50 flex items-center justify-between bg-white/85 backdrop-blur-md border-b border-slate-100">
                        <button
                            onClick={onClose}
                            className="p-2 hover:bg-slate-100 rounded-full transition-colors active:scale-90"
                            aria-label="Close viewer"
                        >
                            <X size={24} className="text-slate-800" strokeWidth={2.5} />
                        </button>
                        <div className="text-xs font-bold text-slate-500 uppercase tracking-widest">
                            {activeIndex + 1} / {images.length}
                        </div>
                        <div className="w-10 h-10" /* Spacer to center */ />
                    </div>

                    {/* Main Gallery Area */}
                    <div className="relative flex-1 flex items-center justify-center overflow-hidden px-4 md:px-12 py-20">
                        {/* Left Chevron Button (Desktop) */}
                        {images.length > 1 && (
                            <button
                                onClick={handlePrev}
                                className="hidden md:flex absolute left-6 z-50 w-12 h-12 bg-white shadow-lg border border-slate-100 rounded-full items-center justify-center text-slate-700 hover:text-primary transition-all hover:scale-105 active:scale-95"
                            >
                                <ChevronLeft size={24} strokeWidth={2.5} />
                            </button>
                        )}

                        {/* Image Slide Container */}
                        <div 
                            className="w-full h-full max-w-4xl max-h-[75vh] overflow-hidden relative flex items-center justify-center"
                            onTouchStart={handleTouchStart}
                            onTouchMove={handleTouchMove}
                            onTouchEnd={handleTouchEnd}
                        >
                            <div 
                                className="flex h-full w-full transition-transform duration-300 ease-out"
                                style={{ transform: `translateX(-${activeIndex * 100}%)` }}
                            >
                                {images.map((img, i) => (
                                    <div key={i} className="w-full h-full flex-shrink-0 flex items-center justify-center p-2">
                                        <img
                                            src={applyCloudinaryTransform(img, "f_auto,q_auto:best,w_1600,dpr_auto")}
                                            alt={`Product view ${i + 1}`}
                                            className="max-w-full max-h-full object-contain select-none"
                                            draggable="false"
                                        />
                                    </div>
                                ))}
                            </div>
                        </div>

                        {/* Right Chevron Button (Desktop) */}
                        {images.length > 1 && (
                            <button
                                onClick={handleNext}
                                className="hidden md:flex absolute right-6 z-50 w-12 h-12 bg-white shadow-lg border border-slate-100 rounded-full items-center justify-center text-slate-700 hover:text-primary transition-all hover:scale-105 active:scale-95"
                            >
                                <ChevronRight size={24} strokeWidth={2.5} />
                            </button>
                        )}
                    </div>

                    {/* Footer / Dot Indicators */}
                    {images.length > 1 && (
                        <div className="absolute bottom-8 left-0 right-0 flex justify-center gap-2 z-50">
                            {images.map((_, i) => (
                                <button
                                    key={i}
                                    onClick={() => setActiveIndex(i)}
                                    className={cn(
                                        "h-2.5 rounded-full transition-all duration-300",
                                        i === activeIndex ? "w-8 bg-primary" : "w-2.5 bg-slate-300 hover:bg-slate-400"
                                    )}
                                    aria-label={`Go to slide ${i + 1}`}
                                />
                            ))}
                        </div>
                    )}
                </motion.div>
            )}
        </AnimatePresence>
    );
};

export default FullScreenImageViewer;
