import express from 'express';
import {
    getEventTypes,
    createEventType,
    updateEventType,
    deleteEventType,
    getEventCategories,
    createEventCategory,
    updateEventCategory,
    deleteEventCategory,
    getPackageTemplates,
    createPackageTemplate,
    updatePackageTemplate,
    deletePackageTemplate,
    getFacilities,
    createFacility,
    updateFacility,
    deleteFacility
} from '../controller/adminEventConfigController.js';
import { getCities, createCity, updateCity, deleteCity } from '../controller/adminCityController.js';
import { getAllEventBookings, deleteAdminEventBooking, getAllVenueBookings, deleteAdminVenueBooking } from '../controller/adminEventBookingController.js';

const router = express.Router();

// Note: Authentication middleware should be applied at the index.js level

// Event Types
router.get('/types', getEventTypes);
router.post('/types', createEventType);
router.put('/types/:id', updateEventType);
router.delete('/types/:id', deleteEventType);

// Event Categories
router.get('/categories', getEventCategories);
router.post('/categories', createEventCategory);
router.put('/categories/:id', updateEventCategory);
router.delete('/categories/:id', deleteEventCategory);

// Package Templates
router.get('/package-templates', getPackageTemplates);
router.post('/package-templates', createPackageTemplate);
router.put('/package-templates/:id', updatePackageTemplate);
router.delete('/package-templates/:id', deletePackageTemplate);

// Venue Facilities
router.get('/facilities', getFacilities);
router.post('/facilities', createFacility);
router.put('/facilities/:id', updateFacility);
router.delete('/facilities/:id', deleteFacility);

// City Management
router.get('/cities', getCities);
router.post('/cities', createCity);
router.put('/cities/:id', updateCity);
router.delete('/cities/:id', deleteCity);

// Event Bookings
router.get('/bookings', getAllEventBookings);
router.delete('/bookings/:id', deleteAdminEventBooking);

// Venue / Ticket Bookings
router.get('/venue-bookings', getAllVenueBookings);
router.delete('/venue-bookings/:id', deleteAdminVenueBooking);

export default router;
