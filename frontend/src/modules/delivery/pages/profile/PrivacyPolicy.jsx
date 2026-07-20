import React, { useEffect } from "react";
import { ArrowLeft, ShieldCheck } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";

const PrivacyPolicy = () => {
  const navigate = useNavigate();

  useEffect(() => {
    window.scrollTo(0, 0);
  }, []);

  return (
    <div className="bg-gray-50 min-h-screen pb-24 font-['Inter']">
      {/* Header */}
      <div className="bg-primary pt-12 pb-6 px-6 shadow-sm sticky top-0 z-50">
        <div className="flex items-center gap-4">
          <button
            onClick={() => navigate(-1)}
            className="w-10 h-10 bg-white/20 rounded-full flex items-center justify-center text-white hover:bg-white/30 transition-colors"
          >
            <ArrowLeft size={20} />
          </button>
          <h1 className="text-white text-xl font-bold flex-1">Privacy Policy</h1>
          <div className="w-10 h-10 flex items-center justify-center text-white/50">
            <ShieldCheck size={24} />
          </div>
        </div>
      </div>

      <motion.div 
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className="px-6 py-8 space-y-8"
      >
        <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
          <h2 className="text-lg font-bold text-gray-900 mb-4">1. Information We Collect</h2>
          <p className="text-gray-600 text-sm leading-relaxed">
            We collect information to provide better services to our delivery partners. This includes:
            <ul className="list-disc pl-5 mt-2 space-y-1">
              <li>Personal details (Name, Phone, Email)</li>
              <li>Vehicle and driving license information</li>
              <li>Real-time location data while on duty</li>
              <li>Bank account details for processing payouts</li>
            </ul>
          </p>
        </div>

        <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
          <h2 className="text-lg font-bold text-gray-900 mb-4">2. How We Use Your Data</h2>
          <p className="text-gray-600 text-sm leading-relaxed">
            Your location data is used to assign the nearest orders and provide customers with live tracking. We also use your data to:
            <ul className="list-disc pl-5 mt-2 space-y-1">
              <li>Calculate accurate payouts and distance</li>
              <li>Ensure the safety of our delivery partners and customers</li>
              <li>Comply with local regulations</li>
            </ul>
          </p>
        </div>

        <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
          <h2 className="text-lg font-bold text-gray-900 mb-4">3. Data Sharing & Security</h2>
          <p className="text-gray-600 text-sm leading-relaxed">
            We do not sell your personal information to third parties. We may share necessary details (like your name and vehicle number) with customers during active deliveries. All your data, especially bank details, is encrypted and securely stored.
          </p>
        </div>

        <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
          <h2 className="text-lg font-bold text-gray-900 mb-4">4. Your Rights</h2>
          <p className="text-gray-600 text-sm leading-relaxed">
            You have the right to request a copy of your data or ask for data deletion. However, deleting certain information may prevent you from continuing as a delivery partner on our platform.
          </p>
        </div>
        
        <p className="text-center text-xs text-gray-400 mt-8">
          Last Updated: {new Date().toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
        </p>
      </motion.div>
    </div>
  );
};

export default PrivacyPolicy;
