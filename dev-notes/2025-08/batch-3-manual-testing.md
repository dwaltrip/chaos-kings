# Batch 3: Manual Testing Instructions

## Overview
This document provides step-by-step manual testing instructions for the enhanced backend user generation system implemented in Batch 3.

## Prerequisites
- Backend server running (`npm run dev` in backend directory)
- Browser with developer tools open
- Test database properly set up

## Test Cases

### 1. First-Time User Creation

**Objective:** Verify that new users are automatically created with generated usernames.

**Steps:**
1. Open browser in incognito/private mode
2. Navigate to the application
3. Open Developer Tools → Network tab
4. Check for automatic API calls to `/users/auto-create`
5. Verify response contains:
   - `user` object with `id`, `username`, `user_key`, `created_at`
   - `isNewUser: true`
   - Username matches format `Player_######` (exactly 6 digits)
6. Check Application tab → Cookies for `general_v2:user_key` cookie
7. Verify cookie is HttpOnly and has correct settings

**Expected Results:**
- User automatically created on first visit
- Generated username follows `Player_######` format
- Cookie properly set with user key
- No JavaScript errors in console

### 2. Returning User Recognition

**Objective:** Verify that existing users are recognized by their cookies.

**Steps:**
1. Complete Test Case 1 first
2. Refresh the page
3. Check Network tab for API call to `/users/me`
4. Verify response contains same user data as before
5. Confirm no call to `/users/auto-create`
6. Verify username displayed in UI matches previous session

**Expected Results:**
- Same user data returned
- No new user creation
- Consistent username across sessions

### 3. Username Editing Flow

**Objective:** Test username update functionality through UI.

**Steps:**
1. Complete Test Case 1 or 2 first
2. Navigate to username editing form/component
3. Enter a new valid username (e.g., "TestPlayer123")
4. Submit the form
5. Check Network tab for PUT request to `/users/me/username`
6. Verify response contains updated user data
7. Refresh page and confirm username persists
8. Check that cookie remains the same

**Expected Results:**
- Username updates successfully
- UI reflects new username immediately
- Username persists after page refresh
- User key remains unchanged

### 4. Username Validation Testing

**Objective:** Test client and server-side username validation.

**Test different invalid usernames:**

**Empty Username:**
1. Try to submit empty username
2. Verify error message appears
3. Check that no API call is made

**Invalid Characters:**
1. Try usernames with spaces: "Test User"
2. Try usernames with special chars: "Test@User", "Test.User"
3. Verify error messages appear
4. If API call is made, verify 400 error response

**Too Long Username:**
1. Try username longer than 25 characters
2. Verify validation error appears

**Expected Results:**
- Frontend validation prevents invalid submissions
- Backend returns appropriate error messages if validation bypassed
- Clear error messages displayed to user

### 5. Multiple User Creation (Concurrent)

**Objective:** Test username uniqueness under rapid user creation.

**Steps:**
1. Open 3-5 different incognito browser windows
2. Navigate to application in each window simultaneously
3. Check that different usernames are generated
4. Verify all users get valid `Player_######` format
5. Confirm no duplicate usernames generated

**Expected Results:**
- All users get unique usernames
- No conflicts or errors
- All usernames follow correct format

### 6. Cookie Persistence Testing

**Objective:** Verify cookie behavior across different scenarios.

**Browser Tab Sharing:**
1. Open application in one tab
2. Note the generated username
3. Open application in new tab (same browser)
4. Verify same username appears (shared cookie)

**Private/Incognito Mode:**
1. Open application in normal browser window
2. Note the username
3. Open application in incognito/private window
4. Verify new username is generated (separate cookie storage)

**Expected Results:**
- Cookies shared across tabs in same browser session
- Separate cookies for private/incognito sessions

### 7. Error Handling Testing

**Objective:** Test error scenarios and recovery.

**Database Connection Issues:**
1. Stop the database temporarily
2. Try to create new user in incognito mode
3. Verify appropriate error message (503 Service Temporarily Unavailable)
4. Restart database
5. Refresh page and verify user creation works

**Network Issues:**
1. Use browser dev tools to simulate offline mode
2. Try username update
3. Verify error handling in UI
4. Re-enable network and retry

**Expected Results:**
- Graceful error handling
- Appropriate HTTP status codes
- User-friendly error messages
- Recovery after issues resolved

### 8. Username Generation Edge Cases

**Objective:** Test username generation under edge conditions.

**Steps:**
1. Create multiple users rapidly to test collision handling
2. Check browser console for any collision warning messages
3. Verify all generated usernames are unique
4. Test with different browser sessions

**Expected Results:**
- Collision detection works properly
- Fallback generation if needed
- No duplicate usernames created
- Console warnings only for actual collisions

## Expected API Endpoints

### POST /users/auto-create
- **Success (201):** Returns user object and sets cookie
- **Conflict (409):** Unable to generate unique username
- **Service Error (503):** Database unavailable
- **Server Error (500):** Other failures

### GET /users/me
- **Success (200):** Returns current user data
- **Not Found (404):** No cookie or user not found

### PUT /users/me/username
- **Success (200):** Returns updated user data
- **Bad Request (400):** Invalid username format
- **Unauthorized (401):** No valid session cookie
- **Not Found (404):** User not found

## Debugging Tips

### Common Issues:
1. **No user creation:** Check if cookie middleware is properly configured
2. **Username not persisting:** Verify cookie settings (httpOnly, sameSite, etc.)
3. **Validation errors:** Check common/validation/username.ts implementation
4. **Database errors:** Verify migrations have run and user_key column exists

### Browser Developer Tools:
- **Network Tab:** Monitor API calls and responses
- **Application Tab → Cookies:** Check cookie values and settings
- **Console:** Look for error messages and warnings
- **Application Tab → Local Storage:** Should NOT contain user data (cookies only)

## Test Environment Setup

Before testing, ensure:
1. Backend server is running on correct port
2. Database migrations have been applied
3. Test database is clean/empty for fresh testing
4. CORS settings allow frontend requests
5. Cookie settings are appropriate for test environment

## Success Criteria Checklist

- [ ] New users auto-created with Player_###### format usernames
- [ ] Returning users recognized via cookies
- [ ] Username editing works and persists
- [ ] Username validation prevents invalid inputs
- [ ] Multiple users get unique usernames
- [ ] Cookies work correctly across tabs/sessions
- [ ] Error handling shows appropriate messages
- [ ] All API endpoints return correct HTTP status codes
- [ ] No JavaScript errors in browser console
- [ ] Database properly stores user data with user_key field