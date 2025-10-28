"use client";

import { useAuth } from "@/hooks/useAuth";

export default function HomePage() {
  const { user, logout } = useAuth();

  return (
    <div>
      <h1>Home</h1>
      {user ? (
        <>
          <p>Welcome, {user.email}</p>
          <button onClick={logout}>Logout</button>
        </>
      ) : (
        <p>You are not logged in.</p>
      )}
    </div>
  );
}
