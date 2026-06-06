import { test, expect } from '@playwright/test';

// test the FastAPI backend's public /grades endpoints directly. This tests
// the test runner -> FastAPI server -> grade data
// files path without involving Firebase auth at all.
test('backend serves the UCLA grade data', async ({ request }) => {
  // /grades/departments should return every UCLA department code we have
  // grade data for, COM SCI is always present
  const deptResponse = await request.get('http://localhost:8000/grades/departments');
  expect(deptResponse.ok()).toBeTruthy();
  const departments = await deptResponse.json();
  expect(Array.isArray(departments)).toBeTruthy();
  expect(departments).toContain('COM SCI');

  // also test that /grades?dept=COM+SCI&number=35L returns a real course
  // payload with the title and an overall grade distribution.
  const courseResponse = await request.get(
    'http://localhost:8000/grades?dept=COM+SCI&number=35L',
  );
  expect(courseResponse.ok()).toBeTruthy();
  const course = await courseResponse.json();
  expect(course.dept).toBe('COM SCI');
  expect(course.number).toBe('35L');
  expect(course.overall).toBeTruthy();
  expect(typeof course.overall.avg_gpa).toBe('number');
});
