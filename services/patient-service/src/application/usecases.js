// ===== CASOS DE USO (capa de aplicación) =====
import { validateNewUser, sanitizeProfileUpdate, toPublicUser, ROLES } from '../domain/User.js';
import { DomainError } from '../domain/errors.js';

export function makeUseCases({ userRepo, hasher, tokens, events }) {
  return {
    async register(input, meta = {}) {
      const data = validateNewUser(input);
      if (await userRepo.findByEmail(data.email)) throw new DomainError('Ese correo ya está registrado', 409);
      const passwordHash = await hasher.hash(data.password);
      const user = await userRepo.create({ ...data, passwordHash });
      await events.publish('usuario.registrado', { userId: user.id, name: user.name, email: user.email, role: user.role });
      return this._session(user, meta);
    },

    async login({ email, password }, meta = {}) {
      if (!email || !password) throw new DomainError('Escribe tu correo y contraseña', 400);
      const user = await userRepo.findByEmail(String(email).trim().toLowerCase());
      if (!user || !(await hasher.compare(password, user.passwordHash))) {
        await events.publish('usuario.login_fallido', { email, ip: meta.ip, at: new Date().toISOString() });
        throw new DomainError('Correo o contraseña incorrectos', 401);
      }
      return this._session(user, meta);
    },

    async _session(user, meta) {
      const token = tokens.sign({ sub: user.id, role: user.role, name: user.name, email: user.email });
      // 👇 Este evento es el que verás en RabbitMQ cada vez que alguien inicia sesión
      await events.publish('usuario.sesion_iniciada', {
        userId: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        ip: meta.ip,
        device: meta.userAgent,
        at: new Date().toISOString(),
      });
      return { token, user: toPublicUser(user) };
    },

    /**
     * Identifica a quien escribe por Telegram.
     * - Si ya vinculó su chat en la app (Perfil → ID de Telegram), usa esa misma cuenta.
     * - Si no, le crea un expediente de paciente automáticamente.
     */
    async identifyTelegram({ chatId, name }) {
      const id = String(chatId || '').trim();
      if (!/^-?\d+$/.test(id)) throw new DomainError('chatId de Telegram inválido', 400);
      const existing = await userRepo.findByTelegramChatId(id);
      if (existing) return { ...toPublicUser(existing), isNew: false };

      const cleanName = String(name || '').trim();
      const user = await userRepo.create({
        name: cleanName.length >= 3 ? cleanName : 'Paciente Telegram',
        email: `tg${id.replace('-', 'n')}@telegram.mediclick.com`,
        passwordHash: await hasher.hash(`${id}-${Math.random()}-${Date.now()}`), // no se usa para entrar
        role: 'paciente',
      });
      const linked = await userRepo.update(user.id, { telegramChatId: id });
      await events.publish('usuario.registrado', { userId: user.id, name: user.name, channel: 'telegram', at: new Date().toISOString() });
      return { ...toPublicUser(linked), isNew: true };
    },

    async getProfile(userId) {
      const user = await userRepo.findById(userId);
      if (!user) throw new DomainError('Usuario no encontrado', 404);
      return toPublicUser(user);
    },

    async updateProfile(userId, input, { channel = 'app', skipEmpty = false } = {}) {
      const fields = sanitizeProfileUpdate(input, { skipEmpty });
      if (!Object.keys(fields).length) return this.getProfile(userId);
      const user = await userRepo.update(userId, fields);
      if (!user) throw new DomainError('Usuario no encontrado', 404);
      await events.publish('paciente.actualizado', { userId, fields: Object.keys(fields), channel });
      return toPublicUser(user);
    },

    // ================== ADMINISTRACIÓN ==================
    admin: {
      async stats() {
        return userRepo.countByRole();
      },

      async list({ q, role } = {}) {
        return (await userRepo.list({ q, role })).map(toPublicUser);
      },

      async create(adminId, input) {
        const data = validateNewUser(input, { allowAnyRole: true });
        if (await userRepo.findByEmail(data.email)) throw new DomainError('Ese correo ya está registrado', 409);
        const user = await userRepo.create({ ...data, passwordHash: await hasher.hash(data.password) });
        await events.publish('usuario.registrado', { userId: user.id, name: user.name, role: user.role, by: adminId, channel: 'admin' });
        return toPublicUser(user);
      },

      async update(adminId, userId, input) {
        const current = await userRepo.findById(userId);
        if (!current) throw new DomainError('Usuario no encontrado', 404);
        const fields = sanitizeProfileUpdate(input);
        if (input.email !== undefined) {
          const email = String(input.email).trim().toLowerCase();
          if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new DomainError('Correo no válido', 400);
          const other = await userRepo.findByEmail(email);
          if (other && other.id !== userId) throw new DomainError('Ese correo ya lo usa otro usuario', 409);
          fields.email = email;
        }
        if (input.role !== undefined && input.role !== current.role) {
          if (!ROLES.includes(input.role)) throw new DomainError('Rol no válido', 400);
          if (userId === adminId) throw new DomainError('No puedes cambiar tu propio rol', 400);
          fields.role = input.role;
        }
        const user = await userRepo.update(userId, fields);
        if (fields.role) {
          await events.publish('usuario.rol_cambiado', { userId, name: user.name, from: current.role, to: fields.role, by: adminId });
        }
        await events.publish('paciente.actualizado', { userId, fields: Object.keys(fields), channel: 'admin', by: adminId });
        return toPublicUser(user);
      },

      async setPassword(adminId, userId, password) {
        if (!password || password.length < 6) throw new DomainError('La contraseña debe tener al menos 6 caracteres', 400);
        const user = await userRepo.setPassword(userId, await hasher.hash(password));
        if (!user) throw new DomainError('Usuario no encontrado', 404);
        await events.publish('usuario.password_cambiado', { userId, by: adminId });
        return { ok: true };
      },

      async remove(adminId, userId) {
        if (userId === adminId) throw new DomainError('No puedes eliminar tu propia cuenta', 400);
        const user = await userRepo.findById(userId);
        if (!user) throw new DomainError('Usuario no encontrado', 404);
        await userRepo.delete(userId);
        // 👇 El appointment-service escucha este evento y cancela sus citas futuras
        await events.publish('usuario.eliminado', { userId, name: user.name, role: user.role, by: adminId });
        return { ok: true };
      },
    },
  };
}
