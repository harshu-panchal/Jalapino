import HSN from "../models/hsn.js";
import handleResponse from "../utils/helper.js";

// Create HSN (Admin only)
export const createHsn = async (req, res) => {
    try {
        const { hsnCode, description, gstPercentage, status } = req.body;

        if (!hsnCode || gstPercentage === undefined) {
            return handleResponse(res, 400, "hsnCode and gstPercentage are required");
        }

        const existing = await HSN.findOne({ hsnCode: hsnCode.toUpperCase() });
        if (existing) {
            return handleResponse(res, 400, "HSN Code already exists");
        }

        const hsn = await HSN.create({
            hsnCode: hsnCode.toUpperCase(),
            description,
            gstPercentage,
            status,
        });

        return handleResponse(res, 201, "HSN Code created successfully", hsn);
    } catch (error) {
        return handleResponse(res, 500, error.message);
    }
};

// Update HSN (Admin only)
export const updateHsn = async (req, res) => {
    try {
        const { id } = req.params;
        const { hsnCode, description, gstPercentage, status } = req.body;

        const hsn = await HSN.findById(id);
        if (!hsn) {
            return handleResponse(res, 404, "HSN Code not found");
        }

        if (hsnCode && hsnCode.toUpperCase() !== hsn.hsnCode) {
            const existing = await HSN.findOne({ hsnCode: hsnCode.toUpperCase() });
            if (existing) {
                return handleResponse(res, 400, "HSN Code already exists");
            }
            hsn.hsnCode = hsnCode.toUpperCase();
        }

        if (description !== undefined) hsn.description = description;
        if (gstPercentage !== undefined) hsn.gstPercentage = gstPercentage;
        if (status) hsn.status = status;

        await hsn.save();
        return handleResponse(res, 200, "HSN Code updated successfully", hsn);
    } catch (error) {
        return handleResponse(res, 500, error.message);
    }
};

// Get all HSNs (Admin)
export const getAllHsns = async (req, res) => {
    try {
        const hsns = await HSN.find().sort({ createdAt: -1 });
        return handleResponse(res, 200, "HSN Codes fetched successfully", hsns);
    } catch (error) {
        return handleResponse(res, 500, error.message);
    }
};

// Get active HSNs (Public / Frontend dropdowns)
export const getActiveHsns = async (req, res) => {
    try {
        const hsns = await HSN.find({ status: "active" }).select("hsnCode description gstPercentage").sort({ hsnCode: 1 });
        return handleResponse(res, 200, "Active HSN Codes fetched successfully", hsns);
    } catch (error) {
        return handleResponse(res, 500, error.message);
    }
};

// Delete HSN (Admin only)
export const deleteHsn = async (req, res) => {
    try {
        const { id } = req.params;
        const hsn = await HSN.findByIdAndDelete(id);
        if (!hsn) {
            return handleResponse(res, 404, "HSN Code not found");
        }
        return handleResponse(res, 200, "HSN Code deleted successfully");
    } catch (error) {
        return handleResponse(res, 500, error.message);
    }
};
