/**
 * Themes Router
 * GET /api/v1/themes       — List all available themes (id, name, description)
 * GET /api/v1/themes/:id   — Get full theme data with resolved asset URLs
 */

import { Router, type Request, type Response } from 'express'
import { getTheme, listThemes } from '../services/theme_loader'

const router = Router()

router.get('/', (_req: Request, res: Response) => {
  res.json({ themes: listThemes() })
})

router.get('/:id', (req: Request, res: Response) => {
  const theme = getTheme(req.params.id as string)
  if (!theme) {
    res.status(404).json({ error: `Theme '${req.params.id}' not found` })
    return
  }
  res.json(theme)
})

export default router
