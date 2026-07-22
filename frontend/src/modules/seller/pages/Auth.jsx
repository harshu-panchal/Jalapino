import React, { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useAuth } from "@core/context/AuthContext";
import { useSettings } from "@core/context/SettingsContext";
import { UserRole } from "@core/constants/roles";
import {
  Mail,
  Lock,
  User,
  Phone,
  ArrowRight,
  Store,
  ShoppingBag,
  TrendingUp,
  Rocket,
  Globe,
  MapPin,
  LayoutList,
  FileText,
  Upload,
  CheckCircle,
  Navigation,
  Loader2,
  Eye,
  EyeOff,
  ChevronDown,
  ChevronLeft,
} from "lucide-react";
import { toast } from "sonner";
import Lottie from "lottie-react";
import sellerAnimation from "../../../assets/INSTANT_6.json";
import { sellerApi } from "../services/sellerApi";
import MapPicker from "../../../shared/components/MapPicker";

const createInitialVerificationState = () => ({
  status: "idle",
  otp: "",
  token: "",
  isOtpVisible: false,
  isSending: false,
  isVerifying: false,
  verifiedValue: "",
});

const REQUIRED_DOCUMENT_CONFIG = [
  { id: "aadharCardFront", label: "Aadhar Card (Front)", required: true },
  { id: "aadharCardBack", label: "Aadhar Card (Back)", required: true },
  { id: "panCard", label: "PAN Card", required: true },
  { id: "gstCertificate", label: "GST Certificate", required: false },
  { id: "other", label: "Other Documents", required: false },
];

const DEFAULT_BANNERS = [
  "/jal1.jpeg",
  "/jal2.jpeg",
  "/jal3.jpeg",
  "/jal4.jpeg",
  "/jal5.jpeg",
];

const Auth = () => {
  const [bannerIndex, setBannerIndex] = useState(0);
  const [banners, setBanners] = useState([]);

  React.useEffect(() => {
    // Fetch dynamic banners
    const loadBanners = async () => {
      try {
        const response = await sellerApi.getSignupBanners();
        const activeBanners = response.data?.results || response.data?.result || [];
        if (activeBanners.length > 0) {
          const domain = import.meta.env.VITE_API_URL?.replace('/api', '') || 'http://localhost:7000';
          setBanners(activeBanners.map(b => ({
            url: `${domain}${b.imageUrl}`,
            width: b.width || '100%',
            height: b.height || '100%'
          })));
        } else {
          setBanners(DEFAULT_BANNERS.map(url => ({ url, width: '100%', height: '100%' })));
        }
      } catch (err) {
        console.error("Failed to load banners", err);
        setBanners(DEFAULT_BANNERS.map(url => ({ url, width: '100%', height: '100%' })));
      }
    };
    loadBanners();
  }, []);

  React.useEffect(() => {
    if (banners.length === 0) return;
    const timer = setInterval(() => {
      setBannerIndex((prev) => (prev + 1) % banners.length);
    }, 10000); // 10 seconds autoplay
    return () => clearInterval(timer);
  }, [banners.length]);

  const [searchParams] = useSearchParams();
  const isSignupMode = searchParams.get("mode") === "signup" || searchParams.get("signup") === "true";
  const [isLogin, setIsLogin] = useState(() => {
    const saved = sessionStorage.getItem('sellerAuthIsLogin');
    if (saved !== null) return saved === 'true';
    return !isSignupMode;
  });
  const [isLoading, setIsLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [signupStep, setSignupStep] = useState(() => {
    const saved = sessionStorage.getItem('sellerAuthSignupStep');
    return saved ? parseInt(saved, 10) : 1;
  });
  const [isMapOpen, setIsMapOpen] = useState(false);
  const { login } = useAuth();
  const { settings } = useSettings();
  const navigate = useNavigate();
  const panelRef = React.useRef(null);

  const handleBack = () => {
    if (!isLogin && signupStep > 1) {
      setSignupStep(prev => prev - 1);
    } else if (isSignupMode) {
      navigate('/#footer-banner-carousel');
    } else {
      navigate(-1);
    }
  };

  React.useEffect(() => {
    sessionStorage.setItem('sellerAuthIsLogin', isLogin);
  }, [isLogin]);

  React.useEffect(() => {
    sessionStorage.setItem('sellerAuthSignupStep', signupStep);
  }, [signupStep]);

  React.useEffect(() => {
    const panel = panelRef.current;
    if (!panel) return;

    const handleWheel = (e) => {
      if (panel.scrollHeight <= panel.clientHeight) {
        return;
      }
      e.preventDefault();
      panel.scrollTop += e.deltaY;
    };

    panel.addEventListener("wheel", handleWheel, { passive: false });
    return () => {
      panel.removeEventListener("wheel", handleWheel);
    };
  }, []);
  const appName = settings?.appName || "App";
  const logoUrl = '/logo2.png';
  const [verifications, setVerifications] = useState({
    email: createInitialVerificationState(),
    phone: createInitialVerificationState(),
  });

  const getCleanCoverage = (val) => {
    if (Array.isArray(val)) return val;
    if (typeof val === 'string') {
      try {
        const parsed = JSON.parse(val);
        if (Array.isArray(parsed)) return parsed;
        if (typeof parsed === 'string') return [parsed];
      } catch (e) {
        if (val.includes(",")) return val.split(",").map(s => s.trim().replace(/['"\[\]]/g, ''));
        if (val) return [val.replace(/['"\[\]]/g, '')];
      }
    }
    return [];
  };

  const [formData, setFormData] = useState(() => {
    const saved = sessionStorage.getItem('sellerAuthFormData');
    const defaultData = {
      email: "",
      password: "",
      name: "",
      shopName: "",
      phone: "",
      locality: "",
      pincode: "",
      city: "",
      state: "",
      category: "",
      mainProducts: "",
      description: "",
      otherDocumentExpiryDate: "",
      lat: null,
      lng: null,
      radius: 5,
      address: "",
      isPickupPointEligible: false,
      customZones: [],
    };
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        return { ...defaultData, ...parsed };
      } catch (e) { }
    }
    return defaultData;
  });

  const [serviceCoverage, setServiceCoverage] = useState(() => {
    const saved = sessionStorage.getItem('sellerServiceCoverage');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) return parsed;
      } catch (e) { }
    }
    return ["hyperlocal"];
  });

  React.useEffect(() => {
    sessionStorage.setItem('sellerAuthFormData', JSON.stringify(formData));
  }, [formData]);

  React.useEffect(() => {
    sessionStorage.setItem('sellerServiceCoverage', JSON.stringify(serviceCoverage));
  }, [serviceCoverage]);

  const handleLocationSelect = (location) => {
    setFormData((prev) => ({
      ...prev,
      lat: location.lat,
      lng: location.lng,
      radius: location.radius,
      address: location.address,
      locality: location.locality || prev.locality,
      pincode: location.pincode || prev.pincode,
      city: location.city || prev.city,
      state: location.state || prev.state,
    }));
  };

  const [documents, setDocuments] = useState({});
  const [categoriesList, setCategoriesList] = useState([]);
  const [activeDocAction, setActiveDocAction] = useState(null); // stores the doc id currently waiting for camera/gallery action
  const fileInputRefs = React.useRef({});

  const [newZoneName, setNewZoneName] = useState("");
  const [newZoneCity, setNewZoneCity] = useState("");
  const [newAreaInput, setNewAreaInput] = useState("");
  const [editingZoneIndex, setEditingZoneIndex] = useState(null);

  const handleCameraCapture = async (docId) => {
    setActiveDocAction(null); // close action sheet
    try {
      if (window.flutter_inappwebview && window.flutter_inappwebview.callHandler) {
        const result = await window.flutter_inappwebview.callHandler('openCamera');
        if (result && result.success && result.base64) {
          const byteCharacters = atob(result.base64);
          const byteNumbers = new Array(byteCharacters.length);
          for (let i = 0; i < byteCharacters.length; i++) {
            byteNumbers[i] = byteCharacters.charCodeAt(i);
          }
          const byteArray = new Uint8Array(byteNumbers);
          const file = new File([byteArray], result.fileName || `camera_${docId}_${Date.now()}.jpg`, { type: result.mimeType || 'image/jpeg' });
          setDocuments((prev) => ({ ...prev, [docId]: file }));
          toast.success("Photo captured successfully!");
        } else {
          toast.error("Failed to capture photo.");
        }
      } else {
        toast.error("Camera is only available in the app.");
      }
    } catch (e) {
      console.error(e);
      toast.error("Error opening camera.");
    }
  };

  React.useEffect(() => {
    if (!isLogin) {
      // Fetch all categories from DB dynamically
      sellerApi.getCategories().then(res => {
        // Backend returns { results: [...] } when data is an array
        let list = res.data?.results || res.data?.result || res.data || [];
        if (list && list.items) list = list.items;
        if (!Array.isArray(list)) list = [];
        // Priority: header > category > subcategory > all (use whatever exists in DB)
        const headers = list.filter(cat => cat.type === 'header');
        const categories = list.filter(cat => cat.type === 'category');
        const subcategories = list.filter(cat => cat.type === 'subcategory');
        const best = headers.length > 0 ? headers
          : categories.length > 0 ? categories
            : subcategories.length > 0 ? subcategories
              : list;
        setCategoriesList(best);
      }).catch(err => console.error("Failed to load categories", err));
    }
  }, [isLogin]);

  const getMissingRequiredDocuments = () =>
    REQUIRED_DOCUMENT_CONFIG.filter((doc) => doc.required && !documents[doc.id]);

  const updateVerificationState = (field, updates) => {
    setVerifications((prev) => ({
      ...prev,
      [field]: {
        ...prev[field],
        ...updates,
      },
    }));
  };

  const resetVerificationState = (field) => {
    setVerifications((prev) => ({
      ...prev,
      [field]: createInitialVerificationState(),
    }));
  };

  const getVerificationPayload = (field) => {
    const channel = field === "email" ? "email" : "phone";
    return channel === "email"
      ? { channel, email: formData.email }
      : { channel, phone: formData.phone };
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    if (name === "name") {
      // Owner name: only alphabets and spaces
      const cleaned = value.replace(/[^a-zA-Z\s]/g, "");
      setFormData({ ...formData, [name]: cleaned });
    } else if (name === "email") {
      // Business email: trim leading spaces, disallow spaces inside
      const cleaned = value.replace(/\s+/g, "").toLowerCase();
      if (cleaned !== formData.email) {
        resetVerificationState("email");
      }
      setFormData({ ...formData, [name]: cleaned });
    } else if (name === "phone") {
      // Contact number: only digits, max 10 characters
      const digitsOnly = value.replace(/[^0-9]/g, "").slice(0, 10);
      if (digitsOnly !== formData.phone) {
        resetVerificationState("phone");
      }
      setFormData({ ...formData, [name]: digitsOnly });
    } else if (name === "city" || name === "state") {
      // City & State: only alphabets and spaces
      const cleaned = value.replace(/[^a-zA-Z\s]/g, "");
      setFormData({ ...formData, [name]: cleaned });
    } else if (name === "pincode") {
      const digitsOnly = value.replace(/[^0-9]/g, "").slice(0, 6);
      setFormData({ ...formData, [name]: digitsOnly });
    } else if (name === "password") {
      // Password: allow any characters, min length 6
      setFormData({ ...formData, [name]: value });
    } else {
      setFormData({ ...formData, [name]: value });
    }
  };

  const handleCoverageToggle = (coverageType) => {
    setServiceCoverage((current) => {
      if (coverageType === "all") {
        return current.includes("all") ? [] : ["hyperlocal", "pan_india", "zone_wise", "all"];
      }

      if (current.includes(coverageType)) {
        return current.filter((t) => t !== coverageType && t !== "all");
      }
      return [...current.filter((t) => t !== "all"), coverageType];
    });
  };

  const handleAddZone = () => {
    if (!newZoneName.trim() || !newZoneCity.trim()) {
      toast.error("Zone Name and City are required.");
      return;
    }
    setFormData((prev) => {
      const updatedZones = [...(prev.customZones || [])];
      updatedZones.push({
        name: newZoneName.trim(),
        city: newZoneCity.trim(),
        areas: [],
      });
      return { ...prev, customZones: updatedZones };
    });
    setNewZoneName("");
    setNewZoneCity("");
  };

  const handleRemoveZone = (index) => {
    setFormData((prev) => {
      const updatedZones = (prev.customZones || []).filter((_, i) => i !== index);
      return { ...prev, customZones: updatedZones };
    });
    if (editingZoneIndex === index) {
      setEditingZoneIndex(null);
    }
  };

  const handleAddAreaToZone = (zoneIndex) => {
    if (!newAreaInput.trim()) return;
    setFormData((prev) => {
      const updatedZones = [...(prev.customZones || [])];
      if (updatedZones[zoneIndex]) {
        const areaList = [...(updatedZones[zoneIndex].areas || [])];
        if (!areaList.includes(newAreaInput.trim())) {
          areaList.push(newAreaInput.trim());
        }
        updatedZones[zoneIndex] = { ...updatedZones[zoneIndex], areas: areaList };
      }
      return { ...prev, customZones: updatedZones };
    });
    setNewAreaInput("");
  };

  const handleRemoveAreaFromZone = (zoneIndex, areaIndex) => {
    setFormData((prev) => {
      const updatedZones = [...(prev.customZones || [])];
      if (updatedZones[zoneIndex]) {
        const areaList = (updatedZones[zoneIndex].areas || []).filter((_, i) => i !== areaIndex);
        updatedZones[zoneIndex] = { ...updatedZones[zoneIndex], areas: areaList };
      }
      return { ...prev, customZones: updatedZones };
    });
  };

  const handleDocumentChange = (e, docId) => {
    setDocuments({ ...documents, [docId]: e.target.files[0] });
  };

  const handleSendVerificationOtp = async (field) => {
    const currentValue = formData[field];
    const isEmailField = field === "email";

    if (
      (isEmailField &&
        !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(currentValue || "")) ||
      (!isEmailField && !/^[0-9]{10}$/.test(currentValue || ""))
    ) {
      toast.error(
        isEmailField
          ? "Enter a valid email before requesting OTP."
          : "Enter a valid 10-digit phone number before requesting OTP.",
      );
      return;
    }

    updateVerificationState(field, {
      isSending: true,
      isOtpVisible: true,
      otp: "",
      token: "",
      status: "sending",
    });

    try {
      await sellerApi.sendVerificationOtp(getVerificationPayload(field));
      updateVerificationState(field, {
        isSending: false,
        isOtpVisible: true,
        status: "otp-sent",
      });
      toast.success(
        isEmailField
          ? "Verification OTP sent to your email."
          : "Verification OTP sent to your phone.",
      );
    } catch (error) {
      updateVerificationState(field, {
        isSending: false,
        status: "idle",
      });
      toast.error(error.response?.data?.message || "Failed to send OTP");
    }
  };

  const handleVerifyOtp = async (field) => {
    const verificationState = verifications[field];
    if (!/^\d{4}$/.test(verificationState.otp || "")) {
      toast.error("Enter a valid 4-digit OTP.");
      return;
    }

    updateVerificationState(field, {
      isVerifying: true,
    });

    try {
      const response = await sellerApi.verifyVerificationOtp({
        ...getVerificationPayload(field),
        otp: verificationState.otp,
      });
      const verificationToken =
        response.data?.result?.verificationToken || "";

      updateVerificationState(field, {
        isVerifying: false,
        isOtpVisible: false,
        status: "verified",
        otp: "",
        token: verificationToken,
        verifiedValue: formData[field],
      });
      toast.success(
        field === "email"
          ? "Email verified successfully."
          : "Phone number verified successfully.",
      );
    } catch (error) {
      updateVerificationState(field, {
        isVerifying: false,
      });
      toast.error(error.response?.data?.message || "Failed to verify OTP");
    }
  };



  const handleSubmit = async (e) => {
    e.preventDefault();

    try {
      // Basic client-side validation for signup
      if (!isLogin) {
        const email = formData.email || "";
        const phone = formData.phone || "";
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
          toast.error("Please enter a valid business email address.");
          setIsLoading(false);
          return;
        }
        if (!/^[0-9]{10}$/.test(phone)) {
          toast.error("Please enter a valid 10-digit contact number.");
          return;
        }
        if (verifications.email.status !== "verified" || !verifications.email.token) {
          toast.error("Please verify your business email before continuing.");
          return;
        }
        if (verifications.phone.status !== "verified" || !verifications.phone.token) {
          toast.error("Please verify your contact number before continuing.");
          return;
        }
      }
      // Password: min 6 characters
      const pwd = (formData.password || "").trim();
      if (pwd.length < 6) {
        toast.error(
          "Password must be at least 6 characters.",
        );
        return;
      }

      if (!isLogin && signupStep < 3) {
        setSignupStep((prev) => prev + 1);
        return;
      }

      if (!isLogin) {
        const missingRequiredDocuments = getMissingRequiredDocuments();
        if (missingRequiredDocuments.length > 0) {
          toast.error(
            `Please upload all required documents: ${missingRequiredDocuments
              .map((doc) => doc.label)
              .join(", ")}`,
          );
          return;
        }
      }

      setIsLoading(true);
      // Note: backend expects a single address string, derive from city + state
      const address =
        formData.address ||
        [
          formData.locality,
          formData.city,
          formData.state,
          formData.pincode,
        ]
          .filter(Boolean)
          .join(", ");

      const response = isLogin
        ? await sellerApi.login({
          email: formData.email,
          password: formData.password,
        })
        : await (() => {
          const signupPayload = new FormData();

          Object.entries({
            ...formData,
            address,
            lat: formData.lat,
            lng: formData.lng,
            radius: formData.radius,
            serviceCoverage: serviceCoverage.filter(c => c !== "all"),
            emailVerificationToken: verifications.email.token,
            phoneVerificationToken: verifications.phone.token,
          }).forEach(([key, value]) => {
            if (value !== null && value !== undefined && value !== "") {
              if (key === "serviceCoverage" || key === "customZones") {
                signupPayload.append(key, JSON.stringify(value));
              } else {
                signupPayload.append(key, value);
              }
            }
          });


          Object.entries(documents).forEach(([key, file]) => {
            if (file) {
              signupPayload.append(key, file);
            }
          });

          return sellerApi.signup(signupPayload);
        })();

      if (isLogin) {
        const { token, seller } = response.data.result;
        login({
          ...seller,
          token,
          role: "seller",
        });
        toast.success("Welcome back, Partner!");
        navigate("/seller");
      } else {
        setIsLogin(true);
        setSignupStep(1);
        setDocuments({
          other: null,
          gstCertificate: null,
          idProof: null,
        });
        setVerifications({
          email: createInitialVerificationState(),
          phone: createInitialVerificationState(),
        });
        setFormData((prev) => ({
          ...prev,
          password: "",
        }));
        toast.success(
          "Application submitted. Login is enabled only after admin approval.",
        );
        sessionStorage.removeItem('sellerAuthIsLogin');
        sessionStorage.removeItem('sellerAuthSignupStep');
        sessionStorage.removeItem('sellerAuthFormData');
        navigate("/seller/pending-approval", {
          replace: true,
          state: {
            approvalRequired: true,
            applicationStatus: "pending",
          },
        });
      }
    } catch (error) {
      if (isLogin && error.response?.status === 403) {
        const applicationStatus =
          error.response?.data?.result?.applicationStatus || "pending";
        const rejectionReason =
          error.response?.data?.result?.rejectionReason || "";
        navigate("/seller/pending-approval", {
          replace: true,
          state: {
            approvalRequired: true,
            applicationStatus,
            rejectionReason,
          },
        });
      }
      toast.error(error.response?.data?.message || "Authentication failed");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="w-full h-[100dvh] overflow-hidden bg-[#fcfaff] p-4 sm:p-6 font-sans relative flex flex-col items-center justify-center">
      {/* Elegant Ambient Background */}
      <div className="absolute inset-0 z-0 overflow-hidden pointer-events-none">
        <div className="absolute top-[-10%] left-[-5%] w-[60%] h-[60%] bg-slate-100/50 rounded-full blur-[120px]" />
        <div className="absolute bottom-[-5%] right-[-5%] w-[40%] h-[40%] bg-slate-50/50 rounded-full blur-[100px]" />
      </div>

      <motion.div
        initial={{ opacity: 0, scale: 0.98 }}
        animate={{ opacity: 1, scale: 1 }}
        className="relative z-10 w-full max-w-[1000px] h-full md:h-auto md:min-h-[600px] max-h-full md:max-h-[90vh] bg-white rounded-2xl md:rounded-lg shadow-[0_50px_120px_rgba(0,0,0,0.04)] border border-white flex flex-col md:flex-row overflow-hidden">
        {/* Visual Side Panel - 5 Banner Slideshow */}
        <div className="hidden md:block w-[45%] relative overflow-hidden bg-slate-950">
          <AnimatePresence mode="wait">
            <div className="absolute inset-0 flex items-center justify-center">
              <motion.img
                key={bannerIndex}
                src={banners[bannerIndex]?.url}
                initial={{ opacity: 0, scale: 1.02 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.6, ease: "easeInOut" }}
                style={{
                  width: banners[bannerIndex]?.width || '100%',
                  height: banners[bannerIndex]?.height || '100%',
                  objectFit: 'fill'
                }}
                alt="Seller Banner"
              />
            </div>
          </AnimatePresence>
          {/* Burgundy / Dark Gradient Overlay for premium look */}
          <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent pointer-events-none" />

          {/* Back Button on Left Panel */}
          <button
            type="button"
            onClick={handleBack}
            className="absolute top-8 left-8 p-3 bg-white/10 hover:bg-white/20 backdrop-blur-md rounded-full text-white transition-all shadow-lg z-50 border border-white/20 flex items-center justify-center cursor-pointer"
          >
            <ChevronLeft size={24} />
          </button>

          {/* Logo & Slogan overlay on left panel */}
          <div className="absolute bottom-10 left-8 right-8 z-10 text-left">
            <h2 className="text-2xl font-black text-white tracking-tight uppercase leading-none drop-shadow-[0_2px_8px_rgba(0,0,0,0.8)]">
              Seller Partner
            </h2>
            <p className="text-xs font-semibold text-white/90 tracking-wider mt-2 uppercase drop-shadow-[0_2px_4px_rgba(0,0,0,0.8)]">
              Empowering Business Digitalization
            </p>
          </div>
        </div>

        {/* Form Content Side */}
        <div
          ref={panelRef}
          className="w-full md:w-[55%] h-full min-h-0 p-5 pt-14 md:px-12 md:py-8 flex flex-col justify-start bg-white overflow-y-auto overscroll-contain custom-scrollbar relative"
          style={{ WebkitOverflowScrolling: "touch" }}>

          <div className="w-full flex items-center justify-between mb-2 md:hidden">
            <button
              type="button"
              onClick={handleBack}
              className="p-2.5 text-slate-500 hover:text-slate-800 bg-slate-50 hover:bg-slate-100 rounded-full transition-all flex items-center justify-center shadow-sm z-20 border border-slate-200"
            >
              <ChevronLeft size={22} />
            </button>
          </div>
          <AnimatePresence mode="wait">
            <motion.div
              key={isLogin ? "login" : `signup-step-${signupStep}`}
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              transition={{ duration: 0.5, ease: [0.23, 1, 0.32, 1] }}
              className="space-y-8 py-2 md:py-0">
              <div className="space-y-4">
                {/* Mobile Brand Header (visible on mobile view only) */}
                <div className="flex md:hidden items-center gap-4 mb-6">
                  <div className="w-12 h-12 rounded-xl bg-slate-50 border border-slate-200 shadow-sm flex items-center justify-center overflow-hidden shrink-0">
                    {logoUrl ? (
                      <img
                        src={logoUrl}
                        alt={`${appName} logo`}
                        className="w-8 h-8 object-contain"
                      />
                    ) : (
                      <Store size={20} className="text-slate-700" />
                    )}
                  </div>
                  <div className="text-left">
                    <h2 className="text-sm font-black text-slate-800 tracking-tight uppercase leading-none">
                      {appName} <span className="text-slate-500">Partner</span>
                    </h2>
                    <p className="text-[10px] text-slate-500 font-semibold tracking-wider mt-1 uppercase">
                      Empowering Business
                    </p>
                  </div>
                </div>

                {/* Mobile Banner Slideshow */}
                <div className="block md:hidden w-full aspect-video rounded-2xl relative overflow-hidden mb-6 bg-slate-900 shadow-sm border border-slate-200">
                  <AnimatePresence mode="wait">
                    <div className="absolute inset-0 flex items-center justify-center">
                      <motion.img
                        key={bannerIndex}
                        src={banners[bannerIndex]?.url}
                        initial={{ opacity: 0, scale: 1.02 }}
                        animate={{ opacity: 1, scale: 1 }}
                        exit={{ opacity: 0 }}
                        transition={{ duration: 0.5, ease: "easeInOut" }}
                        style={{
                          width: banners[bannerIndex]?.width || '100%',
                          height: banners[bannerIndex]?.height || '100%',
                          objectFit: 'fill'
                        }}
                        alt="Seller Banner"
                      />
                    </div>
                  </AnimatePresence>
                  {/* Overlay gradient */}
                  <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent pointer-events-none" />

                  {/* Overlay Text */}
                  <div className="absolute bottom-3 left-4 right-4 z-10 text-left">
                    <h3 className="text-xs font-black text-white uppercase tracking-widest leading-none drop-shadow-[0_1px_4px_rgba(0,0,0,0.8)]">
                      Seller Partner
                    </h3>
                  </div>
                </div>

                <div className="hidden md:flex w-full items-center justify-between mb-4">
                  <div className="flex items-center gap-4">
                    <button
                      type="button"
                      onClick={handleBack}
                      className="p-2.5 text-slate-500 hover:text-slate-800 bg-slate-50 hover:bg-slate-100 rounded-full transition-all flex items-center justify-center shadow-sm border border-slate-200 shrink-0"
                    >
                      <ChevronLeft size={22} />
                    </button>
                    <span className="inline-block px-4 py-1.5 bg-slate-100 text-slate-800 rounded-full text-[10px] font-black uppercase tracking-widest border border-slate-200">
                      {isLogin
                        ? "Welcome Back"
                        : `New Partnership - Step ${signupStep} of 3`}
                    </span>
                  </div>

                  <div className="w-16 h-16 rounded-2xl bg-slate-50 border border-slate-200 shadow-sm flex items-center justify-center overflow-hidden shrink-0">
                    {logoUrl ? (
                      <img
                        src={logoUrl}
                        alt={`${appName} logo`}
                        className="w-10 h-10 object-contain"
                      />
                    ) : (
                      <Store size={24} className="text-slate-700" />
                    )}
                  </div>
                </div>

                <span className="md:hidden inline-block px-4 py-1 bg-slate-100 text-slate-800 rounded-full text-[10px] font-black uppercase tracking-widest border border-slate-200">
                  {isLogin
                    ? "Welcome Back"
                    : `New Partnership - Step ${signupStep} of 3`}
                </span>
                <h1 className="text-3xl font-black text-slate-900 tracking-tighter">
                  Seller{" "}
                  <span className="text-slate-900">
                    {isLogin ? "Login" : "Signup"}
                  </span>
                </h1>
                <p className="text-slate-600 font-medium text-base leading-relaxed">
                  {isLogin
                    ? "Access your unified seller dashboard and manage orders."
                    : signupStep === 1
                      ? "Register your store and start selling instantly."
                      : signupStep === 2
                        ? "Set your shop address and service area precisely."
                        : "Upload verification documents to complete your application."}
                </p>
              </div>

              <form onSubmit={handleSubmit} className="space-y-4">
                {/* LOGIN OR SIGNUP STEP 1 */}
                {(isLogin || signupStep === 1) && (
                  <>
                    {!isLogin && (
                      <div className="flex flex-col gap-4">
                        <div className="relative group">
                          <div className="absolute left-5 top-1/2 -translate-y-1/2 text-slate-300 group-focus-within:text-violet-600 transition-colors">
                            <User size={18} />
                          </div>
                          <input
                            type="text"
                            name="name"
                            required
                            placeholder="Owner Name"
                            className="w-full pl-12 pr-6 py-4 bg-slate-50 border-2 border-transparent rounded-lg text-sm font-bold text-slate-700 outline-none focus:bg-white focus:border-slate-200 transition-all placeholder:text-slate-500"
                            value={formData.name}
                            onChange={handleChange}
                          />
                        </div>
                        <div className="relative group">
                          <div className="absolute left-5 top-1/2 -translate-y-1/2 text-slate-300 group-focus-within:text-violet-600 transition-colors">
                            <Store size={18} />
                          </div>
                          <input
                            type="text"
                            name="shopName"
                            required
                            placeholder="Shop / Business Name"
                            className="w-full pl-12 pr-6 py-4 bg-slate-50 border-2 border-transparent rounded-lg text-sm font-bold text-slate-700 outline-none focus:bg-white focus:border-slate-200 transition-all placeholder:text-slate-500"
                            value={formData.shopName}
                            onChange={handleChange}
                          />
                        </div>
                        <div className="relative group">
                          <div className="absolute left-5 top-1/2 -translate-y-1/2 text-slate-300 group-focus-within:text-violet-600 transition-colors pointer-events-none">
                            <LayoutList size={18} />
                          </div>
                          <input
                            type="text"
                            name="category"
                            required
                            placeholder="Shop Category (Remarks) - e.g. Grocery, Fashion"
                            className="w-full pl-12 pr-6 py-4 bg-slate-50 border-2 border-transparent rounded-lg text-sm font-bold text-slate-700 outline-none focus:bg-white focus:border-slate-200 transition-all placeholder:text-slate-500"
                            value={formData.category}
                            onChange={handleChange}
                          />
                        </div>
                        <div className="relative group">
                          <div className="absolute left-5 top-1/2 -translate-y-1/2 text-slate-300 group-focus-within:text-violet-600 transition-colors">
                            <ShoppingBag size={18} />
                          </div>
                          <input
                            type="text"
                            name="mainProducts"
                            required
                            placeholder="Main Products (e.g., Cakes, Sweets, Decor)"
                            className="w-full pl-12 pr-6 py-4 bg-slate-50 border-2 border-transparent rounded-lg text-sm font-bold text-slate-700 outline-none focus:bg-white focus:border-slate-200 transition-all placeholder:text-slate-500"
                            value={formData.mainProducts}
                            onChange={handleChange}
                          />
                        </div>
                      </div>
                    )}

                    <div className="relative group">
                      <div className="absolute left-5 top-1/2 -translate-y-1/2 text-slate-300 group-focus-within:text-violet-600 transition-colors">
                        <Mail size={18} />
                      </div>
                      <input
                        type="email"
                        name="email"
                        required
                        inputMode="email"
                        autoComplete="email"
                        placeholder="Business Email"
                        className="w-full pl-12 pr-28 py-4 bg-slate-50 border-2 border-transparent rounded-lg text-sm font-bold text-slate-700 outline-none focus:bg-white focus:border-slate-200 transition-all placeholder:text-slate-500"
                        value={formData.email}
                        onChange={handleChange}
                      />
                      {!isLogin && (
                        <button
                          type="button"
                          onClick={() => handleSendVerificationOtp("email")}
                          disabled={
                            verifications.email.isSending ||
                            verifications.email.status === "verified" ||
                            !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email || "")
                          }
                          className={`absolute right-3 top-1/2 -translate-y-1/2 px-3 py-1.5 rounded-md text-[10px] font-black uppercase tracking-wider transition-all ${verifications.email.status === "verified"
                            ? "bg-brand-100 text-brand-700 cursor-default"
                            : "bg-slate-900 text-white hover:bg-black disabled:opacity-50 disabled:cursor-not-allowed"
                            }`}>
                          {verifications.email.isSending ? (
                            <Loader2 className="h-3.5 w-3.5 animate-spin" />
                          ) : verifications.email.status === "verified" ? (
                            "Verified"
                          ) : verifications.email.isOtpVisible ? (
                            "Resend"
                          ) : (
                            "Verify"
                          )}
                        </button>
                      )}
                    </div>
                    {!isLogin && verifications.email.isOtpVisible && verifications.email.status !== "verified" && (
                      <div className="flex items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2">
                        <input
                          type="text"
                          inputMode="numeric"
                          maxLength={4}
                          placeholder="Enter email OTP"
                          value={verifications.email.otp}
                          onChange={(e) =>
                            updateVerificationState("email", {
                              otp: e.target.value.replace(/\D/g, "").slice(0, 4),
                            })
                          }
                          className="flex-1 bg-transparent text-sm font-bold text-slate-700 outline-none placeholder:text-slate-500"
                        />
                        <button
                          type="button"
                          onClick={() => handleVerifyOtp("email")}
                          disabled={verifications.email.isVerifying || verifications.email.otp.length !== 4}
                          className="rounded-md bg-white px-3 py-1.5 text-[10px] font-black uppercase tracking-wider text-slate-700 shadow-sm ring-1 ring-slate-200 hover:bg-slate-100 disabled:opacity-50"
                        >
                          {verifications.email.isVerifying ? "Checking..." : "Confirm OTP"}
                        </button>
                      </div>
                    )}
                    {!isLogin && verifications.email.status === "verified" && (
                      <div className="flex items-center gap-2 text-[11px] font-bold text-brand-600">
                        <CheckCircle className="h-4 w-4" />
                        <span>Email verified successfully.</span>
                      </div>
                    )}

                    {!isLogin && (
                      <>
                        <div className="relative group">
                          <div className="absolute left-5 top-1/2 -translate-y-1/2 text-slate-300 group-focus-within:text-violet-600 transition-colors">
                            <Phone size={18} />
                          </div>
                          <input
                            type="tel"
                            name="phone"
                            required
                            placeholder="Contact Number"
                            className="w-full pl-12 pr-28 py-4 bg-slate-50 border-2 border-transparent rounded-lg text-sm font-bold text-slate-700 outline-none focus:bg-white focus:border-slate-200 transition-all placeholder:text-slate-500"
                            value={formData.phone}
                            onChange={handleChange}
                          />
                          <button
                            type="button"
                            onClick={() => handleSendVerificationOtp("phone")}
                            disabled={
                              verifications.phone.isSending ||
                              verifications.phone.status === "verified" ||
                              !/^[0-9]{10}$/.test(formData.phone || "")
                            }
                            className={`absolute right-3 top-1/2 -translate-y-1/2 px-3 py-1.5 rounded-md text-[10px] font-black uppercase tracking-wider transition-all ${verifications.phone.status === "verified"
                              ? "bg-brand-100 text-brand-700 cursor-default"
                              : "bg-slate-900 text-white hover:bg-black disabled:opacity-50 disabled:cursor-not-allowed"
                              }`}>
                            {verifications.phone.isSending ? (
                              <Loader2 className="h-3.5 w-3.5 animate-spin" />
                            ) : verifications.phone.status === "verified" ? (
                              "Verified"
                            ) : verifications.phone.isOtpVisible ? (
                              "Resend"
                            ) : (
                              "Verify"
                            )}
                          </button>
                        </div>
                        {verifications.phone.isOtpVisible && verifications.phone.status !== "verified" && (
                          <div className="flex items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2">
                            <input
                              type="text"
                              inputMode="numeric"
                              maxLength={4}
                              placeholder="Enter phone OTP"
                              value={verifications.phone.otp}
                              onChange={(e) =>
                                updateVerificationState("phone", {
                                  otp: e.target.value.replace(/\D/g, "").slice(0, 4),
                                })
                              }
                              className="flex-1 bg-transparent text-sm font-bold text-slate-700 outline-none placeholder:text-slate-500"
                            />
                            <button
                              type="button"
                              onClick={() => handleVerifyOtp("phone")}
                              disabled={verifications.phone.isVerifying || verifications.phone.otp.length !== 4}
                              className="rounded-md bg-white px-3 py-1.5 text-[10px] font-black uppercase tracking-wider text-slate-700 shadow-sm ring-1 ring-slate-200 hover:bg-slate-100 disabled:opacity-50"
                            >
                              {verifications.phone.isVerifying ? "Checking..." : "Confirm OTP"}
                            </button>
                          </div>
                        )}
                        {verifications.phone.status === "verified" && (
                          <div className="flex items-center gap-2 text-[11px] font-bold text-brand-600">
                            <CheckCircle className="h-4 w-4" />
                            <span>Phone number verified successfully.</span>
                          </div>
                        )}
                      </>
                    )}

                    <div className="relative group">
                      <div className="absolute left-5 top-1/2 -translate-y-1/2 text-slate-300 group-focus-within:text-violet-600 transition-colors">
                        <Lock size={18} />
                      </div>
                      <input
                        type={showPassword ? "text" : "password"}
                        name="password"
                        required
                        minLength={6}
                        autoComplete="current-password"
                        placeholder="Enter your password"
                        className="w-full pl-12 pr-14 py-4 bg-slate-50 border-2 border-transparent rounded-lg text-sm font-bold text-slate-700 outline-none focus:bg-white focus:border-slate-200 transition-all placeholder:text-slate-500"
                        value={formData.password}
                        onChange={handleChange}
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute right-5 top-1/2 -translate-y-1/2 text-slate-300 hover:text-slate-600 transition-colors px-2"
                        tabIndex="-1">
                        {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                      </button>
                    </div>
                  </>
                )}

                {/* SIGNUP STEP 2 (Shop address and service area) */}
                {!isLogin && signupStep === 2 && (
                  <div className="space-y-4">
                    <div className="pt-2">
                      <p className="text-sm font-black text-slate-600 uppercase tracking-widest mb-3">
                        Shop Location & Service Area
                      </p>
                      <button
                        type="button"
                        onClick={() => setIsMapOpen(true)}
                        className={`w-full flex items-center justify-between p-4 rounded-lg border-2 border-dashed transition-all cursor-pointer ${formData.lat
                          ? "border-brand-200 bg-brand-50/50"
                          : "border-slate-200 bg-slate-50 hover:border-slate-300"
                          }`}>
                        <div className="flex items-center gap-3">
                          <div
                            className={`p-2 rounded-md ${formData.lat ? "bg-brand-100 text-brand-600" : "bg-white text-slate-600 shadow-sm"}`}>
                            {formData.lat ? (
                              <CheckCircle className="w-4 h-4" />
                            ) : (
                              <MapPin className="w-4 h-4" />
                            )}
                          </div>
                          <div className="text-left">
                            <p
                              className={`text-xs font-bold ${formData.lat ? "text-brand-700" : "text-slate-600"}`}>
                              {formData.lat
                                ? "Location Selected"
                                : "Pin Shop on Map"}
                            </p>
                            <p className="text-xs text-slate-600 font-medium truncate max-w-[250px]">
                              {formData.lat
                                ? `${formData.address} (${formData.radius}km)`
                                : "Precisely mark your shop location"}
                            </p>
                          </div>
                        </div>
                        {formData.lat && (
                          <span className="text-[10px] font-black text-brand-600 bg-brand-100 px-2 py-0.5 rounded-full uppercase tracking-tighter">
                            Verified
                          </span>
                        )}
                      </button>
                    </div>

                    <div className="pt-2">
                      <p className="text-sm font-black text-slate-600 uppercase tracking-widest mb-3">
                        Service Coverage Type
                      </p>
                      <div className="grid grid-cols-2 gap-y-3 gap-x-6 mb-4">
                        {[
                          { id: "hyperlocal", label: "Hyperlocal (Near Shop)" },
                          { id: "pan_india", label: "Pan India" },
                          { id: "zone_wise", label: "Zone-wise" },
                          { id: "all", label: "All Coverage Options" },
                        ].map((option) => {
                          const isSelected = getCleanCoverage(serviceCoverage).includes(option.id);

                          return (
                            <label
                              key={option.id}
                              className="flex items-center gap-2 cursor-pointer select-none"
                            >
                              <input
                                type="checkbox"
                                checked={isSelected}
                                onChange={() => handleCoverageToggle(option.id)}
                                className="w-4 h-4 accent-orange-500 cursor-pointer"
                              />
                              <span className="text-sm font-semibold text-slate-700">{option.label}</span>
                            </label>
                          );
                        })}
                      </div>

                      {/* Custom Zones Builder Section */}
                      {serviceCoverage.includes("zone_wise") && (
                        <div className="border border-slate-200 rounded-xl p-4 bg-white space-y-4 mb-4 shadow-sm animate-in fade-in duration-200">
                          <p className="text-xs font-black text-slate-700 uppercase tracking-wider">
                            Manage Dynamic Zones
                          </p>
                          <div className="grid grid-cols-2 gap-2">
                            <input
                              type="text"
                              placeholder="Zone Name (e.g. East Delhi)"
                              value={newZoneName}
                              onChange={(e) => setNewZoneName(e.target.value)}
                              className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs font-bold text-slate-700 outline-none focus:bg-white focus:border-slate-300 transition-all"
                            />
                            <input
                              type="text"
                              placeholder="City"
                              value={newZoneCity}
                              onChange={(e) => setNewZoneCity(e.target.value)}
                              className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs font-bold text-slate-700 outline-none focus:bg-white focus:border-slate-300 transition-all"
                            />
                          </div>
                          <button
                            type="button"
                            onClick={(e) => {
                              e.preventDefault();
                              e.stopPropagation();
                              handleAddZone();
                            }}
                            className="w-full py-2 bg-slate-900 text-white hover:bg-black rounded-lg text-xs font-black uppercase tracking-wider transition-colors"
                          >
                            Add New Zone
                          </button>

                          {/* Render Added Zones */}
                          {formData.customZones?.length > 0 ? (
                            <div className="space-y-3 pt-2">
                              {formData.customZones.map((zone, zIdx) => (
                                <div key={zIdx} className="border border-slate-100 rounded-lg p-3 bg-slate-50/50 space-y-2 relative">
                                  <button
                                    type="button"
                                    onClick={(e) => {
                                      e.preventDefault();
                                      e.stopPropagation();
                                      handleRemoveZone(zIdx);
                                    }}
                                    className="absolute right-2 top-2 text-slate-400 hover:text-red-500 transition-colors"
                                  >
                                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                                  </button>
                                  <div>
                                    <p className="text-xs font-bold text-slate-800">{zone.name}</p>
                                    <p className="text-[10px] font-medium text-slate-500">{zone.city}</p>
                                  </div>

                                  {/* Areas tag list */}
                                  <div className="flex flex-wrap gap-1">
                                    {(zone.areas || []).map((area, aIdx) => (
                                      <span key={aIdx} className="inline-flex items-center gap-1 bg-white border border-slate-200 text-slate-700 px-2 py-0.5 rounded-full text-[10px] font-bold">
                                        {area}
                                        <button
                                          type="button"
                                          onClick={(e) => {
                                            e.preventDefault();
                                            e.stopPropagation();
                                            handleRemoveAreaFromZone(zIdx, aIdx);
                                          }}
                                          className="text-slate-400 hover:text-red-500"
                                        >
                                          &times;
                                        </button>
                                      </span>
                                    ))}
                                  </div>

                                  {/* Add Area/Pincode to Zone */}
                                  <div className="flex gap-1.5 mt-2">
                                    <input
                                      type="text"
                                      placeholder="Add area or pincode..."
                                      value={editingZoneIndex === zIdx ? newAreaInput : ""}
                                      onChange={(e) => {
                                        setEditingZoneIndex(zIdx);
                                        setNewAreaInput(e.target.value);
                                      }}
                                      onKeyDown={(e) => {
                                        if (e.key === "Enter") {
                                          e.preventDefault();
                                          e.stopPropagation();
                                          handleAddAreaToZone(zIdx);
                                        }
                                      }}
                                      className="flex-1 px-2.5 py-1 bg-white border border-slate-200 rounded-md text-[11px] font-bold text-slate-700 outline-none"
                                    />
                                    <button
                                      type="button"
                                      onClick={(e) => {
                                        e.preventDefault();
                                        e.stopPropagation();
                                        handleAddAreaToZone(zIdx);
                                      }}
                                      className="px-3 py-1 bg-slate-800 text-white rounded-md text-[10px] font-bold hover:bg-black transition-colors"
                                    >
                                      Add
                                    </button>
                                  </div>
                                </div>
                              ))}
                            </div>
                          ) : (
                            <p className="text-[11px] text-slate-400 text-center py-2 font-medium">
                              No custom zones added yet. Add one above.
                            </p>
                          )}
                        </div>
                      )}
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="relative group">
                        <div className="absolute left-5 top-1/2 -translate-y-1/2 text-slate-300 group-focus-within:text-violet-600 transition-colors">
                          <MapPin size={18} />
                        </div>
                        <input
                          type="text"
                          name="locality"
                          required
                          placeholder="Locality / Area"
                          className="w-full pl-12 pr-6 py-4 bg-slate-50 border-2 border-transparent rounded-lg text-sm font-bold text-slate-700 outline-none focus:bg-white focus:border-slate-200 transition-all placeholder:text-slate-500"
                          value={formData.locality}
                          onChange={handleChange}
                        />
                      </div>
                      <div className="relative group">
                        <div className="absolute left-5 top-1/2 -translate-y-1/2 text-slate-300 group-focus-within:text-violet-600 transition-colors">
                          <MapPin size={18} />
                        </div>
                        <input
                          type="text"
                          name="pincode"
                          required
                          placeholder="Pincode"
                          className="w-full pl-12 pr-6 py-4 bg-slate-50 border-2 border-transparent rounded-lg text-sm font-bold text-slate-700 outline-none focus:bg-white focus:border-slate-200 transition-all placeholder:text-slate-500"
                          value={formData.pincode}
                          onChange={handleChange}
                        />
                      </div>
                      <div className="relative group">
                        <div className="absolute left-5 top-1/2 -translate-y-1/2 text-slate-300 group-focus-within:text-violet-600 transition-colors">
                          <MapPin size={18} />
                        </div>
                        <input
                          type="text"
                          name="city"
                          required
                          placeholder="City"
                          className="w-full pl-12 pr-6 py-4 bg-slate-50 border-2 border-transparent rounded-lg text-sm font-bold text-slate-700 outline-none focus:bg-white focus:border-slate-200 transition-all placeholder:text-slate-500"
                          value={formData.city}
                          onChange={handleChange}
                        />
                      </div>
                      <div className="relative group">
                        <div className="absolute left-5 top-1/2 -translate-y-1/2 text-slate-300 group-focus-within:text-violet-600 transition-colors">
                          <MapPin size={18} />
                        </div>
                        <input
                          type="text"
                          name="state"
                          required
                          placeholder="State"
                          className="w-full pl-12 pr-6 py-4 bg-slate-50 border-2 border-transparent rounded-lg text-sm font-bold text-slate-700 outline-none focus:bg-white focus:border-slate-200 transition-all placeholder:text-slate-500"
                          value={formData.state}
                          onChange={handleChange}
                        />
                      </div>
                    </div>

                    <div className="relative group">
                      <div className="absolute left-5 top-5 text-slate-300 group-focus-within:text-violet-600 transition-colors">
                        <MapPin size={18} />
                      </div>
                      <textarea
                        name="address"
                        rows={3}
                        required
                        placeholder="Full address"
                        className="w-full pl-12 pr-6 py-4 bg-slate-50 border-2 border-transparent rounded-lg text-sm font-bold text-slate-700 outline-none focus:bg-white focus:border-slate-200 transition-all placeholder:text-slate-500 resize-none"
                        value={formData.address}
                        onChange={handleChange}
                      />
                    </div>

                    <div className="flex items-start gap-3 p-4 bg-slate-50 rounded-lg border-2 border-transparent">
                      <input
                        type="checkbox"
                        name="isPickupPointEligible"
                        id="isPickupPointEligible"
                        checked={formData.isPickupPointEligible}
                        onChange={(e) => setFormData(prev => ({ ...prev, isPickupPointEligible: e.target.checked }))}
                        className="mt-0.5 w-5 h-5 rounded text-brand-600 focus:ring-brand-500 border-slate-300 cursor-pointer"
                      />
                      <label htmlFor="isPickupPointEligible" className="text-sm font-bold text-slate-700 cursor-pointer select-none">
                        Pickup Point Eligible
                        <p className="text-xs font-medium text-slate-500 mt-0.5">Select if this address is also a pickup point for delivery partners or customers.</p>
                      </label>
                    </div>
                  </div>
                )}

                {/* SIGNUP STEP 3 (Verification documents) */}
                {!isLogin && signupStep === 3 && (
                  <div className="space-y-4">
                    <div className="pt-2">
                      <p className="text-sm font-black text-slate-600 uppercase tracking-widest mb-3">
                        Verification Documents
                      </p>
                      <div className="space-y-3">
                        {REQUIRED_DOCUMENT_CONFIG.map((doc) => (
                          <div key={doc.id} className="relative">
                            <input
                              type="file"
                              id={doc.id}
                              ref={(el) => fileInputRefs.current[doc.id] = el}
                              className="hidden"
                              accept="image/*,.pdf"
                              onChange={(e) => handleDocumentChange(e, doc.id)}
                            />
                            {doc.id === 'aadharCardFront' || doc.id === 'aadharCardBack' || doc.id === 'panCard' ? (
                              <button
                                type="button"
                                onClick={() => setActiveDocAction(doc.id)}
                                className={`w-full flex items-center justify-between p-3.5 rounded-lg border-2 border-dashed transition-all cursor-pointer ${documents[doc.id]
                                  ? "border-brand-200 bg-brand-50/50"
                                  : "border-slate-200 bg-slate-50 hover:border-slate-300"
                                  }`}>
                                <div className="flex items-center gap-3">
                                  <div
                                    className={`relative flex items-center justify-center overflow-hidden rounded-md ${documents[doc.id] ? "w-10 h-10 bg-brand-100 text-brand-600 shrink-0" : "p-2 bg-white text-slate-600 shadow-sm shrink-0"}`}>
                                    {documents[doc.id] ? (
                                      documents[doc.id].type?.startsWith('image/') ? (
                                        <img src={URL.createObjectURL(documents[doc.id])} alt="preview" className="w-full h-full object-cover" />
                                      ) : (
                                        <CheckCircle className="w-5 h-5" />
                                      )
                                    ) : (
                                      <Upload className="w-4 h-4" />
                                    )}
                                  </div>
                                  <div className="text-left">
                                    <p
                                      className={`text-xs font-bold ${documents[doc.id] ? "text-brand-700" : "text-slate-600"}`}>
                                      {doc.label}
                                    </p>
                                    <p className="text-xs text-slate-600 font-medium truncate max-w-[150px]">
                                      {documents[doc.id]
                                        ? documents[doc.id].name
                                        : "Tap to capture or upload"}
                                    </p>
                                  </div>
                                </div>
                              </button>
                            ) : (
                              <label
                                htmlFor={doc.id}
                                className={`flex items-center justify-between p-3.5 rounded-lg border-2 border-dashed transition-all cursor-pointer ${documents[doc.id]
                                  ? "border-brand-200 bg-brand-50/50"
                                  : "border-slate-200 bg-slate-50 hover:border-slate-300"
                                  }`}>
                                <div className="flex items-center gap-3">
                                  <div
                                    className={`relative flex items-center justify-center overflow-hidden rounded-md ${documents[doc.id] ? "w-10 h-10 bg-brand-100 text-brand-600 shrink-0" : "p-2 bg-white text-slate-600 shadow-sm shrink-0"}`}>
                                    {documents[doc.id] ? (
                                      documents[doc.id].type?.startsWith('image/') ? (
                                        <img src={URL.createObjectURL(documents[doc.id])} alt="preview" className="w-full h-full object-cover" />
                                      ) : (
                                        <CheckCircle className="w-5 h-5" />
                                      )
                                    ) : (
                                      <Upload className="w-4 h-4" />
                                    )}
                                  </div>
                                  <div className="text-left">
                                    <p
                                      className={`text-xs font-bold ${documents[doc.id] ? "text-brand-700" : "text-slate-600"}`}>
                                      {doc.label}
                                    </p>
                                    <p className="text-xs text-slate-600 font-medium truncate max-w-[150px]">
                                      {documents[doc.id]
                                        ? documents[doc.id].name
                                        : "Upload secure PDF or image"}
                                    </p>
                                  </div>
                                </div>
                              </label>
                            )}
                            {doc.id === "other" && (
                              <div className="mt-2 flex items-start gap-3 p-3 bg-amber-50 border border-amber-200 rounded-lg">
                                <div className="flex-shrink-0 mt-0.5">
                                  <svg className="w-4 h-4 text-amber-500" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                                </div>
                                <div className="flex-1">
                                  <label className="block text-[10px] font-black text-amber-700 uppercase tracking-wider mb-1">
                                    📅 Certificate Expiry Date
                                  </label>
                                  <p className="text-[9px] text-amber-600 font-medium mb-2">Enter expiry date — you will receive a real-time alert notification before it expires</p>
                                  <input
                                    type="date"
                                    name="otherDocumentExpiryDate"
                                    min={new Date().toISOString().split('T')[0]}
                                    className="w-full px-3 py-2 text-sm font-bold text-slate-700 bg-white border-2 border-amber-200 rounded-lg outline-none focus:border-amber-400 transition-all"
                                    value={formData.otherDocumentExpiryDate}
                                    onChange={handleChange}
                                  />
                                </div>
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                )}

                <div className="flex gap-3 pt-2">
                  {!isLogin && signupStep > 1 && (
                    <button
                      type="button"
                      onClick={() => setSignupStep((prev) => Math.max(1, prev - 1))}
                      className="w-1/3 bg-slate-100 text-slate-600 rounded-lg py-4 text-sm font-black tracking-[2px] transition-all hover:bg-slate-200">
                      BACK
                    </button>
                  )}
                  <button
                    type="submit"
                    disabled={isLoading}
                    className={`${!isLogin && signupStep > 1 ? "w-2/3" : "w-full"} bg-slate-900 text-white rounded-lg py-4 text-sm font-black tracking-[2px] shadow-[0_25px_50px_-12px_rgba(0,0,0,0.3)] hover:bg-black transition-all active:scale-[0.98] disabled:opacity-50 flex items-center justify-center gap-3 group`}>
                    {isLoading
                      ? "WORKING..."
                      : isLogin
                        ? "ENTER DASHBOARD"
                        : signupStep < 3
                          ? "NEXT STEP"
                          : "SUBMIT APPLICATION"}
                    <ArrowRight
                      className="group-hover:translate-x-2 transition-transform"
                      size={20}
                    />
                  </button>
                </div>
              </form>

              <div className="pt-1 border-t border-slate-50 flex flex-col items-center gap-1">
                <p className="text-slate-600 font-bold text-sm">
                  {isLogin ? "New to the platform?" : "Already part of us?"}{" "}
                  <button
                    onClick={() => {
                      setIsLogin(!isLogin);
                      setSignupStep(1);
                      setVerifications({
                        email: createInitialVerificationState(),
                        phone: createInitialVerificationState(),
                      });
                    }}
                    className="text-slate-900 hover:text-black transition-colors px-2">
                    {isLogin ? "Register Store" : "Sign In"}
                  </button>
                </p>
              </div>
            </motion.div>
          </AnimatePresence>
        </div>
      </motion.div>

      {/* Bottom Tagline */}
      <div className="absolute bottom-6 flex items-center gap-4 text-slate-300 text-[10px] font-black uppercase tracking-[6px]">
        Empowering Business Digitalization
      </div>

      <AnimatePresence>
        {activeDocAction && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 backdrop-blur-sm sm:items-center p-4"
            onClick={() => setActiveDocAction(null)}
          >
            <motion.div
              initial={{ y: "100%" }}
              animate={{ y: 0 }}
              exit={{ y: "100%" }}
              onClick={(e) => e.stopPropagation()}
              className="w-full max-w-sm overflow-hidden rounded-t-2xl sm:rounded-2xl bg-white shadow-2xl"
            >
              <div className="p-4 border-b text-center border-slate-100">
                <h3 className="font-bold text-slate-800">Select Upload Option</h3>
              </div>
              <div className="p-2 space-y-2">
                <button
                  type="button"
                  onClick={() => handleCameraCapture(activeDocAction)}
                  className="w-full p-4 flex items-center justify-center gap-3 text-brand-600 bg-brand-50 hover:bg-brand-100 rounded-xl font-bold transition-colors"
                >
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
                  Take Photo
                </button>
                <button
                  type="button"
                  onClick={() => {
                    fileInputRefs.current[activeDocAction]?.click();
                    setActiveDocAction(null);
                  }}
                  className="w-full p-4 flex items-center justify-center gap-3 text-slate-700 bg-slate-50 hover:bg-slate-100 rounded-xl font-bold transition-colors"
                >
                  <Upload className="w-5 h-5" />
                  Upload from Gallery
                </button>
                <button
                  type="button"
                  onClick={() => setActiveDocAction(null)}
                  className="w-full p-4 mt-2 flex items-center justify-center gap-3 text-red-500 hover:bg-red-50 rounded-xl font-bold transition-colors"
                >
                  Cancel
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {isMapOpen && (
        <MapPicker
          isOpen={isMapOpen}
          onClose={() => setIsMapOpen(false)}
          onConfirm={handleLocationSelect}
          preferCurrentLocationOnOpen={true}
          initialLocation={
            formData.lat ? { lat: formData.lat, lng: formData.lng } : null
          }
          initialRadius={formData.radius}
        />
      )}
    </div>
  );
};

export default Auth;
