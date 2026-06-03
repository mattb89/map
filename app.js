/**
 * CityMapper Studio Pro Engine Logic Controller Module v16.2
 * Production Modular Guarded Architecture System - In-Place Breakout Capture
 */

window.mapInstance = null;
let uiDebounceTimer = null;
let isUpdatingStyles = false; 

const themePresets = {
    'gold-dark': { title: 'Gold', bg: '#000000', highway: '#d4af37', roads: '#b0912d', buildings: '#423712', water: '#1a170b', parks: '#141a0f', trains: '#7a6221', textMain: '#d4af37', textSub: '#888888' },
    'minimal-gray': { title: 'Charcoal', bg: '#ffffff', highway: '#222222', roads: '#777777', buildings: '#e0e0e0', water: '#f0f0f0', parks: '#ebf2ea', trains: '#bcbcbc', textMain: '#111111', textSub: '#555555' },
    'lavender-light': { title: 'Lavender', bg: '#f3f1f7', highway: '#4a3b63', roads: '#8c829e', buildings: '#b8afc8', water: '#d2cbdc', parks: '#e6f0fa', trains: '#a399b3', textMain: '#36294d', textSub: '#6b617a' },
    'cyber-neon': { title: 'Neon', bg: '#08090f', highway: '#00ffcc', roads: '#1a233a', buildings: '#101524', water: '#0d1b2a', parks: '#0a1a15', trains: '#ff0055', textMain: '#00ffcc', textSub: '#8fa0b2' },
    'mid-century-navy': { title: 'Navy', bg: '#162b3d', highway: '#fca34d', roads: '#3a5f7d', buildings: '#223f5a', water: '#1d486c', parks: '#1f3a3a', trains: '#8da9c4', textMain: '#fdf2a7', textSub: '#a5c4d4' },
    'emerald-forest': { title: 'Emerald', bg: '#0b1d12', highway: '#c3a35a', roads: '#1b3b22', buildings: '#122918', water: '#08160e', parks: '#1c4228', trains: '#947a43', textMain: '#ebd59b', textSub: '#709377' },
    'warm-terracotta': { title: 'Clay', bg: '#f4ebe1', highway: '#b85032', roads: '#d99b77', buildings: '#ebd0be', water: '#e0c3b1', parks: '#e3dfd5', trains: '#823720', textMain: '#612312', textSub: '#9c6f59' },
    'urban-hollywood': { 
        title: 'Hollywood', 
        bg: '#dbb1bc',          // Dusty Rose Base
        highway: '#ffffff',     // Crisp White Arteries
        roads: '#f7e8df',       // Soft Cream Local Streets
        buildings: '#9e6c7d',   // Deep Mauve Block Outlines
        water: '#6e959d',       // Sophisticated Calm Teal
        parks: '#e6c875',       // Warm Mustard Fill
        trains: '#826c9d',       // Subdued Lavender Tracks
        textMain: '#ffffff', 
        textSub: '#f7e8df' 
    },
    'district-pop': { 
        title: 'District Pop', 
        bg: '#f4f4f2',          // Ultra Light Gallery Grey
        highway: '#1a1a1a',     // High-Contrast Charcoal
        roads: '#555555',       // Delicate Slate Line Grid
        buildings: '#d96b43',   // Terracotta Pop Blocks
        water: '#7cb2c4',       // Dynamic Sky Blue
        parks: '#7da35d',       // Leafy Green Elements
        trains: '#333333',       // Solid Track Lines
        textMain: '#1a1a1a', 
        textSub: '#555555' 
    }
};

// INITIALIZATION PIPELINE: Safe gate ensures DOM nodes are completely constructed before map execution
document.addEventListener("DOMContentLoaded", () => {
    window.mapInstance = new maplibregl.Map({
        container: 'map',
        style: 'https://tiles.openfreemap.org/styles/dark', 
        center: [9.0908, 48.7297], 
        zoom: 14.1, 
        attributionControl: false, 
        preserveDrawingBuffer: true
    });

    window.mapInstance.on('load', () => { 
        // Reparent the vignette node immediately on boot to prevent iOS scale rounding bugs
        const vignette = document.getElementById('map-vignette');
        const boundingBox = document.getElementById('map-bounding-box');
        if (vignette && boundingBox) boundingBox.appendChild(vignette);

        generateVisualSwatches();
        bindUIControlsProgrammatically(); 
        
        requestAnimationFrame(() => {
            selectSwatchTheme('cyber-neon');
        });
    });

    window.mapInstance.on('styledata', () => {
        if (!isUpdatingStyles) {
            executeVectorStyleOverrides();
            renderDOMTypographyUpdates();
        }
    });

    window.mapInstance.on('moveend', () => {
        if (!isUpdatingStyles) executeVectorStyleOverrides();
    });
});

function bindUIControlsProgrammatically() {
    const triggerInputs = [
        'text-visible-toggle', 'text-main-input', 'text-sub-input', 'font-select',
        'size-font-main', 'letter-spacing-main', 'text-position-toggle', 'width-highways',
        'width-roads', 'opacity-lines', 'opacity-buildings',
        'style-soft-edges', 'vignette-intensity', 'color-bg', 'color-highways',
        'color-roads', 'color-buildings', 'color-water', 'color-parks', 'color-trains',
        'color-text-main', 'color-text-sub'
    ];

    triggerInputs.forEach(id => {
        const el = document.getElementById(id);
        if (el) {
            el.addEventListener('input', triggerUIDebounce);
            el.addEventListener('change', triggerUIDebounce);
        }
    });

    const layerToggles = ['layer-highways', 'layer-roads', 'layer-buildings', 'layer-water', 'layer-parks', 'layer-trains', 'layer-labels'];
    layerToggles.forEach(id => {
        const el = document.getElementById(id);
        if (el) el.addEventListener('change', toggleMapLayers);
    });

    const btnSearch = document.getElementById('btn-search');
    if (btnSearch) btnSearch.addEventListener('click', searchLocation);

    const btnExport = document.getElementById('btn-export');
    if (btnExport) btnExport.addEventListener('click', processExportPipeline);
}

function executeVectorStyleOverrides() {
    const map = window.mapInstance;
    if (!map || !map.isStyleLoaded() || isUpdatingStyles) return;

    isUpdatingStyles = true; 

    const bgStyleVal = document.getElementById('color-bg').value;
    const highwayColorVal = document.getElementById('color-highways').value;
    const roadColorVal = document.getElementById('color-roads').value;
    const buildingColorVal = document.getElementById('color-buildings').value;
    const waterColorVal = document.getElementById('color-water').value;
    const parkColorVal = document.getElementById('color-parks').value;
    const trainColorVal = document.getElementById('color-trains').value;
    const highwaySliderWidth = parseFloat(document.getElementById('width-highways').value);
    const roadSliderWidth = parseFloat(document.getElementById('width-roads').value);
    const lineOpacityVal = parseFloat(document.getElementById('opacity-lines').value);
    const buildingOpacityVal = parseFloat(document.getElementById('opacity-buildings').value);

    const isHighwayRegex = /(motorway|trunk|primary|major|expressway|highway|link)/i;
    const isMinorRoadRegex = /(minor|residential|service|secondary|tertiary|street|road|path|track)/i;
    const isBuildingRegex = /(building|3d|structure|extrusion)/i;
    const isWaterRegex = /(water|stream|river|lake|ocean|sea|marina)/i;
    const isParkRegex = /(park|leisure|forest|green|nature|landcover|cemetery|wood|grass)/i;
    const isTrainRegex = /(rail|train|transit|railway|subway)/i;

    const layers = map.getStyle().layers;

    layers.forEach(layer => {
        if (layer.type === 'background') {
            map.setPaintProperty(layer.id, 'background-color', bgStyleVal);
        }
        if (layer.type === 'fill' && (layer.id.includes('land') || layer.id.includes('area') || layer.id.includes('background'))) {
            if (!isParkRegex.test(layer.id)) {
                map.setPaintProperty(layer.id, 'fill-color', bgStyleVal);
            }
        }
        
        const layerSrc = layer.source || '';
        const sourceLayerStr = layer['source-layer'] || layer.sourceLayer || '';
        const fullLayerPath = `${layer.id} ${layerSrc} ${sourceLayerStr}`;

        if (isBuildingRegex.test(fullLayerPath)) {
            if (layer.type === 'fill' || layer.type === 'fill-extrusion') {
                map.setPaintProperty(layer.id, 'fill-color', buildingColorVal);
                map.setPaintProperty(layer.id, 'fill-opacity', buildingOpacityVal);
            }
        }
        if (isWaterRegex.test(fullLayerPath)) {
            if (layer.type === 'fill') map.setPaintProperty(layer.id, 'fill-color', waterColorVal);
            if (layer.type === 'line') map.setPaintProperty(layer.id, 'line-color', waterColorVal);
        }
        if (isParkRegex.test(fullLayerPath)) {
            if (layer.type === 'fill') map.setPaintProperty(layer.id, 'fill-color', parkColorVal);
        }
        if (isTrainRegex.test(fullLayerPath)) {
            if (layer.type === 'line') map.setPaintProperty(layer.id, 'line-color', trainColorVal);
        }
        if (layer.type === 'line' && isHighwayRegex.test(fullLayerPath)) {
            map.setPaintProperty(layer.id, 'line-color', highwayColorVal);
            map.setPaintProperty(layer.id, 'line-width', highwaySliderWidth);
            map.setPaintProperty(layer.id, 'line-opacity', lineOpacityVal);
        }
        if (layer.type === 'line' && isMinorRoadRegex.test(fullLayerPath) && !isHighwayRegex.test(fullLayerPath)) {
            map.setPaintProperty(layer.id, 'line-color', roadColorVal);
            map.setPaintProperty(layer.id, 'line-width', [
                'interpolate', ['linear'], ['zoom'],
                1, 0.1,   
                10, 0.2,  
                14, roadSliderWidth 
            ]);
            map.setPaintProperty(layer.id, 'line-opacity', lineOpacityVal);
        }
    });

    isUpdatingStyles = false; 
}

function triggerUIDebounce() {
    clearTimeout(uiDebounceTimer);
    uiDebounceTimer = setTimeout(() => {
        renderDOMTypographyUpdates();
        executeVectorStyleOverrides();
    }, 30);
}

function renderDOMTypographyUpdates() {
    const bgVal = document.getElementById('color-bg').value;
    const mainTextVal = document.getElementById('color-text-main').value;
    const subTextVal = document.getElementById('color-text-sub').value;
    const fontVal = document.getElementById('font-select').value;
    
    const fontSizeMain = document.getElementById('size-font-main').value;
    const letterSpacingMain = document.getElementById('letter-spacing-main').value;
    
    const textVisible = document.getElementById('text-visible-toggle').checked;
    const textFloatToggle = document.getElementById('text-position-toggle').checked;
    const labelBlock = document.getElementById('poster-label');
    const mapBox = document.getElementById('map-bounding-box');
    const typographyControls = document.getElementById('typography-controls-wrapper');
    const textColorRow = document.getElementById('text-color-picker-row');

    if (textVisible) {
        if (typographyControls) typographyControls.style.display = "block";
        if (textColorRow) textColorRow.style.display = "flex";
        if (labelBlock) labelBlock.classList.remove('hidden-element');
        
        if (textFloatToggle) {
            if (labelBlock) labelBlock.classList.add('floating');
            if (mapBox) mapBox.classList.add('full-bleed');
        } else {
            if (labelBlock) {
                labelBlock.classList.remove('floating');
                labelBlock.style.backgroundColor = bgVal;
            }
            if (mapBox) mapBox.classList.remove('full-bleed');
        }
    } else {
        if (typographyControls) typographyControls.style.display = "none";
        if (textColorRow) textColorRow.style.display = "none";
        if (labelBlock) labelBlock.classList.add('hidden-element');
        if (mapBox) mapBox.classList.add('full-bleed');
    }
    
    const posterFrame = document.getElementById('poster-frame');
    if (posterFrame) posterFrame.style.backgroundColor = bgVal;
    
    const mainLabel = document.getElementById('label-main');
    if (mainLabel) {
        mainLabel.innerText = document.getElementById('text-main-input').value.toUpperCase(); 
        mainLabel.style.color = mainTextVal;
        mainLabel.style.fontFamily = fontVal;
        mainLabel.style.fontSize = `${fontSizeMain}px`;
        mainLabel.style.letterSpacing = `${letterSpacingMain}px`;
    }

    const subLabel = document.getElementById('label-sub');
    if (subLabel) {
        subLabel.innerText = document.getElementById('text-sub-input').value.toUpperCase(); 
        subLabel.style.color = subTextVal;
        subLabel.style.fontFamily = fontVal;
    }

    const vignetteToggle = document.getElementById('style-soft-edges').checked;
    const vignetteMask = document.getElementById('map-vignette');
    const vignetteIntensity = parseInt(document.getElementById('vignette-intensity').value);
    
    if (vignetteToggle && vignetteMask) {
        vignetteMask.style.display = "block";
        vignetteMask.style.boxShadow = `inset 0 0 ${vignetteIntensity}px ${Math.floor(vignetteIntensity / 3.5)}px ${bgVal}`;
    } else if (vignetteMask) {
        vignetteMask.style.display = "none";
    }
}

function generateVisualSwatches() {
    const grid = document.getElementById('palette-container-wrapper');
    if (!grid) return;
    grid.innerHTML = '';

    Object.keys(themePresets).forEach(key => {
        const p = themePresets[key];
        const div = document.createElement('div');
        div.className = `palette-swatch`;
        div.id = `swatch-${key}`;
        div.onclick = () => selectSwatchTheme(key);

        div.innerHTML = `
            <div class="swatch-color-bar">
                <div class="swatch-split" style="background:${p.bg};"></div>
                <div class="swatch-split" style="background:${p.highway};"></div>
                <div class="swatch-split" style="background:${p.roads};"></div>
            </div>
            <div class="swatch-title">${p.title}</div>
        `;
        grid.appendChild(div);
    });
}

function selectSwatchTheme(key) {
    document.querySelectorAll('.palette-swatch').forEach(s => s.classList.remove('active'));
    const activeSwatch = document.getElementById(`swatch-${key}`);
    if (activeSwatch) activeSwatch.classList.add('active');

    const preset = themePresets[key];
    document.getElementById('color-bg').value = preset.bg;
    document.getElementById('color-highways').value = preset.highway;
    document.getElementById('color-roads').value = preset.roads;
    document.getElementById('color-buildings').value = preset.buildings;
    document.getElementById('color-water').value = preset.water;
    document.getElementById('color-parks').value = preset.parks;
    document.getElementById('color-trains').value = preset.trains;
    document.getElementById('color-text-main').value = preset.textMain;
    document.getElementById('color-text-sub').value = preset.textSub;

    executeVectorStyleOverrides();
    renderDOMTypographyUpdates();
}

function toggleMapLayers() {
    const map = window.mapInstance;
    if (!map || !map.isStyleLoaded()) return;

    const showHighways = document.getElementById('layer-highways').checked;
    const showRoads = document.getElementById('layer-roads').checked;
    const showBuildings = document.getElementById('layer-buildings').checked;
    const showWater = document.getElementById('layer-water').checked;
    const showParks = document.getElementById('layer-parks').checked;
    const showTrains = document.getElementById('layer-trains').checked;
    const showLabels = document.getElementById('layer-labels').checked;

    const layers = map.getStyle().layers;
    const isHighwayRegex = /(motorway|trunk|primary|major|expressway|highway|link)/i;
    const isMinorRoadRegex = /(minor|residential|service|secondary|tertiary|street|road|path|track)/i;
    const isBuildingRegex = /(building|3d|structure|extrusion)/i;
    const isWaterRegex = /(water|stream|river|lake|ocean|sea|marina)/i;
    const isParkRegex = /(park|leisure|forest|green|nature|landcover|cemetery|wood|grass)/i;
    const isTrainRegex = /(rail|train|transit|railway|subway)/i;

    layers.forEach(layer => {
        if (layer.type === 'symbol') {
            map.setLayoutProperty(layer.id, 'visibility', showLabels ? 'visible' : 'none');
        }
        if (isBuildingRegex.test(layer.id) || (layer.sourceLayer && isBuildingRegex.test(layer.sourceLayer))) {
            map.setLayoutProperty(layer.id, 'visibility', showBuildings ? 'visible' : 'none');
        }
        if (isWaterRegex.test(layer.id) || (layer.sourceLayer && isWaterRegex.test(layer.sourceLayer))) {
            map.setLayoutProperty(layer.id, 'visibility', showWater ? 'visible' : 'none');
        }
        if (isParkRegex.test(layer.id)) {
            map.setLayoutProperty(layer.id, 'visibility', showParks ? 'visible' : 'none');
        }
        if (isTrainRegex.test(layer.id)) {
            map.setLayoutProperty(layer.id, 'visibility', showTrains ? 'visible' : 'none');
        }
        if (layer.id.includes('road') || layer.id.includes('transportation') || layer.id.includes('link')) {
            if (isHighwayRegex.test(layer.id)) {
                map.setLayoutProperty(layer.id, 'visibility', showHighways ? 'visible' : 'none');
            } else if (isMinorRoadRegex.test(layer.id)) {
                map.setLayoutProperty(layer.id, 'visibility', showRoads ? 'visible' : 'none');
            }
        }
    });
    
    executeVectorStyleOverrides();
    renderDOMTypographyUpdates();
}

async function searchLocation() {
    const query = document.getElementById('search-input').value;
    if (!query) return;

    const url = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}&limit=4`;
    const resultsBox = document.getElementById('search-results');
    resultsBox.innerHTML = '';

    try {
        const response = await fetch(url, { headers: { 'User-Agent': 'CityMapperStore-StudioApp' } });
        const data = await response.json();

        if (data.length === 0) {
            resultsBox.innerHTML = '<div class="search-item">No results.</div>';
            resultsBox.style.display = 'block';
            return;
        }

        resultsBox.style.display = 'block';
        data.forEach(item => {
            const div = document.createElement('div');
            div.className = 'search-item';
            div.innerText = item.display_name;
            div.onclick = () => {
                if (window.mapInstance) window.mapInstance.flyTo({ center: [parseFloat(item.lon), parseFloat(item.lat)], zoom: 14.1 }); 
                
                const nameArray = item.display_name.split(',');
                document.getElementById('text-main-input').value = nameArray[0].trim();
                
                const lat = parseFloat(item.lat);
                const lon = parseFloat(item.lon);
                const latDir = lat >= 0 ? 'N' : 'S';
                const lonDir = lon >= 0 ? 'E' : 'W';
                document.getElementById('text-sub-input').value = `${(nameArray[2] || nameArray[1] || '').trim().toUpperCase()} | ${Math.abs(lat).toFixed(4)}° ${latDir}, ${Math.abs(lon).toFixed(4)}° ${lonDir}`;
                
                resultsBox.style.display = 'none';
                executeVectorStyleOverrides();
                renderDOMTypographyUpdates();
            };
            resultsBox.appendChild(div);
        });
    } catch (err) {
        console.error("Geocoding lookup error: ", err);
    }
}

document.addEventListener('click', (e) => {
    const resultsBox = document.getElementById('search-results');
    if (resultsBox && e.target.id !== 'search-input') {
        resultsBox.style.display = 'none';
    }
});

// FIXED PRODUCTION ENGINE: Employs In-Place Layout Breakout to completely bypass mobile Safari layout squeezing
function processExportPipeline() {
    const map = window.mapInstance;
    if (!map) return;
    
    const exportResMode = document.getElementById('export-resolution').value;
    const exportBtn = document.getElementById('btn-export');
    
    exportBtn.innerText = "Compiling Print File...";
    exportBtn.disabled = true;

    const baseWidth = 420;
    const baseHeight = 560;
    
    let multiplier = 1.5;
    if (exportResMode === 'print-high') {
        multiplier = 4; 
    } else if (exportResMode.includes('600') || exportResMode.includes('ultra') || exportResMode === 'print-ultra') {
        multiplier = 6; 
    }
    
    const targetWidth = baseWidth * multiplier;
    const targetHeight = baseHeight * multiplier;

    const wrapper = document.getElementById('poster-wrapper');
    const innerWrapper = document.getElementById('map-wrapper-inner');
    const mapDiv = document.getElementById('map');
    
    const origWrapperStyle = wrapper.style.cssText;
    const origInnerStyle = innerWrapper.style.cssText;
    const origMapStyle = mapDiv.style.cssText;
    const origBodyOverflow = document.body.style.overflow;

    // FIX 1: Force body overflow to visible and switch layout to position: absolute
    // This shatters the iOS viewport ceiling, letting the canvas render flawlessly edge-to-edge
    document.body.style.overflow = 'visible';
    wrapper.style.cssText = `position: absolute; top: 0; left: 0; width: ${targetWidth}px; height: ${targetHeight}px; max-width: none !important; max-height: none !important; z-index: -9999; transform: none !important;`;
    innerWrapper.style.cssText = `width: 100% !important; height: 100% !important; transform: none !important; max-width: none !important; max-height: none !important;`;
    mapDiv.style.cssText = `width: 100% !important; height: 100% !important; max-width: none !important; max-height: none !important;`;

    map.resize();
    executeVectorStyleOverrides();

    map.once('idle', () => {
        try {
            const originalCanvas = map.getCanvas();
            const textVisible = document.getElementById('text-visible-toggle').checked;
            const textFloatToggle = document.getElementById('text-position-toggle').checked;
            const softEdgeToggle = document.getElementById('style-soft-edges').checked;
            const vignetteIntensity = parseInt(document.getElementById('vignette-intensity').value);
            const labelBlockHeightSrc = textVisible ? 75 : 0; 
            
            const exportCanvas = document.createElement('canvas');
            exportCanvas.width = targetWidth;
            exportCanvas.height = targetHeight; 
            const ctx = exportCanvas.getContext('2d');

            const bgStyle = document.getElementById('color-bg').value;
            const mainTextClass = document.getElementById('color-text-main').value;
            const subTextClass = document.getElementById('color-text-sub').value;
            const titleValue = document.getElementById('text-main-input').value.toUpperCase(); 
            const subtitleValue = document.getElementById('text-sub-input').value.toUpperCase(); 
            const fontSelected = document.getElementById('font-select').value;
            const fontSizeMainSrc = parseInt(document.getElementById('size-font-main').value);
            const letterSpacingSrc = parseInt(document.getElementById('letter-spacing-main').value);

            ctx.fillStyle = bgStyle;
            ctx.fillRect(0, 0, exportCanvas.width, exportCanvas.height);

            let mapDestHeight = exportCanvas.height;
            if (textVisible && !textFloatToggle) {
                mapDestHeight = exportCanvas.height - (labelBlockHeightSrc * multiplier);
            }
            
            ctx.drawImage(originalCanvas, 0, 0, exportCanvas.width, mapDestHeight);

            if (softEdgeToggle) {
                ctx.globalCompositeOperation = "source-over";
                const shadowBorder = (vignetteIntensity / 1.2) * multiplier;
                ctx.strokeStyle = bgStyle;
                ctx.lineWidth = shadowBorder;
                ctx.shadowBlur = vignetteIntensity * multiplier;
                ctx.shadowColor = bgStyle;
                ctx.strokeRect(shadowBorder/2, shadowBorder/2, exportCanvas.width - shadowBorder, mapDestHeight - shadowBorder);
            }
            
            // Clear out canvas shadow states cleanly to protect the banner elements below
            ctx.shadowBlur = 0;
            ctx.shadowColor = "transparent";
            ctx.shadowOffsetX = 0;
            ctx.shadowOffsetY = 0;

            if (textVisible) {
                ctx.textAlign = 'center';
                ctx.textBaseline = 'middle';

                if (textFloatToggle) {
                    const overlayCenterY = exportCanvas.height - (60 * multiplier);
                    
                    // FIX 2: Dynamically match your designer theme background color instead of forcing charcoal black
                    ctx.fillStyle = bgStyle;
                    ctx.fillRect(exportCanvas.width * 0.12, overlayCenterY - (30 * multiplier), exportCanvas.width * 0.76, 65 * multiplier);
                    
                    ctx.fillStyle = mainTextClass;
                    ctx.font = `bold ${Math.floor(fontSizeMainSrc * multiplier)}px ${fontSelected}`;
                    ctx.letterSpacing = `${letterSpacingSrc * multiplier}px`;
                    ctx.fillText(titleValue, exportCanvas.width / 2, overlayCenterY - (6 * multiplier));
                    
                    ctx.fillStyle = subTextClass;
                    ctx.font = `${Math.floor(9 * multiplier)}px ${fontSelected}`;
                    ctx.letterSpacing = `${2 * multiplier}px`;
                    ctx.fillText(subtitleValue, exportCanvas.width / 2, overlayCenterY + (14 * multiplier));
                } else {
                    const bannerCenterY = mapDestHeight + ((exportCanvas.height - mapDestHeight) / 2);
                    ctx.fillStyle = bgStyle;
                    ctx.fillRect(0, mapDestHeight, exportCanvas.width, exportCanvas.height - mapDestHeight);

                    ctx.fillStyle = mainTextClass;
                    ctx.font = `bold ${Math.floor(fontSizeMainSrc * multiplier)}px ${fontSelected}`;
                    ctx.letterSpacing = `${letterSpacingSrc * multiplier}px`;
                    ctx.fillText(titleValue, exportCanvas.width / 2, bannerCenterY - (8 * multiplier));
                    
                    ctx.fillStyle = subTextClass;
                    ctx.font = `${Math.floor(9 * multiplier)}px ${fontSelected}`;
                    ctx.letterSpacing = `${2 * multiplier}px`;
                    ctx.fillText(subtitleValue, exportCanvas.width / 2, bannerCenterY + (10 * multiplier));
                }
            }

            const dataURL = exportCanvas.toDataURL('image/png');
            
            let modal = document.getElementById('mobile-export-modal');
            if (!modal) {
                modal = document.createElement('div');
                modal.id = 'mobile-export-modal';
                modal.style.cssText = 'position:fixed;top:0;left:0;width:100vw;height:100vh;background:rgba(18,18,18,0.96);z-index:99999;display:none;flex-direction:column;align-items:center;justify-content:center;padding:20px;box-sizing:border-box;color:#fff;font-family:-apple-system,BlinkMacSystemFont,sans-serif;';
                
                const closeBtn = document.createElement('button');
                closeBtn.innerText = '✕ Close Preview';
                closeBtn.style.cssText = 'margin-bottom:15px;background:#222;color:#fff;border:1px solid #444;padding:12px 24px;border-radius:8px;font-weight:bold;font-size:13px;text-transform:uppercase;letter-spacing:1px;';
                closeBtn.onclick = () => { modal.style.display = 'none'; };
                
                const alertInfo = document.createElement('p');
                alertInfo.innerText = '📸 Print File Compiled!\nLong-press the image below to save it directly to your Photos.';
                alertInfo.style.cssText = 'text-align:center;font-size:13px;color:#00ffcc;margin:0 0 15px 0;line-height:1.5;font-weight:bold;';
                
                const imgFrame = document.createElement('div');
                imgFrame.id = 'mobile-export-frame';
                imgFrame.style.cssText = 'max-width:100%;max-height:70vh;box-shadow:0 20px 50px rgba(0,0,0,0.9);border-radius:4px;overflow:hidden;';
                
                modal.appendChild(closeBtn);
                modal.appendChild(alertInfo);
                modal.appendChild(imgFrame);
                document.body.appendChild(modal);
            }

            const imgFrame = document.getElementById('mobile-export-frame');
            if (imgFrame) {
                imgFrame.innerHTML = '';
                const finalPosterImg = document.createElement('img');
                finalPosterImg.src = dataURL;
                finalPosterImg.style.cssText = 'width:100%;height:auto;max-height:70vh;display:block;object-fit:contain;';
                imgFrame.appendChild(finalPosterImg);
            }
            
            modal.style.display = 'flex';

        } catch (innerError) {
            console.error("Canvas composite step failure: ", innerError);
        } finally {
            // Revert original structural layout rules safely
            wrapper.style.cssText = origWrapperStyle;
            innerWrapper.style.cssText = origInnerStyle;
            mapDiv.style.cssText = origMapStyle;
            document.body.style.overflow = origBodyOverflow;
            
            map.resize();
            executeVectorStyleOverrides();
            renderDOMTypographyUpdates();

            exportBtn.innerText = "Generate Art File";
            exportBtn.disabled = false;
        }
    });
}
