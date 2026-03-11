export function requireAdmin(req: any, res: any, next: any) {
  if (!req.isAuthenticated()) return res.sendStatus(401);
  if (!req.user?.isAdmin) return res.sendStatus(403);
  next();
}

export function requireAuth(req: any, res: any, next: any) {
  if (!req.isAuthenticated()) return res.sendStatus(401);
  next();
}
