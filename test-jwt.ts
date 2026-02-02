// =============================================================
// test-jwt.ts - Run with: ts-node test-jwt.ts
// =============================================================

import jwt from 'jsonwebtoken';
import dotenv from 'dotenv';

dotenv.config();

const secret = process.env.JWT_SECRET;

console.log('='.repeat(60));
console.log('JWT TEST');
console.log('='.repeat(60));

console.log('\n1. Checking JWT_SECRET:');
console.log('JWT_SECRET exists:', !!secret);
console.log('JWT_SECRET value:', secret ? `${secret.substring(0, 10)}...` : 'NOT SET');

if (!secret) {
  console.log('\n❌ ERROR: JWT_SECRET is not set in .env file!');
  console.log('Please add: JWT_SECRET=your-secret-key-here');
  process.exit(1);
}

console.log('\n2. Creating a test token:');
const payload = {
  source: 'ADMIN',
  admin_id: 1,
  role: 'ADMIN'
};

const token = jwt.sign(payload, secret, { expiresIn: '8h' });
console.log('Token created:', token.substring(0, 50) + '...');

console.log('\n3. Verifying the token:');
try {
  const verified = jwt.verify(token, secret);
  console.log('✅ Token verified successfully!');
  console.log('Payload:', JSON.stringify(verified, null, 2));
} catch (err) {
  console.log('❌ Token verification failed:', err);
}

console.log('\n4. Now paste your Postman token here to test it:');
console.log('Edit this file and replace PASTE_TOKEN_HERE with your actual token');
console.log('');

// PASTE YOUR POSTMAN TOKEN HERE (between the quotes)
const postmanToken = "PASTE_TOKEN_HERE";

if (postmanToken !== "PASTE_TOKEN_HERE") {
  console.log('\n5. Testing Postman token:');
  try {
    const verified = jwt.verify(postmanToken, secret);
    console.log('✅ Postman token is VALID!');
    console.log('Payload:', JSON.stringify(verified, null, 2));
  } catch (err) {
    console.log('❌ Postman token verification failed!');
    if (err instanceof jwt.TokenExpiredError) {
      console.log('Reason: Token has expired');
    } else if (err instanceof jwt.JsonWebTokenError) {
      console.log('Reason:', err.message);
    } else {
      console.log('Error:', err);
    }
  }
}

console.log('\n' + '='.repeat(60));