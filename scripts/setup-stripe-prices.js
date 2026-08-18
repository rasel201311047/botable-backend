#!/usr/bin/env node
/**
 * Script to help set up Stripe price IDs for subscription plans
 * 
 * This script will:
 * 1. Show you your current subscription plans
 * 2. Guide you to get your Stripe price IDs
 * 3. Help you update the plans with your actual price IDs
 */

require('dotenv').config();
require('../config/db');

const SubscriptionPlan = require('../modules/subscription/subscriptionPlan.model');
const readline = require('readline');

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

function question(prompt) {
  return new Promise((resolve) => {
    rl.question(prompt, resolve);
  });
}

async function main() {
  console.log('\n===========================================');
  console.log('🔧 Stripe Price ID Setup Helper');
  console.log('===========================================\n');

  try {
    // Fetch current plans
    const plans = await SubscriptionPlan.find();
    
    if (plans.length === 0) {
      console.log('❌ No subscription plans found in database!');
      console.log('Please start the server first to initialize default plans.\n');
      process.exit(1);
    }

    console.log('📋 Current Subscription Plans:\n');
    plans.forEach((plan, index) => {
      console.log(`${index + 1}. ${plan.displayName} (${plan.name})`);
      console.log(`   Price: $${plan.price} ${plan.currency}`);
      console.log(`   Interval: ${plan.interval || 'N/A'}`);
      console.log(`   Stripe Price ID: ${plan.stripePriceId || '❌ NOT SET'}`);
      console.log(`   MongoDB ID: ${plan._id}`);
      console.log('');
    });

    console.log('\n⚠️  IMPORTANT INSTRUCTIONS:\n');
    console.log('1. Open your Stripe Dashboard: https://dashboard.stripe.com/products');
    console.log('2. Create or select your product');
    console.log('3. Look at the pricing section');
    console.log('4. Copy the price IDs (they start with "price_")');
    console.log('5. Come back here and enter them\n');
    console.log('⚠️  DO NOT use example IDs like "price_1ABCDE" - they are FAKE!\n');

    const proceed = await question('Have you opened your Stripe Dashboard and found your price IDs? (yes/no): ');
    
    if (proceed.toLowerCase() !== 'yes' && proceed.toLowerCase() !== 'y') {
      console.log('\n👉 Please go to https://dashboard.stripe.com/products first!');
      console.log('Get your actual price IDs and run this script again.\n');
      process.exit(0);
    }

    console.log('\n');

    // Update each plan
    for (const plan of plans) {
      if (plan.name === 'free') {
        console.log(`⏭️  Skipping Free plan (no Stripe price needed)\n`);
        continue;
      }

      console.log(`\n📝 Setting up: ${plan.displayName} Plan`);
      console.log(`   Current Price ID: ${plan.stripePriceId || 'NOT SET'}`);
      console.log(`   Expected: $${plan.price}/${plan.interval}\n`);

      const newPriceId = await question(`Enter your ACTUAL Stripe price ID for ${plan.displayName} plan: `);

      if (!newPriceId || newPriceId.trim() === '') {
        console.log('❌ Skipping this plan (no input provided)\n');
        continue;
      }

      const trimmedPriceId = newPriceId.trim();

      // Validate format
      if (!trimmedPriceId.startsWith('price_')) {
        console.log(`⚠️  Warning: "${trimmedPriceId}" doesn't start with "price_"`);
        const confirm = await question('Are you sure this is correct? (yes/no): ');
        if (confirm.toLowerCase() !== 'yes' && confirm.toLowerCase() !== 'y') {
          console.log('❌ Skipped\n');
          continue;
        }
      }

      // Check if it's an example/fake ID
      const fakeIds = [
        'price_1ABCDE1234567890',
        'price_0FEDCBA9876543210',
        'price_monthly',
        'price_yearly',
        'price_1ABC',
        'price_0DEF'
      ];

      if (fakeIds.some(fake => trimmedPriceId.includes(fake) || fake.includes(trimmedPriceId))) {
        console.log('\n❌ ERROR: This looks like an example/fake price ID!');
        console.log('You MUST use your actual price ID from YOUR Stripe dashboard.');
        console.log('❌ Skipped\n');
        continue;
      }

      // Update the plan
      plan.stripePriceId = trimmedPriceId;
      await plan.save();

      console.log(`✅ Updated ${plan.displayName} plan with price ID: ${trimmedPriceId}\n`);
    }

    console.log('\n===========================================');
    console.log('✅ Setup Complete!');
    console.log('===========================================\n');

    // Show final status
    const updatedPlans = await SubscriptionPlan.find();
    console.log('📊 Final Configuration:\n');
    
    updatedPlans.forEach(plan => {
      const status = plan.stripePriceId ? '✅' : '❌';
      console.log(`${status} ${plan.displayName}: ${plan.stripePriceId || 'NOT SET'}`);
    });

    console.log('\n💡 Next Steps:');
    console.log('1. Test your configuration: GET /api/subscription/plans');
    console.log('2. Try creating a checkout session');
    console.log('3. If you see "No such price" errors, verify the price ID in Stripe Dashboard\n');

  } catch (error) {
    console.error('\n❌ Error:', error.message);
  } finally {
    rl.close();
    process.exit(0);
  }
}

// Handle cleanup
process.on('SIGINT', () => {
  console.log('\n\n👋 Setup cancelled');
  rl.close();
  process.exit(0);
});

main();
