import catchAsync from '../utils/catchAsync.js'
import AppError from '../utils/appError.js'
import jwt from 'jsonwebtoken'
import sendEmail, { isEmailConfigured } from '../utils/Email.js'
import { promisify } from 'util'
import { getUserRepository } from '../repositories/users/index.js'
import {
  comparePassword,
  createPasswordResetTokenPair,
  hashResetToken,
} from '../services/passwordService.js'
import { isPrismaIdentity } from '../utils/databaseMode.js'

const signToken = (id) =>
  jwt.sign({ id }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRES_IN,
  })

const createSendToken = (user, statusCode, res) => {
  const token = signToken(user._id)

  const cookieOptions = {
    expires: new Date(
      Date.now() + process.env.JWT_COOKIE_EXPIRES_IN * 24 * 60 * 60 * 1000
    ),
    httpOnly: true,
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

export const login = catchAsync(async (req, res, next) => {
  const { email, password } = req.body
  const users = getUserRepository()

  if (!email || !password) {
    return res.status(400).json({
      status: 'fail',
      message: 'Please provide email and password!',
    })
  }

  const user = await users.findByEmailForLogin(email)

  const passwordOk = user
    ? await (user.correctPassword
        ? user.correctPassword(password, user.password)
        : comparePassword(password, user.password))
    : false

  if (!user || !passwordOk) {
    return next(new AppError('Incorrect email or password', 401))
  }

  if (!user.isVerified) {
    return next(new AppError('Please verify your email first.', 401))
  }

  createSendToken(user, 200, res)
})

export const protect = catchAsync(async (req, res, next) => {
  let token = null
  const users = getUserRepository()

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

    const currentUser = await users.findById(decoded.id)
    if (!currentUser) {
      return next(
        new AppError('The user belonging to this token no longer exists.', 401)
      )
    }

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
    const role = req.user.role
    const aliases = {
      user: ['user', 'customer'],
      customer: ['user', 'customer'],
      guide: ['guide', 'tour_operator'],
      tour_operator: ['guide', 'tour_operator'],
    }

    const allowed = roles.some((required) => {
      if (required === role) return true
      const group = aliases[required] || [required]
      return group.includes(role)
    })

    if (!allowed) {
      return next(
        new AppError('You do not have permission to perform this action', 403)
      )
    }
    next()
  }
}

export const signup = catchAsync(async (req, res, next) => {
  const users = getUserRepository()

  const newUser = await users.createUser({
    FirstName: req.body.FirstName,
    LastName: req.body.LastName,
    email: req.body.email,
    password: req.body.password,
    passwordConfirm: req.body.passwordConfirm,
    role: 'user',
  })

  const token = jwt.sign({ id: newUser._id }, process.env.JWT_SECRET, {
    expiresIn: '1d',
  })

  const backendUrl = (
    process.env.PUBLIC_BACKEND_URL ||
    (process.env.NODE_ENV === 'production'
      ? process.env.PROD_BACKEND_URL || process.env.BACKEND_URL
      : process.env.BACKEND_URL) ||
    ''
  ).replace(/\/$/, '')

  // Production without an email provider: verification email cannot be sent,
  // so accounts are activated immediately (documented limitation). Once
  // EMAIL_USER/EMAIL_PASS are configured, verification is enforced.
  if (process.env.NODE_ENV === 'production' && !isEmailConfigured()) {
    if (isPrismaIdentity() && users.setVerified) {
      await users.setVerified(newUser._id, true)
    } else {
      newUser.isVerified = true
      await users.saveUser(newUser, { validateBeforeSave: false })
    }
    console.warn('[signup] email not configured — account auto-verified')
    return res.status(201).json({
      status: 'success',
      message: 'Account created! You can now log in.',
    })
  }

  const verifyUrl = `${backendUrl}/api/v1/users/verify/${token}`

  const message = `Please verify your email: ${verifyUrl}`

  const htmlMessage = `
  <div style="font-family: Arial, sans-serif; text-align: center; padding: 20px;">
    <h2>Welcome, ${newUser.FirstName}! 🎉</h2>
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
    if (process.env.NODE_ENV !== 'production') {
      newUser.isVerified = true
      if (isPrismaIdentity() && users.setVerified) {
        await users.setVerified(newUser._id, true)
      } else {
        await users.saveUser(newUser, { validateBeforeSave: false })
      }
      console.warn(
        'Signup email failed in development; auto-verified user:',
        newUser.email
      )
      console.warn('Verify URL (if needed):', verifyUrl)
      return res.status(201).json({
        status: 'success',
        message:
          'User created (development: email delivery failed, account auto-verified).',
        verifyUrl,
      })
    }

    await users.deleteById(newUser._id)
    return next(
      new AppError(
        'There was an error sending the email. Try again later.',
        500
      )
    )
  }
})

export const verifyEmail = catchAsync(async (req, res, next) => {
  const users = getUserRepository()
  try {
    const decoded = jwt.verify(req.params.token, process.env.JWT_SECRET)
    const user = await users.findById(decoded.id)

    if (!user) {
      return next(new AppError('Invalid verification link', 400))
    }

    user.isVerified = true
    if (isPrismaIdentity() && users.setVerified) {
      await users.setVerified(user._id, true)
    } else {
      await users.saveUser(user, { validateBeforeSave: false })
    }

    if (process.env.FRONTEND_URL && req.accepts(['html', 'json']) === 'html') {
      return res.redirect(302, `${process.env.FRONTEND_URL.replace(/\/$/, '')}/login?verified=1`)
    }
    res.status(200).json({
      status: 'success',
      message: 'Email verified successfully! You can now log in.',
    })
  } catch (err) {
    if (process.env.FRONTEND_URL && req.accepts(['html', 'json']) === 'html') {
      return res.redirect(302, `${process.env.FRONTEND_URL.replace(/\/$/, '')}/login?verified=0`)
    }
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

export const forgotPassword = catchAsync(async (req, res, next) => {
  const users = getUserRepository()
  const user = await users.findByEmailForLogin(req.body.email)

  if (!user) {
    return next(new AppError('There is no user with that email address.', 404))
  }

  let resetToken
  if (isPrismaIdentity()) {
    const pair = createPasswordResetTokenPair()
    resetToken = pair.resetToken
    await users.setPasswordResetToken(
      user._id,
      pair.passwordResetToken,
      pair.passwordResetExpires
    )
  } else {
    resetToken = user.createPasswordResetToken()
    await users.saveUser(user, { validateBeforeSave: false })
  }

  // Never include password hash in subsequent handling / logs
  user.password = undefined

  const frontendBase = process.env.FRONTEND_URL || 'http://localhost:5200'
  const resetURL = `${frontendBase}/reset-password/${resetToken}`

  const message = `Forgot your password? Reset it here: ${resetURL}\nIf you didn't forget your password, please ignore this email!`

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
    if (process.env.NODE_ENV !== 'production') {
      console.warn(
        'Forgot-password email failed in development. Reset token:',
        resetToken
      )
      return res.status(200).json({
        status: 'success',
        message: 'Token generated (development: email delivery failed).',
        resetToken,
      })
    }

    if (isPrismaIdentity()) {
      await users.clearPasswordResetToken(user._id)
    } else {
      user.passwordResetToken = undefined
      user.passwordResetExpires = undefined
      await users.saveUser(user, { validateBeforeSave: false })
    }

    return next(
      new AppError(
        'There was an error sending the email. Try again later!',
        500
      )
    )
  }
})

export const resetPassword = catchAsync(async (req, res, next) => {
  const users = getUserRepository()
  const hashedToken = hashResetToken(req.params.token)

  const user = await users.findByResetToken(hashedToken)

  if (!user) {
    return next(new AppError('Token is invalid or has expired', 400))
  }

  if (isPrismaIdentity()) {
    const updated = await users.updatePassword(
      user._id,
      req.body.password,
      req.body.passwordConfirm
    )
    createSendToken(updated, 200, res)
    return
  }

  user.password = req.body.password
  user.passwordConfirm = req.body.passwordConfirm
  user.passwordResetToken = undefined
  user.passwordResetExpires = undefined
  await users.saveUser(user)

  createSendToken(user, 200, res)
})

export const updatePassword = catchAsync(async (req, res, next) => {
  const users = getUserRepository()
  const user = await users.findByIdWithPassword(req.user._id)

  const ok = await (user.correctPassword
    ? user.correctPassword(req.body.passwordCurrent, user.password)
    : comparePassword(req.body.passwordCurrent, user.password))

  if (!ok) {
    return next(new AppError('Your current password is wrong.', 401))
  }

  if (isPrismaIdentity()) {
    const updated = await users.updatePassword(
      user._id,
      req.body.password,
      req.body.passwordConfirm
    )
    createSendToken(updated, 200, res)
    return
  }

  user.password = req.body.password
  user.passwordConfirm = req.body.passwordConfirm
  await users.saveUser(user)

  createSendToken(user, 200, res)
})
