import React, { useState, useMemo, useEffect } from "react";
import Button from "@shared/components/ui/Button";
import Badge from "@shared/components/ui/Badge";
import {
  HiOutlineArrowLeft,
  HiOutlineCube,
  HiOutlineTag,
  HiOutlineCurrencyDollar,
  HiOutlineSwatch,
  HiOutlineFolderOpen,
  HiOutlinePhoto,
  HiOutlineScale,
  HiOutlineArrowPath,
  HiOutlineTrash,
  HiOutlinePlus,
  HiOutlineSquaresPlus,
  HiOutlineXMark,
  HiOutlineMinus,
  HiOutlineCalendar,
  HiOutlineFilm,
  HiOutlineTicket,
} from "react-icons/hi2";
import { useNavigate, useParams } from "react-router-dom";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { sellerApi } from "../services/sellerApi";
import { useAuth } from "@core/context/AuthContext";
import { eventConfigApi } from "../../customer/services/eventConfigApi";

const ToggleSwitch = ({ checked, onChange, label }) => (
  <button
    type="button"
    role="switch"
    aria-label={label}
    aria-checked={Boolean(checked)}
    onClick={onChange}
    style={{
      width: 46,
      minWidth: 46,
      height: 26,
      padding: 3,
      border: 0,
      borderRadius: 9999,
      backgroundColor: checked ? "#dc2626" : "#cbd5e1",
      display: "inline-flex",
      alignItems: "center",
      justifyContent: checked ? "flex-end" : "flex-start",
      flexShrink: 0,
      cursor: "pointer",
      transition: "background-color 150ms ease",
    }}
  >
    <span style={{ width: 20, height: 20, borderRadius: 9999, backgroundColor: "white", boxShadow: "0 1px 3px #0003" }} />
  </button>
);

const isMilestonePaymentMode = (mode) =>
  String(mode?.id || "").toLowerCase() === "milestone" ||
  String(mode?.label || "").toLowerCase().includes("milestone");

const getProfileAdvanceOrderSetting = (profile) => {
  if (!profile) return "";
  const bookingType = profile.bookingType === "one_time" ? "One Time booking" : "Multiple Time booking";
  if (!profile.advanceBookingBufferEnabled) return `${bookingType} · No advance booking buffer set in profile`;
  const buffer = Number(profile.advanceBookingBuffer) || 0;
  const unit = profile.advanceBookingBufferUnit === "hours" ? "hours" : "days";
  return `${bookingType} · ${buffer > 0 ? `Order at least ${buffer} ${unit} before the event` : "No advance order buffer"}`;
};



const MultiInput = ({ value, onChange, placeholder }) => {
  const items = (value || "").split(',').map(s => s.trim());
  if (items.length === 0 || (items.length === 1 && items[0] === "")) {
    items[0] = "";
  }

  const handleChange = (index, val) => {
    const newItems = [...items];
    newItems[index] = val;
    onChange(newItems.join(', '));
  };

  const handleAdd = () => {
    onChange([...items, ""].join(', '));
  };

  const handleRemove = (index) => {
    const newItems = items.filter((_, i) => i !== index);
    if (newItems.length === 0) newItems.push("");
    onChange(newItems.join(', '));
  };

  return (
    <div className="space-y-2">
      {items.map((item, index) => (
        <div key={index} className="flex gap-2 items-center">
          <input
            value={item}
            onChange={(e) => handleChange(index, e.target.value)}
            placeholder={placeholder}
            className="flex-1 px-3 py-2 bg-white ring-1 ring-slate-200 rounded-xl text-xs font-semibold"
          />
          {index === items.length - 1 ? (
            <button type="button" onClick={handleAdd} className="p-1.5 bg-brand-50 text-brand-600 rounded-lg hover:bg-brand-100">
              <HiOutlinePlus className="w-4 h-4" />
            </button>
          ) : (
            <button type="button" onClick={() => handleRemove(index)} className="p-1.5 bg-rose-50 text-rose-600 rounded-lg hover:bg-rose-100">
              <HiOutlineMinus className="w-4 h-4" />
            </button>
          )}
        </div>
      ))}
    </div>
  );
};

const VariantDetails = ({ variant, onChange }) => (
  <div className="col-span-12 border-t border-slate-200 pt-3 mt-1 space-y-4">
    <div className="flex items-center justify-between">
      <label className="text-[10px] font-bold text-slate-600 uppercase tracking-widest">Brand Name & Ingredients</label>
      <ToggleSwitch checked={variant.hasBrandName || variant.hasIngredients} label="Toggle Brand Name & Ingredients" onChange={() => {
        const nextVal = !(variant.hasBrandName || variant.hasIngredients);
        onChange("multiple", { hasBrandName: nextVal, hasIngredients: nextVal });
      }} />
    </div>
    {(variant.hasBrandName || variant.hasIngredients) && (
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="space-y-2">
          <label className="text-[10px] font-bold text-slate-600 uppercase tracking-widest">Brand Name</label>
          <MultiInput value={variant.brand} onChange={(val) => onChange("brand", val)} placeholder="Enter brand name" />
        </div>
        <div className="space-y-2">
          <label className="text-[10px] font-bold text-slate-600 uppercase tracking-widest">Ingredients</label>
          <MultiInput value={variant.ingredients} onChange={(val) => onChange("ingredients", val)} placeholder="Enter ingredients" />
        </div>
      </div>
    )}
  </div>
);

const EditProduct = () => {
  const navigate = useNavigate();
  const { id } = useParams();
  const { user, refreshUser } = useAuth();
  const [sellerBookingProfile, setSellerBookingProfile] = useState(null);
  const profileAdvanceOrderSetting = getProfileAdvanceOrderSetting(sellerBookingProfile);
  console.log("Seller Profile in AddProduct:", user);
  const [modalTab, setModalTab] = useState(() => sessionStorage.getItem('addProductTab') || "general");
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    sessionStorage.setItem('addProductTab', modalTab);
  }, [modalTab]);

  useEffect(() => {
    let cancelled = false;
    sellerApi.getProfile()
      .then((response) => {
        if (!cancelled) setSellerBookingProfile(response.data?.result || null);
      })
      .catch(() => {
        if (!cancelled) setSellerBookingProfile(null);
      });
    return () => { cancelled = true; };
  }, []);
  const [showDetailedInfo, setShowDetailedInfo] = useState(false);
  const [videoPayment, setVideoPayment] = useState(null); // { file, totalAmount, extraMB, razorpayOrder }
  const [videoUploading, setVideoUploading] = useState(false);
  const [selectedModule, setSelectedModule] = useState("");

  const makeSku = (name, index = 1) => {
    const prefix =
      String(name || "")
        .toLowerCase()
        .replace(/[^a-z0-9]/g, "")
        .slice(0, 5) || "item";
    return `${prefix}-${String(index).padStart(3, "0")}`;
  };

  const isAutoSku = (sku, name, index = 1) =>
    String(sku || "").toLowerCase() === makeSku(name, index);

  const [formData, setFormData] = useState({
    name: "",
    slug: "",
    sku: "",
    description: "",
    price: "",
    salePrice: "",
    stock: "",
    lowStockAlert: 5,
    category: "",
    subcategory: "",
    header: "",
    status: "active",
    tags: "",
    weight: "",
    brand: "",
    mainImage: null,
    galleryImages: [],
    videoUrl: "",
    shelfLife: "",
    countryOfOrigin: "",
    fssaiLicense: "",
    hsnId: "",
    colors: [],
    ingredients: "",
    hasBrandName: false,
    hasIngredients: false,
    hasShelfLife: false,
    hasFssaiLicense: false,
    hasBrandName: false,
    hasIngredients: false,
    hasShelfLife: false,
    hasFssaiLicense: false,
    hasExtraDetails: false,
    isDelivery: false,
    isService: false,
    isRental: false,
    isDelivery: false,
    isService: false,
    isRental: false,
    paymentMode: "",
    remainingPaymentTiming: "",
    decorationUploadTime: "",
    minOrderQty: 1,
    maxOrderQty: "",
    advanceOrderSetting: "",
    cancellationPolicy: "",
    ticketingSystem: "",
    tickets: [],
    tickets: [],
    deliveryCoverage: [],
    variants: [
      {
        id: Date.now(),
        name: "",
        price: "",
        salePrice: "",
        stock: "",
        sku: "",
        hasBrandName: false,
        brand: "",
        hasIngredients: false,
        ingredients: "",
      },
    ],
    capacityMin: "",
    capacityMax: "",
    venueAddress: "",
    venueState: "",
    venueCity: "",
    facilities: [],
  });

  const [dbCategories, setDbCategories] = useState([]);
  const [dbHsns, setDbHsns] = useState([]);
  const [dbFacilities, setDbFacilities] = useState([]);
  const [dbPaymentModes, setDbPaymentModes] = useState([]);
  const [dbDeliveryCoverageTypes, setDbDeliveryCoverageTypes] = useState([]);
  const [dbProductColors, setDbProductColors] = useState([]);
  const [isLoadingCats, setIsLoadingCats] = useState(true);

  const sellerModule = useMemo(() => {
    const seller = sellerBookingProfile || user || {};
    if (seller.isEventSeller || seller.planMyEventEnabled) return "plan_my_event";
    if (seller.wholesaleEnabled) return "wholesale";
    if (seller.retailEnabled) return "retail";
    return "";
  }, [sellerBookingProfile, user]);

  useEffect(() => {
    setFormData((prev) => {
      if (!prev.name) return prev;

      const nextSku =
        !prev.sku || isAutoSku(prev.sku, prev.name, 1)
          ? makeSku(prev.name, 1)
          : prev.sku;

      const nextVariants = prev.variants.map((variant, idx) => {
        const variantIndex = idx + 1;
        const shouldAuto =
          !variant.sku || isAutoSku(variant.sku, prev.name, variantIndex);
        return shouldAuto
          ? { ...variant, sku: makeSku(prev.name, variantIndex) }
          : variant;
      });

      const changed =
        nextSku !== prev.sku ||
        nextVariants.some((variant, idx) => variant !== prev.variants[idx]);

      return changed ? { ...prev, sku: nextSku, variants: nextVariants } : prev;
    });
  }, [formData.name]);

  React.useEffect(() => {
    if (refreshUser) {
      refreshUser();
    }
    const fetchData = async () => {
      try {
        const [catRes, hsnRes, facRes, payModesRes, coverageTypesRes, productColorsRes] = await Promise.all([
          sellerApi.getCategoryTree().catch(() => ({ data: { success: false, results: [] } })),
          sellerApi.getActiveHsns().catch(() => ({ data: { success: false, results: [] } })),
          eventConfigApi.getFacilities().catch(() => []),
          eventConfigApi.getPaymentModes().catch(() => []),
          eventConfigApi.getDeliveryCoverageTypes().catch(() => []),
          eventConfigApi.getProductColors().catch(() => [])
        ]);
        if (catRes?.data?.success) {
          setDbCategories(catRes.data.results || catRes.data.result || []);
        }
        if (hsnRes?.data?.success) {
          setDbHsns(hsnRes.data.results || []);
        }
        if (facRes) {
          setDbFacilities(facRes);
        }
        setDbPaymentModes(Array.isArray(payModesRes) ? payModesRes : []);
        setDbDeliveryCoverageTypes(Array.isArray(coverageTypesRes) ? coverageTypesRes : []);
        setDbProductColors(Array.isArray(productColorsRes) ? productColorsRes : []);
      } catch (error) {
        console.error("Categories fetch error:", error);
      }

      // Fetch Product Data separately so category load failure doesn't block product load
      if (id) {
        try {
          const prodRes = await sellerApi.getSellerProductById(id);
          if (prodRes.data?.success) {
            const product = prodRes.data.result || prodRes.data.results;
            setFormData(prev => ({
              ...prev,
              name: product.name || "",
              slug: product.slug || "",
              sku: product.sku || "",
              description: product.description || "",
              price: product.price || "",
              salePrice: product.salePrice || "",
              stock: product.stock || "",
              lowStockAlert: product.lowStockAlert ?? 5,
              brand: product.brand || "",
              weight: product.weight || "",
              status: product.status || "active",
              header: product.headerId?._id || product.headerId || "",
              category: product.categoryId?._id || product.categoryId || "",
              subcategory: product.subcategoryId?._id || product.subcategoryId || "",
              hsnId: product.hsnId?._id || product.hsnId || "",
              tags: Array.isArray(product.tags) ? product.tags.join(", ") : product.tags || "",
              videoUrl: product.videoUrl || "",
              shelfLife: product.shelfLife || "",
              countryOfOrigin: product.countryOfOrigin || "",
              fssaiLicense: product.fssaiLicense || "",
              ingredients: product.ingredients || "",
              hasExtraDetails: product.hasExtraDetails || false,
              hasBrandName: product.hasBrandName || false,
              hasIngredients: product.hasIngredients || false,
              hasShelfLife: product.hasShelfLife || false,
              hasFssaiLicense: product.hasFssaiLicense || false,
              isDelivery: product.isDelivery || false,
              isService: product.isService || false,
              isRental: product.isRental || false,
              paymentMode: product.paymentMode || dbPaymentModes[0]?.id || "",
              remainingPaymentTiming: product.remainingPaymentTiming || "",
              decorationUploadTime: product.decorationUploadTime || "",
              minOrderQty: product.minOrderQty || 1,
              maxOrderQty: product.maxOrderQty || "",
              advanceOrderSetting: product.advanceOrderSetting || "",
              cancellationPolicy: product.cancellationPolicy || "",
              ticketingSystem: product.ticketingSystem || "",
              deliveryCoverage: product.deliveryCoverage || [],
              colors: product.colors || [],
              variants: product.variants?.length
                ? product.variants.map(v => ({ ...v, id: v._id || Date.now() }))
                : prev.variants,
              tickets: product.tickets || [],
              capacityMin: product.capacityMin || "",
              capacityMax: product.capacityMax || "",
              venueAddress: product.venueAddress || "",
              venueState: product.venueState || "",
              venueCity: product.venueCity || "",
              facilities: product.facilities || [],
              mainImage: product.mainImage || null,
              galleryImages: product.galleryImages || [],
            }));
          }
        } catch (error) {
          console.error("Product fetch error:", error);
          toast.error("Failed to load product data");
        }
      }

      setIsLoadingCats(false);
    };
    fetchData();
  }, [id]);

  const isCategoryMatchingModule = (cat, mod, inheritedMatch = false) => {
    if (!mod) return true;
    const mods = Array.isArray(cat.applicableModules) ? cat.applicableModules : [];
    const matches = mods.includes(mod) || (inheritedMatch && mods.length === 0);
    return matches || (Array.isArray(cat.children) && cat.children.some((child) => isCategoryMatchingModule(child, mod, matches)));
  };

  const getFilteredList = (list, mod, parentMatches = false) => {
    if (!list || !Array.isArray(list)) return [];
    if (!mod) return list;
    return list.filter((c) => isCategoryMatchingModule(c, mod, parentMatches));
  };

  const filteredCategories = useMemo(() => {
    return getFilteredList(dbCategories, selectedModule);
  }, [dbCategories, selectedModule]);

  const categories = filteredCategories;

  const dynamicModules = useMemo(() => {
    const modules = new Set();
    const extractModules = (cats) => {
      cats.forEach(c => {
        if (c.applicableModules && Array.isArray(c.applicableModules)) {
          c.applicableModules.forEach(m => modules.add(m));
        }
        if (c.children && Array.isArray(c.children)) {
          extractModules(c.children);
        }
      });
    };
    if (dbCategories && Array.isArray(dbCategories)) {
      extractModules(dbCategories);
    }

    const availableModules = Array.from(modules);
    availableModules.sort();

    return availableModules.map(mod => {
      if (mod === 'retail') return { value: mod, label: 'Retail / Groceries' };
      if (mod === 'wholesale') return { value: mod, label: 'Wholesale' };
      if (mod === 'plan_my_event') return { value: mod, label: 'Plan My Event' };
      return { value: mod, label: mod.split('_').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ') };
    });
  }, [dbCategories]);

  useEffect(() => {
    if (selectedModule) return;
    const defaultModule = dynamicModules.some((module) => module.value === sellerModule)
      ? sellerModule
      : dynamicModules.length === 1 ? dynamicModules[0].value : "";
    if (defaultModule) setSelectedModule(defaultModule);
  }, [sellerModule, dynamicModules, selectedModule]);

  const handleSave = async () => {
    const tickets = (formData.tickets || []).filter((ticket) => String(ticket.name || "").trim());
    const productName = formData.name?.trim() || tickets[0]?.name?.trim() || "";
    if (!productName) {
      toast.error("Product name ya kam se kam ek ticket name add karein");
      return;
    }

    setIsSaving(true);
    try {
      const data = new FormData();

      // Basic fields
      data.append("name", productName);
      data.append("slug", formData.slug);
      data.append("sku", formData.sku);
      data.append("description", formData.description);
      data.append("brand", formData.brand);
      data.append("weight", formData.weight);
      data.append("status", formData.status);

      const variants = (formData.variants || []).filter((variant) =>
        variant.name || variant.price !== "" || variant.stock !== ""
      );
      const firstVariant = variants[0] || {};
      const firstTicket = tickets[0] || {};
      data.append("price", firstVariant.price !== undefined && firstVariant.price !== "" ? firstVariant.price : (formData.price || firstTicket.price || 0));
      data.append("salePrice", firstVariant.salePrice !== undefined && firstVariant.salePrice !== "" ? firstVariant.salePrice : (formData.salePrice || firstTicket.salePrice || 0));
      data.append("stock", firstVariant.stock !== undefined && firstVariant.stock !== "" ? firstVariant.stock : (formData.stock || firstTicket.capacity || 0));


      // Category IDs â€” sirf tab append karo jab value ho (empty string ObjectId error deta hai)
      if (formData.header) data.append("headerId", formData.header);
      if (formData.category) data.append("categoryId", formData.category);
      if (formData.subcategory) data.append("subcategoryId", formData.subcategory);

      // Tags
      data.append("tags", formData.tags);
      data.append("videoUrl", formData.videoUrl || "");
      data.append("shelfLife", formData.shelfLife || "");
      data.append("countryOfOrigin", formData.countryOfOrigin || "");
      data.append("fssaiLicense", formData.fssaiLicense || "");
      data.append("ingredients", formData.ingredients || "");
      data.append("lowStockAlert", formData.lowStockAlert || 5);
      data.append("hasExtraDetails", formData.hasExtraDetails);

      data.append("hasBrandName", formData.hasBrandName);
      data.append("hasIngredients", formData.hasIngredients);
      data.append("hasShelfLife", formData.hasShelfLife);
      data.append("hasFssaiLicense", formData.hasFssaiLicense);

      if (formData.hsnId) {
        data.append("hsnId", formData.hsnId);
      }

      // Images
      if (formData.mainImageFile) {
        data.append("mainImage", formData.mainImageFile);
      }

      if (formData.galleryFiles && formData.galleryFiles.length > 0) {
        formData.galleryFiles.forEach(file => {
          data.append("galleryImages", file);
        });
      }

      // Variants and Tickets
      data.append("variants", JSON.stringify(variants));
      data.append("tickets", JSON.stringify(tickets));

      // Delivery Coverage & Colors
      data.append("deliveryCoverage", JSON.stringify(formData.deliveryCoverage));
      data.append("colors", JSON.stringify(formData.colors));

      // Payment & Advanced Order Settings
      data.append("isDelivery", formData.isDelivery);
      data.append("isService", formData.isService);
      data.append("isRental", formData.isRental);
      data.append("paymentMode", formData.paymentMode || "");
      data.append("remainingPaymentTiming", formData.remainingPaymentTiming || "");
      data.append("decorationUploadTime", formData.decorationUploadTime || "");
      data.append("minOrderQty", formData.minOrderQty || 1);
      data.append("maxOrderQty", formData.maxOrderQty || "");
      data.append("advanceOrderSetting", profileAdvanceOrderSetting || formData.advanceOrderSetting || "");
      data.append("cancellationPolicy", formData.cancellationPolicy || "");
      data.append("ticketingSystem", formData.ticketingSystem || "");

      // Venue Info Appends
      data.append("capacityMin", formData.capacityMin || 0);
      data.append("capacityMax", formData.capacityMax || 0);
      data.append("venueAddress", formData.venueAddress || "");
      data.append("venueState", formData.venueState || "");
      data.append("venueCity", formData.venueCity || "");
      data.append("facilities", JSON.stringify(formData.facilities || []));

      const response = await sellerApi.updateProduct(id, data);
      const approvalStatus = response?.data?.result?.approvalStatus;
      if (approvalStatus === "pending") {
        toast.success("Product updated and submitted for admin approval");
      } else {
        toast.success(response?.data?.message || "Product updated successfully!");
      }
      navigate("/seller/products");
    } catch (error) {
      toast.error(error.response?.data?.message || "Failed to save product");
    } finally {
      setIsSaving(false);
    }
  };

  const handleImageUpload = (e, type) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      const reader = new FileReader();
      reader.onloadend = () => {
        if (type === "main") {
          setFormData({
            ...formData,
            mainImage: reader.result,
            mainImageFile: file
          });
        } else {
          setFormData({
            ...formData,
            galleryImages: [...formData.galleryImages, reader.result],
            galleryFiles: [...(formData.galleryFiles || []), file]
          });
        }
      };
      reader.readAsDataURL(file);
    }
  };

  const executeVideoUpload = async (file, paymentParams = {}) => {
    const uploadToast = toast.loading('Uploading video...');
    setVideoUploading(true);
    try {
      const uploadData = new FormData();
      uploadData.append('video', file);

      if (paymentParams.paymentMethod) {
        uploadData.append('paymentMethod', paymentParams.paymentMethod);
      }
      if (paymentParams.razorpay_order_id) {
        uploadData.append('razorpay_order_id', paymentParams.razorpay_order_id);
      }
      if (paymentParams.razorpay_payment_id) {
        uploadData.append('razorpay_payment_id', paymentParams.razorpay_payment_id);
      }
      if (paymentParams.razorpay_signature) {
        uploadData.append('razorpay_signature', paymentParams.razorpay_signature);
      }

      const uploadRes = await sellerApi.uploadVideo(uploadData);

      if (uploadRes.data.success) {
        toast.success('Video uploaded successfully!', { id: uploadToast });
        setFormData({ ...formData, videoUrl: uploadRes.data.videoUrl });
        setVideoPayment(null);
      }
    } catch (error) {
      console.error("Video upload error:", error);
      toast.error(error.response?.data?.message || "Failed to upload video", { id: uploadToast });
    } finally {
      setVideoUploading(false);
    }
  };

  const handleVideoUpload = async (e) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      const fileSizeMB = file.size / (1024 * 1024);

      const checkToast = toast.loading('Checking storage limits...');

      try {
        const intentRes = await sellerApi.checkVideoUploadIntent({ fileSizeMB });
        toast.dismiss(checkToast);

        const { requiresPayment, totalAmount, mbToCharge, razorpayOrder } = intentRes.data;

        if (requiresPayment) {
          setVideoPayment({
            file,
            totalAmount,
            mbToCharge,
            razorpayOrder
          });
        } else {
          await executeVideoUpload(file);
        }
      } catch (error) {
        toast.dismiss(checkToast);
        console.error("Intent check error:", error);
        toast.error("Failed to check storage limits");
      }
    }
  };

  const handleVideoPayCOD = async () => {
    if (!videoPayment) return;
    await executeVideoUpload(videoPayment.file, { paymentMethod: 'COD' });
  };

  const handleVideoPayRazorpay = async () => {
    if (!videoPayment || !videoPayment.razorpayOrder) return;
    try {
      const order = videoPayment.razorpayOrder;
      const options = {
        key: import.meta.env.VITE_RAZORPAY_KEY_ID,
        amount: order.amount,
        currency: order.currency,
        name: 'Jalapino',
        description: 'Extra Storage Payment',
        order_id: order.id,
        handler: async (response) => {
          await executeVideoUpload(videoPayment.file, {
            paymentMethod: 'Razorpay',
            razorpay_order_id: response.razorpay_order_id,
            razorpay_payment_id: response.razorpay_payment_id,
            razorpay_signature: response.razorpay_signature,
          });
        },
        prefill: {},
        theme: { color: '#E11D48' },
      };
      const rzp = new window.Razorpay(options);
      rzp.open();
    } catch (err) {
      toast.error('Failed to initiate online payment');
    }
  };

  return (
    <>
      <div className="max-w-6xl mx-auto space-y-6 pb-12">
        {/* Header */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <Button
            variant="ghost"
            className="pl-0 hover:bg-transparent hover:text-primary-600"
            onClick={() => navigate(-1)}>
            <HiOutlineArrowLeft className="mr-2 h-5 w-5" />
            Back to Products
          </Button>
          <div className="flex gap-3">
            <Button variant="outline" onClick={() => navigate(-1)}>
              Cancel
            </Button>
            <Button
              onClick={handleSave}
              disabled={isSaving}
              className="min-w-[140px]">
              {isSaving ? (
                <>
                  <HiOutlineArrowPath className="mr-2 h-5 w-5 animate-spin" />
                  Publishing...
                </>
              ) : (
                "Save & Publish"
              )}
            </Button>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-xl overflow-hidden flex flex-col md:flex-row min-h-[600px] border border-slate-100">
          {/* Sidebar Tabs */}
          <div className="md:w-64 bg-slate-50/50 border-r border-slate-100 p-4 space-y-1 overflow-y-auto">
            {[
              { id: "general", label: "General Info", icon: HiOutlineTag },
              { id: "variants", label: "Item Variants", icon: HiOutlineSwatch },
              { id: "category", label: "Groups", icon: HiOutlineFolderOpen },
              { id: "media", label: "Photos", icon: HiOutlinePhoto },
              ...(user?.ticketSystemEnabled ? [{ id: "tickets", label: "Tickets", icon: HiOutlineTicket }] : []),
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setModalTab(tab.id)}
                className={cn(
                  "w-full flex items-center space-x-3 px-4 py-3 rounded-md text-xs font-bold transition-all text-left",
                  modalTab === tab.id
                    ? "bg-white text-primary shadow-sm ring-1 ring-slate-100"
                    : "text-slate-600 hover:bg-slate-100",
                )}>
                <tab.icon className="h-4 w-4" />
                <span>{tab.label}</span>
              </button>
            ))}

            <div className="pt-8 px-4">
              <div className="p-4 bg-brand-50 rounded-md border border-brand-100">
                <p className="text-[9px] font-bold text-brand-600 uppercase tracking-widest mb-1">
                  Status
                </p>
                <select
                  value={formData.status}
                  onChange={(e) =>
                    setFormData({ ...formData, status: e.target.value })
                  }
                  className="w-full bg-transparent border-none text-xs font-bold text-brand-700 outline-none p-0 cursor-pointer focus:ring-0">
                  <option value="active">PUBLISHED</option>
                  <option value="inactive">DRAFT</option>
                </select>
              </div>
            </div>
          </div>

          {/* Content Area */}
          <div className="flex-1 p-8 overflow-y-auto">
            {modalTab === "general" && (
              <div className="space-y-6 animate-in fade-in slide-in-from-right-2 duration-300">
                <div className="space-y-1.5 flex flex-col relative">
                  <label className="text-[10px] sm:text-xs font-bold text-slate-600 uppercase tracking-widest ml-1">
                    Product Title
                  </label>
                  <input
                    value={formData.name}
                    disabled={!user?.allowCustomProductEntry}
                    onChange={(e) => {
                      const nextName = e.target.value;
                      setFormData((prev) => ({
                        ...prev,
                        name: nextName,
                        sku:
                          !prev.sku || isAutoSku(prev.sku, prev.name, 1)
                            ? makeSku(nextName, 1)
                            : prev.sku,
                        variants: prev.variants.map((variant, idx) => {
                          const variantIndex = idx + 1;
                          const shouldAuto =
                            !variant.sku ||
                            isAutoSku(variant.sku, prev.name, variantIndex);
                          return shouldAuto
                            ? { ...variant, sku: makeSku(nextName, variantIndex) }
                            : variant;
                        }),
                      }));
                    }}
                    className={`w-full px-4 py-2.5 border-none rounded-md text-sm font-semibold outline-none ring-primary/5 focus:ring-2 transition-all ${!user?.allowCustomProductEntry
                      ? "bg-slate-200 cursor-not-allowed text-slate-500"
                      : "bg-slate-100"
                      }`}
                    placeholder={!user?.allowCustomProductEntry ? "Contact Admin to allow custom entry" : "e.g. Premium Basmati Rice"}
                  />
                </div>
                <div className="space-y-1.5 flex flex-col">
                  <label className="text-[10px] sm:text-xs font-bold text-slate-600 uppercase tracking-widest ml-1">
                    About this item
                  </label>
                  <textarea
                    value={formData.description}
                    onChange={(e) =>
                      setFormData({ ...formData, description: e.target.value })
                    }
                    onWheel={(e) => e.stopPropagation()}
                    onTouchMove={(e) => e.stopPropagation()}
                    className="w-full px-4 py-3 bg-slate-100 border-none rounded-2xl text-sm font-semibold min-h-[160px] max-h-[260px] outline-none transition-all focus:ring-2 focus:ring-primary/5 resize-none overflow-y-auto custom-scrollbar"
                    placeholder="Describe the item here..."
                  />
                </div>

                {/* Location Coverage Type */}
                {(() => {
                  const coverageOptions = dbDeliveryCoverageTypes.filter(({ id }) => ["hyperlocal", "pan_india", "zone_wise"].includes(id)).map(opt => {
                    let label = opt.label;
                    if (opt.id === "hyperlocal") label = "HYPERLOCAL";
                    if (opt.id === "pan_india") label = "PANINDIA";
                    if (opt.id === "zone_wise") label = "ZONE WISE";
                    return { ...opt, label };
                  });
                  const coverageIds = coverageOptions.map(o => o.id);
                  const selectedCoverage = formData.deliveryCoverage.find(c => coverageIds.includes(c)) || "";
                  return (
                    <div className="space-y-3 p-4 bg-slate-50 border border-slate-100 rounded-xl">
                      <div>
                        <h4 className="text-sm font-bold text-slate-700">Location Coverage Type</h4>
                        <p className="text-[10px] sm:text-xs text-slate-500 font-medium mt-1">Select your product's delivery reach.</p>
                      </div>
                      <div className="flex flex-col gap-2">
                        {coverageOptions.map((opt) => (
                          <label
                            key={opt.id}
                            className={`flex items-center gap-3 px-4 py-3 rounded-lg border-2 cursor-pointer transition-all ${selectedCoverage === opt.id
                              ? "border-brand-500 bg-brand-50"
                              : "border-slate-200 bg-white hover:border-slate-300"
                              }`}
                          >
                            <input
                              type="radio"
                              name="deliveryCoverageType"
                              value={opt.id}
                              checked={selectedCoverage === opt.id}
                              onChange={() => {
                                setFormData((prev) => {
                                  const others = prev.deliveryCoverage.filter(c => !coverageIds.includes(c));
                                  return { ...prev, deliveryCoverage: [...others, opt.id] };
                                });
                              }}
                              className="accent-brand-500 w-4 h-4 cursor-pointer"
                            />
                            <div className="flex flex-col">
                              <span className={`text-xs font-bold uppercase tracking-wider ${selectedCoverage === opt.id ? "text-brand-700" : "text-slate-700"}`}>{opt.label}</span>
                              <span className="text-[10px] font-medium opacity-60">{opt.desc}</span>
                            </div>
                          </label>
                        ))}
                      </div>
                    </div>
                  );
                })()}



                {/* Delivery Type Toggles */}
                <div className="space-y-4 p-4 bg-slate-50 border border-slate-100 rounded-xl">
                  <div>
                    <h4 className="text-sm font-bold text-slate-700">Delivery Type</h4>
                    <p className="text-[10px] sm:text-xs text-slate-500 font-medium mt-1">Select all applicable types for this item.</p>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="flex justify-between items-center w-full bg-white p-3 border border-slate-200 rounded-lg">
                      <label className="text-[10px] sm:text-xs font-bold text-slate-600 uppercase tracking-widest ml-1">
                        Delivery
                      </label>
                      <label className="relative inline-flex items-center cursor-pointer">
                        <input type="checkbox" className="sr-only peer" checked={formData.isDelivery} onChange={(e) => setFormData({ ...formData, isDelivery: e.target.checked })} />
                        <div className="w-8 h-4 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-3 after:w-3 after:transition-all peer-checked:bg-red-500"></div>
                      </label>
                    </div>
                    <div className="flex justify-between items-center w-full bg-white p-3 border border-slate-200 rounded-lg">
                      <label className="text-[10px] sm:text-xs font-bold text-slate-600 uppercase tracking-widest ml-1">
                        Service
                      </label>
                      <label className="relative inline-flex items-center cursor-pointer">
                        <input type="checkbox" className="sr-only peer" checked={formData.isService} onChange={(e) => setFormData({ ...formData, isService: e.target.checked })} />
                        <div className="w-8 h-4 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-3 after:w-3 after:transition-all peer-checked:bg-red-500"></div>
                      </label>
                    </div>
                    <div className="flex justify-between items-center w-full bg-white p-3 border border-slate-200 rounded-lg">
                      <label className="text-[10px] sm:text-xs font-bold text-slate-600 uppercase tracking-widest ml-1">
                        Rental
                      </label>
                      <label className="relative inline-flex items-center cursor-pointer">
                        <input type="checkbox" className="sr-only peer" checked={formData.isRental} onChange={(e) => setFormData({ ...formData, isRental: e.target.checked })} />
                        <div className="w-8 h-4 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-3 after:w-3 after:transition-all peer-checked:bg-red-500"></div>
                      </label>
                    </div>
                  </div>
                </div>

                {/* Conditional Delivery Availability Blocks */}
                {(formData.isDelivery || formData.isService || formData.isRental) && (
                  <div className="space-y-4 flex flex-col p-4 bg-slate-50 border border-slate-100 rounded-xl">
                    {formData.isDelivery && (
                      <div className="space-y-2">
                        <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-2">
                          Courier/Delivery Type (Delivery)
                        </p>
                        <div className="flex flex-wrap gap-4">
                          {[
                            { id: "self_delivery", label: "Self Delivery" },
                            { id: "hyperlocal", label: "Hyperlocal service delivery" },
                            { id: "pan_india", label: "Pan India (Courier Delivery)" },
                            { id: "jalapino_rider", label: "Jalpaino Rider Delivery" },
                            { id: "none", label: "No Delivery (In-Store Pickup Only)" },
                          ].map((option) => {
                            const alwaysAllowed = ["none", "self_delivery", "jalapino_rider", "pan_india"];
                            const isAllowedBySeller = user?.serviceCoverage?.includes(option.id) || alwaysAllowed.includes(option.id);
                            if (!isAllowedBySeller) return null;
                            const isSelected = formData.deliveryCoverage.includes(option.id);
                            return (
                              <label key={`delivery_${option.id}`} className="flex items-center gap-2 cursor-pointer select-none bg-white px-3 py-2 border border-slate-200 rounded-lg hover:border-brand-300 transition-colors">
                                <input
                                  type="checkbox"
                                  checked={isSelected}
                                  onChange={() => {
                                    setFormData((prev) => {
                                      const current = prev.deliveryCoverage;
                                      const next = current.includes(option.id) ? current.filter((c) => c !== option.id) : [...current, option.id];
                                      return { ...prev, deliveryCoverage: next };
                                    });
                                  }}
                                  className="w-4 h-4 accent-brand-500 cursor-pointer"
                                />
                                <span className="text-sm font-semibold text-slate-700">{option.label}</span>
                              </label>
                            );
                          })}
                        </div>
                      </div>
                    )}

                    {formData.isService && (
                      <div className="space-y-2 mt-4 pt-4 border-t border-slate-200">
                        <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-2">
                          Service Delivery Option
                        </p>
                        <div className="flex flex-wrap gap-4">
                          <label className="flex items-center gap-2 cursor-pointer select-none bg-white px-3 py-2 border border-slate-200 rounded-lg hover:border-brand-300 transition-colors">
                            <input
                              type="checkbox"
                              checked={formData.deliveryCoverage.includes("self_delivery")}
                              onChange={() => {
                                setFormData((prev) => {
                                  const current = prev.deliveryCoverage;
                                  const next = current.includes("self_delivery") ? current.filter((c) => c !== "self_delivery") : [...current, "self_delivery"];
                                  return { ...prev, deliveryCoverage: next };
                                });
                              }}
                              className="w-4 h-4 accent-brand-500 cursor-pointer"
                            />
                            <span className="text-sm font-semibold text-slate-700">Self Delivery</span>
                          </label>
                        </div>
                      </div>
                    )}

                    {formData.isRental && (
                      <div className="space-y-2 mt-4 pt-4 border-t border-slate-200">
                        <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-2">
                          Rental Delivery Option
                        </p>
                        <div className="flex flex-wrap gap-4">
                          <label className="flex items-center gap-2 cursor-pointer select-none bg-white px-3 py-2 border border-slate-200 rounded-lg hover:border-brand-300 transition-colors">
                            <input
                              type="checkbox"
                              checked={formData.deliveryCoverage.includes("self_delivery")}
                              onChange={() => {
                                setFormData((prev) => {
                                  const current = prev.deliveryCoverage;
                                  const next = current.includes("self_delivery") ? current.filter((c) => c !== "self_delivery") : [...current, "self_delivery"];
                                  return { ...prev, deliveryCoverage: next };
                                });
                              }}
                              className="w-4 h-4 accent-brand-500 cursor-pointer"
                            />
                            <span className="text-sm font-semibold text-slate-700">Self Delivery</span>
                          </label>
                        </div>
                      </div>
                    )}

                    {formData.deliveryCoverage.length === 0 && (
                      <p className="text-xs text-red-500 font-semibold mt-1">Please select at least one delivery option.</p>
                    )}
                  </div>
                )}

                {/* Payment Mode */}
                <div className="space-y-2 flex flex-col p-4 bg-slate-50 border border-slate-100 rounded-xl">
                  <label className="text-[10px] sm:text-xs font-bold text-slate-600 uppercase tracking-widest">
                    Payment Mode
                  </label>
                  <div className="flex flex-col gap-3 mt-1">
                    {dbPaymentModes.map((mode) => (
                      <div
                        key={mode.id}
                        className="flex items-center gap-3 cursor-pointer select-none"
                        onClick={() => setFormData((prev) => ({
                          ...prev,
                          paymentMode: mode.id,
                          remainingPaymentTiming: isMilestonePaymentMode(mode) ? prev.remainingPaymentTiming : "",
                        }))}
                      >
                        <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center transition-colors ${formData.paymentMode === mode.id ? "border-primary bg-primary/10" : "border-slate-300 bg-white"
                          }`}>
                          {formData.paymentMode === mode.id && <div className="w-2.5 h-2.5 bg-primary rounded-full" />}
                        </div>
                        <span className="text-sm font-semibold text-slate-700">{mode.label}</span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Advanced Order & Payment Settings */}
                <div className="space-y-4 p-4 bg-white border border-slate-200 rounded-xl">
                  <div>
                    <h4 className="text-sm font-bold text-slate-700">Advanced Order & Payment Settings</h4>
                    <p className="text-[10px] sm:text-xs text-slate-500 font-medium mt-1">Configure advanced options for this product.</p>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {isMilestonePaymentMode(dbPaymentModes.find((mode) => mode.id === formData.paymentMode)) && (
                      <div className="space-y-1.5 flex flex-col">
                        <label className="text-[10px] sm:text-xs font-bold text-slate-600 uppercase tracking-widest ml-1">Remaining Payment Timing</label>
                        <input
                          value={formData.remainingPaymentTiming}
                          onChange={(e) => setFormData({ ...formData, remainingPaymentTiming: e.target.value })}
                          className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-md text-sm font-semibold outline-none focus:ring-2 focus:ring-brand-500 transition-all"
                          placeholder="e.g. 2 days before event"
                        />
                      </div>
                    )}









                    <div className="space-y-1.5 flex flex-col">
                      <label className="text-[10px] sm:text-xs font-bold text-slate-600 uppercase tracking-widest ml-1">Minimum Order Qty</label>
                      <input
                        type="number"
                        min="1"
                        value={formData.minOrderQty}
                        onChange={(e) => setFormData({ ...formData, minOrderQty: parseInt(e.target.value) || 1 })}
                        className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-md text-sm font-semibold outline-none focus:ring-2 focus:ring-brand-500 transition-all"
                      />
                    </div>
                    <div className="space-y-1.5 flex flex-col">
                      <label className="text-[10px] sm:text-xs font-bold text-slate-600 uppercase tracking-widest ml-1">Maximum Order Qty (Optional)</label>
                      <input
                        type="number"
                        min="1"
                        value={formData.maxOrderQty}
                        onChange={(e) => setFormData({ ...formData, maxOrderQty: parseInt(e.target.value) || "" })}
                        className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-md text-sm font-semibold outline-none focus:ring-2 focus:ring-brand-500 transition-all"
                        placeholder="e.g. 100"
                      />
                    </div>
                    <div className="space-y-1.5 flex flex-col">
                      <label className="text-[10px] sm:text-xs font-bold text-slate-600 uppercase tracking-widest ml-1">Advance Order Setting</label>
                      <input
                        value={profileAdvanceOrderSetting || formData.advanceOrderSetting}
                        onChange={(e) => setFormData({ ...formData, advanceOrderSetting: e.target.value })}
                        readOnly={Boolean(profileAdvanceOrderSetting)}
                        className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-md text-sm font-semibold outline-none focus:ring-2 focus:ring-brand-500 transition-all"
                        placeholder="e.g. Order 48 hrs prior"
                      />
                    </div>
                  </div>
                  <div className="space-y-1.5 flex flex-col mt-4">
                    <label className="text-[10px] sm:text-xs font-bold text-slate-600 uppercase tracking-widest ml-1">Cancellation & Refund Process</label>
                    <textarea
                      value={formData.cancellationPolicy}
                      onChange={(e) => setFormData({ ...formData, cancellationPolicy: e.target.value })}
                      className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-semibold min-h-[80px] outline-none transition-all focus:ring-2 focus:ring-brand-500 resize-none"
                      placeholder="Describe cancellation timings and refund percentages..."
                    />
                  </div>
                </div>

                {/* Extra Details Toggle */}
                <div
                  className="flex items-center justify-between p-4 bg-white border border-slate-200 rounded-xl cursor-pointer hover:border-brand-300 transition-colors"
                  onClick={() => setShowDetailedInfo(!showDetailedInfo)}
                >
                  <div>
                    <h4 className="text-sm font-bold text-slate-700">Add Detailed Product Info</h4>
                    <p className="text-[10px] sm:text-xs text-slate-500 font-medium">FSSAI, Shelf Life, Origin (Optional)</p>
                  </div>
                  <button
                    type="button"
                    className={`w-8 h-8 flex items-center justify-center rounded-full bg-slate-50 text-slate-500 hover:bg-slate-100 transition-transform ${showDetailedInfo ? 'rotate-180' : ''}`}
                  >
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <polyline points="6 9 12 15 18 9"></polyline>
                    </svg>
                  </button>
                </div>

                {showDetailedInfo && (
                  <div className="space-y-6 animate-in fade-in slide-in-from-top-2 duration-300">
                    <div className="grid grid-cols-1 gap-6">
                      <div className="space-y-1.5 flex flex-col">
                        <label className="text-[10px] sm:text-xs font-bold text-slate-600 uppercase tracking-widest ml-1">
                          Product Code
                        </label>
                        <input
                          value={formData.sku}
                          onChange={(e) =>
                            setFormData({ ...formData, sku: e.target.value })
                          }
                          className="w-full px-4 py-2.5 bg-slate-100 border-none rounded-md text-sm font-mono font-bold outline-none ring-primary/5 focus:ring-2 transition-all"
                          placeholder="AUTO-GENERATED"
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                      <div className="space-y-1.5 flex flex-col">
                        <div className="flex justify-between items-center w-full">
                          <label className="text-[10px] sm:text-xs font-bold text-slate-600 uppercase tracking-widest ml-1">
                            Shelf Life
                          </label>
                          <label className="relative inline-flex items-center cursor-pointer">
                            <input type="checkbox" className="sr-only peer" checked={formData.hasShelfLife} onChange={(e) => setFormData({ ...formData, hasShelfLife: e.target.checked })} />
                            <div className="w-8 h-4 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-3 after:w-3 after:transition-all peer-checked:bg-red-500"></div>
                          </label>
                        </div>
                        {formData.hasShelfLife && (
                          <input
                            value={formData.shelfLife}
                            onChange={(e) =>
                              setFormData({ ...formData, shelfLife: e.target.value })
                            }
                            className="w-full px-4 py-2.5 bg-slate-100 border-none rounded-md text-sm font-semibold outline-none ring-primary/5 focus:ring-2 transition-all"
                            placeholder="e.g. 3 Days"
                          />
                        )}
                      </div>
                      <div className="space-y-1.5 flex flex-col">
                        <label className="text-[10px] sm:text-xs font-bold text-slate-600 uppercase tracking-widest ml-1">
                          Country of Origin
                        </label>
                        <input
                          value={formData.countryOfOrigin}
                          onChange={(e) =>
                            setFormData({ ...formData, countryOfOrigin: e.target.value })
                          }
                          className="w-full px-4 py-2.5 bg-slate-100 border-none rounded-md text-sm font-semibold outline-none ring-primary/5 focus:ring-2 transition-all"
                          placeholder="e.g. India"
                        />
                      </div>
                      <div className="space-y-1.5 flex flex-col">
                        <div className="flex justify-between items-center w-full">
                          <label className="text-[10px] sm:text-xs font-bold text-slate-600 uppercase tracking-widest ml-1">
                            FSSAI License
                          </label>
                          <label className="relative inline-flex items-center cursor-pointer">
                            <input type="checkbox" className="sr-only peer" checked={formData.hasFssaiLicense} onChange={(e) => setFormData({ ...formData, hasFssaiLicense: e.target.checked })} />
                            <div className="w-8 h-4 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-3 after:w-3 after:transition-all peer-checked:bg-red-500"></div>
                          </label>
                        </div>
                        {formData.hasFssaiLicense && (
                          <input
                            value={formData.fssaiLicense}
                            onChange={(e) =>
                              setFormData({ ...formData, fssaiLicense: e.target.value })
                            }
                            className="w-full px-4 py-2.5 bg-slate-100 border-none rounded-md text-sm font-semibold outline-none ring-primary/5 focus:ring-2 transition-all"
                            placeholder="e.g. 1001234567890"
                          />
                        )}
                      </div>
                    </div>
                  </div>
                )}

                {/* Colors Section */}
                <div className="space-y-1.5 flex flex-col">
                  <div className="flex items-center justify-between ml-1 mb-2">
                    <label className="text-[10px] sm:text-xs font-bold text-slate-600 uppercase tracking-widest">
                    Product Colors (Optional)
                    </label>
                    <ToggleSwitch 
                      checked={formData.hasCustomColors} 
                      onChange={() => setFormData({ ...formData, hasCustomColors: !formData.hasCustomColors })}
                      label="Toggle Custom Colors"
                    />
                  </div>
                  <div className="p-4 bg-slate-50 border border-slate-100 rounded-xl space-y-3">
                    <div className="flex flex-wrap gap-2">
                      {dbProductColors.map((colorOption) => {
                        const color = typeof colorOption === "string" ? colorOption : colorOption.name || colorOption.value || colorOption.id;
                        const isSelected = formData.colors.includes(color);
                        return (
                          <button
                            key={color}
                            type="button"
                            onClick={() => {
                              setFormData((prev) => {
                                const nextColors = isSelected
                                  ? prev.colors.filter(c => c !== color)
                                  : [...prev.colors, color];
                                return { ...prev, colors: nextColors };
                              });
                            }}
                            className={`px-3 py-1.5 text-xs font-bold rounded-full border transition-all ${isSelected
                              ? "bg-brand-50 border-brand-500 text-brand-700 shadow-sm"
                              : "bg-white border-slate-200 text-slate-600 hover:border-slate-300"
                              }`}
                          >
                            {color}
                          </button>
                        );
                      })}
                    </div>
                    {formData.hasCustomColors && (
                      <div className="flex gap-2 items-center">
                      <input
                        type="color"
                        id="visualColorPicker"
                        className="w-10 h-10 p-1 bg-white ring-1 ring-slate-200 border-none rounded-lg cursor-pointer"
                        defaultValue="#000000"
                      />
                      <input
                        type="text"
                        id="customColorInput"
                        placeholder="Type custom color or select hex..."
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            e.preventDefault();
                            const val = e.target.value.trim() || document.getElementById("visualColorPicker").value;
                            if (val && !formData.colors.includes(val)) {
                              setFormData(prev => ({ ...prev, colors: [...prev.colors, val] }));
                            }
                            e.target.value = '';
                          }
                        }}
                        className="flex-1 px-3 py-2 bg-white ring-1 ring-slate-200 border-none rounded-lg text-xs font-semibold outline-none focus:ring-2 focus:ring-brand-500"
                      />
                      <button
                        type="button"
                        onClick={() => {
                          const input = document.getElementById("customColorInput");
                          const picker = document.getElementById("visualColorPicker");
                          const val = input.value.trim() || picker.value;
                          if (val && !formData.colors.includes(val)) {
                            setFormData(prev => ({ ...prev, colors: [...prev.colors, val] }));
                          }
                          input.value = '';
                        }}
                        className="px-4 py-2 bg-slate-900 text-white rounded-lg text-xs font-bold"
                      >
                        ADD
                      </button>
                      </div>
                    )}
                    {formData.colors.length > 0 && (
                      <div className="flex flex-wrap gap-2 pt-2 border-t border-slate-200">
                        {formData.colors.filter(c => !dbProductColors.some(option => (typeof option === "string" ? option : option.name || option.value || option.id) === c)).map(color => {
                          const isHex = /^#[0-9A-F]{6}$/i.test(color);
                          return (
                            <div key={color} className="flex items-center gap-1.5 bg-white border border-slate-200 text-slate-700 px-2 py-1.5 rounded-md text-[10px] font-bold shadow-sm">
                              {isHex && <span className="w-3 h-3 rounded-full border border-slate-300" style={{ backgroundColor: color }}></span>}
                              <span>{color}</span>
                              <button type="button" className="ml-1 text-slate-400 hover:text-rose-500" onClick={() => setFormData(prev => ({ ...prev, colors: prev.colors.filter(c => c !== color) }))}>
                                <HiOutlineXMark className="h-3.5 w-3.5" />
                              </button>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-1.5 flex flex-col">
                    <label className="text-[10px] sm:text-xs font-bold text-slate-600 uppercase tracking-widest ml-1">
                      HSN Code / GST
                    </label>
                    <select
                      value={formData.hsnId}
                      onChange={(e) =>
                        setFormData({ ...formData, hsnId: e.target.value })
                      }
                      className="w-full px-4 py-2.5 bg-slate-100 border-none rounded-md text-sm font-semibold outline-none ring-primary/5 focus:ring-2 transition-all cursor-pointer">
                      <option value="">Select HSN Code (Default 0% GST)</option>
                      {dbHsns.map((hsn) => (
                        <option key={hsn._id} value={hsn._id}>
                          {hsn.hsnCode} - {hsn.description} ({hsn.gstPercentage}% GST)
                        </option>
                      ))}
                    </select>
                    <p className="text-[10px] text-slate-500 font-medium ml-1">
                      This will determine the exact tax calculated at checkout.
                    </p>
                  </div>
                </div>
              </div>
            )}

            {modalTab === "variants" && (
              <div className="space-y-6 animate-in fade-in slide-in-from-right-2 duration-300">
                <div className="flex items-center justify-between">
                  <div>
                    <h4 className="text-sm font-bold text-slate-900">
                      Product Variants
                    </h4>
                    <p className="text-xs text-slate-600 font-medium">
                      Add different sizes, colors or weights.
                    </p>
                  </div>
                  <button
                    onClick={() =>
                      setFormData((prev) => ({
                        ...prev,
                        variants: [
                          ...prev.variants,
                          {
                            id: Date.now(),
                            name: "",
                            price: "",
                            salePrice: "",
                            stock: "",
                            sku: makeSku(prev.name, prev.variants.length + 1),
                            hasBrandName: false,
                            brand: "",
                            hasIngredients: false,
                            ingredients: "",
                          },
                        ],
                      }))
                    }
                    className="flex items-center space-x-2 px-3 py-1.5 bg-primary/10 text-primary rounded-lg text-[10px] font-bold hover:bg-primary/20 transition-all">
                    <HiOutlineSquaresPlus className="h-4 w-4" />
                    <span>ADD VARIANT</span>
                  </button>
                </div>

                <div className="space-y-3">
                  {(formData.variants || []).map((variant, index) => (
                    <div
                      key={variant.id}
                      className="p-4 bg-slate-50 rounded-2xl border border-slate-100 grid grid-cols-1 md:grid-cols-12 gap-4 items-end group relative">
                      <div className="col-span-12 md:col-span-3 space-y-1">
                        <label className="text-xs font-bold text-slate-600 uppercase tracking-widest ml-1">
                          Variant Name
                        </label>
                        <input
                          value={variant.name}
                          onChange={(e) => {
                            const nextValue = e.target.value;
                            setFormData((prev) => {
                              const newVariants = prev.variants.map((item, idx) => {
                                if (idx !== index) return item;
                                return { ...item, name: nextValue };
                              });
                              return {
                                ...prev,
                                variants: newVariants,
                              };
                            });
                          }}
                          placeholder="e.g. 1kg, 1 pack, 1 liter..."
                          className="w-full px-3 py-2 bg-white ring-1 ring-slate-200 border-none rounded-xl text-xs font-semibold outline-none focus:ring-2 focus:ring-primary/10"
                        />
                      </div>
                      <div className="col-span-6 md:col-span-2 space-y-1">
                        <label className="text-xs font-bold text-slate-600 uppercase tracking-widest ml-1">
                          Price
                        </label>
                        <input
                          type="number"
                          value={variant.price}
                          onChange={(e) => {
                            const newVariants = [...formData.variants];
                            newVariants[index].price = e.target.value;
                            setFormData({ ...formData, variants: newVariants });
                          }}
                          placeholder="500"
                          className="w-full px-3 py-2 bg-white ring-1 ring-slate-200 border-none rounded-xl text-xs font-bold outline-none focus:ring-2 focus:ring-primary/10"
                        />
                      </div>
                      <div className="col-span-6 md:col-span-2 space-y-1">
                        <label className="text-[8px] font-bold text-brand-500 uppercase tracking-widest ml-1">
                          Sale
                        </label>
                        <input
                          type="number"
                          value={variant.salePrice}
                          onChange={(e) => {
                            const newVariants = [...formData.variants];
                            newVariants[index].salePrice = e.target.value;
                            setFormData({ ...formData, variants: newVariants });
                          }}
                          placeholder="450"
                          className="w-full px-3 py-2 bg-brand-50 ring-1 ring-brand-100 border-none rounded-xl text-xs font-bold text-brand-700 outline-none focus:ring-2 focus:ring-brand-200"
                        />
                      </div>
                      <div className="col-span-6 md:col-span-2 space-y-1">
                        <label className="text-xs font-bold text-slate-600 uppercase tracking-widest ml-1">
                          Stock
                        </label>
                        <input
                          type="number"
                          value={variant.stock}
                          onChange={(e) => {
                            const newVariants = [...formData.variants];
                            newVariants[index].stock = e.target.value;
                            setFormData({ ...formData, variants: newVariants });
                          }}
                          placeholder="10"
                          className="w-full px-3 py-2 bg-white ring-1 ring-slate-200 border-none rounded-xl text-xs font-bold outline-none focus:ring-2 focus:ring-primary/10"
                        />
                      </div>
                      <div className="col-span-5 md:col-span-2 space-y-1">
                        <label className="text-xs font-bold text-slate-600 uppercase tracking-widest ml-1">
                          Product Code
                        </label>
                        <input
                          value={variant.sku}
                          onChange={(e) => {
                            const newVariants = [...formData.variants];
                            newVariants[index].sku = e.target.value;
                            setFormData({ ...formData, variants: newVariants });
                          }}
                          placeholder={makeSku(formData.name, index + 1)}
                          className="w-full px-3 py-2 bg-white ring-1 ring-slate-200 border-none rounded-xl text-xs font-mono font-bold outline-none focus:ring-2 focus:ring-primary/10"
                        />
                      </div>
                      <div className="col-span-1 flex justify-end pb-1">
                        <button
                          onClick={() => {
                            if (formData.variants.length > 1) {
                              setFormData((prev) => {
                                const remaining = prev.variants
                                  .map((variant, idx) => ({ variant, oldIndex: idx + 1 }))
                                  .filter((item) => item.oldIndex !== index + 1)
                                  .map((item, newIdx) => {
                                    const shouldAuto =
                                      !item.variant.sku ||
                                      isAutoSku(item.variant.sku, prev.name, item.oldIndex);
                                    return shouldAuto
                                      ? { ...item.variant, sku: makeSku(prev.name, newIdx + 1) }
                                      : item.variant;
                                  });
                                return { ...prev, variants: remaining };
                              });
                            }
                          }}
                          className="p-2 text-slate-300 hover:text-rose-500 transition-colors">
                          <HiOutlineTrash className="h-4 w-4" />
                        </button>
                      </div>
                      <VariantDetails variant={variant} onChange={(field, value) => {
                        const next = [...formData.variants];
                        if (field === "multiple") {
                           next[index] = { ...next[index], ...value };
                        } else {
                           next[index] = { ...next[index], [field]: value };
                        }
                        setFormData({ ...formData, variants: next });
                      }} />
                    </div>
                  ))}
                </div>
              </div>
            )}

            {user?.ticketSystemEnabled && modalTab === "tickets" && (
              <div className="space-y-6 animate-in fade-in slide-in-from-right-2 duration-300">
                <div className="flex items-center justify-between pb-4 border-b border-slate-100">
                  <div>
                    <h3 className="text-base font-bold text-slate-800">Tickets</h3>
                    <p className="text-xs font-semibold text-slate-500">
                      Add different ticket types and capacities.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() =>
                      setFormData({
                        ...formData,
                        tickets: [
                          ...(formData.tickets || []),
                          {
                            id: Date.now(),
                            name: "",
                            price: "",
                            salePrice: "",
                            capacity: "",
                            instructions: "",
                            timeSlotsEnabled: false,
                            timeSlots: [],
                          },
                        ],
                      })
                    }
                    className="flex items-center space-x-2 px-3 py-1.5 bg-brand-50 text-brand-600 rounded-md text-xs font-bold hover:bg-brand-100 transition-colors">
                    <HiOutlinePlus className="h-4 w-4" />
                    <span>Add Ticket</span>
                  </button>
                </div>

                <div className="space-y-4">
                  {(formData.tickets || []).map((ticket, index) => (
                    <div
                      key={ticket.id || index}
                      className="grid grid-cols-12 items-end gap-3 p-4 bg-slate-50 rounded-xl border border-slate-100 relative group">
                      <div className="col-span-12 md:col-span-3 space-y-1">
                        <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest ml-1">
                          Ticket Name
                        </label>
                        <input
                          value={ticket.name}
                          onChange={(e) => {
                            const newTickets = [...formData.tickets];
                            newTickets[index].name = e.target.value;
                            setFormData({ ...formData, tickets: newTickets });
                          }}
                          placeholder="e.g. VIP, General..."
                          className="w-full px-3 py-2 bg-white ring-1 ring-slate-200 border-none rounded-xl text-xs font-bold outline-none focus:ring-2 focus:ring-primary/10"
                        />
                      </div>
                      <div className="col-span-6 md:col-span-2 space-y-1">
                        <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest ml-1">
                          Price
                        </label>
                        <input
                          type="number"
                          value={ticket.price}
                          onChange={(e) => {
                            const newTickets = [...formData.tickets];
                            newTickets[index].price = e.target.value;
                            setFormData({ ...formData, tickets: newTickets });
                          }}
                          placeholder="500"
                          className="w-full px-3 py-2 bg-white ring-1 ring-slate-200 border-none rounded-xl text-xs font-bold outline-none focus:ring-2 focus:ring-primary/10"
                        />
                      </div>
                      <div className="col-span-6 md:col-span-2 space-y-1">
                        <label className="text-[10px] font-bold text-brand-500 uppercase tracking-widest ml-1">
                          Sale Price
                        </label>
                        <input
                          type="number"
                          value={ticket.salePrice}
                          onChange={(e) => {
                            const newTickets = [...formData.tickets];
                            newTickets[index].salePrice = e.target.value;
                            setFormData({ ...formData, tickets: newTickets });
                          }}
                          placeholder="450"
                          className="w-full px-3 py-2 bg-brand-50 ring-1 ring-brand-100 border-none rounded-xl text-xs font-bold text-brand-700 outline-none focus:ring-2 focus:ring-brand-200"
                        />
                      </div>
                      <div className="col-span-6 md:col-span-2 space-y-1">
                        <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest ml-1">
                          Capacity
                        </label>
                        <input
                          type="number"
                          value={ticket.capacity}
                          onChange={(e) => {
                            const newTickets = [...formData.tickets];
                            newTickets[index].capacity = e.target.value;
                            setFormData({ ...formData, tickets: newTickets });
                          }}
                          placeholder="100"
                          className="w-full px-3 py-2 bg-white ring-1 ring-slate-200 border-none rounded-xl text-xs font-bold outline-none focus:ring-2 focus:ring-primary/10"
                        />
                      </div>
                      <div className="col-span-5 md:col-span-2 space-y-1">
                        <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest ml-1">
                          Instructions
                        </label>
                        <input
                          type="text"
                          value={ticket.instructions || ""}
                          onChange={(e) => {
                            const newTickets = [...formData.tickets];
                            newTickets[index].instructions = e.target.value;
                            setFormData({ ...formData, tickets: newTickets });
                          }}
                          placeholder="Any instructions..."
                          className="w-full px-3 py-2 bg-white ring-1 ring-slate-200 border-none rounded-xl text-xs font-bold outline-none focus:ring-2 focus:ring-primary/10"
                        />
                      </div>
                      <div className="col-span-1 flex justify-end pb-1">
                        <button
                          onClick={() => {
                            setFormData((prev) => {
                              const remaining = prev.tickets.filter((_, idx) => idx !== index);
                              return { ...prev, tickets: remaining };
                            });
                          }}
                          className="p-2 text-slate-300 hover:text-rose-500 transition-colors">
                          <HiOutlineTrash className="h-4 w-4" />
                        </button>
                      </div>
                      <div className="col-span-12 border-t border-slate-200 pt-3 mt-1">
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-bold text-slate-600">Enable date &amp; time slots</span>
                          <ToggleSwitch
                            checked={ticket.timeSlotsEnabled}
                            label="Enable ticket date and time slots"
                            onChange={() => {
                              const newTickets = [...formData.tickets];
                              newTickets[index] = { ...newTickets[index], timeSlotsEnabled: !ticket.timeSlotsEnabled };
                              setFormData({ ...formData, tickets: newTickets });
                            }}
                          />
                        </div>
                        {ticket.timeSlotsEnabled && (
                          <div className="space-y-2 mt-3">
                            {(ticket.timeSlots || []).map((slot, slotIndex) => (
                              <div key={slotIndex} className="grid grid-cols-1 sm:grid-cols-4 gap-2">
                                <input type="date" value={slot.date || ""} aria-label="Slot date" onChange={(e) => {
                                  const newTickets = [...formData.tickets];
                                  const slots = [...(newTickets[index].timeSlots || [])];
                                  slots[slotIndex] = { ...slots[slotIndex], date: e.target.value };
                                  newTickets[index] = { ...newTickets[index], timeSlots: slots };
                                  setFormData({ ...formData, tickets: newTickets });
                                }} className="px-3 py-2 bg-white ring-1 ring-slate-200 rounded-lg text-xs" />
                                <input type="time" value={slot.startTime || ""} aria-label="Slot start time" onChange={(e) => {
                                  const newTickets = [...formData.tickets];
                                  const slots = [...(newTickets[index].timeSlots || [])];
                                  slots[slotIndex] = { ...slots[slotIndex], startTime: e.target.value };
                                  newTickets[index] = { ...newTickets[index], timeSlots: slots };
                                  setFormData({ ...formData, tickets: newTickets });
                                }} className="px-3 py-2 bg-white ring-1 ring-slate-200 rounded-lg text-xs" />
                                <input type="time" value={slot.endTime || ""} aria-label="Slot end time" onChange={(e) => {
                                  const newTickets = [...formData.tickets];
                                  const slots = [...(newTickets[index].timeSlots || [])];
                                  slots[slotIndex] = { ...slots[slotIndex], endTime: e.target.value };
                                  newTickets[index] = { ...newTickets[index], timeSlots: slots };
                                  setFormData({ ...formData, tickets: newTickets });
                                }} className="px-3 py-2 bg-white ring-1 ring-slate-200 rounded-lg text-xs" />
                                <button type="button" onClick={() => {
                                  const newTickets = [...formData.tickets];
                                  newTickets[index] = { ...newTickets[index], timeSlots: newTickets[index].timeSlots.filter((_, i) => i !== slotIndex) };
                                  setFormData({ ...formData, tickets: newTickets });
                                }} className="text-xs font-semibold text-rose-600">Remove slot</button>
                              </div>
                            ))}
                            <button type="button" onClick={() => {
                              const newTickets = [...formData.tickets];
                              newTickets[index] = { ...newTickets[index], timeSlots: [...(newTickets[index].timeSlots || []), { date: "", startTime: "", endTime: "" }] };
                              setFormData({ ...formData, tickets: newTickets });
                            }} className="text-xs font-bold text-brand-600">+ Add time slot</button>
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {modalTab === "category" && (
              <div className="space-y-6 animate-in fade-in slide-in-from-right-2 duration-300">

                <div className="space-y-1.5 flex flex-col mb-4">
                  <label className="text-[10px] sm:text-xs font-bold text-slate-600 uppercase tracking-widest ml-1">
                    Target Module
                  </label>
                  <select
                    value={selectedModule}
                    disabled={Boolean(sellerModule)}
                    onChange={(e) => {
                      setSelectedModule(e.target.value);
                      setFormData({ ...formData, header: "", category: "", subcategory: "" });
                    }}
                    className="w-full md:w-1/2 px-4 py-2.5 bg-slate-100 border-none rounded-md text-sm font-bold outline-none cursor-pointer focus:ring-2 focus:ring-primary/5 transition-all">
                    {!sellerModule && <option value="">All Categories</option>}
                    {dynamicModules.filter((mod) => !sellerModule || mod.value === sellerModule).map((mod) => (
                      <option key={mod.value} value={mod.value}>{mod.label}</option>
                    ))}
                  </select>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-1.5 flex flex-col">
                    <label className="text-[10px] sm:text-xs font-bold text-slate-600 uppercase tracking-widest ml-1">
                      Main Group <span className="text-rose-500">*</span>
                    </label>
                    <select
                      value={formData.header}
                      onChange={(e) =>
                        setFormData({ ...formData, header: e.target.value, category: "", subcategory: "" })
                      }
                      className="w-full px-4 py-2.5 bg-slate-100 border-none rounded-md text-sm font-bold outline-none cursor-pointer focus:ring-2 focus:ring-primary/5 transition-all">
                      <option value="">Select Main Group</option>
                      {categories.map((h) => (
                        <option key={h._id || h.id} value={h._id || h.id}>
                          {h.name}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="space-y-1.5 flex flex-col">
                    <label className="text-[10px] sm:text-xs font-bold text-slate-600 uppercase tracking-widest ml-1">
                      Specific Category <span className="text-rose-500">*</span>
                    </label>
                    <select
                      value={formData.category}
                      onChange={(e) =>
                        setFormData({ ...formData, category: e.target.value, subcategory: "" })
                      }
                      disabled={!formData.header}
                      className="w-full px-4 py-2.5 bg-slate-100 border-none rounded-md text-sm font-bold outline-none cursor-pointer focus:ring-2 focus:ring-primary/5 transition-all disabled:opacity-50 disabled:cursor-not-allowed">
                      <option value="">Select Category</option>
                      {(() => {
                        const selectedHeader = categories.find((h) => (h._id || h.id) === formData.header);
                        const headerMatches = selectedHeader?.applicableModules?.includes(selectedModule);
                        return getFilteredList(selectedHeader?.children, selectedModule, headerMatches).map((c) => (
                        <option key={c._id || c.id} value={c._id || c.id}>
                          {c.name}
                        </option>
                        ));
                      })()}
                    </select>
                  </div>
                </div>
                <div className="grid grid-cols-1 gap-6">
                  <div className="space-y-1.5 flex flex-col">
                    <label className="text-[10px] sm:text-xs font-bold text-slate-600 uppercase tracking-widest ml-1">
                      Sub-Category <span className="text-rose-500">*</span>
                    </label>
                    <select
                      value={formData.subcategory}
                      onChange={(e) =>
                        setFormData({ ...formData, subcategory: e.target.value })
                      }
                      disabled={!formData.category}
                      className="w-full px-4 py-2.5 bg-slate-100 border-none rounded-md text-sm font-bold outline-none cursor-pointer focus:ring-2 focus:ring-primary/5 transition-all disabled:opacity-50 disabled:cursor-not-allowed">
                      <option value="">Select Sub-Category</option>
                      {(() => {
                        const selectedHeader = categories.find((h) => (h._id || h.id) === formData.header);
                        const selectedCategory = selectedHeader?.children?.find((c) => (c._id || c.id) === formData.category);
                        const inheritedMatch = selectedHeader?.applicableModules?.includes(selectedModule) || selectedCategory?.applicableModules?.includes(selectedModule);
                        return getFilteredList(selectedCategory?.children, selectedModule, inheritedMatch).map((sc) => (
                        <option key={sc._id || sc.id} value={sc._id || sc.id}>
                          {sc.name}
                        </option>
                        ));
                      })()}
                    </select>
                  </div>
                </div>
              </div>
            )}



            {modalTab === "media" && (
              <div className="space-y-8 animate-in fade-in slide-in-from-right-2 duration-300">
                {/* Main Image Section */}
                <div className="space-y-3">
                  <label className="text-xs font-bold text-slate-600 uppercase tracking-widest ml-1">
                    Main Cover Photo
                  </label>
                  <div className="flex flex-col md:flex-row items-start gap-6">
                    <div className="w-48 aspect-square rounded-lg border-2 border-dashed border-slate-200 bg-slate-50 flex flex-col items-center justify-center group hover:border-primary hover:bg-primary/5 transition-all cursor-pointer overflow-hidden relative">
                      <input
                        type="file"
                        className="absolute inset-0 opacity-0 cursor-pointer z-10"
                        onChange={(e) => handleImageUpload(e, "main")}
                      />
                      {formData.mainImage ? (
                        <img
                          src={formData.mainImage}
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <>
                          <HiOutlinePhoto className="h-10 w-10 text-slate-200 group-hover:text-primary transition-colors" />
                          <p className="text-[9px] font-bold text-slate-600 mt-2 uppercase tracking-widest group-hover:text-primary">
                            Upload Cover
                          </p>
                        </>
                      )}
                    </div>
                    <div className="flex-1 space-y-2 pt-2">
                      <p className="text-xs font-bold text-slate-900">
                        Choose a primary image
                      </p>
                      <p className="text-xs text-slate-600 font-medium leading-relaxed">
                        We show this image on the search page and the main
                        store listing. Make sure it is clear and bright.
                      </p>
                      <button className="text-[10px] font-black text-primary uppercase tracking-wider hover:underline">
                        Pick from Library
                        </button>
                      </div>
                    </div>
                </div>

                {/* Gallery Section */}
                <div className="space-y-3">
                  <label className="text-xs font-bold text-slate-600 uppercase tracking-widest ml-1">
                    Gallery Photos (Max 5)
                  </label>
                  <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
                    {[1, 2, 3, 4, 5].map((i) => (
                      <div
                        key={i}
                        className="aspect-square rounded-md border-2 border-dashed border-slate-200 bg-slate-50 flex flex-col items-center justify-center group hover:border-primary hover:bg-primary/5 transition-all cursor-pointer relative overflow-hidden">
                        {formData.galleryImages[i - 1] ? (
                          <img
                            src={formData.galleryImages[i - 1]}
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          <>
                            <input
                              type="file"
                              className="absolute inset-0 opacity-0 cursor-pointer z-10"
                              onChange={(e) => handleImageUpload(e, "gallery")}
                            />
                            <HiOutlinePlus className="h-5 w-5 text-slate-200 group-hover:text-primary transition-colors" />
                            <p className="text-[8px] font-bold text-slate-600 mt-1 uppercase tracking-widest group-hover:text-primary">
                              Add
                            </p>
                          </>
                        )}
                      </div>
                    ))}
                  </div>
                </div>

                {/* Product Video Section */}
                <div className="space-y-3 pt-6 border-t border-slate-100">
                  <label className="text-xs font-bold text-slate-600 uppercase tracking-widest ml-1">
                    Product Video (Direct Upload)
                  </label>
                  <div className="flex flex-col gap-2">
                    <div className="relative w-full border-2 border-dashed border-slate-200 rounded-lg bg-slate-50 p-6 flex flex-col items-center justify-center hover:border-brand-400 transition-colors">
                      <input
                        type="file"
                        accept="video/*"
                        onChange={handleVideoUpload}
                        className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                      />
                      <HiOutlineFilm className="h-8 w-8 text-slate-400 mb-2" />
                      <p className="text-sm font-semibold text-slate-700">Click or drag a video file to upload</p>
                      <p className="text-xs text-slate-500 mt-1">Storage limits apply. Extra MBs will be charged.</p>
                    </div>

                    {formData.videoUrl && (
                      <div className="mt-4 p-3 bg-brand-50 border border-brand-100 rounded-lg flex items-center justify-between">
                        <div className="flex items-center gap-2 text-brand-700 text-sm font-semibold">
                          <HiOutlineFilm className="h-5 w-5" />
                          <span>Video successfully uploaded</span>
                        </div>
                        <button
                          type="button"
                          onClick={() => setFormData({ ...formData, videoUrl: "" })}
                          className="text-rose-500 hover:text-rose-700 font-bold text-xs uppercase tracking-wider"
                        >
                          Remove
                        </button>
                      </div>
                    )}
                    <p className="text-[11px] text-slate-500 font-medium leading-relaxed ml-1 mt-2">
                      Upload a short video (30-50 seconds) recorded in portrait orientation showcasing the product. This uses your active Video Subscription storage.
                    </p>
                  </div>
                </div>

                <p className="text-xs text-slate-600 font-medium italic text-center pt-4 border-t border-slate-50">
                  Quick Tip: Using WebP format at 800x800px makes your store load
                  3x faster.
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
      {videoPayment && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden animate-in fade-in zoom-in-95 duration-200">
            <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50">
              <h3 className="text-lg font-bold text-slate-800">Video Storage Payment</h3>
              <button onClick={() => setVideoPayment(null)} className="text-slate-400 hover:text-slate-600">
                <HiOutlineXMark size={22} />
              </button>
            </div>
            <div className="p-6">
              <div className="bg-rose-50 border border-rose-100 rounded-xl p-4 mb-6">
                <p className="text-sm font-semibold text-rose-800">Storage Limit Exceeded</p>
                <p className="text-xs text-rose-600 mt-1">
                  This upload exceeds your included storage by <strong>{videoPayment.mbToCharge.toFixed(2)} MB</strong>.
                </p>
                <div className="mt-3 flex justify-between items-baseline">
                  <span className="text-xs text-slate-500 font-bold uppercase tracking-wider">Required Amount:</span>
                  <span className="text-2xl font-black text-rose-600">â‚¹{videoPayment.totalAmount}</span>
                </div>
              </div>

              <p className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-3">Select Payment Method</p>
              <div className="space-y-3">
                <button
                  onClick={handleVideoPayRazorpay}
                  disabled={videoUploading}
                  className="w-full flex items-center justify-between px-5 py-4 bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 transition-all font-bold disabled:opacity-60"
                >
                  <div className="flex items-center gap-3">
                    <HiOutlineFilm size={20} />
                    <span>Pay Online (Razorpay)</span>
                  </div>
                  <span className="text-[10px] bg-white/20 px-2 py-0.5 rounded-full uppercase tracking-wider font-extrabold">Instant</span>
                </button>

                <button
                  onClick={handleVideoPayCOD}
                  disabled={videoUploading}
                  className="w-full flex items-center justify-between px-5 py-4 bg-amber-500 text-white rounded-xl hover:bg-amber-600 transition-all font-bold disabled:opacity-60"
                >
                  <div className="flex items-center gap-3">
                    <HiOutlineTruck size={20} />
                    <span>Cash on Delivery (COD)</span>
                  </div>
                  <span className="text-[10px] bg-white/20 px-2 py-0.5 rounded-full uppercase tracking-wider font-extrabold">Pending</span>
                </button>
              </div>

              {videoUploading && (
                <p className="text-center text-xs text-slate-500 mt-4 animate-pulse">Uploading and processing video...</p>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default EditProduct;
