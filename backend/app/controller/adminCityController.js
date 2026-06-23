import City from '../models/City.js';
import handleResponse from '../utils/helper.js';

export const getCities = async (req, res) => {
    try {
        const cities = await City.find().sort({ state: 1, cityName: 1 });
        return handleResponse(res, 200, 'Cities fetched successfully', cities);
    } catch (error) {
        return handleResponse(res, 500, 'Failed to fetch cities');
    }
};

export const createCity = async (req, res) => {
    try {
        const { state, cityName, pinCodes, isActive, readinessStatus } = req.body;
        const city = await City.create({ state, cityName, pinCodes, isActive, readinessStatus });
        return handleResponse(res, 201, 'City created', city);
    } catch (error) {
        return handleResponse(res, 500, 'Failed to create city');
    }
};

export const updateCity = async (req, res) => {
    try {
        const { id } = req.params;
        const city = await City.findByIdAndUpdate(id, req.body, { new: true });
        if (!city) return handleResponse(res, 404, 'City not found');
        return handleResponse(res, 200, 'City updated', city);
    } catch (error) {
        return handleResponse(res, 500, 'Failed to update city');
    }
};

export const deleteCity = async (req, res) => {
    try {
        const { id } = req.params;
        const city = await City.findByIdAndDelete(id);
        if (!city) return handleResponse(res, 404, 'City not found');
        return handleResponse(res, 200, 'City deleted');
    } catch (error) {
        return handleResponse(res, 500, 'Failed to delete city');
    }
};
