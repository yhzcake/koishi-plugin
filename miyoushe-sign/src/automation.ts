import { createAccounts, GameRole, Passport } from './accounts'

export async function runAutoPassport(
  passport: Passport,
  roles: GameRole[],
  date: string,
  accounts: ReturnType<typeof createAccounts>,
  attempted: Map<string, { date: string; count: number }>,
  active: Set<string>,
  signRole: (role: GameRole) => Promise<{ retry: boolean }>,
  runCommunitySign: (role: GameRole) => Promise<void>,
) {
  if (!passport.enabled || !passport.cookie || active.has(passport.id)) return
  active.add(passport.id)
  try {
    for (const role of roles) {
      const previous = attempted.get(role.id)
      if (role.lastDay === date || previous?.date === date && previous.count >= 2) continue
      const result = await signRole(role)
      attempted.set(role.id, { date, count: result.retry && previous?.date === date ? previous.count + 1 : result.retry ? 1 : 2 })
      if (passport.followMissions && passport.stoken && await accounts.markMissionDay(passport.platform, passport.userId, passport.ltuid, date, 'follow')) {
        await runCommunitySign(role)
      }
    }
  } finally {
    active.delete(passport.id)
  }
}
