import mongoose from "mongoose";
import bcrypt from "bcrypt";

const sellerSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
    },

    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
    },

    phone: {
      type: String,
      required: true,
      unique: true,
    },

    password: {
      type: String,
      required: true,
      select: false,
    },

    shopName: {
      type: String,
      required: true,
      trim: true,
    },

    category: {
      type: String,
      trim: true,
    },

    mainProducts: {
      type: String,
      trim: true,
    },

    description: {
      type: String,
      trim: true,
    },

    address: {
      type: String,
      trim: true,
    },
    locality: {
      type: String,
      trim: true,
    },
    pincode: {
      type: String,
      trim: true,
    },
    city: {
      type: String,
      trim: true,
    },
    state: {
      type: String,
      trim: true,
    },

    documents: {
      tradeLicense: { type: String, trim: true },
      gstCertificate: { type: String, trim: true },
      idProof: { type: String, trim: true }, // Retained for backwards compatibility
      aadharCardFront: { type: String, trim: true },
      aadharCardBack: { type: String, trim: true },
      panCard: { type: String, trim: true },
      businessRegistration: { type: String, trim: true },
      fssaiLicense: { type: String, trim: true },
      other: { type: String, trim: true },
    },

    role: {
      type: String,
      default: "seller",
    },

    isVerified: {
      type: Boolean,
      default: false,
    },

    emailVerified: {
      type: Boolean,
      default: false,
    },

    phoneVerified: {
      type: Boolean,
      default: false,
    },

    applicationStatus: {
      type: String,
      enum: ["pending", "approved", "rejected", "bounced_back"],
      default: "pending",
    },

    reviewedAt: {
      type: Date,
    },

    reviewedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Admin",
    },

    rejectionReason: {
      type: String,
      trim: true,
    },

    isActive: {
      type: Boolean,
      default: false,
    },
    isPickupPointEligible: {
      type: Boolean,
      default: false,
    },
    location: {
      type: {
        type: String,
        enum: ["Point"],
        default: "Point",
      },
      coordinates: {
        type: [Number],
        default: [0, 0],
      },
    },
    serviceRadius: {
      type: Number,
      default: 5, // Default 5km
    },
    serviceCoverage: {
      type: [String],
      enum: ["hyperlocal", "pan_india", "zone_wise"],
      default: ["hyperlocal"],
    },
    customZones: [
      {
        name: { type: String, trim: true },
        city: { type: String, trim: true },
        areas: [{ type: String, trim: true }],
      },
    ],
    // Event Seller Specific Fields
    isEventSeller: {
      type: Boolean,
      default: false
    },
    hasProductAccess: {
      type: Boolean,
      default: true
    },
    serviceCategories: [{
      type: mongoose.Schema.Types.ObjectId,
      ref: 'EventCategory'
    }],
    maxEventsPerDay: {
      type: Number,
      default: 2
    },
    maxGuestCapacity: {
      type: Number,
      default: 500
    },
    businessTimings: {
      start: { type: String, default: "09:00" },
      end: { type: String, default: "22:00" }
    },
    emergencyBookingAvailable: {
      type: Boolean,
      default: false
    },
    autoAcceptBookings: {
      type: Boolean,
      default: false
    },
    sellerStatus: {
      type: String,
      enum: ['active', 'inactive', 'on_leave'],
      default: 'active'
    },
    sellerVerificationStatus: {
      type: String,
      enum: ['pending', 'verified', 'rejected'],
      default: 'pending'
    },
    commissionRate: {
      type: Number,
      default: 10
    },
    // --- RELIABILITY ENGINE FIELDS ---
    totalRequests: {
      type: Number,
      default: 0
    },
    acceptedRequests: {
      type: Number,
      default: 0
    },
    rejectedRequests: {
      type: Number,
      default: 0
    },
    avgResponseTimeMins: {
      type: Number,
      default: 0
    },
    reliabilityScore: {
      type: Number,
      default: 100 // Out of 100
    },
    // ---------------------------------
    // Module Permissions
    retailEnabled: {
      type: Boolean,
      default: true
    },
    planMyEventEnabled: {
      type: Boolean,
      default: false
    },
    allowCustomProductEntry: {
      type: Boolean,
      default: false
    },
    liveKitchenEnabled: {
      type: Boolean,
      default: false
    },
    customizationEngineEnabled: {
      type: Boolean,
      default: false
    },
    advanceBookingEnabled: {
      type: Boolean,
      default: false
    },
    addonDecorationEnabled: {
      type: Boolean,
      default: false
    },
    addonDecorationPrice: {
      type: Number,
      default: 0
    },
    addonBridalEnabled: {
      type: Boolean,
      default: false
    },
    addonBridalPrice: {
      type: Number,
      default: 0
    },
    addonCateringEnabled: {
      type: Boolean,
      default: false
    },
    addonCateringPrice: {
      type: Number,
      default: 0
    },
    physicalPaymentEnabled: {
      type: Boolean,
      default: false
    },
    paymentQrCode: {
      type: String,
      default: ""
    },
    customerImageReviewEnabled: {
      type: Boolean,
      default: false
    },
    quoteReferencePhotoUpload: {
      type: Boolean,
      default: false
    },
    quoteThemeSelection: {
      type: Boolean,
      default: false
    },
    quoteColorCombination: {
      type: Boolean,
      default: false
    },
    quoteBudgetSelection: {
      type: Boolean,
      default: false
    },
    quoteCustomerNotes: {
      type: Boolean,
      default: false
    },
    quoteSellerQuotation: {
      type: Boolean,
      default: false
    },
    quoteQuoteRevision: {
      type: Boolean,
      default: false
    },
    quoteCustomerApproval: {
      type: Boolean,
      default: false
    },
    quoteAdvancePayment: {
      type: Boolean,
      default: false
    },
    quoteFinalPayment: {
      type: Boolean,
      default: false
    },
    categoriesEnabled: {
      type: Boolean,
      default: true
    },
    bookingSlotsEnabled: {
      type: Boolean,
      default: false
    },
    productsEnabled: {
      type: Boolean,
      default: true
    },
    stockEnabled: {
      type: Boolean,
      default: true
    },
    ordersEnabled: {
      type: Boolean,
      default: true
    },
    walletEnabled: {
      type: Boolean,
      default: true
    },
    analyticsEnabled: {
      type: Boolean,
      default: true
    },
    wholesaleEnabled: {
      type: Boolean,
      default: false
    },
    allowedRetailCategories: [{
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Category'
    }],
    allowedWholesaleCategories: [{
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Category'
    }],
    allowedEventCategories: [{
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Category'
    }],
    reviewCategoriesEnabled: [{
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Category'
    }],
    cancellationPolicies: [{
      categoryId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Category'
      },
      rules: [{
        hoursBefore: { type: Number, required: true },
        refundPercentage: { type: Number, required: true }
      }]
    }],
    // Admin Review Remark (shown to seller after review)
    adminRemark: {
      type: String,
      trim: true,
      default: ''
    },
    // Admin Terms & Conditions (shown to seller)
    adminTerms: {
      type: String,
      trim: true,
      default: ''
    },
    advancePaymentPercentage: {
      type: Number,
      default: 0
    },
    // ---------------------------------
    bankDetails: {
      bankName: { type: String, trim: true },
      accountNo: { type: String, trim: true },
      ifscCode: { type: String, trim: true }
    },
    
    otherDocumentExpiryDate: {
      type: Date,
    },
    lastExpiryNotificationSentAt: {
      type: Date,
    },

    fcmtoken: {
      type: String,
      trim: true,
      default: "",
    },
    fcmtokenMobile: {
      type: String,
      trim: true,
      default: "",
    },
    lastLogin: Date,
  },
  { timestamps: true },
);

sellerSchema.index({ location: "2dsphere" });
sellerSchema.index({ isActive: 1, isVerified: 1 });

// Hash password before saving
sellerSchema.pre("save", async function (next) {
  if (!this.isModified("password")) return next();
  const salt = await bcrypt.genSalt(10);
  this.password = await bcrypt.hash(this.password, salt);
  next();
});

// Compare password
sellerSchema.methods.comparePassword = async function (enteredPassword) {
  return await bcrypt.compare(enteredPassword, this.password);
};

export default mongoose.model("Seller", sellerSchema);
