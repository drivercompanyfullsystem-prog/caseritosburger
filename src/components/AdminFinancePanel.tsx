'use client';

import React, { useMemo, useState } from 'react';
import {
  TrendingUp,
  CheckCircle2,
  Clock,
  XCircle,
  Banknote,
  Building2,
  CreditCard,
  Trophy,
  Receipt,
} from 'lucide-react';
import { OrderRecord } from '@/types';
import { formatGuaranies } from '@/utils/whatsapp';

interface AdminFinancePanelProps {
  orders: OrderRecord[];
}

type FinancePeriod = 'today' | 'week' | 'month' | 'all';

function getStartTimestamp(period: FinancePeriod): number {
  const now = new Date();
  if (period === 'today') {
    return new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  }
  if (period === 'week') {
    const start = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    start.setDate(start.getDate() - 6);
    return start.getTime();
  }
  if (period === 'month') {
    return new Date(now.getFullYear(), now.getMonth(), 1).getTime();
  }
  return 0;
}

export const AdminFinancePanel: React.FC<AdminFinancePanelProps> = ({ orders }) => {
  const [period, setPeriod] = useState<FinancePeriod>('today');

  const stats = useMemo(() => {
    const since = getStartTimestamp(period);
    const inPeriod = orders.filter((o) => {
      const refTime = o.status === 'entregado' ? o.completedAt || o.updatedAt || o.createdAt : o.createdAt;
      return refTime >= since;
    });

    const delivered = inPeriod.filter((o) => o.status === 'entregado');
    const pending = inPeriod.filter(
      (o) => o.status === 'pendiente' || o.status === 'en_preparacion'
    );
    const canceled = inPeriod.filter((o) => o.status === 'cancelado');

    const totalRevenue = delivered.reduce((sum, o) => sum + o.totalPrice, 0);
    const pendingRevenue = pending.reduce((sum, o) => sum + o.totalPrice, 0);
    const avgTicket = delivered.length > 0 ? Math.round(totalRevenue / delivered.length) : 0;

    // Desglose por forma de pago (solo concluidos / entregados)
    const paymentBreakdown = {
      Efectivo: 0,
      Transferencia: 0,
      POS: 0,
    };
    for (const o of delivered) {
      if (o.paymentMethod === 'Transferencia') paymentBreakdown.Transferencia += o.totalPrice;
      else if (o.paymentMethod === 'POS') paymentBreakdown.POS += o.totalPrice;
      else paymentBreakdown.Efectivo += o.totalPrice;
    }

    // Ranking de productos vendidos (solo concluidos / entregados)
    const productMap = new Map<string, { name: string; qty: number; revenue: number }>();
    for (const o of delivered) {
      for (const item of o.items) {
        const key = item.name;
        const prev = productMap.get(key) || { name: item.name, qty: 0, revenue: 0 };
        prev.qty += item.quantity;
        prev.revenue += item.subtotal;
        productMap.set(key, prev);
      }
    }
    const topProducts = Array.from(productMap.values())
      .sort((a, b) => b.revenue - a.revenue)
      .slice(0, 6);

    const closureRate =
      delivered.length + canceled.length > 0
        ? Math.round((delivered.length / (delivered.length + canceled.length)) * 100)
        : 0;

    return {
      delivered,
      pending,
      canceled,
      totalRevenue,
      pendingRevenue,
      avgTicket,
      paymentBreakdown,
      topProducts,
      closureRate,
    };
  }, [orders, period]);

  const paymentRows = [
    {
      key: 'Efectivo',
      label: 'Efectivo (Gs.)',
      amount: stats.paymentBreakdown.Efectivo,
      icon: Banknote,
      color: 'text-emerald-400',
      bar: 'bg-emerald-500',
    },
    {
      key: 'Transferencia',
      label: 'Transferencia',
      amount: stats.paymentBreakdown.Transferencia,
      icon: Building2,
      color: 'text-sky-400',
      bar: 'bg-sky-500',
    },
    {
      key: 'POS',
      label: 'Tarjeta / POS',
      amount: stats.paymentBreakdown.POS,
      icon: CreditCard,
      color: 'text-purple-400',
      bar: 'bg-purple-500',
    },
  ];

  return (
    <div className="space-y-5">
      {/* Selector de período */}
      <div className="bg-zinc-900/60 border border-zinc-800/80 rounded-2xl p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-3.5">
        <div>
          <h2 className="text-lg sm:text-xl font-black text-white">Resumen Financiero</h2>
          <p className="text-xs text-zinc-400 mt-0.5">
            Solo los pedidos marcados como <strong className="text-emerald-400">Entregados</strong> suman a tus ingresos reales.
          </p>
        </div>

        <div className="grid grid-cols-4 gap-1 p-1 bg-zinc-950 border border-zinc-800 rounded-xl w-full sm:w-auto">
          {(
            [
              { id: 'today', label: 'Hoy' },
              { id: 'week', label: '7 días' },
              { id: 'month', label: 'Mes' },
              { id: 'all', label: 'Todo' },
            ] as const
          ).map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setPeriod(tab.id)}
              className={`px-2.5 sm:px-3.5 py-2 rounded-lg text-xs font-bold whitespace-nowrap transition ${
                period === tab.id
                  ? 'bg-gradient-to-r from-orange-600 to-amber-600 text-white shadow'
                  : 'text-zinc-400 hover:text-zinc-200'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* KPIs Financieros 2x2 en móvil, 4 cols en desktop */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5 sm:gap-4">
        <div className="bg-gradient-to-br from-emerald-950/60 to-zinc-900 border border-emerald-500/40 rounded-2xl p-3.5 sm:p-5 space-y-1.5">
          <div className="flex items-center justify-between">
            <span className="text-[11px] sm:text-xs font-semibold text-emerald-300">
              Ventas Concluidas
            </span>
            <TrendingUp className="w-4 h-4 text-emerald-400 shrink-0" />
          </div>
          <p className="text-lg sm:text-2xl font-black text-white leading-tight">
            {formatGuaranies(stats.totalRevenue)}
          </p>
          <p className="text-[10px] sm:text-[11px] text-emerald-300/80">
            {stats.delivered.length}{' '}
            {stats.delivered.length === 1 ? 'pedido entregado' : 'pedidos entregados'}
          </p>
        </div>

        <div className="bg-zinc-900/90 border border-zinc-800 rounded-2xl p-3.5 sm:p-5 space-y-1.5">
          <div className="flex items-center justify-between">
            <span className="text-[11px] sm:text-xs font-semibold text-zinc-400">
              Ticket Promedio
            </span>
            <CheckCircle2 className="w-4 h-4 text-amber-400 shrink-0" />
          </div>
          <p className="text-lg sm:text-2xl font-black text-amber-400 leading-tight">
            {formatGuaranies(stats.avgTicket)}
          </p>
          <p className="text-[10px] sm:text-[11px] text-zinc-500">Por pedido entregado</p>
        </div>

        <div className="bg-zinc-900/90 border border-amber-500/30 rounded-2xl p-3.5 sm:p-5 space-y-1.5">
          <div className="flex items-center justify-between">
            <span className="text-[11px] sm:text-xs font-semibold text-amber-300">
              Por Cobrar
            </span>
            <Clock className="w-4 h-4 text-amber-400 shrink-0" />
          </div>
          <p className="text-lg sm:text-2xl font-black text-white leading-tight">
            {formatGuaranies(stats.pendingRevenue)}
          </p>
          <p className="text-[10px] sm:text-[11px] text-zinc-400">
            {stats.pending.length} pendiente(s) / en prep.
          </p>
        </div>

        <div className="bg-zinc-900/90 border border-zinc-800 rounded-2xl p-3.5 sm:p-5 space-y-1.5">
          <div className="flex items-center justify-between">
            <span className="text-[11px] sm:text-xs font-semibold text-zinc-400">Cancelados</span>
            <XCircle className="w-4 h-4 text-red-400 shrink-0" />
          </div>
          <p className="text-lg sm:text-2xl font-black text-red-400 leading-tight">
            {stats.canceled.length}
          </p>
          <p className="text-[10px] sm:text-[11px] text-zinc-500">
            Efectividad: {stats.closureRate}%
          </p>
        </div>
      </div>

      {/* Desglose por Pago + Top Productos */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Desglose por Forma de Pago */}
        <div className="bg-zinc-900/90 border border-zinc-800 rounded-2xl p-4 sm:p-5 space-y-4">
          <h3 className="text-sm sm:text-base font-bold text-white flex items-center gap-2">
            <Banknote className="w-4 h-4 text-emerald-400" />
            <span>Ingresos por Forma de Pago</span>
          </h3>

          <div className="space-y-3.5">
            {paymentRows.map((row) => {
              const Icon = row.icon;
              const pct =
                stats.totalRevenue > 0
                  ? Math.round((row.amount / stats.totalRevenue) * 100)
                  : 0;
              return (
                <div key={row.key} className="space-y-1.5">
                  <div className="flex items-center justify-between text-xs">
                    <span className="flex items-center gap-1.5 font-semibold text-zinc-200">
                      <Icon className={`w-4 h-4 ${row.color}`} />
                      <span>{row.label}</span>
                    </span>
                    <span className="font-bold text-white">
                      {formatGuaranies(row.amount)}{' '}
                      <span className="text-zinc-500 font-normal">({pct}%)</span>
                    </span>
                  </div>
                  <div className="h-2 rounded-full bg-zinc-800 overflow-hidden">
                    <div
                      className={`h-full rounded-full ${row.bar} transition-all duration-500`}
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Productos más vendidos */}
        <div className="bg-zinc-900/90 border border-zinc-800 rounded-2xl p-4 sm:p-5 space-y-3.5">
          <h3 className="text-sm sm:text-base font-bold text-white flex items-center gap-2">
            <Trophy className="w-4 h-4 text-amber-400" />
            <span>Más Vendidos (Concluidos)</span>
          </h3>

          {stats.topProducts.length === 0 ? (
            <p className="text-xs text-zinc-500 py-6 text-center">
              Aún no hay ventas entregadas en este período.
            </p>
          ) : (
            <div className="space-y-2.5">
              {stats.topProducts.map((prod, idx) => (
                <div
                  key={prod.name}
                  className="flex items-center justify-between gap-2 p-2.5 rounded-xl bg-zinc-950/70 border border-zinc-800/80 text-xs"
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <span className="w-6 h-6 rounded-lg bg-amber-500/15 text-amber-400 font-black flex items-center justify-center shrink-0">
                      {idx + 1}
                    </span>
                    <div className="min-w-0">
                      <p className="font-bold text-white truncate">{prod.name}</p>
                      <p className="text-[11px] text-zinc-400">
                        {prod.qty} {prod.qty === 1 ? 'unidad' : 'unidades'}
                      </p>
                    </div>
                  </div>
                  <span className="font-black text-emerald-400 whitespace-nowrap">
                    {formatGuaranies(prod.revenue)}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Historial de Ventas Concluidas */}
      <div className="bg-zinc-900/90 border border-zinc-800 rounded-2xl p-4 sm:p-5 space-y-3.5">
        <h3 className="text-sm sm:text-base font-bold text-white flex items-center gap-2">
          <Receipt className="w-4 h-4 text-orange-400" />
          <span>Últimas Ventas Entregadas ({stats.delivered.length})</span>
        </h3>

        {stats.delivered.length === 0 ? (
          <p className="text-xs text-zinc-500 py-4 text-center">
            Cuando marques un pedido como <strong>Entregado</strong> en la pestaña Pedidos, aparecerá aquí.
          </p>
        ) : (
          <div className="space-y-2">
            {stats.delivered.slice(0, 12).map((order) => (
              <div
                key={order.id}
                className="flex items-center justify-between gap-2 p-3 rounded-xl bg-zinc-950/70 border border-zinc-800/80 text-xs"
              >
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-mono font-bold text-amber-400">{order.orderNumber}</span>
                    <span className="font-bold text-white truncate">{order.customerName}</span>
                  </div>
                  <p className="text-[11px] text-zinc-400 truncate mt-0.5">
                    {order.paymentMethod === 'POS' ? 'Tarjeta / POS' : order.paymentMethod} •{' '}
                    {order.items.reduce((s, i) => s + i.quantity, 0)} ítem(s)
                  </p>
                </div>
                <span className="text-sm font-black text-emerald-400 whitespace-nowrap">
                  +{formatGuaranies(order.totalPrice)}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
