// ===== PUERTOS (interfaces) =====
// La capa de aplicación depende de estas "formas", no de implementaciones concretas.
// Los adaptadores de /infrastructure las implementan.
//
// UserRepository {
//   findByEmail(email) -> User | null
//   findById(id)       -> User | null
//   findByTelegramChatId(chatId) -> User | null
//   create({ name, email, passwordHash, role }) -> User
//   update(id, fields) -> User
// }
//
// PasswordHasher { hash(plain) -> string ; compare(plain, hash) -> boolean }
//
// TokenService   { sign(payload) -> string }
//
// EventPublisher { publish(routingKey, data) -> Promise<boolean> }
export {};
