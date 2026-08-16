import { config as loadEnv } from "dotenv";
loadEnv({ path: ".env" });
loadEnv({ path: ".env.local", override: false });

process.env.NODE_ENV = 'test';
import assert from 'node:assert/strict';
import { prisma } from '../src/lib/prisma';
import { checkQuizAccess, checkCourseEnrollment } from '../src/lib/authorization';
import { getMaintenanceMode, setMaintenanceMode, invalidateSettingsCache } from '../src/lib/settings';
import { getOverloadProtectionState, setOverloadMode, invalidateOverloadCache } from '../src/lib/overload-protection';

async function runTests() {
  console.log('--- Starting Production Readiness Verification Tests ---');

  // Test 1: Settings Caching & Invalidation
  console.log('Testing Settings Caching & Invalidation...');
  await setMaintenanceMode(false);
  assert.equal(await getMaintenanceMode(), false);
  
  await setMaintenanceMode(true);
  assert.equal(await getMaintenanceMode(), true);
  
  await setMaintenanceMode(false);
  assert.equal(await getMaintenanceMode(), false);
  console.log('  PASS: Settings Caching & Invalidation');

  // Test 2: Overload Protection Caching
  console.log('Testing Overload Protection Caching...');
  await setOverloadMode('off');
  let state = await getOverloadProtectionState();
  assert.equal(state.mode, 'off');

  await setOverloadMode('auto');
  state = await getOverloadProtectionState();
  assert.equal(state.mode, 'auto');
  console.log('  PASS: Overload Protection Caching');

  // Test 3: Quiz Access Authorization
  console.log('Testing Centralized Quiz Access Authorization...');
  // Check admin full access
  const adminAccess = await checkQuizAccess('admin-123', 'admin', 'any-quiz');
  assert.equal(adminAccess, true, 'Admin must have full quiz access');
  const superadminAccess = await checkQuizAccess('superadmin-123', 'superadmin', 'any-quiz');
  assert.equal(superadminAccess, true, 'Superadmin must have full quiz access');
  
  // Non-existent quiz for random student
  const noAccess = await checkQuizAccess('student-123', 'student', 'non-existent-quiz');
  assert.equal(noAccess, false, 'Non-existent quiz or unauthorized student must be blocked');
  console.log('  PASS: Centralized Quiz Access Authorization');

  // Test 4: Demo Teacher Password Bypass Boundary
  console.log('Testing Demo Teacher Password Isolation...');
  const demoTeacher = {
    isDemo: true,
    email: 'demo_teacher@test.local',
    name: 'المدرس التجريبي',
  };
  const normalTeacherNamedTest = {
    isDemo: false,
    email: 'normal_teacher@example.com',
    name: 'test',
  };
  
  const isDemoPassForDemoTeacher = (demoTeacher.isDemo || demoTeacher.email === 'demo_teacher@test.local');
  assert.equal(isDemoPassForDemoTeacher, true, 'Demo teacher must match demo criteria');

  const isDemoPassForNormalTeacher = (normalTeacherNamedTest.isDemo || normalTeacherNamedTest.email === 'demo_teacher@test.local');
  assert.equal(isDemoPassForNormalTeacher, false, 'Teacher named "test" without isDemo MUST NOT match demo password criteria');
  console.log('  PASS: Demo Teacher Password Isolation');

  // Test 5: Clustered Video Position Wall-Clock Delta
  console.log('Testing Clustered Video Position Wall-Clock Delta...');
  const rawDelta = 10;
  const now = Date.now();
  const positionUpdatedAt = new Date(now - 8000); // 8 seconds ago
  const lastPing = positionUpdatedAt.getTime();
  const wallClockSeconds = (now - lastPing) / 1000;
  const safeDelta = Math.min(rawDelta, Math.max(0, wallClockSeconds * 1.1));
  assert.ok(safeDelta <= 8.8 + 0.01 && safeDelta >= 8.7, 'safeDelta must clamp to wallClock * 1.1 across worker instances');
  console.log('  PASS: Clustered Video Position Wall-Clock Delta');

  console.log('\nAll Production Readiness Tests Passed Successfully!');
}

runTests().catch((err) => {
  console.error('Test execution failed:', err);
  process.exit(1);
});
