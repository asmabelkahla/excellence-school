import { ConflictException } from '@nestjs/common';
import { randomInt } from 'crypto';
import { Repository } from 'typeorm';
import { User } from '../entities/user.entity';

// No 0/O, 1/l/I: the admin reads this password out or writes it down.
const ALPHABET = 'abcdefghjkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789';

/** Temporary password: 12 chars, always at least one letter and one digit. */
export function generateTemporaryPassword(length = 12): string {
  for (;;) {
    const pwd = Array.from({ length }, () => ALPHABET[randomInt(ALPHABET.length)]).join('');
    if (/[a-zA-Z]/.test(pwd) && /\d/.test(pwd)) return pwd;
  }
}

/** Emails are unique across every account, whatever the role (case-insensitive). */
export async function assertEmailFree(users: Repository<User>, email: string, exceptId?: string) {
  const existing = await users
    .createQueryBuilder('u')
    .where('LOWER(u.email) = LOWER(:email)', { email })
    .getOne();
  if (existing && existing.id !== exceptId) {
    throw new ConflictException('Un compte avec cet email existe déjà.');
  }
}
