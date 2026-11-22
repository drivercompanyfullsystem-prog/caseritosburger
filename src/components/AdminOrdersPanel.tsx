'use client';

import React, { useState } from 'react';
import {
  Clock,
  ChefHat,
  CheckCircle2,
  XCircle,
  Plus,
  Trash2,
  MapPin,
  Store,
  MessageCircle,
  RotateCcw,
  X,
  Banknote,
  Building2,
  CreditCard,
} from 'lucide-react';
import { OrderRecord, OrderStatus, Product } from '@/types';
import { formatGuaranies, normalizeParaguayPhone } from '@/utils/whatsapp';
import { createManualOrder, deleteOrderRecord, updateOrderStatus } from '@/lib/orders';

interface AdminOrdersPanelProps {
  orders: OrderRecord[];
  products: Product[];
  onOrdersChange: (updater: (prev: OrderRecord[]) => OrderRecord[]) => void;
  onToast: (message: string) => void;
}

const STATUS_META: Record<
  OrderStatus,
  {
    label: string;
    shortLabel: string;
    badgeClass: string;
    borderClass: string;
  }
> = {
  pendiente: {
    label: 'Pendiente',
    shortLabel: 'Pendientes',
    badgeClass: 'bg-amber-500/20 text-amber-300 border border-amber-500/40',
    borderClass: 'border-amber-500/35',
  },
  en_preparacion: {
    label: 'En preparación',
    shortLabel: 'En prep.',
    badgeClass: 'bg-sky-500/20 text-sky-300 border border-sky-500/40',
    borderClass: 'border-sky-500/35',
  },
  entregado: {
    label: 'Entregado',
    shortLabel: 'Entregados',
    badgeClass: 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40',
    borderClass: 'border-emerald-500/35',
  },
  cancelado: {
    label: 'Cancelado',
    shortLabel: 'Cancelados',
    badgeClass: 'bg-red-500/20 text-red-300 border border-red-500/40',
    borderClass: 'border-red-900/60 opacity-80',
  },
};

function formatOrderTime(timestamp: number): string {
  try {
    return new Intl.DateTimeFormat('es-PY', {
      day: '2-digit',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit',
    }).format(new Date(timestamp));
  } catch {
    return '';
  }
}

export const AdminOrdersPanel: React.FC<AdminOrdersPanelProps> = ({
  orders,
  products,
  onOrdersChange,
  onToast,
}) => {
  const [statusFilter, setStatusFilter] = useState<'all' | OrderStatus>('all');
  const [isManualModalOpen, setIsManualModalOpen] = useState(false);

  // Estado del formulario rápido para venta manual
  const [manualName, setManualName] = useState('');
  const [manualPhone, setManualPhone] = useState('');
  const [manualDelivery, setManualDelivery] = useState<'delivery' | 'pickup'>('pickup');
  const [manualPayment, setManualPayment] = useState<'Efectivo' | 'Transferencia' | 'POS'>('Efectivo');
  const [manualStatus, setManualStatus] = useState<OrderStatus>('pendiente');
  const [manualNotes, setManualNotes] = useState('');
  const [selectedProductId, setSelectedProductId] = useState(products[0]?.id || '');
  const [selectedQty, setSelectedQty] = useState(1);
  const [manualItems, setManualItems] = useState<OrderRecord['items']>([]);
  const [isSavingManual, setIsSavingManual] = useState(false);

  const counts = {
    all: orders.length,
    pendiente: orders.filter((o) => o.status === 'pendiente').length,
    en_preparacion: orders.filter((o) => o.status === 'en_preparacion').length,
    entregado: orders.filter((o) => o.status === 'entregado').length,
    cancelado: orders.filter((o) => o.status === 'cancelado').length,
  };

  const filteredOrders =
    statusFilter === 'all' ? orders : orders.filter((o) => o.status === statusFilter);

  const handleChangeStatus = async (order: OrderRecord, nextStatus: OrderStatus) => {
    const updated = await updateOrderStatus(order, nextStatus);
    onOrdersChange((prev) => prev.map((o) => (o.id === order.id ? updated : o)));

    if (nextStatus === 'entregado') {
      onToast(`${order.orderNumber} marcado como Entregado (+${formatGuaranies(order.totalPrice)} en Finanzas)`);
    } else if (nextStatus === 'en_preparacion') {
      onToast(`${order.orderNumber} pasó a En preparación`);
    } else if (nextStatus === 'cancelado') {
      onToast(`${order.orderNumber} marcado como Cancelado`);
    } else {
      onToast(`${order.orderNumber} volvió a Pendiente`);
    }
  };

  const handleDelete = async (order: OrderRecord) => {
    await deleteOrderRecord(order.id);
    onOrdersChange((prev) => prev.filter((o) => o.id !== order.id));
    onToast(`Pedido ${order.orderNumber} eliminado`);
  };

  const handleAddManualItem = () => {
    const prod = products.find((p) => p.id === (selectedProductId || products[0]?.id));
    if (!prod || selectedQty < 1) return;

    setManualItems((prev) => {
      const existing = prev.find((i) => i.productId === prod.id);
      if (existing) {
        return prev.map((i) =>
          i.productId === prod.id
            ? {
                ...i,
                quantity: i.quantity + selectedQty,
                subtotal: (i.quantity + selectedQty) * prod.price,
              }
            : i
        );
      }
      return [
        ...prev,
        {
          productId: prod.id,
          name: prod.name,
          quantity: selectedQty,
          unitPrice: prod.price,
          subtotal: selectedQty * prod.price,
        },
      ];
    });
    setSelectedQty(1);
  };

  const handleRemoveManualItem = (productId: string) => {
    setManualItems((prev) => prev.filter((i) => i.productId !== productId));
  };

  const manualTotal = manualItems.reduce((sum, i) => sum + i.subtotal, 0);

  const handleSaveManualOrder = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!manualName.trim() || manualItems.length === 0) return;

    setIsSavingManual(true);
    try {
      const created = await createManualOrder({
        customerName: manualName.trim(),
        phoneNumber: manualPhone.trim(),
        deliveryMethod: manualDelivery,
        paymentMethod: manualPayment,
        items: manualItems,
        notes: manualNotes.trim() || undefined,
        status: manualStatus,
      });

      onOrdersChange((prev) => [created, ...prev.filter((o) => o.id !== created.id)]);
      onToast(
        manualStatus === 'entregado'
          ? `Venta ${created.orderNumber} registrada como Entregada (${formatGuaranies(created.totalPrice)})`
          : `Pedido ${created.orderNumber} registrado como Pendiente`
      );
      setManualName('');
      setManualPhone('');
      setManualNotes('');
      setManualItems([]);
      setManualStatus('pendiente');
      setIsManualModalOpen(false);
    } finally {
      setIsSavingManual(false);
    }
  };

  return (
    <div className="space-y-5">
      {/* Encabezado y botón de registro manual */}
      <div className="bg-zinc-900/60 border border-zinc-800/80 rounded-2xl p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-3.5">
        <div>
          <h2 className="text-lg sm:text-xl font-black text-white">Control de Pedidos</h2>
          <p className="text-xs text-zinc-400 mt-0.5">
            Cada pedido web entra como <strong className="text-amber-300">Pendiente</strong>. Al marcarlo{' '}
            <strong className="text-emerald-400">Entregado</strong>, se suma automáticamente a Finanzas.
          </p>
        </div>
        <button
          type="button"
          onClick={() => {
            if (!selectedProductId && products[0]?.id) setSelectedProductId(products[0].id);
            setIsManualModalOpen(true);
          }}
          className="w-full sm:w-auto min-h-[44px] px-4 py-2.5 rounded-xl bg-gradient-to-r from-orange-600 to-amber-600 hover:from-orange-500 hover:to-amber-500 text-white text-xs sm:text-sm font-bold shadow-lg shadow-orange-600/25 transition flex items-center justify-center gap-2 shrink-0"
        >
          <Plus className="w-4 h-4 shrink-0" />
          <span>Registrar Pedido Manual</span>
        </button>
      </div>

      {/* Filtros por Estado (adaptados a móvil en wrap) */}
      <div className="flex flex-wrap gap-2">
        {(
          [
            { id: 'all', label: 'Todos', count: counts.all },
            { id: 'pendiente', label: '🟡 Pendientes', count: counts.pendiente },
            { id: 'en_preparacion', label: '🟠 En prep.', count: counts.en_preparacion },
            { id: 'entregado', label: '🟢 Entregados', count: counts.entregado },
            { id: 'cancelado', label: '🔴 Cancelados', count: counts.cancelado },
          ] as const
        ).map((pill) => {
          const active = statusFilter === pill.id;
          return (
            <button
              key={pill.id}
              type="button"
              onClick={() => setStatusFilter(pill.id)}
              className={`px-3.5 py-2 rounded-full text-xs font-bold transition flex items-center gap-1.5 ${
                active
                  ? 'bg-gradient-to-r from-orange-600 to-amber-600 text-white shadow-md'
                  : 'bg-zinc-900 border border-zinc-800 text-zinc-300 hover:bg-zinc-800'
              }`}
            >
              <span>{pill.label}</span>
              <span
                className={`px-1.5 py-0.2 rounded-full text-[10px] ${
                  active ? 'bg-black/30 text-white' : 'bg-zinc-800 text-zinc-400'
                }`}
              >
                {pill.count}
              </span>
            </button>
          );
        })}
      </div>

      {/* Lista de Pedidos */}
      {filteredOrders.length === 0 ? (
        <div className="py-14 px-6 text-center bg-zinc-900/40 border border-zinc-800 rounded-3xl max-w-lg mx-auto space-y-2.5">
          <p className="text-3xl">🧾</p>
          <p className="text-base font-bold text-white">
            {statusFilter === 'all'
              ? 'Todavía no hay pedidos registrados'
              : `No hay pedidos en "${STATUS_META[statusFilter].label}"`}
          </p>
          <p className="text-xs text-zinc-400">
            Cuando un cliente confirme un pedido en tu tienda, aparecerá aquí al instante. También puedes cargar ventas manuales arriba.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {filteredOrders.map((order) => {
            const meta = STATUS_META[order.status];
            const cleanPhone = order.phoneNumber ? normalizeParaguayPhone(order.phoneNumber) : '';

            return (
              <div
                key={order.id}
                className={`bg-zinc-900/90 border rounded-2xl p-4 sm:p-5 space-y-3.5 shadow-lg transition ${meta.borderClass}`}
              >
                {/* Top row: número, hora, estado */}
                <div className="flex flex-wrap items-center justify-between gap-2 pb-2.5 border-b border-zinc-800/80">
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="text-sm font-black text-amber-400 font-mono">
                      {order.orderNumber}
                    </span>
                    <span className="text-[11px] text-zinc-400 flex items-center gap-1">
                      <Clock className="w-3 h-3 shrink-0" />
                      <span>{formatOrderTime(order.createdAt)}</span>
                    </span>
                  </div>

                  <span
                    className={`px-2.5 py-1 rounded-full text-[11px] font-bold ${meta.badgeClass}`}
                  >
                    {meta.label}
                  </span>
                </div>

                {/* Datos del cliente */}
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0 space-y-1">
                    <p className="text-sm font-bold text-white truncate">{order.customerName}</p>
                    <div className="flex flex-wrap items-center gap-2 text-[11px] text-zinc-400">
                      <span className="inline-flex items-center gap-1">
                        {order.deliveryMethod === 'delivery' ? (
                          <MapPin className="w-3.5 h-3.5 text-orange-400" />
                        ) : (
                          <Store className="w-3.5 h-3.5 text-emerald-400" />
                        )}
                        <span>
                          {order.deliveryMethod === 'delivery' ? 'Delivery' : 'Retiro local'}
                        </span>
                      </span>
                      <span>•</span>
                      <span className="inline-flex items-center gap-1 text-zinc-300 font-semibold">
                        {order.paymentMethod === 'Efectivo' ? (
                          <Banknote className="w-3.5 h-3.5 text-emerald-400" />
                        ) : order.paymentMethod === 'Transferencia' ? (
                          <Building2 className="w-3.5 h-3.5 text-sky-400" />
                        ) : (
                          <CreditCard className="w-3.5 h-3.5 text-purple-400" />
                        )}
                        <span>{order.paymentMethod === 'POS' ? 'Tarjeta / POS' : order.paymentMethod}</span>
                      </span>
                    </div>
                    {order.address && (
                      <p className="text-[11px] text-zinc-400 line-clamp-1">
                        📍 {order.address}
                        {order.references ? ` (${order.references})` : ''}
                      </p>
                    )}
                  </div>

                  {cleanPhone && (
                    <a
                      href={`https://api.whatsapp.com/send?phone=${cleanPhone}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="min-h-[36px] px-2.5 py-1.5 rounded-xl bg-emerald-950/50 hover:bg-emerald-900/60 border border-emerald-500/40 text-emerald-300 text-[11px] font-bold flex items-center gap-1 shrink-0 transition"
                      title="Escribir al cliente por WhatsApp"
                    >
                      <MessageCircle className="w-3.5 h-3.5" />
                      <span>Chat</span>
                    </a>
                  )}
                </div>

                {/* Detalle de productos */}
                <div className="bg-zinc-950/70 border border-zinc-800/80 rounded-xl p-3 space-y-1.5">
                  {order.items.map((item, idx) => (
                    <div key={`${item.productId}-${idx}`} className="text-xs">
                      <div className="flex items-center justify-between gap-2 text-zinc-200">
                        <span className="truncate">
                          <strong className="text-amber-400">{item.quantity}x</strong> {item.name}
                        </span>
                        <span className="font-semibold whitespace-nowrap">
                          {formatGuaranies(item.subtotal)}
                        </span>
                      </div>
                      {item.instructions && (
                        <p className="text-[11px] text-zinc-400 italic pl-4">
                          Obs: {item.instructions}
                        </p>
                      )}
                    </div>
                  ))}
                  {order.notes && (
                    <p className="text-[11px] text-amber-300/90 pt-1.5 mt-1 border-t border-zinc-800">
                      💬 Nota: {order.notes}
                    </p>
                  )}
                </div>

                {/* Total y Botones de cambio de estado (1 toque en celular) */}
                <div className="pt-1 space-y-2.5">
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-zinc-400 font-semibold">Total del pedido</span>
                    <span className="text-lg font-black text-amber-400">
                      {formatGuaranies(order.totalPrice)}
                    </span>
                  </div>

                  <div className="flex flex-wrap gap-2">
                    {order.status === 'pendiente' && (
                      <>
                        <button
                          type="button"
                          onClick={() => handleChangeStatus(order, 'en_preparacion')}
                          className="flex-1 min-h-[42px] px-3 py-2 rounded-xl bg-sky-600/20 hover:bg-sky-600/30 border border-sky-500/40 text-sky-300 text-xs font-bold flex items-center justify-center gap-1.5 transition"
                        >
                          <ChefHat className="w-4 h-4 shrink-0" />
                          <span>Preparar</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => handleChangeStatus(order, 'entregado')}
                          className="flex-1 min-h-[42px] px-3 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold flex items-center justify-center gap-1.5 shadow-md shadow-emerald-950/50 transition"
                        >
                          <CheckCircle2 className="w-4 h-4 shrink-0" />
                          <span>Entregado</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => handleChangeStatus(order, 'cancelado')}
                          aria-label="Cancelar pedido"
                          className="min-w-[42px] min-h-[42px] px-2.5 rounded-xl bg-red-950/40 hover:bg-red-900/60 border border-red-700/50 text-red-400 flex items-center justify-center transition"
                          title="Cancelar pedido"
                        >
                          <XCircle className="w-4 h-4" />
                        </button>
                      </>
                    )}

                    {order.status === 'en_preparacion' && (
                      <>
                        <button
                          type="button"
                          onClick={() => handleChangeStatus(order, 'entregado')}
                          className="flex-1 min-h-[42px] px-3 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold flex items-center justify-center gap-1.5 shadow-md shadow-emerald-950/50 transition"
                        >
                          <CheckCircle2 className="w-4 h-4 shrink-0" />
                          <span>Marcar Entregado</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => handleChangeStatus(order, 'pendiente')}
                          className="min-h-[42px] px-3 py-2 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-xs font-semibold flex items-center gap-1 transition"
                        >
                          <RotateCcw className="w-3.5 h-3.5" />
                          <span>Pendiente</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => handleChangeStatus(order, 'cancelado')}
                          aria-label="Cancelar pedido"
                          className="min-w-[42px] min-h-[42px] px-2.5 rounded-xl bg-red-950/40 hover:bg-red-900/60 border border-red-700/50 text-red-400 flex items-center justify-center transition"
                          title="Cancelar pedido"
                        >
                          <XCircle className="w-4 h-4" />
                        </button>
                      </>
                    )}

                    {order.status === 'entregado' && (
                      <div className="w-full flex items-center justify-between gap-2">
                        <span className="text-xs font-bold text-emerald-400 flex items-center gap-1.5">
                          <CheckCircle2 className="w-4 h-4 shrink-0" />
                          <span>Sumado a Finanzas</span>
                        </span>
                        <div className="flex items-center gap-1.5">
                          <button
                            type="button"
                            onClick={() => handleChangeStatus(order, 'pendiente')}
                            className="min-h-[36px] px-2.5 py-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-[11px] font-semibold flex items-center gap-1 transition"
                          >
                            <RotateCcw className="w-3 h-3" />
                            <span>Reabrir</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDelete(order)}
                            aria-label="Eliminar pedido"
                            className="min-w-[36px] min-h-[36px] rounded-lg bg-zinc-800 hover:bg-red-950/60 text-zinc-400 hover:text-red-400 flex items-center justify-center transition"
                            title="Eliminar registro"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    )}

                    {order.status === 'cancelado' && (
                      <div className="w-full flex items-center justify-between gap-2">
                        <span className="text-xs text-red-400 font-semibold">
                          No suma a Finanzas
                        </span>
                        <div className="flex items-center gap-1.5">
                          <button
                            type="button"
                            onClick={() => handleChangeStatus(order, 'pendiente')}
                            className="min-h-[36px] px-2.5 py-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-[11px] font-semibold flex items-center gap-1 transition"
                          >
                            <RotateCcw className="w-3 h-3" />
                            <span>Reactivar</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDelete(order)}
                            aria-label="Eliminar pedido cancelado"
                            className="min-w-[36px] min-h-[36px] rounded-lg bg-zinc-800 hover:bg-red-950/60 text-zinc-400 hover:text-red-400 flex items-center justify-center transition"
                            title="Eliminar registro"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Modal Bottom-Sheet para Registrar Venta / Pedido Manual */}
      {isManualModalOpen && (
        <div className="fixed inset-0 z-50 overflow-hidden bg-black/80 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4">
          <div className="relative bg-zinc-950 border-t sm:border border-zinc-800 rounded-t-3xl sm:rounded-3xl max-w-lg w-full max-h-[92vh] text-white shadow-2xl flex flex-col overflow-hidden">
            <div className="px-4 sm:px-6 py-4 border-b border-zinc-800 flex items-center justify-between shrink-0">
              <div>
                <h3 className="text-base sm:text-lg font-bold">🧾 Registrar Pedido Manual</h3>
                <p className="text-[11px] text-zinc-400">
                  Ideal para ventas por mostrador o WhatsApp directo
                </p>
              </div>
              <button
                type="button"
                onClick={() => setIsManualModalOpen(false)}
                aria-label="Cerrar registro manual"
                className="p-2 rounded-xl text-zinc-400 hover:text-white hover:bg-zinc-900"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form
              onSubmit={handleSaveManualOrder}
              className="flex-1 px-4 sm:px-6 py-4 space-y-4 overflow-y-auto dark-scrollbar"
            >
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <input
                  type="text"
                  required
                  placeholder="Nombre del cliente *"
                  value={manualName}
                  onChange={(e) => setManualName(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-zinc-900 border border-zinc-800 rounded-xl text-sm text-white placeholder-zinc-500 focus:outline-none focus:border-amber-500"
                />
                <input
                  type="tel"
                  placeholder="WhatsApp (opcional)"
                  value={manualPhone}
                  onChange={(e) => setManualPhone(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-zinc-900 border border-zinc-800 rounded-xl text-sm text-white placeholder-zinc-500 focus:outline-none focus:border-amber-500"
                />
              </div>

              {/* Selector rápido de productos */}
              <div className="p-3.5 bg-zinc-900/70 border border-zinc-800 rounded-2xl space-y-3">
                <label className="text-xs font-bold text-zinc-300 block">
                  Agregar productos al pedido *
                </label>
                <div className="flex gap-2">
                  <select
                    value={selectedProductId || products[0]?.id || ''}
                    onChange={(e) => setSelectedProductId(e.target.value)}
                    className="flex-1 min-w-0 px-3 py-2.5 bg-zinc-950 border border-zinc-800 rounded-xl text-xs sm:text-sm text-white focus:outline-none focus:border-amber-500"
                  >
                    {products.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name} ({formatGuaranies(p.price)})
                      </option>
                    ))}
                  </select>
                  <input
                    type="number"
                    min={1}
                    max={50}
                    value={selectedQty}
                    onChange={(e) => setSelectedQty(Math.max(1, Number(e.target.value) || 1))}
                    className="w-16 px-2.5 py-2.5 bg-zinc-950 border border-zinc-800 rounded-xl text-sm font-bold text-center text-white"
                  />
                  <button
                    type="button"
                    onClick={handleAddManualItem}
                    className="min-w-[44px] px-3 rounded-xl bg-orange-600 hover:bg-orange-500 text-white font-bold text-xs flex items-center justify-center shrink-0"
                  >
                    <Plus className="w-4 h-4" />
                  </button>
                </div>

                {manualItems.length > 0 && (
                  <div className="space-y-1.5 pt-2 border-t border-zinc-800">
                    {manualItems.map((item) => (
                      <div
                        key={item.productId}
                        className="flex items-center justify-between gap-2 text-xs bg-zinc-950/80 px-3 py-2 rounded-lg"
                      >
                        <span className="truncate">
                          <strong className="text-amber-400">{item.quantity}x</strong> {item.name}
                        </span>
                        <div className="flex items-center gap-2 shrink-0">
                          <span className="font-bold text-zinc-200">
                            {formatGuaranies(item.subtotal)}
                          </span>
                          <button
                            type="button"
                            onClick={() => handleRemoveManualItem(item.productId)}
                            className="text-zinc-500 hover:text-red-400"
                          >
                            <X className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    ))}
                    <div className="flex justify-between pt-1 text-sm font-black">
                      <span>Total:</span>
                      <span className="text-amber-400">{formatGuaranies(manualTotal)}</span>
                    </div>
                  </div>
                )}
              </div>

              {/* Modalidad, Pago y Estado inicial */}
              <div className="grid grid-cols-2 gap-2.5">
                <select
                  value={manualDelivery}
                  onChange={(e) => setManualDelivery(e.target.value as 'delivery' | 'pickup')}
                  className="px-3 py-2.5 bg-zinc-900 border border-zinc-800 rounded-xl text-xs sm:text-sm text-white"
                >
                  <option value="pickup">Retiro en local</option>
                  <option value="delivery">Delivery</option>
                </select>
                <select
                  value={manualPayment}
                  onChange={(e) =>
                    setManualPayment(e.target.value as 'Efectivo' | 'Transferencia' | 'POS')
                  }
                  className="px-3 py-2.5 bg-zinc-900 border border-zinc-800 rounded-xl text-xs sm:text-sm text-white"
                >
                  <option value="Efectivo">Efectivo (Gs.)</option>
                  <option value="Transferencia">Transferencia</option>
                  <option value="POS">Tarjeta / POS</option>
                </select>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-zinc-300 block">Estado inicial</label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setManualStatus('pendiente')}
                    className={`py-2.5 rounded-xl border text-xs font-bold transition ${
                      manualStatus === 'pendiente'
                        ? 'bg-amber-500/20 border-amber-500 text-amber-300'
                        : 'bg-zinc-900 border-zinc-800 text-zinc-400'
                    }`}
                  >
                    🟡 Pendiente
                  </button>
                  <button
                    type="button"
                    onClick={() => setManualStatus('entregado')}
                    className={`py-2.5 rounded-xl border text-xs font-bold transition ${
                      manualStatus === 'entregado'
                        ? 'bg-emerald-500/20 border-emerald-500 text-emerald-300'
                        : 'bg-zinc-900 border-zinc-800 text-zinc-400'
                    }`}
                  >
                    🟢 Ya Entregado
                  </button>
                </div>
              </div>

              <input
                type="text"
                placeholder="Nota opcional (ej: sin cebolla)"
                value={manualNotes}
                onChange={(e) => setManualNotes(e.target.value)}
                className="w-full px-3.5 py-2.5 bg-zinc-900 border border-zinc-800 rounded-xl text-xs sm:text-sm text-white placeholder-zinc-500"
              />

              <button
                type="submit"
                disabled={isSavingManual || manualItems.length === 0 || !manualName.trim()}
                className="w-full min-h-[46px] py-3 rounded-xl bg-gradient-to-r from-emerald-600 to-green-600 hover:from-emerald-500 hover:to-green-500 disabled:opacity-50 text-white font-bold text-sm transition"
              >
                {isSavingManual
                  ? 'Guardando...'
                  : `Guardar Pedido (${formatGuaranies(manualTotal)})`}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
