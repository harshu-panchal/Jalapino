import EventType from '../models/event/EventType.js';
import EventCategory from '../models/event/EventCategory.js';
import PreferenceForm from '../models/event/PreferenceForm.js';
import PackageTemplate from '../models/event/PackageTemplate.js';
import handleResponse from '../utils/helper.js';

// ---- Event Types ----

export const getEventTypes = async (req, res) => {
    try {
        const types = await EventType.find().sort({ sortOrder: 1 });
        return handleResponse(res, 200, 'Event types fetched', types);
    } catch (error) {
        return handleResponse(res, 500, 'Failed to fetch event types');
    }
};

export const createEventType = async (req, res) => {
    try {
        const { name, value, sortOrder, isActive } = req.body;
        const type = await EventType.create({ name, value, sortOrder, isActive });
        return handleResponse(res, 201, 'Event type created', type);
    } catch (error) {
        return handleResponse(res, 500, 'Failed to create event type');
    }
};

export const updateEventType = async (req, res) => {
    try {
        const { id } = req.params;
        const type = await EventType.findByIdAndUpdate(id, req.body, { new: true });
        if (!type) return handleResponse(res, 404, 'Event type not found');
        return handleResponse(res, 200, 'Event type updated', type);
    } catch (error) {
        return handleResponse(res, 500, 'Failed to update event type');
    }
};

export const deleteEventType = async (req, res) => {
    try {
        const { id } = req.params;
        const type = await EventType.findByIdAndDelete(id);
        if (!type) return handleResponse(res, 404, 'Event type not found');
        return handleResponse(res, 200, 'Event type deleted');
    } catch (error) {
        return handleResponse(res, 500, 'Failed to delete event type');
    }
};

// ---- Event Categories ----

export const getEventCategories = async (req, res) => {
    try {
        const categories = await EventCategory.find().sort({ sortOrder: 1 }).lean();
        const forms = await PreferenceForm.find().lean();

        const categoriesWithForms = categories.map(cat => {
            const form = forms.find(f => f.category.toString() === cat._id.toString());
            return {
                ...cat,
                fields: form ? form.fields : []
            };
        });

        return handleResponse(res, 200, 'Event categories fetched', categoriesWithForms);
    } catch (error) {
        return handleResponse(res, 500, 'Failed to fetch event categories');
    }
};

export const createEventCategory = async (req, res) => {
    try {
        const { name, icon, sortOrder, isActive, fields, activePlugins } = req.body;
        
        // 1. Create Category
        const cat = await EventCategory.create({ name, icon, sortOrder, isActive, activePlugins });
        
        // 2. Create associated form fields if provided
        if (fields && fields.length > 0) {
            try {
                await PreferenceForm.create({ category: cat._id, fields });
            } catch (formError) {
                // Rollback category creation if form fields fail
                await EventCategory.findByIdAndDelete(cat._id);
                throw formError;
            }
        }

        return handleResponse(res, 201, 'Event category created', cat);
    } catch (error) {
        console.error('Failed to create event category:', error);
        return handleResponse(res, 500, error.message || 'Failed to create event category');
    }
};

export const updateEventCategory = async (req, res) => {
    try {
        const { id } = req.params;
        const { name, icon, sortOrder, isActive, fields, activePlugins } = req.body;

        const cat = await EventCategory.findByIdAndUpdate(id, { name, icon, sortOrder, isActive, activePlugins }, { new: true });
        if (!cat) return handleResponse(res, 404, 'Event category not found');

        // Update fields if provided
        if (fields) {
            let form = await PreferenceForm.findOne({ category: cat._id });
            if (form) {
                form.fields = fields;
                await form.save();
            } else {
                await PreferenceForm.create({ category: cat._id, fields });
            }
        }

        return handleResponse(res, 200, 'Event category updated', cat);
    } catch (error) {
        console.error('Failed to update event category:', error);
        return handleResponse(res, 500, error.message || 'Failed to update event category');
    }
};

export const deleteEventCategory = async (req, res) => {
    try {
        const { id } = req.params;
        const cat = await EventCategory.findByIdAndDelete(id);
        if (!cat) return handleResponse(res, 404, 'Event category not found');

        // Clean up preference form
        await PreferenceForm.findOneAndDelete({ category: id });

        return handleResponse(res, 200, 'Event category deleted');
    } catch (error) {
        return handleResponse(res, 500, 'Failed to delete event category');
    }
};

// ---- Package Templates ----

export const getPackageTemplates = async (req, res) => {
    try {
        const templates = await PackageTemplate.find().populate('category', 'name').lean();
        return handleResponse(res, 200, 'Package templates fetched', templates);
    } catch (error) {
        return handleResponse(res, 500, 'Failed to fetch package templates');
    }
};

export const createPackageTemplate = async (req, res) => {
    try {
        const { category, packageName, description, includedFeatures, optionalFeatures, isActive } = req.body;
        const template = await PackageTemplate.create({ category, packageName, description, includedFeatures, optionalFeatures, isActive });
        return handleResponse(res, 201, 'Package template created', template);
    } catch (error) {
        return handleResponse(res, 500, 'Failed to create package template');
    }
};

export const updatePackageTemplate = async (req, res) => {
    try {
        const { id } = req.params;
        const template = await PackageTemplate.findByIdAndUpdate(id, req.body, { new: true });
        if (!template) return handleResponse(res, 404, 'Package template not found');
        return handleResponse(res, 200, 'Package template updated', template);
    } catch (error) {
        return handleResponse(res, 500, 'Failed to update package template');
    }
};

export const deletePackageTemplate = async (req, res) => {
    try {
        const { id } = req.params;
        const template = await PackageTemplate.findByIdAndDelete(id);
        if (!template) return handleResponse(res, 404, 'Package template not found');
        return handleResponse(res, 200, 'Package template deleted');
    } catch (error) {
        return handleResponse(res, 500, 'Failed to delete package template');
    }
};
