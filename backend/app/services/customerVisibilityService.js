import Seller from "../models/seller.js";
import { calculateDistance } from "../utils/helper.js";
import { buildKey, getOrSet, getTTL } from "./cacheService.js";

const MAX_SELLER_SEARCH_DISTANCE_M = 100000;

export function parseCustomerCoordinates(query = {}) {
  const lat = Number(query.lat);
  const lng = Number(query.lng);

  if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
    return { valid: false, lat: null, lng: null };
  }

  if (lat < -90 || lat > 90 || lng < -180 || lng > 180) {
    return { valid: false, lat: null, lng: null };
  }

  return { valid: true, lat, lng };
}

/**
 * Round lat/lng to 4 decimal places (~11m precision) for cache key.
 * This groups nearby requests into the same cache bucket.
 */
function buildNearbySellersKey(lat, lng) {
  const rLat = Number(lat).toFixed(4);
  const rLng = Number(lng).toFixed(4);
  return buildKey("sellers", "nearby", `${rLat}:${rLng}`);
}

export async function getNearbySellerIdsForCustomer(lat, lng) {
  const fetchFn = async () => {
    const sellers = await Seller.find({
      $or: [
        { isActive: true },
        { sellerStatus: "active" }
      ],
      location: {
        $near: {
          $geometry: {
            type: "Point",
            coordinates: [lng, lat],
          },
          $maxDistance: MAX_SELLER_SEARCH_DISTANCE_M,
        },
      },
    })
      .select("_id location serviceRadius")
      .lean();

    return sellers
      .filter((seller) => {
        const coords = seller?.location?.coordinates;
        if (!Array.isArray(coords) || coords.length < 2) return false;
        const [sellerLng, sellerLat] = coords;
        if (!Number.isFinite(sellerLat) || !Number.isFinite(sellerLng)) {
          return false;
        }
        const distanceKm = calculateDistance(lat, lng, sellerLat, sellerLng);
        return distanceKm <= (seller.serviceRadius || 5);
      })
      .map((seller) => String(seller._id));
  };

  return getOrSet(buildNearbySellersKey(lat, lng), fetchFn, getTTL("nearbySellers"));
}

export async function getZoneSellerIdsForCustomer(location) {
  const locationTokens = String(location || "")
    .split(",")
    .map((part) => part.trim())
    .filter((part) => part.length >= 3 && !/^india$/i.test(part) && !/^\d{6}$/.test(part));

  if (!locationTokens.length) return [];

  const patterns = locationTokens.map(
    (part) => new RegExp(part.replace(/[-/\\^$*+?.()|[\]{}]/g, "\\$&"), "i"),
  );
  const sellers = await Seller.find({
    $or: [
      { "customZones.city": { $in: patterns } },
      { "customZones.areas": { $in: patterns } },
    ],
  }).select("_id").lean();

  return sellers.map((seller) => String(seller._id));
}

// ---------------------------------------------------------------------------
// Retail visibility by the product's "Location Coverage Type" + "Delivery Type"
// (both chosen by the seller when adding the product, saved in DB):
// - pan_india  -> every customer (active sellers)
// - zone_wise  -> customers whose location is in one of the seller's zones
// - hyperlocal -> customers inside the seller's service radius
// - no coverage set (older products) -> same as before (inside service radius)
// A product that has a coverage type also needs at least one Delivery Type
// (Delivery / Service / Rental), same rule as Plan My Event.
// ---------------------------------------------------------------------------
export const RETAIL_COVERAGE_IDS = ["hyperlocal", "pan_india", "zone_wise"];

async function getActiveSellerIds() {
  const ids = await Seller.find({ $or: [{ isActive: true }, { sellerStatus: "active" }] }).distinct("_id");
  return ids.map(String);
}

export async function getRetailVisibleSellerGroups({ nearbySellerIds = [], location = "" } = {}) {
  const [activeIds, zoneIds] = await Promise.all([
    getActiveSellerIds(),
    location ? getZoneSellerIdsForCustomer(location) : Promise.resolve([]),
  ]);
  const activeSet = new Set(activeIds);
  return {
    nearby: nearbySellerIds.map(String),
    panIndia: activeIds,
    zone: zoneIds.map(String).filter((id) => activeSet.has(id)),
  };
}

export function buildRetailCoverageConditions(groups, requestedSellerIds = []) {
  const requested = new Set(requestedSellerIds.map(String));
  const limit = (ids) => (requested.size ? ids.filter((id) => requested.has(String(id))) : ids);
  return [
    {
      $or: [
        { deliveryCoverage: "pan_india", sellerId: { $in: limit(groups.panIndia) } },
        { deliveryCoverage: "zone_wise", sellerId: { $in: limit(groups.zone) } },
        { deliveryCoverage: "hyperlocal", sellerId: { $in: limit(groups.nearby) } },
        { deliveryCoverage: { $nin: RETAIL_COVERAGE_IDS }, sellerId: { $in: limit(groups.nearby) } },
      ],
    },
    {
      $or: [
        { deliveryCoverage: { $nin: RETAIL_COVERAGE_IDS } },
        { isDelivery: true },
        { isService: true },
        { isRental: true },
      ],
    },
  ];
}

export function isProductVisibleForRetailCustomer(product, groups) {
  const sellerId = String(product?.sellerId?._id || product?.sellerId || "");
  const coverage = Array.isArray(product?.deliveryCoverage) ? product.deliveryCoverage : [];
  const hasCoverage = coverage.some((c) => RETAIL_COVERAGE_IDS.includes(c));
  if (hasCoverage && !(product.isDelivery || product.isService || product.isRental)) return false;
  if (coverage.includes("pan_india") && groups.panIndia.includes(sellerId)) return true;
  if (coverage.includes("zone_wise") && groups.zone.includes(sellerId)) return true;
  if ((coverage.includes("hyperlocal") || !hasCoverage) && groups.nearby.includes(sellerId)) return true;
  return false;
}
