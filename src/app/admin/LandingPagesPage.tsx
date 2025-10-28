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

interface Oferta {
  id: string;
  title: string;
}

interface Criativo {
  id: string;
  title: string;
}

interface ToastNotification {
  id: number;
  message: string;
  type: 'success' | 'error' | 'info';
}

export default function LandingPagesPage() {
  const [landingPages, setLandingPages] = useState<LandingPage[]>([]);
  const [ofertas, setOfertas] = useState<Oferta[]>([]);
  const [criativos, setCriativos] = useState<Criativo[]>([]);
  
  // Form states
  const [title, setTitle] = useState("");
  const [pageUrl, setPageUrl] = useState("");
  const [associationType, setAssociationType] = useState<'oferta' | 'criativo' | ''>('');
  const [selectedOferta, setSelectedOferta] = useState("");
  const [selectedCriativo, setSelectedCriativo] = useState("");
  
  // Edit states
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingTitle, setEditingTitle] = useState("");
  const [editingPageUrl, setEditingPageUrl] = useState("");
  const [editingAssociationType, setEditingAssociationType] = useState<'oferta' | 'criativo' | ''>('');
  const [editingOferta, setEditingOferta] = useState("");
  const [editingCriativo, setEditingCriativo] = useState("");
  
  const [searchTerm, setSearchTerm] = useState("");
  const [filterType, setFilterType] = useState<"all" | "oferta" | "criativo">("all");
  const [toasts, setToasts] = useState<ToastNotification[]>([]);
  const [confirmModal, setConfirmModal] = useState<{ show: boolean; message: string; onConfirm: () => void } | null>(null);

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

  useEffect(() => {
    const fetchData = async () => {
      // Fetch ofertas
      const { data: ofertasData } = await supabase
        .from("contents")
        .select("id, title")
        .order("title", { ascending: true });

      // Fetch criativos
      const { data: criativosData } = await supabase
        .from("criativos")
        .select("id, title")
        .order("title", { ascending: true });

      // Fetch landing pages
      const { data: landingPagesData } = await supabase
        .from("landing_pages")
        .select(`
          *,
          oferta:contents!landing_pages_oferta_id_fkey (title),
          criativo:criativos!landing_pages_criativo_id_fkey (title)
        `)
        .order("created_at", { ascending: false });

      if (ofertasData) setOfertas(ofertasData);
      if (criativosData) setCriativos(criativosData);
      if (landingPagesData) setLandingPages(landingPagesData);
    };

    fetchData();
  }, []);

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!title.trim()) {
      showToast("Insira um título para a página!", "error");
      return;
    }

    if (!pageUrl.trim()) {
      showToast("Insira o URL da página!", "error");
      return;
    }

    if (!associationType) {
      showToast("Selecione o tipo de associação!", "error");
      return;
    }

    if (associationType === 'oferta' && !selectedOferta) {
      showToast("Selecione uma oferta!", "error");
      return;
    }

    if (associationType === 'criativo' && !selectedCriativo) {
      showToast("Selecione um criativo!", "error");
      return;
    }

    try {
      const newLandingPage: any = {
        title: title.trim(),
        page_url: pageUrl.trim(),
        association_type: associationType,
        oferta_id: associationType === 'oferta' ? selectedOferta : null,
        criativo_id: associationType === 'criativo' ? selectedCriativo : null,
      };

      const { data, error } = await supabase
        .from("landing_pages")
        .insert(newLandingPage)
        .select(`
          *,
          oferta:contents!landing_pages_oferta_id_fkey (title),
          criativo:criativos!landing_pages_criativo_id_fkey (title)
        `)
        .single();

      if (error) throw error;

      setLandingPages([data, ...landingPages]);
      setTitle("");
      setPageUrl("");
      setAssociationType('');
      setSelectedOferta("");
      setSelectedCriativo("");
      
      showToast("Página adicionada com sucesso!", "success");
    } catch (error) {
      console.error(error);
      showToast("Erro ao adicionar página: " + (error as Error).message, "error");
    }
  };

  const handleDelete = async (id: string) => {
    const confirmed = await showConfirm("Tem certeza que deseja excluir esta página?");
    if (!confirmed) return;

    try {
      const { error } = await supabase.from("landing_pages").delete().eq("id", id);
      if (error) throw error;

      setLandingPages(landingPages.filter((p) => p.id !== id));
      showToast("Página excluída com sucesso!", "success");
    } catch (error) {
      console.error(error);
      showToast("Erro ao excluir página: " + (error as Error).message, "error");
    }
  };

  const handleEdit = (page: LandingPage) => {
    setEditingId(page.id);
    setEditingTitle(page.title);
    setEditingPageUrl(page.page_url);
    setEditingAssociationType(page.association_type || '');
    setEditingOferta(page.oferta_id || "");
    setEditingCriativo(page.criativo_id || "");
  };

  const handleSaveEdit = async (id: string) => {
    if (!editingTitle.trim()) {
      showToast("O título não pode estar vazio!", "error");
      return;
    }

    if (!editingPageUrl.trim()) {
      showToast("O URL não pode estar vazio!", "error");
      return;
    }

    if (!editingAssociationType) {
      showToast("Selecione o tipo de associação!", "error");
      return;
    }

    try {
      const updateData: any = {
        title: editingTitle.trim(),
        page_url: editingPageUrl.trim(),
        association_type: editingAssociationType,
        oferta_id: editingAssociationType === 'oferta' ? editingOferta : null,
        criativo_id: editingAssociationType === 'criativo' ? editingCriativo : null,
      };

      const { data, error } = await supabase
        .from("landing_pages")
        .update(updateData)
        .eq("id", id)
        .select(`
          *,
          oferta:contents!landing_pages_oferta_id_fkey (title),
          criativo:criativos!landing_pages_criativo_id_fkey (title)
        `)
        .single();

      if (error) throw error;

      setLandingPages(landingPages.map((p) => (p.id === id ? data : p)));
      setEditingId(null);
      setEditingTitle("");
      setEditingPageUrl("");
      setEditingAssociationType('');
      setEditingOferta("");
      setEditingCriativo("");
      showToast("Página atualizada com sucesso!", "success");
    } catch (error) {
      console.error(error);
      showToast("Erro ao editar página: " + (error as Error).message, "error");
    }
  };

  const handleCancelEdit = () => {
    setEditingId(null);
    setEditingTitle("");
    setEditingPageUrl("");
    setEditingAssociationType('');
    setEditingOferta("");
    setEditingCriativo("");
  };

  const filteredPages = landingPages.filter((p) => {
    const matchesType = 
      filterType === "all" ? true :
      filterType === "oferta" ? p.association_type === 'oferta' :
      filterType === "criativo" ? p.association_type === 'criativo' : true;

    const matchesSearch = 
      p.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
      p.page_url.toLowerCase().includes(searchTerm.toLowerCase()) ||
      p.oferta?.title?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      p.criativo?.title?.toLowerCase().includes(searchTerm.toLowerCase());
    
    return matchesType && matchesSearch;
  });

  const pagesComOferta = landingPages.filter(p => p.association_type === 'oferta').length;
  const pagesComCriativo = landingPages.filter(p => p.association_type === 'criativo').length;

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
          <span className="text-2xl">🔗</span>
          <h2 className="text-xl font-bold">Gerenciar Páginas de Anúncios</h2>
        </div>
        <hr className="border-gray-700" />
      </div>

      {/* Statistics */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <div className="bg-[#141414] p-4 rounded-lg border border-gray-700">
          <div className="text-gray-400 text-sm mb-1">Total de Páginas</div>
          <div className="text-3xl font-bold text-blue-400">{landingPages.length}</div>
        </div>
        <div className="bg-[#141414] p-4 rounded-lg border border-gray-700">
          <div className="text-gray-400 text-sm mb-1">Associadas a Ofertas</div>
          <div className="text-3xl font-bold text-green-400">{pagesComOferta}</div>
        </div>
        <div className="bg-[#141414] p-4 rounded-lg border border-gray-700">
          <div className="text-gray-400 text-sm mb-1">Associadas a Criativos</div>
          <div className="text-3xl font-bold text-purple-400">{pagesComCriativo}</div>
        </div>
      </div>

      {/* Add Form */}
      <div className="bg-[#141414] p-6 rounded-lg mb-8 border border-gray-700">
        <h3 className="text-lg font-semibold mb-4">Adicionar Nova Página</h3>
        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <input
              type="text"
              placeholder="Título da Página *"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="p-3 bg-[#1f1f1f] rounded-lg text-white placeholder-gray-400 border border-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />

            <input
              type="url"
              placeholder="URL da Página (https://...) *"
              value={pageUrl}
              onChange={(e) => setPageUrl(e.target.value)}
              className="p-3 bg-[#1f1f1f] rounded-lg text-white placeholder-gray-400 border border-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <select
              value={associationType}
              onChange={(e) => {
                setAssociationType(e.target.value as 'oferta' | 'criativo' | '');
                setSelectedOferta("");
                setSelectedCriativo("");
              }}
              className="p-3 bg-[#1f1f1f] rounded-lg text-white border border-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">Selecione o Tipo de Associação *</option>
              <option value="oferta">Associar a Oferta</option>
              <option value="criativo">Associar a Criativo</option>
            </select>

            {associationType === 'oferta' && (
              <select
                value={selectedOferta}
                onChange={(e) => setSelectedOferta(e.target.value)}
                className="p-3 bg-[#1f1f1f] rounded-lg text-white border border-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">Selecione a Oferta *</option>
                {ofertas.map((o) => (
                  <option key={o.id} value={o.id}>
                    {o.title}
                  </option>
                ))}
              </select>
            )}

            {associationType === 'criativo' && (
              <select
                value={selectedCriativo}
                onChange={(e) => setSelectedCriativo(e.target.value)}
                className="p-3 bg-[#1f1f1f] rounded-lg text-white border border-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">Selecione o Criativo *</option>
                {criativos.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.title}
                  </option>
                ))}
              </select>
            )}
          </div>

          <button 
            onClick={handleAdd}
            className="w-full md:w-auto bg-blue-600 hover:bg-blue-700 px-6 py-3 rounded-lg font-semibold transition-colors"
          >
            Adicionar Página
          </button>

          <p className="text-gray-500 text-sm">
            💡 Dica: Cole o link do anúncio externo e associe a uma oferta ou criativo para rastreamento.
          </p>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-[#141414] p-4 rounded-lg mb-6 border border-gray-700">
        <div className="flex flex-wrap gap-4 items-center">
          <input
            type="text"
            placeholder="🔍 Buscar páginas..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="flex-1 min-w-[200px] p-2 bg-[#1f1f1f] rounded-lg text-white placeholder-gray-400 border border-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
          />

          <select
            value={filterType}
            onChange={(e) => setFilterType(e.target.value as any)}
            className="p-2 bg-[#1f1f1f] rounded-lg text-white border border-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="all">Todas as páginas</option>
            <option value="oferta">Associadas a Ofertas</option>
            <option value="criativo">Associadas a Criativos</option>
          </select>

          {(searchTerm || filterType !== "all") && (
            <button
              onClick={() => {
                setSearchTerm("");
                setFilterType("all");
              }}
              className="px-4 py-2 bg-gray-600 hover:bg-gray-700 rounded-lg text-sm transition-colors"
            >
              Limpar filtros
            </button>
          )}
        </div>
      </div>

      {/* Content Table */}
      {filteredPages.length === 0 ? (
        <div className="text-center py-12">
          <div className="text-6xl mb-4">🔗</div>
          <p className="text-gray-400 text-lg mb-2">
            {searchTerm || filterType !== "all"
              ? "Nenhuma página encontrada com esses filtros"
              : "Nenhuma página disponível"}
          </p>
        </div>
      ) : (
        <div className="bg-[#141414] rounded-lg border border-gray-700 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-[#1f1f1f]">
                <tr>
                  <th className="px-4 py-3 text-left text-sm font-semibold text-gray-300">Título</th>
                  <th className="px-4 py-3 text-left text-sm font-semibold text-gray-300">URL</th>
                  <th className="px-4 py-3 text-left text-sm font-semibold text-gray-300">Tipo</th>
                  <th className="px-4 py-3 text-left text-sm font-semibold text-gray-300">Associado a</th>
                  <th className="px-4 py-3 text-center text-sm font-semibold text-gray-300">Ações</th>
                </tr>
              </thead>
              <tbody>
                {filteredPages.map((page) => (
                  <tr key={page.id} className="border-t border-gray-700 hover:bg-[#1a1a1a] transition-colors">
                    {editingId === page.id ? (
                      <>
                        <td className="px-4 py-3">
                          <input
                            type="text"
                            value={editingTitle}
                            onChange={(e) => setEditingTitle(e.target.value)}
                            className="w-full p-2 bg-[#1f1f1f] rounded text-white text-sm border border-gray-600 focus:outline-none focus:ring-2 focus:ring-blue-500"
                          />
                        </td>
                        <td className="px-4 py-3">
                          <input
                            type="url"
                            value={editingPageUrl}
                            onChange={(e) => setEditingPageUrl(e.target.value)}
                            className="w-full p-2 bg-[#1f1f1f] rounded text-white text-sm border border-gray-600 focus:outline-none focus:ring-2 focus:ring-blue-500"
                          />
                        </td>
                        <td className="px-4 py-3">
                          <select
                            value={editingAssociationType}
                            onChange={(e) => {
                              setEditingAssociationType(e.target.value as 'oferta' | 'criativo' | '');
                              setEditingOferta("");
                              setEditingCriativo("");
                            }}
                            className="w-full p-2 bg-[#1f1f1f] rounded text-white text-sm border border-gray-600 focus:outline-none focus:ring-2 focus:ring-blue-500"
                          >
                            <option value="">Selecione</option>
                            <option value="oferta">Oferta</option>
                            <option value="criativo">Criativo</option>
                          </select>
                        </td>
                        <td className="px-4 py-3">
                          {editingAssociationType === 'oferta' && (
                            <select
                              value={editingOferta}
                              onChange={(e) => setEditingOferta(e.target.value)}
                              className="w-full p-2 bg-[#1f1f1f] rounded text-white text-sm border border-gray-600 focus:outline-none focus:ring-2 focus:ring-blue-500"
                            >
                              <option value="">Selecione</option>
                              {ofertas.map((o) => (
                                <option key={o.id} value={o.id}>{o.title}</option>
                              ))}
                            </select>
                          )}
                          {editingAssociationType === 'criativo' && (
                            <select
                              value={editingCriativo}
                              onChange={(e) => setEditingCriativo(e.target.value)}
                              className="w-full p-2 bg-[#1f1f1f] rounded text-white text-sm border border-gray-600 focus:outline-none focus:ring-2 focus:ring-blue-500"
                            >
                              <option value="">Selecione</option>
                              {criativos.map((c) => (
                                <option key={c.id} value={c.id}>{c.title}</option>
                              ))}
                            </select>
                          )}
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex justify-center gap-2">
                            <button
                              onClick={() => handleSaveEdit(page.id)}
                              className="px-3 py-1 bg-green-600 hover:bg-green-700 rounded text-xs transition-colors"
                            >
                              ✓
                            </button>
                            <button
                              onClick={handleCancelEdit}
                              className="px-3 py-1 bg-gray-600 hover:bg-gray-700 rounded text-xs transition-colors"
                            >
                              ✕
                            </button>
                          </div>
                        </td>
                      </>
                    ) : (
                      <>
                        <td className="px-4 py-3">
                          <span className="text-white font-medium">{page.title}</span>
                        </td>
                        <td className="px-4 py-3">
                          <a 
                            href={page.page_url} 
                            target="_blank" 
                            rel="noopener noreferrer"
                            className="text-blue-400 hover:text-blue-300 text-sm truncate block max-w-xs"
                          >
                            {page.page_url}
                          </a>
                        </td>
                        <td className="px-4 py-3">
                          <span className={`px-2 py-1 rounded-full text-xs font-semibold ${
                            page.association_type === 'oferta' 
                              ? 'bg-green-600/20 text-green-200' 
                              : 'bg-purple-600/20 text-purple-200'
                          }`}>
                            {page.association_type === 'oferta' ? 'Oferta' : 'Criativo'}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <span className="text-gray-300 text-sm">
                            {page.association_type === 'oferta' 
                              ? page.oferta?.title 
                              : page.criativo?.title}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex justify-center gap-2">
                            <button
                              onClick={() => handleEdit(page)}
                              className="px-3 py-1 bg-yellow-600 hover:bg-yellow-700 rounded text-xs transition-colors"
                            >
                              ✎
                            </button>
                            <button
                              onClick={() => handleDelete(page.id)}
                              className="px-3 py-1 bg-red-600 hover:bg-red-700 rounded text-xs transition-colors"
                            >
                              🗑
                            </button>
                          </div>
                        </td>
                      </>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
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
