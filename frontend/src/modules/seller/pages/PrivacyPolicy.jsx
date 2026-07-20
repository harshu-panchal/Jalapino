import React, { useEffect } from "react";
import { ArrowLeft, ShieldCheck } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import Button from "@/shared/components/ui/Button";

const PrivacyPolicy = () => {
  const navigate = useNavigate();

  useEffect(() => {
    window.scrollTo(0, 0);
  }, []);

  return (
    <div className="bg-gray-50 min-h-[calc(100vh-80px)] font-['Inter']">
      {/* Header */}
      <div className="bg-white pt-8 pb-6 px-6 md:px-12 shadow-sm sticky top-0 z-50 flex items-center justify-between border-b border-gray-100">
        <div className="flex items-center gap-4">
          <Button
            onClick={() => navigate(-1)}
            variant="ghost"
            className="w-10 h-10 rounded-full flex items-center justify-center text-slate-600 hover:bg-slate-100 p-0"
          >
            <ArrowLeft size={20} />
          </Button>
          <h1 className="text-slate-900 text-2xl font-black tracking-tight">Privacy Policy</h1>
        </div>
        <div className="w-12 h-12 bg-blue-50 rounded-full flex items-center justify-center text-blue-600">
          <ShieldCheck size={24} />
        </div>
      </div>

      <motion.div 
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className="max-w-4xl mx-auto px-6 md:px-12 py-8 space-y-8"
      >
        <div className="bg-white rounded-2xl p-8 shadow-sm border border-gray-100 hover:shadow-md transition-shadow">
          <h2 className="text-xl font-black text-slate-900 mb-4">1. Information We Collect</h2>
          <p className="text-slate-600 text-sm leading-relaxed">
            As a seller on our platform, we collect necessary information to facilitate business transactions. This includes:
            <ul className="list-disc pl-5 mt-4 space-y-2 font-medium">
              <li>Business details (Store Name, Address, Category)</li>
              <li>Owner's personal information (Name, Contact Details)</li>
              <li>Financial information (Bank details for settlements)</li>
              <li>Product catalog and inventory data</li>
            </ul>
          </p>
        </div>

        <div className="bg-white rounded-2xl p-8 shadow-sm border border-gray-100 hover:shadow-md transition-shadow">
          <h2 className="text-xl font-black text-slate-900 mb-4">2. How We Use Your Data</h2>
          <p className="text-slate-600 text-sm leading-relaxed">
            Your business information is displayed to customers to facilitate sales. We also use your data to:
            <ul className="list-disc pl-5 mt-4 space-y-2 font-medium">
              <li>Process customer orders and payments</li>
              <li>Provide store analytics and business insights</li>
              <li>Verify your business identity to ensure a safe marketplace</li>
            </ul>
          </p>
        </div>

        <div className="bg-white rounded-2xl p-8 shadow-sm border border-gray-100 hover:shadow-md transition-shadow">
          <h2 className="text-xl font-black text-slate-900 mb-4">3. Data Sharing & Security</h2>
          <p className="text-slate-600 text-sm leading-relaxed font-medium">
            We share necessary store information with customers and delivery partners to complete orders. Sensitive data like bank account details and taxation documents are encrypted and only accessible to authorized personnel for settlement purposes. We never sell your business data to third parties.
          </p>
        </div>

        <div className="bg-white rounded-2xl p-8 shadow-sm border border-gray-100 hover:shadow-md transition-shadow">
          <h2 className="text-xl font-black text-slate-900 mb-4">4. Your Control</h2>
          <p className="text-slate-600 text-sm leading-relaxed font-medium">
            You can update your business profile, adjust inventory, and manage operational settings through your Seller Dashboard. If you wish to close your store, you can request account deletion, after which your public store profile will be removed.
          </p>
        </div>
        
        <p className="text-center text-xs font-bold text-slate-400 mt-12 uppercase tracking-widest">
          Last Updated: {new Date().toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
        </p>
      </motion.div>
    </div>
  );
};

export default PrivacyPolicy;
