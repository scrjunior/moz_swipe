"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/supabaseClient";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { User } from "@supabase/supabase-js";

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

interface SubscriptionData {
  plan: string;
  start: string;
  end: string;
  method: string;
  frequency: string;
  status: string;
  lastPayment: {
    date: string;
    installments: string;
    method: string;
    amount: string;
  };
}

export default function ConfiguracoesPage() {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<{ name?: string; email?: string; phone?: string } | null>(null);
  const [subscription, setSubscription] = useState<SubscriptionData | null>(null);
  const [loading, setLoading] = useState(true);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [activeTab, setActiveTab] = useState<"perfil" | "conta" | "senha">("perfil");
  const [toasts, setToasts] = useState<ToastNotification[]>([]);
  const [isUpdating, setIsUpdating] = useState(false);
  
  // Password change states
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmNewPassword, setConfirmNewPassword] = useState("");
  
  const router = useRouter();
  const pathname = usePathname();

  // Toast notification functions
  const showToast = (message: string, type: 'success' | 'error' | 'info') => {
    const id = Date.now();
    setToasts(prev => [...prev, { id, message, type }]);
  };

  const removeToast = (id: number) => {
    setToasts(prev => prev.filter(toast => toast.id !== id));
  };

  useEffect(() => {
    const loadUser = async () => {
      try {
        setLoading(true);
        const {
          data: { session },
        } = await supabase.auth.getSession();

        if (!session?.user) {
          router.push("/login");
          return;
        }

        setUser(session.user);

        const { data: userRow, error } = await supabase
          .from("users")
          .select("name, email, phone, expires_at, previous_expires_at, paused")
          .eq("email", session.user.email)
          .single();

        if (error) console.error("Erro ao buscar usuário:", error);

        if (userRow) {
          setProfile({ name: userRow.name, email: userRow.email, phone: userRow.phone });

          const now = new Date();
          let status = "Expirado";
          if (userRow.paused) {
            status = "Pausado";
          } else if (userRow.expires_at && new Date(userRow.expires_at) > now) {
            status = "Ativo";
          }

          setSubscription({
            plan: "Founder",
            start: userRow.previous_expires_at
              ? new Date(userRow.previous_expires_at).toLocaleDateString("pt-PT")
              : "—",
            end: userRow.expires_at
              ? new Date(userRow.expires_at).toLocaleDateString("pt-PT")
              : "—",
            method: "—",
            frequency: "—",
            status,
            lastPayment: {
              date: userRow.previous_expires_at
                ? new Date(userRow.previous_expires_at).toLocaleDateString("pt-PT")
                : "—",
              installments: "—",
              method: "—",
              amount: "—",
            },
          });
        } else {
          setProfile({
            name:
              session.user.user_metadata?.full_name ||
              session.user.user_metadata?.name ||
              session.user.email,
            email: session.user.email,
            phone: "",
          });
        }

        setLoading(false);
      } catch (e) {
        console.error("Erro:", e);
        setLoading(false);
      }
    };

    loadUser();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === "SIGNED_OUT" || !session) router.push("/login");
    });

    return () => subscription.unsubscribe();
  }, [router]);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    showToast("Logout realizado com sucesso!", "success");
    router.push("/login");
  };

  const handleResize = () => {
    setSidebarCollapsed(window.innerWidth < 1024);
  };

  useEffect(() => {
    handleResize();
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  const handleUpdateAccount = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!profile || !user) return;

    setIsUpdating(true);

    const formData = new FormData(e.currentTarget);
    const name = formData.get("name")?.toString() || "";
    const email = formData.get("email")?.toString() || "";
    let phone = formData.get("phone")?.toString() || "";

    // Ensure phone has +258 prefix
    if (phone && !phone.startsWith("+258")) {
      phone = `+258${phone.replace(/^0+/, "")}`;
    }

    try {
      const { error } = await supabase
        .from("users")
        .update({ name, email, phone })
        .eq("email", user.email);

      if (error) {
        throw error;
      }

      showToast("Conta atualizada com sucesso!", "success");
      setProfile({ ...profile, name, email, phone });
    } catch (error) {
      console.error("Erro ao atualizar conta:", error);
      showToast("Erro ao atualizar conta: " + (error as Error).message, "error");
    } finally {
      setIsUpdating(false);
    }
  };

  const handleChangePassword = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();

    if (!currentPassword || !newPassword || !confirmNewPassword) {
      showToast("Preencha todos os campos de senha.", "error");
      return;
    }

    if (newPassword !== confirmNewPassword) {
      showToast("A nova senha e a confirmação não coincidem.", "error");
      return;
    }

    if (newPassword.length < 6) {
      showToast("A nova senha deve ter pelo menos 6 caracteres.", "error");
      return;
    }

    if (currentPassword === newPassword) {
      showToast("A nova senha deve ser diferente da senha atual.", "error");
      return;
    }

    setIsUpdating(true);

    try {
      // Verify current password by attempting to sign in
      const { error: signInError } = await supabase.auth.signInWithPassword({
        email: user!.email!,
        password: currentPassword,
      });

      if (signInError) {
        showToast("Senha atual incorreta.", "error");
        setIsUpdating(false);
        return;
      }

      // Update password
      const { error: updateError } = await supabase.auth.updateUser({
        password: newPassword,
      });

      if (updateError) {
        throw updateError;
      }

      showToast("Senha alterada com sucesso!", "success");
      
      // Clear password fields
      setCurrentPassword("");
      setNewPassword("");
      setConfirmNewPassword("");
    } catch (error) {
      console.error("Erro ao alterar senha:", error);
      showToast("Erro ao alterar senha: " + (error as Error).message, "error");
    } finally {
      setIsUpdating(false);
    }
  };

  if (loading) {
    return (
      <div className="flex min-h-screen bg-[#0f0f0f] text-white items-center justify-center">
        <div className="flex items-center gap-3">
          <div className="animate-spin rounded-full h-8 w-8 border-2 border-blue-600 border-t-transparent"></div>
          <span>Carregando...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen bg-[#0f0f0f] text-white relative">
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

      {/* Sidebar */}
      <aside
        className={`${
          sidebarCollapsed ? "w-16" : "w-52"
        } bg-[#141414] p-6 flex flex-col gap-4 transition-all duration-300 relative`}
      >
        <button
          onClick={() => setSidebarCollapsed((s) => !s)}
          className="absolute -right-3 top-6 bg-[#1f1f1f] hover:bg-[#2f2f2f] text-white w-6 h-6 rounded-full flex items-center justify-center text-xs border border-[#333] transition-colors z-10"
        >
          {sidebarCollapsed ? "→" : "←"}
        </button>

        {!sidebarCollapsed && (
          <>
            <h1 className="text-xl font-bold mb-6 ml-4">MOZ SWIPE</h1>
            {profile && (
              <div className="flex items-center gap-3 mb-6 p-3 rounded-lg">
                <div className="w-10 h-10 flex items-center justify-center bg-gray-600 rounded-full">
                  <Image src="/icons/usuario.svg" alt="Usuario" width={22} height={20} />
                </div>
                <div>
                  <p className="text-sm font-medium truncate">{profile.name}</p>
                </div>
              </div>
            )}
            <button
              onClick={() => router.push("/usuarios")}
              className={`flex items-center gap-2 px-7 py-2 rounded-lg text-sm font-bold text-left transition-colors
                ${pathname === "/usuarios" ? "bg-[#1f1f1f] text-white" : "text-gray-300 hover:bg-[#1f1f1f] hover:text-white"}
              `}
            >
              <Image src="/icons/dashboard.svg" alt="Dashboard" width={22} height={20} />
              Dashboard
            </button>

            <div className="mt-4">
              <p className="text-xs px-3 text-gray-400 mb-2 font-bold">Geral</p>
              <div className="flex flex-col gap-1 ml-6">
                <button
                  onClick={() => router.push("/ofertas")}
                  className={`flex items-center gap-2 px-2 py-2 rounded-lg text-sm font-bold text-left transition-colors
                    ${pathname === "/ofertas" ? "bg-[#1f1f1f] text-white" : "text-gray-300 hover:bg-[#1f1f1f] hover:text-white"}
                  `}
                >
                  <Image src="/icons/ofertas.svg" alt="Ofertas" width={22} height={22} />
                  Ofertas
                </button>
                <button
                  onClick={() => router.push("/criativos")}
                  className={`flex items-center gap-2 px-2 py-2 rounded-lg text-sm font-bold text-left transition-colors
                    ${pathname === "/criativos" ? "bg-[#1f1f1f] text-white" : "text-gray-300 hover:bg-[#1f1f1f] hover:text-white"}
                  `}
                >
                  <Image src="/icons/criativos.svg" alt="Criativos" width={22} height={18} />
                  Criativos
                </button>
              </div>
            </div>

            <div className="mt-4">
              <p className="text-xs px-3 text-gray-400 mb-2 font-bold">Suporte</p>
              <div className="flex flex-col gap-1 ml-6">
                <button
                  onClick={() => router.push("/configuracoes")}
                  className="flex items-center gap-2 px-2 py-2 rounded-lg text-sm text-white font-bold text-left bg-[#1f1f1f]"
                >
                  <Image src="/icons/configuracoes.svg" alt="configuracoes" width={22} height={18} />
                  Configurações
                </button>
                <button
                  onClick={() => router.push("/suporte")}
                  className="flex items-center gap-2 px-2 py-2 rounded-lg text-sm text-white font-bold text-left hover:bg-[#1f1f1f]"
                >
                  <Image src="/icons/suporte.svg" alt="suporte" width={22} height={18} />
                  Suporte
                </button>
              </div>
            </div>
          </>
        )}

        <div className="mt-auto">
          <button
            onClick={handleLogout}
            className={`px-3 py-2 bg-red-600 rounded-lg hover:bg-red-700 transition ${
              sidebarCollapsed ? "w-10 h-10 flex items-center justify-center text-lg" : "w-full"
            }`}
            title={sidebarCollapsed ? "Sair" : ""}
          >
            {sidebarCollapsed ? "🚪" : "Sair"}
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 px-8 pb-8 overflow-auto min-w-0">
        {/* Tabs */}
        <div className="mb-6 mt-4">
          <h2 className="text-lg font-bold">Configurações</h2>
          <p className="text-sm text-gray-400">
            Personalize as configurações e preferências de e-mail
          </p>

          <div className="flex mt-4 border-b border-gray-700">
            <button
              onClick={() => setActiveTab("perfil")}
              className={`px-4 py-2 text-sm font-medium ${
                activeTab === "perfil"
                  ? "border-b-2 border-blue-600"
                  : "text-gray-400 hover:text-white"
              }`}
            >
              Perfil
            </button>
            <button
              onClick={() => setActiveTab("conta")}
              className={`px-4 py-2 text-sm font-medium ${
                activeTab === "conta"
                  ? "border-b-2 border-blue-600"
                  : "text-gray-400 hover:text-white"
              }`}
            >
              Conta
            </button>
            <button
              onClick={() => setActiveTab("senha")}
              className={`px-4 py-2 text-sm font-medium ${
                activeTab === "senha"
                  ? "border-b-2 border-blue-600"
                  : "text-gray-400 hover:text-white"
              }`}
            >
              Senha
            </button>
          </div>
        </div>

        {/* Conteúdo das Abas */}
        {activeTab === "perfil" && (
          <>
            {/* Profile Card */}
            <section className="bg-[#141414] p-6 rounded-lg mb-6 shadow">
              <h3 className="text-md font-bold mb-2">Perfil</h3>
              <p className="text-gray-400 text-sm mb-4">Isso exibe seu perfil público no site</p>
              <div className="flex items-center justify-between bg-[#1f1f1f] p-4 rounded-lg">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 flex items-center justify-center bg-gray-700 rounded-full">
                    <Image src="/icons/usuario.svg" alt="Usuario" width={28} height={28} />
                  </div>
                  <div>
                    <p className="font-medium">{profile?.name}</p>
                    <p className="text-gray-400 text-sm">{profile?.email}</p>
                  </div>
                </div>
                <span className="px-3 py-1 text-xs bg-green-700 rounded-full">
                  {subscription?.status}
                </span>
              </div>
            </section>

            {/* Subscription Card */}
            <section className="bg-[#141414] p-6 rounded-lg mb-6 shadow">
              <div className="flex justify-between">
                <div>
                  <p className="font-medium">{subscription?.plan}</p>
                  <p className="text-gray-400 text-sm">
                    Início: {subscription?.start} — Fim: {subscription?.end}
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-gray-400 text-sm">Método de pagamento</p>
                  <p className="font-medium">{subscription?.method}</p>
                  <span className="px-3 py-1 text-xs bg-blue-600 rounded-full">
                    {subscription?.frequency}
                  </span>
                </div>
              </div>
            </section>

            {/* Last Payment */}
            <section className="bg-[#141414] p-6 rounded-lg shadow">
              <h3 className="text-md font-bold mb-4">Último pagamento</h3>
              <div className="flex justify-between text-sm">
                <p>{subscription?.lastPayment.date}</p>
                <p>{subscription?.lastPayment.method}</p>
                <p>{subscription?.lastPayment.amount}</p>
              </div>
            </section>
          </>
        )}

        {activeTab === "conta" && (
          <section className="bg-[#141414] p-6 rounded-lg shadow">
            <h3 className="text-md font-bold mb-4">Conta</h3>
            <form className="space-y-6" onSubmit={handleUpdateAccount}>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium mb-1">Nome completo</label>
                  <input
                    type="text"
                    name="name"
                    defaultValue={profile?.name}
                    className="w-full rounded-md bg-neutral-800 border border-neutral-700 px-3 py-2 text-white focus:outline-none focus:ring-2 focus:ring-blue-600"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium mb-1">Email</label>
                  <input
                    type="email"
                    name="email"
                    defaultValue={profile?.email}
                    className="w-full rounded-md bg-neutral-800 border border-neutral-700 px-3 py-2 text-white focus:outline-none focus:ring-2 focus:ring-blue-600"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium mb-1">Telefone</label>
                  <input
                    type="text"
                    name="phone"
                    placeholder="+258870000000"
                    defaultValue={profile?.phone || ""}
                    className="w-full rounded-md bg-neutral-800 border border-neutral-700 px-3 py-2 text-white focus:outline-none focus:ring-2 focus:ring-blue-600"
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={isUpdating}
                className="px-4 py-2 rounded-md bg-white text-black font-semibold hover:bg-neutral-200 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
              >
                {isUpdating && (
                  <div className="animate-spin rounded-full h-4 w-4 border-2 border-black border-t-transparent"></div>
                )}
                {isUpdating ? "Atualizando..." : "Atualizar Conta"}
              </button>
            </form>
          </section>
        )}

        {activeTab === "senha" && (
          <section className="bg-[#141414] p-6 rounded-lg shadow">
            <h3 className="text-md font-bold mb-4">Alterar Senha</h3>
            <p className="text-gray-400 text-sm mb-6">
              Para alterar sua senha, preencha os campos abaixo
            </p>
            <form className="space-y-6" onSubmit={handleChangePassword}>
              <div className="grid grid-cols-1 gap-4 max-w-md">
                <div>
                  <label className="block text-sm font-medium mb-1">Senha Atual</label>
                  <input
                    type="password"
                    value={currentPassword}
                    onChange={(e) => setCurrentPassword(e.target.value)}
                    className="w-full rounded-md bg-neutral-800 border border-neutral-700 px-3 py-2 text-white focus:outline-none focus:ring-2 focus:ring-blue-600"
                    placeholder="Digite sua senha atual"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium mb-1">Nova Senha</label>
                  <input
                    type="password"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    className="w-full rounded-md bg-neutral-800 border border-neutral-700 px-3 py-2 text-white focus:outline-none focus:ring-2 focus:ring-blue-600"
                    placeholder="Mínimo 6 caracteres"
                    minLength={6}
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium mb-1">Confirmar Nova Senha</label>
                  <input
                    type="password"
                    value={confirmNewPassword}
                    onChange={(e) => setConfirmNewPassword(e.target.value)}
                    className="w-full rounded-md bg-neutral-800 border border-neutral-700 px-3 py-2 text-white focus:outline-none focus:ring-2 focus:ring-blue-600"
                    placeholder="Confirme a nova senha"
                    minLength={6}
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={isUpdating}
                className="px-4 py-2 rounded-md bg-white text-black font-semibold hover:bg-neutral-200 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
              >
                {isUpdating && (
                  <div className="animate-spin rounded-full h-4 w-4 border-2 border-black border-t-transparent"></div>
                )}
                {isUpdating ? "Alterando..." : "Alterar Senha"}
              </button>
            </form>
          </section>
        )}
      </main>

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
