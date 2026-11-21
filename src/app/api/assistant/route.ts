import { NextResponse } from 'next/server';
import { GoogleGenAI } from '@google/genai';
import { Product } from '@/types';

export async function POST(req: Request) {
  try {
    const { message, menuContext } = (await req.json()) as {
      message: string;
      menuContext: Product[];
    };

    if (!message) {
      return NextResponse.json({ error: 'Mensaje requerido' }, { status: 400 });
    }

    const apiKey = process.env.GOOGLE_AI_API_KEY;

    // Si no está configurada la API Key todavía, proveer respuesta inteligente de fallback
    if (!apiKey || apiKey.trim() === '' || apiKey.includes('tu_gemini_api_key')) {
      return NextResponse.json({
        reply: `¡Hola! Soy **CaceriBot IA**, tu asesor de **Caseritos Burguer** 🍔 (Km 13.5). 
Veo que preguntas por: "${message}".

Nuestras hamburguesas son 100% caseras y las opciones más pedidas son:
• **Caseritos** (12.000 Gs.) - Pan, carne 100gr, bacon y cheddar.
• **Caseritos Bacon** (22.000 Gs.) - Con huevo, bacon, cheddar, cebolla caramelizada y salsa especial.
• **Combo Caseritos Premium** (47.000 Gs.) - Doble carne 100gr, doble cheddar, bacon, huevo + papas fritas y gaseosa 250ml.

*(Nota: Para habilitar respuestas generativas en vivo con Gemini, configura tu GOOGLE_AI_API_KEY en .env.local)*`,
      });
    }

    // Inicializar Google Gen AI SDK
    const ai = new GoogleGenAI({ apiKey });

    const systemInstruction = `
Eres "CaceriBot", el asistente virtual de "Caseritos Burguer", ubicados en Km 13.5.
Tus hamburguesas son 100% caseras (no menciones que están a la parrilla, solo destaca que son caseras, artesanales y con ingredientes de primera).
Tu trabajo es atender amigablemente a los clientes, hacer recomendaciones según sus gustos o presupuesto, explicar los ingredientes y ayudarlos a decidir su pedido.

Reglas esenciales:
1. Toda la moneda es Guaraníes de Paraguay (Gs.). Formatea los números con punto de miles (ej: 45.000 Gs.).
2. Utiliza un tono cálido, paraguayo/latinoamericano moderno y entusiasta con emojis moderados de comida 🍔🍟🥤.
3. Solo recomienda productos que existan en el menú que te proporcionamos.
4. Si el cliente tiene un presupuesto específico (ej: 50.000 Gs.), calcula y sugiere la combinación óptima de hamburguesa + bebida o papas.
5. Si el cliente te indica lo que quiere pedir (ej: "Quiero una Cacerita Clásica y unas papas"), confírmale el detalle, el subtotal en Guaraníes y anímalo a agregarlos al carrito o finalizar por WhatsApp.
6. Mantén las respuestas directas, legibles y concisas.

MENÚ ACTUAL DE CASERITOS BURGUER:
${JSON.stringify(
  menuContext.map((p) => ({
    nombre: p.name,
    categoria: p.category,
    precio: `${p.price.toLocaleString('es-PY')} Gs.`,
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

    const reply = response.text || 'Disculpa, no pude procesar la recomendación en este momento.';
    return NextResponse.json({ reply });
  } catch (error: any) {
    console.error('Error en API de Asistente Gemini:', error);
    return NextResponse.json(
      {
        reply: 'Hubo un inconveniente al consultar con el asistente de IA. Por favor intenta de nuevo en unos momentos.',
        error: error.message,
      },
      { status: 200 }
    );
  }
}
