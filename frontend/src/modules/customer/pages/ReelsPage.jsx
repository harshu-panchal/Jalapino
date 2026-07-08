import React, { useState, useEffect, useRef, useMemo } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Heart, ShoppingCart, Share2, ArrowLeft, Volume2, VolumeX, Eye, ArrowRight, Star } from 'lucide-react';
import { useCart } from '../context/CartContext';
import { useWishlist } from '../context/WishlistContext';
import { useProductDetail } from '../context/ProductDetailContext';
import { useToast } from '@shared/components/ui/Toast';
import { useLocation as useAppLocation } from '../context/LocationContext';
import { customerApi } from '../services/customerApi';
import { applyCloudinaryTransform } from '@/core/utils/imageUtils';
import { cn } from '@/lib/utils';

// Helper to extract YouTube ID
const getYouTubeId = (url) => {
    if (!url) return null;
    const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|\&v=|\/shorts\/)([^#\&\?]*).*/;
    const match = url.match(regExp);
    return (match && match[2].length === 11) ? match[2] : null;
};

const ReelItem = ({ product, isActive, activeIndex, index }) => {
    const { toggleWishlist: toggleWishlistGlobal, isInWishlist } = useWishlist();
    const { cart, addToCart, updateQuantity } = useCart();
    const { openProduct } = useProductDetail();
    const { showToast } = useToast();
    const [isMuted, setIsMuted] = useState(true);
    const [ratingData, setRatingData] = useState({ average: null, count: 0 });

    useEffect(() => {
        const fetchRating = async () => {
            const productId = product.id || product._id;
            if (!productId) return;
            try {
                const res = await customerApi.getProductReviews(productId);
                if (res.data.success) {
                    const reviewsList = res.data.results || [];
                    if (reviewsList.length > 0) {
                        const totalRating = reviewsList.reduce((acc, r) => acc + r.rating, 0);
                        const avg = (totalRating / reviewsList.length).toFixed(1);
                        setRatingData({ average: avg, count: reviewsList.length });
                    } else {
                        setRatingData({ average: null, count: 0 });
                    }
                }
            } catch (err) {
                console.error("Failed to load reviews for reel item:", err);
            }
        };
        fetchRating();
    }, [product]);

    const isWishlisted = isInWishlist(product.id || product._id);
    const videoId = useMemo(() => getYouTubeId(product.videoUrl), [product.videoUrl]);

    // Check if the product has variations
    const defaultVariant = useMemo(() => {
        const variants = Array.isArray(product?.variants) ? product.variants : [];
        return variants.length > 0 ? variants[0] : null;
    }, [product]);

    const variantKey = defaultVariant ? defaultVariant.sku : "";
    const cartItem = cart.find(
        (item) => item.id === (product.id || product._id) && String(item.variantSku || "") === variantKey
    );
    const quantity = cartItem ? cartItem.quantity : 0;

    const handleAddToCart = (e) => {
        e.preventDefault();
        e.stopPropagation();
        addToCart({
            ...product,
            id: product.id || product._id,
            price: product.salePrice || product.price,
            originalPrice: product.price,
            variantSku: variantKey,
            variantName: defaultVariant?.name || "",
        });
        showToast(`${product.name} added to cart`, 'success');
    };

    const handleShare = async (e) => {
        e.preventDefault();
        e.stopPropagation();
        const productUrl = `${window.location.origin}/product/${product.id || product._id}`;
        try {
            if (navigator.share) {
                await navigator.share({
                    title: product.name,
                    text: `Check out ${product.name} on Jalapino!`,
                    url: productUrl,
                });
            } else {
                await navigator.clipboard.writeText(productUrl);
                showToast("Product link copied to clipboard!", "success");
            }
        } catch (err) {
            console.error(err);
        }
    };

    const handleToggleWishlist = (e) => {
        e.preventDefault();
        e.stopPropagation();
        toggleWishlistGlobal(product);
        showToast(
            isWishlisted ? `${product.name} removed from wishlist` : `${product.name} added to wishlist`,
            isWishlisted ? 'info' : 'success'
        );
    };

    return (
        <div className="reel-slide w-full h-[calc(100vh-70px)] md:h-screen snap-start bg-black relative flex items-center justify-center overflow-hidden">
            {/* Main Video Embed */}
            {isActive && videoId ? (
                <div className="absolute inset-0 w-full h-full">
                    {/* Dark/Blur background backdrop matching YT style */}
                    <div 
                        className="absolute inset-0 bg-cover bg-center filter blur-3xl opacity-35 scale-110 pointer-events-none"
                        style={{ backgroundImage: `url(${applyCloudinaryTransform(product.mainImage || product.image, "w_100")})` }}
                    />
                    
                    {/* YouTube Portrait Embed */}
                    <div className="relative w-full h-full max-w-[480px] mx-auto z-10 aspect-[9/16] bg-black">
                        <iframe
                            src={`https://www.youtube.com/embed/${videoId}?rel=0&autoplay=1&mute=${isMuted ? 1 : 0}&modestbranding=1&playsinline=1&controls=0&loop=1&playlist=${videoId}`}
                            title={product.name}
                            frameBorder="0"
                            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                            allowFullScreen
                            className="w-full h-full object-cover"
                        ></iframe>
                    </div>
                </div>
            ) : (
                <div className="absolute inset-0 w-full h-full flex items-center justify-center bg-zinc-950">
                    <img 
                        src={applyCloudinaryTransform(product.mainImage || product.image, "w_600")}
                        alt={product.name}
                        className="w-full h-full object-contain max-w-[480px] blur-sm opacity-50"
                    />
                    <div className="absolute w-14 h-14 border-4 border-primary border-t-transparent rounded-full animate-spin z-25" />
                </div>
            )}

            {/* Mute/Audio toggle float */}
            {isActive && (
                <button
                    onClick={() => setIsMuted(!isMuted)}
                    className="absolute top-5 right-5 z-40 p-3 bg-black/40 backdrop-blur-md border border-white/10 rounded-full text-white hover:bg-black/60 active:scale-95 transition-all"
                >
                    {isMuted ? <VolumeX size={20} /> : <Volume2 size={20} />}
                </button>
            )}

            {/* Bottom Overlay Info (Product Description, Title, Brand) */}
            <div className="absolute bottom-0 left-0 right-0 p-5 pb-8 pt-20 bg-gradient-to-t from-black/90 via-black/40 to-transparent text-white z-30 flex items-end justify-between gap-6 pointer-events-none">
                <div className="flex-1 max-w-[70%] space-y-2.5 pointer-events-auto">
                    {/* Brand / Rating Badge */}
                    <div className="flex items-center gap-2">
                        {product.brand && (
                            <span className="bg-white/10 backdrop-blur-md border border-white/10 text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded-md">
                                {product.brand}
                            </span>
                        )}
                        {ratingData.average && (
                            <span className="bg-orange-500/20 backdrop-blur-md border border-orange-500/30 text-orange-400 text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded-md flex items-center gap-0.5">
                                <Star size={10} fill="currentColor" /> {ratingData.average}
                            </span>
                        )}
                    </div>

                    {/* Title */}
                    <h2 className="text-lg font-black tracking-tight leading-tight line-clamp-1 drop-shadow-md flex items-center gap-2">
                        {product.name}
                        {product.isLiveStream && (
                            <span className="bg-red-500 text-white text-[9px] font-black uppercase tracking-widest px-2 py-0.5 rounded-full animate-pulse">
                                LIVE
                            </span>
                        )}
                    </h2>

                    {/* Short Description snippet */}
                    <p className="text-xs text-zinc-300 font-medium leading-relaxed line-clamp-2 drop-shadow-md opacity-90">
                        {product.description || (product.isLiveStream ? "Watch the live kitchen stream from this seller." : "Premium quality product sourced directly to provide the freshest experience.")}
                    </p>

                    {/* Price and Action Button */}
                    {!product.isLiveStream && (
                        <div className="flex items-center gap-4 pt-1">
                            <div className="flex flex-col">
                                <span className="text-2xl font-black text-primary drop-shadow-md">
                                    ₹{product.salePrice || product.price}
                                </span>
                                {product.salePrice && product.salePrice < product.price && (
                                    <span className="text-[10px] text-zinc-400 line-through font-bold">
                                        ₹{product.price}
                                    </span>
                                )}
                            </div>

                            {quantity > 0 ? (
                                <div className="flex items-center bg-primary text-white rounded-xl h-10 px-1.5 shadow-lg shadow-brand-500/20">
                                    <button
                                        onClick={() => updateQuantity(product.id || product._id, -1, variantKey)}
                                        className="w-7 h-7 flex items-center justify-center hover:bg-white/10 rounded-lg transition-all"
                                    >
                                        -
                                    </button>
                                    <span className="w-8 text-center font-black text-sm">{quantity}</span>
                                    <button
                                        onClick={() => updateQuantity(product.id || product._id, 1, variantKey)}
                                        className="w-7 h-7 flex items-center justify-center hover:bg-white/10 rounded-lg transition-all"
                                    >
                                        +
                                    </button>
                                </div>
                            ) : (
                                <button
                                    onClick={handleAddToCart}
                                    className="h-10 px-5 bg-primary hover:bg-[var(--brand-400)] text-white text-xs font-black rounded-xl shadow-lg shadow-brand-500/20 active:scale-95 transition-all flex items-center gap-1.5"
                                >
                                    <ShoppingCart size={14} /> ADD TO CART
                                </button>
                            )}
                        </div>
                    )}
                </div>

                {/* Vertical actions sidebar (Likes, Shares, Details) */}
                <div className="flex flex-col items-center gap-6 pb-2 pointer-events-auto">
                    {/* Wishlist */}
                    <button
                        onClick={handleToggleWishlist}
                        className="flex flex-col items-center gap-1.5 group cursor-pointer focus:outline-none"
                    >
                        <div className={cn(
                            "w-12 h-12 rounded-full flex items-center justify-center transition-all bg-white/10 backdrop-blur-md border border-white/10 hover:bg-white/20 active:scale-90",
                            isWishlisted && "bg-red-500/20 border-red-500/40 text-red-500"
                        )}>
                            <Heart size={20} className={cn(isWishlisted && "fill-current")} />
                        </div>
                        <span className="text-[10px] font-bold tracking-wider text-zinc-300 drop-shadow-md">
                            {isWishlisted ? "Wished" : "Wishlist"}
                        </span>
                    </button>

                    {/* Share */}
                    <button
                        onClick={handleShare}
                        className="flex flex-col items-center gap-1.5 group cursor-pointer focus:outline-none"
                    >
                        <div className="w-12 h-12 rounded-full flex items-center justify-center transition-all bg-white/10 backdrop-blur-md border border-white/10 hover:bg-white/20 active:scale-90 text-white">
                            <Share2 size={20} />
                        </div>
                        <span className="text-[10px] font-bold tracking-wider text-zinc-300 drop-shadow-md">
                            Share
                        </span>
                    </button>

                    {/* View Details */}
                    {!product.isLiveStream && (
                        <button
                            onClick={() => openProduct(product)}
                            className="flex flex-col items-center gap-1.5 group cursor-pointer focus:outline-none"
                        >
                            <div className="w-12 h-12 rounded-full flex items-center justify-center transition-all bg-white/10 backdrop-blur-md border border-white/10 hover:bg-white/20 active:scale-90 text-white">
                                <Eye size={20} />
                            </div>
                            <span className="text-[10px] font-bold tracking-wider text-zinc-300 drop-shadow-md">
                                Details
                            </span>
                        </button>
                    )}
                </div>
            </div>
        </div>
    );
};

const ReelsPage = () => {
    const navigate = useNavigate();
    const location = useLocation();
    const { currentLocation } = useAppLocation();
    const [products, setProducts] = useState([]);
    const [isLoading, setIsLoading] = useState(true);
    const [activeIndex, setActiveIndex] = useState(0);
    const feedRef = useRef(null);

    const initialProductId = useMemo(() => {
        return location.state?.productId || new URLSearchParams(location.search).get('productId');
    }, [location.state, location.search]);

    // Fetch products that have videos available near the user
    useEffect(() => {
        const fetchReelProducts = async () => {
            setIsLoading(true);
            try {
                const params = {
                    hasVideo: "true",
                    limit: 20
                };
                if (currentLocation?.latitude && currentLocation?.longitude) {
                    params.lat = currentLocation.latitude;
                    params.lng = currentLocation.longitude;
                }
                const [productsRes, streamsRes] = await Promise.allSettled([
                    customerApi.getProducts(params),
                    customerApi.getLiveKitchenStreams()
                ]);

                let combinedFeed = [];

                if (productsRes.status === 'fulfilled' && productsRes.value?.data?.success) {
                    const items = productsRes.value.data.result?.items || productsRes.value.data.results || [];
                    combinedFeed = combinedFeed.concat(items.filter(item => item.videoUrl));
                }

                if (streamsRes.status === 'fulfilled' && streamsRes.value?.data?.success) {
                    const streams = streamsRes.value.data.results || streamsRes.value.data.result || streamsRes.value.data.data || [];
                    const mappedStreams = (Array.isArray(streams) ? streams : [streams]).map(stream => ({
                        _id: stream._id,
                        name: stream.sellerId?.shopName ? `${stream.sellerId.shopName} - Live Kitchen` : "Live Kitchen",
                        description: "Watch live preparation straight from our kitchen.",
                        videoUrl: stream.streamUrl,
                        isLiveStream: true,
                        brand: stream.sellerId?.shopName || "Kitchen",
                        price: 0
                    }));
                    combinedFeed = combinedFeed.concat(mappedStreams);
                }

                // Shuffle combined feed for better UX
                combinedFeed.sort(() => Math.random() - 0.5);

                setProducts(combinedFeed);

                if (initialProductId) {
                    const idx = combinedFeed.findIndex(item => String(item._id || item.id) === String(initialProductId));
                    if (idx !== -1) {
                        setActiveIndex(idx);
                    }
                }
            } catch (err) {
                console.error("Failed to load reels data:", err);
            } finally {
                setIsLoading(false);
            }
        };

        fetchReelProducts();
    }, [currentLocation?.latitude, currentLocation?.longitude, initialProductId]);

    // Scroll snap container to active index when products and activeIndex are set
    useEffect(() => {
        if (products.length > 0 && activeIndex > 0 && feedRef.current) {
            const element = feedRef.current;
            const timeout = setTimeout(() => {
                element.scrollTop = activeIndex * element.clientHeight;
            }, 100);
            return () => clearTimeout(timeout);
        }
    }, [products, activeIndex]);

    // Handle scroll calculation for active index
    const handleScroll = (e) => {
        const container = e.currentTarget;
        const index = Math.round(container.scrollTop / container.clientHeight);
        if (index !== activeIndex) {
            setActiveIndex(index);
        }
    };

    if (isLoading) {
        return (
            <div className="w-full h-[calc(100vh-70px)] md:h-screen bg-black flex flex-col items-center justify-center text-white">
                <div className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin mb-4" />
                <p className="text-sm font-bold text-zinc-500 uppercase tracking-widest">Loading Reels...</p>
            </div>
        );
    }

    if (products.length === 0) {
        return (
            <div className="w-full h-[calc(100vh-70px)] md:h-screen bg-black flex flex-col items-center justify-center text-white px-8 text-center">
                <div className="inline-flex p-4 bg-zinc-900 border border-zinc-800 rounded-full mb-6">
                    <VolumeX size={36} className="text-zinc-600" />
                </div>
                <h3 className="text-xl font-black uppercase tracking-tight mb-2">No Product Videos Yet</h3>
                <p className="text-sm text-zinc-500 max-w-xs font-medium leading-relaxed mb-8">
                    Videos are currently unavailable in your neighborhood. Check back later!
                </p>
                <button 
                    onClick={() => navigate('/')} 
                    className="px-6 py-3 bg-white text-black font-black uppercase tracking-wider text-xs rounded-xl hover:bg-zinc-200 active:scale-95 transition-all"
                >
                    Back to Shopping
                </button>
            </div>
        );
    }

    return (
        <div className="relative w-full h-[calc(100vh-70px)] md:h-screen bg-black select-none">


            {/* Vertical Scroll Feed Container */}
            <div
                ref={feedRef}
                onScroll={handleScroll}
                className="w-full h-full overflow-y-scroll snap-y snap-mandatory scroll-smooth no-scrollbar"
                style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
            >
                {products.map((product, idx) => (
                    <ReelItem
                        key={product._id || product.id}
                        product={product}
                        isActive={idx === activeIndex}
                        activeIndex={activeIndex}
                        index={idx}
                    />
                ))}
            </div>
        </div>
    );
};

export default ReelsPage;
