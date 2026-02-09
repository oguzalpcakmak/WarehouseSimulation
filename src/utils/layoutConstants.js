/**
 * Depo Layout Sabitleri
 * Tüm ölçüler metre cinsinden
 */

// Temel ölçüler
export const AISLE_WIDTH = 1.36;        // Koridor genişliği
export const COLUMN_LENGTH = 2.90;      // Raf sütunu uzunluğu
export const SHELF_DEPTH = 1.16;        // Raf derinliği
export const CROSS_AISLE_WIDTH = 2.70;  // Cross aisle genişliği

// Layout boyutları
export const TOTAL_AISLES = 27;
export const TOTAL_COLUMNS = 20;

// Geçerli arealar
export const VALID_AREAS = new Set(['MZN1', 'MZN2', 'MZN3', 'MZN4', 'MZN5', 'MZN6']);

// Hesaplanmış değerler
export const LAYOUT_WIDTH = SHELF_DEPTH + AISLE_WIDTH + (TOTAL_AISLES - 1) * (AISLE_WIDTH + 2 * SHELF_DEPTH) + SHELF_DEPTH;
export const LAYOUT_HEIGHT = CROSS_AISLE_WIDTH + 10 * COLUMN_LENGTH + CROSS_AISLE_WIDTH + 10 * COLUMN_LENGTH + CROSS_AISLE_WIDTH;

// Cross aisle Y pozisyonları
export const CROSS_AISLE_1_Y = CROSS_AISLE_WIDTH / 2;
export const CROSS_AISLE_2_Y = CROSS_AISLE_WIDTH + 10 * COLUMN_LENGTH + CROSS_AISLE_WIDTH / 2;
export const CROSS_AISLE_3_Y = CROSS_AISLE_WIDTH + 10 * COLUMN_LENGTH + CROSS_AISLE_WIDTH + 10 * COLUMN_LENGTH + CROSS_AISLE_WIDTH / 2;

// Tolerans değerleri
export const POSITION_TOLERANCE = 0.01;

/**
 * X koordinatını hesaplar (AISLE bazlı)
 * @param {number} aisle - AISLE numarası (1-27)
 * @returns {number} X koordinatı (metre)
 */
export function getXCoordinate(aisle) {
  if (aisle === 1) {
    return SHELF_DEPTH + AISLE_WIDTH / 2;
  }
  const aisle1Center = SHELF_DEPTH + AISLE_WIDTH / 2;
  return aisle1Center + (aisle - 1) * (AISLE_WIDTH + 2 * SHELF_DEPTH);
}

/**
 * Y koordinatını hesaplar (COLUMN bazlı)
 * @param {number} column - COLUMN numarası (1-20)
 * @returns {number} Y koordinatı (metre)
 */
export function getYCoordinate(column) {
  if (column <= 10) {
    return CROSS_AISLE_WIDTH + (column - 0.5) * COLUMN_LENGTH;
  }
  const crossAisle2Start = CROSS_AISLE_WIDTH + 10 * COLUMN_LENGTH;
  const colInSecondHalf = column - 10;
  return crossAisle2Start + CROSS_AISLE_WIDTH + (colInSecondHalf - 0.5) * COLUMN_LENGTH;
}

/**
 * Pozisyon koordinatlarını hesaplar
 * @param {number} aisle - AISLE numarası
 * @param {number} column - COLUMN numarası
 * @returns {{x: number, y: number}} Koordinatlar
 */
export function getPosition(aisle, column) {
  return {
    x: getXCoordinate(aisle),
    y: getYCoordinate(column)
  };
}

/**
 * İki nokta arasındaki Manhattan yolunu hesaplar (CROSS_AISLE'lardan geçerek)
 * @param {number} x1 - Başlangıç X
 * @param {number} y1 - Başlangıç Y
 * @param {number} x2 - Bitiş X
 * @param {number} y2 - Bitiş Y
 * @returns {Array<{x: number, y: number}>} Yol noktaları
 */
export function getManhattanPath(x1, y1, x2, y2) {
  // Aynı AISLE'da ise direkt dikey çizgi
  if (Math.abs(x1 - x2) < POSITION_TOLERANCE) {
    return [
      { x: x1, y: y1 },
      { x: x2, y: y2 }
    ];
  }

  // En uygun CROSS_AISLE'ı bul
  const crossAisles = [CROSS_AISLE_1_Y, CROSS_AISLE_2_Y, CROSS_AISLE_3_Y];
  
  let bestCrossAisle = crossAisles[0];
  let minDistance = Infinity;

  for (const caY of crossAisles) {
    const dist = Math.abs(y1 - caY) + Math.abs(x1 - x2) + Math.abs(caY - y2);
    if (dist < minDistance) {
      minDistance = dist;
      bestCrossAisle = caY;
    }
  }

  // Yol: başlangıç -> cross aisle -> yatay hareket -> hedef
  return [
    { x: x1, y: y1 },             // Başlangıç
    { x: x1, y: bestCrossAisle }, // Cross aisle'a in/çık
    { x: x2, y: bestCrossAisle }, // Cross aisle boyunca yatay
    { x: x2, y: y2 }              // Hedef
  ];
}

/**
 * Manhattan mesafesini CROSS_AISLE kısıtlamasıyla hesaplar
 * @param {{x: number, y: number}} pos1 - Başlangıç pozisyonu
 * @param {{x: number, y: number}} pos2 - Bitiş pozisyonu
 * @returns {number} Mesafe (metre)
 */
export function manhattanDistanceWithCrossAisles(pos1, pos2) {
  const { x: x1, y: y1 } = pos1;
  const { x: x2, y: y2 } = pos2;

  // Aynı AISLE'daysa direkt Manhattan
  if (Math.abs(x1 - x2) < POSITION_TOLERANCE) {
    return Math.abs(y1 - y2);
  }

  const crossAisles = [CROSS_AISLE_1_Y, CROSS_AISLE_2_Y, CROSS_AISLE_3_Y];

  let minDistance = Infinity;

  for (const caY of crossAisles) {
    const distToCaFrom1 = Math.abs(y1 - caY);
    const distAlongCa = Math.abs(x1 - x2);
    const distTo2FromCa = Math.abs(caY - y2);

    const totalDist = distToCaFrom1 + distAlongCa + distTo2FromCa;
    minDistance = Math.min(minDistance, totalDist);
  }

  return minDistance;
}
