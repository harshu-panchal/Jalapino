import React from 'react';
import { motion } from 'framer-motion';

const EventPackages = () => {
  return (
    <div className="p-6">
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-white rounded-2xl shadow-sm p-8 text-center"
      >
        <h1 className="text-2xl font-bold text-slate-800 mb-4">Event Packages</h1>
        <p className="text-slate-500">Manage your catering, decoration, or venue packages here.</p>
        <button className="mt-6 px-6 py-2 bg-brand-600 text-white rounded-xl font-medium">Add New Package</button>
      </motion.div>
    </div>
  );
};

export default EventPackages;
