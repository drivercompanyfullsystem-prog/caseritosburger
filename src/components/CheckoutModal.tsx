'use client';

import React, { useState, useRef, useEffect } from 'react';
import {
  X,
  Send,
  MapPin,
  Store,
  CreditCard,
  Banknote,
  Building2,
  Navigation,
  Loader2,
  CheckCircle2,
  AlertTriangle,
  Crosshair,
  Edit3,
  ArrowUp,
  ArrowDown,
  ArrowLeft,
  ArrowRight,
  Link2,
  Clock,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';
import { useCart } from '../context/CartContext';
import {
  formatGuaranies,
  formatGuaraniesInput,
  parseGuaraniesInput,
  getWhatsAppUrl,
  buildGoogleMapsUrl,
} from '../utils/whatsapp';
import { Coordinates, CustomerOrder, LocationState } from '../types';

function getGeolocationErrorMessage(err: GeolocationPositionError): string {
  switch (err.code) {
    case err.PERMISSION_DENIED:
      return 'Permiso de GPS denegado. Puedes habilitarlo en tu navegador o cambiar a "Escribir dirección".';
    case err.POSITION_UNAVAILABLE:
      return 'Señal GPS no disponible ahora. Cambia a "Escribir dirección" para indicar dónde entregamos.';
    case err.TIMEOUT:
      return 'Se agotó el tiempo buscando señal GPS. Intenta de nuevo o usa "Escribir dirección".';
    default:
      return 'No pudimos obtener el GPS. Puedes usar la pestaña "Escribir dirección".';
  }
}

const QUICK_PYG_BILLS = [50000, 100000, 150000, 200000];

export const CheckoutModal: React.FC = () => {
  const { items, totalItems, totalPrice, isCheckoutOpen, setIsCheckoutOpen, clearCart } = useCart();

  const [customerName, setCustomerName] = useState('');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [deliveryMethod, setDeliveryMethod] = useState<'delivery' | 'pickup'>('delivery');

  // Pestaña activa para simplificar la ubicación (mantiene GPS y manual compatibles entre sí)
  const [locationTab, setLocationTab] = useState<'gps' | 'manual'>('gps');
  const [showMapsLinkField, setShowMapsLinkField] = useState(false);

  // 1) Automática por GPS
  const [location, setLocation] = useState<LocationState>({ status: 'idle' });
  const [isRefiningGps, setIsRefiningGps] = useState(false);

  // 2) Manual (dirección escrita, link opcional y referencias compartidas)
  const [address, setAddress] = useState('');
  const [manualMapsUrl, setManualMapsUrl] = useState('');
  const [references, setReferences] = useState('');

  const [paymentMethod, setPaymentMethod] = useState<'Efectivo' | 'Transferencia' | 'POS'>('Efectivo');
  const [cashAmount, setCashAmount] = useState('');
  const [notes, setNotes] = useState('');
  const [error, setError] = useState('');

  const watchIdRef = useRef<number | null>(null);
  const refineTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const stopGpsWatch = () => {
    if (watchIdRef.current !== null && typeof navigator !== 'undefined' && navigator.geolocation) {
      navigator.geolocation.clearWatch(watchIdRef.current);
      watchIdRef.current = null;
    }
    if (refineTimerRef.current) {
      clearTimeout(refineTimerRef.current);
      refineTimerRef.current = null;
    }
    setIsRefiningGps(false);
  };

  useEffect(() => {
    if (!isCheckoutOpen) {
      stopGpsWatch();
    }
    return () => stopGpsWatch();
  }, [isCheckoutOpen]);

  if (!isCheckoutOpen) return null;

  /**
   * Captura GPS de alta precisión mediante muestreo continuo (watchPosition),
   * conservando siempre la lectura con menor margen de error en metros.
   */
  const handleGetLocation = () => {
    setError('');
    stopGpsWatch();

    if (typeof navigator === 'undefined' || !navigator.geolocation) {
      setLocation({
        status: 'error',
        message: 'Tu navegador no soporta GPS. Usa la opción "Escribir dirección".',
      });
      return;
    }

    setLocation({ status: 'loading' });
    setIsRefiningGps(true);

    let bestCoords: Coordinates | null = null;

    const watchId = navigator.geolocation.watchPosition(
      (pos) => {
        const candidate: Coordinates = {
          latitude: pos.coords.latitude,
          longitude: pos.coords.longitude,
          accuracy: pos.coords.accuracy,
        };

        if (
          !bestCoords ||
          (candidate.accuracy !== undefined &&
            (bestCoords.accuracy === undefined || candidate.accuracy <= bestCoords.accuracy))
        ) {
          bestCoords = candidate;
          setLocation({
            status: 'success',
            coordinates: candidate,
          });
        }

        // Si ya logramos una precisión excelente (<= 15 metros), detenemos el muestreo
        if (candidate.accuracy !== undefined && candidate.accuracy <= 15) {
          stopGpsWatch();
        }
      },
      (err) => {
        if (!bestCoords) {
          setLocation({ status: 'error', message: getGeolocationErrorMessage(err) });
        }
        stopGpsWatch();
      },
      {
        enableHighAccuracy: true,
        timeout: 15000,
        maximumAge: 0,
      }
    );

    watchIdRef.current = watchId;

    // Afinar la lectura GPS durante hasta 4.5 segundos para obtener el punto más exacto
    refineTimerRef.current = setTimeout(() => {
      stopGpsWatch();
    }, 4500);
  };

  /**
   * Ajuste fino del punto GPS (~15 metros por clic) sin tocar la dirección manual.
   */
  const handleNudgeGps = (dLat: number, dLng: number) => {
    setLocation((prev) => {
      if (prev.status !== 'success') return prev;
      return {
        status: 'success',
        coordinates: {
          latitude: Number((prev.coordinates.latitude + dLat).toFixed(6)),
          longitude: Number((prev.coordinates.longitude + dLng).toFixed(6)),
          accuracy: prev.coordinates.accuracy,
        },
      };
    });
  };

  const handleCashAmountChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setCashAmount(formatGuaraniesInput(e.target.value));
    setError('');
  };

  const cashNumeric = parseGuaraniesInput(cashAmount);
  const changeAmount = cashNumeric > totalPrice ? cashNumeric - totalPrice : 0;

  const hasGpsLocation = location.status === 'success';
  const hasManualLocation = address.trim().length > 0 || manualMapsUrl.trim().length > 0;

  const handleSubmitOrder = (e: React.FormEvent) => {
    e.preventDefault();

    if (!customerName.trim()) {
      setError('Por favor ingresa tu nombre y apellido');
      return;
    }
    if (!phoneNumber.trim()) {
      setError('Por favor ingresa tu número de WhatsApp');
      return;
    }

    if (deliveryMethod === 'delivery' && !hasGpsLocation && !hasManualLocation) {
      setError('Para Delivery comparte tu GPS o escribe tu dirección.');
      return;
    }

    if (paymentMethod === 'Efectivo' && cashNumeric > 0 && cashNumeric < totalPrice) {
      setError(
        `El monto en efectivo (${formatGuaranies(cashNumeric)}) no puede ser menor al total a pagar (${formatGuaranies(totalPrice)}).`
      );
      return;
    }

    stopGpsWatch();

    const order: CustomerOrder = {
      customerName,
      phoneNumber,
      deliveryMethod,
      address: deliveryMethod === 'delivery' ? address.trim() || undefined : undefined,
      manualMapsUrl: deliveryMethod === 'delivery' ? manualMapsUrl.trim() || undefined : undefined,
      coordinates:
        deliveryMethod === 'delivery' && location.status === 'success'
          ? location.coordinates
          : undefined,
      references: deliveryMethod === 'delivery' ? references.trim() || undefined : undefined,
      paymentMethod,
      cashAmount: paymentMethod === 'Efectivo' && cashAmount.trim() ? cashAmount.trim() : undefined,
      notes,
      items,
      totalPrice,
    };

    const whatsappUrl = getWhatsAppUrl(order);

    // Abrir WhatsApp en pestaña nueva
    window.open(whatsappUrl, '_blank');

    // Limpiar carrito y cerrar modal
    clearCart();
    setIsCheckoutOpen(false);
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-black/80 backdrop-blur-sm flex items-center justify-center p-2.5 sm:p-4">
      <div className="relative bg-zinc-950 border border-zinc-800 rounded-3xl max-w-lg w-full text-white shadow-2xl overflow-hidden my-4 sm:my-6">
        {/* Header */}
        <div className="px-4 sm:px-6 py-4 sm:py-5 border-b border-zinc-800 flex items-center justify-between">
          <div className="flex items-center space-x-2.5">
            <span className="text-2xl">🛵</span>
            <div>
              <h3 className="text-lg sm:text-xl font-bold">Completar Pedido</h3>
              <p className="text-[11px] sm:text-xs text-zinc-400">
                Precios en Gs. • Confirmación por WhatsApp
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => setIsCheckoutOpen(false)}
            aria-label="Cerrar checkout"
            className="p-2 rounded-xl text-zinc-400 hover:text-white hover:bg-zinc-900 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Formulario */}
        <form
          onSubmit={handleSubmitOrder}
          className="px-4 sm:px-6 py-5 space-y-5 max-h-[82vh] sm:max-h-[78vh] overflow-y-auto dark-scrollbar"
        >
          {error && (
            <div className="p-3 bg-red-900/30 border border-red-700/50 rounded-xl text-red-300 text-xs">
              {error}
            </div>
          )}

          {/* Datos Personales */}
          <div className="space-y-3">
            <label className="block text-xs font-semibold text-zinc-300 uppercase tracking-wider">
              1. Tus Datos
            </label>
            <input
              type="text"
              autoComplete="name"
              placeholder="Nombre y Apellido *"
              value={customerName}
              onChange={(e) => {
                setCustomerName(e.target.value);
                setError('');
              }}
              className="w-full px-3.5 sm:px-4 py-3 bg-zinc-900 border border-zinc-800 rounded-xl text-sm focus:outline-none focus:border-orange-500 text-white placeholder-zinc-500"
              required
            />
            <input
              type="tel"
              autoComplete="tel"
              placeholder="WhatsApp (ej. 0981 123 456) *"
              value={phoneNumber}
              onChange={(e) => {
                setPhoneNumber(e.target.value);
                setError('');
              }}
              className="w-full px-3.5 sm:px-4 py-3 bg-zinc-900 border border-zinc-800 rounded-xl text-sm focus:outline-none focus:border-orange-500 text-white placeholder-zinc-500"
              required
            />
          </div>

          {/* Modalidad de Entrega */}
          <div className="space-y-3">
            <label className="block text-xs font-semibold text-zinc-300 uppercase tracking-wider">
              2. ¿Cómo querés recibir tu pedido?
            </label>
            <div className="grid grid-cols-2 gap-2.5 sm:gap-3">
              <button
                type="button"
                onClick={() => setDeliveryMethod('delivery')}
                className={`flex items-center justify-center space-x-1.5 sm:space-x-2 py-3 px-3 sm:px-4 rounded-xl border text-xs sm:text-sm font-semibold whitespace-nowrap transition ${
                  deliveryMethod === 'delivery'
                    ? 'bg-orange-600/20 border-orange-500 text-orange-400'
                    : 'bg-zinc-900 border-zinc-800 text-zinc-400 hover:text-white'
                }`}
              >
                <MapPin className="w-4 h-4 shrink-0" />
                <span>Delivery</span>
              </button>

              <button
                type="button"
                onClick={() => setDeliveryMethod('pickup')}
                className={`flex items-center justify-center space-x-1.5 sm:space-x-2 py-3 px-3 sm:px-4 rounded-xl border text-xs sm:text-sm font-semibold whitespace-nowrap transition ${
                  deliveryMethod === 'pickup'
                    ? 'bg-orange-600/20 border-orange-500 text-orange-400'
                    : 'bg-zinc-900 border-zinc-800 text-zinc-400 hover:text-white'
                }`}
              >
                <Store className="w-4 h-4 shrink-0" />
                <span className="sm:hidden">Retiro local</span>
                <span className="hidden sm:inline">Retiro en Local</span>
              </button>
            </div>

            {deliveryMethod === 'pickup' ? (
              <div className="p-4 bg-emerald-950/20 border border-emerald-500/30 rounded-2xl space-y-2">
                <div className="flex items-start gap-2.5">
                  <Store className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                  <div className="space-y-1 text-xs">
                    <p className="font-bold text-emerald-300">
                      Retiro en Caseritos Burguer — Km 13.5
                    </p>
                    <p className="text-zinc-300 flex items-center gap-1.5">
                      <Clock className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                      <span>Tiempo estimado: 15 a 25 min (te avisamos por WhatsApp)</span>
                    </p>
                    <p className="text-emerald-400 font-semibold">Costo de envío: Gratis</p>
                  </div>
                </div>
              </div>
            ) : (
              <div className="p-4 bg-zinc-900/70 border border-zinc-800 rounded-2xl space-y-3.5">
                {/* Cabecera simple + estado */}
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="text-xs font-semibold text-zinc-200">
                    ¿Dónde enviamos tu pedido? *
                  </p>
                  {hasGpsLocation && hasManualLocation ? (
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/40">
                      GPS + Dirección listos
                    </span>
                  ) : hasGpsLocation ? (
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/40">
                      GPS listo
                    </span>
                  ) : hasManualLocation ? (
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/20 text-amber-300 border border-amber-500/40">
                      Dirección lista
                    </span>
                  ) : (
                    <span className="text-[11px] text-zinc-400">Elige una opción</span>
                  )}
                </div>

                {/* Pestañas limpias: GPS vs Dirección manual */}
                <div className="grid grid-cols-2 gap-1.5 p-1 bg-zinc-950 border border-zinc-800 rounded-xl">
                  <button
                    type="button"
                    onClick={() => setLocationTab('gps')}
                    className={`flex items-center justify-center gap-1.5 py-2.5 px-2 sm:px-3 rounded-lg text-xs font-bold whitespace-nowrap transition ${
                      locationTab === 'gps'
                        ? 'bg-zinc-800 text-orange-400 shadow-sm'
                        : 'text-zinc-400 hover:text-zinc-200'
                    }`}
                  >
                    <Navigation className="w-3.5 h-3.5 shrink-0" />
                    <span>Usar mi GPS</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setLocationTab('manual')}
                    className={`flex items-center justify-center gap-1.5 py-2.5 px-2 sm:px-3 rounded-lg text-xs font-bold whitespace-nowrap transition ${
                      locationTab === 'manual'
                        ? 'bg-zinc-800 text-amber-400 shadow-sm'
                        : 'text-zinc-400 hover:text-zinc-200'
                    }`}
                  >
                    <Edit3 className="w-3.5 h-3.5 shrink-0" />
                    <span className="sm:hidden">Dirección</span>
                    <span className="hidden sm:inline">Escribir dirección</span>
                  </button>
                </div>

                {/* CONTENIDO PESTAÑA 1: GPS */}
                {locationTab === 'gps' && (
                  <div className="space-y-3">
                    <p className="text-[11px] text-zinc-400">
                      Comparte tu ubicación actual en 1 toque para que el repartidor llegue directo.
                    </p>

                    <button
                      type="button"
                      onClick={handleGetLocation}
                      disabled={location.status === 'loading'}
                      className="w-full flex items-center justify-center space-x-2 py-2.5 px-4 rounded-xl bg-zinc-950 hover:bg-zinc-800 border border-orange-500/50 hover:border-orange-400 disabled:opacity-60 text-orange-300 text-xs sm:text-sm font-bold transition"
                    >
                      {location.status === 'loading' || isRefiningGps ? (
                        <Loader2 className="w-4 h-4 animate-spin text-orange-400" />
                      ) : (
                        <Crosshair className="w-4 h-4 text-orange-400" />
                      )}
                      <span>
                        {location.status === 'loading'
                          ? 'Buscando tu ubicación...'
                          : isRefiningGps
                          ? 'Afinando precisión del GPS...'
                          : location.status === 'success'
                          ? 'Actualizar mi ubicación GPS'
                          : 'Compartir mi ubicación actual'}
                      </span>
                    </button>

                    {location.status === 'success' && (
                      <div className="space-y-2.5 p-3 bg-emerald-950/30 border border-emerald-500/40 rounded-xl">
                        <div className="flex items-start justify-between gap-2 text-xs text-emerald-300">
                          <div className="flex items-start space-x-2">
                            <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5 text-emerald-400" />
                            <div>
                              <p className="font-bold text-emerald-300">Ubicación capturada</p>
                              <div className="flex flex-wrap items-center gap-2 mt-0.5">
                                <a
                                  href={buildGoogleMapsUrl(location.coordinates)}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="underline text-amber-300 font-semibold"
                                >
                                  Ver en Google Maps
                                </a>
                                {location.coordinates.accuracy !== undefined && (
                                  <span className="text-[11px] text-zinc-400">
                                    • Precisión ~{Math.max(1, Math.round(location.coordinates.accuracy))} m
                                  </span>
                                )}
                              </div>
                            </div>
                          </div>
                          <button
                            type="button"
                            onClick={() => setLocation({ status: 'idle' })}
                            className="text-[11px] text-zinc-400 hover:text-red-400 underline shrink-0"
                          >
                            Quitar
                          </button>
                        </div>

                        {/* Mapa embebido para verificar el pin */}
                        <div className="rounded-lg overflow-hidden border border-zinc-700 h-32 w-full bg-zinc-950">
                          <iframe
                            title="Mapa de ubicación automática"
                            width="100%"
                            height="100%"
                            style={{ border: 0 }}
                            loading="lazy"
                            referrerPolicy="no-referrer-when-downgrade"
                            src={`https://maps.google.com/maps?q=${location.coordinates.latitude},${location.coordinates.longitude}&z=17&output=embed`}
                          />
                        </div>

                        {/* Controles de ajuste fino del punto GPS */}
                        <div className="flex items-center justify-between pt-1">
                          <span className="text-[11px] text-zinc-400">
                            Ajustar pin (±15 m):
                          </span>
                          <div className="flex items-center gap-1">
                            <button
                              type="button"
                              onClick={() => handleNudgeGps(0.00014, 0)}
                              aria-label="Mover pin al Norte"
                              className="p-1.5 rounded-lg bg-zinc-900 hover:bg-zinc-800 border border-zinc-700 text-zinc-200 transition"
                              title="Mover al Norte"
                            >
                              <ArrowUp className="w-3.5 h-3.5" />
                            </button>
                            <button
                              type="button"
                              onClick={() => handleNudgeGps(-0.00014, 0)}
                              aria-label="Mover pin al Sur"
                              className="p-1.5 rounded-lg bg-zinc-900 hover:bg-zinc-800 border border-zinc-700 text-zinc-200 transition"
                              title="Mover al Sur"
                            >
                              <ArrowDown className="w-3.5 h-3.5" />
                            </button>
                            <button
                              type="button"
                              onClick={() => handleNudgeGps(0, -0.00015)}
                              aria-label="Mover pin al Oeste"
                              className="p-1.5 rounded-lg bg-zinc-900 hover:bg-zinc-800 border border-zinc-700 text-zinc-200 transition"
                              title="Mover al Oeste"
                            >
                              <ArrowLeft className="w-3.5 h-3.5" />
                            </button>
                            <button
                              type="button"
                              onClick={() => handleNudgeGps(0, 0.00015)}
                              aria-label="Mover pin al Este"
                              className="p-1.5 rounded-lg bg-zinc-900 hover:bg-zinc-800 border border-zinc-700 text-zinc-200 transition"
                              title="Mover al Este"
                            >
                              <ArrowRight className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>
                      </div>
                    )}

                    {location.status === 'error' && (
                      <div className="flex items-start space-x-2 p-2.5 bg-red-950/30 border border-red-700/40 rounded-xl text-xs text-red-300">
                        <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5 text-red-400" />
                        <p>{location.message}</p>
                      </div>
                    )}
                  </div>
                )}

                {/* CONTENIDO PESTAÑA 2: DIRECCIÓN MANUAL */}
                {locationTab === 'manual' && (
                  <div className="space-y-3">
                    <div className="space-y-1.5">
                      <label className="text-[11px] font-semibold text-zinc-300 block">
                        Dirección (Calle, Barrio, Km) {!hasGpsLocation && '*'}
                      </label>
                      <input
                        type="text"
                        placeholder="Ej: Km 13.5, Barrio San Juan"
                        value={address}
                        onChange={(e) => {
                          setAddress(e.target.value);
                          setError('');
                        }}
                        className="w-full px-3.5 py-2.5 bg-zinc-950 border border-zinc-800 rounded-xl text-sm focus:outline-none focus:border-amber-500 text-white placeholder-zinc-500"
                      />
                    </div>

                    {/* Link de Google Maps colapsable para no abrumar */}
                    <div>
                      <button
                        type="button"
                        onClick={() => setShowMapsLinkField((prev) => !prev)}
                        className="text-[11px] font-semibold text-zinc-400 hover:text-amber-300 flex items-center gap-1.5 transition"
                      >
                        <Link2 className="w-3.5 h-3.5" />
                        <span>¿Tienes un link de Google Maps? (opcional)</span>
                        {showMapsLinkField ? (
                          <ChevronUp className="w-3.5 h-3.5" />
                        ) : (
                          <ChevronDown className="w-3.5 h-3.5" />
                        )}
                      </button>

                      {showMapsLinkField && (
                        <input
                          type="text"
                          placeholder="Pega aquí tu enlace de Google Maps"
                          value={manualMapsUrl}
                          onChange={(e) => {
                            setManualMapsUrl(e.target.value);
                            setError('');
                          }}
                          className="mt-2 w-full px-3.5 py-2.5 bg-zinc-950 border border-zinc-800 rounded-xl text-xs focus:outline-none focus:border-amber-500 text-white placeholder-zinc-500"
                        />
                      )}
                    </div>
                  </div>
                )}

                {/* Referencias de la casa (útil tanto con GPS como manual) */}
                <div className="space-y-1.5 pt-1 border-t border-zinc-800/80">
                  <label className="text-[11px] font-semibold text-zinc-400 block">
                    Referencias de la casa (opcional)
                  </label>
                  <input
                    type="text"
                    placeholder="Ej: Casa blanca, portón negro"
                    value={references}
                    onChange={(e) => setReferences(e.target.value)}
                    className="w-full px-3.5 py-2.5 bg-zinc-950 border border-zinc-800 rounded-xl text-xs sm:text-sm focus:outline-none focus:border-orange-500 text-white placeholder-zinc-500"
                  />
                </div>
              </div>
            )}
          </div>

          {/* Método de Pago */}
          <div className="space-y-3">
            <label className="block text-xs font-semibold text-zinc-300 uppercase tracking-wider">
              3. Forma de Pago (Gs.)
            </label>
            <div className="grid grid-cols-3 gap-2">
              <button
                type="button"
                onClick={() => setPaymentMethod('Efectivo')}
                className={`py-3 px-2 rounded-xl border text-xs font-semibold flex flex-col items-center space-y-1 transition ${
                  paymentMethod === 'Efectivo'
                    ? 'bg-emerald-600/20 border-emerald-500 text-emerald-400'
                    : 'bg-zinc-900 border-zinc-800 text-zinc-400 hover:text-white'
                }`}
              >
                <Banknote className="w-4 h-4" />
                <span>Efectivo (Gs.)</span>
              </button>

              <button
                type="button"
                onClick={() => setPaymentMethod('Transferencia')}
                className={`py-3 px-2 rounded-xl border text-xs font-semibold flex flex-col items-center space-y-1 transition ${
                  paymentMethod === 'Transferencia'
                    ? 'bg-emerald-600/20 border-emerald-500 text-emerald-400'
                    : 'bg-zinc-900 border-zinc-800 text-zinc-400 hover:text-white'
                }`}
              >
                <Building2 className="w-4 h-4" />
                <span>Transferencia</span>
              </button>

              <button
                type="button"
                onClick={() => setPaymentMethod('POS')}
                className={`py-3 px-2 rounded-xl border text-xs font-semibold flex flex-col items-center space-y-1 transition ${
                  paymentMethod === 'POS'
                    ? 'bg-emerald-600/20 border-emerald-500 text-emerald-400'
                    : 'bg-zinc-900 border-zinc-800 text-zinc-400 hover:text-white'
                }`}
              >
                <CreditCard className="w-4 h-4" />
                <span>Tarjeta / POS</span>
              </button>
            </div>

            {paymentMethod === 'Efectivo' && (
              <div className="space-y-2 p-3.5 bg-zinc-900/60 border border-zinc-800 rounded-2xl">
                <label className="block text-xs font-semibold text-zinc-300">
                  ¿Con cuántos Guaraníes (Gs.) vas a pagar?
                </label>

                <div className="relative">
                  <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-sm font-black text-amber-400 select-none">
                    Gs.
                  </span>
                  <input
                    type="text"
                    inputMode="numeric"
                    placeholder="Ej: 100.000"
                    value={cashAmount}
                    onChange={handleCashAmountChange}
                    className="w-full pl-12 pr-4 py-3 bg-zinc-900 border border-zinc-800 rounded-xl text-sm font-bold focus:outline-none focus:border-amber-500 text-amber-300 placeholder-zinc-500"
                  />
                </div>

                {/* Botones rápidos de billetes en Guaraníes */}
                <div className="flex flex-wrap gap-1.5 pt-0.5">
                  <button
                    type="button"
                    onClick={() => setCashAmount(formatGuaraniesInput(String(totalPrice)))}
                    className="px-2.5 py-1 rounded-lg bg-zinc-800 hover:bg-zinc-700 border border-zinc-700 text-[11px] font-semibold text-amber-300 transition"
                  >
                    Exacto ({formatGuaranies(totalPrice)})
                  </button>
                  {QUICK_PYG_BILLS.filter((b) => b >= totalPrice).map((bill) => (
                    <button
                      key={bill}
                      type="button"
                      onClick={() => setCashAmount(formatGuaraniesInput(String(bill)))}
                      className="px-2.5 py-1 rounded-lg bg-zinc-800 hover:bg-zinc-700 border border-zinc-700 text-[11px] font-semibold text-zinc-200 transition"
                    >
                      {formatGuaranies(bill)}
                    </button>
                  ))}
                </div>

                {cashNumeric > 0 && (
                  <div className="pt-1 text-xs">
                    {cashNumeric < totalPrice ? (
                      <span className="text-red-400 font-semibold">
                        El monto ingresado es menor al total ({formatGuaranies(totalPrice)}).
                      </span>
                    ) : changeAmount > 0 ? (
                      <span className="text-emerald-400 font-bold">
                        Vuelto a recibir: {formatGuaranies(changeAmount)}
                      </span>
                    ) : (
                      <span className="text-emerald-400 font-semibold">
                        Pago con monto exacto ({formatGuaranies(totalPrice)})
                      </span>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Observaciones */}
          <div className="space-y-2">
            <label className="block text-xs font-semibold text-zinc-300 uppercase tracking-wider">
              Observaciones generales (opcional)
            </label>
            <textarea
              rows={2}
              placeholder="Ej: Extra salsa ajo, timbre roto..."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="w-full px-4 py-3 bg-zinc-900 border border-zinc-800 rounded-xl text-sm focus:outline-none focus:border-orange-500 text-white placeholder-zinc-500 resize-none"
            />
          </div>

          {/* Mini-resumen del pedido */}
          <div className="p-4 bg-zinc-900/90 rounded-2xl border border-zinc-800 space-y-2.5">
            <div className="space-y-1.5 max-h-28 overflow-y-auto dark-scrollbar pr-1">
              {items.map((item) => (
                <div key={item.product.id} className="text-xs">
                  <div className="flex justify-between gap-2 text-zinc-200">
                    <span className="truncate">
                      <strong className="text-amber-400">{item.quantity}x</strong> {item.product.name}
                    </span>
                    <span className="font-semibold whitespace-nowrap">
                      {formatGuaranies(item.product.price * item.quantity)}
                    </span>
                  </div>
                  {item.instructions?.trim() && (
                    <p className="text-[11px] text-zinc-400 italic pl-4 truncate">
                      Nota: {item.instructions}
                    </p>
                  )}
                </div>
              ))}
            </div>

            <div className="pt-2 border-t border-zinc-800 space-y-1.5">
              <div className="flex justify-between text-xs text-zinc-400">
                <span>Cantidad de ítems:</span>
                <span className="text-zinc-200 font-bold">{totalItems}</span>
              </div>
              <div className="flex justify-between text-xs text-zinc-400">
                <span>Envío:</span>
                <span className="text-emerald-400 font-semibold">
                  {deliveryMethod === 'pickup' ? 'Gratis (Retiro en local)' : 'A coordinar por WhatsApp'}
                </span>
              </div>
              <div className="flex justify-between items-center text-base font-bold pt-1">
                <span className="text-white">Total a pagar (Gs.):</span>
                <span className="text-xl text-amber-400">{formatGuaranies(totalPrice)}</span>
              </div>
            </div>
          </div>

          {/* Botón WhatsApp */}
          <button
            type="submit"
            className="w-full py-4 rounded-xl bg-gradient-to-r from-emerald-600 to-green-500 hover:from-emerald-500 hover:to-green-400 text-white font-bold text-base shadow-lg shadow-emerald-950/40 transition flex items-center justify-center space-x-2"
          >
            <Send className="w-5 h-5" />
            <span>Enviar Pedido a WhatsApp</span>
          </button>
        </form>
      </div>
    </div>
  );
};
