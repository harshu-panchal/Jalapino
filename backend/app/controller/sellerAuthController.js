import Seller from "../models/seller.js";
import jwt from "jsonwebtoken";
import handleResponse from "../utils/helper.js";
import {
    issueSellerVerificationOtp,
    verifySellerOtpCode,
    verifySellerVerificationToken,
} from "../services/sellerVerificationService.js";
import { saveRawFile } from "../services/localStorageService.js";

/* ===============================
   Utils
================================ */

const generateToken = (seller) =>
    jwt.sign({ id: seller._id, role: "seller" }, process.env.JWT_SECRET, {
        expiresIn: "3650d",
    });

const SELLER_DOCUMENT_FIELDS = {
    tradeLicense: "Trade License",
    gstCertificate: "GST Certificate",
    aadharCardFront: "Aadhar Card Front",
    aadharCardBack: "Aadhar Card Back",
    panCard: "PAN Card",
    idProof: "ID Proof (Aadhar & PAN Card)", // Retained for backwards compatibility
    other: "Other Documents",
};

const REQUIRED_SELLER_DOCUMENT_FIELDS = [
    "aadharCardFront",
    "aadharCardBack",
    "panCard",
];

const parseDocumentsPayload = (documents) => {
    if (!documents) {
        return {};
    }

    if (typeof documents === "string") {
        try {
            return JSON.parse(documents);
        } catch {
            return {};
        }
    }

    if (typeof documents === "object") {
        return documents;
    }

    return {};
};

const isValidUploadedDocumentReference = (value) => {
    const normalized = String(value || "").trim();
    return /^https?:\/\//i.test(normalized) || normalized.startsWith("/");
};

const resolveSellerDocuments = (body = {}, parsedDocuments = {}) => {
    const resolved = { ...(parsedDocuments || {}) };

    const directFields = {};
    for (const key of Object.keys(SELLER_DOCUMENT_FIELDS)) {
        directFields[key] = body[`${key}Url`] || body[key];
    }

    for (const [field, candidate] of Object.entries(directFields)) {
        const normalized = String(candidate || "").trim();
        if (normalized && (/^https?:\/\//i.test(normalized) || normalized.startsWith("/"))) {
            resolved[field] = normalized;
        }
    }

    return resolved;
};

const getMissingRequiredSellerDocuments = (documents = {}) =>
    REQUIRED_SELLER_DOCUMENT_FIELDS.filter(
        (fieldName) => !isValidUploadedDocumentReference(documents[fieldName]),
    );

/* ===============================
   SELLER SIGNUP
================================ */
export const signupSeller = async (req, res) => {
    try {
        const {
            name,
            email,
            phone,
            password,
            emailVerificationToken,
            phoneVerificationToken,
            shopName,
            category,
            mainProducts,
            otherDocumentExpiryDate,
            description,
            address,
            locality,
            pincode,
            city,
            state,
            documents,
            lat,
            lng,
            radius,
            isPickupPointEligible
        } = req.body || {};

        // 1. Handle file uploads if they exist in req.files (multipart form)
        const documentFiles = req.files || [];
        const uploadedDocs = {};

        if (Array.isArray(documentFiles) && documentFiles.length > 0) {
            for (const file of documentFiles) {
                try {
                    const fieldName = file.fieldname;
                    if (fieldName && Object.keys(SELLER_DOCUMENT_FIELDS).includes(fieldName)) {
                        let url = await saveRawFile(file.buffer, "docs", file.originalname);
                        
                        // Dynamically use the request's domain instead of .env to handle both localhost and live automatically
                        const reqDomain = `${req.protocol}://${req.get("host")}`;
                        const envDomain = process.env.API_DOMAIN || "http://localhost:7000";
                        
                        if (url.startsWith("/")) {
                            url = `${reqDomain}${url}`;
                        }
                        
                        // Only auto-replace if the saved URL is a localhost/host URL 
                        // If it's a proper live URL like https://jalpaino.com/api, keep it as is
                        if (url.includes("localhost") || url.includes("host:7000") || url.startsWith("http://10.0.2.2")) {
                            if (url.startsWith(envDomain)) {
                                url = url.replace(envDomain, reqDomain);
                            } else if (url.startsWith("host:7000")) {
                                url = url.replace("host:7000", reqDomain);
                            } else if (url.startsWith("http://host:7000")) {
                                url = url.replace("http://host:7000", reqDomain);
                            }
                        }

                        uploadedDocs[fieldName] = url;
                    }
                } catch (err) {
                    console.error("Failed to upload document to Cloudinary", err);
                }
            }
        }

        // Merge uploaded document URLs into body for resolveSellerDocuments
        const augmentedBody = {
            ...req.body,
            ...uploadedDocs
        };

        const parsedLat = lat !== undefined ? Number(lat) : undefined;
        const parsedLng = lng !== undefined ? Number(lng) : undefined;
        const parsedRadius = radius !== undefined ? Number(radius) : undefined;

        if (!name || !email || !phone || !password || !shopName) {
            return handleResponse(res, 400, "All fields are required");
        }

        verifySellerVerificationToken({
            channel: "email",
            rawValue: email,
            token: emailVerificationToken,
        });
        verifySellerVerificationToken({
            channel: "phone",
            rawValue: phone,
            token: phoneVerificationToken,
        });

        // Validate coordinates and radius if provided
        if (lat !== undefined && (!Number.isFinite(parsedLat) || parsedLat < -90 || parsedLat > 90)) {
            return handleResponse(res, 400, "Invalid latitude");
        }
        if (lng !== undefined && (!Number.isFinite(parsedLng) || parsedLng < -180 || parsedLng > 180)) {
            return handleResponse(res, 400, "Invalid longitude");
        }
        if (radius !== undefined && (!Number.isFinite(parsedRadius) || parsedRadius < 1 || parsedRadius > 100)) {
            return handleResponse(res, 400, "Radius must be between 1 and 100 km");
        }

        let seller = await Seller.findOne({ $or: [{ email }, { phone }] });

        if (seller) {
            return handleResponse(res, 400, "Seller with this email or phone already exists");
        }

        const parsedDocuments = parseDocumentsPayload(documents);
        const sellerDocuments = resolveSellerDocuments(augmentedBody, parsedDocuments);
        const missingRequiredDocuments = getMissingRequiredSellerDocuments(
            sellerDocuments || {}
        );

        if (missingRequiredDocuments.length > 0) {
            const readableMissing = missingRequiredDocuments
                .map((field) => SELLER_DOCUMENT_FIELDS[field] || field)
                .join(", ");
            return handleResponse(
                res,
                400,
                `All required documents must be uploaded: ${readableMissing}`
            );
        }

        const sellerData = {
            name,
            email,
            phone,
            password,
            shopName,
            category,
            mainProducts,
            otherDocumentExpiryDate: otherDocumentExpiryDate || null,
            description,
            address,
            locality,
            pincode,
            city,
            state,
            documents: sellerDocuments,
            applicationStatus: "pending",
            isVerified: false,
            emailVerified: true,
            phoneVerified: true,
            isActive: false,
            isPickupPointEligible: isPickupPointEligible === true || isPickupPointEligible === 'true',
        };

        if (parsedLat !== undefined && parsedLng !== undefined) {
            sellerData.location = {
                type: "Point",
                coordinates: [parsedLng, parsedLat],
            };
        }

        if (parsedRadius !== undefined) {
            sellerData.serviceRadius = parsedRadius;
        }

        seller = await Seller.create(sellerData);

        return handleResponse(res, 201, "Seller registered successfully", {
            seller,
            applicationStatus: "pending",
            requiresApproval: true,
        });
    } catch (error) {
        return handleResponse(res, 500, error.message);
    }
};

export const sendSellerSignupOtp = async (req, res) => {
    try {
        const { channel, email, phone, value } = req.body || {};
        const targetValue =
            channel === "email"
                ? email || value
                : channel === "phone"
                    ? phone || value
                    : value;

        const result = await issueSellerVerificationOtp({
            channel,
            rawValue: targetValue,
            ipAddress: req.ip,
        });

        return handleResponse(res, 200, "OTP sent successfully", result);
    } catch (error) {
        return handleResponse(res, error.statusCode || 500, error.message);
    }
};

export const verifySellerSignupOtp = async (req, res) => {
    try {
        const { channel, email, phone, value, otp } = req.body || {};
        const targetValue =
            channel === "email"
                ? email || value
                : channel === "phone"
                    ? phone || value
                    : value;

        const result = await verifySellerOtpCode({
            channel,
            rawValue: targetValue,
            otp,
            ipAddress: req.ip,
        });

        return handleResponse(res, 200, "OTP verified successfully", result);
    } catch (error) {
        return handleResponse(res, error.statusCode || 500, error.message);
    }
};

/* ===============================
   SELLER LOGIN
================================ */
export const loginSeller = async (req, res) => {
    try {
        const { email, password } = req.body;

        if (!email || !password) {
            return handleResponse(res, 400, "Email and password are required");
        }

        // Include password for comparison
        const seller = await Seller.findOne({ email }).select("+password");

        if (!seller) {
            return handleResponse(res, 404, "Seller not found");
        }

        const isMatch = await seller.comparePassword(password);

        if (!isMatch) {
            return handleResponse(res, 401, "Invalid credentials");
        }

        const applicationStatus =
            seller.applicationStatus || (seller.isVerified ? "approved" : "pending");
        const isApproved =
            seller.isVerified === true &&
            seller.isActive === true &&
            applicationStatus === "approved";

        if (!isApproved) {
            const approvalMessage =
                applicationStatus === "rejected"
                    ? "Your seller application was rejected. Please contact support."
                    : "Your seller account is pending admin approval.";

            return handleResponse(res, 403, approvalMessage, {
                applicationStatus,
                isVerified: seller.isVerified === true,
                isActive: seller.isActive === true,
                rejectionReason: seller.rejectionReason || "",
            });
        }

        seller.lastLogin = new Date();
        
        const { fcmToken, platform } = req.body || {};
        if (fcmToken) {
            if (platform === 'web') {
                seller.fcmtoken = fcmToken;
            } else {
                seller.fcmtokenMobile = fcmToken;
            }
        }

        await seller.save();

        const token = generateToken(seller);

        return handleResponse(res, 200, "Login successful", {
            token,
            seller,
        });
    } catch (error) {
        return handleResponse(res, 500, error.message);
    }
};
