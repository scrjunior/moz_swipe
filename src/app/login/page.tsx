"use client";

import { supabase } from "@/supabaseClient";
import { useEffect, useState, Suspense } from "react"; // ← Adicionar Suspense
import { useRouter, useSearchParams } from "next/navigation";
import type { User } from "@supabase/supabase-js";

// Toast notification component
interface ToastProps {
  message: string;
  type: 'success' | 'error' | 'info';
  onClose: () => void;
}

const Toast = ({ message, type, onClose }: ToastProps) => {
  useEffect(() => {
    const timer = setTimeout(onClose, 4000);
    return () => clearTimeout(timer);
  }, [onClose]);

  const bgColor = {
    success: 'bg-green-600',
    error: 'bg-red-600',
    info: 'bg-blue-600'
  }[type];

  const icon = {
    success: '✓',
    error: '✖',
    info: 'ℹ'
  }[type];

  return (
    <div className={`${bgColor} text-white px-6 py-4 rounded-lg shadow-lg flex items-center gap-3 min-w-[300px] animate-slide-in`}>
      <span className="text-2xl">{icon}</span>
      <span className="flex-1">{message}</span>
      <button onClick={onClose} className="text-white hover:text-gray-200 text-xl">
        ✖
      </button>
    </div>
  );
};

interface ToastNotification {
  id: number;
  message: string;
  type: 'success' | 'error' | 'info';
}

// ✅ Componente separado que usa searchParams
function LoginContent() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [isSignUp, setIsSignUp] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isPasswordSetup, setIsPasswordSetup] = useState(false);
  const [setupToken, setSetupToken] = useState("");
  const [setupUserName, setSetupUserName] = useState("");
  const [toasts, setToasts] = useState<ToastNotification[]>([]);
  const router = useRouter();
  const searchParams = useSearchParams(); // ✅ Agora dentro do Suspense

  // Toast notification functions
  const showToast = (message: string, type: 'success' | 'error' | 'info') => {
    const id = Date.now();
    setToasts(prev => [...prev, { id, message, type }]);
  };

  const removeToast = (id: number) => {
    setToasts(prev => prev.filter(toast => toast.id !== id));
  };

  useEffect(() => {
    // Check for password setup parameters in URL
    const setupTokenParam = searchParams.get('setup');
    const emailParam = searchParams.get('email');
    
    if (setupTokenParam && emailParam) {
      // Validate the setup token
      validateSetupToken(setupTokenParam, emailParam);
    } else {
      // Normal auth flow
      initializeAuth();
    }
  }, [searchParams]);

  const validateSetupToken = async (token: string, userEmail: string) => {
    try {
      setLoading(true);
      
      // Check if the token is valid and not expired
      const { data: userData, error } = await supabase
        .from('users')
        .select('*')
        .eq('password_setup_token', token)
        .eq('email', userEmail.toLowerCase())
        .single();

      if (error || !userData) {
        showToast("Link inválido ou expirado. Entre em contato com o administrador.", "error");
        router.push("/login");
        return;
      }

      // Check if token is expired
      const now = new Date();
      const expiresAt = new Date(userData.password_setup_expires || '');
      
      if (expiresAt <= now) {
        showToast("Link expirado. Entre em contato com o administrador para receber um novo link.", "error");
        router.push("/login");
        return;
      }

      // Token is valid, show password setup form
      setIsPasswordSetup(true);
      setSetupToken(token);
      setEmail(userEmail);
      setSetupUserName(userData.name || '');
      setLoading(false);
      showToast("Bem-vindo! Configure sua senha para continuar.", "info");
      
    } catch (err) {
      console.error('Error validating setup token:', err);
      showToast("Erro ao validar link. Tente novamente.", "error");
      router.push("/login");
    }
  };

  const initializeAuth = async () => {
    try {
      // Get initial session
      const { data: { session } } = await supabase.auth.getSession();
      setUser(session?.user ?? null);
      setLoading(false);

      if (session?.user) {
        router.push("/usuarios");
        return;
      }

      // Listen for auth changes
      const { data: { subscription } } = supabase.auth.onAuthStateChange(
        async (event, session) => {
          setUser(session?.user ?? null);

          if (event === "SIGNED_IN" && session?.user) {
            router.push("/usuarios");
          }
        }
      );

      return () => subscription.unsubscribe();
    } catch (err) {
      console.error("Error initializing auth:", err);
      setLoading(false);
    }
  };

  const checkEmailExists = async (emailToCheck: string): Promise<boolean> => {
    if (!emailToCheck.includes("@")) return false;

    try {
      const { data, error } = await supabase
        .from("users")
        .select("email")
        .eq("email", emailToCheck.toLowerCase())
        .single();

      return !error && !!data;
    } catch {
      return false;
    }
  };

  const handlePasswordSetup = async () => {
    if (!password || !confirmPassword) {
      showToast("Por favor, preencha todos os campos de senha.", "error");
      return;
    }

    if (password !== confirmPassword) {
      showToast("As senhas não coincidem.", "error");
      return;
    }

    if (password.length < 6) {
      showToast("A senha deve ter pelo menos 6 caracteres.", "error");
      return;
    }

    setIsSubmitting(true);

    try {
      // Create the user account in Supabase Auth
      const { data, error } = await supabase.auth.signUp({
        email: email.toLowerCase(),
        password: password,
      });

      if (error) {
        console.error("Password setup error:", error);
        showToast("Erro ao configurar senha: " + error.message, "error");
        setIsSubmitting(false);
        return;
      }

      // Clear the setup token since password has been set
      const { error: updateError } = await supabase
        .from('users')
        .update({
          password_setup_token: null,
          password_setup_expires: null,
        })
        .eq('password_setup_token', setupToken);

      if (updateError) {
        console.error("Error clearing setup token:", updateError);
      }

      // Track the login since signUp logs the user in automatically
      if (data.user?.email) {
        await trackLogin(data.user.email);
      }

      showToast("Senha configurada com sucesso! Redirecionando...", "success");
      
      // Redirect to dashboard instead of login page since user is already authenticated
      setTimeout(() => {
        router.push("/usuarios");
      }, 1500);
      
    } catch (err) {
      console.error("Password setup error:", err);
      showToast("Erro inesperado ao configurar senha", "error");
      setIsSubmitting(false);
    }
  };

  const handleSignUp = async () => {
    if (!email || !password || !confirmPassword) {
      showToast("Por favor, preencha todos os campos.", "error");
      return;
    }

    if (password !== confirmPassword) {
      showToast("As senhas não coincidem.", "error");
      return;
    }

    if (password.length < 6) {
      showToast("A senha deve ter pelo menos 6 caracteres.", "error");
      return;
    }

    // Check if email exists in users table before allowing signup
    const emailExists = await checkEmailExists(email);
    if (!emailExists) {
      showToast("Este email não está autorizado. Entre em contato com o administrador.", "error");
      return;
    }

    setIsSubmitting(true);

    try {
      const { data, error } = await supabase.auth.signUp({
        email: email.toLowerCase(),
        password: password,
      });

      if (error) {
        console.error("Sign up error:", error);
        showToast("Erro ao criar conta: " + error.message, "error");
      } else {
        showToast("Conta criada com sucesso! Você pode fazer login agora.", "success");
        setIsSignUp(false);
        setPassword("");
        setConfirmPassword("");
      }
    } catch (err) {
      console.error("Sign up error:", err);
      showToast("Erro inesperado ao criar conta", "error");
    } finally {
      setIsSubmitting(false);
    }
  };

  // Track user login
  const trackLogin = async (userEmail: string) => {
    try {
      // Get the user ID from the users table
      const { data: userData, error: userError } = await supabase
        .from('users')
        .select('id')
        .eq('email', userEmail.toLowerCase())
        .single();

      if (!userError && userData) {
        await supabase
          .from('user_logins')
          .insert({ user_id: userData.id });
      }
    } catch (error) {
      console.error('Error tracking login:', error);
      // Don't block login if tracking fails
    }
  };

  const handleSignIn = async () => {
    if (!email || !password) {
      showToast("Por favor, preencha email e senha.", "error");
      return;
    }

    setIsSubmitting(true);

    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email: email.toLowerCase(),
        password: password,
      });

      if (error) {
        console.error("Sign in error:", error);
        if (error.message.includes("Invalid login credentials")) {
          showToast("Email ou senha incorretos.", "error");
        } else {
          showToast("Erro ao fazer login: " + error.message, "error");
        }
        return;
      }

      // Successful login - track it
      showToast("Login realizado com sucesso!", "success");
      console.log("Logged in user:", data.user);
      
      // Track the login
      if (data.user?.email) {
        await trackLogin(data.user.email);
      }
      
      // The auth state change listener will redirect
    } catch (err) {
      console.error("Sign in error:", err);
      showToast("Erro inesperado ao fazer login", "error");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (isPasswordSetup) {
      await handlePasswordSetup();
    } else if (isSignUp) {
      await handleSignUp();
    } else {
      await handleSignIn();
    }
  };

  const handleLogout = async () => {
    try {
      const { error } = await supabase.auth.signOut();
      if (error) {
        console.error("Logout error:", error);
        showToast("Erro ao fazer logout", "error");
      } else {
        showToast("Logout realizado com sucesso!", "success");
        router.push("/login");
      }
    } catch (err) {
      console.error("Logout error:", err);
      showToast("Erro ao fazer logout", "error");
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-[#0f0f0f] text-white">
        <div className="animate-spin rounded-full h-8 w-8 border-2 border-white border-t-transparent mb-4"></div>
        <p>Carregando...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-[#0f0f0f] text-white relative">
      {/* Toast Container */}
      <div className="fixed top-4 right-4 z-50 flex flex-col gap-3">
        {toasts.map(toast => (
          <Toast
            key={toast.id}
            message={toast.message}
            type={toast.type}
            onClose={() => removeToast(toast.id)}
          />
        ))}
      </div>

      {!user ? (
        <div className="w-full max-w-md px-8">
          {isPasswordSetup ? (
            <>
              <div className="text-center mb-6">
                <h1 className="text-2xl font-bold mb-2">Configurar Senha</h1>
                <p className="text-gray-400">Olá {setupUserName}!</p>
                <p className="text-sm text-gray-500">Configure sua senha para acessar sua conta</p>
              </div>

              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium mb-2">Email</label>
                  <input
                    type="email"
                    value={email}
                    disabled
                    className="w-full px-3 py-2 rounded-lg bg-[#2f2f2f] text-gray-400 border border-[#333] cursor-not-allowed"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium mb-2">Nova Senha</label>
                  <input
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    minLength={6}
                    className="w-full px-3 py-2 rounded-lg bg-[#1f1f1f] text-white border border-[#333] focus:outline-none focus:ring-2 focus:ring-blue-600 focus:border-transparent"
                    placeholder="Mínimo 6 caracteres"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium mb-2">Confirmar Senha</label>
                  <input
                    type="password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    required
                    minLength={6}
                    className="w-full px-3 py-2 rounded-lg bg-[#1f1f1f] text-white border border-[#333] focus:outline-none focus:ring-2 focus:ring-blue-600 focus:border-transparent"
                    placeholder="Confirme sua senha"
                  />
                </div>

                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="w-full px-4 py-2 bg-green-600 rounded-lg shadow hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                >
                  {isSubmitting && (
                    <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent"></div>
                  )}
                  {isSubmitting ? "Configurando..." : "Configurar Senha"}
                </button>
              </form>

              <div className="mt-6 text-center text-sm text-gray-400">
                <p>Após configurar sua senha, você será redirecionado automaticamente.</p>
              </div>
            </>
          ) : (
            <>
              <h1 className="text-2xl font-bold mb-6 text-center">
                {isSignUp ? "Criar Conta" : "Login"}
              </h1>

              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium mb-2">Email</label>
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    className="w-full px-3 py-2 rounded-lg bg-[#1f1f1f] text-white border border-[#333] focus:outline-none focus:ring-2 focus:ring-blue-600 focus:border-transparent"
                    placeholder="seu-email@exemplo.com"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium mb-2">Senha</label>
                  <input
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    minLength={6}
                    className="w-full px-3 py-2 rounded-lg bg-[#1f1f1f] text-white border border-[#333] focus:outline-none focus:ring-2 focus:ring-blue-600 focus:border-transparent"
                    placeholder="Mínimo 6 caracteres"
                  />
                </div>

                {isSignUp && (
                  <div>
                    <label className="block text-sm font-medium mb-2">Confirmar Senha</label>
                    <input
                      type="password"
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      required
                      minLength={6}
                      className="w-full px-3 py-2 rounded-lg bg-[#1f1f1f] text-white border border-[#333] focus:outline-none focus:ring-2 focus:ring-blue-600 focus:border-transparent"
                      placeholder="Confirme sua senha"
                    />
                  </div>
                )}

                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="w-full px-4 py-2 bg-blue-600 rounded-lg shadow hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                >
                  {isSubmitting && (
                    <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent"></div>
                  )}
                  {isSubmitting
                    ? isSignUp
                      ? "Criando conta..."
                      : "Entrando..."
                    : isSignUp
                    ? "Criar Conta"
                    : "Entrar"}
                </button>
              </form>

              <div className="mt-6 text-center">
                {!isSignUp ? (
                  <button
                    onClick={() => {
                      setIsSignUp(true);
                      setPassword("");
                      setConfirmPassword("");
                    }}
                    className="text-blue-400 hover:text-blue-300 text-sm"
                  >
                    Primeira vez? Criar conta
                  </button>
                ) : (
                  <button
                    onClick={() => {
                      setIsSignUp(false);
                      setPassword("");
                      setConfirmPassword("");
                    }}
                    className="text-blue-400 hover:text-blue-300 text-sm"
                  >
                    Já tem conta? Fazer login
                  </button>
                )}
              </div>

              <div className="mt-6 text-center text-sm text-gray-400">
                <p>Apenas emails autorizados podem criar contas.</p>
                <p>Entre em contato com o administrador se precisar de acesso.</p>
              </div>
            </>
          )}
        </div>
      ) : (
        <div className="text-center">
          <h1 className="text-xl mb-4">Bem-vindo, {user.email}</h1>
          <button
            onClick={handleLogout}
            className="px-4 py-2 bg-red-600 rounded-lg shadow hover:bg-red-700"
          >
            Logout
          </button>
        </div>
      )}

      <style jsx>{`
        @keyframes slide-in {
          from {
            transform: translateX(100%);
            opacity: 0;
          }
          to {
            transform: translateX(0);
            opacity: 1;
          }
        }
        .animate-slide-in {
          animation: slide-in 0.3s ease-out;
        }
      `}</style>
    </div>
  );
}

// ✅ Componente principal com Suspense
export default function LoginPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex flex-col items-center justify-center bg-[#0f0f0f] text-white">
        <div className="animate-spin rounded-full h-8 w-8 border-2 border-white border-t-transparent mb-4"></div>
        <p>Carregando...</p>
      </div>
    }>
      <LoginContent />
    </Suspense>
  );
}
