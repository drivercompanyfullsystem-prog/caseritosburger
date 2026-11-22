import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { OrderRecord } from '@/types';
import { formatGuaranies, getBusinessWhatsAppPhone } from './whatsapp';

export type FinancePeriod = 'today' | 'week' | 'month' | 'all';

export interface FinanceSummaryData {
  periodLabel: string;
  generatedAt: Date;
  delivered: OrderRecord[];
  pending: OrderRecord[];
  canceled: OrderRecord[];
  totalRevenue: number;
  pendingRevenue: number;
  avgTicket: number;
  closureRate: number;
  paymentBreakdown: {
    Efectivo: number;
    Transferencia: number;
    POS: number;
  };
  topProducts: Array<{ name: string; qty: number; revenue: number }>;
}

const PERIOD_LABELS: Record<FinancePeriod, string> = {
  today: 'Cierre de Hoy',
  week: 'Últimos 7 días',
  month: 'Este Mes',
  all: 'Histórico Completo',
};

export function getPeriodLabel(period: FinancePeriod): string {
  return PERIOD_LABELS[period];
}

function formatDateTimeEs(date: Date): string {
  try {
    return new Intl.DateTimeFormat('es-PY', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    }).format(date);
  } catch {
    return date.toISOString();
  }
}

function formatFileDate(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

/**
 * Genera el enlace directo a WhatsApp del negocio con el Cierre de Caja del período seleccionado.
 */
export function buildCashClosingWhatsAppUrl(summary: FinanceSummaryData): string {
  const line = '----------------------------------------';
  const dateStr = formatDateTimeEs(summary.generatedAt);

  let text = `\u{1F4CA} *CIERRE DE CAJA - CASERITOS BURGUER*\n`;
  text += `*Período:* ${summary.periodLabel}\n`;
  text += `*Emitido:* ${dateStr}\n`;
  text += `${line}\n\n`;

  text += `\u{1F4B0} *RESUMEN FINANCIERO (CONCLUIDOS)*\n`;
  text += `• *Ventas Concluidas:* *${formatGuaranies(summary.totalRevenue)}*\n`;
  text += `• *Pedidos Entregados:* ${summary.delivered.length}\n`;
  text += `• *Ticket Promedio:* ${formatGuaranies(summary.avgTicket)}\n`;
  text += `• *Por Cobrar (en curso):* ${formatGuaranies(summary.pendingRevenue)} (${summary.pending.length})\n`;
  text += `• *Cancelados:* ${summary.canceled.length} (Efectividad: ${summary.closureRate}%)\n\n`;

  text += `\u{1F4B5} *DESGLOSE POR FORMA DE PAGO*\n`;
  text += `• *Efectivo:* ${formatGuaranies(summary.paymentBreakdown.Efectivo)}\n`;
  text += `• *Transferencia:* ${formatGuaranies(summary.paymentBreakdown.Transferencia)}\n`;
  text += `• *Tarjeta / POS:* ${formatGuaranies(summary.paymentBreakdown.POS)}\n\n`;

  if (summary.topProducts.length > 0) {
    text += `\u{1F3C6} *MÁS VENDIDOS*\n`;
    summary.topProducts.slice(0, 5).forEach((prod, idx) => {
      text += `${idx + 1}. ${prod.name} — ${prod.qty} u. (${formatGuaranies(prod.revenue)})\n`;
    });
    text += `\n`;
  }

  text += `${line}\n`;
  text += `_Reporte generado desde Caseritos Admin (Km 13.5)_`;

  const cleanPhone = getBusinessWhatsAppPhone().replace(/\D/g, '');
  return `https://api.whatsapp.com/send?phone=${cleanPhone}&text=${encodeURIComponent(text)}`;
}

/**
 * Genera y descarga el reporte de Cierre de Caja en PDF con tablas de resumen, pagos y ventas.
 */
export function downloadCashClosingPDF(summary: FinanceSummaryData): void {
  const doc = new jsPDF('p', 'mm', 'a4');
  const dateStr = formatDateTimeEs(summary.generatedAt);

  // Encabezado oscuro gourmet
  doc.setFillColor(24, 24, 27);
  doc.rect(0, 0, 210, 34, 'F');
  doc.setFillColor(234, 88, 12);
  doc.rect(0, 34, 210, 2, 'F');

  doc.setTextColor(251, 191, 36);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(18);
  doc.text('CASERITOS BURGUER — CIERRE DE CAJA', 14, 15);

  doc.setTextColor(212, 212, 216);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  doc.text(`Período: ${summary.periodLabel}   |   Emitido: ${dateStr}   |   Km 13.5`, 14, 24);

  // Tabla 1: Resumen general
  autoTable(doc, {
    startY: 42,
    head: [['Indicador Financiero', 'Valor']],
    body: [
      ['Ventas Concluidas (Solo Entregados)', formatGuaranies(summary.totalRevenue)],
      ['Pedidos Entregados', String(summary.delivered.length)],
      ['Ticket Promedio', formatGuaranies(summary.avgTicket)],
      [
        'Pedidos En Curso / Por Cobrar',
        `${formatGuaranies(summary.pendingRevenue)} (${summary.pending.length} pedidos)`,
      ],
      [
        'Pedidos Cancelados',
        `${summary.canceled.length} (Efectividad: ${summary.closureRate}%)`,
      ],
    ],
    theme: 'grid',
    headStyles: { fillColor: [234, 88, 12], textColor: 255, fontStyle: 'bold' },
    styles: { fontSize: 10, cellPadding: 3 },
  });

  // Tabla 2: Desglose por forma de pago
  const afterSummaryY = (doc as unknown as { lastAutoTable?: { finalY: number } }).lastAutoTable?.finalY || 95;
  autoTable(doc, {
    startY: afterSummaryY + 8,
    head: [['Forma de Pago (Concluidos)', 'Monto (Gs.)', 'Participación']],
    body: [
      [
        'Efectivo (Gs.)',
        formatGuaranies(summary.paymentBreakdown.Efectivo),
        `${summary.totalRevenue > 0 ? Math.round((summary.paymentBreakdown.Efectivo / summary.totalRevenue) * 100) : 0}%`,
      ],
      [
        'Transferencia',
        formatGuaranies(summary.paymentBreakdown.Transferencia),
        `${summary.totalRevenue > 0 ? Math.round((summary.paymentBreakdown.Transferencia / summary.totalRevenue) * 100) : 0}%`,
      ],
      [
        'Tarjeta / POS',
        formatGuaranies(summary.paymentBreakdown.POS),
        `${summary.totalRevenue > 0 ? Math.round((summary.paymentBreakdown.POS / summary.totalRevenue) * 100) : 0}%`,
      ],
    ],
    theme: 'striped',
    headStyles: { fillColor: [16, 185, 129], textColor: 255, fontStyle: 'bold' },
    styles: { fontSize: 10, cellPadding: 3 },
  });

  // Tabla 3: Detalle de ventas entregadas
  const afterPaymentsY = (doc as unknown as { lastAutoTable?: { finalY: number } }).lastAutoTable?.finalY || 145;
  if (summary.delivered.length > 0) {
    autoTable(doc, {
      startY: afterPaymentsY + 8,
      head: [['Pedido', 'Fecha/Hora', 'Cliente', 'Pago', 'Ítems', 'Total (Gs.)']],
      body: summary.delivered.map((order) => [
        order.orderNumber,
        formatDateTimeEs(new Date(order.completedAt || order.createdAt)),
        order.customerName,
        order.paymentMethod === 'POS' ? 'Tarjeta / POS' : order.paymentMethod,
        order.items.map((i) => `${i.quantity}x ${i.name}`).join(', '),
        formatGuaranies(order.totalPrice),
      ]),
      theme: 'grid',
      headStyles: { fillColor: [39, 39, 42], textColor: 255, fontStyle: 'bold' },
      styles: { fontSize: 8.5, cellPadding: 2.5 },
      columnStyles: {
        4: { cellWidth: 62 },
        5: { halign: 'right', fontStyle: 'bold' },
      },
    });
  }

  doc.save(`Cierre-Caja-Caseritos-Burguer-${formatFileDate(summary.generatedAt)}.pdf`);
}

/**
 * Descarga las ventas entregadas del período en CSV compatible con Excel (UTF-8 con BOM).
 */
export function downloadCashClosingCSV(summary: FinanceSummaryData): void {
  const escapeCsv = (val: string) => `"${String(val).replace(/"/g, '""')}"`;

  const headers = [
    'Pedido',
    'Fecha',
    'Cliente',
    'Telefono',
    'Modalidad',
    'Forma de Pago',
    'Detalle',
    'Total_PYG',
  ];

  const rows = summary.delivered.map((order) => [
    escapeCsv(order.orderNumber),
    escapeCsv(formatDateTimeEs(new Date(order.completedAt || order.createdAt))),
    escapeCsv(order.customerName),
    escapeCsv(order.phoneNumber || ''),
    escapeCsv(order.deliveryMethod === 'delivery' ? 'Delivery' : 'Retiro en local'),
    escapeCsv(order.paymentMethod === 'POS' ? 'Tarjeta / POS' : order.paymentMethod),
    escapeCsv(order.items.map((i) => `${i.quantity}x ${i.name}`).join(' | ')),
    String(Math.round(order.totalPrice || 0)),
  ]);

  const csvContent =
    '\uFEFF' + [headers.join(','), ...rows.map((r) => r.join(','))].join('\r\n');
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.setAttribute(
    'download',
    `Cierre-Caja-Caseritos-Burguer-${formatFileDate(summary.generatedAt)}.csv`
  );
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

/**
 * Reproduce un aviso sonoro suave con Web Audio API cuando entra un nuevo pedido.
 */
export function playNewOrderChime(): void {
  if (typeof window === 'undefined') return;
  try {
    const AudioCtx =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AudioCtx) return;

    const ctx = new AudioCtx();
    const now = ctx.currentTime;

    const playTone = (freq: number, start: number, duration: number) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, start);
      gain.gain.setValueAtTime(0.001, start);
      gain.gain.exponentialRampToValueAtTime(0.14, start + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.001, start + duration);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(start);
      osc.stop(start + duration);
    };

    playTone(880, now, 0.16);
    playTone(1174.66, now + 0.14, 0.24);
  } catch {
    // El navegador puede bloquear audio antes de interacción del usuario
  }
}
