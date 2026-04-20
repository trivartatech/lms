import { Request, Response, NextFunction } from 'express'
import { contactsService } from '../services/contacts.service'

export const contactsController = {
  async getBySchool(req: Request, res: Response, next: NextFunction) {
    try {
      const contacts = await contactsService.getBySchool(parseInt(req.params.schoolId))
      res.json(contacts)
    } catch (err) { next(err) }
  },

  async getByLead(req: Request, res: Response, next: NextFunction) {
    try {
      const contacts = await contactsService.getByLead(parseInt(req.params.leadId))
      res.json(contacts)
    } catch (err) { next(err) }
  },

  async create(req: Request, res: Response, next: NextFunction) {
    try {
      const contact = await contactsService.create(req.body)
      res.status(201).json(contact)
    } catch (err) { next(err) }
  },

  async update(req: Request, res: Response, next: NextFunction) {
    try {
      const contact = await contactsService.update(parseInt(req.params.id), req.body)
      res.json(contact)
    } catch (err) { next(err) }
  },

  async remove(req: Request, res: Response, next: NextFunction) {
    try {
      await contactsService.remove(parseInt(req.params.id))
      res.status(204).send()
    } catch (err) { next(err) }
  },
}
