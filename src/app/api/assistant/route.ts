import { NextResponse } from 'next/server';
import { GoogleGenAI } from '@google/genai';
import { Product } from '@/types';
import { INITIAL_PRODUCTS } from '@/data/mockProducts';

const pygFormatter = new Intl.NumberFormat('es-PY');
const formatGs = (price: number) => `Gs. ${pygFormatter.format(Math.round(price || 0))}`;

function normalizeText(text: string): string {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
}

function extractBudgetPyg(message: string): number | null {
  const normalized = normalizeText(message);

  // Ej: "50 mil", "50k", "50.000", "50000"
  const milMatch = normalized.match(/(\d+(?:[.,]\d+)?)\s*(?:mil|k)\b/);
  if (milMatch) {
    const num = parseFloat(milMatch[1].replace(',', '.'));
    if (!Number.isNaN(num) && num >= 5 && num <= 2000) {
      return Math.round(num * 1000);
    }
  }

  const gsMatch = normalized.match(/\b(\d{1,3}(?:[.,]\d{3})+|\d{5,7})\b/);
  if (gsMatch) {
    const digits = parseInt(gsMatch[1].replace(/\D/g, ''), 10);
    if (!Number.isNaN(digits) && digits >= 3000) {
      return digits;
    }
  }

  return null;
}

function extractPartySize(message: string): number | null {
  const normalized = normalizeText(message);
  const match = normalized.match(
    /(?:para|somos|entre)\s+(\d+|dos|tres|cuatro|cinco|seis)\b|\b(\d+)\s*(?:personas?|amigos?|adultos?)/
  );
  if (!match) return null;
  const raw = match[1] || match[2];
  const words: Record<string, number> = { dos: 2, tres: 3, cuatro: 4, cinco: 5, seis: 6 };
  const count = words[raw] || parseInt(raw, 10);
  return count >= 2 && count <= 15 ? count : null;
}

function buildSmartLocalReply(message: string, rawMenu: Product[]): string {
  const menu = (Array.isArray(rawMenu) && rawMenu.length > 0 ? rawMenu : INITIAL_PRODUCTS).filter(
    (p) => p.available !== false
  );
  const q = normalizeText(message);

  const burgers = menu.filter((p) => p.category === 'hamburguesas');
  const combos = menu.filter((p) => p.category === 'combos');
  const sides = menu.filter(
    (p) => p.category === 'guarniciones' || p.category === 'papas_entradas'
  );
  const extras = menu.filter((p) => p.category === 'agregados');

  // 1. Consulta por promociones
  if (/(promo|descuento|2x1|oferta|miercoles|jueves|viernes|sabado)/.test(q)) {
    return [
      '🎉 **Días de Promo en Caseritos Burguer:**',
      '',
      '• **Miércoles & Jueves:** 2x1 en hamburguesas seleccionadas.',
      '• **Viernes & Sábados:** Papas con cheddar y bacon gratis en tus combos.',
      '',
      'Además tienes nuestros **Combos Completos** (hamburguesa + papa frita + gaseosa 250ml) desde **Gs. 27.000** hasta **Gs. 47.000**.',
      '¿Quieres que te recomiende uno según tu presupuesto? 🍔',
    ].join('\n');
  }

  // 2. Consulta por ubicación, delivery, retiro o formas de pago
  if (/(ubicacion|donde|direccion|delivery|envio|retiro|pago|efectivo|transferencia|tarjeta|pos)/.test(q)) {
    return [
      '📍 **Información para tu pedido en Caseritos Burguer (Km 13.5):**',
      '',
      '• **Delivery:** puedes compartir tu GPS en 1 toque o escribir tu dirección en el checkout (envío a coordinar por WhatsApp).',
      '• **Retiro en local:** gratis en Km 13.5 (listo en 15 a 25 min aprox.).',
      '• **Formas de pago:** Efectivo (con cálculo de vuelto en Gs.), Transferencia o Tarjeta / POS.',
      '',
      'Agrega tus platos al carrito y envía tu pedido directo a WhatsApp. 🛵',
    ].join('\n');
  }

  // 3. Consulta por presupuesto en Guaraníes
  const budget = extractBudgetPyg(message);
  if (budget !== null) {
    const affordableCombos = combos
      .filter((c) => c.price <= budget)
      .sort((a, b) => b.price - a.price);
    const affordableBurgers = burgers
      .filter((b) => b.price <= budget)
      .sort((a, b) => b.price - a.price);

    if (affordableCombos.length === 0 && affordableBurgers.length === 0) {
      const cheapest = [...menu].sort((a, b) => a.price - b.price).slice(0, 3);
      return [
        `💰 Con **${formatGs(budget)}**, las opciones más económicas disponibles son:`,
        ...cheapest.map((p) => `• **${p.name}** (${formatGs(p.price)})`),
        '',
        'Nuestras hamburguesas caseras arrancan desde **Gs. 12.000** (`Caseritos`). 🍔',
      ].join('\n');
    }

    const lines: string[] = [`💰 Con **${formatGs(budget)}** te recomiendo estas opciones:`];

    if (affordableCombos.length > 0) {
      const topCombo = affordableCombos[0];
      const remaining = budget - topCombo.price;
      const matchingExtra = extras.find((e) => e.price <= remaining);
      const matchingSide = sides.find((s) => s.price <= remaining);

      if (matchingSide) {
        const total = topCombo.price + matchingSide.price;
        lines.push(
          `• **Opción completísima:** ${topCombo.name} (${formatGs(topCombo.price)}) + ${matchingSide.name} (${formatGs(matchingSide.price)}) = **${formatGs(total)}**`
        );
      } else if (matchingExtra) {
        const total = topCombo.price + matchingExtra.price;
        lines.push(
          `• **Combo + Extra:** ${topCombo.name} (${formatGs(topCombo.price)}) + ${matchingExtra.name} (${formatGs(matchingExtra.price)}) = **${formatGs(total)}**`
        );
      } else {
        lines.push(
          `• **Combo ideal:** ${topCombo.name} (${formatGs(topCombo.price)}) — incluye papa frita y gaseosa 250ml.`
        );
      }
    }

    if (affordableBurgers.length > 0) {
      const topBurger = affordableBurgers[0];
      const sideOption = sides
        .filter((s) => topBurger.price + s.price <= budget)
        .sort((a, b) => b.price - a.price)[0];

      if (sideOption) {
        const total = topBurger.price + sideOption.price;
        lines.push(
          `• **Burger + Papas:** ${topBurger.name} (${formatGs(topBurger.price)}) + ${sideOption.name} (${formatGs(sideOption.price)}) = **${formatGs(total)}**`
        );
      } else {
        const qty = Math.min(4, Math.floor(budget / topBurger.price));
        if (qty >= 2) {
          lines.push(
            `• **Para compartir:** ${qty}x ${topBurger.name} = **${formatGs(qty * topBurger.price)}**`
          );
        } else {
          lines.push(`• **Hamburguesa sola:** ${topBurger.name} (${formatGs(topBurger.price)})`);
        }
      }
    }

    lines.push('', '¡Puedes agregarlas directo desde el menú y pedir en segundos por WhatsApp! 🍔');
    return lines.join('\n');
  }

  // 4. Consulta por cantidad de personas / combos para compartir
  const partySize = extractPartySize(message);
  if (partySize !== null || /(combo|pareja|compartir)/.test(q)) {
    const count = partySize || 2;
    const midCombo = combos.find((c) => c.id === 'combo-tradicional') || combos[1] || combos[0];
    const baconCombo = combos.find((c) => c.id === 'combo-bacon') || combos[2] || combos[0];
    const bigFries = sides.find((s) => s.id === 'papas-bacon-cheddar') || sides[sides.length - 1];

    const lines = [
      `🍔 **Recomendación ideal para ${count} personas:**`,
      '',
    ];

    if (count === 2 && midCombo && baconCombo) {
      const total = midCombo.price + baconCombo.price;
      lines.push(
        `• **Opción Combos Completos:** 1x ${midCombo.name} (${formatGs(midCombo.price)}) + 1x ${baconCombo.name} (${formatGs(baconCombo.price)}) = **${formatGs(total)}** *(ambos con papas y gaseosa 250ml)*.`
      );
    } else if (midCombo) {
      lines.push(
        `• **Opción Combos:** ${count}x ${midCombo.name} = **${formatGs(count * midCombo.price)}** *(incluye papas y gaseosa 250ml por persona)*.`
      );
    }

    const baseBurger = burgers.find((b) => b.id === 'burger-bacon') || burgers[0];
    if (baseBurger && bigFries) {
      const total = count * baseBurger.price + bigFries.price;
      lines.push(
        `• **Opción para compartir papas:** ${count}x ${baseBurger.name} + 1x ${bigFries.name} = **${formatGs(total)}**.`
      );
    }

    lines.push('', 'En cada tarjeta puedes elegir **Solo** o **Combo** con un toque. 😋');
    return lines.join('\n');
  }

  // 5. Consulta por guarniciones / papas / agregados
  if (/(guarnicion|papa|frita|entrada|acompan|agregado|extra)/.test(q)) {
    const targetList = /(agregado|extra)/.test(q) ? extras : sides;
    const heading = /(agregado|extra)/.test(q)
      ? '🧀 **Agregados Extras disponibles:**'
      : '🍟 **Papas & Guarniciones más pedidas:**';

    return [
      heading,
      '',
      ...targetList.map(
        (p) => `• **${p.name}** (${formatGs(p.price)}) — ${p.description}`
      ),
      '',
      '⭐ La favorita indiscutida son las **Papas Fritas con Bacon y Cheddar** (Gs. 25.000).',
    ].join('\n');
  }

  // 6. Exclusiones ("sin huevo", "sin cebolla", "sin tomate", "sin lechuga")
  const sinMatch = q.match(/sin\s+(huevo|cebolla|tomate|lechuga|bacon|panceta|cheddar)/);
  if (sinMatch) {
    const excluded = sinMatch[1] === 'panceta' ? 'bacon' : sinMatch[1];
    const matching = burgers.filter(
      (p) => !normalizeText(`${p.name} ${p.description}`).includes(excluded)
    );
    const lines = [`✅ **Opciones sin ${sinMatch[1]}:**`, ''];
    if (matching.length > 0) {
      matching.forEach((p) =>
        lines.push(`• **${p.name}** (${formatGs(p.price)}) — ${p.description}`)
      );
    }
    lines.push(
      '',
      `💡 Además, en cualquier hamburguesa puedes abrir **Mi Pedido** y escribir **"Sin ${sinMatch[1]}"** en la nota del producto.`
    );
    return lines.join('\n');
  }

  // 7. Búsqueda por ingredientes específicos (bacon/panceta, doble, cheddar, cebolla, huevo, salsa, premium)
  const ingredientKeywords = [
    { regex: /(bacon|panceta)/, term: 'bacon', label: 'con bacon/panceta' },
    { regex: /(doble|premium|grande|hambre)/, term: 'doble', label: 'doble carne / bien llenadoras' },
    { regex: /cebolla/, term: 'cebolla', label: 'con cebolla caramelizada' },
    { regex: /cheddar/, term: 'cheddar', label: 'con mucho cheddar' },
    { regex: /huevo/, term: 'huevo', label: 'con huevo' },
    { regex: /(lechuga|tomate|vegetal|clasic|tradicional)/, term: 'lechuga', label: 'clásicas con vegetales' },
  ];

  for (const kw of ingredientKeywords) {
    if (kw.regex.test(q)) {
      const matched = menu
        .filter((p) => normalizeText(`${p.name} ${p.description} ${(p.tags || []).join(' ')}`).includes(kw.term))
        .slice(0, 5);
      if (matched.length > 0) {
        return [
          `🔥 **Nuestras opciones ${kw.label}:**`,
          '',
          ...matched.map((p) => `• **${p.name}** (${formatGs(p.price)}) — ${p.description}`),
          '',
          '¿Quieres agregar alguna a tu pedido? También puedes sumar extras de bacon, cheddar o carne 100gr. 🍔',
        ].join('\n');
      }
    }
  }

  // 8. Respuesta general amigable con las estrellas reales del menú
  const topPicks = [
    burgers.find((b) => b.id === 'burger-caseritos') || burgers[0],
    burgers.find((b) => b.id === 'burger-bacon') || burgers[2],
    burgers.find((b) => b.id === 'burger-premium') || burgers[3],
    sides.find((s) => s.id === 'papas-bacon-cheddar') || sides[0],
  ].filter(Boolean) as Product[];

  return [
    '🍔 **¡Las más pedidas de Caseritos Burguer (Km 13.5)!**',
    '',
    ...topPicks.map((p) => `• **${p.name}** (${formatGs(p.price)}) — ${p.description}`),
    '',
    'Dime tu **presupuesto** (ej: *"tengo 40.000 Gs"*), qué **ingredientes** te tientan o para **cuántas personas** es, y te armo el pedido ideal. 😋',
  ].join('\n');
}

export async function POST(req: Request) {
  let message = '';
  let menuContext: Product[] = [];

  try {
    const body = (await req.json()) as {
      message?: string;
      menuContext?: Product[];
    };
    message = (body.message || '').trim();
    menuContext = Array.isArray(body.menuContext) ? body.menuContext : [];

    if (!message) {
      return NextResponse.json({ error: 'Mensaje requerido' }, { status: 400 });
    }

    const apiKey = (
      process.env.GOOGLE_AI_API_KEY ||
      process.env.GEMINI_API_KEY ||
      ''
    ).trim();

    // Si no hay API key configurada todavía, usar nuestro asistente inteligente local con el menú real
    if (!apiKey || apiKey.includes('tu_gemini_api_key')) {
      return NextResponse.json({
        reply: buildSmartLocalReply(message, menuContext),
        mode: 'smart-menu',
      });
    }

    // Inicializar Google Gen AI SDK
    const ai = new GoogleGenAI({ apiKey });
    const activeMenu = menuContext.length > 0 ? menuContext : INITIAL_PRODUCTS;

    const systemInstruction = `
Eres "CaceriBot IA", el asistente virtual de "Caseritos Burguer", ubicados en Km 13.5.
Tus hamburguesas son 100% caseras (no menciones que están a la parrilla, solo destaca que son caseras, artesanales y con ingredientes de primera).
Tu trabajo es atender amigablemente a los clientes, hacer recomendaciones según sus gustos o presupuesto, explicar los ingredientes y ayudarlos a decidir su pedido.

Reglas esenciales:
1. Toda la moneda es Guaraníes de Paraguay (Gs.). Formatea los números con punto de miles (ej: Gs. 45.000).
2. Utiliza un tono cálido, paraguayo/latinoamericano moderno y entusiasta con emojis moderados de comida 🍔🍟🥤.
3. Solo recomienda productos que existan en el menú que te proporcionamos.
4. Si el cliente tiene un presupuesto específico (ej: 50.000 Gs.), calcula y sugiere la combinación óptima de hamburguesa, combo o papas.
5. Si el cliente indica qué quiere pedir, confírmale el detalle, el subtotal en Guaraníes y anímalo a agregarlos al carrito o finalizar por WhatsApp.
6. Mantén las respuestas directas, legibles y concisas.

MENÚ ACTUAL DE CASERITOS BURGUER:
${JSON.stringify(
  activeMenu.map((p) => ({
    nombre: p.name,
    categoria: p.category,
    precio: formatGs(p.price),
    descripcion: p.description,
    disponible: p.available,
  })),
  null,
  2
)}
`;

    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: message,
      config: {
        systemInstruction,
        temperature: 0.7,
      },
    });

    const reply = response.text?.trim() || buildSmartLocalReply(message, menuContext);
    return NextResponse.json({ reply, mode: 'gemini' });
  } catch (error: unknown) {
    console.error('Error en API de Asistente Gemini, usando respaldo inteligente:', error);
    return NextResponse.json(
      {
        reply: buildSmartLocalReply(message || 'recomendación', menuContext),
        mode: 'smart-menu-fallback',
      },
      { status: 200 }
    );
  }
}
