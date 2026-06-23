import React from "react";
import { Check } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

/**
 * CheckoutOrderSuccess
 *
 * Props:
 *   orderId – string order ID (last 6 chars shown)
 *   show    – boolean — controls visibility via AnimatePresence
 */
const CheckoutOrderSuccess = React.memo(function CheckoutOrderSuccess({ orderId, show }) {
  return (
    <AnimatePresence>
      {show && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[100] bg-white flex flex-col items-center justify-center p-6 text-center">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ type: "spring", damping: 12 }}
            className="mb-8 relative flex items-center justify-center">
            
            <svg className="checkmark w-32 h-32 rounded-full block" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 52 52">
              <circle className="checkmark__circle" cx="26" cy="26" r="25" fill="none" />
              <path className="checkmark__check" fill="none" d="M14.1 27.2l7.1 7.2 16.7-16.8" />
            </svg>

            <style dangerouslySetInnerHTML={{__html: `
              .checkmark__circle {
                stroke-dasharray: 166;
                stroke-dashoffset: 166;
                stroke-width: 2;
                stroke-miterlimit: 10;
                stroke: #22c55e;
                fill: none;
                animation: stroke 0.6s cubic-bezier(0.65, 0, 0.45, 1) forwards;
              }
              .checkmark {
                stroke-width: 4;
                stroke: #fff;
                stroke-miterlimit: 10;
                box-shadow: inset 0px 0px 0px #22c55e;
                animation: fill .4s ease-in-out .4s forwards, scale .3s ease-in-out .9s both;
              }
              .checkmark__check {
                transform-origin: 50% 50%;
                stroke-dasharray: 48;
                stroke-dashoffset: 48;
                animation: stroke 0.3s cubic-bezier(0.65, 0, 0.45, 1) 0.8s forwards;
              }
              @keyframes stroke { 100% { stroke-dashoffset: 0; } }
              @keyframes scale { 0%, 100% { transform: none; } 50% { transform: scale3d(1.1, 1.1, 1); } }
              @keyframes fill { 100% { box-shadow: inset 0px 0px 0px 100px #22c55e; } }
            `}} />
          </motion.div>
          <motion.h2
            initial={{ y: 20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ delay: 0.2 }}
            className="text-3xl font-black text-slate-800 mb-2">
            Order placed
          </motion.h2>
          <motion.p
            initial={{ y: 20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ delay: 0.3 }}
            className="text-slate-500 font-medium mb-8">
            #{orderId?.slice(-6)} — waiting for the seller to accept (60s). If
            they don&apos;t, the order will cancel automatically.
            <br />
            Redirecting to order details…
          </motion.p>
          <motion.div
            initial={{ width: 0 }}
            animate={{ width: "100%" }}
            transition={{ duration: 2.5, ease: "linear" }}
            className="w-48 h-1.5 bg-brand-100 rounded-full overflow-hidden">
            <div className="h-full bg-primary" />
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
});

export default CheckoutOrderSuccess;
