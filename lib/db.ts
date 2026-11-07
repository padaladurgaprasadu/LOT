import fs from "fs";
import path from "path";
import { hashPassword, verifyPassword } from "./crypto";

export interface StoredUser {
  id: string;
  name: string;
  email: string;
  passwordHash: string;
  salt: string;
  role: "user" | "admin" | "developer";
  createdAt: number;
  updatedAt: number;
}

const DATA_DIR = path.join(process.cwd(), "data");
const DB_FILE = path.join(DATA_DIR, "lot_users.json");

/**
 * Seeds the very first admin account only when BOTH env vars are supplied.
 * A hardcoded default admin + password in source is a published credential:
 * anyone who reads the repo can sign in as admin on every deployment.
 */
function buildSeedUsers(): StoredUser[] {
  const seedEmail = process.env.LOT_SEED_ADMIN_EMAIL?.toLowerCase().trim();
  const seedPassword = process.env.LOT_SEED_ADMIN_PASSWORD;
  const seedName = process.env.LOT_SEED_ADMIN_NAME?.trim() || "LOT Administrator";

  if (!seedEmail || !seedPassword) return [];

  const { hash, salt } = hashPassword(seedPassword);
  return [
    {
      id: `user_admin_${Date.now()}`,
      name: seedName,
      email: seedEmail,
      passwordHash: hash,
      salt,
      role: "admin",
      createdAt: Date.now(),
      updatedAt: Date.now(),
    },
  ];
}

function ensureDbFile(): StoredUser[] {
  try {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }
    if (!fs.existsSync(DB_FILE)) {
      const seedUsers = buildSeedUsers();
      fs.writeFileSync(DB_FILE, JSON.stringify(seedUsers, null, 2), "utf8");
      return seedUsers;
    }
    const raw = fs.readFileSync(DB_FILE, "utf8");
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch (err) {
    console.error("Failed to read DB file:", err);
    return [];
  }
}

function saveDb(users: StoredUser[]): void {
  try {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }
    fs.writeFileSync(DB_FILE, JSON.stringify(users, null, 2), "utf8");
  } catch (err) {
    console.error("Failed to write to DB file:", err);
  }
}

export function findUserByEmail(email: string): StoredUser | null {
  const users = ensureDbFile();
  const normalized = email.toLowerCase().trim();
  return users.find((u) => u.email.toLowerCase() === normalized) || null;
}

export function findUserById(id: string): StoredUser | null {
  const users = ensureDbFile();
  return users.find((u) => u.id === id) || null;
}

export function createUser(
  name: string,
  email: string,
  passwordPlain: string,
  role: "user" | "admin" | "developer" = "user"
): StoredUser {
  const users = ensureDbFile();
  const normalizedEmail = email.toLowerCase().trim();

  if (users.some((u) => u.email.toLowerCase() === normalizedEmail)) {
    throw new Error("A user with this email already exists");
  }

  const { hash, salt } = hashPassword(passwordPlain);
  const newUser: StoredUser = {
    id: `user_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
    name: name.trim(),
    email: normalizedEmail,
    passwordHash: hash,
    salt,
    role,
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };

  users.push(newUser);
  saveDb(users);
  return newUser;
}

export function updateUserPassword(email: string, newPasswordPlain: string): StoredUser {
  const users = ensureDbFile();
  const normalizedEmail = email.toLowerCase().trim();
  const index = users.findIndex((u) => u.email.toLowerCase() === normalizedEmail);

  if (index === -1) {
    throw new Error("No account found with this email address");
  }

  const { hash, salt } = hashPassword(newPasswordPlain);
  users[index].passwordHash = hash;
  users[index].salt = salt;
  users[index].updatedAt = Date.now();

  saveDb(users);
  return users[index];
}

export function updateUserName(identifier: string, newName: string): StoredUser {
  const users = ensureDbFile();
  const index = users.findIndex(
    (u) => u.id === identifier || u.email.toLowerCase() === identifier.toLowerCase().trim()
  );

  // Previously an unknown identifier silently created an admin account with a
  // hardcoded password. Renaming a user must never mint a new account.
  if (index === -1) {
    throw new Error("No account found for this user");
  }

  users[index].name = newName.trim();
  users[index].updatedAt = Date.now();

  saveDb(users);
  return users[index];
}
