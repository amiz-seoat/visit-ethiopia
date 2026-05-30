/**
 * @swagger
 * tags:
 *   name: Authentication
 *   description: User authentication & authorization
 */

/**
 * @swagger
 * /users/signup:
 *   post:
 *     summary: Register a new user
 *     tags: [Authentication]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               name:
 *                 type: string
 *                 example: abyalew lobe
 *               email:
 *                 type: string
 *                 example: abyalew@example.com
 *               password:
 *                 type: string
 *                 example: password123
 *               confirmPassword:
 *                 type: string
 *                 example: password123
 *               role:
 *                 type: string
 *                 example: user
 *     responses:
 *       201:
 *         description: User created successfully (returns JWT)
 *       400:
 *         description: Invalid data or user already exists
 */

/**
 * @swagger
 * /users/login:
 *   post:
 *     summary: Login with email & password
 *     tags: [Authentication]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               email:
 *                 type: string
 *                 example: abyalew@example.com
 *               password:
 *                 type: string
 *                 example: password123
 *     responses:
 *       200:
 *         description: Logged in successfully (returns JWT)
 *       401:
 *         description: Invalid email or password
 */

/**
 * @swagger
 * /users/verify/{token}:
 *   get:
 *     summary: Verify user email
 *     tags: [Authentication]
 *     parameters:
 *       - in: path
 *         name: token
 *         required: true
 *         description: Email verification token sent via email
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Email verified successfully
 *       400:
 *         description: Invalid or expired token
 */

/**
 * @swagger
 * /users/logout:
 *   post:
 *     summary: Logout user (invalidate cookie)
 *     tags: [Authentication]
 *     responses:
 *       200:
 *         description: Logged out successfully
 */

/**
 * @swagger
 * /users/forgotPassword:
 *   post:
 *     summary: Send password reset email
 *     tags: [Authentication]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               email:
 *                 type: string
 *                 example: abyalew@example.com
 *     responses:
 *       200:
 *         description: Reset email sent
 *       404:
 *         description: User not found
 */

/**
 * @swagger
 * /users/resetPassword/{token}:
 *   patch:
 *     summary: Reset user password using token
 *     tags: [Authentication]
 *     parameters:
 *       - in: path
 *         name: token
 *         required: true
 *         description: Password reset token
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               password:
 *                 type: string
 *                 example: newPassword123
 *               confirmPassword:
 *                 type: string
 *                 example: newPassword123
 *     responses:
 *       200:
 *         description: Password updated successfully (returns JWT)
 *       400:
 *         description: Invalid or expired token
 */

/**
 * @swagger
 * /users/test:
 *   get:
 *     summary: Test protected route (JWT required)
 *     tags: [Authentication]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Access granted
 *       401:
 *         description: Unauthorized (no or invalid token)
 */

/**
 * @swagger
 * /users/updatePassword:
 *   patch:
 *     summary: Change password for a logged-in user
 *     tags: [Authentication]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - currentPassword
 *               - newPassword
 *               - newPasswordConfirm
 *             properties:
 *               currentPassword:
 *                 type: string
 *                 example: oldPassword123
 *               newPassword:
 *                 type: string
 *                 example: newPassword123
 *               newPasswordConfirm:
 *                 type: string
 *                 example: newPassword123
 *     responses:
 *       200:
 *         description: Password updated successfully
 *       400:
 *         description: Bad Request (validation error)
 *       401:
 *         description: Unauthorized or incorrect current password
 */

/**
 * @swagger
 * /users:
 *   get:
 *     summary: Get all users (admin only)
 *     tags: [Authentication]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           default: 1
 *         description: Page number for pagination
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 10
 *         description: Number of users per page
 *       - in: query
 *         name: sort
 *         schema:
 *           type: string
 *           example: -createdAt
 *         description: Sort field (prefix with - for descending)
 *       - in: query
 *         name: fields
 *         schema:
 *           type: string
 *           example: FirstName,LastName,email,role
 *         description: Fields to include in response
 *       - in: query
 *         name: role
 *         schema:
 *           type: string
 *           enum: [user, admin, guide]
 *         description: Filter by user role
 *       - in: query
 *         name: isVerified
 *         schema:
 *           type: boolean
 *         description: Filter by verification status
 *     responses:
 *       200:
 *         description: List of users retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status:
 *                   type: string
 *                   example: success
 *                 result:
 *                   type: integer
 *                   description: Number of users returned
 *                 data:
 *                   type: object
 *                   properties:
 *                     data:
 *                       type: array
 *                       items:
 *                         $ref: '#/components/schemas/User'
 *       401:
 *         description: Unauthorized (no or invalid token)
 *       403:
 *         description: Forbidden (admin role required)
 */

/**
 * @swagger
 * components:
 *   schemas:
 *     User:
 *       type: object
 *       properties:
 *         _id:
 *           type: string
 *           description: Unique identifier for the user
 *         FirstName:
 *           type: string
 *           description: User's first name
 *           example: John
 *         LastName:
 *           type: string
 *           description: User's last name
 *           example: Doe
 *         email:
 *           type: string
 *           format: email
 *           description: User's email address
 *           example: john.doe@example.com
 *         role:
 *           type: string
 *           enum: [user, admin, guide]
 *           description: User's role in the system
 *           example: user
 *         isVerified:
 *           type: boolean
 *           description: Whether the user's email has been verified
 *           example: true
 *         active:
 *           type: boolean
 *           description: Whether the user account is active
 *           example: true
 *         createdAt:
 *           type: string
 *           format: date-time
 *           description: When the user account was created
 *         passwordChangedAt:
 *           type: string
 *           format: date-time
 *           description: When the password was last changed
 *       required:
 *         - FirstName
 *         - LastName
 *         - email
 *         - role
 *   securitySchemes:
 *     bearerAuth:
 *       type: http
 *       scheme: bearer
 *       bearerFormat: JWT
 *       description: JWT token for authentication
 */
