// src/lib/auth.tsx
'use client';
import React, { createContext, useContext, useEffect, useState } from 'react';
import { onAuthStateChanged, signInWithEmailAndPassword, signOut, User } from 'firebase/auth';
import { auth } from './firebaseClient';


interface AuthContextValue {
user: User | null;
loading: boolean;
login: (email: string, password: string) => Promise<void>;
logout: () => Promise<void>;
}


const AuthContext = createContext<AuthContextValue | undefined>(undefined);


export function AuthProvider({ children }: { children: React.ReactNode }) {
const [user, setUser] = useState<User | null>(null);
const [loading, setLoading] = useState(true);


useEffect(() => {
const unsub = onAuthStateChanged(auth, (u) => {
setUser(u);
setLoading(false);
});
return () => unsub();
}, []);


async function login(email: string, password: string) {
await signInWithEmailAndPassword(auth, email, password);
}


async function logout() {
await signOut(auth);
}


return (
<AuthContext.Provider value={{ user, loading, login, logout }}>
{children}
</AuthContext.Provider>
);
}


export function useAuth() {
const ctx = useContext(AuthContext);
if (!ctx) throw new Error('useAuth must be used inside AuthProvider');
return ctx;
}