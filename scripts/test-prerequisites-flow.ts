import assert from "node:assert/strict";
import {
  evaluateContentAccess,
  ContentType,
  ContentProgressStatus,
  GraphContentItem,
  GraphPrerequisite,
  GraphStudentProgress,
} from "../src/lib/content-access-engine";

async function runPrerequisitesTest() {
  console.log("--- Starting Prerequisites & Content Flow Engine Verification ---");

  const items: GraphContentItem[] = [
    { id: "item-video-1", title: "فيديو الدرس الأول", type: ContentType.VIDEO },
    { id: "item-hw-1", title: "واجب الدرس الأول", type: ContentType.HOMEWORK },
    { id: "item-sol-1", title: "فيديو حل الواجب", type: ContentType.SOLUTION_VIDEO },
    { id: "item-exam-1", title: "امتحان الدرس الأول", type: ContentType.EXAM },
  ];

  // Define sequential chain:
  // HW requires Video
  // SolVideo requires HW
  // Exam requires SolVideo
  const prerequisites: GraphPrerequisite[] = [
    {
      targetContentId: "item-hw-1",
      prerequisiteContentId: "item-video-1",
      requiredStatus: ContentProgressStatus.COMPLETED,
    },
    {
      targetContentId: "item-sol-1",
      prerequisiteContentId: "item-hw-1",
      requiredStatus: ContentProgressStatus.COMPLETED,
    },
    {
      targetContentId: "item-exam-1",
      prerequisiteContentId: "item-sol-1",
      requiredStatus: ContentProgressStatus.COMPLETED,
    },
  ];

  // Case 1: Fresh student (no progress)
  const emptyProgress: GraphStudentProgress[] = [];

  // Video 1 should be ALLOWED (root item)
  const v1Check = evaluateContentAccess({
    targetContentId: "item-video-1",
    items,
    prerequisites,
    progress: emptyProgress,
  });
  assert.equal(v1Check.allowed, true, "First item in sequence must be accessible without prerequisites");
  console.log("✓ Step 1 Passed: Root video is accessible for fresh student");

  // HW 1 should be LOCKED (requires video 1)
  const hw1Check = evaluateContentAccess({
    targetContentId: "item-hw-1",
    items,
    prerequisites,
    progress: emptyProgress,
  });
  assert.equal(hw1Check.allowed, false, "Homework must be locked before video is watched");
  if (!hw1Check.allowed) {
    assert.equal(hw1Check.code, "PREREQUISITE_LOCKED");
    assert.equal(hw1Check.requiredItem.id, "item-video-1");
  }
  console.log("✓ Step 2 Passed: HW is locked with prerequisite item-video-1");

  // Case 2: Student completes Video 1
  const progressAfterVideo: GraphStudentProgress[] = [
    { contentId: "item-video-1", status: ContentProgressStatus.COMPLETED },
  ];

  const hw1Check2 = evaluateContentAccess({
    targetContentId: "item-hw-1",
    items,
    prerequisites,
    progress: progressAfterVideo,
  });
  assert.equal(hw1Check2.allowed, true, "Homework must unlock after video is completed");
  console.log("✓ Step 3 Passed: HW unlocks once video 1 is completed");

  // Sol Video should still be locked
  const solCheck = evaluateContentAccess({
    targetContentId: "item-sol-1",
    items,
    prerequisites,
    progress: progressAfterVideo,
  });
  assert.equal(solCheck.allowed, false, "Solution video must remain locked before HW is submitted");
  console.log("✓ Step 4 Passed: Solution video remains locked until HW is completed");

  // Case 3: Student completes HW 1
  const progressAfterHw: GraphStudentProgress[] = [
    ...progressAfterVideo,
    { contentId: "item-hw-1", status: ContentProgressStatus.COMPLETED },
  ];

  const solCheck2 = evaluateContentAccess({
    targetContentId: "item-sol-1",
    items,
    prerequisites,
    progress: progressAfterHw,
  });
  assert.equal(solCheck2.allowed, true, "Solution video unlocks once HW is completed");
  console.log("✓ Step 5 Passed: Solution video unlocks once HW is completed");

  // Case 4: Student completes Solution Video -> Exam unlocks
  const progressAfterSol: GraphStudentProgress[] = [
    ...progressAfterHw,
    { contentId: "item-sol-1", status: ContentProgressStatus.COMPLETED },
  ];

  const examCheck = evaluateContentAccess({
    targetContentId: "item-exam-1",
    items,
    prerequisites,
    progress: progressAfterSol,
  });
  assert.equal(examCheck.allowed, true, "Exam unlocks once solution video is completed");
  console.log("✓ Step 6 Passed: Exam unlocks once solution video is completed");

  console.log("\n All Prerequisites & Content Flow tests passed successfully!");
}

runPrerequisitesTest().catch((err) => {
  console.error("Prerequisites test failed:", err);
  process.exit(1);
});
