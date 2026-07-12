import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import MainLocationHeader from '../components/shared/MainLocationHeader';
import { customerApi } from '../services/customerApi';
import { applyCloudinaryTransform } from '@/core/utils/imageUtils';
import { Search, X } from 'lucide-react';


const CategoriesPage = () => {
    const [categories, setCategories] = useState([]);
    const [isLoading, setIsLoading] = useState(true);
    const [searchQuery, setSearchQuery] = useState('');
    const [isScrolled, setIsScrolled] = useState(false);
    const navigate = useNavigate();



    const fetchCategories = async () => {
        setIsLoading(true);
        try {
            const res = await customerApi.getCategories({ tree: true });
            if (res.data.success) {
                const tree = res.data.results || res.data.result || [];
                const flatCats = [];
                const seenIds = new Set();

                tree
                    .filter((header) => (header.name || '').trim().toLowerCase() !== 'all')
                    .forEach((header) => {
                        (header.children || []).forEach((cat) => {
                            if (!seenIds.has(cat._id)) {
                                seenIds.add(cat._id);
                                flatCats.push({
                                    id: cat._id,
                                    name: cat.name,
                                    image: cat.image || "https://cdn.grofers.com/cdn-cgi/image/f=auto,fit=scale-down,q=70,metadata=none,w=270/layout-engine/2022-11/Slice-1_9.png",
                                });
                            }
                        });
                    });
                setCategories(flatCats);
            }
        } catch (error) {
            console.error("Error fetching categories:", error);
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        fetchCategories();
        const handleScroll = () => setIsScrolled(window.scrollY > 80);
        window.addEventListener('scroll', handleScroll, { passive: true });
        return () => window.removeEventListener('scroll', handleScroll);
    }, []);


    return (
        <div className="min-h-screen bg-[#FAF8F6]">
            <MainLocationHeader hideSearchBar={false} isAbsolute={true} />
            <div className="max-w-3xl mx-auto px-4 pt-[240px] md:pt-[220px] pb-24">
                {/* Search Box - Fixed top-0, shows only when scrolled */}
                <div 
                    className={`fixed top-0 left-0 right-0 z-[100] bg-[#FAF8F6] py-3 px-4 max-w-3xl mx-auto transition-all duration-200 ${
                        isScrolled ? "opacity-100 translate-y-0" : "opacity-0 pointer-events-none -translate-y-2"
                    }`}
                    style={{
                        boxShadow: isScrolled ? '0 8px 20px -12px rgba(0,0,0,0.15)' : 'none',
                    }}
                >
                    <div className="w-full flex items-center gap-3 bg-white rounded-2xl px-4 h-12 shadow-sm border border-slate-200 hover:shadow-md transition-all">
                        <Search className="text-slate-400 w-5 h-5 shrink-0" />
                        <input
                            type="text"
                            placeholder="Search categories..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            onKeyDown={(e) => {
                                if (e.key === 'Enter' && searchQuery.trim()) {
                                    navigate(`/search`, { state: { query: searchQuery.trim() } });
                                }
                            }}
                            className="flex-1 bg-transparent border-none outline-none text-slate-800 font-medium placeholder:text-slate-400 text-sm"
                        />
                        {searchQuery && (
                            <button onClick={() => setSearchQuery('')} className="text-slate-400 hover:text-slate-600">
                                <X className="w-4 h-4" />
                            </button>
                        )}
                    </div>
                </div>

                {isLoading ? (
                    <div className="flex justify-center py-20">
                        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[var(--customer-header-base-color)]" />
                    </div>
                ) : (
                    <div className="grid grid-cols-4 gap-x-6 sm:gap-x-8 md:gap-x-10 gap-y-10 md:gap-y-14">
                        {categories
                            .filter(cat => cat.name.toLowerCase().includes(searchQuery.toLowerCase()))
                            .map((category, idx) => (
                            <div 
                                key={category.id} 
                                className="flex flex-col group cursor-pointer text-center animate-in fade-in slide-in-from-bottom-4 duration-500"
                                style={{ animationDelay: `${idx * 40}ms` }}
                            >
                                <Link
                                    to={`/category/${category.id}`}
                                    className="block w-full"
                                >
                                    <div className="w-full aspect-square mb-3.5 relative flex items-center justify-center rounded-full bg-white hover:bg-slate-50/50 border border-slate-100 hover:border-slate-200 shadow-sm hover:shadow-md transition-all duration-300 p-4 sm:p-5 md:p-6">
                                        <img
                                            src={applyCloudinaryTransform(category.image)}
                                            alt={category.name}
                                            loading="lazy"
                                            className="w-full h-full object-contain mix-blend-multiply transition-transform duration-300 group-hover:scale-105"
                                        />
                                    </div>
                                    <span className="text-[11px] sm:text-xs md:text-sm lg:text-base font-bold text-[#2D3F51] tracking-tight leading-snug line-clamp-2 group-hover:text-[var(--customer-header-base-color)] transition-colors font-['Inter']">
                                        {category.name}
                                    </span>
                                </Link>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
};

export default CategoriesPage;
