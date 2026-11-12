// Adaptadores de seguridad: PasswordHasher (bcrypt) y TokenService (JWT)
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';

export const bcryptHasher = {
  hash: (plain) => bcrypt.hash(plain, 10),
  compare: (plain, hash) => bcrypt.compare(plain, hash),
};

export function jwtTokenService(secret) {
  return { sign: (payload) => jwt.sign(payload, secret, { expiresIn: '7d' }) };
}
