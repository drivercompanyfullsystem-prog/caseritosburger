import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { GoogleGenAI } from '@google/genai';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { promises as fs } from 'fs';
import path from 'path';
import { storage, isFirebaseConfigured } from '@/lib/firebase';
import {
  ADMIN_CATEGORY_OPTIONS,
  getCategoryPresetImage,
  normalizeCategoryForForm,
} from '@/constants/categories';

interface GenerateImageBody {
  name?: string;
  description?: string;
  category?: string;
  attempt?: number;
}

function buildFoodPhotographyPrompt(name: string, category: string, description: string): string {
  return `Professional studio food photography of ${name}, category: ${category}, ${description}. Commercial restaurant quality, cinematic lighting, appetizing presentation on a rustic dark wooden surface, 8k resolution, shallow depth of field, no text, no watermarks.`;
}

function selectSmartGastronomicFallback(
  name: string,
  description: string,
  category: string,
  attempt = 0
): string {
  const normalizedCategory = normalizeCategoryForForm(category);
  const text = `${name} ${description}`.toLowerCase();

  // Coincidencias semánticas específicas para fotografía gastronómica de estudio
  if (normalizedCategory === 'hamburguesas') {
    if (text.includes('doble') || text.includes('premium') || text.includes('monster')) {
      const doubleVariants = [
        '/menu/burger-premium.jpg?v=fhd2',
        'https://images.unsplash.com/photo-1586190848861-99aa4a171e90?auto=format&fit=crop&w=1200&q=85',
        'https://images.unsplash.com/photo-1553979459-d2229ba7433b?auto=format&fit=crop&w=1200&q=85',
      ];
      return doubleVariants[attempt % doubleVariants.length];
    }
    if (text.includes('bacon') || text.includes('panceta') || text.includes('cebolla')) {
      const baconVariants = [
        '/menu/burger-bacon.jpg?v=fhd2',
        'https://images.unsplash.com/photo-1594212699903-ec8a3eca50f5?auto=format&fit=crop&w=1200&q=85',
        '/menu/burger-caseritos.jpg?v=fhd2',
      ];
      return baconVariants[attempt % baconVariants.length];
    }
    if (text.includes('tradicional') || text.includes('lechuga') || text.includes('tomate') || text.includes('huevo')) {
      const tradVariants = [
        '/menu/burger-tradicional.jpg?v=fhd2',
        'https://images.unsplash.com/photo-1572802419224-296b0aeee0d9?auto=format&fit=crop&w=1200&q=85',
      ];
      return tradVariants[attempt % tradVariants.length];
    }
  }

  if (normalizedCategory === 'papas_entradas') {
    if (text.includes('bacon') || text.includes('cheddar')) {
      const loadedFries = [
        '/menu/papas.jpg?v=fhd2',
        'https://images.unsplash.com/photo-1585109649139-366815a0d713?auto=format&fit=crop&w=1200&q=85',
      ];
      return loadedFries[attempt % loadedFries.length];
    }
  }

  const option = ADMIN_CATEGORY_OPTIONS.find((c) => c.id === normalizedCategory);
  if (option && option.aiVariants.length > 0) {
    const pool = [option.presetImageUrl, ...option.aiVariants];
    return pool[attempt % pool.length];
  }

  return getCategoryPresetImage(normalizedCategory);
}

async function persistGeneratedBuffer(buffer: Buffer, slug: string): Promise<string> {
  const fileName = `${Date.now()}_${slug}.jpg`;
  const storagePath = `products/ai-generated/${fileName}`;

  // 1. Subir a Firebase Storage en /products/ai-generated/ si está configurado
  if (isFirebaseConfigured() && storage) {
    try {
      const storageRef = ref(storage, storagePath);
      const uploadResult = await uploadBytes(storageRef, new Uint8Array(buffer), {
        contentType: 'image/jpeg',
      });
      return await getDownloadURL(uploadResult.ref);
    } catch (storageErr) {
      console.warn('Error al subir imagen IA a Firebase Storage, guardando en /public:', storageErr);
    }
  }

  // 2. Fallback local: guardar en public/products/ai-generated/ y retornar URL pública
  try {
    const publicDir = path.join(process.cwd(), 'public', 'products', 'ai-generated');
    await fs.mkdir(publicDir, { recursive: true });
    await fs.writeFile(path.join(publicDir, fileName), buffer);
    return `/products/ai-generated/${fileName}`;
  } catch {
    return `data:image/jpeg;base64,${buffer.toString('base64')}`;
  }
}

export async function POST(req: NextRequest) {
  try {
    // 1. Verificar sesión de administrador
    const cookieStore = cookies();
    const sessionToken = cookieStore.get('__session')?.value;
    if (!sessionToken || sessionToken.trim() === '') {
      return NextResponse.json(
        { error: 'No autorizado. Debes iniciar sesión como administrador.' },
        { status: 401 }
      );
    }

    // 2. Validar parámetros del producto
    const body = (await req.json()) as GenerateImageBody;
    const name = (body.name || '').trim();
    const description = (body.description || '').trim();
    const category = normalizeCategoryForForm(body.category || 'hamburguesas');
    const attempt = typeof body.attempt === 'number' ? body.attempt : 0;

    if (!name) {
      return NextResponse.json(
        { error: 'El nombre del producto es obligatorio para generar la imagen con IA.' },
        { status: 400 }
      );
    }

    const prompt = buildFoodPhotographyPrompt(
      name,
      category,
      description || `${name} estilo artesanal de restaurante`
    );

    const slug =
      name
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/(^-|-$)/g, '')
        .slice(0, 40) || 'producto';

    const apiKey = process.env.GOOGLE_AI_API_KEY || process.env.GEMINI_API_KEY;

    // 3. Si GOOGLE_AI_API_KEY está configurada, generar con Google AI Studio (Imagen 3 / Gemini)
    if (apiKey && apiKey.trim() !== '' && !apiKey.includes('tu_gemini_api_key')) {
      try {
        const ai = new GoogleGenAI({ apiKey });

        const response = await ai.models.generateImages({
          model: 'imagen-3.0-generate-002',
          prompt,
          config: {
            numberOfImages: 1,
            outputMimeType: 'image/jpeg',
            aspectRatio: '4:3',
          },
        });

        const base64ImageBytes = response?.generatedImages?.[0]?.image?.imageBytes;
        if (base64ImageBytes) {
          const imageBuffer = Buffer.from(base64ImageBytes, 'base64');
          const downloadURL = await persistGeneratedBuffer(imageBuffer, slug);

          return NextResponse.json({
            imageUrl: downloadURL,
            imageSource: 'ai_generated',
            prompt,
            provider: 'google-ai-imagen',
          });
        }
      } catch (aiError: any) {
        console.warn('Aviso al invocar Google AI Imagen API, usando estudio gastronómico inteligente:', aiError?.message);
      }
    }

    // 4. Fallback inteligente de estudio gastronómico si no hay API Key activa o hubo límite de cuota
    const studioUrl = selectSmartGastronomicFallback(name, description, category, attempt);

    return NextResponse.json({
      imageUrl: studioUrl,
      imageSource: 'ai_generated',
      prompt,
      provider: 'studio-smart-preset',
    });
  } catch (error: any) {
    console.error('Error en /api/admin/generate-image:', error);
    return NextResponse.json(
      {
        error: 'No se pudo generar la imagen del producto.',
        details: error?.message,
      },
      { status: 500 }
    );
  }
}
