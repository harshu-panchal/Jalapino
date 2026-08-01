import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { toast } from 'sonner';
import { HiOutlinePhotograph, HiOutlineUpload } from 'react-icons/hi';
import { customerApi } from '../services/customerApi';

const categories = [
    'cakes',
    'decorations',
    'gifts',
    'catering',
    'photography'
];

const CustomOrderPage = () => {
    const [imageFile, setImageFile] = useState(null);
    const [imagePreview, setImagePreview] = useState('');
    const [category, setCategory] = useState('');
    const [loading, setLoading] = useState(false);

    const handleImageChange = (e) => {
        const file = e.target.files?.[0];
        if (file) {
            setImageFile(file);
            setImagePreview(URL.createObjectURL(file));
        }
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!imageFile) return toast.error('Please select an image first.');
        if (!category) return toast.error('Please select a category.');

        setLoading(true);
        try {
            const formData = new FormData();
            formData.append('image', imageFile);
            formData.append('category', category);

            await customerApi.uploadCustomerImage(formData);

            toast.success('Your custom request has been submitted! Sellers will review it soon.');
            
            // Reset form
            setImageFile(null);
            setImagePreview('');
            setCategory('');
        } catch (error) {
            toast.error(error?.response?.data?.message || 'Failed to submit request.');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen bg-slate-50 pt-20 pb-12 px-4 sm:px-6 lg:px-8">
            <div className="max-w-xl mx-auto bg-white rounded-2xl shadow-xl overflow-hidden">
                <div className="px-6 py-8 sm:p-10">
                    <div className="text-center mb-8">
                        <HiOutlinePhotograph className="mx-auto h-12 w-12 text-primary-600" />
                        <h2 className="mt-4 text-3xl font-bold text-slate-900 tracking-tight">Custom Request</h2>
                        <p className="mt-2 text-slate-500">
                            Upload a picture of what you want, and eligible sellers will reach out to you!
                        </p>
                    </div>

                    <form onSubmit={handleSubmit} className="space-y-6">
                        <div>
                            <label className="block text-sm font-medium text-slate-700 mb-2">
                                Select Category
                            </label>
                            <select
                                value={category}
                                onChange={(e) => setCategory(e.target.value)}
                                className="block w-full rounded-xl border-slate-300 shadow-sm focus:border-primary-500 focus:ring-primary-500 sm:text-sm py-3 px-4 bg-slate-50 border"
                                required
                            >
                                <option value="" disabled>Choose a category...</option>
                                {categories.map(c => (
                                    <option key={c} value={c} className="capitalize">{c}</option>
                                ))}
                            </select>
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-slate-700 mb-2">
                                Upload Reference Image
                            </label>
                            <div className="mt-1 flex justify-center px-6 pt-5 pb-6 border-2 border-slate-300 border-dashed rounded-xl hover:border-primary-500 transition-colors bg-slate-50">
                                <div className="space-y-1 text-center">
                                    {imagePreview ? (
                                        <div className="relative">
                                            <img src={imagePreview} alt="Preview" className="mx-auto h-48 w-auto rounded-lg object-cover" />
                                            <button
                                                type="button"
                                                onClick={() => {
                                                    setImageFile(null);
                                                    setImagePreview('');
                                                }}
                                                className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full p-1 hover:bg-red-600"
                                            >
                                                ✕
                                            </button>
                                        </div>
                                    ) : (
                                        <>
                                            <HiOutlineUpload className="mx-auto h-12 w-12 text-slate-400" />
                                            <div className="flex text-sm text-slate-600 justify-center">
                                                <label
                                                    htmlFor="file-upload"
                                                    className="relative cursor-pointer rounded-md bg-transparent font-medium text-primary-600 focus-within:outline-none hover:text-primary-500"
                                                >
                                                    <span>Upload a file</span>
                                                    <input id="file-upload" name="file-upload" type="file" className="sr-only" accept="image/*" onChange={handleImageChange} />
                                                </label>
                                            </div>
                                            <p className="text-xs text-slate-500">PNG, JPG, GIF up to 5MB</p>
                                        </>
                                    )}
                                </div>
                            </div>
                        </div>

                        <motion.button
                            whileHover={{ scale: 1.02 }}
                            whileTap={{ scale: 0.98 }}
                            type="submit"
                            disabled={loading || !imageFile || !category}
                            className={`w-full flex justify-center py-3 px-4 border border-transparent rounded-xl shadow-sm text-sm font-bold text-white bg-primary-600 hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500 transition-all ${
                                (loading || !imageFile || !category) ? 'opacity-50 cursor-not-allowed' : ''
                            }`}
                        >
                            {loading ? (
                                <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
                            ) : (
                                'Submit Request'
                            )}
                        </motion.button>
                    </form>
                </div>
            </div>
        </div>
    );
};

export default CustomOrderPage;
