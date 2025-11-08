import User from '../models/User.js'
import catchAsync from '../utils/catchAsync.js'
import AppError from '../utils/appError.js'
import jwt from 'jsonwebtoken'
import sendEmail from '../utils/Email.js'
import { promisify } from 'util'
import crypto from 'crypto'

const signToken = (id) =>
  jwt.sign({ id }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRES_IN,
  })

// ✅ Updated createSendToken
const createSendToken = (user, statusCode, res) => {
  const token = signToken(user._id)

  const cookieOptions = {
    expires: new Date(
      Date.now() + process.env.JWT_COOKIE_EXPIRES_IN * 24 * 60 * 60 * 1000
    ),
    httpOnly: true,
    // For local development (HTTP) we use 'lax' and secure=false. In production use 'none' and secure=true
    sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax',
    secure: process.env.NODE_ENV === 'production',
  }

  res.cookie('jwt', token, cookieOptions)

  user.password = undefined

  res.status(statusCode).json({
    status: 'success',
    token,
    data: { user },
  })
}

// ✅ Updated login
export const login = catchAsync(async (req, res, next) => {
  const { email, password } = req.body

  if (!email || !password) {
    return res.status(400).json({
      status: 'fail',
      message: 'Please provide email and password!',
    })
  }

  const user = await User.findOne({ email }).select('+password')

  if (!user || !(await user.correctPassword(password, user.password))) {
    return next(new AppError('Incorrect email or password', 401))
  }

  if (!user.isVerified) {
    return next(new AppError('Please verify your email first.', 401))
  }

  createSendToken(user, 200, res)
})

// ✅ Updated protect
export const protect = catchAsync(async (req, res, next) => {
  let token = null

  if (req.cookies?.jwt) {
    token = req.cookies.jwt
  }

  if (!token && req.headers.authorization?.startsWith('Bearer')) {
    token = req.headers.authorization.split(' ')[1]
  }

  if (!token) {
    return next(new AppError('You are not logged in!', 401))
  }

  try {
    const decoded = await promisify(jwt.verify)(token, process.env.JWT_SECRET)

    const currentUser = await User.findById(decoded.id)
    if (!currentUser) {
      return next(
        new AppError('The user belonging to this token no longer exists.', 401)
      )
    }

    // BLOCK inactive users
    if (currentUser.active === false) {
      return next(
        new AppError(
          'This user is no longer active. Please contact support.',
          401
        )
      )
    }

    if (currentUser.changedPasswordAfter(decoded.iat)) {
      return next(
        new AppError(
          'User recently changed password! Please log in again.',
          401
        )
      )
    }

    req.user = currentUser
    next()
  } catch (err) {
    return next(new AppError('Invalid or expired token', 401))
  }
})

export const restrict = (...roles) => {
  return (req, res, next) => {
    if (!roles.includes(req.user.role)) {
      return next(
        new AppError('You do not have permission to perform this action', 403)
      )
    }
    next()
  }
}

export const signup = catchAsync(async (req, res, next) => {
  const newUser = await User.create({
    FirstName: req.body.FirstName,
    LastName: req.body.LastName,
    email: req.body.email,
    password: req.body.password,
    passwordConfirm: req.body.passwordConfirm,
    role: req.body.role,
  })

  const token = jwt.sign({ id: newUser._id }, process.env.JWT_SECRET, {
    expiresIn: '1d',
  })

  const backendUrl =
    process.env.NODE_ENV === 'production'
      ? process.env.PROD_BACKEND_URL
      : process.env.BACKEND_URL

  const verifyUrl = `${backendUrl}/api/v1/users/verify/${token}`

  const message = `Please verify your email: ${verifyUrl}`

  const htmlMessage = `
  <div style="font-family: Arial, sans-serif; text-align: center; padding: 20px;">
    <h2>Welcome, ${newUser.name}! 🎉</h2>
    <p>Thanks for signing up. Please verify your email by clicking the button below:</p>
    <a href="${verifyUrl}" style="background: #4CAF50; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px;">
      Verify Email
    </a>
    <p>If the button doesn't work, copy and paste this link in your browser:</p>
    <p><a href="${verifyUrl}">${verifyUrl}</a></p>
  </div>
`

  try {
    await sendEmail({
      email: newUser.email,
      subject: 'Verify your email',
      message,
      html: htmlMessage,
    })

    return res.status(201).json({
      status: 'success',
      message: 'User created! Please check your email to verify your account.',
    })
  } catch (err) {
    await User.findByIdAndDelete(newUser._id)
    return next(
      new AppError(
        'There was an error sending the email. Try again later.',
        500
      )
    )
  }
})

export const verifyEmail = catchAsync(async (req, res, next) => {
  try {
    const decoded = jwt.verify(req.params.token, process.env.JWT_SECRET)
    const user = await User.findById(decoded.id)

    if (!user) {
      return next(new AppError('Invalid verification link', 400))
    }

    user.isVerified = true
    await user.save({ validateBeforeSave: false })

    res.status(200).json({
      status: 'success',
      message: 'Email verified successfully! You can now log in.',
    })
  } catch (err) {
    return next(new AppError('Verification link expired or invalid', 400))
  }
})

export const logOut = (req, res) => {
  res.cookie('jwt', '', {
    expires: new Date(Date.now() + 1),
    httpOnly: true,
    sameSite: 'none',
    secure: true,
  })

  res.status(200).json({
    status: 'success',
    message: 'Logged out successfully.',
  })
}

// 🔥 Here are the missing exports you need:

export const forgotPassword = catchAsync(async (req, res, next) => {
  // 1) Get user based on posted email
  const user = await User.findOne({ email: req.body.email })
  if (!user) {
    return next(new AppError('There is no user with that email address.', 404))
  }

  // 2) Generate the random reset token
  const resetToken = user.createPasswordResetToken()
  await user.save({ validateBeforeSave: false })

  // 3) Send it to user's email
  const resetURL = `${process.env.BACKEND_URL}/api/v1/users/resetPassword/${resetToken}`

  const message = `Forgot your password? Submit a PATCH request with your new password and passwordConfirm to: ${resetURL}.\nIf you didn't forget your password, please ignore this email!`

  try {
    await sendEmail({
      email: user.email,
      subject: 'Your password reset token (valid for 10 min)',
      message,
    })

    res.status(200).json({
      status: 'success',
      message: 'Token sent to email!',
    })
  } catch (err) {
    user.passwordResetToken = undefined
    user.passwordResetExpires = undefined
    await user.save({ validateBeforeSave: false })

    return next(
      new AppError(
        'There was an error sending the email. Try again later!',
        500
      )
    )
  }
})

export const resetPassword = catchAsync(async (req, res, next) => {
  // 1) Get user based on the token
  const hashedToken = crypto
    .createHash('sha256')
    .update(req.params.token)
    .digest('hex')

  const user = await User.findOne({
    passwordResetToken: hashedToken,
    passwordResetExpires: { $gt: Date.now() },
  })

  // 2) If token has not expired, and there is user, set the new password
  if (!user) {
    return next(new AppError('Token is invalid or has expired', 400))
  }

  user.password = req.body.password
  user.passwordConfirm = req.body.passwordConfirm
  user.passwordResetToken = undefined
  user.passwordResetExpires = undefined
  await user.save()

  // 3) Update changedPasswordAt property for the user

  // 4) Log the user in, send JWT
  createSendToken(user, 200, res)
})

export const updatePassword = catchAsync(async (req, res, next) => {
  // 1) Get user from collection
  const user = await User.findById(req.user._id).select('+password')

  // 2) Check if POSTed current password is correct
  if (!(await user.correctPassword(req.body.passwordCurrent, user.password))) {
    return next(new AppError('Your current password is wrong.', 401))
  }

  // 3) If so, update password
  user.password = req.body.password
  user.passwordConfirm = req.body.passwordConfirm
  await user.save()

  // 4) Log user in, send JWT
  createSendToken(user, 200, res)
})
