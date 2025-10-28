"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/supabaseClient";
import Image from "next/image";
import { usePathname } from "next/navigation";

interface LandingPage {
  id: string;
  title: string;
  page_url: string;
  association_type: 'oferta' | 'criativo' | null;
  oferta_id: string | null;
  criativo_id: string | null;
  created_at?: string;
  oferta?: {
    title: string;
  } | null;
  criativo?: {
    title: string;
  } | null;
}

export default function LandingPagesUserPage() {
  const [pages, setPages] = useState<LandingPage[]>([]);
  const [filterType, setFilterType] = useState<'all' | 'oferta' | 'criativo'>('all');
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState<any>(null);
  const [profile, setProfile] = useState<{ name?: string; email?: string; userId?: string } | null>(null);
  const [subscriptionStatus, setSubscriptionStatus] = useState<{
    isActive: boolean;
    isPaused: boolean;
    isExpired: boolean;
    message: string;
  } | null>(null);
  const router = useRouter();
  const pathname = usePathname();
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [filtersOpen, setFiltersOpen] = useState(false);

  function getInitials(name?: string) {
    if (!name) return "U";
    const parts = name.trim().split(/\s+/);
    if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  }

  // Handle page click - open in new tab
  const handlePageClick = (page: LandingPage) => {
    window.open(page.page_url, '_blank', 'noopener,noreferrer');
  };

  useEffect(() => {
    const checkAuthAndLoadPages = async () => {
      try {
        setLoading(true);

        const {
          data: { session },
          error: sessionError,
        } = await supabase.auth.getSession();

        if (sessionError) {
          console.error("Session error:", sessionError);
          router.push("/login");
          return;
        }

        if (!session?.user) {
          router.push("/login");
          return;
        }

        setUser(session.user);

        const userEmail = session.user.email?.trim().toLowerCase() || "";
        if (userEmail) {
          const { data: userRow, error: userRowError } = await supabase
            .from("users")
            .select("id, name, email, expires_at, paused")
            .eq("email", userEmail)
            .single();

          if (!userRowError && userRow) {
            setProfile({ 
              userId: userRow.id,
              name: userRow.name, 
              email: userRow.email 
            });

            const now = new Date();
            const expiresAt = userRow.expires_at ? new Date(userRow.expires_at) : null;
            const isPaused = userRow.paused || false;
            const isExpired = expiresAt ? expiresAt < now : true;
            const isActive = expiresAt && expiresAt > now && !isPaused;

            let message = '';
            if (isPaused) {
              message = 'Sua subscrição está pausada. Entre em contato com o suporte para reativar.';
            } else if (isExpired) {
              message = expiresAt 
                ? 'Sua subscrição expirou. Renove para continuar acessando o conteúdo.'
                : 'Você não possui uma subscrição ativa. Entre em contato com o suporte.';
            }

            setSubscriptionStatus({
              isActive: !!isActive,
              isPaused,
              isExpired,
              message
            });
          } else {
            setProfile({
              userId: session.user.id,
              name:
                session.user.user_metadata?.full_name ||
                session.user.user_metadata?.name ||
                session.user.email,
              email: session.user.email,
            });

            setSubscriptionStatus({
              isActive: false,
              isPaused: false,
              isExpired: true,
              message: 'Você não possui uma subscrição ativa. Entre em contato com o suporte.'
            });
          }
        } else {
          setProfile({
            userId: session.user.id,
            name:
              session.user.user_metadata?.full_name ||
              session.user.user_metadata?.name ||
              session.user.email,
            email: session.user.email,
          });

          setSubscriptionStatus({
            isActive: false,
            isPaused: false,
            isExpired: true,
            message: 'Você não possui uma subscrição ativa. Entre em contato com o suporte.'
          });
        }

        const { data: pagesData, error: pagesError } = await supabase
          .from("landing_pages")
          .select(`
            *,
            oferta:contents!landing_pages_oferta_id_fkey (title),
            criativo:criativos!landing_pages_criativo_id_fkey (title)
          `)
          .order("created_at", { ascending: false });

        if (pagesError) {
          console.error("Error fetching pages:", pagesError);
          setPages([]);
        } else {
          setPages(pagesData || []);
        }

        setLoading(false);
      } catch (err) {
        console.error("Error loading pages:", err);
        setPages([]);
        setLoading(false);
      }
    };

    checkAuthAndLoadPages();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === "SIGNED_OUT" || !session) {
        router.push("/login");
      }
    });

    return () => subscription.unsubscribe();
  }, [router]);

  const handleLogout = async () => {
    try {
      const { error } = await supabase.auth.signOut();
      if (error) console.error("Logout error:", error);
    } catch (e) {
      console.error("Logout error:", e);
    } finally {
      router.push("/login");
    }
  };

  useEffect(() => {
    function handleResize() {
      const w = window.innerWidth;
      if (w < 1024) {
        setSidebarCollapsed(true);
      } else {
        setSidebarCollapsed(false);
      }
    }
    handleResize();
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  // Filtros únicos
  const uniqueTypes = [
    { value: 'all', label: 'Todas' },
    { value: 'oferta', label: 'Ofertas' },
    { value: 'criativo', label: 'Criativos' }
  ];

  const clearAllFilters = () => {
    setFilterType('all');
    setFiltersOpen(false);
  };

  const hasActiveFilters = filterType !== 'all';

  const filteredPages = pages.filter((p) => {
    const matchesType = 
      filterType === 'all' ? true :
      filterType === 'oferta' ? p.association_type === 'oferta' :
      filterType === 'criativo' ? p.association_type === 'criativo' : true;
    
    const matchesSearch = 
      p.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
      p.oferta?.title?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      p.criativo?.title?.toLowerCase().includes(searchTerm.toLowerCase());
    
    return matchesType && matchesSearch;
  });

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
    <div className="flex min-h-screen bg-[#0f0f0f] text-white">
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
                  <Image
                    src="/icons/usuario.svg"
                    alt="Usuario"
                    width={22}
                    height={20}
                  />
                </div>
                <div>
                  <p className="text-sm font-medium truncate">
                    {profile.name || "Usuário"}
                  </p>
                </div>
              </div>
            )}

            <button
              onClick={() => router.push("/usuarios")}
              className="flex items-center gap-2 px-7 py-2 rounded-lg text-sm text-white font-bold text-left active:bg-blue-700 hover:bg-[#1f1f1f]"
            >
              <Image
                src="/icons/dashboard.svg"
                alt="Dashboard"
                width={22}
                height={20}
              />
              Dashboard
            </button>

            <div className="mt-4">
              <p className="text-xs px-3 text-gray-400 mb-2 font-bold">Geral</p>
              <div className="flex flex-col gap-1 ml-6">
                <button
                  onClick={() => router.push("/ofertas")}
                  className="flex items-center gap-2 px-2 py-2 rounded-lg text-sm text-white font-bold text-left hover:bg-[#1f1f1f]"
                >
                  <Image src="/icons/ofertas.svg" alt="Ofertas" width={22} height={22} />
                  Ofertas
                </button>
                <button
                  onClick={() => router.push("/criativos")}
                  className="flex items-center gap-2 px-2 py-2 rounded-lg text-sm text-white font-bold text-left hover:bg-[#1f1f1f]"
                >
                  <Image
                    src="/icons/criativos.svg"
                    alt="Criativos"
                    width={22}
                    height={18}
                  />
                  Criativos
                </button>
                <button
                  onClick={() => router.push("/paginas")}
                  className={`flex items-center gap-2 px-2 py-2 rounded-lg text-sm font-bold text-left transition-colors
                    ${pathname === "/paginas" ? "bg-[#1f1f1f] text-white" : "text-gray-300 hover:bg-[#1f1f1f] hover:text-white"}
                  `}
                >
                  <span className="text-lg">🔗</span>
                  Páginas
                </button>
              </div>
            </div>

            <div className="mt-4">
              <p className="text-xs px-3 text-gray-400 mb-2 font-bold">Suporte</p>
              <div className="flex flex-col gap-1 ml-6">
                <button
                  onClick={() => router.push("/configuracoes")}
                  className="flex items-center gap-2 px-2 py-2 rounded-lg text-sm text-white font-bold text-left hover:bg-[#1f1f1f]"
                >
                  <Image
                    src="/icons/configuracoes.svg"
                    alt="configuracoes"
                    width={22}
                    height={18}
                  />
                  Configurações
                </button>
                <button
                  onClick={() => router.push("/suporte")}
                  className="flex items-center gap-2 px-2 py-2 rounded-lg text-sm text-white font-bold text-left hover:bg-[#1f1f1f]"
                >
                  <Image
                    src="/icons/suporte.svg"
                    alt="suporte"
                    width={22}
                    height={18}
                  />
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
              sidebarCollapsed
                ? "w-10 h-10 flex items-center justify-center text-lg"
                : "w-full"
            }`}
            title={sidebarCollapsed ? "Sair" : ""}
          >
            {sidebarCollapsed ? "🚪" : "Sair"}
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 px-8 pb-8 overflow-auto min-w-0">
        {subscriptionStatus && !subscriptionStatus.isActive && (
          <div className="mb-6 mt-12 p-6 bg-red-900/20 border border-red-600/50 rounded-lg">
            <div className="flex items-center gap-3 mb-2">
              <span className="text-3xl">⚠️</span>
              <h3 className="text-xl font-bold text-red-400">Acesso Restrito</h3>
            </div>
            <p className="text-gray-300 mb-4">{subscriptionStatus.message}</p>
            <div className="flex gap-3">
              <button
                onClick={() => router.push("/configuracoes")}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded-lg transition"
              >
                Ver Configurações
              </button>
              <button
                onClick={() => router.push("/suporte")}
                className="px-4 py-2 bg-gray-700 hover:bg-gray-600 rounded-lg transition"
              >
                Contatar Suporte
              </button>
            </div>
          </div>
        )}

        {subscriptionStatus?.isActive ? (
          <>
            <div className="mb-8 mt-4">
              <div className="flex items-center gap-2 mb-2">
                <span className="text-lg">🔗</span>
                <h2 className="text-lg font-bold">Páginas de Anúncios</h2>
              </div>
              <hr className="border-gray-700" />
            </div>

            {/* Top Bar with Filters + Search */}
            <div className="flex items-center justify-between mb-6 relative">
              <div className="relative">
                <button
                  onClick={() => setFiltersOpen((o) => !o)}
                  className="flex items-center gap-2 px-4 py-2 bg-gray-800 hover:bg-gray-700 rounded-lg transition"
                >
                  <Image
                    src="/icons/filtros.svg"
                    alt="Filtros"
                    width={22}
                    height={18}
                  />
                  Filtros
                </button>

                {filtersOpen && (
                  <div className="absolute mt-2 bg-[#141414] border border-gray-700 rounded-lg shadow-lg p-3 z-20 w-48">
                    <button
                      onClick={clearAllFilters}
                      className={`block w-full text-left px-3 py-2 rounded mb-1 ${
                        !hasActiveFilters
                          ? "bg-blue-600 text-white"
                          : "hover:bg-gray-800"
                      }`}
                    >
                      Todas
                    </button>
                    
                    {uniqueTypes.slice(1).map((type) => (
                      <button
                        key={type.value}
                        onClick={() => {
                          setFilterType(type.value as any);
                          setFiltersOpen(false);
                        }}
                        className={`block w-full text-left px-3 py-2 rounded ${
                          filterType === type.value
                            ? "bg-blue-600 text-white"
                            : "hover:bg-gray-800"
                        }`}
                      >
                        {type.label}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              <div className="flex items-center gap-4">
                <input
                  type="text"
                  placeholder="Pesquisar..."
                  className="w-68 px-3 py-2 rounded-lg bg-gray-800 text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
              </div>
            </div>

            {/* Content Grid */}
            {filteredPages.length === 0 ? (
              <div className="text-center py-12">
                <div className="text-6xl mb-4">🔗</div>
                <p className="text-gray-400 text-lg mb-2">
                  {hasActiveFilters || searchTerm
                    ? "Nenhuma página encontrada com esses filtros"
                    : "Nenhuma página disponível"}
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
                {filteredPages.map((page) => (
                  <div
                    key={page.id}
                    className="bg-[#141414] shadow rounded-lg overflow-hidden relative group min-w-0 hover:shadow-lg transition-shadow cursor-pointer"
                    onClick={() => handlePageClick(page)}
                  >
                    <div className="relative h-40 bg-gradient-to-br from-gray-800 to-gray-900 flex items-center justify-center">
                      <div className="text-6xl opacity-20">🔗</div>
                      <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />
                      <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity">
                        
                      </div>
                    </div>
                    
                    <div className="p-4">
                      <h3 className="font-semibold text-white mb-2 line-clamp-2 group-hover:text-blue-300 transition-colors">
                        {page.title}
                      </h3>
                      
                      {/* Nome da oferta/criativo destacado em verde */}
                      <div className="mb-2">
                        <span className="inline-block px-3 py-1.5 bg-green-700/30 text-green-300 rounded-lg text-sm font-semibold">
                          {page.association_type === 'oferta' 
                            ? page.oferta?.title 
                            : page.criativo?.title}
                        </span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </>
        ) : null}
      </main>
    </div>
  );
}
