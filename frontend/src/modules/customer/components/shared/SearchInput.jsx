import React, { useState, useEffect, useRef, useMemo } from 'react';
import { Search, X, Loader2 } from 'lucide-react';
import { customerApi } from '../../services/customerApi';
import { useProductDetail } from '../../context/ProductDetailContext';
import { useLocation } from '../../context/LocationContext';
import { cn } from '@/lib/utils';

const SearchInput = ({ placeholder = "Search Products...", className }) => {
    const [query, setQuery] = useState('');
    const [allProducts, setAllProducts] = useState([]);
    const [isLoading, setIsLoading] = useState(false);
    const [isFocused, setIsFocused] = useState(false);
    
    const containerRef = useRef(null);
    const { openProduct } = useProductDetail();
    const { currentLocation } = useLocation();

    // Fetch products once on mount/focus
    const fetchProducts = async () => {
        if (allProducts.length > 0) return;
        const hasValidLocation =
            Number.isFinite(currentLocation?.latitude) &&
            Number.isFinite(currentLocation?.longitude);
        if (!hasValidLocation) return;

        setIsLoading(true);
        try {
            const response = await customerApi.getProducts({
                limit: 150,
                lat: currentLocation.latitude,
                lng: currentLocation.longitude,
            });
            if (response.data.success) {
                const rawResult = response.data.result;
                const dbProds = Array.isArray(response.data.results)
                    ? response.data.results
                    : Array.isArray(rawResult?.items)
                        ? rawResult.items
                        : Array.isArray(rawResult)
                            ? rawResult
                            : [];
                const formattedProds = dbProds.map(p => ({
                    ...p,
                    id: p._id,
                    image: p.mainImage || p.image || "https://images.unsplash.com/photo-1550989460-0adf9ea622e2?auto=format&fit=crop&q=80&w=150&h=150",
                    price: p.salePrice || p.price,
                    originalPrice: p.price,
                    weight: p.weight || '1 unit',
                    deliveryTime: '8-15 mins'
                }));
                setAllProducts(formattedProds);
            }
        } catch (error) {
            console.error('Error fetching search products:', error);
        } finally {
            setIsLoading(false);
        }
    };

    // Filter products dynamically
    const filteredResults = useMemo(() => {
        if (!query.trim()) return [];
        return allProducts.filter(p =>
            p.name.toLowerCase().includes(query.toLowerCase()) ||
            p.categoryId?.name?.toLowerCase().includes(query.toLowerCase())
        );
    }, [query, allProducts]);

    // Handle outside clicks to close dropdown
    useEffect(() => {
        const handleClickOutside = (event) => {
            if (containerRef.current && !containerRef.current.contains(event.target)) {
                setIsFocused(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const handleSelectProduct = (product) => {
        openProduct(product);
        setIsFocused(false);
        setQuery('');
    };

    return (
        <div ref={containerRef} className={cn("relative w-full", className)}>
            <div 
                className="w-full rounded-full px-4 h-11 bg-white shadow-sm flex items-center border border-slate-200 transition-all duration-200 focus-within:ring-2 focus-within:ring-primary/50"
            >
                <Search size={18} className="text-slate-400 shrink-0" />
                <input
                    type="text"
                    value={query}
                    onChange={(e) => {
                        setQuery(e.target.value);
                        fetchProducts();
                    }}
                    onFocus={() => {
                        setIsFocused(true);
                        fetchProducts();
                    }}
                    placeholder={placeholder}
                    className="flex-1 bg-transparent border-none outline-none pl-2 text-slate-800 font-bold placeholder:text-slate-400 placeholder:font-medium text-[15px]"
                />
                {query && (
                    <button 
                        onClick={() => setQuery('')}
                        className="p-1 hover:bg-slate-100 rounded-full transition-colors shrink-0"
                    >
                        <X size={14} className="text-slate-400 hover:text-slate-600" />
                    </button>
                )}
                {isLoading && (
                    <Loader2 size={16} className="text-primary animate-spin shrink-0 ml-1" />
                )}
            </div>

            {/* Dropdown Suggestions List */}
            {isFocused && query.trim() && (
                <div 
                    className="absolute left-0 right-0 z-[1000] mt-1 bg-white border border-slate-100 rounded-2xl shadow-2xl max-h-96 overflow-y-auto font-sans animate-in fade-in slide-in-from-top-1 duration-200"
                >
                    {filteredResults.length > 0 ? (
                        <div className="py-2 divide-y divide-slate-50">
                            {filteredResults.map((product) => (
                                <div
                                    key={product.id}
                                    onClick={() => handleSelectProduct(product)}
                                    className="flex items-center gap-3 px-4 py-3 hover:bg-slate-50 cursor-pointer transition-colors"
                                >
                                    <img 
                                        src={product.image} 
                                        alt={product.name}
                                        className="w-10 h-10 object-contain rounded-md border border-slate-100 bg-white"
                                    />
                                    <div className="flex-1 min-w-0">
                                        <h4 className="text-sm font-bold text-slate-800 truncate">{product.name}</h4>
                                        <p className="text-xs text-slate-400 font-medium">{product.weight}</p>
                                    </div>
                                    <div className="text-right">
                                        <span className="text-sm font-black text-slate-800">₹{product.price}</span>
                                        {product.originalPrice > product.price && (
                                            <p className="text-xs text-slate-400 line-through">₹{product.originalPrice}</p>
                                        )}
                                    </div>
                                </div>
                            ))}
                        </div>
                    ) : (
                        <div className="p-6 text-center text-slate-500 font-medium text-sm">
                            No matching items found for "{query}"
                        </div>
                    )}
                </div>
            )}
        </div>
    );
};

export default SearchInput;
