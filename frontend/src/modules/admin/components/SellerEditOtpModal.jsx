import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { HiOutlineXMark, HiOutlineDevicePhoneMobile, HiOutlineEnvelope } from 'react-icons/hi2';
import api from '@/core/api/axios';
import { toast } from 'sonner';

const SellerEditOtpModal = ({ isOpen, onClose, seller, onSuccess }) => {
  const [step, setStep] = useState(1); // 1: Select Method, 2: Enter OTP
  const [selectedMethod, setSelectedMethod] = useState('phone');
  const [otp, setOtp] = useState('');
  const [loading, setLoading] = useState(false);

  // Phone number fallback - assume seller has a phone field
  const phoneNumber = seller?.phone || seller?.mobile || '';
  // Email fallback
  const email = seller?.email || '';

  const handleSendOtp = async () => {
    try {
      setLoading(true);
      if (selectedMethod === 'phone') {
        const res = await api.post('/auth/otp/send', {
          mobile: phoneNumber,
          userType: 'Seller',
          purpose: 'PROFILE_EDIT'
        });
        if (res.data?.success || res.data) {
          toast.success(`OTP sent to seller's phone!`);
          setStep(2);
        }
      } else {
        const res = await api.post('/seller/verification/send-otp', {
          channel: 'email',
          email: email,
          purpose: 'PROFILE_EDIT'
        });
        if (res.data?.success || res.data) {
          toast.success(`OTP sent to seller's email!`);
          setStep(2);
        }
      }
    } catch (err) {
      const msg = err.response?.data?.message || 'Failed to send OTP';
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyOtp = async () => {
    try {
      if (!otp || otp.length < 4) {
        return toast.error('Please enter a valid OTP');
      }
      setLoading(true);
      
      if (selectedMethod === 'phone') {
        const res = await api.post('/auth/otp/verify', {
          mobile: phoneNumber,
          otp,
          userType: 'Seller',
          purpose: 'PROFILE_EDIT'
        });
        if (res.data?.success || res.data?.verified || res.data) {
          toast.success('OTP verified successfully!');
          onSuccess(seller.id || seller._id);
        }
      } else {
        const res = await api.post('/seller/verification/verify-otp', {
          channel: 'email',
          email: email,
          otp,
          purpose: 'PROFILE_EDIT'
        });
        if (res.data?.success || res.data?.verified || res.data) {
          toast.success('OTP verified successfully!');
          onSuccess(seller.id || seller._id);
        }
      }
    } catch (err) {
      const msg = err.response?.data?.message || 'Invalid OTP';
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm"
          onClick={onClose}
        />
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 20 }}
          className="relative w-full max-w-md bg-white rounded-3xl shadow-2xl overflow-hidden"
        >
          <div className="p-6">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-bold text-slate-800">
                Security Verification
              </h2>
              <button
                onClick={onClose}
                className="h-8 w-8 rounded-full bg-slate-100 flex items-center justify-center text-slate-500 hover:bg-slate-200"
              >
                <HiOutlineXMark className="h-5 w-5" />
              </button>
            </div>

            {step === 1 ? (
              <div className="space-y-6">
                <p className="text-sm font-semibold text-slate-500 leading-relaxed">
                  To edit seller <span className="text-primary font-bold">{seller?.shopName || seller?.ownerName}</span>'s profile, please verify via OTP.
                </p>

                <div className="space-y-3">
                  <button
                    onClick={() => setSelectedMethod('phone')}
                    className={`w-full p-4 rounded-2xl border-2 flex items-center gap-4 transition-all ${
                      selectedMethod === 'phone'
                        ? 'border-primary bg-primary/5 text-primary'
                        : 'border-slate-100 bg-white text-slate-600 hover:border-slate-200'
                    }`}
                  >
                    <div className={`h-10 w-10 rounded-full flex items-center justify-center ${selectedMethod === 'phone' ? 'bg-primary text-white' : 'bg-slate-100'}`}>
                      <HiOutlineDevicePhoneMobile className="h-5 w-5" />
                    </div>
                    <div className="text-left">
                      <p className="font-bold text-sm">Send to Seller's Phone</p>
                      <p className="text-xs opacity-80 mt-0.5">{phoneNumber || 'N/A'}</p>
                    </div>
                  </button>

                  <button
                    onClick={() => setSelectedMethod('email')}
                    className={`w-full p-4 rounded-2xl border-2 flex items-center gap-4 transition-all ${
                      selectedMethod === 'email'
                        ? 'border-primary bg-primary/5 text-primary'
                        : 'border-slate-100 bg-white text-slate-600 hover:border-slate-200'
                    }`}
                  >
                    <div className={`h-10 w-10 rounded-full flex items-center justify-center ${selectedMethod === 'email' ? 'bg-primary text-white' : 'bg-slate-100'}`}>
                      <HiOutlineEnvelope className="h-5 w-5" />
                    </div>
                    <div className="text-left">
                      <p className="font-bold text-sm">Send to Seller's Email</p>
                      <p className="text-xs opacity-80 mt-0.5">{email || 'N/A'}</p>
                    </div>
                  </button>
                </div>

                <button
                  onClick={handleSendOtp}
                  disabled={loading || (selectedMethod === 'phone' && !phoneNumber) || (selectedMethod === 'email' && !email)}
                  className="w-full py-4 bg-primary text-white rounded-2xl font-bold text-sm hover:bg-primary/90 transition-colors disabled:opacity-50"
                >
                  {loading ? 'Sending...' : 'Send OTP'}
                </button>
              </div>
            ) : (
              <div className="space-y-6">
                <div className="text-center">
                  <div className="mx-auto h-16 w-16 bg-primary/10 rounded-full flex items-center justify-center mb-4">
                    {selectedMethod === 'phone' ? (
                      <HiOutlineDevicePhoneMobile className="h-8 w-8 text-primary" />
                    ) : (
                      <HiOutlineEnvelope className="h-8 w-8 text-primary" />
                    )}
                  </div>
                  <h3 className="font-bold text-slate-800 text-lg mb-2">Enter Verification Code</h3>
                  <p className="text-sm font-semibold text-slate-500">
                    We've sent an OTP to the seller's {selectedMethod === 'phone' ? 'phone' : 'email'}.
                  </p>
                </div>

                <div>
                  <input
                    type="text"
                    value={otp}
                    onChange={(e) => setOtp(e.target.value.replace(/\D/g, '').slice(0, 6))}
                    placeholder="Enter OTP"
                    className="w-full text-center text-2xl tracking-[0.5em] font-bold py-4 bg-slate-50 border-none rounded-2xl outline-none ring-2 ring-transparent focus:ring-primary/20"
                  />
                </div>

                <div className="flex gap-3">
                  <button
                    onClick={() => setStep(1)}
                    className="flex-1 py-4 bg-slate-100 text-slate-700 rounded-2xl font-bold text-sm hover:bg-slate-200 transition-colors"
                  >
                    Back
                  </button>
                  <button
                    onClick={handleVerifyOtp}
                    disabled={loading || otp.length < 4}
                    className="flex-1 py-4 bg-primary text-white rounded-2xl font-bold text-sm hover:bg-primary/90 transition-colors disabled:opacity-50"
                  >
                    {loading ? 'Verifying...' : 'Verify & Edit'}
                  </button>
                </div>
              </div>
            )}
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};

export default SellerEditOtpModal;
