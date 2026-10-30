import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { demoUsers } from "./seed";
import type { User } from "./types";

const SESSION_KEY = "aicte-fdr-session-v1";

interface SessionContextValue {
  user: User | null;
  ready: boolean;
  users: User[];
  signIn: (userId: string) => User | null;
  signOut: () => void;
}

const SessionContext = createContext<SessionContextValue | null>(null);

export function SessionProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    try {
      const saved = window.localStorage.getItem(SESSION_KEY);
      if (saved) {
        const found = demoUsers.find((candidate) => candidate.id === saved);
        if (found) setUser(found);
      }
    } catch {
      // Storage may be unavailable (private mode); the demo still works in memory.
    }
    setReady(true);
  }, []);

  const signIn = useCallback((userId: string): User | null => {
    const found = demoUsers.find((candidate) => candidate.id === userId) ?? null;
    setUser(found);
    try {
      if (found) window.localStorage.setItem(SESSION_KEY, found.id);
      else window.localStorage.removeItem(SESSION_KEY);
    } catch {
      // ignore storage errors
    }
    return found;
  }, []);

  const signOut = useCallback(() => {
    setUser(null);
    try {
      window.localStorage.removeItem(SESSION_KEY);
    } catch {
      // ignore storage errors
    }
  }, []);

  const value = useMemo(
    () => ({ user, ready, users: demoUsers, signIn, signOut }),
    [user, ready, signIn, signOut],
  );

  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
}

export function useSession(): SessionContextValue {
  const context = useContext(SessionContext);
  if (!context) throw new Error("useSession must be used within SessionProvider");
  return context;
}
