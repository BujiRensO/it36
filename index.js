import express from 'express';
import mysql from 'mysql2/promise'; // Use mysql2/promise for async/await support
import bcrypt from 'bcryptjs';
import cors from 'cors';
import logger from './logger.js'; // Import the logger
import { globalLimiter, loginLimiter } from './middleware/rateLimit.js'; // Import rate limiters

const app = express();
app.use(cors());
app.use(express.json()); // Use express.json() instead of body-parser
app.use(globalLimiter); // Apply global rate limiter to all routes

// MySQL connection
const db = mysql.createPool({
  host: 'localhost', // MySQL host
  user: 'root',      // MySQL username
  password: '',      // MySQL password (set during installation)
  database: 'user_auth',
});

// Sign-up endpoint
app.post('/signup', async (req, res) => {
  const { email, password } = req.body;

  // Validate input
  if (!email || !password) {
    return res.status(400).json({ message: 'Email and password are required' });
  }

  try {
    // Check if the email already exists
    const [results] = await db.query('SELECT * FROM users WHERE email = ?', [email]);

    if (results.length > 0) {
      // Log suspicious sign-up attempt
      logger.warn(`Suspicious sign-up attempt: Email already exists - Email: ${email}, IP: ${req.ip}, User-Agent: ${req.headers['user-agent']}`);

      return res.status(400).json({ message: 'Email already exists' });
    }

    // Hash the password
    const hashedPassword = await bcrypt.hash(password, 10);

    // Insert user into the database
    const [result] = await db.query(
      'INSERT INTO users (email, password) VALUES (?, ?)',
      [email, hashedPassword]
    );

    // Log successful sign-up
    logger.info(`Successful sign-up - User ID: ${result.insertId}, Email: ${email}, IP: ${req.ip}, User-Agent: ${req.headers['user-agent']}`);

    // Return success
    res.status(201).json({ message: 'User registered successfully' });
  } catch (err) {
    // Log the error
    logger.error(`Error signing up: ${err.message}`);
    res.status(500).json({ message: 'Sign-up failed' });
  }
});

// Login endpoint with rate limiting
app.post('/login', loginLimiter, async (req, res) => {
  const { email, password } = req.body;

  // Validate input
  if (!email || !password) {
    return res.status(400).json({ message: 'Email and password are required' });
  }

  try {
    // Find user by email
    const [results] = await db.query('SELECT * FROM users WHERE email = ?', [email]);

    if (results.length === 0) {
      // Log failed login attempt
      logger.warn(`Failed login attempt: User not found - Email: ${email}, IP: ${req.ip}, User-Agent: ${req.headers['user-agent']}`);

      return res.status(401).json({ message: 'Invalid email or password' });
    }

    // Compare passwords
    const user = results[0];
    const isPasswordValid = await bcrypt.compare(password, user.password);
    if (!isPasswordValid) {
      // Log failed login attempt
      logger.warn(`Failed login attempt: Incorrect password - Email: ${email}, IP: ${req.ip}, User-Agent: ${req.headers['user-agent']}`);

      return res.status(401).json({ message: 'Invalid email or password' });
    }

    // Log successful login
    logger.info(`Successful login - User ID: ${user.id}, Email: ${email}, IP: ${req.ip}, User-Agent: ${req.headers['user-agent']}`);

    // Return success
    res.status(200).json({ message: 'Login successful', user: { id: user.id, email: user.email } });
  } catch (err) {
    // Log the error
    logger.error(`Error logging in: ${err.message}`);
    res.status(500).json({ message: 'Login failed' });
  }
});

app.post('/change-password', async (req, res) => {
  const { email, oldPassword, newPassword } = req.body;

  // Validate input
  if (!email || !oldPassword || !newPassword) {
    return res.status(400).json({ message: 'Email, old password, and new password are required' });
  }

  try {
    // Find the user by email
    const [results] = await db.query('SELECT * FROM users WHERE email = ?', [email]);

    if (results.length === 0) {
      return res.status(404).json({ message: 'User not found' });
    }

    const user = results[0];

    // Verify the old password
    const isPasswordValid = await bcrypt.compare(oldPassword, user.password);
    if (!isPasswordValid) {
      return res.status(401).json({ message: 'Invalid old password' });
    }

    // Hash the new password
    const hashedNewPassword = await bcrypt.hash(newPassword, 10);

    // Update the password in the database
    await db.query('UPDATE users SET password = ? WHERE email = ?', [hashedNewPassword, email]);

    // Log the password change
    logger.info(`Password changed - User ID: ${user.id}, Email: ${email}, IP: ${req.ip}, User-Agent: ${req.headers['user-agent']}`);

    // Return success
    res.status(200).json({ message: 'Password changed successfully' });
  } catch (err) {
    logger.error(`Error changing password: ${err.message}`);
    res.status(500).json({ message: 'Failed to change password' });
  }
});

// Start the server
const PORT = 5000;
app.listen(PORT, () => {
  logger.info(`Server running on http://localhost:${PORT}`);
});