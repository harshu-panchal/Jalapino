import React from "react";
import { useNavigate } from "react-router-dom";
import { ChevronLeft, Heart, Store } from "lucide-react";
import { toast } from "sonner";
import axiosInstance from "@core/api/axios";
import { resolveImageUrl } from "@/core/utils/imageUtils";
import MainLocationHeader from "../../components/shared/MainLocationHeader";

// Plan My Event wishlist - separate from the retail wishlist (/wishlist).
// Click a product -> opens that seller in Plan My Event (where the product is).
const FALLBACK_IMG = "https://cdn-icons-png.flaticon.com/128/2321/2321801.png";

const EventWishlistPage = () => {
  const navigate = useNavigate();
  const [items, setItems] = React.useState([]);
  const [loading, setLoading] = React.useState(true);
  const [openingId, setOpeningId] = React.useState(null);

  const load = React.useCallback(async () => {
    try {
      const res = await axiosInstance.get("/wishlist/events");
      setItems(Array.isArray(res.data?.result?.items) ? res.data.result.items : []);
    } catch (error) {
      toast.error("Could not load your Plan My Event wishlist");
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => { load(); }, [load]);

  const remove = async (productId) => {
    try {
      const res = await axiosInstance.delete(`/wishlist/events/remove/${productId}`);
      setItems(Array.isArray(res.data?.result?.items) ? res.data.result.items : []);
      toast.success("Removed from Plan My Event wishlist");
    } catch (error) {
      toast.error("Could not remove");
    }
  };

  // Open the seller page in Plan My Event (same way the header search opens a seller).
  const openSeller = async (item) => {
    const sellerId = String(item?.seller?._id || item?.product?.sellerId || "");
    const name = item?.seller?.shopName || item?.seller?.name || "";
    if (!sellerId) return;
    setOpeningId(String(item.product._id));
    try {
      const res = await axiosInstance.get("/events/sellers/search", { params: { q: name } });
      const list = Array.isArray(res.data?.result) ? res.data.result : [];
      const seller = list.find((s) => String(s._id) === sellerId);
      if (!seller || String(seller.isShopActive) === "false") {
        toast.error("This seller is not available right now");
        return;
      }
      navigate("/plan-my-event", { state: { openSeller: seller } });
    } catch (error) {
      toast.error("Could not open this seller");
    } finally {
      setOpeningId(null);
    }
  };

  if (loading) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-slate-900"></div>
      </div>
    );
  }

  return (
    <div className="h-[100dvh] bg-slate-50 flex flex-col font-sans overflow-hidden">
      {/* Same Plan My Event header as the other Plan My Event pages */}
      <MainLocationHeader hideSearchBar={false} isAbsolute={false} />
      <div className="flex-1 min-h-0 overflow-y-auto pb-24" style={{ paddingTop: 'calc(var(--header-height, 140px) + 16px - var(--header-shrink-offset, 0px))' }}>
      <div className="px-4 pt-1 pb-3 border-b border-slate-200/60 mb-4 flex items-center gap-2">
        <button
          onClick={() => navigate(-1)}
          className="w-10 h-10 flex items-center justify-center hover:bg-slate-200/70 rounded-full transition-colors -ml-1"
        >
          <ChevronLeft size={22} className="text-slate-800" />
        </button>
        <div>
          <h1 className="text-xl font-semibold text-slate-900 tracking-tight">Plan My Event Wishlist</h1>
          <p className="text-xs text-slate-500">
            {items.length} {items.length === 1 ? "item" : "items"} saved
          </p>
        </div>
      </div>

      <div className="px-4">
        {items.length > 0 ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
            {items.map((item) => {
              const product = item.product || {};
              const price = Number(product.salePrice) > 0 ? Number(product.salePrice) : Number(product.price) || 0;
              const mrp = Number(product.price) || 0;
              const img = resolveImageUrl(product.mainImage || product.galleryImages?.[0]) || FALLBACK_IMG;
              const isOpening = openingId === String(product._id);
              return (
                <div
                  key={product._id}
                  onClick={() => !isOpening && openSeller(item)}
                  className="bg-white rounded-2xl border border-slate-200 overflow-hidden cursor-pointer hover:shadow-md transition-shadow flex flex-col"
                >
                  <div className="relative">
                    <img
                      src={img}
                      alt={product.name}
                      className="w-full h-36 object-cover bg-slate-100"
                      onError={(e) => { e.target.src = FALLBACK_IMG; }}
                    />
                    <button
                      type="button"
                      aria-label="Remove from wishlist"
                      onClick={(e) => { e.stopPropagation(); remove(product._id); }}
                      className="absolute top-2 right-2 w-8 h-8 rounded-full bg-white/95 shadow flex items-center justify-center"
                    >
                      <Heart size={16} className="text-rose-500 fill-rose-500" />
                    </button>
                  </div>
                  <div className="p-3 flex-1 flex flex-col gap-1">
                    <p className="text-sm font-bold text-slate-800 line-clamp-2">{product.name}</p>
                    {(item.seller?.shopName || item.seller?.name) && (
                      <p className="text-[11px] font-semibold text-purple-700 flex items-center gap-1 truncate">
                        <Store size={12} /> {item.seller.shopName || item.seller.name}
                      </p>
                    )}
                    {price > 0 && (
                      <p className="text-sm font-extrabold text-slate-900">
                        ₹{price.toLocaleString("en-IN")}
                        {mrp > price && <span className="ml-1.5 text-[11px] font-medium text-slate-400 line-through">₹{mrp.toLocaleString("en-IN")}</span>}
                      </p>
                    )}
                    <p className="mt-auto pt-1 text-[11px] font-bold text-purple-600">
                      {isOpening ? "Opening…" : "View at seller →"}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="text-center py-16 bg-white rounded-xl border border-slate-200">
            <div className="h-14 w-14 bg-slate-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <Heart size={26} className="text-slate-500" strokeWidth={1.8} />
            </div>
            <h2 className="text-lg font-semibold text-slate-800 mb-1">No items in your Plan My Event wishlist</h2>
            <p className="text-slate-500 text-sm mb-6 max-w-xs mx-auto">
              Tap the ♡ on any event product to save it here.
            </p>
            <button
              onClick={() => navigate("/plan-my-event")}
              className="inline-flex items-center gap-2 bg-purple-600 hover:bg-purple-700 text-white px-5 py-2.5 rounded-xl text-sm font-bold"
            >
              Explore Plan My Event
            </button>
          </div>
        )}
      </div>
      </div>
    </div>
  );
};

export default EventWishlistPage;
