import EventType from '../models/event/EventType.js';
import EventCategory from '../models/event/EventCategory.js';
import PreferenceForm from '../models/event/PreferenceForm.js';
import City from '../models/City.js';
import handleResponse from '../utils/helper.js';

export const getCities = async (req, res) => {
    try {
        const cities = await City.find({ isActive: true, readinessStatus: 'Ready' }).sort({ state: 1, cityName: 1 });
        return handleResponse(res, 200, 'Cities fetched successfully', cities);
    } catch (error) {
        return handleResponse(res, 500, 'Failed to fetch cities');
    }
};

// Get all active event types
export const getEventTypes = async (req, res) => {
    try {
        const types = await EventType.find({ isActive: true }).sort({ sortOrder: 1 });
        return handleResponse(res, 200, 'Event types fetched successfully', types);
    } catch (error) {
        console.error('Error fetching event types:', error);
        return handleResponse(res, 500, 'Failed to fetch event types');
    }
};

// Get all active event categories with their preference forms
export const getEventCategories = async (req, res) => {
    try {
        const categories = await EventCategory.find({ isActive: true }).sort({ sortOrder: 1 }).lean();
        const forms = await PreferenceForm.find({ isActive: true }).lean();

        // Attach forms to their respective categories
        const categoriesWithForms = categories.map(cat => {
            const form = forms.find(f => f.category.toString() === cat._id.toString());
            return {
                ...cat,
                fields: form ? form.fields : []
            };
        });

        return handleResponse(res, 200, 'Event categories fetched successfully', categoriesWithForms);
    } catch (error) {
        console.error('Error fetching event categories:', error);
        return handleResponse(res, 500, 'Failed to fetch event categories');
    }
};

// Seed initial event configs (Temporary for development)
export const seedEventConfig = async (req, res) => {
    try {
        // Seed Event Types
        const eventTypesData = [
            { name: 'Wedding / Pre-Wedding', value: 'wedding', sortOrder: 1 },
            { name: 'Birthday Party', value: 'birthday', sortOrder: 2 },
            { name: 'Corporate Event', value: 'corporate', sortOrder: 3 },
            { name: 'House Party', value: 'house_party', sortOrder: 4 },
            { name: 'Religious Event', value: 'religious', sortOrder: 5 }
        ];

        for (const type of eventTypesData) {
            await EventType.findOneAndUpdate({ value: type.value }, type, { upsert: true });
        }

        // Seed Event Categories and Forms
        const categoriesData = [
            {
                name: 'Catering',
                icon: '🍱',
                sortOrder: 1,
                fields: [
                    { fieldName: 'Food Preference', fieldType: 'SELECT', options: ['Veg Only', 'Non-Veg', 'Both'], isRequired: true, sortOrder: 1 },
                    { fieldName: 'Special Menu Requests', fieldType: 'TEXTAREA', isRequired: false, sortOrder: 2 }
                ]
            },
            {
                name: 'Decoration',
                icon: '🎈',
                sortOrder: 2,
                fields: [
                    { fieldName: 'Theme Color', fieldType: 'TEXT', isRequired: true, sortOrder: 1 },
                    { fieldName: 'Reference Image URL', fieldType: 'TEXT', isRequired: false, sortOrder: 2 }
                ]
            },
            {
                name: 'Photography',
                icon: '📸',
                sortOrder: 3,
                fields: [
                    { fieldName: 'Drone Required?', fieldType: 'SELECT', options: ['Yes', 'No'], isRequired: true, sortOrder: 1 }
                ]
            }
        ];

        for (const catData of categoriesData) {
            // Upsert Category
            let cat = await EventCategory.findOne({ name: catData.name });
            if (!cat) {
                cat = await EventCategory.create({ name: catData.name, icon: catData.icon, sortOrder: catData.sortOrder });
            }

            // Upsert Form
            let form = await PreferenceForm.findOne({ category: cat._id });
            if (!form) {
                await PreferenceForm.create({ category: cat._id, fields: catData.fields });
            } else {
                form.fields = catData.fields;
                await form.save();
            }
        }

        return handleResponse(res, 200, 'Seed successful');
    } catch (error) {
        console.error('Error seeding event config:', error);
        return handleResponse(res, 500, 'Failed to seed event config');
    }
};
