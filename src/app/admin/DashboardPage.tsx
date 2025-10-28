"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/supabaseClient";

interface DashboardStats {
  totalUsers: number;
  activeSubscriptions: number;
  expiredSubscriptions: number;
  pausedSubscriptions: number;
}

interface UserLoginData {
  user_id: string;
  user_name: string;
  user_email: string;
  last_login: string;
  expires_at: string | null;
  paused: boolean;
}

interface ContentAccessData {
  content_id: string;
  title: string;
  thumbnail: string;
  access_count: number;
  last_accessed: string;
  categories: string[];
}

export default function DashboardPage() {
  const [stats, setStats] = useState<DashboardStats>({
    totalUsers: 0,
    activeSubscriptions: 0,
    expiredSubscriptions: 0,
    pausedSubscriptions: 0,
  });
  const [userLogins, setUserLogins] = useState<UserLoginData[]>([]);
  const [contentAccess, setContentAccess] = useState<ContentAccessData[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeView, setActiveView] = useState<"overview" | "users" | "content">("overview");

  useEffect(() => {
    fetchDashboardData();
  }, []);

  const fetchDashboardData = async () => {
    try {
      setLoading(true);

      // Fetch user statistics
      const { data: users, error: usersError } = await supabase
        .from("users")
        .select("id, name, email, expires_at, paused, created_at");

      if (usersError) throw usersError;

      // Calculate subscription stats
      const now = new Date();
      let active = 0;
      let expired = 0;
      let paused = 0;

      users?.forEach((user) => {
        if (user.paused) {
          paused++;
        } else if (user.expires_at && new Date(user.expires_at) > now) {
          active++;
        } else {
          expired++;
        }
      });

      setStats({
        totalUsers: users?.length || 0,
        activeSubscriptions: active,
        expiredSubscriptions: expired,
        pausedSubscriptions: paused,
      });

      // Fetch last login for each user
      const { data: logins, error: loginsError } = await supabase
        .from("user_logins")
        .select(`
          user_id,
          logged_in_at,
          users (
            name,
            email,
            expires_at,
            paused
          )
        `)
        .order("logged_in_at", { ascending: false });

      if (!loginsError && logins) {
        // Get unique users with their last login
        const userLoginMap = new Map<string, UserLoginData>();
        
        logins.forEach((login: any) => {
          if (!userLoginMap.has(login.user_id)) {
            userLoginMap.set(login.user_id, {
              user_id: login.user_id,
              user_name: login.users?.name || "N/A",
              user_email: login.users?.email || "N/A",
              last_login: login.logged_in_at,
              expires_at: login.users?.expires_at || null,
              paused: login.users?.paused || false,
            });
          }
        });

        setUserLogins(Array.from(userLoginMap.values()));
      }

      // Fetch content access statistics
      const { data: accessData, error: accessError } = await supabase
        .from("content_access")
        .select(`
          content_id,
          accessed_at,
          contents (
            title,
            thumbnail,
            categories
          )
        `);

      if (!accessError && accessData) {
        // Aggregate access data by content
        const contentMap = new Map<string, ContentAccessData>();

        accessData.forEach((access: any) => {
          const existing = contentMap.get(access.content_id);
          
          if (existing) {
            existing.access_count++;
            if (new Date(access.accessed_at) > new Date(existing.last_accessed)) {
              existing.last_accessed = access.accessed_at;
            }
          } else {
            contentMap.set(access.content_id, {
              content_id: access.content_id,
              title: access.contents?.title || "N/A",
              thumbnail: access.contents?.thumbnail || "",
              access_count: 1,
              last_accessed: access.accessed_at,
              categories: access.contents?.categories || [],
            });
          }
        });

        const sortedContent = Array.from(contentMap.values()).sort(
          (a, b) => b.access_count - a.access_count
        );

        setContentAccess(sortedContent);
      }

      setLoading(false);
    } catch (error) {
      console.error("Error fetching dashboard data:", error);
      setLoading(false);
    }
  };

  const getSubscriptionStatusColor = (
    expiresAt: string | null,
    paused: boolean
  ): string => {
    if (paused) return "text-yellow-400";
    if (!expiresAt) return "text-red-500";
    return new Date(expiresAt) > new Date() ? "text-green-500" : "text-red-500";
  };

  const getSubscriptionStatusLabel = (
    expiresAt: string | null,
    paused: boolean
  ): string => {
    if (paused) return "Pausado";
    if (!expiresAt) return "Sem Assinatura";
    return new Date(expiresAt) > new Date() ? "Ativo" : "Expirado";
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleString("pt-PT", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const formatRelativeTime = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return "Agora mesmo";
    if (diffMins < 60) return `${diffMins} min atrás`;
    if (diffHours < 24) return `${diffHours}h atrás`;
    if (diffDays < 7) return `${diffDays}d atrás`;
    return formatDate(dateString);
  };

  if (loading) {
    return (
      <div className="flex min-h-screen bg-[#0f0f0f] text-white items-center justify-center">
        <div className="flex items-center gap-3">
          <div className="animate-spin rounded-full h-8 w-8 border-2 border-blue-600 border-t-transparent"></div>
          <span>Carregando dashboard...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 bg-[#0f0f0f] text-white min-h-screen">
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-2">Dashboard de Análise</h1>
        <p className="text-gray-400">Estatísticas e análises do sistema</p>
      </div>

      {/* Navigation Tabs */}
      <div className="flex gap-2 mb-6 border-b border-gray-700">
        <button
          onClick={() => setActiveView("overview")}
          className={`px-4 py-2 text-sm font-medium ${
            activeView === "overview"
              ? "border-b-2 border-blue-600 text-white"
              : "text-gray-400 hover:text-white"
          }`}
        >
          Visão Geral
        </button>
        <button
          onClick={() => setActiveView("users")}
          className={`px-4 py-2 text-sm font-medium ${
            activeView === "users"
              ? "border-b-2 border-blue-600 text-white"
              : "text-gray-400 hover:text-white"
          }`}
        >
          Usuários
        </button>
        <button
          onClick={() => setActiveView("content")}
          className={`px-4 py-2 text-sm font-medium ${
            activeView === "content"
              ? "border-b-2 border-blue-600 text-white"
              : "text-gray-400 hover:text-white"
          }`}
        >
          Conteúdos
        </button>
      </div>

      {/* Overview Tab */}
      {activeView === "overview" && (
        <>
          {/* Stats Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
            <div className="bg-[#141414] p-6 rounded-lg shadow">
              <div className="flex items-center justify-between mb-2">
                <h3 className="text-gray-400 text-sm">Total de Usuários</h3>
                <span className="text-2xl">👥</span>
              </div>
              <p className="text-3xl font-bold">{stats.totalUsers}</p>
            </div>

            <div className="bg-[#141414] p-6 rounded-lg shadow">
              <div className="flex items-center justify-between mb-2">
                <h3 className="text-gray-400 text-sm">Assinaturas Ativas</h3>
                <span className="text-2xl">✅</span>
              </div>
              <p className="text-3xl font-bold text-green-500">
                {stats.activeSubscriptions}
              </p>
            </div>

            <div className="bg-[#141414] p-6 rounded-lg shadow">
              <div className="flex items-center justify-between mb-2">
                <h3 className="text-gray-400 text-sm">Assinaturas Expiradas</h3>
                <span className="text-2xl">❌</span>
              </div>
              <p className="text-3xl font-bold text-red-500">
                {stats.expiredSubscriptions}
              </p>
            </div>

            <div className="bg-[#141414] p-6 rounded-lg shadow">
              <div className="flex items-center justify-between mb-2">
                <h3 className="text-gray-400 text-sm">Assinaturas Pausadas</h3>
                <span className="text-2xl">⏸️</span>
              </div>
              <p className="text-3xl font-bold text-yellow-400">
                {stats.pausedSubscriptions}
              </p>
            </div>
          </div>

          {/* Quick Stats */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Most Accessed Content */}
            <div className="bg-[#141414] p-6 rounded-lg shadow">
              <h3 className="text-lg font-bold mb-4">Top 5 Conteúdos Mais Acessados</h3>
              {contentAccess.slice(0, 5).length > 0 ? (
                <div className="space-y-3">
                  {contentAccess.slice(0, 5).map((content) => (
                    <div
                      key={content.content_id}
                      className="flex items-center justify-between p-3 bg-[#1f1f1f] rounded-lg"
                    >
                      <div className="flex items-center gap-3 flex-1 min-w-0">
                        <img
                          src={content.thumbnail}
                          alt={content.title}
                          className="w-12 h-12 object-cover rounded"
                        />
                        <div className="min-w-0 flex-1">
                          <p className="font-medium truncate">{content.title}</p>
                          <p className="text-xs text-gray-400">
                            Último acesso: {formatRelativeTime(content.last_accessed)}
                          </p>
                        </div>
                      </div>
                      <div className="text-right ml-4">
                        <p className="text-2xl font-bold text-blue-500">
                          {content.access_count}
                        </p>
                        <p className="text-xs text-gray-400">acessos</p>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-gray-400 text-center py-8">
                  Nenhum acesso registrado ainda
                </p>
              )}
            </div>

            {/* Recent User Activity */}
            <div className="bg-[#141414] p-6 rounded-lg shadow">
              <h3 className="text-lg font-bold mb-4">Atividade Recente de Usuários</h3>
              {userLogins.slice(0, 5).length > 0 ? (
                <div className="space-y-3">
                  {userLogins.slice(0, 5).map((login) => (
                    <div
                      key={login.user_id}
                      className="flex items-center justify-between p-3 bg-[#1f1f1f] rounded-lg"
                    >
                      <div className="flex-1 min-w-0">
                        <p className="font-medium truncate">{login.user_name}</p>
                        <p className="text-xs text-gray-400 truncate">
                          {login.user_email}
                        </p>
                      </div>
                      <div className="text-right ml-4">
                        <p className="text-sm text-gray-300">
                          {formatRelativeTime(login.last_login)}
                        </p>
                        <p
                          className={`text-xs ${getSubscriptionStatusColor(
                            login.expires_at,
                            login.paused
                          )}`}
                        >
                          {getSubscriptionStatusLabel(login.expires_at, login.paused)}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-gray-400 text-center py-8">
                  Nenhum login registrado ainda
                </p>
              )}
            </div>
          </div>
        </>
      )}

      {/* Users Tab */}
      {activeView === "users" && (
        <div className="bg-[#141414] p-6 rounded-lg shadow">
          <h3 className="text-lg font-bold mb-4">Histórico de Logins dos Usuários</h3>
          {userLogins.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-gray-700">
                    <th className="text-left py-3 px-4 text-sm font-medium text-gray-400">
                      Nome
                    </th>
                    <th className="text-left py-3 px-4 text-sm font-medium text-gray-400">
                      Email
                    </th>
                    <th className="text-left py-3 px-4 text-sm font-medium text-gray-400">
                      Último Login
                    </th>
                    <th className="text-left py-3 px-4 text-sm font-medium text-gray-400">
                      Status
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {userLogins.map((login) => (
                    <tr
                      key={login.user_id}
                      className="border-b border-gray-800 hover:bg-[#1f1f1f]"
                    >
                      <td className="py-3 px-4">{login.user_name}</td>
                      <td className="py-3 px-4 text-gray-400">{login.user_email}</td>
                      <td className="py-3 px-4 text-gray-400">
                        {formatDate(login.last_login)}
                      </td>
                      <td className="py-3 px-4">
                        <span
                          className={getSubscriptionStatusColor(
                            login.expires_at,
                            login.paused
                          )}
                        >
                          {getSubscriptionStatusLabel(login.expires_at, login.paused)}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="text-gray-400 text-center py-8">
              Nenhum login registrado ainda
            </p>
          )}
        </div>
      )}

      {/* Content Tab */}
      {activeView === "content" && (
        <div className="bg-[#141414] p-6 rounded-lg shadow">
          <h3 className="text-lg font-bold mb-4">Estatísticas de Acesso aos Conteúdos</h3>
          {contentAccess.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {contentAccess.map((content) => (
                <div
                  key={content.content_id}
                  className="bg-[#1f1f1f] p-4 rounded-lg hover:bg-[#252525] transition"
                >
                  <img
                    src={content.thumbnail}
                    alt={content.title}
                    className="w-full h-40 object-cover rounded mb-3"
                  />
                  <h4 className="font-medium mb-2 line-clamp-2">{content.title}</h4>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm text-gray-400">Total de acessos:</span>
                    <span className="text-xl font-bold text-blue-500">
                      {content.access_count}
                    </span>
                  </div>
                  <p className="text-xs text-gray-400">
                    Último acesso: {formatDate(content.last_accessed)}
                  </p>
                  {content.categories.length > 0 && (
                    <div className="flex flex-wrap gap-1 mt-2">
                      {content.categories.map((cat, idx) => (
                        <span
                          key={idx}
                          className="px-2 py-1 bg-blue-600/20 text-blue-200 rounded text-xs"
                        >
                          {cat}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <p className="text-gray-400 text-center py-8">
              Nenhum acesso aos conteúdos registrado ainda
            </p>
          )}
        </div>
      )}
    </div>
  );
}