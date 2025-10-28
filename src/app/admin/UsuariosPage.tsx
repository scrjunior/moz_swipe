"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/supabaseClient";
import emailjs from '@emailjs/browser';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableHeader,
  TableRow,
  TableHead,
  TableBody,
  TableCell,
} from "@/components/ui/table";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";

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

interface User {
  id: string;
  name: string;
  email: string;
  phone?: string;
  expires_at?: string;
  previous_expires_at?: string;
  paused: boolean;
  password_setup_token?: string;
  password_setup_expires?: string;
  created_at?: string;
}

interface ToastNotification {
  id: number;
  message: string;
  type: 'success' | 'error' | 'info';
}

// Initialize EmailJS
const EMAILJS_SERVICE_ID = process.env.NEXT_PUBLIC_EMAILJS_SERVICE_ID || 'service_nugcfmt';
const EMAILJS_TEMPLATE_ID = process.env.NEXT_PUBLIC_EMAILJS_TEMPLATE_ID || 'template_52t4s4s';
const EMAILJS_PUBLIC_KEY = process.env.NEXT_PUBLIC_EMAILJS_PUBLIC_KEY || '43BQC37BapqHvCwx-';

/** Utility: parse ISO timestamp to JS Date (or null) */
function parseDateField(field: any): Date | null {
  if (!field) return null;
  return new Date(field);
}

/** Generate a secure random token */
function generatePasswordSetupToken(): string {
  const array = new Uint8Array(32);
  crypto.getRandomValues(array);
  return Array.from(array, byte => byte.toString(16).padStart(2, '0')).join('');
}

/** Status helper */
function getUserStatus(user: User) {
  const now = new Date();
  const expiresAt = parseDateField(user.expires_at);
  const previous = parseDateField(user.previous_expires_at);
  const paused = !!user.paused;

  if (paused) {
    if (previous) {
      const diffDays = Math.ceil(
        (previous.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)
      );
      return {
        label: `Pausado (${diffDays > 0 ? `${diffDays} dias restantes` : "Expirado"})`,
        color: "text-yellow-400",
      };
    }
    return { label: "Pausado", color: "text-yellow-400" };
  }

  if (!expiresAt) return { label: "Sem Assinatura", color: "text-gray-400" };

  if (expiresAt > now) {
    const diffDays = Math.ceil(
      (expiresAt.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)
    );
    return { label: `Ativo (${diffDays} dias restantes)`, color: "text-green-500" };
  }

  return { label: "Expirado", color: "text-red-500" };
}

/** Send password setup email to user */
async function sendPasswordSetupEmail(userEmail: string, userName: string, setupToken: string) {
  try {
    const setupLink = `${window.location.origin}/login?setup=${setupToken}&email=${encodeURIComponent(userEmail)}`;
    
    const templateParams = {
      to_email: userEmail,
      to_name: userName,
      setup_link: setupLink,
      message: `Olá ${userName}, sua conta foi criada! Clique no link abaixo para definir sua senha e acessar sua conta.`,
      subject: "Configure sua senha - Conta criada com sucesso",
    };

    await emailjs.send(
      EMAILJS_SERVICE_ID,
      EMAILJS_TEMPLATE_ID,
      templateParams,
      EMAILJS_PUBLIC_KEY
    );

    return true;
  } catch (error) {
    console.error('Error sending password setup email:', error);
    return false;
  }
}

export default function UsuariosPage() {
  const [users, setUsers] = useState<User[]>([]);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [open, setOpen] = useState(false);
  const [editingUserId, setEditingUserId] = useState<string | null>(null);
  const [sendingEmail, setSendingEmail] = useState(false);
  const [toasts, setToasts] = useState<ToastNotification[]>([]);
  const [confirmModal, setConfirmModal] = useState<{ show: boolean; message: string; onConfirm: () => void } | null>(null);
  const [, forceUpdate] = useState({});

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
    const interval = setInterval(() => {
      forceUpdate({});
    }, 1000 * 60 * 60 * 24);
    return () => clearInterval(interval);
  }, []);

  // Load users from Supabase
  useEffect(() => {
    const fetchUsers = async () => {
      try {
        const { data, error } = await supabase
          .from('users')
          .select('*')
          .order('created_at', { ascending: false });

        if (error) {
          console.error('Error fetching users:', error);
          return;
        }

        setUsers(data || []);
      } catch (error) {
        console.error('Error fetching users:', error);
      }
    };
    fetchUsers();
  }, []);

  const openCreateDialog = () => {
    setEditingUserId(null);
    setName("");
    setEmail("");
    setPhone("");
    setOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!name || !email || !phone) {
      showToast("Preencha todos os campos.", "error");
      return;
    }

    setSendingEmail(true);

    if (editingUserId) {
      try {
        const { error } = await supabase
          .from('users')
          .update({
            name,
            email,
            phone,
          })
          .eq('id', editingUserId);

        if (error) {
          throw error;
        }

        setUsers((prev) =>
          prev.map((u) =>
            u.id === editingUserId 
              ? { ...u, name, email, phone } 
              : u
          )
        );
        setEditingUserId(null);
        setOpen(false);
        showToast("Usuário atualizado com sucesso!", "success");
      } catch (err) {
        console.error("Erro ao atualizar usuário:", err);
        showToast("Erro ao atualizar usuário: " + (err as Error).message, "error");
      } finally {
        setSendingEmail(false);
      }
      return;
    }

    // Create new user
    const expirationDate = new Date();
    expirationDate.setMonth(expirationDate.getMonth() + 1);

    // Generate password setup token that expires in 7 days
    const setupToken = generatePasswordSetupToken();
    const setupExpires = new Date();
    setupExpires.setDate(setupExpires.getDate() + 7);

    try {
      const { data, error } = await supabase
        .from('users')
        .insert({
          name,
          email,
          phone,
          expires_at: expirationDate.toISOString(),
          paused: false,
          password_setup_token: setupToken,
          password_setup_expires: setupExpires.toISOString(),
        })
        .select()
        .single();

      if (error) {
        throw error;
      }

      // Send password setup email
      const emailSent = await sendPasswordSetupEmail(email, name, setupToken);
      
      if (emailSent) {
        showToast(`Usuário criado! Email enviado para ${email}`, "success");
      } else {
        showToast("Usuário criado, mas houve um erro ao enviar o email.", "error");
      }

      // Add to local state
      const newUser: User = {
        id: data.id,
        name,
        email,
        phone,
        expires_at: data.expires_at,
        paused: false,
        password_setup_token: setupToken,
        password_setup_expires: data.password_setup_expires,
        created_at: data.created_at
      };

      setUsers((prev) => [newUser, ...prev]);
      setName("");
      setEmail("");
      setPhone("");
      setOpen(false);
    } catch (err) {
      console.error("Erro ao criar usuário:", err);
      showToast("Erro ao criar usuário: " + (err as Error).message, "error");
    } finally {
      setSendingEmail(false);
    }
  };

  const handleEditUser = (user: User) => {
    setEditingUserId(user.id);
    setName(user.name || "");
    setEmail(user.email || "");
    setPhone(user.phone || "");
    setOpen(true);
  };

  const handleDeleteUser = async (id: string) => {
    const confirmed = await showConfirm("Tem certeza que deseja remover este usuário?");
    if (!confirmed) return;
    
    try {
      const { error } = await supabase
        .from('users')
        .delete()
        .eq('id', id);

      if (error) {
        throw error;
      }

      setUsers((prev) => prev.filter((u) => u.id !== id));
      showToast("Usuário removido com sucesso!", "success");
    } catch (err) {
      console.error("Erro ao remover usuário:", err);
      showToast("Erro ao remover usuário: " + (err as Error).message, "error");
    }
  };

  const handleResendSetupEmail = async (user: User) => {
    setSendingEmail(true);
    
    try {
      // Generate new setup token and expiration
      const setupToken = generatePasswordSetupToken();
      const setupExpires = new Date();
      setupExpires.setDate(setupExpires.getDate() + 7);

      // Update user with new token
      const { error } = await supabase
        .from('users')
        .update({
          password_setup_token: setupToken,
          password_setup_expires: setupExpires.toISOString(),
        })
        .eq('id', user.id);

      if (error) {
        throw error;
      }

      // Send new setup email
      const emailSent = await sendPasswordSetupEmail(user.email, user.name, setupToken);
      
      if (emailSent) {
        showToast(`Email reenviado para ${user.email}`, "success");
        
        // Update local state
        setUsers((prev) =>
          prev.map((u) =>
            u.id === user.id 
              ? { 
                  ...u, 
                  password_setup_token: setupToken,
                  password_setup_expires: setupExpires.toISOString()
                }
              : u
          )
        );
      } else {
        showToast("Erro ao reenviar email. Verifique as configurações.", "error");
      }
    } catch (err) {
      console.error("Erro ao reenviar email:", err);
      showToast("Erro ao reenviar email: " + (err as Error).message, "error");
    } finally {
      setSendingEmail(false);
    }
  };

  const handlePauseUser = async (user: User) => {
    try {
      const updates: Partial<User> = {
        paused: !user.paused,
      };

      // If pausing, store current expires_at in previous_expires_at
      if (!user.paused && user.expires_at) {
        updates.previous_expires_at = user.expires_at;
        updates.expires_at = undefined;
      }
      // If unpausing, restore from previous_expires_at
      else if (user.paused && user.previous_expires_at) {
        updates.expires_at = user.previous_expires_at;
        updates.previous_expires_at = undefined;
      }

      const { error } = await supabase
        .from('users')
        .update(updates)
        .eq('id', user.id);

      if (error) {
        throw error;
      }

      // Update local state
      setUsers((prev) =>
        prev.map((u) =>
          u.id === user.id ? { ...u, ...updates } : u
        )
      );

      showToast(`Usuário ${!user.paused ? 'pausado' : 'reativado'} com sucesso!`, "success");
    } catch (err) {
      console.error("Erro ao pausar/reativar usuário:", err);
      showToast("Erro ao pausar/reativar usuário: " + (err as Error).message, "error");
    }
  };

  const handleExtendSubscription = async (user: User, months: number) => {
    try {
      let newExpiresAt: Date;
      
      if (user.expires_at) {
        const currentExpires = new Date(user.expires_at);
        const now = new Date();
        
        // If subscription is still valid, extend from current expiry date
        // If expired, extend from today
        newExpiresAt = currentExpires > now ? currentExpires : now;
      } else {
        newExpiresAt = new Date();
      }
      
      newExpiresAt.setMonth(newExpiresAt.getMonth() + months);

      const { error } = await supabase
        .from('users')
        .update({
          expires_at: newExpiresAt.toISOString(),
          paused: false, // Unpause if extending
        })
        .eq('id', user.id);

      if (error) {
        throw error;
      }

      // Update local state
      setUsers((prev) =>
        prev.map((u) =>
          u.id === user.id 
            ? { ...u, expires_at: newExpiresAt.toISOString(), paused: false }
            : u
        )
      );

      showToast(`Assinatura estendida por ${months} ${months === 1 ? 'mês' : 'meses'}!`, "success");
    } catch (err) {
      console.error("Erro ao estender assinatura:", err);
      showToast("Erro ao estender assinatura: " + (err as Error).message, "error");
    }
  };

  // Check if user has a valid setup token
  const hasValidSetupToken = (user: User): boolean => {
    if (!user.password_setup_token || !user.password_setup_expires) return false;
    return new Date(user.password_setup_expires) > new Date();
  };

  return (
    <div className="relative">
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

      <div className="flex items-center justify-between mb-6">
        <h2 className="text-2xl font-bold">Usuários</h2>
        <Button onClick={openCreateDialog} className="bg-green-600 hover:bg-green-700">
          + Criar Usuário
        </Button>
      </div>

      {/* Dialog */}
      <Dialog open={open} onOpenChange={(o) => { setOpen(o); if (!o) setEditingUserId(null); }}>
        <DialogContent className="bg-[#141414] text-white">
          <DialogHeader>
            <DialogTitle>{editingUserId ? "Editar Usuário" : "Criar Novo Usuário"}</DialogTitle>
          </DialogHeader>

          <form onSubmit={handleSubmit} className="flex flex-col gap-4 mt-4">
            <input
              type="text"
              placeholder="Nome"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              className="px-3 py-2 rounded-lg bg-[#1f1f1f] text-white"
            />

            <input
              type="email"
              placeholder="Email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className="px-3 py-2 rounded-lg bg-[#1f1f1f] text-white"
            />

            <input
              type="tel"
              placeholder="Telefone"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              required
              className="px-3 py-2 rounded-lg bg-[#1f1f1f] text-white"
            />

            <DialogFooter>
              <Button 
                type="submit" 
                className="bg-green-600 hover:bg-green-700"
                disabled={sendingEmail}
              >
                {sendingEmail ? "Enviando..." : (editingUserId ? "Salvar Alterações" : "Criar e Enviar Link de Configuração")}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Users Table */}
      <div className="mt-6">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="text-white">Nome</TableHead>
              <TableHead className="text-white">Email</TableHead>
              <TableHead className="text-white">Telefone</TableHead>
              <TableHead className="text-white">Status</TableHead>
              <TableHead className="text-white">Senha</TableHead>
              <TableHead className="text-white">Ação</TableHead>
            </TableRow>
          </TableHeader>

          <TableBody>
            {users.map((user) => {
              const status = getUserStatus(user);
              const hasSetup = hasValidSetupToken(user);
              
              return (
                <TableRow key={user.id}>
                  <TableCell>{user.name}</TableCell>
                  <TableCell>{user.email}</TableCell>
                  <TableCell>{user.phone || "-"}</TableCell>
                  <TableCell><span className={status.color}>{status.label}</span></TableCell>
                  <TableCell>
                    <span className={hasSetup ? "text-yellow-400" : "text-green-500"}>
                      {hasSetup ? "Pendente" : "Configurada"}
                    </span>
                  </TableCell>
                  <TableCell>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" className="flex items-center gap-1">
                          Ações <span>⌄</span>
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent className="w-56">
                        <DropdownMenuLabel>Ações do Usuário</DropdownMenuLabel>
                        <DropdownMenuSeparator />
                        
                        <DropdownMenuItem onClick={() => handleEditUser(user)}>
                          ✏️ Editar
                        </DropdownMenuItem>
                        
                        <DropdownMenuItem 
                          onClick={() => handleResendSetupEmail(user)}
                          disabled={sendingEmail}
                        >
                          🔑 {sendingEmail ? "Enviando..." : "Enviar Link de Configuração"}
                        </DropdownMenuItem>
                        
                        <DropdownMenuItem onClick={() => handlePauseUser(user)}>
                          {user.paused ? "▶️ Reativar" : "⏸️ Pausar"} Assinatura
                        </DropdownMenuItem>
                        
                        <DropdownMenuSeparator />
                        <DropdownMenuLabel>Estender Assinatura</DropdownMenuLabel>
                        
                        <DropdownMenuItem onClick={() => handleExtendSubscription(user, 1)}>
                          📅 +1 Mês
                        </DropdownMenuItem>
                        
                        <DropdownMenuItem onClick={() => handleExtendSubscription(user, 3)}>
                          📅 +3 Meses
                        </DropdownMenuItem>
                        
                        <DropdownMenuItem onClick={() => handleExtendSubscription(user, 6)}>
                          📅 +6 Meses
                        </DropdownMenuItem>
                        
                        <DropdownMenuSeparator />
                        <DropdownMenuItem 
                          onClick={() => handleDeleteUser(user.id)} 
                          className="text-red-600"
                        >
                          ❌ Remover
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>

        {users.length === 0 && (
          <div className="text-center py-8 text-gray-400">
            Nenhum usuário encontrado. Clique em "Criar Usuário" para começar.
          </div>
        )}
      </div>

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