import { asc } from 'drizzle-orm';
import { db } from '../db';
import { contracts, users } from '../db/schema';
import type { UserInput } from '../domain/users';

export async function listUsers() {
  const [userRows, contractRows] = await Promise.all([
    db.select().from(users).orderBy(asc(users.name)),
    db.select({ managerName: contracts.managerName }).from(contracts),
  ]);

  const managedContracts = contractRows.reduce<Record<string, number>>(
    (counts, contract) => ({
      ...counts,
      [contract.managerName]: (counts[contract.managerName] ?? 0) + 1,
    }),
    {},
  );

  return userRows.map((user) =>
    serializeUser(user, managedContracts[user.name]),
  );
}

export async function createUser(input: UserInput) {
  const initials = input.name
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join('');
  const [created] = await db
    .insert(users)
    .values({
      name: input.name,
      email: input.email,
      initials,
      area: input.sector,
      vertical: input.vertical,
      sector: input.sector,
      status: 'invite_pending',
    })
    .returning();
  return serializeUser(created, 0);
}

function serializeUser(user: typeof users.$inferSelect, managedContracts = 0) {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    initials: user.initials,
    vertical: user.vertical,
    sector: user.sector,
    managedContracts,
    lastAccessAt: user.lastAccessAt?.toISOString() ?? null,
    status:
      user.status === 'active'
        ? 'Ativo'
        : user.status === 'disabled'
          ? 'Desativado'
          : 'Convite pendente',
  };
}
