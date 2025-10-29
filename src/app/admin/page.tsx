"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/supabaseClient";
import UsuariosPage from "./UsuariosPage";
import CriativosPage from "./CriativosPage";
import LandingPagesPage from "./LandingPagesPage";
import DashboardPage from "./DashboardPage";

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

// Confirmation modal component
interface ConfirmModalProps {
  message: string;
  onConfirm: () => void;
  onCancel: () => void;
}

const ConfirmModal = ({ message, onConfirm, onCancel }: ConfirmModalProps) => {
  return (
    <div className="fixed inset-0 flex items-center justify-center z-50 bg-black bg-opacity-70">
      <div className="bg-[#141414] p-6 rounded-2xl shadow-lg w-full max-w-md border border-[#333]">
        <h3 className="text-xl font-semibold text-white mb-4">Confirmar Ação</h3>
        <p className="text-gray-300 mb-6">{message}</p>
        <div className="flex justify-end gap-3">
          <button
            onClick={onCancel}
            className="px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700"
          >
            Cancelar
          </button>
          <button
            onClick={onConfirm}
            className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700"
          >
            Confirmar
          </button>
        </div>
      </div>
    </div>
  );
};

// Define the content type
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

interface ToastNotification {
  id: number;
  message: string;
  type: 'success' | 'error' | 'info';
}

// Opções predefinidas para os selects
const TIPO_OPTIONS = [
  "VSL (Video Sales Letter)",
  "Ebook",
  "Webinar",
  "Landing Page",
  "Quiz/Questionário",
  "Artigo/Blog Post",
  "Infográfico",
  "Caso de Estudo",
  "Template/Ferramenta"
];

const IDIOMA_OPTIONS = [
  "Português",
  "Inglês",
  "Espanhol"
];

const TRAFEGO_OPTIONS = [
  "Facebook Ads",
  "Instagram Ads",
  "Google Ads",
  "TikTok Ads",
  "LinkedIn Ads",
  "YouTube Ads",
  "Orgânico (SEO)",
  "Email Marketing",
  "Influenciadores"
];

export default function AdminPage() {
  const [contents, setContents] = useState<Content[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [editingContent, setEditingContent] = useState<Content | null>(null);
  const [activePage, setActivePage] = useState("ofertas");
  const [toasts, setToasts] = useState<ToastNotification[]>([]);
  const [confirmModal, setConfirmModal] = useState<{ show: boolean; message: string; onConfirm: () => void } | null>(null);

  // Collapsible states
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [filterCollapsed, setFilterCollapsed] = useState(false);

  const [title, setTitle] = useState("");
  const [thumbnail, setThumbnail] = useState("");
  const [thumbnailFile, setThumbnailFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [driveLink, setDriveLink] = useState("");
  
  // Filtros
  const [filterTipo, setFilterTipo] = useState<string | null>(null);
  const [filterIdioma, setFilterIdioma] = useState<string | null>(null);
  const [filterNicho, setFilterNicho] = useState<string | null>(null);
  const [filterTrafego, setFilterTrafego] = useState<string | null>(null);
  const [filterEstrutura, setFilterEstrutura] = useState<string | null>(null);
  
  // New fields
  const [tipo, setTipo] = useState("");
  const [estrutura, setEstrutura] = useState("");
  const [idioma, setIdioma] = useState("");
  const [nicho, setNicho] = useState("");
  const [trafego, setTrafego] = useState("");

  const STORAGE_BUCKET = "thumbnails";

  const colorClasses = [
    "bg-blue-600/20 text-blue-200",
    "bg-green-600/20 text-green-200",
    "bg-red-600/20 text-red-200",
    "bg-purple-600/20 text-purple-200",
    "bg-yellow-600/20 text-yellow-200",
    "bg-pink-600/20 text-pink-200",
  ];

  // Toast notification functions
  const showToast = (message: string, type: 'success' | 'error' | 'info') => {
    const id = Date.now();
    setToasts(prev => [...prev, { id, message, type }]);
  };

  const removeToast = (id: number) => {
    setToasts(prev => prev.filter(toast => toast.id !== id));
  };

  // Confirmation modal function
  const showConfirm = (message: string): Promise<boolean> => {
    return new Promise((resolve) => {
      setConfirmModal({
        show: true,
        message,
        onConfirm: () => {
          setConfirmModal(null);
          resolve(true);
        }
      });
    });
  };

  const cancelConfirm = () => {
    setConfirmModal(null);
  };

  function hashString(str: string) {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      hash = str.charCodeAt(i) + ((hash << 5) - hash);
    }
    return Math.abs(hash);
  }

  const uploadImage = async (file: File): Promise<string> => {
    try {
      const fileExt = file.name.split('.').pop();
      const fileName = `${Date.now()}-${Math.random().toString(36).substring(2)}.${fileExt}`;
      const filePath = `thumbnails/${fileName}`;

      const { data, error } = await supabase.storage
        .from(STORAGE_BUCKET)
        .upload(filePath, file, {
          cacheControl: '3600',
          upsert: false
        });

      if (error) {
        console.error("Supabase Storage error:", error);
        throw new Error(error.message);
      }

      const { data: { publicUrl } } = supabase.storage
        .from(STORAGE_BUCKET)
        .getPublicUrl(filePath);

      return publicUrl;
    } catch (error) {
      console.error("Error uploading image to Supabase:", error);
      throw new Error("Failed to upload image");
    }
  };

  const deleteImage = async (imageUrl: string): Promise<void> => {
    try {
      const urlParts = imageUrl.split('/');
      const bucketIndex = urlParts.findIndex(part => part === STORAGE_BUCKET);
      if (bucketIndex === -1) return;
      
      const filePath = urlParts.slice(bucketIndex + 1).join('/');
      
      const { error } = await supabase.storage
        .from(STORAGE_BUCKET)
        .remove([filePath]);

      if (error) {
        console.error("Error deleting image:", error);
      }
    } catch (error) {
      console.error("Error deleting image:", error);
    }
  };

  const getOptimizedImageUrl = (originalUrl: string, width = 400, height = 300, quality = 80) => {
    if (originalUrl.includes('supabase')) {
      return `${originalUrl}?width=${width}&height=${height}&resize=cover&quality=${quality}`;
    }
    return originalUrl;
  };

  useEffect(() => {
    const fetchContents = async () => {
      try {
        const { data, error } = await supabase
          .from('contents')
          .select('*')
          .order('created_at', { ascending: false });

        if (error) {
          console.error('Error fetching contents:', error);
          return;
        }

        const transformedData: Content[] = data.map(item => ({
          id: item.id,
          title: item.title,
          thumbnail: item.thumbnail,
          drive_link: item.drive_link,
          tipo: item.tipo,
          estrutura: item.estrutura,
          idioma: item.idioma,
          nicho: item.nicho,
          trafego: item.trafego,
          created_at: item.created_at
        }));

        setContents(transformedData);
      } catch (error) {
        console.error('Error fetching contents:', error);
      }
    };
    
    fetchContents();
  }, []);

  useEffect(() => {
    function handleResize() {
      const w = window.innerWidth;
      if (w < 1024) {
        setSidebarCollapsed(true);
        setFilterCollapsed(true);
      } else {
        setSidebarCollapsed(false);
        setFilterCollapsed(false);
      }
    }
    handleResize();
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!editingContent && !thumbnailFile) {
      showToast("Por favor selecione uma imagem thumbnail.", "error");
      return;
    }

    try {
      setUploading(true);
      let finalThumbnailUrl = thumbnail;
      let oldThumbnailUrl = null;

      if (thumbnailFile) {
        finalThumbnailUrl = await uploadImage(thumbnailFile);
        
        if (editingContent && editingContent.thumbnail) {
          oldThumbnailUrl = editingContent.thumbnail;
        }
      }

      const contentData = {
        title,
        thumbnail: finalThumbnailUrl,
        drive_link: driveLink,
        tipo: tipo || null,
        estrutura: estrutura || null,
        idioma: idioma || null,
        nicho: nicho || null,
        trafego: trafego || null
      };

      if (editingContent) {
        const { error } = await supabase
          .from('contents')
          .update(contentData)
          .eq('id', editingContent.id);

        if (error) {
          throw error;
        }

        if (oldThumbnailUrl && thumbnailFile) {
          await deleteImage(oldThumbnailUrl);
        }

        setContents(
          contents.map((c) =>
            c.id === editingContent.id
              ? { ...c, ...contentData }
              : c
          )
        );
        showToast("Oferta atualizada com sucesso!", "success");
      } else {
        const { data, error } = await supabase
          .from('contents')
          .insert(contentData)
          .select()
          .single();

        if (error) {
          throw error;
        }

        const newContent: Content = {
          id: data.id,
          ...contentData,
          created_at: data.created_at
        };

        setContents([newContent, ...contents]);
        showToast("Oferta criada com sucesso!", "success");
      }
      
      resetForm();
    } catch (error) {
      console.error("Erro ao salvar documento: ", error);
      showToast("Erro ao salvar oferta: " + (error as Error).message, "error");
    } finally {
      setUploading(false);
    }
  };

  const resetForm = () => {
    setTitle("");
    setThumbnail("");
    setThumbnailFile(null);
    setDriveLink("");
    setTipo("");
    setEstrutura("");
    setIdioma("");
    setNicho("");
    setTrafego("");
    setEditingContent(null);
    setShowForm(false);
  };

  const handleEdit = (content: Content) => {
    setEditingContent(content);
    setTitle(content.title);
    setThumbnail(content.thumbnail);
    setThumbnailFile(null);
    setDriveLink(content.drive_link);
    setTipo(content.tipo || "");
    setEstrutura(content.estrutura || "");
    setIdioma(content.idioma || "");
    setNicho(content.nicho || "");
    setTrafego(content.trafego || "");
    setShowForm(true);
  };

  const handleDelete = async (id: string) => {
    const confirmed = await showConfirm("Tem certeza que deseja excluir este conteúdo?");
    if (!confirmed) return;
    
    try {
      const contentToDelete = contents.find(c => c.id === id);
      
      const { error } = await supabase
        .from('contents')
        .delete()
        .eq('id', id);

      if (error) {
        throw error;
      }

      if (contentToDelete?.thumbnail) {
        await deleteImage(contentToDelete.thumbnail);
      }

      setContents(contents.filter((c) => c.id !== id));
      showToast("Conteúdo apagado com sucesso!", "success");
    } catch (error) {
      console.error("Erro ao excluir: ", error);
      showToast("Erro ao excluir conteúdo: " + (error as Error).message, "error");
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (!file.type.startsWith('image/')) {
        showToast('Por favor selecione uma imagem', "error");
        return;
      }
      
      if (file.size > 10 * 1024 * 1024) {
        showToast('O ficheiro precisa ter menos de 10MB', "error");
        return;
      }
      
      setThumbnailFile(file);
    }
  };

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
  };

  // Filtrar conteúdos
  const filteredContents = contents.filter((c) => {
    if (filterTipo && c.tipo !== filterTipo) return false;
    if (filterIdioma && c.idioma !== filterIdioma) return false;
    if (filterNicho && c.nicho !== filterNicho) return false;
    if (filterTrafego && c.trafego !== filterTrafego) return false;
    if (filterEstrutura && c.estrutura !== filterEstrutura) return false;
    return true;
  });

  const hasActiveFilters = filterTipo || filterIdioma || filterNicho || filterTrafego || filterEstrutura;

  return (
    <div className="flex min-h-screen bg-[#0f0f0f] text-white">
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

      {/* Confirmation Modal */}
      {confirmModal?.show && (
        <ConfirmModal
          message={confirmModal.message}
          onConfirm={confirmModal.onConfirm}
          onCancel={cancelConfirm}
        />
      )}

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

        {!sidebarCollapsed && <h1 className="text-xl font-bold mb-6">Painel</h1>}

        <nav className="flex flex-col gap-3">
          <button
            onClick={() => setActivePage("ofertas")}
            className={`px-3 py-2 rounded-lg text-left flex items-center gap-3 ${
              activePage === "ofertas" ? "bg-blue-600" : "hover:bg-[#1f1f1f]"
            }`}
            title={sidebarCollapsed ? "Ofertas" : ""}
          >
            <span>📦</span>
            {!sidebarCollapsed && <span>Ofertas</span>}
          </button>
           
           <button
            onClick={() => setActivePage("criativos")}
            className={`px-3 py-2 rounded-lg text-left flex items-center gap-3 ${
              activePage === "criativos" ? "bg-blue-600" : "hover:bg-[#1f1f1f]"
            }`}
            title={sidebarCollapsed ? "Criativos" : ""}
          >
            <span>🎬</span>
            {!sidebarCollapsed && <span>Criativos</span>}
          </button>

            <button
            onClick={() => setActivePage("landing-pages")}
            className={`px-3 py-2 rounded-lg text-left flex items-center gap-3 ${
              activePage === "landing-pages" ? "bg-blue-600" : "hover:bg-[#1f1f1f]"
            }`}
            title={sidebarCollapsed ? "Páginas" : ""}
          >
            <span>📄</span>
            {!sidebarCollapsed && <span>Páginas</span>}
          </button>

          <button
            onClick={() => setActivePage("usuarios")}
            className={`px-3 py-2 rounded-lg text-left flex items-center gap-3 ${
              activePage === "usuarios" ? "bg-blue-600" : "hover:bg-[#1f1f1f]"
            }`}
            title={sidebarCollapsed ? "Usuários" : ""}
          >
            <span>👤</span>
            {!sidebarCollapsed && <span>Usuários</span>}
          </button>

            

          <button
            onClick={() => setActivePage("dashboard")}
            className={`px-3 py-2 rounded-lg text-left flex items-center gap-3 ${
              activePage === "dashboard" ? "bg-blue-600" : "hover:bg-[#1f1f1f]"
            }`}
            title={sidebarCollapsed ? "Dashboard" : ""}
          >
            <span>📊</span>
            {!sidebarCollapsed && <span>Dashboard</span>}
          </button>

          
        </nav>
      </aside>

      {/* Filters Sidebar */}
      {activePage === "ofertas" && (
        <aside
          className={`${
            filterCollapsed ? "w-12" : "w-64"
          } bg-[#141414] p-6 flex flex-col gap-4 border-l border-[#1f1f1f] transition-all duration-300 relative overflow-y-auto`}
        >
          <button
            onClick={() => setFilterCollapsed((s) => !s)}
            className="absolute -right-3 top-6 bg-[#1f1f1f] hover:bg-[#2f2f2f] text-white w-6 h-6 rounded-full flex items-center justify-center text-xs border border-[#333] transition-colors z-10"
          >
            {filterCollapsed ? "→" : "←"}
          </button>

          {!filterCollapsed ? (
            <>
              <h2 className="text-lg font-semibold mb-2">Filtros</h2>
              
              <div className="flex flex-col gap-1">
                {/* Botão "Todos" no topo */}
                <button
                  onClick={clearAllFilters}
                  className={`px-3 py-1.5 rounded-lg text-left text-sm ${
                    !hasActiveFilters ? "bg-blue-600" : "hover:bg-[#1f1f1f]"
                  }`}
                >
                  Todos
                </button>

                {/* Lista única de todos os filtros misturados */}
                {allFilters.map((item, idx) => (
                  <button
                    key={`${item.type}-${item.value}-${idx}`}
                    onClick={() => handleFilterClick(item)}
                    className={`px-3 py-1.5 rounded-lg text-left text-sm ${
                      isFilterActive(item) ? "bg-blue-600" : "hover:bg-[#1f1f1f]"
                    }`}
                  >
                    {item.value}
                  </button>
                ))}
              </div>
            </>
          ) : (
            <div className="flex flex-col gap-2 items-center">
              <div
                className="w-8 h-8 flex items-center justify-center text-lg cursor-pointer hover:bg-[#1f1f1f] rounded"
                title="Filtros"
              >
                🔍
              </div>
            </div>
          )}
        </aside>
      )}

      {/* Main content */}
      <main className="flex-1 p-8 overflow-auto min-w-0">
        {activePage === "ofertas" && (
          <>
            <h2 className="text-2xl font-bold mb-6">OFERTAS</h2>

            {filteredContents.length === 0 && !showForm && (
              <div className="text-center">
                <p className="text-gray-400 mb-4">
                  {hasActiveFilters ? "Nenhuma oferta encontrada com esses filtros" : "Ainda não existem conteúdos"}
                </p>
                {!hasActiveFilters && (
                  <button
                    onClick={() => setShowForm(true)}
                    className="px-4 py-2 bg-blue-600 text-white rounded-lg shadow hover:bg-blue-700"
                  >
                    ➕ Adicionar Conteúdo
                  </button>
                )}
              </div>
            )}

            {showForm && (
              <div className="fixed inset-0 flex items-center justify-center z-50 bg-black bg-opacity-70 p-4">
                <div className="bg-[#141414] p-6 rounded-2xl shadow-lg w-full max-w-2xl relative max-h-[90vh] overflow-y-auto">
                  <button
                    onClick={resetForm}
                    className="absolute top-3 right-3 text-gray-400 hover:text-white text-xl"
                    disabled={uploading}
                  >
                    ✖
                  </button>

                  <h2 className="text-xl font-semibold text-white mb-4">
                    {editingContent ? "Editar Conteúdo" : "Adicionar Conteúdo"}
                  </h2>

                  <form onSubmit={handleSubmit} className="flex flex-col gap-4">
                    {/* Título */}
                    <input
                      type="text"
                      placeholder="Título *"
                      value={title}
                      onChange={(e) => setTitle(e.target.value)}
                      required
                      disabled={uploading}
                      className="px-3 py-2 rounded-lg bg-[#1f1f1f] text-white focus:outline-none focus:ring-2 focus:ring-blue-600 disabled:opacity-50"
                    />

                    {/* Tipo, Idioma */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <select
                        value={tipo}
                        onChange={(e) => setTipo(e.target.value)}
                        disabled={uploading}
                        className="px-3 py-2 rounded-lg bg-[#1f1f1f] text-white focus:outline-none focus:ring-2 focus:ring-blue-600 disabled:opacity-50"
                      >
                        <option value="">Selecione o Tipo</option>
                        {TIPO_OPTIONS.map((opt, idx) => (
                          <option key={idx} value={opt}>{opt}</option>
                        ))}
                      </select>

                      <select
                        value={idioma}
                        onChange={(e) => setIdioma(e.target.value)}
                        disabled={uploading}
                        className="px-3 py-2 rounded-lg bg-[#1f1f1f] text-white focus:outline-none focus:ring-2 focus:ring-blue-600 disabled:opacity-50"
                      >
                        <option value="">Selecione o Idioma</option>
                        {IDIOMA_OPTIONS.map((opt, idx) => (
                          <option key={idx} value={opt}>{opt}</option>
                        ))}
                      </select>
                    </div>

                    {/* Estrutura, Nicho */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <input
                        type="text"
                        placeholder="Estrutura"
                        value={estrutura}
                        onChange={(e) => setEstrutura(e.target.value)}
                        disabled={uploading}
                        className="px-3 py-2 rounded-lg bg-[#1f1f1f] text-white focus:outline-none focus:ring-2 focus:ring-blue-600 disabled:opacity-50"
                      />

                      <input
                        type="text"
                        placeholder="Nicho"
                        value={nicho}
                        onChange={(e) => setNicho(e.target.value)}
                        disabled={uploading}
                        className="px-3 py-2 rounded-lg bg-[#1f1f1f] text-white focus:outline-none focus:ring-2 focus:ring-blue-600 disabled:opacity-50"
                      />
                    </div>

                    {/* Tráfego */}
                    <select
                      value={trafego}
                      onChange={(e) => setTrafego(e.target.value)}
                      disabled={uploading}
                      className="px-3 py-2 rounded-lg bg-[#1f1f1f] text-white focus:outline-none focus:ring-2 focus:ring-blue-600 disabled:opacity-50"
                    >
                      <option value="">Selecione o Tráfego</option>
                      {TRAFEGO_OPTIONS.map((opt, idx) => (
                        <option key={idx} value={opt}>{opt}</option>
                      ))}
                    </select>

                    {/* Thumbnail */}
                    <div>
                      <label className="block text-white mb-2">
                        Thumbnail *
                        <span className="text-xs text-gray-400 ml-1">(Max 10MB)</span>
                      </label>
                      <input
                        type="file"
                        accept="image/*"
                        onChange={handleFileChange}
                        disabled={uploading}
                        className="w-full px-3 py-2 rounded-lg bg-[#1f1f1f] text-white focus:outline-none focus:ring-2 focus:ring-blue-600 disabled:opacity-50 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:bg-blue-600 file:text-white hover:file:bg-blue-700"
                      />
                      {thumbnailFile && (
                        <div className="mt-2">
                          <p className="text-sm text-green-400">
                            ✓ Selecionado: {thumbnailFile.name}
                          </p>
                          <p className="text-xs text-gray-400">
                            Size: {(thumbnailFile.size / 1024 / 1024).toFixed(2)} MB
                          </p>
                        </div>
                      )}
                      {editingContent && thumbnail && !thumbnailFile && (
                        <div className="mt-2">
                          <img
                            src={getOptimizedImageUrl(thumbnail, 80, 80)}
                            alt="Current thumbnail"
                            className="w-20 h-20 object-cover rounded"
                          />
                          <p className="text-sm text-gray-400">Imagem atual</p>
                        </div>
                      )}
                    </div>

                    {/* Drive Link */}
                    <input
                      type="text"
                      placeholder="Google Drive Link *"
                      value={driveLink}
                      onChange={(e) => setDriveLink(e.target.value)}
                      required
                      disabled={uploading}
                      className="px-3 py-2 rounded-lg bg-[#1f1f1f] text-white focus:outline-none focus:ring-2 focus:ring-blue-600 disabled:opacity-50"
                    />

                    <div className="flex justify-end gap-3 mt-4">
                      <button
                        type="button"
                        onClick={resetForm}
                        disabled={uploading}
                        className="px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 disabled:opacity-50"
                      >
                        Cancelar
                      </button>
                      <button
                        type="submit"
                        disabled={uploading}
                        className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 shadow disabled:opacity-50 flex items-center gap-2"
                      >
                        {uploading && (
                          <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent"></div>
                        )}
                        {uploading ? "Salvando..." : editingContent ? "Salvar Alterações" : "Salvar"}
                      </button>
                    </div>
                  </form>
                </div>
              </div>
            )}

            {filteredContents.length > 0 && !showForm && (
              <div>
                <div className="flex justify-end mb-4">
                  <button
                    onClick={() => setShowForm(true)}
                    className="px-4 py-2 bg-blue-600 text-white rounded-lg shadow hover:bg-blue-700"
                  >
                    ➕ Adicionar Oferta
                  </button>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-2 lg:grid-cols-3 gap-3">
                  {filteredContents.map((content) => (
                    <div
                      key={content.id}
                      className="bg-[#141414] shadow rounded-lg overflow-hidden relative group min-w-0"
                    >
                      <a
                        href={content.drive_link}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="block hover:scale-105 transform transition"
                      >
                        <img
                          src={getOptimizedImageUrl(content.thumbnail)}
                          alt={content.title}
                          className="w-full h-40 object-cover"
                          loading="lazy"
                        />
                        <div className="p-4">
                          <h2 className="font-semibold text-white mb-3">{content.title}</h2>
                          
                          {/* Tags/Badges com estilo de categoria */}
                          <div className="flex flex-wrap gap-2 mb-3">
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
                      </a>

                      <div className="absolute top-2 right-2 flex gap-2 opacity-0 group-hover:opacity-100 transition">
                        <button
                          onClick={() => handleEdit(content)}
                          className="bg-blue-500 text-white text-sm px-2 py-1 rounded hover:bg-blue-600"
                        >
                          ✏️
                        </button>
                        <button
                          onClick={() => handleDelete(content.id)}
                          className="bg-red-600 text-white text-sm px-2 py-1 rounded hover:bg-red-700"
                        >
                          🗑️
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </>
        )}

        {activePage === "usuarios" && <UsuariosPage />}
        {activePage === "criativos" && <CriativosPage />}
        {activePage === "dashboard" && <DashboardPage/>}
        {activePage === "landing-pages" && <LandingPagesPage />}

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
