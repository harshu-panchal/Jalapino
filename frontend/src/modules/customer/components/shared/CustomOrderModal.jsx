import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { toast } from 'sonner';
import { HiOutlinePhotograph, HiOutlineUpload, HiX } from 'react-icons/hi';
import { customerApi } from '../../services/customerApi';

const categories = [
    'cakes',
    'decorations',
    'gifts',
    'catering',
    'photography'
];

const CustomOrderModal = ({ isOpen, onClose }) => {
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
            
            // Reset form and close
            setImageFile(null);
            setImagePreview('');
            setCategory('');
            onClose();
        } catch (error) {
            toast.error(error?.response?.data?.message || 'Failed to submit request.');
        } finally {
            setLoading(false);
        }
    };

    if (!isOpen) return null;

    return (
        <AnimatePresence>
            <div className="fixed inset-0 z-[999] flex items-center justify-center p-4">
                <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    onClick={onClose}
                    className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm"
                />
                <motion.div
                    initial={{ opacity: 0, scale: 0.95, y: 20 }}
                    animate={{ opacity: 1, scale: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.95, y: 20 }}
                    className="relative w-full max-w-lg bg-white rounded-3xl shadow-2xl overflow-hidden"
                >
                    <button
                        onClick={onClose}
                        className="absolute top-4 right-4 p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-full transition-colors"
                    >
                        <HiX size={20} />
                    </button>

                    <div className="px-6 py-8">
                        <div className="text-center mb-6">
                            <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-red-50 mb-4">
                                <HiOutlinePhotograph className="h-6 w-6 text-red-600" />
                            </div>
                            <h2 className="text-2xl font-bold text-slate-900">Custom Request</h2>
                            <p className="mt-1 text-sm text-slate-500">
                                Upload a picture of what you want, and eligible sellers will reach out to you!
                            </p>
                        </div>

                        <form onSubmit={handleSubmit} className="space-y-5">
                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-1.5">
                                    Select Category
                                </label>
                                <select
                                    value={category}
                                    onChange={(e) => setCategory(e.target.value)}
                                    className="block w-full rounded-xl border-slate-300 shadow-sm focus:border-primary-500 focus:ring-primary-500 sm:text-sm py-3 px-4 bg-slate-50 border outline-none"
                                    required
                                >
                                    <option value="" disabled>Choose a category...</option>
                                    {categories.map(c => (
                                        <option key={c} value={c} className="capitalize">{c}</option>
                                    ))}
                                </select>
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-1.5">
                                    Upload Reference Image
                                </label>
                                <label
                                    htmlFor="modal-file-upload"
                                    className="flex justify-center px-6 pt-5 pb-6 border-2 border-slate-300 border-dashed rounded-2xl hover:border-red-500 transition-colors bg-slate-50 group cursor-pointer"
                                >
                                    <div className="space-y-1 text-center">
                                        {imagePreview ? (
                                            <div className="relative group/img">
                                                <img src={imagePreview} alt="Preview" className="mx-auto h-32 w-auto rounded-lg object-cover" />
                                                <button
                                                    type="button"
                                                    onClick={(e) => {
                                                        e.preventDefault();
                                                        setImageFile(null);
                                                        setImagePreview('');
                                                    }}
                                                    className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full p-1 hover:bg-red-600 shadow-sm z-10"
                                                >
                                                    <HiX size={14} />
                                                </button>
                                            </div>
                                        ) : (
                                            <>
                                                <HiOutlineUpload className="mx-auto h-10 w-10 text-slate-400 group-hover:text-red-500 transition-colors" />
                                                <div className="flex text-sm text-slate-600 justify-center mt-2">
                                                    <span className="relative font-medium text-red-600 hover:text-red-700">
                                                        Upload a file
                                                    </span>
                                                </div>
                                                <p className="text-xs text-slate-500 mt-1">PNG, JPG up to 5MB</p>
                                            </>
                                        )}
                                        <input id="modal-file-upload" name="file-upload" type="file" className="sr-only" accept="image/*" onChange={handleImageChange} />
                                    </div>
                                </label>
                            </div>

                            <motion.button
                                whileHover={{ scale: 1.01 }}
                                whileTap={{ scale: 0.98 }}
                                type="submit"
                                disabled={loading || !imageFile || !category}
                                className={`w-full flex justify-center py-3 px-4 border border-transparent rounded-xl shadow-sm text-sm font-bold text-white bg-[#CC2020] hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500 transition-all ${
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
                </motion.div>
            </div>
        </AnimatePresence>
    );
};

export default CustomOrderModal;
