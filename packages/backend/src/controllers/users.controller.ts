import { Request, Response, NextFunction } from 'express'
import { usersService } from '../services/users.service'
import { pushService } from '../services/push.service'

export const usersController = {
  async getAll(_req: Request, res: Response, next: NextFunction) {
    try {
      res.json(await usersService.getAll())
    } catch (err) {
      next(err)
    }
  },

  async getById(req: Request, res: Response, next: NextFunction) {
    try {
      res.json(await usersService.getById(parseInt(req.params.id)))
    } catch (err) {
      next(err)
    }
  },

  async create(req: Request, res: Response, next: NextFunction) {
    try {
      res.status(201).json(await usersService.create(req.body))
    } catch (err) {
      next(err)
    }
  },

  async update(req: Request, res: Response, next: NextFunction) {
    try {
      res.json(await usersService.update(parseInt(req.params.id), req.body))
    } catch (err) {
      next(err)
    }
  },

  async changePassword(req: Request, res: Response, next: NextFunction) {
    try {
      const { currentPassword, newPassword } = req.body
      res.json(await usersService.changePassword(req.user.id, currentPassword, newPassword))
    } catch (err) {
      next(err)
    }
  },

  /** Mobile app registers its Expo push token for the logged-in user. */
  async registerPushToken(req: Request, res: Response, next: NextFunction) {
    try {
      const { token } = req.body as { token: string }
      if (!token) {
        res.status(400).json({ message: 'token required' })
        return
      }
      res.json(await pushService.registerToken(req.user.id, token))
    } catch (err) {
      next(err)
    }
  },

  async clearPushToken(req: Request, res: Response, next: NextFunction) {
    try {
      res.json(await pushService.clearToken(req.user.id))
    } catch (err) {
      next(err)
    }
  },

  async remove(req: Request, res: Response, next: NextFunction) {
    try {
      await usersService.remove(parseInt(req.params.id))
      res.status(204).send()
    } catch (err) {
      next(err)
    }
  },
}
