import { jest } from "@jest/globals";

const mockReferralFindById = jest.fn();
const mockSettingFindOne = jest.fn();
const mockCouponSave = jest.fn();
const mockCreditWallet = jest.fn();

// Mock models and services
jest.unstable_mockModule("../app/models/referral.js", () => ({
  default: {
    findById: mockReferralFindById,
  },
}));

jest.unstable_mockModule("../app/models/setting.js", () => ({
  default: {
    findOne: mockSettingFindOne,
  },
}));

jest.unstable_mockModule("../app/models/coupon.js", () => {
  return {
    default: class MockCoupon {
      constructor(data) {
        Object.assign(this, data);
      }
      save = mockCouponSave;
    }
  };
});

jest.unstable_mockModule("../app/services/finance/walletService.js", () => ({
  creditWallet: mockCreditWallet,
}));

// Load service after mocks are defined
const { processReferralRewards } = await import(
  "../app/services/referralService.js"
);

describe("referralService - processReferralRewards", () => {
  let mockReferral;

  beforeEach(() => {
    jest.clearAllMocks();

    mockReferral = {
      _id: "referral123",
      referrerId: "referrerUser",
      refereeId: "refereeUser",
      status: "pending",
      referrerRewardClaimed: false,
      refereeRewardClaimed: false,
      save: jest.fn().mockResolvedValue(true),
    };

    mockReferralFindById.mockResolvedValue(mockReferral);

    mockSettingFindOne.mockResolvedValue({
      referralProgram: {
        isEnabled: true,
        rewardType: "cashback",
        referrerReward: 50,
        refereeReward: 20,
        eligibilityCondition: "first_order_delivered",
        minOrderValue: 100,
      },
    });
  });

  it("distributes wallet cashback rewards to referrer and referee successfully", async () => {
    await processReferralRewards("referral123");

    expect(mockReferralFindById).toHaveBeenCalledWith("referral123");
    expect(mockCreditWallet).toHaveBeenCalledTimes(2);

    // Referrer credit check
    expect(mockCreditWallet).toHaveBeenNthCalledWith(1, {
      ownerType: "CUSTOMER",
      ownerId: "referrerUser",
      amount: 50,
      ledgerType: "ADJUSTMENT",
      ledgerReference: "REF-BONUS-referral123",
      ledgerDescription: expect.stringContaining("refereeUser"),
    });

    // Referee credit check
    expect(mockCreditWallet).toHaveBeenNthCalledWith(2, {
      ownerType: "CUSTOMER",
      ownerId: "refereeUser",
      amount: 20,
      ledgerType: "ADJUSTMENT",
      ledgerReference: "REF-BONUS-referral123",
      ledgerDescription: expect.stringContaining("referrerUser"),
    });

    expect(mockReferral.referrerRewardClaimed).toBe(true);
    expect(mockReferral.refereeRewardClaimed).toBe(true);
    expect(mockReferral.status).toBe("completed");
    expect(mockReferral.save).toHaveBeenCalled();
  });

  it("generates discount coupons when rewardType is coupon", async () => {
    mockSettingFindOne.mockResolvedValue({
      referralProgram: {
        isEnabled: true,
        rewardType: "coupon",
        referrerReward: 15,
        refereeReward: 10,
        minOrderValue: 120,
      },
    });

    mockCouponSave.mockResolvedValue(true);

    await processReferralRewards("referral123");

    expect(mockCreditWallet).not.toHaveBeenCalled();
    expect(mockCouponSave).toHaveBeenCalledTimes(2);

    expect(mockReferral.referrerRewardClaimed).toBe(true);
    expect(mockReferral.refereeRewardClaimed).toBe(true);
    expect(mockReferral.status).toBe("completed");
    expect(mockReferral.save).toHaveBeenCalled();
  });

  it("does not process rewards if referral is already completed", async () => {
    mockReferral.status = "completed";

    await processReferralRewards("referral123");

    expect(mockSettingFindOne).not.toHaveBeenCalled();
    expect(mockCreditWallet).not.toHaveBeenCalled();
    expect(mockReferral.save).not.toHaveBeenCalled();
  });

  it("does not process rewards if referral program is disabled", async () => {
    mockSettingFindOne.mockResolvedValue({
      referralProgram: {
        isEnabled: false,
      },
    });

    await processReferralRewards("referral123");

    expect(mockCreditWallet).not.toHaveBeenCalled();
    expect(mockReferral.save).not.toHaveBeenCalled();
  });
});
