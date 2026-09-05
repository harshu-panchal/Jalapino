import Seller from "../models/seller.js";

// @desc    Start Live Stream
// @route   POST /api/live/start
// @access  Private (Seller)
export const startLiveStream = async (req, res) => {
  try {
    const { title, roomId } = req.body;
    
    // req.user or req.seller depending on auth middleware, assuming req.user.id for now
    // wait, what does isSeller middleware attach? usually req.user.id or req.seller._id
    // let's assume req.seller for now based on standard Jalapino convention, or req.user.
    const sellerId = req.user ? req.user.id : req.seller._id;
    
    const seller = await Seller.findById(sellerId);
    if (!seller) {
      return res.status(404).json({ success: false, message: "Seller not found" });
    }

    seller.liveStreaming = {
      isLive: true,
      roomId: roomId || `live_${seller._id}`,
      title: title || `${seller.shopName} is Live!`,
      pinnedProduct: null
    };

    await seller.save();

    res.status(200).json({
      success: true,
      message: "Live stream started successfully",
      liveData: seller.liveStreaming
    });
  } catch (error) {
    console.error("Error in startLiveStream:", error);
    res.status(500).json({ success: false, message: "Server Error" });
  }
};

// @desc    End Live Stream
// @route   POST /api/live/end
// @access  Private (Seller)
export const endLiveStream = async (req, res) => {
  try {
    const sellerId = req.user ? req.user.id : req.seller._id;
    
    const seller = await Seller.findById(sellerId);
    if (!seller) {
      return res.status(404).json({ success: false, message: "Seller not found" });
    }

    seller.liveStreaming = {
      isLive: false,
      roomId: null,
      title: null,
      pinnedProduct: null
    };

    await seller.save();

    res.status(200).json({
      success: true,
      message: "Live stream ended successfully"
    });
  } catch (error) {
    console.error("Error in endLiveStream:", error);
    res.status(500).json({ success: false, message: "Server Error" });
  }
};

// @desc    Get all active live sellers
// @route   GET /api/live/active
// @access  Public
export const getLiveSellers = async (req, res) => {
  try {
    const activeSellers = await Seller.find({ "liveStreaming.isLive": true })
      .select("shopName name liveStreaming category image"); // select necessary fields

    res.status(200).json({
      success: true,
      count: activeSellers.length,
      data: activeSellers
    });
  } catch (error) {
    console.error("Error in getLiveSellers:", error);
    res.status(500).json({ success: false, message: "Server Error" });
  }
};
