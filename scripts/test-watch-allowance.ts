import assert from "node:assert";
import { getGrantedViews, getWatchAllowance } from "../src/lib/watch-allowance";

async function runTests() {
  console.log("▶ Testing Watch Allowance & View Request Grant Calculations...");

  // Mock client simulating prisma or transaction client
  const createMockClient = (mockSum: number | null) => ({
    videoViewRequest: {
      aggregate: async ({ where, _sum }: any) => {
        assert.strictEqual(_sum.grantedViews, true, "Should request grantedViews sum");
        assert.strictEqual(where.status, "approved", "Must only count approved requests");
        return { _sum: { grantedViews: mockSum } };
      },
    },
  });

  // Test 1: Student with no grants
  {
    const client = createMockClient(null);
    const allowance = await getWatchAllowance(client, "student_1", "video_1", 3);
    assert.strictEqual(allowance, 3, "Allowance with no grants should equal base limit (3)");
    console.log("  ✓ Test 1 Passed: Base limit without grants equals 3");
  }

  // Test 2: Student with 2 extra granted views
  {
    const client = createMockClient(2);
    const allowance = await getWatchAllowance(client, "student_1", "video_1", 3);
    assert.strictEqual(allowance, 5, "Allowance with 2 grants should equal 5 (3 + 2)");
    console.log("  ✓ Test 2 Passed: Allowance with 2 approved extra views equals 5");
  }

  // Test 3: Multiple grants aggregating to 7
  {
    const client = createMockClient(7);
    const allowance = await getWatchAllowance(client, "student_1", "video_1", 5);
    assert.strictEqual(allowance, 12, "Allowance with 7 grants should equal 12 (5 + 7)");
    console.log("  ✓ Test 3 Passed: Multiple grants correctly sum with base limit (5 + 7 = 12)");
  }

  // Test 4: Negative grant safety clamp (corrupted DB row)
  {
    const client = createMockClient(-5);
    const granted = await getGrantedViews(client, "student_1", "video_1");
    assert.strictEqual(granted, 0, "Negative grant sum must be clamped to 0");
    const allowance = await getWatchAllowance(client, "student_1", "video_1", 3);
    assert.strictEqual(allowance, 3, "Allowance with negative grant sum must equal base limit (3)");
    console.log("  ✓ Test 4 Passed: Negative grant sum safety clamp to 0 verified");
  }

  // Test 5: Invalid/zero base limit
  {
    const client = createMockClient(4);
    const allowance = await getWatchAllowance(client, "student_1", "video_1", 0);
    assert.strictEqual(allowance, 4, "Zero base limit with 4 grants equals 4");
    console.log("  ✓ Test 5 Passed: Zero base limit handles cleanly");
  }

  console.log("\n✅ All 5 Watch Allowance Unit Tests Passed Successfully!");
}

runTests().catch((err) => {
  console.error("❌ Test failed:", err);
  process.exit(1);
});
