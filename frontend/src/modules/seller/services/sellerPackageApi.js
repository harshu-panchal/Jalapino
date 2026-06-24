import axiosInstance from '@core/api/axios';

export const sellerPackageApi = {
    // Get templates available for the seller's categories
    getTemplates: async () => {
        try {
            const response = await axiosInstance.get('/seller/packages/templates');
            return response.data?.results || response.data?.data || response.data?.result || response.data || [];
        } catch (error) {
            console.error('Error fetching package templates:', error);
            throw error;
        }
    },

    // Get seller's configured packages
    getMyPackages: async () => {
        try {
            const response = await axiosInstance.get('/seller/packages/my-packages');
            return response.data?.results || response.data?.data || response.data?.result || response.data || [];
        } catch (error) {
            console.error('Error fetching my packages:', error);
            throw error;
        }
    },

    // Create or update a package
    savePackage: async (data) => {
        try {
            const response = await axiosInstance.post('/seller/packages/my-packages', data);
            return response.data;
        } catch (error) {
            console.error('Error saving package:', error);
            throw error;
        }
    },

    // Delete a package
    deletePackage: async (id) => {
        try {
            const response = await axiosInstance.delete(`/seller/packages/my-packages/${id}`);
            return response.data;
        } catch (error) {
            console.error('Error deleting package:', error);
            throw error;
        }
    }
};
