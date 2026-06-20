import Admin from "../../models/admin.js";
import handleResponse from "../../utils/helper.js";
import bcrypt from "bcrypt";

// Get all admins
export const getAllAdmins = async (req, res) => {
  try {
    const admins = await Admin.find().select("-password").sort("-createdAt");
    return handleResponse(res, 200, "Admins fetched successfully", admins);
  } catch (error) {
    return handleResponse(res, 500, error.message);
  }
};

// Create new admin
export const createAdmin = async (req, res) => {
  try {
    const { name, email, password, subRole } = req.body;

    if (!name || !email || !password || !subRole) {
      return handleResponse(res, 400, "Name, email, password, and subRole are required");
    }

    const validRoles = ["super_admin", "sub_admin", "finance", "marketing"];
    if (!validRoles.includes(subRole)) {
      return handleResponse(res, 400, "Invalid subRole provided");
    }

    const duplicate = await Admin.findOne({ email }).lean();
    if (duplicate) {
      return handleResponse(res, 409, "Admin with this email already exists");
    }

    const admin = await Admin.create({
      name,
      email,
      password,
      role: "admin",
      subRole,
      isVerified: true,
    });

    const sanitizedAdmin = admin.toObject();
    delete sanitizedAdmin.password;

    return handleResponse(res, 201, "Admin created successfully", sanitizedAdmin);
  } catch (error) {
    return handleResponse(res, 500, error.message);
  }
};

// Update admin role
export const updateAdminRole = async (req, res) => {
  try {
    const { id } = req.params;
    const { subRole } = req.body;

    const validRoles = ["super_admin", "sub_admin", "finance", "marketing"];
    if (!validRoles.includes(subRole)) {
      return handleResponse(res, 400, "Invalid subRole provided");
    }

    const admin = await Admin.findById(id);
    if (!admin) {
      return handleResponse(res, 404, "Admin not found");
    }

    // Protection: don't let super_admin accidentally downgrade themselves if they are the only super_admin
    if (admin.subRole === "super_admin" && subRole !== "super_admin") {
      const superAdminCount = await Admin.countDocuments({ subRole: "super_admin" });
      if (superAdminCount <= 1) {
        return handleResponse(res, 400, "Cannot change role of the last super_admin");
      }
    }

    admin.subRole = subRole;
    await admin.save();

    const sanitizedAdmin = admin.toObject();
    delete sanitizedAdmin.password;

    return handleResponse(res, 200, "Admin role updated successfully", sanitizedAdmin);
  } catch (error) {
    return handleResponse(res, 500, error.message);
  }
};

// Delete admin
export const deleteAdmin = async (req, res) => {
  try {
    const { id } = req.params;

    if (String(req.user.id) === String(id)) {
      return handleResponse(res, 400, "You cannot delete your own account");
    }

    const admin = await Admin.findById(id);
    if (!admin) {
      return handleResponse(res, 404, "Admin not found");
    }

    if (admin.subRole === "super_admin") {
      const superAdminCount = await Admin.countDocuments({ subRole: "super_admin" });
      if (superAdminCount <= 1) {
        return handleResponse(res, 400, "Cannot delete the last super_admin");
      }
    }

    await Admin.findByIdAndDelete(id);
    return handleResponse(res, 200, "Admin deleted successfully");
  } catch (error) {
    return handleResponse(res, 500, error.message);
  }
};
