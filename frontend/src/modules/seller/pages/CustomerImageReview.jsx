import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { toast } from 'sonner';
import { sellerApi } from '../services/sellerApi';
import Card from '@shared/components/ui/Card';
import { HiCheck, HiX, HiPhotograph, HiClock } from 'react-icons/hi';
import PageHeader from '@shared/components/ui/PageHeader';

const CustomerImageReview = () => {
    const [images, setImages] = useState([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        fetchImages();
    }, []);

    const fetchImages = async () => {
        try {
            const res = await sellerApi.getCustomerImagesQueue();
            if (res.data.success) {
                setImages(res.data.result || []);
            }
        } catch (error) {
            toast.error('Failed to load pending customer requests');
        } finally {
            setLoading(false);
        }
    };

    const handleApprove = async (id) => {
        try {
            await sellerApi.approveCustomerImage(id);
            toast.success('Request accepted! The customer will be notified.');
            setImages(prev => prev.filter(img => img._id !== id));
        } catch (error) {
            toast.error(error?.response?.data?.message || 'Failed to approve request');
        }
    };

    const handleReject = async (id) => {
        try {
            await sellerApi.rejectCustomerImage(id);
            toast.success('Request rejected.');
            setImages(prev => prev.filter(img => img._id !== id));
        } catch (error) {
            toast.error(error?.response?.data?.message || 'Failed to reject request');
        }
    };

    if (loading) {
        return (
            <div className="flex justify-center items-center h-96">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
            </div>
        );
    }

    return (
        <div className="space-y-6">
            <PageHeader
                title="Customer Requests Queue"
                description="Review custom designs and images uploaded by customers in your category."
            />

            {images.length === 0 ? (
                <Card className="flex flex-col items-center justify-center py-16 text-center text-slate-500">
                    <HiPhotograph className="w-16 h-16 text-slate-300 mb-4" />
                    <h3 className="text-lg font-medium text-slate-900 mb-1">No Pending Requests</h3>
                    <p className="text-sm">There are no new custom image requests at the moment.</p>
                </Card>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    <AnimatePresence>
                        {images.map((img) => (
                            <motion.div
                                key={img._id}
                                initial={{ opacity: 0, scale: 0.95 }}
                                animate={{ opacity: 1, scale: 1 }}
                                exit={{ opacity: 0, scale: 0.95 }}
                                layout
                            >
                                <Card className="overflow-hidden h-full flex flex-col hover:shadow-lg transition-shadow">
                                    <div className="aspect-square bg-slate-100 relative group overflow-hidden">
                                        <img 
                                            src={img.imageUrl} 
                                            alt="Customer Request" 
                                            className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110"
                                        />
                                        <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                                            <a href={img.imageUrl} target="_blank" rel="noreferrer" className="bg-white/90 text-slate-900 px-4 py-2 rounded-full font-medium text-sm hover:bg-white">
                                                View Full Size
                                            </a>
                                        </div>
                                    </div>
                                    <div className="p-5 flex-1 flex flex-col">
                                        <div className="flex items-center justify-between mb-3">
                                            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800 capitalize">
                                                {img.category}
                                            </span>
                                            <div className="flex items-center text-xs text-slate-500">
                                                <HiClock className="mr-1" />
                                                {new Date(img.createdAt).toLocaleDateString()}
                                            </div>
                                        </div>
                                        
                                        <div className="mb-4">
                                            <p className="text-sm font-medium text-slate-900">Customer: {img.customer?.name || 'Guest'}</p>
                                        </div>

                                        <div className="mt-auto grid grid-cols-2 gap-3">
                                            <button
                                                onClick={() => handleReject(img._id)}
                                                className="flex items-center justify-center px-4 py-2 border border-slate-300 shadow-sm text-sm font-medium rounded-xl text-slate-700 bg-white hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500 transition-colors"
                                            >
                                                <HiX className="mr-2 h-4 w-4" />
                                                Reject
                                            </button>
                                            <button
                                                onClick={() => handleApprove(img._id)}
                                                className="flex items-center justify-center px-4 py-2 border border-transparent shadow-sm text-sm font-medium rounded-xl text-white bg-primary-600 hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500 transition-colors"
                                            >
                                                <HiCheck className="mr-2 h-4 w-4" />
                                                Accept
                                            </button>
                                        </div>
                                    </div>
                                </Card>
                            </motion.div>
                        ))}
                    </AnimatePresence>
                </div>
            )}
        </div>
    );
};

export default CustomerImageReview;
