import { Coordinates, CustomerOrder, OrderRecord, OrderStatus } from '../types';

const pygFormatter = new Intl.NumberFormat('es-PY');

export function formatGuaranies(value: number): string {
  return `Gs. ${pygFormatter.format(Math.round(value || 0))}`;
}

/**
 * Extrae únicamente los dígitos numéricos de un texto de monto en Guaraníes.
 */
export function parseGuaraniesInput(raw: string): number {
  const digits = raw.replace(/\D/g, '');
  return digits ? parseInt(digits, 10) : 0;
}

/**
 * Formatea en vivo un string numérico con separadores de miles de Paraguay (ej. "100000" -> "100.000").
 */
export function formatGuaraniesInput(raw: string): string {
  const digits = raw.replace(/\D/g, '');
  if (!digits) return '';
  return pygFormatter.format(parseInt(digits, 10));
}

export function normalizeParaguayPhone(rawPhone: string): string {
  let cleaned = rawPhone.replace(/[^0-9]/g, '');
  if (cleaned.startsWith('0')) {
    cleaned = '595' + cleaned.substring(1);
  } else if (!cleaned.startsWith('595') && cleaned.length >= 8) {
    cleaned = '595' + cleaned;
  }
  return cleaned || '595982606227';
}

export function getBusinessWhatsAppPhone(): string {
  if (typeof window !== 'undefined') {
    const saved = localStorage.getItem('caseritos_business_phone');
    if (saved && saved.trim() !== '') {
      return normalizeParaguayPhone(saved);
    }
  }
  const envPhone = process.env.NEXT_PUBLIC_WHATSAPP_PHONE || '595982606227';
  return normalizeParaguayPhone(envPhone);
}

export function setBusinessWhatsAppPhone(phone: string): void {
  if (typeof window !== 'undefined') {
    localStorage.setItem('caseritos_business_phone', phone.trim());
  }
}

export function buildGoogleMapsUrl({ latitude, longitude }: Coordinates): string {
  return `https://www.google.com/maps?q=${latitude.toFixed(6)},${longitude.toFixed(6)}`;
}

export function buildGoogleMapsSearchUrl(addressQuery: string): string {
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
    `${addressQuery.trim()}, Paraguay`
  )}`;
}

/**
 * Intenta extraer coordenadas (lat, lng) si el usuario pega coordenadas o un enlace de Google Maps.
 */
export function extractCoordinatesFromText(input: string): Coordinates | null {
  const text = input.trim();
  if (!text) return null;

  // Coordenadas directas o dentro de ?q=-25.123,-54.123 o @-25.123,-54.123
  const match = text.match(/(-?\d{1,2}\.\d{3,})\s*,\s*(-?\d{1,3}\.\d{3,})/);
  if (match) {
    const lat = parseFloat(match[1]);
    const lng = parseFloat(match[2]);
    if (lat >= -90 && lat <= 90 && lng >= -180 && lng <= 180) {
      return { latitude: lat, longitude: lng };
    }
  }
  return null;
}

export interface OrderData {
  customerName: string;
  phone: string;
  deliveryMethod: 'delivery' | 'pickup';
  paymentMethod: string;
  items: Array<{ name: string; quantity: number; price: number; obs?: string }>;
  subtotal: number;
  deliveryCost?: number;
  total: number;
  mapsUrl?: string;
  manualMapsUrl?: string;
  manualAddress?: string;
  reference?: string;
  notes?: string;
}

/**
 * Genera el enlace de WhatsApp con el pedido.
 * IMPORTANTE: Se utiliza directamente `https://api.whatsapp.com/send` en lugar del
 * acortador `https://wa.me/` porque la redirección HTTP 302 de `wa.me` corrompe los
 * emojis UTF-8 de 4 bytes (%F0%9F...) convirtiéndolos en %EF%BF%BD ("").
 */
export function generateWhatsAppLink(phoneStore: string, order: OrderData): string {
  const line = '----------------------------------------';

  const formatPYG = (amount: number) => pygFormatter.format(Math.round(amount || 0));

  const itemsText = order.items
    .map(
      (item) =>
        `• ${item.quantity}x *${item.name}*\n   Precio: Gs. ${formatPYG(item.price * item.quantity)}${
          item.obs ? `\n   Obs: _${item.obs}_` : ''
        }`
    )
    .join('\n');

  let text = `\u{1F354} *CASERITOS BURGUER* \u{1F354}\n`;
  text += `*¡Nuevo Pedido Recibido!*\n`;
  text += `${line}\n\n`;

  text += `\u{1F464} *DATOS DEL CLIENTE*\n`;
  text += `• *Nombre:* ${order.customerName}\n`;
  text += `• *Teléfono:* ${order.phone}\n`;
  text += `• *Modalidad:* ${
    order.deliveryMethod === 'delivery' ? 'Delivery \u{1F6F5}' : 'Retiro en local \u{1F6CD}\u{FE0F}'
  }\n`;
  text += `• *Método de pago:* ${order.paymentMethod}\n\n`;

  text += `\u{1F4CB} *DETALLE DEL PEDIDO*\n`;
  text += `${itemsText}\n\n`;

  text += `${line}\n`;
  text += `\u{1F4B5} *RESUMEN DE PAGO*\n`;
  text += `• *Subtotal:* Gs. ${formatPYG(order.subtotal)}\n`;
  text += `• *Envío:* ${
    order.deliveryMethod === 'pickup'
      ? 'Gratis'
      : order.deliveryCost
      ? `Gs. ${formatPYG(order.deliveryCost)}`
      : 'A coordinar'
  }\n`;
  text += `• *TOTAL A PAGAR:* *Gs. ${formatPYG(order.total)}*\n`;
  text += `${line}\n\n`;

  if (order.notes) {
    text += `\u{1F4AC} *OBSERVACIONES ADICIONALES*\n${order.notes}\n\n${line}\n\n`;
  }

  if (
    order.deliveryMethod === 'delivery' &&
    (order.mapsUrl || order.manualMapsUrl || order.manualAddress || order.reference)
  ) {
    text += `\u{1F4CD} *UBICACIÓN DE ENTREGA*\n`;
    if (order.mapsUrl) {
      text += `\u{1F517} *GPS:* ${order.mapsUrl}\n`;
    }
    if (order.manualMapsUrl && order.manualMapsUrl !== order.mapsUrl) {
      text += `\u{1F517} *Enlace manual:* ${order.manualMapsUrl}\n`;
    }
    if (order.manualAddress) {
      text += `\u{1F3E0} *Dirección manual:* ${order.manualAddress}\n`;
    }
    if (order.reference) {
      text += `\u{1F4DD} *Referencia:* ${order.reference}\n`;
    }
    text += `\n${line}\n`;
  }

  // Sanitizar número de WhatsApp (solo dígitos)
  const cleanPhone = phoneStore.replace(/\D/g, '');

  // Se usa api.whatsapp.com/send directo con encodeURIComponent para evitar que la
  // redirección 302 de wa.me reemplace los emojis por %EF%BF%BD ()
  return `https://api.whatsapp.com/send?phone=${cleanPhone}&text=${encodeURIComponent(text)}`;
}

/** Convierte el pedido del carrito a OrderData. */
export function buildOrderData(order: CustomerOrder): OrderData {
  const isDelivery = order.deliveryMethod === 'delivery';
  const subtotal = order.items.reduce((sum, i) => sum + i.quantity * i.product.price, 0);

  const rawAddress = order.address?.trim() || '';
  const rawManualMaps = order.manualMapsUrl?.trim() || '';
  const rawReference = order.references?.trim() || '';

  let mapsUrl: string | undefined;
  let manualMapsUrl: string | undefined;
  const manualAddress: string | undefined = rawAddress || undefined;

  if (isDelivery) {
    // 1. Ubicación automática por GPS (independiente)
    if (order.coordinates) {
      mapsUrl = buildGoogleMapsUrl(order.coordinates);
    }

    // 2. Enlace o coordenadas ingresadas manualmente (independiente)
    if (rawManualMaps) {
      const coordsFromManual = extractCoordinatesFromText(rawManualMaps);
      if (coordsFromManual) {
        manualMapsUrl = buildGoogleMapsUrl(coordsFromManual);
      } else if (rawManualMaps.startsWith('http://') || rawManualMaps.startsWith('https://')) {
        manualMapsUrl = rawManualMaps;
      } else {
        manualMapsUrl = buildGoogleMapsSearchUrl(rawManualMaps);
      }
    }

    // 3. Si solo ingresó dirección escrita sin GPS ni enlace manual, generar enlace de búsqueda
    if (!mapsUrl && !manualMapsUrl && rawAddress) {
      const coordsFromAddress = extractCoordinatesFromText(rawAddress);
      manualMapsUrl = coordsFromAddress
        ? buildGoogleMapsUrl(coordsFromAddress)
        : buildGoogleMapsSearchUrl(rawAddress);
    }
  }

  let paymentMethod: string = order.paymentMethod === 'POS' ? 'Tarjeta' : order.paymentMethod;
  if (order.paymentMethod === 'Efectivo' && order.cashAmount?.trim()) {
    const cashNumeric = parseGuaraniesInput(order.cashAmount);
    if (cashNumeric > 0) {
      const vuelto = cashNumeric - subtotal;
      paymentMethod +=
        vuelto > 0
          ? ` (Paga con: Gs. ${pygFormatter.format(cashNumeric)} | Vuelto: Gs. ${pygFormatter.format(vuelto)})`
          : ` (Paga con: Gs. ${pygFormatter.format(cashNumeric)} - Monto exacto)`;
    } else {
      paymentMethod += ` (Paga con: ${order.cashAmount.trim()})`;
    }
  }

  return {
    customerName: order.customerName.trim(),
    phone: order.phoneNumber.trim(),
    deliveryMethod: order.deliveryMethod,
    paymentMethod,
    items: order.items.map((i) => ({
      name: i.product.name,
      quantity: i.quantity,
      price: i.product.price,
      obs: i.instructions?.trim() || undefined,
    })),
    subtotal,
    total: subtotal,
    mapsUrl,
    manualMapsUrl: isDelivery ? manualMapsUrl : undefined,
    manualAddress: isDelivery ? manualAddress : undefined,
    reference: isDelivery ? rawReference || undefined : undefined,
    notes: order.notes?.trim() || undefined,
  };
}

export function getWhatsAppUrl(order: CustomerOrder): string {
  return generateWhatsAppLink(getBusinessWhatsAppPhone(), buildOrderData(order));
}

/**
 * Genera el enlace directo a WhatsApp del cliente con mensaje predeterminado
 * según el estado actual del pedido (pendiente, en_preparacion, entregado o cancelado).
 */
export function generateOrderStatusWhatsAppLink(
  order: OrderRecord,
  overrideStatus?: OrderStatus
): string | null {
  const rawPhone = order.phoneNumber?.trim();
  if (!rawPhone) return null;

  const cleanPhone = normalizeParaguayPhone(rawPhone).replace(/\D/g, '');
  if (!cleanPhone) return null;

  const status = overrideStatus || order.status;
  const name = order.customerName.trim() || 'cliente';
  const total = formatGuaranies(order.totalPrice);
  const isDelivery = order.deliveryMethod === 'delivery';

  let text = '';
  switch (status) {
    case 'en_preparacion':
      text = isDelivery
        ? `\u{1F525} *CASERITOS BURGUER*\n¡Hola *${name}*! Tu pedido *${order.orderNumber}* (${total}) ya está *en preparación* \u{1F354}\u{1F35F}.\n\nEn breve sale el delivery hacia tu dirección. ¡Gracias por elegirnos!`
        : `\u{1F525} *CASERITOS BURGUER*\n¡Hola *${name}*! Tu pedido *${order.orderNumber}* (${total}) ya está *en preparación* \u{1F354}\u{1F35F}.\n\nEn aprox. 15 a 25 min estará listo para retirar en *Km 13.5*. ¡Te esperamos!`;
      break;
    case 'entregado':
      text = isDelivery
        ? `\u{2705} *CASERITOS BURGUER*\n¡Hola *${name}*! Tu pedido *${order.orderNumber}* fue marcado como *entregado* \u{1F6F5}\u{1F354}.\n\n¡Esperamos que lo disfrutes muchísimo! Gracias por tu compra \u{1F64C}.`
        : `\u{2705} *CASERITOS BURGUER*\n¡Hola *${name}*! Gracias por retirar tu pedido *${order.orderNumber}* \u{1F354}\u{1F64C}.\n\n¡Esperamos que lo disfrutes muchísimo! Te esperamos pronto.`;
      break;
    case 'cancelado':
      text = `\u{274C} *CASERITOS BURGUER*\nHola *${name}*, te avisamos que tu pedido *${order.orderNumber}* fue *cancelado*.\n\nSi fue un error o deseas realizar un nuevo pedido, escríbenos por aquí y te ayudamos al instante.`;
      break;
    case 'pendiente':
    default:
      text = `\u{1F354} *CASERITOS BURGUER*\n¡Hola *${name}*! Recibimos tu pedido *${order.orderNumber}* por *${total}*.\n\nEn breve te avisamos apenas empecemos a prepararlo \u{1F64C}.`;
      break;
  }

  return `https://api.whatsapp.com/send?phone=${cleanPhone}&text=${encodeURIComponent(text)}`;
}
