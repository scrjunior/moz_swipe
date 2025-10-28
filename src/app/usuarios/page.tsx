"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/supabaseClient";
import Image from "next/image";
import { usePathname } from "next/navigation";

interface Content {
  id: string;
  title: string;
  thumbnail: string;
  drive_link: string;
  tipo?: string | null;
  estrutura?: string | null;
  idioma?: string | null;
  nicho?: string | null;
  trafego?: string | null;
  created_at?: string;
}

export default function UserPage() {
  const [contents, setContents] = useState<Content[]>([]);
  const [filterTipo, setFilterTipo] = useState<string | null>(null);
  const [filterIdioma, setFilterIdioma] = useState<string | null>(null);
  const [filterNicho, setFilterNicho] = useState<string | null>(null);
  const [filterTrafego, setFilterTrafego] = useState<string | null>(null);
  const [filterEstrutura, setFilterEstrutura] = useState<string | null>(null);
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

  const colorClasses = [
    "bg-blue-600/20 text-blue-200",
    "bg-green-600/20 text-green-200",
    "bg-red-600/20 text-red-200",
    "bg-purple-600/20 text-purple-200",
    "bg-yellow-600/20 text-yellow-200",
    "bg-pink-600/20 text-pink-200",
  ];

  function hashString(str: string) {
    if (!str) return 0;
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      hash = str.charCodeAt(i) + ((hash << 5) - hash);
    }
    return Math.abs(hash);
  }

  function getInitials(name?: string) {
    if (!name) return "U";
    const parts = name.trim().split(/\s+/);
    if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  }

  const getOptimizedImageUrl = (
    originalUrl: string,
    transformation = "w_400,h_250,c_fill,q_auto,f_auto"
  ) => {
    if (!originalUrl?.includes("cloudinary.com")) return originalUrl || "";
    const parts = originalUrl.split("/upload/");
    if (parts.length === 2) {
      return `${parts[0]}/upload/${transformation}/${parts[1]}`;
    }
    return originalUrl;
  };

  // Track content access
  const trackContentAccess = async (userId: string, contentId: string) => {
    try {
      await supabase
        .from('content_access')
        .insert({ 
          user_id: userId, 
          content_id: contentId 
        });
    } catch (error) {
      console.error('Error tracking content access:', error);
      // Don't block navigation if tracking fails
    }
  };

  // Navigate to content detail page and track access
  const handleContentClick = async (content: Content) => {
    // Track the content access if we have user info
    if (profile?.userId) {
      await trackContentAccess(profile.userId, content.id);
    }
    
    // Navigate to a dedicated content page with the content ID
    router.push(`/content/${content.id}`);
  };

  useEffect(() => {
    const checkAuthAndLoadContents = async () => {
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

        // Try to load profile row from your users table
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

            // Verificar status da subscrição
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
            // fallback: try metadata name or email
            setProfile({
              userId: session.user.id, // Use auth user id as fallback
              name:
                session.user.user_metadata?.full_name ||
                session.user.user_metadata?.name ||
                session.user.email,
              email: session.user.email,
            });

            // Sem dados na tabela users, considerar sem subscrição
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

          // Sem email, considerar sem subscrição
          setSubscriptionStatus({
            isActive: false,
            isPaused: false,
            isExpired: true,
            message: 'Você não possui uma subscrição ativa. Entre em contato com o suporte.'
          });
        }

        const { data: contentsData, error: contentsError } = await supabase
          .from("contents")
          .select("*")
          .order("created_at", { ascending: false });

        if (contentsError) {
          console.error("Error fetching contents:", contentsError);
          setContents([]);
        } else {
          const transformedData: Content[] = contentsData.map((item) => ({
            id: item.id,
            title: item.title,
            thumbnail: item.thumbnail,
            drive_link: item.drive_link,
            tipo: item.tipo,
            estrutura: item.estrutura,
            idioma: item.idioma,
            nicho: item.nicho,
            trafego: item.trafego,
            created_at: item.created_at,
          }));

          setContents(transformedData);
        }

        setLoading(false);
      } catch (err) {
        console.error("Error loading contents:", err);
        setContents([]);
        setLoading(false);
      }
    };

    checkAuthAndLoadContents();

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

  // Valores únicos para filtros
  const uniqueTipos = Array.from(
    new Set(contents.map((c) => c.tipo).filter(Boolean))
  );
  
  const uniqueIdiomas = Array.from(
    new Set(contents.map((c) => c.idioma).filter(Boolean))
  );
  
  const uniqueNichos = Array.from(
    new Set(contents.map((c) => c.nicho).filter(Boolean))
  );
  
  const uniqueTrafegos = Array.from(
    new Set(contents.map((c) => c.trafego).filter(Boolean))
  );

  const uniqueEstruturas = Array.from(
    new Set(contents.map((c) => c.estrutura).filter(Boolean))
  );

  // Criar lista única misturada de todos os filtros
  interface FilterItem {
    value: string;
    type: 'tipo' | 'idioma' | 'nicho' | 'trafego' | 'estrutura';
  }

  const allFilters: FilterItem[] = [
    ...uniqueTipos.map(v => ({ value: v, type: 'tipo' as const })),
    ...uniqueIdiomas.map(v => ({ value: v, type: 'idioma' as const })),
    ...uniqueNichos.map(v => ({ value: v, type: 'nicho' as const })),
    ...uniqueTrafegos.map(v => ({ value: v, type: 'trafego' as const })),
    ...uniqueEstruturas.map(v => ({ value: v, type: 'estrutura' as const }))
  ];

  // Função para lidar com clique no filtro
  const handleFilterClick = (item: FilterItem) => {
    switch (item.type) {
      case 'tipo':
        setFilterTipo(filterTipo === item.value ? null : item.value);
        break;
      case 'idioma':
        setFilterIdioma(filterIdioma === item.value ? null : item.value);
        break;
      case 'nicho':
        setFilterNicho(filterNicho === item.value ? null : item.value);
        break;
      case 'trafego':
        setFilterTrafego(filterTrafego === item.value ? null : item.value);
        break;
      case 'estrutura':
        setFilterEstrutura(filterEstrutura === item.value ? null : item.value);
        break;
    }
    setFiltersOpen(false);
  };

  // Verificar se um filtro está ativo
  const isFilterActive = (item: FilterItem): boolean => {
    switch (item.type) {
      case 'tipo':
        return filterTipo === item.value;
      case 'idioma':
        return filterIdioma === item.value;
      case 'nicho':
        return filterNicho === item.value;
      case 'trafego':
        return filterTrafego === item.value;
      case 'estrutura':
        return filterEstrutura === item.value;
      default:
        return false;
    }
  };

  // Limpar todos os filtros
  const clearAllFilters = () => {
    setFilterTipo(null);
    setFilterIdioma(null);
    setFilterNicho(null);
    setFilterTrafego(null);
    setFilterEstrutura(null);
    setFiltersOpen(false);
  };

  const hasActiveFilters = filterTipo || filterIdioma || filterNicho || filterTrafego || filterEstrutura;

  // Filtrar conteúdos
  const filteredContents = contents.filter((c) => {
    const matchesFilter = 
      (!filterTipo || c.tipo === filterTipo) &&
      (!filterIdioma || c.idioma === filterIdioma) &&
      (!filterNicho || c.nicho === filterNicho) &&
      (!filterTrafego || c.trafego === filterTrafego) &&
      (!filterEstrutura || c.estrutura === filterEstrutura);
    
    const matchesSearch = c.title
      .toLowerCase()
      .includes(searchTerm.toLowerCase());
    
    return matchesFilter && matchesSearch;
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
            {/* Branding */}
            <h1 className="text-xl font-bold mb-6 ml-4">MOZ SWIPE</h1>

            {/* User Info */}
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

            {/* Dashboard Link */}
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

            {/* Geral Section */}
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
                  className="flex items-center gap-2 px-2 py-2 rounded-lg text-sm text-white font-bold text-left hover:bg-[#1f1f1f]"
                >
                  <Image
                    src="/icons/paginas.svg"
                    alt="Paginas"
                    width={22}
                    height={18}
                  />
                  Páginas
                </button>
              </div>

              
            </div>

            {/* Suporte Section */}
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
        {/* Subscription Status Warning */}
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

        {/* Only show content if subscription is active */}
        {subscriptionStatus?.isActive ? (
          <>
            {/* Banner Section */}
            <div className="-mx-8 mb-8">
              <img
                src="https://cdn.shopify.com/s/files/1/0070/7032/articles/What_20is_20money_1848x970_6c6d2d91-8bea-45d7-9a93-3456cf2d8db3.png?v=1729517013"
                alt="Banner"
                className="w-full h-48 object-cover"
              />
            </div>

            {/* Top Bar with Filters + Search */}
            <div className="flex items-center justify-between mb-6 relative">
              {/* Filtros Button */}
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
                  <div className="absolute mt-2 bg-[#141414] border border-gray-700 rounded-lg shadow-lg p-3 z-20 w-48 max-h-96 overflow-y-auto">
                    {/* Botão Todos */}
                    <button
                      onClick={clearAllFilters}
                      className={`block w-full text-left px-3 py-2 rounded mb-1 ${
                        !hasActiveFilters
                          ? "bg-blue-600 text-white"
                          : "hover:bg-gray-800"
                      }`}
                    >
                      Todos
                    </button>
                    
                    {/* Lista única misturada de todos os filtros */}
                    {allFilters.map((item, idx) => (
                      <button
                        key={`${item.type}-${item.value}-${idx}`}
                        onClick={() => handleFilterClick(item)}
                        className={`block w-full text-left px-3 py-2 rounded ${
                          isFilterActive(item)
                            ? "bg-blue-600 text-white"
                            : "hover:bg-gray-800"
                        }`}
                      >
                        {item.value}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* Search */}
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
            {filteredContents.length === 0 ? (
              <div className="text-center py-12">
                <div className="text-6xl mb-4">📦</div>
                <p className="text-gray-400 text-lg mb-2">
                  {hasActiveFilters
                    ? "Nenhuma oferta encontrada com esses filtros"
                    : "Nenhuma oferta disponível"}
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
                {filteredContents.map((content) => (
                  <div
                    key={content.id}
                    className="bg-[#141414] shadow rounded-lg overflow-hidden relative group min-w-0 hover:shadow-lg transition-shadow cursor-pointer"
                    onClick={() => handleContentClick(content)}
                  >
                    <div className="relative">
                      <img
                        src={getOptimizedImageUrl(content.thumbnail)}
                        alt={content.title}
                        className="w-full h-40 object-cover"
                        loading="lazy"
                      />
                      <div className="absolute inset-0 bg-gradient-to-t from-black/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
                      <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity">
                        <div className="bg-blue-500 text-white text-xs px-2 py-1 rounded-full flex items-center gap-1">
                          <span>👁</span>
                          <span>Ver</span>
                        </div>
                      </div>
                    </div>
                    <div className="p-4">
                      <h3 className="font-semibold text-white mb-2 line-clamp-2 group-hover:text-blue-300 transition-colors">
                        {content.title}
                      </h3>
                      <div className="flex flex-wrap gap-2">
                        {content.tipo && (
                          <span className="px-2 py-1 bg-blue-600/20 text-blue-200 font-bold rounded-lg text-xs">
                            {content.tipo}
                          </span>
                        )}
                        {content.idioma && (
                          <span className="px-2 py-1 bg-purple-600/20 text-purple-200 font-bold rounded-lg text-xs">
                            {content.idioma}
                          </span>
                        )}
                        {content.nicho && (
                          <span className="px-2 py-1 bg-yellow-600/20 text-yellow-200 font-bold rounded-lg text-xs">
                            {content.nicho}
                          </span>
                        )}
                        {content.trafego && (
                          <span className="px-2 py-1 bg-pink-600/20 text-pink-200 font-bold rounded-lg text-xs">
                            {content.trafego}
                          </span>
                        )}
                        {content.estrutura && (
                          <span className="px-2 py-1 bg-green-600/20 text-green-200 font-bold rounded-lg text-xs">
                            {content.estrutura}
                          </span>
                        )}
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
