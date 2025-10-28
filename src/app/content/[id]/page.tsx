"use client";

import { useEffect, useState } from "react";
import { useRouter, useParams } from "next/navigation";
import { supabase } from "@/supabaseClient";
import Image from "next/image";

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
  description?: string;
}

interface Criativo {
  id: string;
  oferta_id: string;
  title: string;
  drive_link: string;
  created_at?: string;
  oferta?: {
    id: string;
    title: string;
    thumbnail: string;
    tipo?: string | null;
    estrutura?: string | null;
    idioma?: string | null;
    nicho?: string | null;
    trafego?: string | null;
  };
}

interface LandingPage {
  id: string;
  title: string;
  page_url: string;
  association_type: 'oferta' | 'criativo' | null;
}

export default function ContentDetailPage() {
  const [content, setContent] = useState<Content | null>(null);
  const [relatedCriativos, setRelatedCriativos] = useState<Criativo[]>([]);
  const [relatedPages, setRelatedPages] = useState<LandingPage[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [user, setUser] = useState<any>(null);
  const [profile, setProfile] = useState<{ name?: string; email?: string } | null>(null);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [downloadProgress, setDownloadProgress] = useState<number | null>(null);
  const [downloadStatus, setDownloadStatus] = useState<string>("");

  const router = useRouter();
  const params = useParams();

  // Verifica se é link do Google Drive
  const isGoogleDriveVideo = (link: string) =>
    !!link && link.includes("drive.google.com/file");

  // Extrai ID do ficheiro
  const extractFileId = (link: string): string | null => {
    const match = link.match(/\/d\/([^/]+)/);
    return match ? match[1] : null;
  };

  // URL de preview iframe
  const getPreviewUrl = (link: string): string | null => {
    const fileId = extractFileId(link);
    if (fileId) {
      return `https://drive.google.com/file/d/${fileId}/preview`;
    }
    return null;
  };

  // Get file extension from content title or drive link
  const getFileExtension = (title: string, driveLink: string): string => {
    const titleMatch = title.match(/\.([^.]+)$/);
    if (titleMatch) {
      return titleMatch[1].toLowerCase();
    }
    return 'mp4';
  };

  // Get optimized image URL
  const getOptimizedImageUrl = (url: string) => {
    if (url.includes('drive.google.com')) {
      const fileId = url.match(/\/d\/([^/]+)/)?.[1] || url.match(/id=([^&]+)/)?.[1];
      if (fileId) {
        return `https://drive.google.com/thumbnail?id=${fileId}&sz=w400-h300`;
      }
    }
    return url;
  };

  // Handle criativo click
  const handleCriativoClick = (clickedCriativo: Criativo) => {
    router.push(`/criativo/${clickedCriativo.id}`);
  };

  // Handle page click - open in new tab
  const handlePageClick = (page: LandingPage) => {
    window.open(page.page_url, '_blank', 'noopener,noreferrer');
  };

  // Enhanced download function
  const handleDownload = async () => {
    if (!content) return;

    if (isGoogleDriveVideo(content.drive_link)) {
      const fileId = extractFileId(content.drive_link);
      if (!fileId) {
        setDownloadStatus("Erro: ID do arquivo não encontrado");
        return;
      }

      setDownloadProgress(0);
      setDownloadStatus("Iniciando download...");

      try {
        const directDownloadUrl = `https://drive.google.com/uc?export=download&id=${fileId}`;
        
        const alternativeDownload = () => {
          setDownloadStatus("Abrindo download em nova aba...");
          const newWindow = window.open(directDownloadUrl, '_blank');
          if (!newWindow) {
            const iframe = document.createElement('iframe');
            iframe.style.display = 'none';
            iframe.src = directDownloadUrl;
            document.body.appendChild(iframe);
            
            setTimeout(() => {
              document.body.removeChild(iframe);
            }, 5000);
          }
          
          setDownloadProgress(null);
          setDownloadStatus("Download iniciado!");
          setTimeout(() => setDownloadStatus(""), 3000);
        };

        try {
          setDownloadStatus("Conectando ao servidor...");
          const response = await fetch(directDownloadUrl, {
            method: 'GET',
            mode: 'no-cors'
          });

          if (response.type === 'opaque') {
            alternativeDownload();
            return;
          }

          setDownloadStatus("Baixando arquivo...");
          setDownloadProgress(50);

          const blob = await response.blob();
          
          if (blob.size === 0) {
            alternativeDownload();
            return;
          }

          setDownloadProgress(90);
          setDownloadStatus("Preparando arquivo...");

          const url = URL.createObjectURL(blob);
          const link = document.createElement("a");
          const fileExtension = getFileExtension(content.title, content.drive_link);
          const fileName = content.title.includes('.') ? content.title : `${content.title}.${fileExtension}`;
          
          link.href = url;
          link.download = fileName;
          link.style.display = 'none';
          
          document.body.appendChild(link);
          link.click();
          document.body.removeChild(link);
          
          URL.revokeObjectURL(url);
          
          setDownloadProgress(100);
          setDownloadStatus("Download concluído!");
          
          setTimeout(() => {
            setDownloadProgress(null);
            setDownloadStatus("");
          }, 2000);

        } catch (fetchError) {
          console.log("Fetch failed, trying alternative method:", fetchError);
          alternativeDownload();
        }

      } catch (err) {
        console.error("Erro ao baixar o arquivo:", err);
        setDownloadStatus("Erro no download. Tente novamente.");
        setDownloadProgress(null);
        setTimeout(() => setDownloadStatus(""), 3000);
      }
    } else {
      setDownloadStatus("Redirecionando para download...");
      window.open(content.drive_link, '_blank');
      setTimeout(() => setDownloadStatus(""), 2000);
    }
  };

  // Load profile + content
  useEffect(() => {
    const fetchProfileAndContent = async () => {
      try {
        setLoading(true);

        const { data: { session }, error: sessionError } = await supabase.auth.getSession();
        if (sessionError || !session?.user) {
          router.push("/login");
          return;
        }
        setUser(session.user);

        const userEmail = session.user.email?.trim().toLowerCase() || "";
        if (userEmail) {
          const { data: userRow, error: userRowError } = await supabase
            .from("users")
            .select("name, email")
            .eq("email", userEmail)
            .single();

          if (!userRowError && userRow) {
            setProfile({ name: userRow.name, email: userRow.email });
          } else {
            setProfile({
              name:
                session.user.user_metadata?.full_name ||
                session.user.user_metadata?.name ||
                session.user.email,
              email: session.user.email,
            });
          }
        }

        if (params.id) {
          const { data: contentData, error: contentError } = await supabase
            .from("contents")
            .select("*")
            .eq("id", params.id)
            .single();

          if (contentError || !contentData) {
            setError("Conteúdo não encontrado");
            setLoading(false);
            return;
          }

          const content = {
            id: contentData.id,
            title: contentData.title,
            thumbnail: contentData.thumbnail,
            drive_link: contentData.drive_link,
            tipo: contentData.tipo,
            estrutura: contentData.estrutura,
            idioma: contentData.idioma,
            nicho: contentData.nicho,
            trafego: contentData.trafego,
            created_at: contentData.created_at,
            description: contentData.description,
          };

          setContent(content);

          // Fetch related criativos for this oferta
          const { data: criativosData, error: criativosError } = await supabase
            .from("criativos")
            .select(`
              *,
              contents!criativos_oferta_id_fkey (
                id,
                title,
                thumbnail,
                tipo,
                estrutura,
                idioma,
                nicho,
                trafego
              )
            `)
            .eq("oferta_id", params.id)
            .limit(12);

          if (!criativosError && criativosData) {
            const transformedCriativos = criativosData.map(item => ({
              ...item,
              oferta: item.contents || null
            }));
            setRelatedCriativos(transformedCriativos);
          }

          // Fetch related landing pages for this oferta
          const { data: pagesData, error: pagesError } = await supabase
            .from("landing_pages")
            .select("id, title, page_url, association_type")
            .eq("oferta_id", params.id)
            .eq("association_type", "oferta");

          if (!pagesError && pagesData) {
            setRelatedPages(pagesData);
          }
        }

        setLoading(false);
      } catch (err) {
        console.error(err);
        setError("Erro ao carregar conteúdo");
        setLoading(false);
      }
    };

    fetchProfileAndContent();

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === "SIGNED_OUT" || !session) router.push("/login");
    });

    return () => subscription.unsubscribe();
  }, [params.id, router]);

  const handleLogout = async () => {
    try {
      const { error } = await supabase.auth.signOut();
      if (error) console.error(error);
    } finally {
      router.push("/login");
    }
  };

  useEffect(() => {
    function handleResize() {
      setSidebarCollapsed(window.innerWidth < 1024);
    }
    handleResize();
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  if (loading)
    return (
      <div className="flex min-h-screen bg-[#0f0f0f] text-white items-center justify-center">
        <div className="flex items-center gap-3">
          <div className="animate-spin rounded-full h-8 w-8 border-2 border-blue-600 border-t-transparent"></div>
          <span>Carregando conteúdo...</span>
        </div>
      </div>
    );

  if (error || !content)
    return (
      <div className="flex min-h-screen bg-[#0f0f0f] text-white items-center justify-center">
        <div className="text-center">
          <div className="text-6xl mb-4">❌</div>
          <p className="text-gray-400 text-lg mb-4">{error || "Conteúdo não encontrado"}</p>
          <button
            onClick={() => router.back()}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded-lg transition"
          >
            Voltar
          </button>
        </div>
      </div>
    );

  return (
    <div className="flex min-h-screen bg-[#0f0f0f] text-white">
      {/* Sidebar */}
      <aside
        className={`${sidebarCollapsed ? "w-16" : "w-52"} bg-[#141414] p-6 flex flex-col gap-4 transition-all duration-300 relative`}
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
                  <p className="text-sm font-medium truncate">{profile.name || "Usuário"}</p>
                </div>
              </div>
            )}

            <button
              onClick={() => router.push("/usuarios")}
              className="flex items-center gap-2 px-7 py-2 rounded-lg text-sm text-white font-bold text-left hover:bg-[#1f1f1f]"
            >
              <Image src="/icons/dashboard.svg" alt="Dashboard" width={22} height={20} />
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
                  <Image src="/icons/criativos.svg" alt="Criativos" width={22} height={18} />
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

            <div className="mt-4">
              <p className="text-xs px-3 text-gray-400 mb-2 font-bold">Suporte</p>
              <div className="flex flex-col gap-1 ml-6">
                <button
                  onClick={() => router.push("/configuracoes")}
                  className="flex items-center gap-2 px-2 py-2 rounded-lg text-sm text-white font-bold text-left hover:bg-[#1f1f1f]"
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
            className={`px-3 py-2 bg-red-600 rounded-lg hover:bg-red-700 transition ${sidebarCollapsed ? "w-10 h-10 flex items-center justify-center text-lg" : "w-full"}`}
            title={sidebarCollapsed ? "Sair" : ""}
          >
            {sidebarCollapsed ? "🚪" : "Sair"}
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 px-8 pb-8 overflow-auto min-w-0">
        {/* Header */}
        <div className="border-b border-gray-800">
          <div className="max-w-7xl mx-auto px-2 py-4 flex items-center justify-between">
            <h1 className="text-lg font-bold text-white truncate">
              {content?.title}
            </h1>
          </div>
        </div>

        {/* Content Detail */}
        <div className="mt-6 max-w-4xl px-1">
          {/* Caixas de Informação (Tipo, Estrutura, Idioma, Nicho, Tráfego) */}
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-3 mb-6">
            {content.tipo && (
              <div className="bg-neutral-800 rounded-lg p-4 flex flex-col items-center justify-center gap-2 min-h-[120px]">
                <div className="w-10 h-10 flex items-center justify-center">
                  <Image src="/icons/tipo.svg" alt="Tipo" width={30} height={30} />
                </div>
                <div className="text-sm font-bold text-white mt-0">Tipo</div>
                <div className="text-xs font-bold text-gray-400 text-center">{content.tipo}</div>
              </div>
            )}

            {content.estrutura && (
              <div className="bg-neutral-800 rounded-lg p-4 flex flex-col items-center justify-center gap-2 min-h-[120px]">
                <div className="w-10 h-10 flex items-center justify-center">
                  <Image src="/icons/estrutura.svg" alt="Estrutura" width={30} height={30} />
                </div>
                <div className="text-sm font-bold text-white">Estrutura</div>
                <div className="text-xs font-bold text-gray-400 text-center">{content.estrutura}</div>
              </div>
            )}

            {content.idioma && (
              <div className="bg-neutral-800 rounded-lg p-4 flex flex-col items-center justify-center gap-2 min-h-[120px]">
                <div className="w-10 h-10 flex items-center justify-center">
                  <Image src="/icons/idioma.svg" alt="Idioma" width={30} height={30} />
                </div>
                <div className="text-sm font-bold text-white">Idioma</div>
                <div className="text-xs font-bold text-gray-400 text-center">{content.idioma}</div>
              </div>
            )}

            {content.nicho && (
              <div className="bg-neutral-800 rounded-lg p-4 flex flex-col items-center justify-center gap-2 min-h-[120px]">
                <div className="w-10 h-10 flex items-center justify-center">
                  <Image src="/icons/nicho.svg" alt="Nicho" width={30} height={30} />
                </div>
                <div className="text-sm font-bold text-white">Nicho</div>
                <div className="text-xs font-bold text-gray-400 text-center">{content.nicho}</div>
              </div>
            )}

            {content.trafego && (
              <div className="bg-neutral-800 rounded-lg p-4 flex flex-col items-center justify-center gap-2 min-h-[120px]">
                <div className="w-10 h-10 flex items-center justify-center">
                  <Image src="/icons/trafego.svg" alt="Trafego" width={30} height={30} />
                </div>
                <div className="text-sm font-bold text-white">Tráfego</div>
                <div className="text-xs font-bold text-gray-400 text-center">{content.trafego}</div>
              </div>
            )}
          </div>

          {/* Player box */}
          {isGoogleDriveVideo(content.drive_link) && (
            <div className="mb-6 relative bg-neutral-800 rounded-lg p-4">
              <div className="relative w-full overflow-hidden rounded-lg" style={{ paddingBottom: "56.25%" }}>
                <iframe
                  src={getPreviewUrl(content.drive_link) || ""}
                  allow="autoplay; encrypted-media"
                  allowFullScreen
                  className="absolute top-0 left-0 w-full h-full rounded-lg"
                  style={{ border: "none" }}
                />
              </div>

              <div className="absolute right-7 top-7 flex flex-col gap-2 z-10">
                <button
                  onClick={handleDownload}
                  disabled={downloadProgress !== null}
                  className={`px-3 py-1 rounded-md text-xs font-semibold transition-colors ${
                    downloadProgress !== null 
                      ? 'bg-gray-600 cursor-not-allowed' 
                      : 'bg-blue-600 hover:bg-blue-700'
                  }`}
                >
                  {downloadProgress !== null ? 'Baixando...' : 'Baixar'}
                </button>
              </div>

              {(downloadProgress !== null || downloadStatus) && (
                <div className="mt-4 bg-black/70 rounded-md p-3">
                  {downloadProgress !== null && (
                    <div className="mb-2">
                      <div className="w-full bg-gray-600 rounded-full h-2">
                        <div 
                          className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                          style={{ width: `${downloadProgress}%` }}
                        ></div>
                      </div>
                    </div>
                  )}
                  {downloadStatus && (
                    <p className="text-xs text-center text-white">{downloadStatus}</p>
                  )}
                </div>
              )}
            </div>
          )}

          {content.description && (
            <p className="mb-4 text-gray-300">{content.description}</p>
          )}

          

          {/* Related Criativos Section */}
          {relatedCriativos.length > 0 && (
            <div className="mt-8">
              <h2 className="text-xl font-bold mb-4">Criativos desta Oferta</h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
                {relatedCriativos.map((criativo) => (
                  <div
                    key={criativo.id}
                    className="bg-[#141414] shadow rounded-lg overflow-hidden relative group min-w-0 hover:shadow-lg transition-shadow cursor-pointer"
                    onClick={() => handleCriativoClick(criativo)}
                  >
                    <div className="relative">
                      <img
                        src={
                          content.thumbnail
                            ? getOptimizedImageUrl(content.thumbnail)
                            : "/default-creative.jpg"
                        }
                        alt={criativo.title}
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
                      <h3 className="font-semibold text-white mb-1 line-clamp-2 group-hover:text-blue-300 transition-colors">
                        {criativo.title}
                      </h3>
                      <p className="text-gray-400 text-sm mb-2">
                        {content.title}
                      </p>
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
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Landing Pages Section */}
          {relatedPages.length > 0 && (
            <div className="mt-8 mb-8">
              <h2 className="text-xl font-bold mb-4">Páginas</h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
                {relatedPages.map((page) => (
                  <div
                    key={page.id}
                    className="bg-[#141414] shadow rounded-lg overflow-hidden relative group min-w-0 hover:shadow-lg transition-shadow cursor-pointer"
                    onClick={() => handlePageClick(page)}
                  >
                    <div className="relative h-32 bg-gradient-to-br from-gray-800 to-gray-900 flex items-center justify-center">
                      <div className="text-5xl opacity-20">🔗</div>
                      <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />
                      <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity">
                        
                      </div>
                    </div>
                    
                    <div className="p-3">
                      <h3 className="font-semibold text-white text-sm line-clamp-2 group-hover:text-blue-300 transition-colors">
                        {page.title}
                      </h3>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
