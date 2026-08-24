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

function ensureDbFile(): StoredUser[] {
  try {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }
    if (!fs.existsSync(DB_FILE)) {
      // Initialize with default admin user (Durga)
      const { hash, salt } = hashPassword("Admin@LOT2026!");
      const defaultUsers: StoredUser[] = [
        {
          id: "user_durga_master",
          name: "Durga prasadu padala",
          email: "durgaprasadu@lot.ai",
          passwordHash: hash,
          salt,
          role: "admin",
          createdAt: Date.now(),
          updatedAt: Date.now(),
        },
      ];
      fs.writeFileSync(DB_FILE, JSON.stringify(defaultUsers, null, 2), "utf8");
      return defaultUsers;
    }
    const raw = fs.readFileSync(DB_FILE, "utf8");
    return JSON.parse(raw);
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

  if (index === -1) {
    // If not found in file (e.g. master default), update master record
    const { hash, salt } = hashPassword("Admin@LOT2026!");
    const defaultUser: StoredUser = {
      id: "user_durga_master",
      name: newName.trim(),
      email: "durgaprasadu@lot.ai",
      passwordHash: hash,
      salt,
      role: "admin",
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };
    users.push(defaultUser);
    saveDb(users);
    return defaultUser;
  }

  users[index].name = newName.trim();
  users[index].updatedAt = Date.now();

  saveDb(users);
  return users[index];
}
