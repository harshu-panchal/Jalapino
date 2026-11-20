import City from '../models/City.js';
import handleResponse from '../utils/helper.js';
import { Client } from '@googlemaps/google-maps-services-js';

const mapsClient = new Client({});

// "Gaya District" / "gaya" / "Gayā" -> "gaya" (for name matching only)
const normalizePlaceName = (value) => String(value || '')
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/\s+(district|division|zila|jila)$/, '')
    .replace(/^(district|zila|jila)\s+/, '')
    .replace(/\s+ji$/, '')
    .trim();

// Admin: is this city really inside this district, and the district inside this state?
// Uses Google Geocoding address parts (India: state = level 1, district = level 3 / level 2).
export const verifyCityLocation = async (req, res) => {
    try {
        const state = String(req.query.state || '').trim();
        const district = String(req.query.district || '').trim();
        const cityName = String(req.query.cityName || '').trim();
        if (!state || !district || !cityName) {
            return handleResponse(res, 400, 'State, district and city are required');
        }
        const apiKey = process.env.GOOGLE_MAPS_API_KEY?.trim() || process.env.GOOGLE_MAPS_SERVER_KEY?.trim() || '';
        if (!apiKey) return handleResponse(res, 500, 'Google Maps API key missing');

        const resp = await mapsClient.geocode({
            params: { address: `${cityName}, ${district}, ${state}, India`, components: 'country:IN', key: apiKey },
            timeout: 10000,
        });
        const first = resp.data?.results?.[0];
        if (!first) {
            return handleResponse(res, 200, 'Location checked', { stateOk: false, districtOk: false, cityOk: false, foundDistrict: '' });
        }
        const parts = Array.isArray(first.address_components) ? first.address_components : [];
        const namesOf = (types) => parts
            .filter(p => Array.isArray(p.types) && p.types.some(t => types.includes(t)))
            .flatMap(p => [p.long_name, p.short_name])
            .map(normalizePlaceName)
            .filter(Boolean);

        const stateNames = namesOf(['administrative_area_level_1']);
        const districtNames = namesOf(['administrative_area_level_3', 'administrative_area_level_2']);
        const cityNames = namesOf(['locality', 'postal_town', 'sublocality', 'sublocality_level_1', 'administrative_area_level_3', 'administrative_area_level_4', 'neighborhood', 'colloquial_area']);
        const districtPart = parts.find(p => p.types?.includes('administrative_area_level_3'))
            || parts.find(p => p.types?.includes('administrative_area_level_2'));

        return handleResponse(res, 200, 'Location checked', {
            stateOk: stateNames.includes(normalizePlaceName(state)),
            districtOk: districtNames.includes(normalizePlaceName(district)),
            cityOk: cityNames.includes(normalizePlaceName(cityName)),
            foundDistrict: districtPart?.long_name || '',
        });
    } catch (error) {
        return handleResponse(res, 502, 'Could not verify the location right now');
    }
};

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
        const { state, district, cityName, pinCodes, isActive, readinessStatus, retailEnabled, planMyEventEnabled, wholesaleEnabled } = req.body;
        if (!String(district || '').trim()) return handleResponse(res, 400, 'District is required');
        const city = await City.create({ state, district, cityName, pinCodes, isActive, readinessStatus, retailEnabled, planMyEventEnabled, wholesaleEnabled });
        return handleResponse(res, 201, 'City created', city);
    } catch (error) {
        return handleResponse(res, 500, 'Failed to create city');
    }
};

export const updateCity = async (req, res) => {
    try {
        const { id } = req.params;
        if (req.body?.district !== undefined && !String(req.body.district || '').trim()) {
            return handleResponse(res, 400, 'District is required');
        }
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
