import React, { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { Gift, Sparkles, ChevronLeft, Copy, Check, Wallet, Award, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import confetti from "canvas-confetti";
import { customerApi } from "../services/customerApi";

const SpinWinPage = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [hasSpunToday, setHasSpunToday] = useState(false);
  const [wheelOptions, setWheelOptions] = useState([]);
  const [lastSpin, setLastSpin] = useState(null);
  
  // Spin Wheel State
  const [isSpinning, setIsSpinning] = useState(false);
  const [rotation, setRotation] = useState(0);
  const [wonReward, setWonReward] = useState(null);
  const [spinId, setSpinId] = useState(null);
  
  // Scratch Card State
  const [showScratchCard, setShowScratchCard] = useState(false);
  const [scratchCardScratched, setScratchCardScratched] = useState(false);
  const [isFullyRevealed, setIsFullyRevealed] = useState(false);
  const [copied, setCopied] = useState(false);
  
  const canvasRef = useRef(null);
  const isDrawingRef = useRef(false);
  const lastPosRef = useRef({ x: 0, y: 0 });
  const claimingRef = useRef(false);

  // Load initial state
  const fetchState = async () => {
    try {
      setLoading(true);
      const res = await customerApi.getWheelState();
      const data = res?.data?.result || {};
      
      setHasSpunToday(data.hasSpunToday || false);
      setWheelOptions(data.wheelOptions || []);
      
      if (data.lastSpin) {
        setLastSpin(data.lastSpin);
        setSpinId(data.lastSpin.id);
        setWonReward(data.lastSpin.rewardDetails);
        setScratchCardScratched(data.lastSpin.scratchCardScratched);
        
        // If they spun but haven't scratched yet, show scratch card
        if (!data.lastSpin.scratchCardScratched) {
          setShowScratchCard(true);
        } else {
          setIsFullyRevealed(true);
        }
      } else {
        // Reset states to allow spinning again
        setLastSpin(null);
        setSpinId(null);
        setWonReward(null);
        setScratchCardScratched(false);
        setIsFullyRevealed(false);
        setShowScratchCard(false);
      }
    } catch (error) {
      console.error("Error fetching wheel state:", error);
      toast.error("Failed to load Spin Wheel configuration.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchState();
  }, []);

  // Set up Scratch Card Canvas
  useEffect(() => {
    if (showScratchCard && !scratchCardScratched) {
      const timer = setTimeout(() => {
        if (!canvasRef.current) return;
        const canvas = canvasRef.current;
        const ctx = canvas.getContext("2d");
        
        // Handle bounding rect layout timing / high DPI screens
        const rect = canvas.getBoundingClientRect();
        canvas.width = rect.width > 0 ? rect.width : 280;
        canvas.height = rect.height > 0 ? rect.height : 280;
        
        // Draw background pattern (premium silver gradient)
        const gradient = ctx.createLinearGradient(0, 0, canvas.width, canvas.height);
        gradient.addColorStop(0, "#C0C0C0");
        gradient.addColorStop(0.2, "#E0E0E0");
        gradient.addColorStop(0.4, "#F0F0F0");
        gradient.addColorStop(0.6, "#D0D0D0");
        gradient.addColorStop(0.8, "#B0B0B0");
        gradient.addColorStop(1, "#9E9E9E");
        
        ctx.fillStyle = gradient;
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        
        // Draw dust speckles for realistic silver scratch layer
        ctx.fillStyle = "rgba(255, 255, 255, 0.15)";
        for (let i = 0; i < 200; i++) {
          ctx.fillRect(
            Math.random() * canvas.width,
            Math.random() * canvas.height,
            1 + Math.random() * 2,
            1 + Math.random() * 2
          );
        }
        
        // Draw overlay border & text
        ctx.strokeStyle = "rgba(255, 255, 255, 0.4)";
        ctx.lineWidth = 4;
        ctx.strokeRect(8, 8, canvas.width - 16, canvas.height - 16);
        
        ctx.fillStyle = "#374151";
        ctx.font = "bold 14px sans-serif";
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText("SCRATCH WITH YOUR FINGER", canvas.width / 2, canvas.height / 2 - 12);
        ctx.fillText("OR MOUSE TO REVEAL!", canvas.width / 2, canvas.height / 2 + 12);
      }, 100);
      
      return () => clearTimeout(timer);
    }
  }, [showScratchCard, scratchCardScratched]);

  const handleCopyCode = (code) => {
    if (!code) return;
    navigator.clipboard.writeText(code);
    setCopied(true);
    toast.success("Promo code copied to clipboard!");
    setTimeout(() => setCopied(false), 2000);
  };

  // Check how much of the canvas has been scratched
  const checkScratchPercentage = () => {
    if (!canvasRef.current) return;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");
    const imgData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const pixels = imgData.data;
    let transparent = 0;
    
    // Check alpha values (every 4th element is alpha)
    for (let i = 3; i < pixels.length; i += 4) {
      if (pixels[i] < 128) {
        transparent++;
      }
    }
    
    const percentage = transparent / (pixels.length / 4);
    if (percentage > 0.45 && !isFullyRevealed) {
      revealReward();
    }
  };

  // Reveal Reward logic
  const revealReward = async () => {
    if (claimingRef.current) return;
    claimingRef.current = true;
    setIsFullyRevealed(true);
    
    // Animate canvas fade out
    if (canvasRef.current) {
      const canvas = canvasRef.current;
      canvas.style.transition = "opacity 0.5s ease-out";
      canvas.style.opacity = 0;
    }
    
    const isTryAgain = wonReward?.rewardType === "try_again";
    if (!isTryAgain) {
      // Trigger celebratory confetti
      confetti({
        particleCount: 120,
        spread: 70,
        origin: { y: 0.6 }
      });
    }
    
    try {
      // API call to backend to claim the scratch card reward
      const res = await customerApi.scratchCard(spinId);
      const data = res?.data?.result || {};
      
      setScratchCardScratched(true);
      setWonReward(data.rewardDetails);
      if (isTryAgain) {
        toast.info("Better luck next time!");
      } else {
        toast.success("Reward claimed successfully!");
      }
    } catch (error) {
      console.error("Error claiming scratch card reward:", error);
      toast.error("Failed to claim reward. Please try again.");
      claimingRef.current = false;
    }
  };

  // Drawing handlers for Canvas Scratch
  const getMousePos = (e) => {
    if (!canvasRef.current) return { x: 0, y: 0 };
    const canvas = canvasRef.current;
    const rect = canvas.getBoundingClientRect();
    
    // Handle both mouse and touch events
    const clientX = e.touches ? e.touches[0].clientX : e.clientX;
    const clientY = e.touches ? e.touches[0].clientY : e.clientY;
    
    return {
      x: clientX - rect.left,
      y: clientY - rect.top
    };
  };

  const startDrawing = (e) => {
    isDrawingRef.current = true;
    lastPosRef.current = getMousePos(e);
  };

  const draw = (e) => {
    if (!isDrawingRef.current || !canvasRef.current) return;
    e.preventDefault(); // Prevent scrolling on touch devices
    
    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");
    const currentPos = getMousePos(e);
    
    ctx.globalCompositeOperation = "destination-out";
    ctx.lineJoin = "round";
    ctx.lineCap = "round";
    ctx.lineWidth = 32; // Scratch brush size
    
    ctx.beginPath();
    ctx.moveTo(lastPosRef.current.x, lastPosRef.current.y);
    ctx.lineTo(currentPos.x, currentPos.y);
    ctx.stroke();
    
    lastPosRef.current = currentPos;
    checkScratchPercentage();
  };

  const stopDrawing = () => {
    isDrawingRef.current = false;
  };

  // Spin Wheel action
  const handleSpin = async () => {
    if (isSpinning || hasSpunToday) return;
    
    try {
      setIsSpinning(true);
      // Reset scratch card state for the new spin
      setScratchCardScratched(false);
      setIsFullyRevealed(false);
      setWonReward(null);
      claimingRef.current = false;
      
      const res = await customerApi.spinWheel();
      const data = res?.data?.result || {};
      
      const details = data.rewardDetails || {};
      const newSpinId = data.spinId;
      
      setSpinId(newSpinId);
      
      // Find the index of the won reward in wheelOptions
      const winIndex = wheelOptions.findIndex(
        (opt) => opt.label === details.label && opt.rewardType === details.rewardType
      );
      
      if (winIndex === -1) {
        // Fallback rotation if match is somehow not found
        const currentFullRotations = Math.floor(rotation / 360) * 360;
        const randomRot = currentFullRotations + 1440 + Math.random() * 360;
        setRotation(randomRot);
        setWonReward(details);
        setTimeout(() => {
          setIsSpinning(false);
          setHasSpunToday(true);
          setShowScratchCard(true);
          setScratchCardScratched(true);
          setIsFullyRevealed(true);
          if (details.rewardType !== "try_again") {
            confetti({
              particleCount: 120,
              spread: 70,
              origin: { y: 0.6 }
            });
            toast.success("Congratulations! You won a reward!");
          } else {
            toast.info("Better luck next time!");
          }
        }, 5000);
        return;
      }
      
      const numSlices = wheelOptions.length;
      // Angle offset of each slice: slice 0 centered around mid angle relative to top
      const sliceAngle = 360 / numSlices;
      const midAngle = (winIndex + 0.5) * sliceAngle;
      
      // Calculate rotation to align winning slice with top pointer (12 o'clock)
      // Standard SVG layout first slice starts at -90 deg. 
      // Spin clockwise: target is 360 - midAngle. Add 5 full rotations (1800 deg)
      // Accumulate relative to current rotation to keep spinning clockwise
      const currentFullRotations = Math.floor(rotation / 360) * 360;
      const finalRotation = currentFullRotations + 1800 + (360 - midAngle);
      
      setRotation(finalRotation);
      setWonReward(details);
      
      // Sync state transition when spin ends (5 seconds transition duration)
      setTimeout(() => {
        setIsSpinning(false);
        setHasSpunToday(true);
        setShowScratchCard(true);
        setScratchCardScratched(true);
        setIsFullyRevealed(true);
        
        if (details.rewardType !== "try_again") {
          // Trigger celebratory confetti
          confetti({
            particleCount: 120,
            spread: 70,
            origin: { y: 0.6 }
          });
          toast.success("Congratulations! You won a reward!");
        } else {
          toast.info("Better luck next time!");
        }
      }, 5000);
      
    } catch (error) {
      setIsSpinning(false);
      const errMsg = error?.response?.data?.message || "Failed to spin the wheel.";
      toast.error(errMsg);
    }
  };

  // Render Wheel Path for SVG
  const renderWheelPaths = () => {
    const numSlices = wheelOptions.length;
    if (numSlices === 0) return null;
    
    const sliceAngle = 360 / numSlices;
    const center = 150;
    const radius = 140;
    
    return wheelOptions.map((opt, i) => {
      // Calculate start and end angles relative to top (-90 degrees)
      const startDeg = i * sliceAngle - 90;
      const endDeg = (i + 1) * sliceAngle - 90;
      
      const startRad = (startDeg * Math.PI) / 180;
      const endRad = (endDeg * Math.PI) / 180;
      
      const x1 = center + radius * Math.cos(startRad);
      const y1 = center + radius * Math.sin(startRad);
      const x2 = center + radius * Math.cos(endRad);
      const y2 = center + radius * Math.sin(endRad);
      
      // Path description: move to center, line to edge, arc to end edge, close
      const pathD = `
        M ${center} ${center}
        L ${x1} ${y1}
        A ${radius} ${radius} 0 0 1 ${x2} ${y2}
        Z
      `;
      
      // Text coordinates (midway along radius in center of slice)
      const textDeg = startDeg + sliceAngle / 2;
      const textRad = (textDeg * Math.PI) / 180;
      const textRadius = radius * 0.65;
      const tx = center + textRadius * Math.cos(textRad);
      const ty = center + textRadius * Math.sin(textRad);
      
      return (
        <g key={i}>
          <path
            d={pathD}
            fill={opt.bgColor || "#E11D48"}
            stroke="#FFFFFF"
            strokeWidth="1.5"
          />
          <text
            x={tx}
            y={ty}
            fill={opt.textColor || "#FFFFFF"}
            fontSize="12"
            fontWeight="800"
            textAnchor="middle"
            dominantBaseline="middle"
            transform={`rotate(${textDeg + 90}, ${tx}, ${ty})`}
            style={{ fontFamily: "'Inter', sans-serif" }}
            className="select-none"
          >
            {opt.label}
          </text>
        </g>
      );
    });
  };

  return (
    <div className="min-h-screen bg-[#FAF8F6] pb-24 md:pb-8 font-sans text-slate-800 flex flex-col items-center">
      {/* Premium Sticky Header matching ProfilePage */}
      <div 
        style={{
          background: "var(--customer-header-gradient)",
          backdropFilter: "blur(20px) saturate(180%)",
          WebkitBackdropFilter: "blur(20px) saturate(180%)",
          borderBottom: "1px solid rgba(255, 255, 255, 0.08)",
          borderBottomLeftRadius: "20px",
          borderBottomRightRadius: "20px",
        }}
        className="w-full sticky top-0 z-30 px-4 py-3 flex items-center gap-2 mb-4 shadow-[0_8px_32px_rgba(0,0,0,0.12)]"
      >
        <button
          onClick={() => navigate(-1)}
          className="w-10 h-10 flex items-center justify-center hover:bg-white/10 rounded-full transition-colors -ml-1 text-white"
        >
          <ChevronLeft size={22} />
        </button>
        <h1 className="text-lg font-bold text-white tracking-tight flex items-center gap-2">
          <Sparkles className="text-amber-300 animate-pulse" size={20} />
          Spin & Win
        </h1>
      </div>

      {loading ? (
        <div className="flex-1 flex flex-col items-center justify-center p-8">
          <div className="w-12 h-12 border-4 border-amber-500 border-t-transparent rounded-full animate-spin mb-4"></div>
          <p className="text-slate-500 text-sm font-medium">Checking today's spin availability...</p>
        </div>
      ) : (
        <div className="w-full max-w-lg px-4 py-6 flex flex-col items-center space-y-8">
          {/* Top banner / teaser */}
          <div className="text-center space-y-3">
            <span className="inline-block bg-amber-500/10 text-amber-700 border border-amber-500/20 px-3 py-1.5 rounded-full text-xs font-semibold tracking-wide uppercase mb-2">
              Daily Lucky Reward
            </span>
            <h2 className="text-2xl font-black text-slate-900 tracking-tight">Spin The Lucky Wheel</h2>
            <p className="text-slate-500 text-xs max-w-sm mx-auto">
              Get one free spin every calendar day to win scratch cards containing cashback or discount coupons!
            </p>
          </div>

          <AnimatePresence mode="wait">
            {!showScratchCard ? (
              // Wheel Display Mode
              <motion.div
                key="wheel-mode"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="flex flex-col items-center space-y-8 w-full"
              >
                {/* SVG Pointer and Wheel Container */}
                <div className="relative w-[300px] h-[300px] flex items-center justify-center">
                  {/* Outer Glowing Border Ring */}
                  <div className="absolute inset-0 rounded-full bg-gradient-to-tr from-amber-500/10 to-purple-500/10 blur-xl"></div>


                  {/* SVG Wheel itself */}
                  <div 
                    style={{
                      transform: `rotate(${rotation}deg)`,
                      transition: isSpinning ? "transform 5000ms cubic-bezier(0.15, 0.9, 0.25, 1)" : "none",
                    }}
                    className="relative w-[280px] h-[280px] z-10 rounded-full overflow-hidden shadow-2xl"
                  >
                    <svg viewBox="0 0 300 300" className="w-full h-full">
                      {wheelOptions.length > 0 ? (
                        renderWheelPaths()
                      ) : (
                        <g>
                          <circle cx="150" cy="150" r="140" fill="#f1f5f9" />
                          <text x="150" y="150" fill="#64748b" fontSize="12" textAnchor="middle">
                            No active rewards
                          </text>
                        </g>
                      )}
                    </svg>
                  </div>

                  {/* Center Peg / Center Pin */}
                  <div className="absolute z-20 w-12 h-12 rounded-full bg-white border-4 border-slate-200 flex items-center justify-center shadow-lg">
                    <Gift size={18} className="text-amber-500" />
                  </div>

                  {/* Top Pointer Indicator */}
                  <div className="absolute top-[-10px] z-20 left-1/2 -translate-x-1/2">
                    <svg width="24" height="28" viewBox="0 0 24 28" fill="none">
                      <path
                        d="M12 28L0 4C0 4 5 0 12 0C19 0 24 4 24 4L12 28Z"
                        fill="#F59E0B"
                        stroke="#FFFFFF"
                        strokeWidth="2.5"
                        strokeLinejoin="round"
                      />
                    </svg>
                  </div>
                </div>

                {/* Spin Button or Spin Status */}
                <div className="w-full max-w-xs">
                  {hasSpunToday ? (
                    <div className="bg-white border border-slate-200 rounded-xl p-4 text-center space-y-2 shadow-sm">
                      <p className="text-sm font-semibold text-slate-800">You've spun the wheel today!</p>
                      <p className="text-xs text-slate-500">
                        Come back tomorrow after midnight to claim your next free spin.
                      </p>
                      {wonReward && (
                        <button
                          onClick={() => setShowScratchCard(true)}
                          className="mt-2 w-full py-2.5 px-4 bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold rounded-lg transition-colors text-xs flex items-center justify-center gap-1.5"
                        >
                          <Award size={15} />
                          View Scratched Reward
                        </button>
                      )}
                    </div>
                  ) : (
                    <button
                      onClick={handleSpin}
                      disabled={isSpinning || wheelOptions.length === 0}
                      className="w-full py-4 px-6 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-950 font-black rounded-xl shadow-[0_4px_20px_rgba(245,158,11,0.2)] disabled:opacity-40 disabled:cursor-not-allowed transition-all text-sm uppercase tracking-wider flex items-center justify-center gap-2 animate-bounce"
                      style={{ animationDuration: '3s' }}
                    >
                      {isSpinning ? (
                        <>
                          <RefreshCw className="animate-spin" size={16} />
                          Spinning...
                        </>
                      ) : (
                        <>
                          <Gift size={18} />
                          SPIN NOW (FREE)
                        </>
                      )}
                    </button>
                  )}
                </div>
              </motion.div>
            ) : (
              // Scratch Card Mode
              <motion.div
                key="scratch-mode"
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                className="flex flex-col items-center space-y-6 w-full"
              >
                <div className="relative w-[280px] h-[280px] rounded-2xl overflow-hidden border-2 border-slate-200 bg-white shadow-2xl flex items-center justify-center">
                  
                  {/* Underlay Prize Display (revealed when canvas is scratched) */}
                  <div className="absolute inset-0 flex flex-col items-center justify-center p-6 text-center space-y-4">
                    <div className="w-16 h-16 rounded-full bg-amber-500/10 flex items-center justify-center text-amber-600 border border-amber-500/20">
                      {wonReward?.rewardType === "cashback" ? <Wallet size={32} /> : <Award size={32} />}
                    </div>
                    
                    <div>
                      {wonReward?.rewardType !== "try_again" && (
                        <p className="text-slate-500 text-xs font-semibold uppercase tracking-wider">Congratulations!</p>
                      )}
                      <h3 className="text-2xl font-black text-slate-900 leading-tight mt-1">{wonReward?.label}</h3>
                    </div>
                    
                    {wonReward?.rewardType === "coupon" && wonReward?.couponCode && (
                      <div className="w-full space-y-2">
                        <div className="bg-slate-50 border border-slate-200 rounded-lg p-2 flex items-center justify-between gap-2">
                          <code className="text-amber-700 font-mono font-bold text-sm tracking-wider select-all">
                            {wonReward.couponCode}
                          </code>
                          <button
                            onClick={() => handleCopyCode(wonReward.couponCode)}
                            className="p-1.5 hover:bg-slate-200 text-slate-500 hover:text-slate-800 rounded-md transition-colors"
                          >
                            {copied ? <Check size={16} className="text-green-600" /> : <Copy size={16} />}
                          </button>
                        </div>
                        <p className="text-[10px] text-slate-500">
                          {wonReward.description || `Use code on checkout. Min order ₹${wonReward.minOrderValue || 200}. Valid for ${wonReward.validityDays || 7} days.`}
                        </p>
                      </div>
                    )}

                    {wonReward?.rewardType === "cashback" && (
                      <div className="bg-slate-50 border border-slate-200 rounded-lg p-3 text-center w-full">
                        <p className="text-xs text-green-600 font-semibold flex items-center justify-center gap-1">
                          <Check size={14} /> ₹{wonReward?.value} Cashback Credited
                        </p>
                        <p className="text-[10px] text-slate-500 mt-1">
                          Directly added to your wallet available balance.
                        </p>
                      </div>
                    )}
                  </div>

                  {/* HTML5 Canvas overlay layer */}
                  {!scratchCardScratched && !isFullyRevealed && (
                    <canvas
                      ref={canvasRef}
                      className="absolute inset-0 z-20 cursor-crosshair touch-none w-full h-full"
                      onMouseDown={startDrawing}
                      onMouseMove={draw}
                      onMouseUp={stopDrawing}
                      onMouseLeave={stopDrawing}
                      onTouchStart={startDrawing}
                      onTouchMove={draw}
                      onTouchEnd={stopDrawing}
                    />
                  )}
                </div>

                <div className="w-full max-w-xs space-y-3">
                  {!isFullyRevealed && (
                    <p className="text-xs text-slate-500 text-center animate-pulse">
                      Scratch at least 50% of the silver card to claim your prize!
                    </p>
                  )}

                  {isFullyRevealed && (
                    <div className="space-y-2">
                      <button
                        onClick={() => {
                          setShowScratchCard(false);
                          // refresh the state to show the disabled button correctly
                          fetchState();
                        }}
                        className="w-full py-3 px-4 bg-white border border-slate-300 hover:bg-slate-50 text-slate-700 font-bold rounded-lg transition-colors text-xs shadow-sm"
                      >
                        Back to Lucky Wheel
                      </button>
                      
                      {wonReward?.rewardType === "cashback" && (
                        <button
                          onClick={() => navigate("/wallet")}
                          className="w-full py-3 px-4 bg-amber-500 text-slate-950 font-bold rounded-lg hover:bg-amber-400 transition-colors text-xs flex items-center justify-center gap-1.5"
                        >
                          <Wallet size={15} />
                          Go to My Wallet
                        </button>
                      )}
                    </div>
                  )}
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Quick FAQ / Info */}
          <div className="w-full bg-white border border-slate-200 rounded-xl p-4 text-[11px] text-slate-600 space-y-2 shadow-sm">
            <h4 className="font-bold text-slate-800 uppercase tracking-wider">How it works:</h4>
            <ul className="list-disc pl-4 space-y-1">
              <li>You get exactly one spin per day. Reset occurs at midnight.</li>
              <li>Every spin is calculated server-side for fair distribution.</li>
              <li>Won rewards are credited to your account instantly after spinning the lucky wheel.</li>
              <li>Cashback rewards are credited instantly to your Jalapino wallet balance.</li>
            </ul>
          </div>
        </div>
      )}
    </div>
  );
};

export default SpinWinPage;
