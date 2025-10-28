"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/supabaseClient";
import Image from "next/image";

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

interface Criativo {
  id: string;
  oferta_id: string | null;
  title: string;
  drive_link: string;
  nicho?: string | null;
  trafego?: string | null;
  idioma?: string | null;
  created_at?: string;
  oferta?: {
    title: string;
    thumbnail?: string;
    tipo?: string | null;
    idioma?: string | null;
    nicho?: string | null;
    trafego?: string | null;
  } | null;
}

interface Oferta {
  id: string;
  title: string;
  thumbnail?: string;
  tipo?: string | null;
  idioma?: string | null;
  nicho?: string | null;
  trafego?: string | null;
}

interface ToastNotification {
  id: number;
  message: string;
  type: 'success' | 'error' | 'info';
}

// Opções predefinidas
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

export default function CriativosPage() {
  const [criativos, setCriativos] = useState<Criativo[]>([]);
  const [ofertas, setOfertas] = useState<Oferta[]>([]);
  const [selectedOferta, setSelectedOferta] = useState("");
  const [criativoTitle, setCriativoTitle] = useState("");
  const [driveLink, setDriveLink] = useState("");
  const [nicho, setNicho] = useState("");
  const [trafego, setTrafego] = useState("");
  const [idioma, setIdioma] = useState("");
  
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingTitle, setEditingTitle] = useState("");
  const [editingDriveLink, setEditingDriveLink] = useState("");
  const [editingOferta, setEditingOferta] = useState("");
  const [editingNicho, setEditingNicho] = useState("");
  const [editingTrafego, setEditingTrafego] = useState("");
  const [editingIdioma, setEditingIdioma] = useState("");
  
  const [searchTerm, setSearchTerm] = useState("");
  const [filterOferta, setFilterOferta] = useState<string | null>(null);
  const [filterType, setFilterType] = useState<"all" | "with-offer" | "without-offer">("all");
  const [toasts, setToasts] = useState<ToastNotification[]>([]);
  const [confirmModal, setConfirmModal] = useState<{ show: boolean; message: string; onConfirm: () => void } | null>(null);

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
    if (!str) return 0;
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      hash = str.charCodeAt(i) + ((hash << 5) - hash);
    }
    return Math.abs(hash);
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

  // Função para extrair o ID do Google Drive de um link
  const extractDriveFileId = (url: string): string | null => {
    if (!url) return null;
    
    // Padrões de URL do Google Drive
    const patterns = [
      /\/d\/([a-zA-Z0-9_-]+)/,  // drive.google.com/file/d/ID
      /id=([a-zA-Z0-9_-]+)/,     // drive.google.com/open?id=ID
      /\/([a-zA-Z0-9_-]+)\/view/, // drive.google.com/file/d/ID/view
      /\/([a-zA-Z0-9_-]+)\/preview/, // drive.google.com/file/d/ID/preview
    ];
    
    for (const pattern of patterns) {
      const match = url.match(pattern);
      if (match && match[1]) {
        return match[1];
      }
    }
    
    return null;
  };

  // Função para gerar preview do Google Drive (funciona para vídeos, PDFs, imagens)
  const getDrivePreview = (driveLink: string): string => {
    const fileId = extractDriveFileId(driveLink);
    if (!fileId) return "/default-creative.jpg";
    
    // Usando a URL de preview do Google Drive
    // Esta URL renderiza uma visualização do arquivo (funciona para vídeos, PDFs, documentos, imagens)
    return `https://drive.google.com/thumbnail?id=${fileId}&sz=w1000`;
  };

  // Função para obter a thumbnail do criativo (prioritiza Drive, depois oferta)
  const getCriativoThumbnail = (criativo: Criativo): string => {
    // Sempre usa o link do Drive se disponível
    if (criativo.drive_link) {
      return getDrivePreview(criativo.drive_link);
    }
    
    // Fallback para thumbnail da oferta
    if (criativo.oferta?.thumbnail) {
      return getOptimizedImageUrl(criativo.oferta.thumbnail);
    }
    
    // Fallback padrão
    return "/default-creative.jpg";
  };

  useEffect(() => {
    const fetchData = async () => {
      const { data: ofertasData } = await supabase
        .from("contents")
        .select("id, title, thumbnail, tipo, idioma, nicho, trafego");

      const { data: criativosData } = await supabase
        .from("criativos")
        .select(`
          *,
          oferta:contents (
            title,
            thumbnail,
            tipo,
            idioma,
            nicho,
            trafego
          )
        `)
        .order("created_at", { ascending: false });

      if (ofertasData) setOfertas(ofertasData);
      if (criativosData) setCriativos(criativosData);
    };

    fetchData();
  }, []);

  const handleAddCriativo = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!criativoTitle.trim()) {
      showToast("Insira um título para o criativo!", "error");
      return;
    }

    if (!driveLink.trim()) {
      showToast("Insira um link do Google Drive!", "error");
      return;
    }

    try {
      const newCriativo: any = {
        title: criativoTitle.trim(),
        drive_link: driveLink.trim(),
        nicho: nicho || null,
        trafego: trafego || null,
        idioma: idioma || null
      };

      // Adiciona oferta_id apenas se uma oferta foi selecionada
      if (selectedOferta) {
        newCriativo.oferta_id = selectedOferta;
      }

      const { data, error } = await supabase
        .from("criativos")
        .insert(newCriativo)
        .select(`
          *,
          oferta:contents (
            title,
            thumbnail,
            tipo,
            idioma,
            nicho,
            trafego
          )
        `)
        .single();

      if (error) {
        throw error;
      }

      setCriativos([data, ...criativos]);
      setSelectedOferta("");
      setCriativoTitle("");
      setDriveLink("");
      setNicho("");
      setTrafego("");
      setIdioma("");
      
      const message = selectedOferta 
        ? "Criativo criado e associado à oferta!" 
        : "Criativo criado sem associação!";
      showToast(message, "success");
    } catch (error) {
      console.error(error);
      showToast("Erro ao criar criativo: " + (error as Error).message, "error");
    }
  };

  const handleDelete = async (id: string) => {
    const confirmed = await showConfirm("Tem certeza que deseja excluir este criativo?");
    if (!confirmed) return;

    try {
      const { error } = await supabase.from("criativos").delete().eq("id", id);

      if (error) {
        throw error;
      }

      setCriativos(criativos.filter((c) => c.id !== id));
      showToast("Criativo excluído com sucesso!", "success");
    } catch (error) {
      console.error(error);
      showToast("Erro ao excluir criativo: " + (error as Error).message, "error");
    }
  };

  const handleEdit = (criativo: Criativo) => {
    setEditingId(criativo.id);
    setEditingTitle(criativo.title);
    setEditingDriveLink(criativo.drive_link);
    setEditingOferta(criativo.oferta_id || "");
    setEditingNicho(criativo.nicho || "");
    setEditingTrafego(criativo.trafego || "");
    setEditingIdioma(criativo.idioma || "");
  };

  const handleSaveEdit = async (id: string) => {
    if (!editingTitle.trim()) {
      showToast("O título não pode estar vazio!", "error");
      return;
    }

    if (!editingDriveLink.trim()) {
      showToast("O link não pode estar vazio!", "error");
      return;
    }

    try {
      const updateData: any = {
        title: editingTitle.trim(),
        drive_link: editingDriveLink.trim(),
        oferta_id: editingOferta || null,
        nicho: editingNicho || null,
        trafego: editingTrafego || null,
        idioma: editingIdioma || null
      };

      const { data, error } = await supabase
        .from("criativos")
        .update(updateData)
        .eq("id", id)
        .select(`
          *,
          oferta:contents (
            title,
            thumbnail,
            tipo,
            idioma,
            nicho,
            trafego
          )
        `)
        .single();

      if (error) {
        throw error;
      }

      setCriativos(criativos.map((c) => (c.id === id ? data : c)));
      setEditingId(null);
      setEditingTitle("");
      setEditingDriveLink("");
      setEditingOferta("");
      setEditingNicho("");
      setEditingTrafego("");
      setEditingIdioma("");
      showToast("Criativo atualizado com sucesso!", "success");
    } catch (error) {
      console.error(error);
      showToast("Erro ao editar criativo: " + (error as Error).message, "error");
    }
  };

  const handleCancelEdit = () => {
    setEditingId(null);
    setEditingTitle("");
    setEditingDriveLink("");
    setEditingOferta("");
    setEditingNicho("");
    setEditingTrafego("");
    setEditingIdioma("");
  };

  const uniqueOfertas = Array.from(
    new Set(
      criativos
        .map((c) => c.oferta?.title)
        .filter((title): title is string => Boolean(title))
    )
  );

  const filteredCriativos = criativos.filter((c) => {
    // Filtro por tipo (com/sem oferta)
    if (filterType === "with-offer" && !c.oferta_id) return false;
    if (filterType === "without-offer" && c.oferta_id) return false;

    // Filtro por oferta específica
    const matchesOferta = filterOferta
      ? c.oferta?.title === filterOferta
      : true;

    // Filtro por busca
    const matchesSearch = c.title
      .toLowerCase()
      .includes(searchTerm.toLowerCase()) || 
      c.oferta?.title?.toLowerCase().includes(searchTerm.toLowerCase());
    
    return matchesOferta && matchesSearch;
  });

  const criativosSemOferta = criativos.filter(c => !c.oferta_id).length;
  const criativosComOferta = criativos.filter(c => c.oferta_id).length;

  return (
    <div className="flex-1 p-6 bg-[#0f0f0f] text-white min-h-screen relative">
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

      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center gap-2 mb-2">
          <Image
            src="/icons/criativos.svg"
            alt="Criativos"
            width={22}
            height={18}
          />
          <h2 className="text-xl font-bold">Gerenciar Criativos</h2>
        </div>
        <hr className="border-gray-700" />
      </div>

      {/* Statistics */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <div className="bg-[#141414] p-4 rounded-lg border border-gray-700">
          <div className="text-gray-400 text-sm mb-1">Total de Criativos</div>
          <div className="text-3xl font-bold text-blue-400">{criativos.length}</div>
        </div>
        <div className="bg-[#141414] p-4 rounded-lg border border-gray-700">
          <div className="text-gray-400 text-sm mb-1">Com Oferta Associada</div>
          <div className="text-3xl font-bold text-green-400">{criativosComOferta}</div>
        </div>
        <div className="bg-[#141414] p-4 rounded-lg border border-gray-700">
          <div className="text-gray-400 text-sm mb-1">Sem Oferta</div>
          <div className="text-3xl font-bold text-purple-400">{criativosSemOferta}</div>
        </div>
      </div>

      {/* Add Form */}
      <div className="bg-[#141414] p-6 rounded-lg mb-8 border border-gray-700">
        <h3 className="text-lg font-semibold mb-4">Adicionar Novo Criativo</h3>
        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <input
              type="text"
              placeholder="Título do Criativo *"
              value={criativoTitle}
              onChange={(e) => setCriativoTitle(e.target.value)}
              className="p-3 bg-[#1f1f1f] rounded-lg text-white placeholder-gray-400 border border-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />

            <select
              value={selectedOferta}
              onChange={(e) => setSelectedOferta(e.target.value)}
              className="p-3 bg-[#1f1f1f] rounded-lg text-white border border-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">Sem oferta (opcional)</option>
              {ofertas.map((o) => (
                <option key={o.id} value={o.id}>
                  {o.title}
                </option>
              ))}
            </select>
          </div>

          {/* Novos campos: Nicho, Tráfego, Idioma */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <input
              type="text"
              placeholder="Nicho"
              value={nicho}
              onChange={(e) => setNicho(e.target.value)}
              className="p-3 bg-[#1f1f1f] rounded-lg text-white placeholder-gray-400 border border-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />

            <select
              value={trafego}
              onChange={(e) => setTrafego(e.target.value)}
              className="p-3 bg-[#1f1f1f] rounded-lg text-white border border-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">Selecione o Tráfego</option>
              {TRAFEGO_OPTIONS.map((opt, idx) => (
                <option key={idx} value={opt}>{opt}</option>
              ))}
            </select>

            <select
              value={idioma}
              onChange={(e) => setIdioma(e.target.value)}
              className="p-3 bg-[#1f1f1f] rounded-lg text-white border border-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">Selecione o Idioma</option>
              {IDIOMA_OPTIONS.map((opt, idx) => (
                <option key={idx} value={opt}>{opt}</option>
              ))}
            </select>
          </div>

          <div className="flex gap-4">
            <input
              type="text"
              placeholder="Google Drive link *"
              value={driveLink}
              onChange={(e) => setDriveLink(e.target.value)}
              className="flex-1 p-3 bg-[#1f1f1f] rounded-lg text-white placeholder-gray-400 border border-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />

            <button 
              onClick={handleAddCriativo}
              className="bg-blue-600 hover:bg-blue-700 px-6 py-3 rounded-lg font-semibold transition-colors"
            >
              Adicionar
            </button>
          </div>

          <p className="text-gray-500 text-sm">
            💡 Dica: A capa será automaticamente extraída do arquivo do Google Drive!
          </p>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-[#141414] p-4 rounded-lg mb-6 border border-gray-700">
        <div className="flex flex-wrap gap-4 items-center">
          <input
            type="text"
            placeholder="🔍 Buscar criativos..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="flex-1 min-w-[200px] p-2 bg-[#1f1f1f] rounded-lg text-white placeholder-gray-400 border border-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
          />

          <select
            value={filterType}
            onChange={(e) => setFilterType(e.target.value as any)}
            className="p-2 bg-[#1f1f1f] rounded-lg text-white border border-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="all">Todos os criativos</option>
            <option value="with-offer">Com oferta</option>
            <option value="without-offer">Sem oferta</option>
          </select>

          {filterType !== "without-offer" && (
            <select
              value={filterOferta || ""}
              onChange={(e) => setFilterOferta(e.target.value || null)}
              className="p-2 bg-[#1f1f1f] rounded-lg text-white border border-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">Todas as ofertas</option>
              {uniqueOfertas.map((oferta) => (
                <option key={oferta} value={oferta}>
                  {oferta}
                </option>
              ))}
            </select>
          )}

          {(searchTerm || filterOferta || filterType !== "all") && (
            <button
              onClick={() => {
                setSearchTerm("");
                setFilterOferta(null);
                setFilterType("all");
              }}
              className="px-4 py-2 bg-gray-600 hover:bg-gray-700 rounded-lg text-sm transition-colors"
            >
              Limpar filtros
            </button>
          )}
        </div>
      </div>

      {/* Content Grid */}
      {filteredCriativos.length === 0 ? (
        <div className="text-center py-12">
          <div className="text-6xl mb-4">🎨</div>
          <p className="text-gray-400 text-lg mb-2">
            {searchTerm || filterOferta || filterType !== "all"
              ? "Nenhum criativo encontrado com esses filtros"
              : "Nenhum criativo disponível"}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {filteredCriativos.map((criativo) => (
            <div
              key={criativo.id}
              className="bg-[#141414] shadow rounded-lg overflow-hidden relative group min-w-0 hover:shadow-lg transition-shadow border border-gray-700"
            >
              <div className="relative">
                {criativo.drive_link ? (
                  <div className="w-full h-40 bg-gray-900 flex items-center justify-center overflow-hidden">
                    <img
                      src={getDrivePreview(criativo.drive_link)}
                      alt={criativo.title}
                      className="w-full h-full object-cover"
                      loading="lazy"
                      onError={(e) => {
                        // Fallback: tenta usar a thumbnail da oferta ou imagem padrão
                        const target = e.target as HTMLImageElement;
                        if (criativo.oferta?.thumbnail) {
                          target.src = getOptimizedImageUrl(criativo.oferta.thumbnail);
                        } else {
                          target.src = "/default-creative.jpg";
                        }
                      }}
                    />
                  </div>
                ) : (
                  <img
                    src={criativo.oferta?.thumbnail ? getOptimizedImageUrl(criativo.oferta.thumbnail) : "/default-creative.jpg"}
                    alt={criativo.title}
                    className="w-full h-40 object-cover"
                    loading="lazy"
                  />
                )}
                <div className="absolute inset-0 bg-gradient-to-t from-black/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
                
                {/* Status Badge */}
                <div className="absolute top-2 left-2">
                  {criativo.oferta_id ? (
                    <span className="bg-green-500 text-white text-xs px-2 py-1 rounded-full">
                      Com Oferta
                    </span>
                  ) : (
                    <span className="bg-purple-500 text-white text-xs px-2 py-1 rounded-full">
                      Livre
                    </span>
                  )}
                </div>

                {/* Admin Actions Overlay */}
                <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity flex gap-1">
                  {editingId === criativo.id ? (
                    <>
                      <button
                        onClick={() => handleSaveEdit(criativo.id)}
                        className="bg-green-500 text-white text-xs px-2 py-1 rounded-full hover:bg-green-600 transition-colors"
                      >
                        ✓
                      </button>
                      <button
                        onClick={handleCancelEdit}
                        className="bg-gray-500 text-white text-xs px-2 py-1 rounded-full hover:bg-gray-600 transition-colors"
                      >
                        ✕
                      </button>
                    </>
                  ) : (
                    <>
                      <button
                        onClick={() => handleEdit(criativo)}
                        className="bg-yellow-500 text-white text-xs px-2 py-1 rounded-full hover:bg-yellow-600 transition-colors"
                      >
                        ✎
                      </button>
                      <button
                        onClick={() => handleDelete(criativo.id)}
                        className="bg-red-500 text-white text-xs px-2 py-1 rounded-full hover:bg-red-600 transition-colors"
                      >
                        🗑
                      </button>
                    </>
                  )}
                </div>

                {/* Drive Link Action */}
                {criativo.drive_link && editingId !== criativo.id && (
                  <div className="absolute bottom-2 left-2 opacity-0 group-hover:opacity-100 transition-opacity">
                    <a
                      href={criativo.drive_link}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="bg-blue-500 text-white text-xs px-2 py-1 rounded-full flex items-center gap-1 hover:bg-blue-600 transition-colors"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <span>🔗</span>
                      <span>Abrir</span>
                    </a>
                  </div>
                )}
              </div>
              
              <div className="p-4">
                {/* Title - Editable */}
                {editingId === criativo.id ? (
                  <input
                    type="text"
                    value={editingTitle}
                    onChange={(e) => setEditingTitle(e.target.value)}
                    className="w-full p-2 bg-[#1f1f1f] rounded text-white text-sm mb-2 border border-gray-600 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="Título..."
                  />
                ) : (
                  <h3 className="font-semibold text-white mb-1 line-clamp-2 group-hover:text-blue-300 transition-colors">
                    {criativo.title}
                  </h3>
                )}

                {/* Oferta - Editable */}
                {editingId === criativo.id ? (
                  <>
                    <select
                      value={editingOferta}
                      onChange={(e) => setEditingOferta(e.target.value)}
                      className="w-full p-2 bg-[#1f1f1f] rounded text-white text-sm mb-2 border border-gray-600 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >
                      <option value="">Sem oferta</option>
                      {ofertas.map((o) => (
                        <option key={o.id} value={o.id}>
                          {o.title}
                        </option>
                      ))}
                    </select>

                    {/* Campos editáveis: Nicho, Tráfego, Idioma */}
                    <input
                      type="text"
                      placeholder="Nicho"
                      value={editingNicho}
                      onChange={(e) => setEditingNicho(e.target.value)}
                      className="w-full p-2 bg-[#1f1f1f] rounded text-white text-sm mb-2 border border-gray-600 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />

                    <select
                      value={editingTrafego}
                      onChange={(e) => setEditingTrafego(e.target.value)}
                      className="w-full p-2 bg-[#1f1f1f] rounded text-white text-sm mb-2 border border-gray-600 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >
                      <option value="">Selecione o Tráfego</option>
                      {TRAFEGO_OPTIONS.map((opt, idx) => (
                        <option key={idx} value={opt}>{opt}</option>
                      ))}
                    </select>

                    <select
                      value={editingIdioma}
                      onChange={(e) => setEditingIdioma(e.target.value)}
                      className="w-full p-2 bg-[#1f1f1f] rounded text-white text-sm mb-2 border border-gray-600 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >
                      <option value="">Selecione o Idioma</option>
                      {IDIOMA_OPTIONS.map((opt, idx) => (
                        <option key={idx} value={opt}>{opt}</option>
                      ))}
                    </select>
                  </>
                ) : (
                  <>
                    <p className="text-gray-400 text-sm mb-2">
                      {criativo.oferta?.title || "Sem oferta associada"}
                    </p>
                    
                    {/* Mostrar badges dos novos campos */}
                    <div className="flex flex-wrap gap-1 mb-2">
                      {criativo.nicho && (
                        <span className="px-2 py-1 bg-yellow-600/20 text-yellow-200 font-bold rounded text-xs">
                          {criativo.nicho}
                        </span>
                      )}
                      {criativo.trafego && (
                        <span className="px-2 py-1 bg-pink-600/20 text-pink-200 font-bold rounded text-xs">
                          {criativo.trafego}
                        </span>
                      )}
                      {criativo.idioma && (
                        <span className="px-2 py-1 bg-purple-600/20 text-purple-200 font-bold rounded text-xs">
                          {criativo.idioma}
                        </span>
                      )}
                    </div>
                  </>
                )}
                
                {/* Drive Link - Editable */}
                <div className="mb-3">
                  {editingId === criativo.id ? (
                    <input
                      type="text"
                      value={editingDriveLink}
                      onChange={(e) => setEditingDriveLink(e.target.value)}
                      className="w-full p-2 bg-[#1f1f1f] rounded text-white text-sm border border-gray-600 focus:outline-none focus:ring-2 focus:ring-blue-500"
                      placeholder="Drive link..."
                    />
                  ) : (
                    <span className="text-gray-500 text-xs block truncate">
                      {criativo.drive_link || "Sem link"}
                    </span>
                  )}
                </div>

                {/* Categories da oferta */}
                {criativo.oferta && (
                  <div className="flex flex-wrap gap-2">
                    {criativo.oferta.tipo && (
                      <span className="px-2 py-1 bg-blue-600/20 text-blue-200 font-bold rounded-lg text-xs">
                        {criativo.oferta.tipo}
                      </span>
                    )}
                    {criativo.oferta.idioma && (
                      <span className="px-2 py-1 bg-purple-600/20 text-purple-200 font-bold rounded-lg text-xs">
                        {criativo.oferta.idioma}
                      </span>
                    )}
                    {criativo.oferta.nicho && (
                      <span className="px-2 py-1 bg-yellow-600/20 text-yellow-200 font-bold rounded-lg text-xs">
                        {criativo.oferta.nicho}
                      </span>
                    )}
                  </div>
                )}
              </div>
            </div>
          ))}
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
