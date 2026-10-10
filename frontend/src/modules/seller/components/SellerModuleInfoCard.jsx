import React from 'react';
import { useAuth } from '@core/context/AuthContext';
import {
  HiOutlineCalendar,
  HiOutlineShoppingBag,
  HiOutlineCube,
  HiOutlineTruck,
  HiOutlineArchiveBox,
  HiOutlineCurrencyDollar,
  HiOutlineChartBarSquare,
  HiOutlineTag,
  HiOutlineBuildingStorefront,
  HiOutlineCheckCircle
} from 'react-icons/hi2';

const isMongoId = (str) => {
  if (!str || typeof str !== 'string') return false;
  return /^[0-9a-fA-F]{24}$/.test(str.trim());
};

const formatCategoryName = (cat) => {
  if (!cat) return null;
  let name = null;
  if (typeof cat === 'string') {
    name = cat.trim();
  } else if (typeof cat === 'object' && cat.name) {
    name = String(cat.name).trim();
  }
  if (!name || isMongoId(name)) return null;
  return name;
};

const SellerModuleInfoCard = () => {
  const { user: seller } = useAuth();

  if (!seller) return null;

  // Categorize by module
  const eventCatNames = Array.from(
    new Set(
      (seller.allowedEventCategories || [])
        .map(formatCategoryName)
        .filter(Boolean)
    )
  );

  const retailCatNames = Array.from(
    new Set(
      (seller.allowedRetailCategories || [])
        .map(formatCategoryName)
        .filter(Boolean)
    )
  );

  const wholesaleCatNames = Array.from(
    new Set(
      (seller.allowedWholesaleCategories || [])
        .map(formatCategoryName)
        .filter(Boolean)
    )
  );

  const serviceCatNames = Array.from(
    new Set(
      (seller.serviceCategories || [])
        .map(formatCategoryName)
        .filter(Boolean)
    )
  );

  const isEventSeller = Boolean(seller.planMyEventEnabled || seller.isEventSeller);

  // Build categorized badge list
  const categorizedBadges = [];

  // Primary Category is NO LONGER PUSHED per user request
  // Only explicitly allowed categories from Admin panel will show up.
  // if (primaryCategory) { ... }

  // Plan My Event Categories
  if (isEventSeller) {
    eventCatNames.forEach((name) => {
      if (!categorizedBadges.some((b) => b.module === 'Plan My Event' && b.name.toLowerCase() === name.toLowerCase())) {
        categorizedBadges.push({
          module: 'Plan My Event',
          name,
          badgeStyle: 'bg-purple-50 text-purple-700 border-purple-200',
        });
      }
    });

    // Event Commerce service categories selected by the admin during seller review
    serviceCatNames.forEach((name) => {
      if (!categorizedBadges.some((b) => b.module === 'Plan My Event · Event Commerce' && b.name.toLowerCase() === name.toLowerCase())) {
        categorizedBadges.push({
          module: 'Plan My Event · Event Commerce',
          name,
          badgeStyle: 'bg-purple-50 text-purple-700 border-purple-200',
        });
      }
    });
  }

  // Retail Store Categories
  if (seller.retailEnabled) {
    retailCatNames.forEach((name) => {
      if (!categorizedBadges.some((b) => b.module === 'Retail' && b.name.toLowerCase() === name.toLowerCase())) {
        categorizedBadges.push({
          module: 'Retail',
          name,
          badgeStyle: 'bg-emerald-50 text-emerald-700 border-emerald-200',
        });
      }
    });
  }

  // Wholesale Categories
  if (seller.wholesaleEnabled) {
    wholesaleCatNames.forEach((name) => {
      if (!categorizedBadges.some((b) => b.module === 'Wholesale' && b.name.toLowerCase() === name.toLowerCase())) {
        categorizedBadges.push({
          module: 'Wholesale',
          name,
          badgeStyle: 'bg-blue-50 text-blue-700 border-blue-200',
        });
      }
    });
  }

  // Modules Badges
  const modules = [
    {
      key: 'planMyEvent',
      label: 'Plan My Event',
      enabled: isEventSeller,
      icon: HiOutlineCalendar,
      activeBg: 'bg-purple-100 text-purple-800 border-purple-200',
    },
    {
      key: 'retail',
      label: 'Retail Store',
      enabled: Boolean(seller.retailEnabled),
      icon: HiOutlineBuildingStorefront,
      activeBg: 'bg-emerald-100 text-emerald-800 border-emerald-200',
    },
    {
      key: 'wholesale',
      label: 'Wholesale',
      enabled: Boolean(seller.wholesaleEnabled),
      icon: HiOutlineShoppingBag,
      activeBg: 'bg-blue-100 text-blue-800 border-blue-200',
    },
    {
      key: 'products',
      label: 'Products Catalog',
      enabled: seller.productsEnabled !== false,
      icon: HiOutlineCube,
      activeBg: 'bg-indigo-100 text-indigo-800 border-indigo-200',
    },
    {
      key: 'orders',
      label: 'Orders & Returns',
      enabled: seller.ordersEnabled !== false,
      icon: HiOutlineTruck,
      activeBg: 'bg-sky-100 text-sky-800 border-sky-200',
    },
    {
      key: 'stock',
      label: 'Stock & Inventory',
      enabled: seller.stockEnabled !== false,
      icon: HiOutlineArchiveBox,
      activeBg: 'bg-amber-100 text-amber-800 border-amber-200',
    },
    {
      key: 'wallet',
      label: 'Earnings & Payouts',
      enabled: seller.walletEnabled !== false,
      icon: HiOutlineCurrencyDollar,
      activeBg: 'bg-emerald-100 text-emerald-800 border-emerald-200',
    },
    {
      key: 'analytics',
      label: 'Sales Reports',
      enabled: seller.analyticsEnabled !== false,
      icon: HiOutlineChartBarSquare,
      activeBg: 'bg-violet-100 text-violet-800 border-violet-200',
    },
  ].filter((m) => m.enabled);

  return (
    <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-sm space-y-4">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-100 pb-4">
        {/* Assigned Categories Grouped by Module */}
        <div className="space-y-1.5 flex-1">
          <div className="flex items-center gap-2">
            <HiOutlineTag className="w-4 h-4 text-slate-400" />
            <span className="text-xs font-bold uppercase tracking-wider text-slate-500">
              Assigned Categories & Module Tagging
            </span>
          </div>
          <div className="flex flex-wrap gap-2 pt-1">
            {categorizedBadges.length > 0 ? (
              categorizedBadges.map((badge, idx) => (
                <span
                  key={idx}
                  className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold border capitalize shadow-2xs ${badge.badgeStyle}`}
                >
                  <HiOutlineCheckCircle className="w-3.5 h-3.5" />
                  <span className="opacity-75 font-semibold">[{badge.module}]</span>
                  <span>{badge.name}</span>
                </span>
              ))
            ) : (
              <span className="text-xs text-slate-400 italic">
                No specific category assigned
              </span>
            )}
          </div>
        </div>

        {/* Primary Status / Shop Name */}
        <div className="text-left md:text-right flex-shrink-0">
          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block">
            Seller Account Type
          </span>
          <span className="text-xs font-black text-slate-900 capitalize">
            {isEventSeller ? 'Event & Service Provider' : 'Retail Merchant'}
          </span>
        </div>
      </div>

      {/* Admin Remarks & Terms Banner */}
      {(seller.adminRemark || seller.adminTerms || seller.rejectionReason) && (
        <div className="rounded-xl border border-amber-200 bg-amber-50/80 p-4 space-y-2 mt-3">
          <div className="flex items-center gap-2 text-amber-900 font-bold text-xs uppercase tracking-wider">
            <span>📋 Admin Instructions & Terms</span>
          </div>

          {seller.rejectionReason && (
            <div className="text-xs text-rose-800 bg-rose-50 border border-rose-200 p-2.5 rounded-lg font-medium">
              <span className="font-bold text-rose-900">Bounce Back / Revision Reason: </span>
              {seller.rejectionReason}
            </div>
          )}

          {seller.adminRemark && (
            <div className="text-xs text-amber-900 font-medium">
              <span className="font-bold">Admin Remark: </span>
              <span className="whitespace-pre-wrap">{seller.adminRemark}</span>
            </div>
          )}

          {seller.adminTerms && (
            <div className="text-xs text-amber-900/90 font-medium border-t border-amber-200/60 pt-2 mt-2">
              <span className="font-bold text-amber-950">Terms & Conditions: </span>
              <span className="whitespace-pre-wrap">{seller.adminTerms}</span>
            </div>
          )}
        </div>
      )}

      {/* Active Business Modules */}
      <div className="space-y-1.5">
        <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500 block">
          Active Modules & Features (DB Enabled)
        </span>
        <div className="flex flex-wrap gap-2 pt-0.5">
          {modules.map((mod) => {
            const Icon = mod.icon;
            return (
              <span
                key={mod.key}
                className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-bold border transition-all ${mod.activeBg}`}
              >
                <Icon className="w-4 h-4" />
                {mod.label}
              </span>
            );
          })}
        </div>
      </div>

      {/* Seller Specific Configured Features */}
      {isEventSeller && (seller.primaryContactEnabled || seller.coupleContactEnabled || seller.corporateContactEnabled || seller.standardDateEnabled || seller.advancedDateEnabled) && (
        <div className="space-y-1.5 mt-4 pt-4 border-t border-slate-100">
          <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500 block">
            Custom Event Settings & Form Fields
          </span>
          <div className="flex flex-wrap gap-2 pt-0.5">
            {seller.primaryContactEnabled && <span className="inline-flex items-center px-2.5 py-1 rounded-md text-[10px] font-bold bg-blue-50 text-blue-700 border border-blue-200">👤 Primary Contact</span>}
            {seller.coupleContactEnabled && <span className="inline-flex items-center px-2.5 py-1 rounded-md text-[10px] font-bold bg-pink-50 text-pink-700 border border-pink-200">💑 Couple Contact</span>}
            {seller.corporateContactEnabled && <span className="inline-flex items-center px-2.5 py-1 rounded-md text-[10px] font-bold bg-purple-50 text-purple-700 border border-purple-200">🏢 Corporate Contact</span>}
            {seller.noOfGuestsEnabled && <span className="inline-flex items-center px-2.5 py-1 rounded-md text-[10px] font-bold bg-orange-50 text-orange-700 border border-orange-200">👥 No of Guests</span>}
            {seller.standardDateEnabled && <span className="inline-flex items-center px-2.5 py-1 rounded-md text-[10px] font-bold bg-fuchsia-50 text-fuchsia-700 border border-fuchsia-200">📅 Standard Date</span>}
            {seller.advancedDateEnabled && <span className="inline-flex items-center px-2.5 py-1 rounded-md text-[10px] font-bold bg-slate-100 text-slate-700 border border-slate-200">📅 Advanced Date</span>}
            {seller.functionLocationEnabled && <span className="inline-flex items-center px-2.5 py-1 rounded-md text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">📍 Function Location</span>}
            {seller.sellerLocationEnabled && <span className="inline-flex items-center px-2.5 py-1 rounded-md text-[10px] font-bold bg-cyan-50 text-cyan-700 border border-cyan-200">🏪 Seller Location</span>}
            {seller.eventDetailsEnabled && <span className="inline-flex items-center px-2.5 py-1 rounded-md text-[10px] font-bold bg-indigo-50 text-indigo-700 border border-indigo-200">📝 Event Details Form</span>}
          </div>
        </div>
      )}
    </div>
  );
};

export default SellerModuleInfoCard;
