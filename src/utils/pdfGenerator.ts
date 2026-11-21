import jsPDF from 'jspdf';
import { Product } from '../types';
import { formatGuaranies } from './whatsapp';

/**
 * Limpia el texto para asegurar compatibilidad total con la codificación WinAnsi de jsPDF,
 * conservando todos los acentos del español (á, é, í, ó, ú, ñ, ü, ¡, ¿).
 */
function sanitizePdfText(input: string): string {
  if (!input) return '';
  return input
    .replace(/Cacerit/gi, (match) => (match[0] === 'C' ? 'Caserit' : 'caserit'))
    .replace(/•/g, ' - ')
    .replace(new RegExp('[\\u{1F300}-\\u{1FAFF}\\u{2600}-\\u{27BF}\\u{FE00}-\\u{FE0F}]', 'gu'), '')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Carga una imagen local o remota (vía proxy) y la convierte a JPEG Base64.
 */
async function loadImageAsJpeg(
  url: string,
  options: { circular?: boolean; width?: number; height?: number } = {}
): Promise<string | null> {
  if (typeof window === 'undefined' || !url) return null;

  const targetW = options.width || 400;
  const targetH = options.height || 400;
  const resolvedUrl =
    url.startsWith('http://') || url.startsWith('https://')
      ? `/api/image-proxy?url=${encodeURIComponent(url)}`
      : url;

  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';

    const timeout = setTimeout(() => {
      resolve(null);
    }, 8000);

    img.onload = () => {
      clearTimeout(timeout);
      try {
        const canvas = document.createElement('canvas');
        canvas.width = targetW;
        canvas.height = targetH;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          resolve(null);
          return;
        }

        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = 'high';
        ctx.fillStyle = '#14110F';
        ctx.fillRect(0, 0, targetW, targetH);

        if (options.circular) {
          ctx.save();
          ctx.beginPath();
          ctx.arc(targetW / 2, targetH / 2, Math.min(targetW, targetH) / 2 - 4, 0, Math.PI * 2);
          ctx.closePath();
          ctx.clip();
        }

        // Recorte centrado (object-fit: cover)
        const targetRatio = targetW / targetH;
        const imgRatio = img.width / img.height;
        let sx = 0;
        let sy = 0;
        let sWidth = img.width;
        let sHeight = img.height;

        if (imgRatio > targetRatio) {
          sWidth = img.height * targetRatio;
          sx = (img.width - sWidth) / 2;
        } else if (imgRatio < targetRatio) {
          sHeight = img.width / targetRatio;
          sy = (img.height - sHeight) / 2;
        }

        ctx.drawImage(img, sx, sy, sWidth, sHeight, 0, 0, targetW, targetH);

        if (options.circular) {
          ctx.restore();
          ctx.strokeStyle = '#F59E0B';
          ctx.lineWidth = Math.max(6, Math.round(targetW * 0.035));
          ctx.beginPath();
          ctx.arc(targetW / 2, targetH / 2, Math.min(targetW, targetH) / 2 - 4, 0, Math.PI * 2);
          ctx.stroke();
        }

        resolve(canvas.toDataURL('image/jpeg', 0.95));
      } catch {
        resolve(null);
      }
    };

    img.onerror = () => {
      clearTimeout(timeout);
      resolve(null);
    };

    img.src = resolvedUrl;
  });
}

export async function generateMenuPDF(products: Product[]) {
  const doc = new jsPDF('p', 'mm', 'a4');

  // Datos oficiales de la carta de Caseritos Burguer
  const officialPhoneDisplay = '0982606227';
  const officialAddressDisplay = 'Km 13,5';

  // Cargar imágenes principales en paralelo
  const activeProducts = products.filter((p) => p.available);
  const burgers = activeProducts.filter((p) => p.category === 'hamburguesas');
  const papas = activeProducts.filter(
    (p) => p.category === 'guarniciones' || p.category === 'papas_entradas'
  );
  const agregados = activeProducts.filter((p) => p.category === 'agregados');

  // Imágenes remasterizadas en Full HD (1920x1440 / 1440x1920) del menú oficial (public/menu/*)
  const fallbackBurgerImgs = [
    '/menu/burger-caseritos.jpg?v=fhd2',
    '/menu/burger-tradicional.jpg?v=fhd2',
    '/menu/burger-bacon.jpg?v=fhd2',
    '/menu/burger-premium.jpg?v=fhd2',
  ];
  const agregadoIconUrls = [
    '/menu/agregado-carne.jpg?v=fhd2',
    '/menu/agregado-cheddar.jpg?v=fhd2',
    '/menu/agregado-bacon.jpg?v=fhd2',
    '/menu/agregado-cebolla.jpg?v=fhd2',
  ];

  const resolveCatalogImg = (customUrl: string | undefined, defaultUrl: string) => {
    if (!customUrl || customUrl.startsWith('/menu/')) return defaultUrl;
    return customUrl;
  };

  const [logoImg, friesImg, ...restImgs] = await Promise.all([
    loadImageAsJpeg('/logo.jpg?v=fhd2', { circular: true, width: 700, height: 700 }),
    loadImageAsJpeg('/menu/papas.jpg?v=fhd2', { width: 900, height: 1200 }),
    ...fallbackBurgerImgs.map((fallback, i) =>
      loadImageAsJpeg(resolveCatalogImg(burgers[i]?.imageUrl, fallback), { width: 1200, height: 900 })
    ),
    ...agregadoIconUrls.map((url, i) =>
      loadImageAsJpeg(resolveCatalogImg(agregados[i]?.imageUrl, url), { circular: true, width: 480, height: 480 })
    ),
  ]);
  const burgerImgs = restImgs.slice(0, 4);
  const agregadoImgs = restImgs.slice(4, 8);

  // ===========================================================================
  // PÁGINA 1: CARTA OFICIAL DE RESTAURANTE (DISEÑO PIZARRA GOURMET & DORADO)
  // ===========================================================================

  // Fondo pizarra oscura / madera artesanal (#14110F)
  doc.setFillColor(20, 17, 15);
  doc.rect(0, 0, 210, 297, 'F');

  // Marco exterior dorado doble
  doc.setDrawColor(245, 158, 11);
  doc.setLineWidth(0.7);
  doc.rect(6, 6, 198, 285);
  doc.setDrawColor(180, 83, 9);
  doc.setLineWidth(0.25);
  doc.rect(8, 8, 194, 281);

  // ---------------------------------------------------------------------------
  // 1. CABECERA: "El verdadero sabor casero" | LOGO | "Hamburguesas que enamoran"
  // ---------------------------------------------------------------------------

  // Izquierda: "El verdadero sabor casero"
  doc.setFont('helvetica', 'bolditalic');
  doc.setFontSize(13.5);
  doc.setTextColor(255, 255, 255);
  doc.text('El verdadero', 42, 24, { align: 'center' });
  doc.setFontSize(15);
  doc.setTextColor(245, 158, 11);
  doc.text('sabor casero', 42, 31, { align: 'center' });
  doc.setDrawColor(245, 158, 11);
  doc.setLineWidth(0.6);
  doc.line(25, 34, 59, 34);

  // Centro: Logo circular oficial
  if (logoImg) {
    try {
      doc.addImage(logoImg, 'JPEG', 84, 10, 42, 42);
    } catch {
      // continuar
    }
  } else {
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(20);
    doc.setTextColor(245, 158, 11);
    doc.text('CASERITOS BURGUER', 105, 30, { align: 'center' });
  }

  // Derecha: "Hamburguesas que enamoran"
  doc.setFont('helvetica', 'bolditalic');
  doc.setFontSize(13.5);
  doc.setTextColor(255, 255, 255);
  doc.text('Hamburguesas', 168, 24, { align: 'center' });
  doc.setFontSize(14.5);
  doc.setTextColor(245, 158, 11);
  doc.text('que enamoran', 168, 31, { align: 'center' });
  doc.setDrawColor(245, 158, 11);
  doc.setLineWidth(0.6);
  doc.line(150, 34, 186, 34);

  // ---------------------------------------------------------------------------
  // 2. LAS 4 COLUMNAS DE HAMBURGUESAS CASERAS + SUS COMBOS
  // ---------------------------------------------------------------------------
  const displayBurgers =
    burgers.length >= 4
      ? burgers.slice(0, 4)
      : [
          {
            id: 'b1',
            name: 'CASERITOS',
            price: 12000,
            comboPrice: 27000,
            description: 'Pan, carne 100gr, bacon y cheddar.',
          },
          {
            id: 'b2',
            name: 'CASERITOS TRADICIONAL',
            price: 18000,
            comboPrice: 33000,
            description: 'Pan, carne 100gr, huevo, lechuga, tomate y cheddar.',
          },
          {
            id: 'b3',
            name: 'CASERITOS BACON',
            price: 22000,
            comboPrice: 37000,
            description:
              'Pan, carne 100gr, huevo, bacon, cheddar, cebolla caramelizada y salsa especial de la casa.',
          },
          {
            id: 'b4',
            name: 'CASERITOS PREMIUM',
            price: 32000,
            comboPrice: 47000,
            description:
              'Pan, doble carne de 100gr, huevo, bacon, doble cheddar y salsa especial de la casa.',
          },
        ];

  const colStartX = 11.5;
  const colWidth = 45.2;
  const colGap = 2;
  const rowTopY = 56;
  const cardHeight = 104;

  displayBurgers.forEach((burger, idx) => {
    const x = colStartX + idx * (colWidth + colGap);
    const centerX = x + colWidth / 2;

    // Tarjeta de cada columna con borde dorado sutil
    doc.setFillColor(27, 23, 20);
    doc.setDrawColor(120, 80, 20);
    doc.setLineWidth(0.35);
    doc.roundedRect(x, rowTopY, colWidth, cardHeight, 2.5, 2.5, 'FD');

    // Línea divisoria vertical dorada entre columnas
    if (idx > 0) {
      doc.setDrawColor(245, 158, 11);
      doc.setLineWidth(0.3);
      doc.line(x - colGap / 2, rowTopY + 4, x - colGap / 2, rowTopY + cardHeight - 4);
    }

    // Foto de la hamburguesa
    const bImg = burgerImgs[idx];
    if (bImg) {
      try {
        doc.addImage(bImg, 'JPEG', x + 2.6, rowTopY + 3, colWidth - 5.2, 31);
      } catch {
        // continuar
      }
    }
    doc.setDrawColor(245, 158, 11);
    doc.setLineWidth(0.35);
    doc.rect(x + 2.6, rowTopY + 3, colWidth - 5.2, 31);

    // Etiqueta "Papa + Gaseosa" en esquina superior derecha de la imagen
    doc.setFillColor(220, 38, 38);
    doc.roundedRect(x + colWidth - 17, rowTopY + 4.5, 13, 4.5, 1, 1, 'F');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(5.5);
    doc.setTextColor(255, 255, 255);
    doc.text('100% CASERA', x + colWidth - 10.5, rowTopY + 7.6, { align: 'center' });

    // Nombre de la Hamburguesa (en 1 o 2 líneas centradas)
    const cleanTitle = sanitizePdfText(burger.name).toUpperCase();
    doc.setFont('helvetica', 'bolditalic');
    doc.setFontSize(10.5);
    doc.setTextColor(251, 191, 36);
    const titleLines: string[] = doc.splitTextToSize(cleanTitle, colWidth - 4);
    doc.text(titleLines, centerX, rowTopY + 41, { align: 'center' });

    // Línea decorativa bajo el nombre
    const afterTitleY = rowTopY + 41 + (titleLines.length > 1 ? 6 : 2.5);
    doc.setDrawColor(245, 158, 11);
    doc.setLineWidth(0.45);
    doc.line(x + 8, afterTitleY, x + colWidth - 8, afterTitleY);

    // Precio Individual grande en blanco
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(13.5);
    doc.setTextColor(255, 255, 255);
    doc.text(`Gs. ${burger.price.toLocaleString('es-PY')}`, centerX, afterTitleY + 7, {
      align: 'center',
    });

    // Especificaciones / Ingredientes centrados
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.6);
    doc.setTextColor(228, 228, 231);
    const descLines: string[] = doc.splitTextToSize(
      sanitizePdfText(burger.description),
      colWidth - 5
    );
    doc.text(descLines, centerX, afterTitleY + 12.5, { align: 'center' });

    // Cinta amarilla "COMBO" en la parte inferior de la columna
    const comboPriceVal = (burger as Product).comboPrice || burger.price + 15000;
    const comboBoxY = rowTopY + cardHeight - 23;

    doc.setFillColor(245, 158, 11);
    doc.roundedRect(x + 6, comboBoxY, colWidth - 12, 6.5, 1.5, 1.5, 'F');
    doc.setFont('helvetica', 'bolditalic');
    doc.setFontSize(9.5);
    doc.setTextColor(20, 17, 15);
    doc.text('COMBO', centerX, comboBoxY + 4.7, { align: 'center' });

    // Precio del Combo en dorado brillante
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(12);
    doc.setTextColor(251, 191, 36);
    doc.text(`Gs. ${comboPriceVal.toLocaleString('es-PY')}`, centerX, comboBoxY + 12.2, {
      align: 'center',
    });

    // Detalle del combo: (Papa frita + gaseosa 250ml)
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(6.7);
    doc.setTextColor(212, 212, 216);
    doc.text('(Papa frita + gaseosa 250ml)', centerX, comboBoxY + 16.8, {
      align: 'center',
    });
  });

  // ---------------------------------------------------------------------------
  // 3. SECCIÓN INFERIOR: CUADRO "AGREGADOS" (IZQ) Y CUADRO "PAPAS FRITAS" (DER)
  // ---------------------------------------------------------------------------
  const bottomBoxesY = 166;
  const bottomBoxesH = 66;

  // === CUADRO IZQUIERDO: AGREGADOS ===
  doc.setFillColor(26, 22, 19);
  doc.setDrawColor(245, 158, 11);
  doc.setLineWidth(0.5);
  doc.roundedRect(11.5, bottomBoxesY, 82, bottomBoxesH, 3, 3, 'FD');

  doc.setFont('helvetica', 'bolditalic');
  doc.setFontSize(14);
  doc.setTextColor(245, 158, 11);
  doc.text('AGREGADOS', 52.5, bottomBoxesY + 9, { align: 'center' });

  doc.setDrawColor(245, 158, 11);
  doc.setLineWidth(0.35);
  doc.line(28, bottomBoxesY + 11.5, 77, bottomBoxesY + 11.5);

  const defaultAgregados =
    agregados.length > 0
      ? agregados.map((a) => ({
          name: a.name.replace(/^Agregado:\s*/i, ''),
          price: a.price,
        }))
      : [
          { name: 'Carne 100gr', price: 10000 },
          { name: 'Cheddar', price: 5000 },
          { name: 'Bacon', price: 5000 },
          { name: 'Cebolla caramelizada', price: 3000 },
        ];

  defaultAgregados.slice(0, 4).forEach((item, i) => {
    const itemY = bottomBoxesY + 21 + i * 12;

    // Ícono circular con la foto real del ingrediente (del menú oficial)
    const iconImg = agregadoImgs[i];
    if (iconImg) {
      try {
        doc.addImage(iconImg, 'JPEG', 15.3, itemY - 5.9, 9.4, 9.4);
      } catch {
        // continuar
      }
    } else {
      doc.setFillColor(45, 36, 30);
      doc.setDrawColor(245, 158, 11);
      doc.setLineWidth(0.35);
      doc.circle(20, itemY - 1.2, 4.2, 'FD');
    }

    // Nombre del agregado
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9.5);
    doc.setTextColor(255, 255, 255);
    doc.text(sanitizePdfText(item.name), 27, itemY);

    // Precio del agregado
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9.5);
    doc.setTextColor(245, 158, 11);
    doc.text(`Gs. ${item.price.toLocaleString('es-PY')}`, 89, itemY, { align: 'right' });

    // Línea punteada sutil
    doc.setDrawColor(63, 63, 70);
    doc.setLineWidth(0.2);
    doc.line(27, itemY + 3, 89, itemY + 3);
  });

  // === CUADRO DERECHO: PAPAS FRITAS ===
  doc.setFillColor(26, 22, 19);
  doc.setDrawColor(245, 158, 11);
  doc.setLineWidth(0.5);
  doc.roundedRect(97.5, bottomBoxesY, 101, bottomBoxesH, 3, 3, 'FD');

  doc.setFont('helvetica', 'bolditalic');
  doc.setFontSize(14);
  doc.setTextColor(245, 158, 11);
  doc.text('PAPAS FRITAS', 162, bottomBoxesY + 9, { align: 'center' });

  doc.setDrawColor(245, 158, 11);
  doc.setLineWidth(0.35);
  doc.line(138, bottomBoxesY + 11.5, 186, bottomBoxesY + 11.5);

  // Imagen de las papas con cheddar y bacon a la izquierda del cuadro de papas
  if (friesImg) {
    try {
      doc.addImage(friesImg, 'JPEG', 101.5, bottomBoxesY + 14, 34, 46);
      doc.setDrawColor(245, 158, 11);
      doc.setLineWidth(0.4);
      doc.rect(101.5, bottomBoxesY + 14, 34, 46);
    } catch {
      // continuar
    }
  }

  const defaultPapas =
    papas.length > 0
      ? papas.map((p) => ({
          name: p.name
            .replace(/^Papas Fritas\s*-\s*/i, '')
            .replace(/^Papas Fritas\s*/i, ''),
          price: p.price,
        }))
      : [
          { name: 'Pequeño', price: 10000 },
          { name: 'Mediano', price: 15000 },
          { name: 'Grande', price: 20000 },
          { name: 'Con bacon y cheddar', price: 25000 },
        ];

  defaultPapas.slice(0, 4).forEach((item, i) => {
    const itemY = bottomBoxesY + 21 + i * 12;

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9.2);
    doc.setTextColor(255, 255, 255);
    doc.text(sanitizePdfText(item.name), 139, itemY);

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9.5);
    doc.setTextColor(245, 158, 11);
    doc.text(`Gs. ${item.price.toLocaleString('es-PY')}`, 194, itemY, { align: 'right' });

    doc.setDrawColor(82, 82, 91);
    doc.setLineWidth(0.25);
    doc.line(139, itemY + 3, 194, itemY + 3);
  });

  // ---------------------------------------------------------------------------
  // 4. BANNER DE DÍAS DE PROMO DE LA CASA
  // ---------------------------------------------------------------------------
  const promoY = 237;
  doc.setFillColor(39, 28, 18);
  doc.setDrawColor(245, 158, 11);
  doc.setLineWidth(0.45);
  doc.roundedRect(11.5, promoY, 187, 17, 2.5, 2.5, 'FD');

  doc.setFillColor(234, 88, 12);
  doc.roundedRect(15, promoY + 2.5, 44, 5, 1, 1, 'F');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7);
  doc.setTextColor(255, 255, 255);
  doc.text('DÍAS DE PROMO CASERITOS', 37, promoY + 6, { align: 'center' });

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8.2);
  doc.setTextColor(251, 191, 36);
  doc.text(
    '¡Consulta nuestras promociones especiales de la semana escribiendo a nuestro WhatsApp!',
    63,
    promoY + 6.2
  );

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.6);
  doc.setTextColor(228, 228, 231);
  doc.text(
    'Promos especiales en Combos Caseritos (Papa frita + gaseosa 250ml) y Hamburguesas 100% Caseras.',
    15,
    promoY + 12.8
  );

  // ---------------------------------------------------------------------------
  // 5. PIE DE PÁGINA FIEL AL MENÚ FÍSICO: WHATSAPP 0982606227 | KM 13,5 | ¡TE ESPERAMOS!
  // ---------------------------------------------------------------------------
  const footerY = 260;

  // Caja amarilla de WhatsApp a la izquierda
  doc.setFillColor(245, 158, 11);
  doc.roundedRect(11.5, footerY, 72, 20, 3, 3, 'F');

  // Ícono circular de teléfono dentro de la caja amarilla
  doc.setDrawColor(20, 17, 15);
  doc.setLineWidth(0.8);
  doc.circle(22, footerY + 10, 5.5, 'S');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7.5);
  doc.setTextColor(20, 17, 15);
  doc.text('WA', 22, footerY + 11, { align: 'center' });

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.setTextColor(20, 17, 15);
  doc.text('Pedidos y consultas:', 31, footerY + 7.5);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(14.5);
  doc.setTextColor(20, 17, 15);
  doc.text(officialPhoneDisplay, 31, footerY + 15);

  // Centro: Nuestra dirección: Km 13,5
  doc.setFillColor(39, 32, 26);
  doc.setDrawColor(245, 158, 11);
  doc.setLineWidth(0.4);
  doc.roundedRect(88, footerY, 56, 20, 3, 3, 'FD');

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);
  doc.setTextColor(212, 212, 216);
  doc.text('Nuestra dirección:', 116, footerY + 7.5, { align: 'center' });

  doc.setFont('helvetica', 'bolditalic');
  doc.setFontSize(15);
  doc.setTextColor(245, 158, 11);
  doc.text(officialAddressDisplay, 116, footerY + 15.5, { align: 'center' });

  // Derecha: ¡Te esperamos!
  doc.setFont('helvetica', 'bolditalic');
  doc.setFontSize(16);
  doc.setTextColor(245, 158, 11);
  doc.text('¡Te esperamos!', 173, footerY + 12.5, { align: 'center' });

  doc.save('Carta-Oficial-Caseritos-Burguer-Km13.5.pdf');
}
