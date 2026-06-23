import mongoose from "mongoose";

const cateringBookingSchema = new mongoose.Schema(
    {
        bookingId: {
            type: String,
            required: true,
            unique: true,
            default: () => {
                const randomPart = Math.floor(1000 + Math.random() * 9000);
                return `CAT-${Date.now().toString().slice(-6)}${randomPart}`;
            }
        },
        customerName: { type: String, required: true, trim: true },
        mobileNumber: { type: String, required: true, trim: true },
        email: { type: String, trim: true, default: "" },
        eventDate: { type: Date, required: true },
        eventTime: { type: String, trim: true, default: "" },
        eventAddress: { type: String, required: true, trim: true },
        numberOfGuests: { type: Number, required: true },
        serviceId: { type: mongoose.Schema.Types.ObjectId, ref: "CateringService", required: false },
        packageId: { type: mongoose.Schema.Types.ObjectId, ref: "CateringPackage", required: false },
        specialInstructions: { type: String, trim: true, default: "" },
        status: {
            type: String,
            enum: ["Pending", "Confirmed", "In Progress", "Completed", "Cancelled"],
            default: "Pending"
        },
        packageAmount: { type: Number, default: 0 },
        paidAmount: { type: Number, default: 0 },
        pendingAmount: { type: Number, default: 0 },
        paymentStatus: {
            type: String,
            enum: ["Pending", "Partial", "Paid", "Refunded"],
            default: "Pending"
        },
        statusHistory: [
            {
                status: { type: String },
                timestamp: { type: Date, default: Date.now },
                note: { type: String, default: "" }
            }
        ]
    },
    { timestamps: true }
);

cateringBookingSchema.index({ bookingId: 1 });
cateringBookingSchema.index({ mobileNumber: 1 });
cateringBookingSchema.index({ status: 1 });
cateringBookingSchema.index({ eventDate: 1 });

// Middleware to keep pendingAmount updated
cateringBookingSchema.pre("save", function (next) {
    if (this.isModified("packageAmount") || this.isModified("paidAmount")) {
        this.pendingAmount = Math.max(0, (this.packageAmount || 0) - (this.paidAmount || 0));
        
        if (this.pendingAmount === 0 && this.packageAmount > 0) {
            this.paymentStatus = "Paid";
        } else if (this.paidAmount > 0 && this.pendingAmount > 0) {
            this.paymentStatus = "Partial";
        } else if (this.paidAmount === 0) {
            this.paymentStatus = "Pending";
        }
    }
    
    // Add initial status history if new
    if (this.isNew && (!this.statusHistory || this.statusHistory.length === 0)) {
        this.statusHistory = [{ status: this.status || "Pending", timestamp: new Date(), note: "Booking Created" }];
    }
    
    next();
});

export default mongoose.model("CateringBooking", cateringBookingSchema);
