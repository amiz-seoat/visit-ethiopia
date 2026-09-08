import express from 'express'
import {
  signup,
  login,
  verifyEmail,
  protect,
  restrict,
  logOut,
  forgotPassword,
  resetPassword,
  updatePassword,
} from '../controllers/authController.js'
import {
  getMyProfile,
  updateMyProfile,
  deleteMyProfile,
  getUser,
  updateUserRole,
  getAllUsers,
  deleteUser,
} from '../controllers/userController.js'
import {
  getUserOrganizations,
  setActiveOrganization,
} from '../controllers/organizationController.js'

const router = express.Router()

router.post('/signup', signup)
router.post('/login', login)
router.get('/verify/:token', verifyEmail)
router.post('/logout', logOut)

router.post('/forgotPassword', forgotPassword)
router.patch('/resetPassword/:token', resetPassword)

router.patch('/updatePassword', protect, updatePassword)

// ✅ Test route (protected)
router.get('/test', protect, (req, res) => {
  res.status(200).json({
    status: 'success',
    message: 'You are authenticated and can access this route.',
  })
})

router
  .route('/profile')
  .get(protect, getMyProfile)
  .patch(protect, updateMyProfile)
  .delete(protect, deleteMyProfile)

router.get('/me/organizations', protect, getUserOrganizations)
router.post('/me/active-organization', protect, setActiveOrganization)

router.route('/:id').get(protect, restrict('admin'), getUser)
router.route('/:id').patch(protect, restrict('admin'), updateUserRole)
router.route('/:id').delete(protect, restrict('admin'), deleteUser)

// Get all users (admin only)
router.get('/', protect, restrict('admin'), getAllUsers)

export default router
