# Bootble Backend

A comprehensive fitness application backend for shift workers, built with Node.js, Express, and MongoDB.

## Features

- **User Authentication**: Email/password signup with OTP verification
- **Onboarding System**: Shift selection and goal setting
- **Dashboard**: Personalized home screen with scores and progress
- **Nutrition Tracking**: Meal logging with USDA food database
- **Workout Management**: Browse, create, and log workouts
- **Sleep & Recovery**: Track sleep and recovery activities
- **Calendar**: Shift-aware scheduling and rescheduling
- **Subscription**: Tiered pricing with Stripe integration
- **Admin Dashboard**: Comprehensive admin interface
- **Background Jobs**: Automated reminders and calculations

## Prerequisites

- Node.js 22 LTS 
- MongoDB 4.00+
- Stripe account (for subscriptions)
- USDA API key (for food search)


Step 5: Run the Application
Install dependencies:

bash
npm install
Set up environment variables: Create a .env file with the required variables.

Run setup script:

bash
npm run setup
Start the development server:

bash
npm run dev
Test the API: Use Postman or curl to test endpoints:

Register: POST http://localhost:5000/api/auth/register

Login: POST http://localhost:5000/api/auth/login

Get dashboard: GET http://localhost:5000/api/dashboard/home (with Authorization header)