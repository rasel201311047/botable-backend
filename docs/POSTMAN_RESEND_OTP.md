# Resend OTP API Documentation

## Overview
This document provides integration details for the Resend OTP endpoints in the Bootble API. The resend OTP functionality allows users to request new OTPs if they haven't received the initial ones for email verification or password reset.

## Endpoints

### 1. Resend Email Verification OTP
- **Method**: POST
- **URL**: `/api/auth/resend-otp`
- **Access**: Public
- **Description**: Resends the email verification OTP to an unverified user

### 2. Resend Forgot Password OTP
- **Method**: POST
- **URL**: `/api/auth/resend-forgot-password-otp`
- **Access**: Public
- **Description**: Resends the password reset OTP to an existing user

## Request

### Headers
```
Content-Type: application/json
```

### Body Parameters
| Parameter | Type   | Required | Description |
|-----------|--------|----------|-------------|
| email     | string | Yes      | User's email address |

### Example Request
```json
{
  "email": "user@example.com"
}
```

## Response

### Success Response (200 OK)
```json
{
  "status": "success",
  "message": "Verification OTP resent successfully" // or "Password reset OTP resent successfully"
}
```

### Error Responses

#### 400 Bad Request - Missing Email
```json
{
  "status": "error",
  "message": "Please provide email"
}
```

#### 404 Not Found - User Not Found
```json
{
  "status": "error",
  "message": "User not found"
}
```

#### 400 Bad Request - Email Already Verified (for resend-otp only)
```json
{
  "status": "error",
  "message": "Email is already verified"
}
```

#### 500 Internal Server Error
```json
{
  "status": "error",
  "message": "Internal server error message"
}
```

## Postman Collection Examples

### Resend Email Verification OTP
**Request Setup**
- **Method**: POST
- **URL**: `{{base_url}}/api/auth/resend-otp`
- **Headers**:
  - Key: `Content-Type`
  - Value: `application/json`

**Body (raw JSON)**
```json
{
  "email": "john.doe@example.com"
}
```

**Test Script**
```javascript
pm.test("Status code is 200", function () {
    pm.response.to.have.status(200);
});

pm.test("Response has success status", function () {
    var jsonData = pm.response.json();
    pm.expect(jsonData.status).to.eql("success");
});

pm.test("Response has correct message", function () {
    var jsonData = pm.response.json();
    pm.expect(jsonData.message).to.eql("Verification OTP resent successfully");
});
```

### Resend Forgot Password OTP
**Request Setup**
- **Method**: POST
- **URL**: `{{base_url}}/api/auth/resend-forgot-password-otp`
- **Headers**:
  - Key: `Content-Type`
  - Value: `application/json`

**Body (raw JSON)**
```json
{
  "email": "john.doe@example.com"
}
```

**Test Script**
```javascript
pm.test("Status code is 200", function () {
    pm.response.to.have.status(200);
});

pm.test("Response has success status", function () {
    var jsonData = pm.response.json();
    pm.expect(jsonData.status).to.eql("success");
});

pm.test("Response has correct message", function () {
    var jsonData = pm.response.json();
    pm.expect(jsonData.message).to.eql("Password reset OTP resent successfully");
});
```

## Workflow Integration

### Email Verification Flow
1. User registers and receives initial verification OTP
2. If OTP is not received, user calls `/api/auth/resend-otp`
3. System validates user exists and is not verified
4. New OTP is generated and sent via email
5. User can then verify email using the new OTP

### Password Reset Flow
1. User requests password reset and receives initial reset OTP
2. If OTP is not received, user calls `/api/auth/resend-forgot-password-otp`
3. System validates user exists
4. New OTP is generated and sent via email
5. User can then reset password using the new OTP

## Notes
- The resend-otp endpoint only works for unverified users
- The resend-forgot-password-otp endpoint works for any existing user
- OTPs are sent to the email address provided
- Rate limiting may apply to prevent abuse
- OTPs expire after a configured time (typically 10 minutes)