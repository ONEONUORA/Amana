import { getSupabaseClient } from "../../lib/supabase";
import { findOrCreateUser, updateUser, getPublicProfile } from "../user.service";
import { AppError, ErrorCode } from "../../errors/errorCodes";
import { Keypair } from "@stellar/stellar-sdk";

// Mock Supabase lib
jest.mock("../../lib/supabase", () => ({
  getSupabaseClient: jest.fn(),
}));

describe("UserService", () => {
  let realWallet: string;
  let mockSupabase: any;

  beforeAll(() => {
    realWallet = Keypair.random().publicKey();
  });

  beforeEach(() => {
    jest.clearAllMocks();
    
    // Setup deep mock for supabase chaining
    mockSupabase = {
      from: jest.fn().mockReturnThis(),
      select: jest.fn().mockReturnThis(),
      update: jest.fn().mockReturnThis(),
      insert: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
      single: jest.fn(),
    };

    (getSupabaseClient as jest.Mock).mockReturnValue(mockSupabase);
  });

  describe("findOrCreateUser", () => {
    it("should return existing user if found", async () => {
      mockSupabase.single.mockResolvedValue({
        data: { address: realWallet.toLowerCase(), id: "user-123" },
        error: null,
      });

      const user = await findOrCreateUser(realWallet);

      expect(user.id).toBe("user-123");
      expect(mockSupabase.from).toHaveBeenCalledWith("users");
      expect(mockSupabase.select).toHaveBeenCalled();
      expect(mockSupabase.eq).toHaveBeenCalledWith("address", realWallet.toLowerCase());
    });

    it("should create user if not found (PGRST116)", async () => {
      // First call (select) returns not found
      mockSupabase.single.mockResolvedValueOnce({
        data: null,
        error: { code: "PGRST116" },
      });

      // Second call (insert) returns created user
      mockSupabase.single.mockResolvedValueOnce({
        data: { address: realWallet.toLowerCase(), id: "new-user" },
        error: null,
      });

      const user = await findOrCreateUser(realWallet);

      expect(user.id).toBe("new-user");
      expect(mockSupabase.insert).toHaveBeenCalledWith({ address: realWallet.toLowerCase() });
    });

    it("should throw validation error for invalid address", async () => {
      await expect(findOrCreateUser("invalid")).rejects.toMatchObject({
        code: ErrorCode.VALIDATION_ERROR,
      });
    });

    it("should throw infra error if select fails with other error", async () => {
      mockSupabase.single.mockResolvedValue({
        data: null,
        error: { code: "SOME_OTHER_ERROR" },
      });

      await expect(findOrCreateUser(realWallet)).rejects.toMatchObject({
        code: ErrorCode.INFRA_ERROR,
      });
    });

    it("should throw infra error if insert fails", async () => {
      mockSupabase.single.mockResolvedValueOnce({
        data: null,
        error: { code: "PGRST116" },
      });
      mockSupabase.single.mockResolvedValueOnce({
        data: null,
        error: { code: "INSERT_FAIL" },
      });

      await expect(findOrCreateUser(realWallet)).rejects.toMatchObject({
        code: ErrorCode.INFRA_ERROR,
      });
    });
  });

  describe("updateUser", () => {
    it("should update user successfully", async () => {
      const input = { displayName: "New Name", avatarUrl: "https://example.com/avatar.png" };
      mockSupabase.single.mockResolvedValue({
        data: { ...input, address: realWallet.toLowerCase() },
        error: null,
      });

      const user = await updateUser(realWallet, input);

      expect(user.displayName).toBe("New Name");
      expect(mockSupabase.update).toHaveBeenCalled();
    });

    it("should throw validation error for invalid input", async () => {
      const invalidInput = { displayName: "a" }; // Too short
      await expect(updateUser(realWallet, invalidInput as any)).rejects.toMatchObject({
        code: ErrorCode.VALIDATION_ERROR,
      });
    });

    it("should throw not found error if user doesn't exist", async () => {
       mockSupabase.single.mockResolvedValue({
        data: null,
        error: { code: "PGRST116" },
      });

      await expect(updateUser(realWallet, { displayName: "Name" })).rejects.toMatchObject({
        code: ErrorCode.NOT_FOUND,
      });
    });

    it("should throw infra error if update fails", async () => {
      mockSupabase.single.mockResolvedValue({
        data: null,
        error: { code: "DB_ERROR" },
      });

      await expect(updateUser(realWallet, { displayName: "Name" })).rejects.toMatchObject({
        code: ErrorCode.INFRA_ERROR,
      });
    });
  });

  describe("getPublicProfile", () => {
    it("should return profile if found", async () => {
      mockSupabase.single.mockResolvedValue({
        data: { address: realWallet.toLowerCase(), display_name: "User" },
        error: null,
      });

      const profile = await getPublicProfile(realWallet);
      expect(profile!.display_name).toBe("User");
    });

    it("should return null if user not found", async () => {
      mockSupabase.single.mockResolvedValue({
        data: null,
        error: { code: "PGRST116" },
      });

      const profile = await getPublicProfile(realWallet);
      expect(profile).toBeNull();
    });

    it("should throw infra error if fetch fails", async () => {
      mockSupabase.single.mockResolvedValue({
        data: null,
        error: { code: "NETWORK_ERROR" },
      });

      await expect(getPublicProfile(realWallet)).rejects.toMatchObject({
        code: ErrorCode.INFRA_ERROR,
      });
    });
  });
});
