/**
 * CityMapper Studio Pro Engine Logic Controller Module v15.1
 * Production Modular Guarded Architecture System
 */

// Global state variables
let map;
let uiDebounceTimer = null;
let isStyleUpdating = false;

// Premium Preset Master Matrix
const themePresets = {
    'gold-dark': { title: 'Gold', bg: '#000000', highway: '#d4af37', roads: '#b0912d', buildings: '#423712', water: '#1a170b', parks: '#141a0f', trains: '#7a6221', textMain: '#d4af37', textSub: '#888888' },
    'minimal-gray': { title: 'Charcoal', bg: '#ffffff', highway: '#222222', roads: '#777777', buildings: '#e0e0e0', water: '#f0f0f0', parks: '#ebf2ea', trains: '#bcbcbc', textMain: '#111111', textSub: '#555555' },
    'lavender-light': { title: 'Lavender', bg: '#f3f1f7', highway: '#4a3b63', roads: '#8c829e', buildings: '#b8afc8', water: '#d2cbdc', parks: '#e6f0fa', trains: '#a399b3', textMain: '#36294d', textSub: '#6b617a' },
    'cyber-neon': { title: 'Neon', bg: '#08090f', highway: '#00ffcc', roads: '#1a233a', buildings: '#101524', water: '#0d1b2a', parks: '#0a1a15', trains: '#ff0055', textMain: '#00ffcc', textSub: '#8fa0b2' },
    'mid-century-navy': { title: 'Navy', bg: '#162b3d', highway: '#fca34d', roads: '#3a5f7d', buildings: '#223f5a', water: '#1d486c', parks: '#1f3a3a', trains: '#8da9c4', textMain: '#fdf2a7', textSub: '#a5c4d4' },
    'emerald-forest': { title: 'Emerald', bg: '#0b1d12', highway: '#c3a35a', roads: '#1b3b22', buildings: '#122918', water: '#08160e', parks: '#1c4228', trains: '#947a43', textMain: '#ebd59b', textSub: '#709377' },
    'warm-terracotta': { title: 'Clay', bg: '#f4ebe1', highway: '#b85032', roads: '#d99b77', buildings: '#ebd0be', water: '#e0c3b1', parks: '#e3dfd5', trains: '#823720', textMain: '#612312', textSub: '#9c6f59' }
};

// MASTER SECURITY GUARD: Prevents execution until the HTML body is completely built
document.addEventListener("DOMContentLoaded", () => {
    
    // Initialize Map Container safely inside the ready tree
    map = new maplibregl.Map({
        container: 'map',
        style: 'https://tiles.openfreemap.org/styles/dark', 
        center: [9.0908, 48.7297], 
        zoom: 14.1, 
        attributionControl: false, 
        preserveDrawingBuffer: true
    });

    // Attach event pipes cleanly to the ready instance
    map.on('load', () => { executeVectorStyleOverrides(); });
    map.on('idle', () => { executeVectorStyleOverrides(); });

    // Boot up the visual interface layout components
    generateVisualSwatches();
    
    // Fire default activation state
    setTimeout(() => { selectSwatchTheme('cyber-neon'); }, 300);
});

function executeVectorStyleOverrides() {
    if (!map || !map.isStyleLoaded()) return;

    const bgStyleVal = document.getElementById('color-bg').value;
    const highwayColorVal = document.getElementById('color-highways').value;
    const roadColorVal = document.getElementById('color-roads').value;
    const buildingColorVal = document.getElementById('color-buildings').value;
    const waterColorVal = document.getElementById('color-water').value;
    const parkColorVal = document.getElementById('color-parks').value;
    const trainColorVal = document.getElementById('color-trains').value;
    const highwaySliderWidth = parseFloat(document.getElementById('width-highways').value);

    const isHighwayRegex = /(motorway|trunk|primary|major|expressway|highway)/i;
    const isMinorRoadRegex = /(minor|residential|service|secondary|tertiary|street|road)/i;
    const isBuildingRegex = /(building|3d|structure|extrusion)/i;
    const isWaterRegex = /(water|stream|river|lake|ocean|sea)/i;
    const isParkRegex = /(park|leisure|forest|green|nature|landcover|cemetery)/i;
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
        if (isBuildingRegex.test(layer.id) || (layer.source-layer && isBuildingRegex.test(layer.source-layer))) {
            map.setPaintProperty(layer.id, 'fill-color', buildingColorVal);
        }
        if (isWaterRegex.test(layer.id)) {
            if (layer.type === 'fill') map.setPaintProperty(layer.id, 'fill-color', waterColorVal);
            if (layer.type === 'line') map.setPaintProperty(layer.id, 'line-color', waterColorVal);
        }
        if (isParkRegex.test(layer.id)) {
            if (layer.type === 'fill') map.setPaintProperty(layer.id, 'fill-color', parkColorVal);
        }
        if (isTrainRegex.test(layer.id)) {
            if (layer.type === 'line') map.setPaintProperty(layer.id, 'line-color', trainColorVal);
        }
        if (layer.type === 'line' && isHighwayRegex.test(layer.id)) {
            map.setPaintProperty(layer.id, 'line-color', highwayColorVal);
            map.setPaintProperty(layer.id, 'line-width', highwaySliderWidth);
        }
        if (layer.type === 'line' && isMinorRoadRegex.test(layer.id) && !isHighwayRegex.test(layer.id)) {
            map.setPaintProperty(layer.id, 'line-color', roadColorVal);
            map.setPaintProperty(layer.id, 'line-width', [
                'interpolate', ['linear'], ['zoom'],
                1, 0.1,   
                10, 0.25,  
                14, 0.45
            ]);
        }
    });
}

function triggerUIDebounce() {
    clearTimeout(uiDebounceTimer);
    uiDebounceTimer = setTimeout(() => {
        renderDOMTypographyUpdates();
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
        typographyControls.style.display = "block";
        textColorRow.style.display = "flex";
        labelBlock.classList.remove('hidden-element');
        
        if (textFloatToggle) {
            labelBlock.classList.add('floating');
            mapBox.classList.add('full-bleed');
        } else {
            labelBlock.classList.remove('floating');
            labelBlock.style.backgroundColor = bgVal;
            mapBox.classList.remove('full-bleed');
        }
    } else {
        typographyControls.style.display = "none";
        textColorRow.style.display = "none";
        labelBlock.classList.add('hidden-element');
        mapBox.classList.add('full-bleed');
    }
    
    document.getElementById('poster-frame').style.backgroundColor = bgVal;
    
    const mainLabel = document.getElementById('label-main');
    mainLabel.innerText = document.getElementById('text-main-input').value.toUpperCase(); 
    mainLabel.style.color = mainTextVal;
    mainLabel.style.fontFamily = fontVal;
    mainLabel.style.fontSize = `${fontSizeMain}px`;
    mainLabel.style.letterSpacing = `${letterSpacingMain}px`;

    const subLabel = document.getElementById('label-sub');
    subLabel.innerText = document.getElementById('text-sub-input').value.toUpperCase(); 
    subLabel.style.color = subTextVal;
    subLabel.style.fontFamily = fontVal;

    const vignetteToggle = document.getElementById('style-soft-edges').checked;
    const vignetteMask = document.getElementById('map-vignette');
    const vignetteIntensity = document.getElementById('vignette-intensity').value;
    
    if (vignetteToggle) {
        vignetteMask.style.display = "block";
        vignetteMask.style.boxShadow = `inset 0 0 ${vignetteIntensity}px ${Math.floor(vignetteIntensity/2.5)}px ${bgVal}`;
    } else {
        vignetteMask.style.display = "none";
    }

    executeVectorStyleOverrides();
}

function generateVisualSwatches() {
    const grid = document.getElementById('palette-container-wrapper');
    if (!grid) return;
    grid.innerHTML = '';

    Object.keys(themePresets).forEach(key => {
        const p = themePresets[key];
        const div = document.createElement('div');
        div.className = `palette-swatch ${key === 'cyber-neon' ? 'active' : ''}`;
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

    triggerUIDebounce();
}

function toggleMapLayers() {
    if (!map || !map.isStyleLoaded()) return;

    const showHighways = document.getElementById('layer-highways').checked;
    const showRoads = document.getElementById('layer-roads').checked;
    const showBuildings = document.getElementById('layer-buildings').checked;
    const showWater = document.getElementById('layer-water').checked;
    const showParks = document.getElementById('layer-parks').checked;
    const showTrains = document.getElementById('layer-trains').checked;
    const showLabels = document.getElementById('layer-labels').checked;

    const layers = map.getStyle().layers;
    const isHighwayRegex = /(motorway|trunk|primary|major|expressway|highway)/i;
    const isMinorRoadRegex = /(minor|residential|service|secondary|tertiary|street|road)/i;
    const isBuildingRegex = /(building|3d|structure|extrusion)/i;
    const isWaterRegex = /(water|stream|river|lake|ocean|sea)/i;
    const isParkRegex = /(park|leisure|forest|green|nature|landcover|cemetery)/i;
    const isTrainRegex = /(rail|train|transit|railway|subway)/i;

    layers.forEach(layer => {
        if (layer.type === 'symbol') {
            map.setLayoutProperty(layer.id, 'visibility', showLabels ? 'visible' : 'none');
        }
        if (isBuildingRegex.test(layer.id) || (layer.source-layer && isBuildingRegex.test(layer.source-layer))) {
            map.setLayoutProperty(layer.id, 'visibility', showBuildings ? 'visible' : 'none');
        }
        if (isWaterRegex.test(layer.id)) {
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
    triggerUIDebounce();
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
                if (map) map.flyTo({ center: [parseFloat(item.lon), parseFloat(item.lat)], zoom: 14.1 }); 
                
                const nameArray = item.display_name.split(',');
                document.getElementById('text-main-input').value = nameArray[0].trim();
                
                const lat = parseFloat(item.lat);
                const lon = parseFloat(item.lon);
                const latDir = lat >= 0 ? 'N' : 'S';
                const lonDir = lon >= 0 ? 'E' : 'W';
                document.getElementById('text-sub-input').value = `${(nameArray[2] || nameArray[1] || '').trim().toUpperCase()} | ${Math.abs(lat).toFixed(4)}° ${latDir}, ${Math.abs(lon).toFixed(4)}° ${lonDir}`;
                
                resultsBox.style.display = 'none';
                triggerUIDebounce();
            };
            resultsBox.appendChild(div);
        });
    } catch (err) {
        console.error("Geocoding lookup execution break trace: ", err);
    }
}

document.addEventListener('click', (e) => {
    const resultsBox = document.getElementById('search-results');
    if (resultsBox && e.target.id !== 'search-input') {
        resultsBox.style.display = 'none';
    }
});

function processExportPipeline() {
    if (!map) return;
    const exportResMode = document.getElementById('export-resolution').value;
    const exportBtn = document.getElementById('btn-export');
    
    exportBtn.innerText = "Processing Matrix...";
    exportBtn.disabled = true;

    const renderMultiplier = (exportResMode === 'print-high') ? 4 : 1.5;

    setTimeout(() => {
        try {
            const originalCanvas = map.getCanvas();
            
            const lockedWidthBase = 420;
            const lockedHeightBase = 560;

            const textVisible = document.getElementById('text-visible-toggle').checked;
            const textFloatToggle = document.getElementById('text-position-toggle').checked;
            const softEdgeToggle = document.getElementById('style-soft-edges').checked;
            const vignetteIntensity = parseInt(document.getElementById('vignette-intensity').value);

            const labelBlockHeightSrc = textVisible ? 75 : 0; 
            
            const exportCanvas = document.createElement('canvas');
            exportCanvas.width = lockedWidthBase * renderMultiplier;
            exportCanvas.height = lockedHeightBase * renderMultiplier; 
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
                mapDestHeight = exportCanvas.height - (labelBlockHeightSrc * renderMultiplier);
            }
            
            ctx.drawImage(originalCanvas, 0, 0, exportCanvas.width, mapDestHeight);

            if (softEdgeToggle) {
                ctx.globalCompositeOperation = "source-over";
                const shadowBorder = (vignetteIntensity / 1.2) * renderMultiplier;
                ctx.strokeStyle = bgStyle;
                ctx.lineWidth = shadowBorder;
                ctx.shadowBlur = vignetteIntensity * renderMultiplier;
                ctx.shadowColor = bgStyle;
                ctx.strokeRect(shadowBorder/2, shadowBorder/2, exportCanvas.width - shadowBorder, mapDestHeight - shadowBorder);
                ctx.shadowBlur = 0; 
            }

            if (textVisible) {
                ctx.textAlign = 'center';
                ctx.textBaseline = 'middle';

                if (textFloatToggle) {
                    const overlayCenterY = exportCanvas.height - (60 * renderMultiplier);
                    
                    ctx.fillStyle = "rgba(0,0,0,0.85)";
                    ctx.fillRect(exportCanvas.width * 0.12, overlayCenterY - (30 * renderMultiplier), exportCanvas.width * 0.76, 65 * renderMultiplier);
                    
                    ctx.fillStyle = mainTextClass;
                    ctx.font = `bold ${Math.floor(fontSizeMainSrc * renderMultiplier)}px ${fontSelected}`;
                    ctx.letterSpacing = `${letterSpacingSrc * renderMultiplier}px`;
                    ctx.fillText(titleValue, exportCanvas.width / 2, overlayCenterY - (6 * renderMultiplier));
                    
                    ctx.fillStyle = subTextClass;
                    ctx.font = `${Math.floor(9 * renderMultiplier)}px ${fontSelected}`;
                    ctx.letterSpacing = `${2 * renderMultiplier}px`;
                    ctx.fillText(subtitleValue, exportCanvas.width / 2, overlayCenterY + (14 * renderMultiplier));
                } else {
                    const bannerCenterY = mapDestHeight + ((exportCanvas.height - mapDestHeight) / 2);
                    
                    ctx.fillStyle = bgStyle;
                    ctx.fillRect(0, mapDestHeight, exportCanvas.width, exportCanvas.height - mapDestHeight);

                    ctx.fillStyle = mainTextClass;
                    ctx.font = `bold ${Math.floor(fontSizeMainSrc * renderMultiplier)}px ${fontSelected}`;
                    ctx.letterSpacing = `${letterSpacingSrc * renderMultiplier}px`;
                    ctx.fillText(titleValue, exportCanvas.width / 2, bannerCenterY - (8 * renderMultiplier));
                    
                    ctx.fillStyle = subTextClass;
                    ctx.font = `${Math.floor(9 * renderMultiplier)}px ${fontSelected}`;
                    ctx.letterSpacing = `${2 * renderMultiplier}px`;
                    ctx.fillText(subtitleValue, exportCanvas.width / 2, bannerCenterY + (10 * renderMultiplier));
                }
            }

            const downloadLink = document.createElement('a');
            const filenamePrefix = textVisible ? titleValue.replace(/\s+/g, '_') : "Wide_Grid";
            downloadLink.download = `${filenamePrefix}_StudioArt_${exportResMode}.png`;
            downloadLink.href = exportCanvas.toDataURL('image/png');
            downloadLink.click();
        } catch (error) {
            console.error("Export Compiler system fail trace: ", error);
            alert("Export Engine error encountered.");
        } finally {
            exportBtn.innerText = "Generate Art File";
            exportBtn.disabled = false;
        }
    }, 150);
}