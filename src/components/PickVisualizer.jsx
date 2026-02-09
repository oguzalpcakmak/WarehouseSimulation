import { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { Button, Tooltip, Checkbox } from 'antd';
import {
  StepBackwardOutlined,
  StepForwardOutlined,
  FastBackwardOutlined,
  FastForwardOutlined,
  PlayCircleOutlined,
  PauseCircleOutlined
} from '@ant-design/icons';
import {
  AISLE_WIDTH,
  COLUMN_LENGTH,
  SHELF_DEPTH,
  CROSS_AISLE_WIDTH,
  TOTAL_AISLES,
  TOTAL_COLUMNS,
  LAYOUT_WIDTH,
  LAYOUT_HEIGHT,
  CROSS_AISLE_1_Y,
  CROSS_AISLE_2_Y,
  CROSS_AISLE_3_Y,
  getXCoordinate,
  getYCoordinate,
  getManhattanPath
} from '../utils/layoutConstants.js';
import { t } from '../locales/translations.js';
import './PickVisualizer.css';

function PickVisualizer({ data, isDarkMode = true, onGroupSelect, lang = 'tr' }) {
  const [selectedPicker, setSelectedPicker] = useState('');
  const [selectedPickcar, setSelectedPickcar] = useState('');
  const [currentStep, setCurrentStep] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [playSpeed, setPlaySpeed] = useState(1000);
  const [scale, setScale] = useState(1);
  const [filterSingleFloor, setFilterSingleFloor] = useState(true);
  const [filterHasNoTime, setFilterHasNoTime] = useState(true);
  const containerRef = useRef(null);

  // Birden fazla kata giden grupları tespit et
  const multiFloorGroups = useMemo(() => {
    const groups = {};
    
    data.forEach(row => {
      const key = `${row.PICKER_CODE}|${row.PICKCAR_THM}`;
      if (!groups[key]) {
        groups[key] = new Set();
      }
      groups[key].add(row.AREA);
    });
    
    // Birden fazla AREA'ya sahip grupları döndür
    return new Set(
      Object.entries(groups)
        .filter(([, areas]) => areas.size > 1)
        .map(([key]) => key)
    );
  }, [data]);

  // TIME verisi eksik olan grupları tespit et
  const noTimeGroups = useMemo(() => {
    const groups = {};
    
    data.forEach(row => {
      const key = `${row.PICKER_CODE}|${row.PICKCAR_THM}`;
      if (!groups[key]) {
        groups[key] = { hasNoTime: false };
      }
      // TIME boş, undefined veya null ise işaretle
      if (!row.TIME || row.TIME === '' || row.TIME === '-') {
        groups[key].hasNoTime = true;
      }
    });
    
    // TIME verisi eksik olan grupları döndür
    return new Set(
      Object.entries(groups)
        .filter(([, info]) => info.hasNoTime)
        .map(([key]) => key)
    );
  }, [data]);

  const [isFullscreen, setIsFullscreen] = useState(false);

  // Container boyutuna göre scale hesapla
  const calculateScale = useCallback(() => {
    if (!containerRef.current) return;
    
    const container = containerRef.current;
    const availableWidth = container.clientWidth - 32; // padding için
    
    // rem to px dönüşümü (1rem = 16px varsayımı)
    const remToPx = parseFloat(getComputedStyle(document.documentElement).fontSize);
    const layoutWidthPx = LAYOUT_WIDTH * remToPx;
    const layoutHeightPx = LAYOUT_HEIGHT * remToPx;
    
    if (isFullscreen) {
      // Fullscreen modda sadece width'e göre fit
      const newScale = availableWidth / layoutWidthPx;
      setScale(Math.max(0.1, newScale));
    } else {
      // Normal modda hem width hem height'a göre fit
      const availableHeight = window.innerHeight * 0.6;
      const scaleX = availableWidth / layoutWidthPx;
      const scaleY = availableHeight / layoutHeightPx;
      const newScale = Math.min(scaleX, scaleY);
      setScale(Math.max(0.1, newScale));
    }
  }, [isFullscreen]);

  // İlk yükleme ve resize olaylarında scale hesapla
  useEffect(() => {
    calculateScale();
    window.addEventListener('resize', calculateScale);
    return () => window.removeEventListener('resize', calculateScale);
  }, [calculateScale]);

  // Benzersiz PICKER_CODE'ları al (filtreye göre)
  const pickerCodes = useMemo(() => {
    let filteredData = data;
    
    if (filterSingleFloor) {
      // Sadece tek katta kalan grupların picker'larını al
      filteredData = filteredData.filter(row => {
        const key = `${row.PICKER_CODE}|${row.PICKCAR_THM}`;
        return !multiFloorGroups.has(key);
      });
    }
    
    if (filterHasNoTime) {
      // TIME verisi tam olan grupların picker'larını al
      filteredData = filteredData.filter(row => {
        const key = `${row.PICKER_CODE}|${row.PICKCAR_THM}`;
        return !noTimeGroups.has(key);
      });
    }
    
    const codes = [...new Set(filteredData.map(row => row.PICKER_CODE))];
    return codes.sort();
  }, [data, filterSingleFloor, filterHasNoTime, multiFloorGroups, noTimeGroups]);

  // Seçili picker için PICKCAR_THM'leri al (filtreye göre)
  const pickcarCodes = useMemo(() => {
    if (!selectedPicker) return [];
    
    let filteredData = data.filter(row => row.PICKER_CODE === selectedPicker);
    
    if (filterSingleFloor) {
      filteredData = filteredData.filter(row => {
        const key = `${row.PICKER_CODE}|${row.PICKCAR_THM}`;
        return !multiFloorGroups.has(key);
      });
    }
    
    if (filterHasNoTime) {
      filteredData = filteredData.filter(row => {
        const key = `${row.PICKER_CODE}|${row.PICKCAR_THM}`;
        return !noTimeGroups.has(key);
      });
    }
    
    const codes = [...new Set(filteredData.map(row => row.PICKCAR_THM))];
    return codes.sort();
  }, [data, selectedPicker, filterSingleFloor, filterHasNoTime, multiFloorGroups, noTimeGroups]);

  // Seçili toplama işleminin verileri
  const pickData = useMemo(() => {
    if (!selectedPicker || !selectedPickcar) return [];
    return data
      .filter(row => row.PICKER_CODE === selectedPicker && row.PICKCAR_THM === selectedPickcar)
      .sort((a, b) => (a.PICK_ORDER || 0) - (b.PICK_ORDER || 0));
  }, [data, selectedPicker, selectedPickcar]);

  // Notify parent when selected group changes
  useEffect(() => {
    if (onGroupSelect) {
      onGroupSelect(pickData, currentStep);
    }
  }, [pickData, currentStep, onGroupSelect]);

  // Mevcut adımdaki pick
  const currentPick = pickData[currentStep] || null;

  // Çizgi çizmek için tüm adımlar (currentStep dahil)
  const pathPicks = pickData.slice(0, currentStep + 1);

  // Picker seçildiğinde pickcar'ı sıfırla
  useEffect(() => {
    setSelectedPickcar('');
    setCurrentStep(0);
    setIsPlaying(false);
  }, [selectedPicker]);

  // Pickcar seçildiğinde step'i sıfırla
  useEffect(() => {
    setCurrentStep(0);
    setIsPlaying(false);
  }, [selectedPickcar]);

  // Otomatik oynatma
  useEffect(() => {
    if (!isPlaying || !pickData.length) return;

    const timer = setInterval(() => {
      setCurrentStep(prev => {
        if (prev >= pickData.length - 1) {
          setIsPlaying(false);
          return prev;
        }
        return prev + 1;
      });
    }, playSpeed);

    return () => clearInterval(timer);
  }, [isPlaying, pickData.length, playSpeed]);

  // Raf gruplarını oluştur
  const shelves = useMemo(() => {
    const items = [];
    
    // Her AISLE için raflar
    for (let aisle = 1; aisle <= TOTAL_AISLES; aisle++) {
      // Sol taraf rafları
      if (aisle === 1) {
        // AISLE 1 sol = tek sıra
        for (let col = 1; col <= 20; col++) {
          if (col <= 10) {
            items.push({
              type: 'shelf',
              aisle,
              column: col,
              side: 'L',
              x: 0,
              y: CROSS_AISLE_WIDTH + (col - 1) * COLUMN_LENGTH,
              width: SHELF_DEPTH,
              height: COLUMN_LENGTH
            });
          } else {
            items.push({
              type: 'shelf',
              aisle,
              column: col,
              side: 'L',
              x: 0,
              y: CROSS_AISLE_WIDTH + 10 * COLUMN_LENGTH + CROSS_AISLE_WIDTH + (col - 11) * COLUMN_LENGTH,
              width: SHELF_DEPTH,
              height: COLUMN_LENGTH
            });
          }
        }
      }
      
      // Sağ taraf rafları (her aisle için)
      if (aisle < TOTAL_AISLES) {
        const shelfX = SHELF_DEPTH + AISLE_WIDTH + (aisle - 1) * (AISLE_WIDTH + 2 * SHELF_DEPTH);
        for (let col = 1; col <= 20; col++) {
          let y;
          if (col <= 10) {
            y = CROSS_AISLE_WIDTH + (col - 1) * COLUMN_LENGTH;
          } else {
            y = CROSS_AISLE_WIDTH + 10 * COLUMN_LENGTH + CROSS_AISLE_WIDTH + (col - 11) * COLUMN_LENGTH;
          }
          // Sol yarı (AISLE N'in R tarafı)
          items.push({
            type: 'shelf',
            aisle,
            column: col,
            side: 'R',
            x: shelfX,
            y,
            width: SHELF_DEPTH,
            height: COLUMN_LENGTH
          });
          // Sağ yarı (AISLE N+1'in L tarafı)
          items.push({
            type: 'shelf',
            aisle: aisle + 1,
            column: col,
            side: 'L',
            x: shelfX + SHELF_DEPTH,
            y,
            width: SHELF_DEPTH,
            height: COLUMN_LENGTH
          });
        }
      }
      
      // AISLE 27 sağ = tek sıra
      if (aisle === TOTAL_AISLES) {
        const shelfX = SHELF_DEPTH + AISLE_WIDTH + (aisle - 1) * (AISLE_WIDTH + 2 * SHELF_DEPTH);
        for (let col = 1; col <= 20; col++) {
          let y;
          if (col <= 10) {
            y = CROSS_AISLE_WIDTH + (col - 1) * COLUMN_LENGTH;
          } else {
            y = CROSS_AISLE_WIDTH + 10 * COLUMN_LENGTH + CROSS_AISLE_WIDTH + (col - 11) * COLUMN_LENGTH;
          }
          items.push({
            type: 'shelf',
            aisle,
            column: col,
            side: 'R',
            x: shelfX,
            y,
            width: SHELF_DEPTH,
            height: COLUMN_LENGTH
          });
        }
      }
    }
    
    return items;
  }, []);

  // Koridorları oluştur
  const aisles = useMemo(() => {
    const items = [];
    for (let aisle = 1; aisle <= TOTAL_AISLES; aisle++) {
      const x = SHELF_DEPTH + (aisle - 1) * (AISLE_WIDTH + 2 * SHELF_DEPTH);
      
      // Üst kısım (COLUMN 1-10)
      items.push({
        type: 'aisle',
        aisle,
        section: 'top',
        x,
        y: CROSS_AISLE_WIDTH,
        width: AISLE_WIDTH,
        height: 10 * COLUMN_LENGTH
      });
      
      // Alt kısım (COLUMN 11-20)
      items.push({
        type: 'aisle',
        aisle,
        section: 'bottom',
        x,
        y: CROSS_AISLE_WIDTH + 10 * COLUMN_LENGTH + CROSS_AISLE_WIDTH,
        width: AISLE_WIDTH,
        height: 10 * COLUMN_LENGTH
      });
    }
    return items;
  }, []);

  // Cross aisle'ları oluştur
  const crossAisles = useMemo(() => {
    return [
      {
        name: 'CROSS_AISLE_1',
        x: 0,
        y: 0,
        width: LAYOUT_WIDTH,
        height: CROSS_AISLE_WIDTH
      },
      {
        name: 'CROSS_AISLE_2',
        x: 0,
        y: CROSS_AISLE_WIDTH + 10 * COLUMN_LENGTH,
        width: LAYOUT_WIDTH,
        height: CROSS_AISLE_WIDTH
      },
      {
        name: 'CROSS_AISLE_3',
        x: 0,
        y: CROSS_AISLE_WIDTH + 10 * COLUMN_LENGTH + CROSS_AISLE_WIDTH + 10 * COLUMN_LENGTH,
        width: LAYOUT_WIDTH,
        height: CROSS_AISLE_WIDTH
      }
    ];
  }, []);

  return (
    <div className={`pick-visualizer ${isDarkMode ? 'dark-mode' : 'light-mode'}`}>
      <div className="visualizer-controls">
        <div className="control-group filter-toggle">
          <Checkbox
            checked={filterSingleFloor}
            onChange={(e) => {
              setFilterSingleFloor(e.target.checked);
              setSelectedPicker('');
              setSelectedPickcar('');
            }}
          >
            {t(lang, 'filterMultiFloor')}
          </Checkbox>
          <span className="filter-info">
            ({multiFloorGroups.size} {t(lang, 'filteredGroups')})
          </span>
          <Checkbox
            checked={filterHasNoTime}
            onChange={(e) => setFilterHasNoTime(e.target.checked)}
          >
            {t(lang, 'filterNoTime')}
          </Checkbox>
          <span className="filter-info">
            ({noTimeGroups.size} {t(lang, 'noTimeFiltered')})
          </span>
          <button 
            className={`fullscreen-button ${isFullscreen ? 'active' : ''}`}
            onClick={() => setIsFullscreen(!isFullscreen)}
            title={isFullscreen ? t(lang, 'normalView') : t(lang, 'fullscreen')}
          >
            {isFullscreen ? '⊟' : '⊞'} {isFullscreen ? t(lang, 'normalView') : t(lang, 'fullscreen')}
          </button>
        </div>

        <div className="control-group">
          <label>{t(lang, 'pickerLabel')}</label>
          <select 
            value={selectedPicker} 
            onChange={(e) => setSelectedPicker(e.target.value)}
          >
            <option value="">{t(lang, 'selectPlaceholder')}</option>
            {pickerCodes.map(code => (
              <option key={code} value={code}>{code}</option>
            ))}
          </select>
        </div>

        <div className="control-group">
          <label>{t(lang, 'pickcarLabel')}</label>
          <select 
            value={selectedPickcar} 
            onChange={(e) => setSelectedPickcar(e.target.value)}
            disabled={!selectedPicker}
          >
            <option value="">{t(lang, 'selectPlaceholder')}</option>
            {pickcarCodes.map(code => (
              <option key={code} value={code}>{code}</option>
            ))}
          </select>
        </div>

        {pickData.length > 0 && (
          <>
            <div className="control-group">
              <label>{t(lang, 'step')}: {currentStep + 1} / {pickData.length}</label>
              <input
                type="range"
                min="0"
                max={pickData.length - 1}
                value={currentStep}
                onChange={(e) => setCurrentStep(parseInt(e.target.value))}
              />
            </div>

            <div className="control-group">
              <label>{t(lang, 'speed')}</label>
              <select value={playSpeed} onChange={(e) => setPlaySpeed(parseInt(e.target.value))}>
                <option value="2000">{t(lang, 'speedSlow')}</option>
                <option value="1000">{t(lang, 'speedNormal')}</option>
                <option value="500">{t(lang, 'speedFast')}</option>
                <option value="200">{t(lang, 'speedVeryFast')}</option>
              </select>
            </div>

            <div className="control-buttons">
              <Tooltip title={t(lang, 'goToStart')}>
                <Button 
                  icon={<FastBackwardOutlined />} 
                  onClick={() => setCurrentStep(0)}
                />
              </Tooltip>
              <Tooltip title={t(lang, 'previous')}>
                <Button 
                  icon={<StepBackwardOutlined />} 
                  onClick={() => setCurrentStep(Math.max(0, currentStep - 1))}
                />
              </Tooltip>
              <Tooltip title={isPlaying ? t(lang, 'pause') : t(lang, 'play')}>
                <Button 
                  type="primary"
                  icon={isPlaying ? <PauseCircleOutlined /> : <PlayCircleOutlined />} 
                  onClick={() => setIsPlaying(!isPlaying)}
                />
              </Tooltip>
              <Tooltip title={t(lang, 'next')}>
                <Button 
                  icon={<StepForwardOutlined />} 
                  onClick={() => setCurrentStep(Math.min(pickData.length - 1, currentStep + 1))}
                />
              </Tooltip>
              <Tooltip title={t(lang, 'goToEnd')}>
                <Button 
                  icon={<FastForwardOutlined />} 
                  onClick={() => setCurrentStep(pickData.length - 1)}
                />
              </Tooltip>
            </div>
          </>
        )}
      </div>

      {currentPick && (
        <div className="current-pick-info">
          <div className="info-grid">
            <div className="info-item">
              <span className="info-label">{t(lang, 'infoOrder')}</span>
              <span className="info-value">{currentPick.PICK_ORDER}</span>
            </div>
            <div className="info-item">
              <span className="info-label">{t(lang, 'infoTime')}</span>
              <span className="info-value">{currentPick.TIME || '-'}</span>
            </div>
            <div className="info-item">
              <span className="info-label">{t(lang, 'infoArea')}</span>
              <span className="info-value">{currentPick.AREA}</span>
            </div>
            <div className="info-item">
              <span className="info-label">{t(lang, 'infoLocation')}</span>
              <span className="info-value">
                A{currentPick.AISLE} C{currentPick.COLUMN} {currentPick.LEFT_OR_RIGHT}
              </span>
            </div>
            <div className="info-item">
              <span className="info-label">{t(lang, 'infoShelf')}</span>
              <span className="info-value">{currentPick.SHELF}</span>
            </div>
            <div className="info-item">
              <span className="info-label">{t(lang, 'infoStepDist')}</span>
              <span className="info-value">{currentPick.STEP_DIST}m</span>
            </div>
            <div className="info-item">
              <span className="info-label">{t(lang, 'infoTotalDist')}</span>
              <span className="info-value">{currentPick.TOTAL_DIST}m</span>
            </div>
            <div className="info-item">
              <span className="info-label">{t(lang, 'infoProduct')}</span>
              <span className="info-value">{currentPick.ARTICLE_CODE}</span>
            </div>
          </div>
        </div>
      )}

      <div className="layout-container" ref={containerRef}>
        <div 
          className="layout-wrapper"
          style={{
            width: `${LAYOUT_WIDTH * scale}rem`,
            height: `${LAYOUT_HEIGHT * scale}rem`
          }}
        >
          <div 
            className="layout"
            style={{
              width: `${LAYOUT_WIDTH}rem`,
              height: `${LAYOUT_HEIGHT}rem`,
              transform: `scale(${scale})`,
              transformOrigin: 'top left'
            }}
          >
            {/* Cross Aisle'lar */}
            {crossAisles.map((ca, i) => (
              <div
                key={`ca-${i}`}
                className="cross-aisle"
                style={{
                  left: `${ca.x}rem`,
                  top: `${ca.y}rem`,
                  width: `${ca.width}rem`,
                  height: `${ca.height}rem`
                }}
              >
                <span className="cross-aisle-label">{ca.name}</span>
              </div>
            ))}

            {/* Koridorlar */}
            {aisles.map((aisle, i) => (
              <div
                key={`aisle-${i}`}
                className="aisle"
              style={{
                left: `${aisle.x}rem`,
                top: `${aisle.y}rem`,
                width: `${aisle.width}rem`,
                height: `${aisle.height}rem`
              }}
            >
              {aisle.section === 'top' && (
                <span className="aisle-label">{aisle.aisle}</span>
              )}
            </div>
          ))}

          {/* Raflar */}
          {shelves.map((shelf, i) => {
            const isActive = currentPick && 
              shelf.aisle === parseInt(currentPick.AISLE) && 
              shelf.column === parseInt(currentPick.COLUMN) && 
              shelf.side === currentPick.LEFT_OR_RIGHT;
            
            return (
              <div
                key={`shelf-${i}`}
                className={`shelf ${isActive ? (shelf.side === 'L' ? 'shelf-active-left' : 'shelf-active-right') : ''}`}
                style={{
                  left: `${shelf.x}rem`,
                  top: `${shelf.y}rem`,
                  width: `${shelf.width}rem`,
                  height: `${shelf.height}rem`
                }}
              />
            );
          })}

          {/* Önceki adımların izi (mevcut adım hariç) */}
          {pathPicks.slice(0, -1).map((pick, i) => {
            const x = getXCoordinate(parseInt(pick.AISLE));
            const y = getYCoordinate(parseInt(pick.COLUMN));
            return (
              <div
                key={`trail-${i}`}
                className="pick-trail"
                style={{
                  left: `${x}rem`,
                  top: `${y}rem`
                }}
              >
                <span className="trail-order">{pick.PICK_ORDER}</span>
              </div>
            );
          })}

          {/* Önceki adımlar arası çizgiler (Manhattan path) */}
          {pathPicks.length > 1 && (
            <svg 
              className="path-lines"
              viewBox={`0 0 ${LAYOUT_WIDTH} ${LAYOUT_HEIGHT}`}
              preserveAspectRatio="none"
              style={{
                width: `${LAYOUT_WIDTH}rem`,
                height: `${LAYOUT_HEIGHT}rem`
              }}
            >
              {pathPicks.map((pick, i) => {
                if (i === 0) return null;
                const prevPick = pathPicks[i - 1];
                const x1 = getXCoordinate(parseInt(prevPick.AISLE));
                const y1 = getYCoordinate(parseInt(prevPick.COLUMN));
                const x2 = getXCoordinate(parseInt(pick.AISLE));
                const y2 = getYCoordinate(parseInt(pick.COLUMN));
                
                // Manhattan yolunu hesapla
                const pathPoints = getManhattanPath(x1, y1, x2, y2);
                
                // SVG polyline için points string'i oluştur
                const pointsStr = pathPoints
                  .map(p => `${p.x},${p.y}`)
                  .join(' ');
                
                return (
                  <polyline
                    key={`line-${i}`}
                    points={pointsStr}
                    fill="none"
                    stroke="rgba(0, 255, 136, 0.5)"
                    strokeWidth="0.15"
                    strokeDasharray="0.3"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                );
              })}
            </svg>
          )}

          {/* Mevcut pozisyon */}
          {currentPick && (
            <div
              className="current-position"
              style={{
                left: `${getXCoordinate(parseInt(currentPick.AISLE))}rem`,
                top: `${getYCoordinate(parseInt(currentPick.COLUMN))}rem`
              }}
            >
              <div className="position-marker">
                <span className="position-order">{currentPick.PICK_ORDER}</span>
              </div>
              <div className="position-pulse"></div>
            </div>
          )}
        </div>
        </div>
      </div>

      {/* Legend */}
      <div className="layout-legend">
        <div className="legend-item">
          <div className="legend-color legend-shelf"></div>
          <span>{t(lang, 'legendShelf')}</span>
        </div>
        <div className="legend-item">
          <div className="legend-color legend-aisle"></div>
          <span>{t(lang, 'legendAisle')}</span>
        </div>
        <div className="legend-item">
          <div className="legend-color legend-cross-aisle"></div>
          <span>{t(lang, 'legendCrossAisle')}</span>
        </div>
        <div className="legend-item">
          <div className="legend-color legend-shelf-left"></div>
          <span>{t(lang, 'legendShelfLeft')}</span>
        </div>
        <div className="legend-item">
          <div className="legend-color legend-shelf-right"></div>
          <span>{t(lang, 'legendShelfRight')}</span>
        </div>
        <div className="legend-item">
          <div className="legend-color legend-current"></div>
          <span>{t(lang, 'legendCurrent')}</span>
        </div>
        <div className="legend-item">
          <div className="legend-color legend-trail"></div>
          <span>{t(lang, 'legendTrail')}</span>
        </div>
      </div>
    </div>
  );
}

export default PickVisualizer;
