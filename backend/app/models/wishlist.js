import mongoose from "mongoose";

const wishlistSchema = new mongoose.Schema(
    {
        customerId: {
            type: mongoose.Schema.Types.ObjectId,
            // See cart.js for the rationale; "Customer" was an unregistered
            // model name. Audit-plan critical finding C-1.
            ref: "User",
            required: true,
            unique: true,
        },
        products: [
            {
                type: mongoose.Schema.Types.ObjectId,
                ref: "Product",
            },
        ],
        // Plan My Event wishlist - kept separate from the retail `products` list.
        eventProducts: [
            {
                _id: false,
                product: { type: mongoose.Schema.Types.ObjectId, ref: "Product" },
                seller: { type: mongoose.Schema.Types.ObjectId, ref: "Seller" },
                addedAt: { type: Date, default: Date.now },
            },
        ],
    },
    { timestamps: true }
);

const Wishlist = mongoose.model("Wishlist", wishlistSchema);
export default Wishlist;
