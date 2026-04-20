import { Request, Response, NextFunction } from 'express'
import { authService } from '../services/auth.service'
import { env } from '../config/env'

const COOKIE_OPTIONS = {
  httpOnly: true,
  secure: env.NODE_ENV === 'production',
  sameSite: 'lax' as const,
  maxAge: 7 * 24 * 60 * 60 * 1000,
}

export const authController = {
  async login(req: Request, res: Response, next: NextFunction) {
    try {
      const { email, password } = req.body
      const result = await authService.login(email, password)
      // Web uses the httpOnly cookie; mobile reads refreshToken from the body.
      res.cookie('refreshToken', result.refreshToken, COOKIE_OPTIONS)
      res.json({
        accessToken: result.accessToken,
        refreshToken: result.refreshToken,
        user: result.user,
      })
    } catch (err) {
      next(err)
    }
  },

  async refresh(req: Request, res: Response, next: NextFunction) {
    try {
      // Accept refresh token from body (mobile) or cookie (web).
      const refreshToken = req.body?.refreshToken ?? req.cookies?.refreshToken
      if (!refreshToken) {
        res.status(401).json({ message: 'No refresh token' })
        return
      }
      const result = await authService.refreshAccessToken(refreshToken)
      // Rotate: set the NEW refresh token cookie (web) and also return it in body (mobile)
      res.cookie('refreshToken', result.refreshToken, COOKIE_OPTIONS)
      res.json({
        accessToken: result.accessToken,
        refreshToken: result.refreshToken,
      })
    } catch (err) {
      // On refresh failure clear the cookie so client returns to login cleanly
      res.clearCookie('refreshToken')
      next(err)
    }
  },

  async logout(req: Request, res: Response, next: NextFunction) {
    try {
      const refreshToken = req.body?.refreshToken ?? req.cookies?.refreshToken
      await authService.revokeRefreshToken(refreshToken)
      res.clearCookie('refreshToken')
      res.json({ message: 'Logged out' })
    } catch (err) {
      next(err)
    }
  },
}
