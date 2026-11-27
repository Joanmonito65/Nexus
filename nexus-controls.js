/* NEXUS native-style controls. Values remain in the original form fields so
   existing workspace handlers and backup formats continue to work. */
(() => {
  const DATE_SELECTOR = 'input[type="date"],input[type="datetime-local"]';
  const COLOR_SELECTOR = 'input[type="color"]';
  const pad = value => String(value).padStart(2, '0');
  const escapeHTML = value => String(value).replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]);
  const localDateKey = date => `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
  const validDateKey = value => {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(value || '')) return false;
    const [year, month, day] = value.split('-').map(Number);
    const date = new Date(`${value}T12:00:00`);
    return !Number.isNaN(date.getTime()) && date.getFullYear() === year && date.getMonth() === month - 1 && date.getDate() === day;
  };
  const displayDate = value => validDateKey(value) ? new Intl.DateTimeFormat(undefined, { month: 'short', day: 'numeric', year: 'numeric' }).format(new Date(`${value}T12:00:00`)) : '';
  const readTime = value => /^\d{4}-\d{2}-\d{2}T(\d{2}):(\d{2})$/.exec(value || '');
  const fire = (input, type) => input.dispatchEvent(new Event(type, { bubbles: true }));
  const labelFor = input => input.getAttribute('aria-label') || input.closest('label')?.querySelector('span')?.textContent?.trim() || input.id.replace(/([A-Z])/g, ' $1').replace(/^./, letter => letter.toUpperCase()) || 'Choose a value';

  let activeDate = null;

  const datePopover = () => {
    let popover = document.getElementById('nexusDatePickerPopover');
    if (popover) return popover;
    popover = document.createElement('section');
    popover.id = 'nexusDatePickerPopover';
    popover.className = 'nexus-date-popover hidden';
    popover.setAttribute('role', 'dialog');
    popover.setAttribute('aria-label', 'NEXUS date picker');
    document.body.append(popover);
    popover.addEventListener('click', event => {
      const button = event.target.closest('[data-nexus-date-action]');
      if (!button || !activeDate) return;
      const action = button.dataset.nexusDateAction;
      if (action === 'previous' || action === 'next') {
        activeDate.view = new Date(activeDate.view.getFullYear(), activeDate.view.getMonth() + (action === 'next' ? 1 : -1), 1);
        paintDatePopover();
      } else if (action === 'day') {
        activeDate.selected = button.dataset.date;
        if (activeDate.input.type === 'date') commitDatePicker(true);
        else paintDatePopover();
      } else if (action === 'today') {
        activeDate.selected = localDateKey(new Date());
        if (activeDate.input.type === 'date') commitDatePicker(true);
        else paintDatePopover();
      } else if (action === 'clear') {
        activeDate.input.value = '';
        fire(activeDate.input, 'input');
        fire(activeDate.input, 'change');
        closeDatePicker();
      } else if (action === 'hour' || action === 'minute') {
        const [hour, minute] = activeDate.time.split(':').map(Number);
        const offset = Number(button.dataset.step) * (action === 'hour' ? 60 : 1);
        const total = (hour * 60 + minute + offset + 1440) % 1440;
        activeDate.time = `${pad(Math.floor(total / 60))}:${pad(total % 60)}`;
        paintDatePopover();
      } else if (action === 'apply') commitDatePicker(true);
      else if (action === 'cancel') closeDatePicker(true);
    });
    popover.addEventListener('change', event => {
      if (event.target.matches('[data-nexus-date-year]') && activeDate) {
        const year = Math.max(1, Math.min(9999, Number(event.target.value) || activeDate.view.getFullYear()));
        activeDate.view = new Date(year, activeDate.view.getMonth(), 1);
        paintDatePopover();
      }
    });
    return popover;
  };

  const positionPopover = (popover, anchor) => {
    if (!anchor?.isConnected) return;
    const rect = anchor.getBoundingClientRect();
    const width = Math.min(popover.id === 'nexusColorPickerPopover' ? 410 : 360, window.innerWidth - 20);
    const height = Math.min(popover.scrollHeight || popover.offsetHeight || 410, window.innerHeight - 20);
    const left = Math.max(10, Math.min(rect.left, window.innerWidth - width - 10));
    const top = rect.bottom + height + 10 <= window.innerHeight ? rect.bottom + 8 : Math.max(10, rect.top - height - 8);
    popover.style.width = `${width}px`;
    popover.style.maxHeight = `${height}px`;
    popover.style.overflowY = popover.id === 'nexusColorPickerPopover' ? 'auto' : '';
    popover.style.left = `${left}px`;
    popover.style.top = `${top}px`;
  };

  const paintDatePopover = () => {
    if (!activeDate) return;
    const popover = datePopover();
    const view = activeDate.view;
    const year = view.getFullYear();
    const month = view.getMonth();
    const monthName = new Intl.DateTimeFormat(undefined, { month: 'long' }).format(view);
    const firstDay = new Date(year, month, 1).getDay();
    const count = new Date(year, month + 1, 0).getDate();
    const cells = Array.from({ length: firstDay }, () => '<span class="nexus-date-empty" aria-hidden="true"></span>');
    for (let day = 1; day <= count; day++) {
      const key = `${year}-${pad(month + 1)}-${pad(day)}`;
      const selected = key === activeDate.selected;
      const today = key === localDateKey(new Date());
      cells.push(`<button type="button" class="nexus-date-day${selected ? ' is-selected' : ''}${today ? ' is-today' : ''}" data-nexus-date-action="day" data-date="${key}" aria-pressed="${selected}">${day}</button>`);
    }
    while (cells.length % 7) cells.push('<span class="nexus-date-empty" aria-hidden="true"></span>');
    const timePart = activeDate.input.type === 'datetime-local' ? `<div class="nexus-date-time"><span>Time</span><div><button type="button" data-nexus-date-action="hour" data-step="-1" aria-label="Earlier hour">−</button><output>${activeDate.time}</output><button type="button" data-nexus-date-action="hour" data-step="1" aria-label="Later hour">+</button><i></i><button type="button" data-nexus-date-action="minute" data-step="-5" aria-label="Earlier five minutes">−</button><small>minutes</small><button type="button" data-nexus-date-action="minute" data-step="5" aria-label="Later five minutes">+</button></div></div>` : '';
    popover.innerHTML = `<header class="nexus-date-head"><button type="button" data-nexus-date-action="previous" aria-label="Previous month">‹</button><div><strong>${escapeHTML(monthName)}</strong><input data-nexus-date-year type="number" min="1" max="9999" value="${year}" aria-label="Year"></div><button type="button" data-nexus-date-action="next" aria-label="Next month">›</button></header><div class="nexus-date-weekdays">${['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(day => `<span>${day}</span>`).join('')}</div><div class="nexus-date-grid">${cells.join('')}</div>${timePart}<footer class="nexus-date-foot"><button type="button" class="button button-small" data-nexus-date-action="today">Today</button><span></span><button type="button" class="button button-small" data-nexus-date-action="clear">Clear</button>${activeDate.input.type === 'datetime-local' ? '<button type="button" class="button button-primary button-small" data-nexus-date-action="apply">Apply</button>' : ''}</footer>`;
    popover.classList.remove('hidden');
    positionPopover(popover, activeDate.trigger);
  };

  const closeDatePicker = (restoreFocus = false) => {
    const popover = document.getElementById('nexusDatePickerPopover');
    const trigger = activeDate?.trigger;
    activeDate = null;
    popover?.classList.add('hidden');
    if (restoreFocus && trigger?.isConnected) trigger.focus({ preventScroll: true });
  };

  const commitDatePicker = (close = false) => {
    if (!activeDate) return;
    const { input, trigger, selected, time } = activeDate;
    input.value = input.type === 'datetime-local' ? `${selected}T${time}` : selected;
    const text = input.type === 'datetime-local' ? `${displayDate(selected)} · ${time}` : displayDate(selected);
    trigger.querySelector('.nexus-date-value').textContent = text || 'Choose date';
    fire(input, 'input');
    fire(input, 'change');
    if (close) closeDatePicker();
  };

  const openDatePicker = (input, trigger) => {
    const valueDate = input.type === 'datetime-local' ? input.value.slice(0, 10) : input.value;
    const selected = validDateKey(valueDate) ? valueDate : localDateKey(new Date());
    const timeMatch = readTime(input.value);
    activeDate = { input, trigger, selected, time: timeMatch ? `${timeMatch[1]}:${timeMatch[2]}` : '09:00', view: new Date(`${selected}T12:00:00`) };
    paintDatePopover();
  };

  const hexToRgb = hex => {
    const match = /^#([\da-f]{6})$/i.exec(hex);
    if (!match) return null;
    const n = parseInt(match[1], 16);
    return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 };
  };
  const rgbToHex = ({ r, g, b }) => `#${[r, g, b].map(value => Math.round(Math.max(0, Math.min(255, value))).toString(16).padStart(2, '0')).join('').toUpperCase()}`;
  const hexToHsl = hex => {
    const { r: red, g: green, b: blue } = hexToRgb(hex) || { r: 0, g: 0, b: 0 };
    const r = red / 255, g = green / 255, b = blue / 255;
    const max = Math.max(r, g, b), min = Math.min(r, g, b), delta = max - min;
    let h = 0, s = 0, l = (max + min) / 2;
    if (delta) {
      s = delta / (1 - Math.abs(2 * l - 1));
      if (max === r) h = 60 * (((g - b) / delta) % 6);
      else if (max === g) h = 60 * ((b - r) / delta + 2);
      else h = 60 * ((r - g) / delta + 4);
    }
    return [Math.round((h + 360) % 360), Math.round(s * 100), Math.round(l * 100)];
  };
  const hslToHex = (h, s, l) => {
    s /= 100; l /= 100;
    const k = n => (n + h / 30) % 12;
    const a = s * Math.min(l, 1 - l);
    const f = n => Math.round(255 * (l - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1))))).toString(16).padStart(2, '0');
    return `#${f(0)}${f(8)}${f(4)}`.toUpperCase();
  };
  const rgbToHsv = hex => {
    const { r: rr, g: gg, b: bb } = hexToRgb(hex) || { r: 0, g: 0, b: 0 };
    const r = rr / 255, g = gg / 255, b = bb / 255, max = Math.max(r, g, b), min = Math.min(r, g, b), delta = max - min;
    let h = 0;
    if (delta) h = max === r ? 60 * (((g - b) / delta) % 6) : max === g ? 60 * ((b - r) / delta + 2) : 60 * ((r - g) / delta + 4);
    return [(h + 360) % 360, max ? delta / max * 100 : 0, max * 100];
  };
  const hsvToHex = (h, s, v) => {
    h = ((Number(h) % 360) + 360) % 360; s = Math.max(0, Math.min(100, Number(s))) / 100; v = Math.max(0, Math.min(100, Number(v))) / 100;
    const c = v * s, x = c * (1 - Math.abs((h / 60) % 2 - 1)), m = v - c;
    const [r, g, b] = h < 60 ? [c, x, 0] : h < 120 ? [x, c, 0] : h < 180 ? [0, c, x] : h < 240 ? [0, x, c] : h < 300 ? [x, 0, c] : [c, 0, x];
    return rgbToHex({ r: (r + m) * 255, g: (g + m) * 255, b: (b + m) * 255 });
  };
  const normalizeHex = value => {
    const text = String(value || '').trim();
    const match = /^#?([\da-f]{3}|[\da-f]{6})$/i.exec(text);
    if (!match) return null;
    const raw = match[1].length === 3 ? [...match[1]].map(char => char + char).join('') : match[1];
    return `#${raw.toUpperCase()}`;
  };
  const parseColorText = (value, format) => {
    const text = String(value || '').trim();
    if (format === 'hex') return normalizeHex(text);
    if (format === 'rgb') {
      const match = /^rgba?\(\s*([\d.]+)%?\s*,\s*([\d.]+)%?\s*,\s*([\d.]+)%?\s*(?:,\s*[\d.]+\s*)?\)$/i.exec(text);
      if (!match) return null;
      const percent = /%/.test(text);
      const channels = match.slice(1, 4).map(Number);
      if (channels.some(value => !Number.isFinite(value) || value < 0 || value > (percent ? 100 : 255))) return null;
      return rgbToHex({ r: percent ? channels[0] * 2.55 : channels[0], g: percent ? channels[1] * 2.55 : channels[1], b: percent ? channels[2] * 2.55 : channels[2] });
    }
    if (format === 'hsl') {
      const match = /^hsla?\(\s*([\d.]+)(?:deg)?\s*,\s*([\d.]+)%\s*,\s*([\d.]+)%\s*(?:,\s*[\d.]+\s*)?\)$/i.exec(text);
      if (!match) return null;
      const [, h, s, l] = match.map(Number);
      if (![h, s, l].every(Number.isFinite) || s < 0 || s > 100 || l < 0 || l > 100) return null;
      return hslToHex(h, s, l);
    }
    return null;
  };
  const colorPresets = [
    ['Red', '#E5484D'], ['Light Red', '#FF8A8A'], ['Dark Red', '#8E1B24'], ['Pink', '#F472B6'], ['Rose', '#D94678'],
    ['Orange', '#F97316'], ['Dark Orange', '#B54708'], ['Amber', '#E5A000'], ['Yellow', '#FACC15'], ['Gold', '#C49A30'],
    ['Lime', '#84CC16'], ['Green', '#22A06B'], ['Dark Green', '#14532D'], ['Mint', '#67DDB5'], ['Cyan', '#06B6D4'],
    ['Turquoise', '#20B8A9'], ['Teal', '#0F766E'], ['Light Blue', '#67B7F7'], ['Blue', '#3978F6'], ['Dark Blue', '#1D4ED8'],
    ['Navy Blue', '#172554'], ['Purple', '#8B5CF6'], ['Violet', '#6D28D9'], ['Magenta', '#D946EF'], ['Brown', '#8B5E3C'],
    ['Gray', '#717784'], ['White', '#FFFFFF'], ['Black', '#111318']
  ];
  const palettes = {
    NEXUS: [['NEXUS Periwinkle', '#A4B2FF'], ['NEXUS Indigo', '#7B83FF'], ['NEXUS Blue', '#4C68ED'], ['NEXUS Navy', '#25388F'], ['NEXUS Cyan', '#55C7D8'], ['NEXUS Teal', '#25886B'], ['NEXUS Green', '#83C56E'], ['NEXUS Gold', '#E5B85C'], ['NEXUS Coral', '#ED8A5A'], ['NEXUS Rose', '#D65B78'], ['NEXUS Violet', '#B37BDF'], ['NEXUS Mist', '#F1F3F9']],
    Presets: colorPresets,
    Green: ['#0B3D2E', '#146A4C', '#25886B', '#41A67A', '#73C69A', '#B7E3C7', '#D8F2E2', '#1F655A', '#5CA697', '#A1C9B7', '#3B7D3A', '#9BCB62'].map((color, index) => [`Green shade ${index + 1}`, color]),
    Blue: ['#142B57', '#1D4382', '#285DA8', '#347FC4', '#54A9DB', '#A5D5EF', '#D9F0FB', '#294B68', '#417A91', '#64B8C2', '#6677D9', '#A4B2FF'].map((color, index) => [`Blue shade ${index + 1}`, color]),
    Purple: ['#35204B', '#523178', '#7048A6', '#8B62C5', '#B28AE0', '#D9C0F4', '#F0E7FA', '#643B5B', '#9C5C87', '#D184AA', '#815ED1', '#B8A4F2'].map((color, index) => [`Purple shade ${index + 1}`, color]),
    Warm: ['#542B26', '#884534', '#B95F42', '#E07E53', '#F3A66B', '#F7D2A7', '#FCF0DE', '#76502F', '#A47A42', '#D0AC64', '#B85158', '#E58E8F'].map((color, index) => [`Warm shade ${index + 1}`, color]),
    Neutral: ['#111318', '#272A31', '#414650', '#626A76', '#858E9B', '#ABB2BC', '#D4D8DE', '#EEF0F3', '#FFFFFF', '#F1EDE5', '#D8CFBF', '#A39784'].map((color, index) => [`Neutral shade ${index + 1}`, color])
  };
  const loadColorShelf = () => {
    try {
      const parsed = JSON.parse(localStorage.getItem('nexus-color-library-v1') || '{}');
      return { recent: Array.isArray(parsed.recent) ? parsed.recent.filter(value => normalizeHex(value)).slice(0, 12) : [], saved: Array.isArray(parsed.saved) ? parsed.saved.filter(value => normalizeHex(value)).slice(0, 32) : [], palettes: Array.isArray(parsed.palettes) ? parsed.palettes.filter(palette => palette && /^[\w-]{1,48}$/.test(palette.id) && typeof palette.name === 'string').map(palette => ({ id: palette.id, name: palette.name.slice(0, 32), colors: Array.isArray(palette.colors) ? [...new Set(palette.colors.map(normalizeHex).filter(Boolean))].slice(0, 48) : [] })).slice(0, 12) : [] };
    } catch { return { recent: [], saved: [], palettes: [] }; }
  };
  const colorShelf = loadColorShelf();
  let activeColor = null;
  let paletteGroup = 'NEXUS';
  const persistColorShelf = () => { try { localStorage.setItem('nexus-color-library-v1', JSON.stringify(colorShelf)); } catch { /* Color preferences are optional when browser storage is disabled. */ } };
  const colorShelfGroups = () => [...Object.keys(palettes), 'Shades & Tints', 'Recent', 'Saved', ...colorShelf.palettes.map(palette => `palette:${palette.id}`)];
  const namedColor = color => colorPresets.find(([, value]) => value === color)?.[0] || Object.values(palettes).flat().find(([, value]) => value === color)?.[0] || color;
  const colorToRgbText = hex => { const { r, g, b } = hexToRgb(hex); return `rgb(${r}, ${g}, ${b})`; };
  const colorToHslText = hex => { const [h, s, l] = hexToHsl(hex); return `hsl(${h}, ${s}%, ${l}%)`; };
  const luminance = hex => {
    const rgb = hexToRgb(hex);
    const channels = [rgb.r, rgb.g, rgb.b].map(value => { const channel = value / 255; return channel <= .04045 ? channel / 12.92 : ((channel + .055) / 1.055) ** 2.4; });
    return channels[0] * .2126 + channels[1] * .7152 + channels[2] * .0722;
  };
  const contrastRatio = (a, b) => { const values = [luminance(a), luminance(b)].sort((x, y) => y - x); return (values[0] + .05) / (values[1] + .05); };
  const contrastTextFor = color => contrastRatio(color, '#FFFFFF') >= contrastRatio(color, '#111318') ? '#FFFFFF' : '#111318';
  const mixColor = (hex, mix, amount) => { const a = hexToRgb(hex), b = hexToRgb(mix), part = Math.max(0, Math.min(1, amount)); return rgbToHex({ r: a.r * (1 - part) + b.r * part, g: a.g * (1 - part) + b.g * part, b: a.b * (1 - part) + b.b * part }); };
  const colorPopover = () => {
    let popover = document.getElementById('nexusColorPickerPopover');
    if (popover) return popover;
    popover = document.createElement('section');
    popover.id = 'nexusColorPickerPopover';
    popover.className = 'nexus-color-popover hidden';
    popover.setAttribute('role', 'dialog');
    popover.setAttribute('aria-label', 'NEXUS color picker');
    document.body.append(popover);
    popover.addEventListener('click', event => {
      const button = event.target.closest('[data-nexus-color-action]');
      if (!button || !activeColor) return;
      const action = button.dataset.nexusColorAction;
      if (action === 'group') { paletteGroup = button.dataset.group; paintColorPopover(); }
      else if (action === 'swatch') setPickerColor(button.dataset.color);
      else if (action === 'remove-saved') { colorShelf.saved = colorShelf.saved.filter(color => color !== button.dataset.color); persistColorShelf(); paintColorPopover(); }
      else if (action === 'apply') closeColorPicker(true);
      else if (action === 'cancel') closeColorPicker(false);
      else if (action === 'save-color') {
        const index = colorShelf.saved.indexOf(activeColor.value);
        if (index >= 0) colorShelf.saved.splice(index, 1); else colorShelf.saved.unshift(activeColor.value);
        colorShelf.saved = colorShelf.saved.slice(0, 32); persistColorShelf(); paintColorPopover();
      } else if (action === 'create-palette') {
        const name = window.prompt('Name this color palette', 'My palette');
        if (!name?.trim()) return;
        const id = `p${Date.now().toString(36)}`;
        colorShelf.palettes.push({ id, name: name.trim().slice(0, 32), colors: [activeColor.value] });
        colorShelf.palettes = colorShelf.palettes.slice(-12); persistColorShelf(); paletteGroup = `palette:${id}`; paintColorPopover();
      } else if (action === 'add-to-palette') {
        const palette = colorShelf.palettes.find(item => `palette:${item.id}` === paletteGroup);
        if (palette && !palette.colors.includes(activeColor.value)) { palette.colors.push(activeColor.value); palette.colors = palette.colors.slice(0, 48); persistColorShelf(); paintColorPopover(); }
      } else if (action === 'copy' || action === 'copy-palette') {
        const value = action === 'copy-palette' ? activePaletteColors().map(([name, color]) => `${name}: ${color}`).join('\n') : button.dataset.valueFormat === 'rgb' ? colorToRgbText(activeColor.value) : button.dataset.valueFormat === 'hsl' ? colorToHslText(activeColor.value) : activeColor.value;
        try {
          if (!navigator.clipboard?.writeText) throw new Error('Clipboard access is unavailable in this browser.');
          navigator.clipboard.writeText(value).then(() => setColorMessage(action === 'copy-palette' ? 'Palette copied to clipboard.' : `Copied ${value}`), () => setColorMessage('Clipboard access is unavailable in this browser.'));
        } catch { setColorMessage('Clipboard access is unavailable in this browser.'); }
      } else if (action === 'screen-pick') {
        if (!window.isSecureContext || typeof window.EyeDropper !== 'function') { setColorMessage('Screen color picking requires a supported browser and a secure context (HTTPS or localhost).'); return; }
        let request;
        try { request = new window.EyeDropper().open(); }
        catch (error) { setColorMessage(`Screen color sampling could not start: ${error?.message || error?.name || 'browser error'}`); return; }
        request.then(result => {
          const sampled = normalizeHex(result?.sRGBHex);
          if (!sampled) { setColorMessage('The browser returned an invalid screen color.'); return; }
          setPickerColor(sampled);
          setColorMessage(`Selected ${sampled} from the screen.`);
        }, error => {
          if (error?.name === 'AbortError') setColorMessage('Screen pick cancelled.');
          else if (error?.name === 'SecurityError' || error?.name === 'NotAllowedError') setColorMessage('The browser blocked screen sampling. Use HTTPS or localhost and allow the screen-pick prompt.');
          else if (error?.name === 'NotSupportedError') setColorMessage('This browser cannot sample screen colors. Use a supported browser or enter a color value.');
          else setColorMessage(`Screen color sampling failed${error?.name ? ` (${error.name})` : ''}. Try again or enter a color value.`);
        });
      }
    });
    popover.addEventListener('input', event => {
      if (!activeColor) return;
      const target = event.target;
      if (target.matches('[data-nexus-color-entry]')) {
        const value = parseColorText(target.value, target.dataset.nexusColorEntry);
        target.setAttribute('aria-invalid', String(!value));
        if (value) setPickerColor(value, { preserveField: target.dataset.nexusColorEntry });
      } else if (target.matches('[data-nexus-color-slider]')) {
        activeColor.hsv[Number(target.dataset.nexusColorSlider)] = Number(target.value);
        setPickerColor(hsvToHex(...activeColor.hsv), { hsv: [...activeColor.hsv] });
      }
    });
    popover.addEventListener('change', event => {
      const target = event.target;
      if (target.matches('[data-nexus-color-entry]')) {
        const value = parseColorText(target.value, target.dataset.nexusColorEntry);
        if (value) setPickerColor(value); else target.setAttribute('aria-invalid', 'true');
      }
    });
    popover.addEventListener('pointerdown', event => {
      const plane = event.target.closest('[data-nexus-color-plane]');
      if (!plane || !activeColor) return;
      activeColor.dragPointer = event.pointerId; plane.setPointerCapture?.(event.pointerId); updateColorPlane(event, plane); event.preventDefault();
    });
    popover.addEventListener('pointermove', event => { if (activeColor?.dragPointer === event.pointerId) updateColorPlane(event, popover.querySelector('[data-nexus-color-plane]')); });
    popover.addEventListener('pointerup', event => { if (activeColor?.dragPointer === event.pointerId) activeColor.dragPointer = null; });
    popover.addEventListener('keydown', event => {
      const plane = event.target.closest('[data-nexus-color-plane]');
      if (!plane || !activeColor || !['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(event.key)) return;
      event.preventDefault(); const step = event.shiftKey ? 5 : 1;
      if (event.key === 'ArrowLeft') activeColor.hsv[1] -= step;
      if (event.key === 'ArrowRight') activeColor.hsv[1] += step;
      if (event.key === 'ArrowUp') activeColor.hsv[2] += step;
      if (event.key === 'ArrowDown') activeColor.hsv[2] -= step;
      activeColor.hsv[1] = Math.max(0, Math.min(100, activeColor.hsv[1])); activeColor.hsv[2] = Math.max(0, Math.min(100, activeColor.hsv[2]));
      setPickerColor(hsvToHex(...activeColor.hsv), { hsv: [...activeColor.hsv] });
    });
    return popover;
  };
  const setColorMessage = message => { const node = document.querySelector('[data-nexus-color-message]'); if (node) node.textContent = message; };
  const updateColorPlane = (event, plane) => {
    if (!activeColor || !plane) return;
    const rect = plane.getBoundingClientRect(); if (!rect.width || !rect.height) return;
    activeColor.hsv[1] = Math.round(Math.max(0, Math.min(1, (event.clientX - rect.left) / rect.width)) * 100);
    activeColor.hsv[2] = Math.round((1 - Math.max(0, Math.min(1, (event.clientY - rect.top) / rect.height))) * 100);
    setPickerColor(hsvToHex(...activeColor.hsv), { hsv: [...activeColor.hsv] });
  };
  const shadeTintColors = base => [
    [0.8, 'Tint 5'], [0.64, 'Tint 4'], [0.48, 'Tint 3'], [0.32, 'Tint 2'], [0.16, 'Tint 1']
  ].map(([amount, label]) => [label, mixColor(base, '#FFFFFF', amount)])
    .concat([['Base', base]])
    .concat([[0.16, 'Shade 1'], [0.32, 'Shade 2'], [0.48, 'Shade 3'], [0.64, 'Shade 4'], [0.8, 'Shade 5']].map(([amount, label]) => [label, mixColor(base, '#000000', amount)]));
  const activePaletteColors = () => {
    if (!activeColor) return [];
    if (paletteGroup === 'Shades & Tints') return shadeTintColors(activeColor.value);
    if (paletteGroup === 'Recent') return colorShelf.recent.map(color => [color, color]);
    if (paletteGroup === 'Saved') return colorShelf.saved.map(color => [color, color]);
    if (paletteGroup.startsWith('palette:')) return (colorShelf.palettes.find(item => `palette:${item.id}` === paletteGroup)?.colors || []).map(color => [color, color]);
    return palettes[paletteGroup] || palettes.NEXUS;
  };
  const colorSwatchesMarkup = (rows, savedMode) => rows.length ? `<div class="nexus-color-swatches">${rows.map(([name, color]) => `<div class="nexus-color-swatch-cell"><button type="button" data-nexus-color-action="swatch" data-color="${color}" style="--swatch:${color}" aria-label="Use ${escapeHTML(name)} ${color}" title="${escapeHTML(name)} · ${color}"${activeColor.value === color ? ' aria-pressed="true"' : ''}><i aria-hidden="true"></i><span class="nexus-color-swatch-label">${escapeHTML(name)} ${color}</span></button>${savedMode ? `<button type="button" data-nexus-color-action="remove-saved" data-color="${color}" aria-label="Remove ${color} from saved colors"><svg viewBox="0 0 16 16" fill="none" aria-hidden="true"><path d="m4 4 8 8M12 4l-8 8" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"/></svg></button>` : ''}</div>`).join('')}</div>` : '<p class="nexus-color-empty">No colors here yet. Save one or create a palette.</p>';
  const setPickerColor = (value, options = {}) => {
    const hex = normalizeHex(value);
    if (!hex || !activeColor) return;
    const popover = document.getElementById('nexusColorPickerPopover');
    activeColor.value = hex;
    activeColor.hsv = Array.isArray(options.hsv) && options.hsv.length === 3
      ? [((Number(options.hsv[0]) % 360) + 360) % 360, Math.max(0, Math.min(100, Number(options.hsv[1]))), Math.max(0, Math.min(100, Number(options.hsv[2])))]
      : rgbToHsv(hex);
    activeColor.input.value = hex;
    const swatch = activeColor.trigger.querySelector('.nexus-color-swatch'), label = activeColor.trigger.querySelector('.nexus-color-hex');
    if (swatch) swatch.style.backgroundColor = hex;
    if (label) label.textContent = hex;
    popover?.querySelectorAll('[data-nexus-color-slider]').forEach(slider => { const readout=slider.parentElement?.querySelector('small'); if(readout)readout.textContent=slider.dataset.nexusColorSlider==='0'?`${Math.round(activeColor.hsv[0])}°`:`${Math.round(activeColor.hsv[Number(slider.dataset.nexusColorSlider)])}%`; });
    activeColor.trigger.setAttribute('aria-label', `${labelFor(activeColor.input)} color ${hex}`);
    const preview = popover?.querySelector('[data-nexus-color-preview]');
    if (preview) { preview.style.backgroundColor = hex; preview.querySelector('strong').textContent = hex; }
    const plane = popover?.querySelector('[data-nexus-color-plane]');
    if (plane) { plane.style.setProperty('--picker-hue', `${Math.round(activeColor.hsv[0])}`); const cursor = plane.querySelector('i'); cursor.style.left = `${activeColor.hsv[1]}%`; cursor.style.top = `${100 - activeColor.hsv[2]}%`; plane.setAttribute('aria-valuenow', String(Math.round(activeColor.hsv[1]))); plane.setAttribute('aria-valuetext', `Saturation ${Math.round(activeColor.hsv[1])} percent, brightness ${Math.round(activeColor.hsv[2])} percent`); }
    popover?.querySelectorAll('[data-nexus-color-slider]').forEach(slider => { slider.value = String(Math.round(activeColor.hsv[Number(slider.dataset.nexusColorSlider)])); if (slider.dataset.nexusColorSlider === '0') slider.style.setProperty('--hue', `${Math.round(activeColor.hsv[0])}`); const readout=slider.parentElement?.querySelector('small');if(readout)readout.textContent=slider.dataset.nexusColorSlider==='0'?`${Math.round(activeColor.hsv[0])}°`:`${Math.round(activeColor.hsv[Number(slider.dataset.nexusColorSlider)])}%`; });
    popover?.querySelectorAll('[data-nexus-color-entry]').forEach(field => { if (field.dataset.nexusColorEntry === options.preserveField) return; field.value = field.dataset.nexusColorEntry === 'hex' ? hex : field.dataset.nexusColorEntry === 'rgb' ? colorToRgbText(hex) : colorToHslText(hex); field.removeAttribute('aria-invalid'); });
    popover?.querySelectorAll('[data-nexus-color-action="swatch"]').forEach(swatchButton => { if (swatchButton.dataset.color === hex) swatchButton.setAttribute('aria-pressed','true'); else swatchButton.removeAttribute('aria-pressed'); });
    if (paletteGroup === 'Shades & Tints') { const grid=popover?.querySelector('[data-nexus-color-palette]'); if(grid)grid.innerHTML=colorSwatchesMarkup(activePaletteColors(),false); }
    const whiteRatio = contrastRatio(hex, '#FFFFFF'), blackRatio = contrastRatio(hex, '#111318'), contrast = popover?.querySelector('[data-nexus-color-contrast]');
    if (contrast) { const ink = blackRatio >= whiteRatio ? '#111318' : '#FFFFFF', ratio = Math.max(whiteRatio, blackRatio); contrast.style.setProperty('--contrast-sample', ink); contrast.textContent = `Text on this color: ${ink} · ${ratio.toFixed(2)}:1 contrast`; contrast.dataset.wcag = ratio >= 4.5 ? 'pass' : 'review'; }
    const save = popover?.querySelector('[data-nexus-color-action="save-color"]');
    if (save) { const saved = colorShelf.saved.includes(hex); save.setAttribute('aria-pressed', String(saved)); save.textContent = saved ? '★ Saved color' : '☆ Save color'; }
    fire(activeColor.input, 'input');
  };
  const paintColorPopover = () => {
    if (!activeColor) return;
    const popover = colorPopover();
    const groups = colorShelfGroups();
    const rows = activePaletteColors();
    const savedMode = paletteGroup === 'Saved';
    const colors = colorSwatchesMarkup(rows, savedMode);
    const [h, s, v] = activeColor.hsv;
    const customPalette = paletteGroup.startsWith('palette:');
    popover.innerHTML = `<header class="nexus-color-head"><div><strong>Choose a color</strong><small>${escapeHTML(labelFor(activeColor.input))}</small></div><div class="nexus-color-head-actions"><button type="button" class="nexus-color-close icon-button" data-nexus-color-action="cancel" aria-label="Close color picker"><svg viewBox="0 0 20 20" fill="none" aria-hidden="true"><path d="m5.5 5.5 9 9m0-9-9 9" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg></button></div></header><div class="nexus-color-main"><div class="nexus-color-plane" data-nexus-color-plane role="slider" tabindex="0" aria-label="Saturation and brightness" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${Math.round(s)}" aria-valuetext="Saturation ${Math.round(s)} percent, brightness ${Math.round(v)} percent" style="--picker-hue:${Math.round(h)}"><i style="left:${s}%;top:${100 - v}%"></i></div><label class="nexus-color-hue-field"><span>Hue</span><input data-nexus-color-slider="0" type="range" min="0" max="360" value="${Math.round(h)}" aria-label="Hue"><small>${Math.round(h)}°</small></label><label class="nexus-color-slider-field"><span>Saturation</span><input data-nexus-color-slider="1" type="range" min="0" max="100" value="${Math.round(s)}" aria-label="Saturation"><small>${Math.round(s)}%</small></label><label class="nexus-color-slider-field"><span>Brightness</span><input data-nexus-color-slider="2" type="range" min="0" max="100" value="${Math.round(v)}" aria-label="Brightness"><small>${Math.round(v)}%</small></label></div><div class="nexus-color-value-row"><div class="nexus-color-live-preview" data-nexus-color-preview style="background:${activeColor.value}"><strong>${activeColor.value}</strong></div><div class="nexus-color-value-fields"><label>HEX<input data-nexus-color-entry="hex" value="${activeColor.value}" maxlength="7" spellcheck="false" aria-label="HEX color"></label><label>RGB<input data-nexus-color-entry="rgb" value="${colorToRgbText(activeColor.value)}" spellcheck="false" aria-label="RGB color"></label><label>HSL<input data-nexus-color-entry="hsl" value="${colorToHslText(activeColor.value)}" spellcheck="false" aria-label="HSL color"></label></div></div><div class="nexus-color-tool-row"><button type="button" class="button button-small" data-nexus-color-action="screen-pick">${window.isSecureContext && typeof window.EyeDropper === 'function' ? 'Pick from screen' : 'Screen picker unavailable'}</button><button type="button" class="button button-small" data-nexus-color-action="save-color" aria-pressed="${colorShelf.saved.includes(activeColor.value)}">${colorShelf.saved.includes(activeColor.value) ? '★ Saved color' : '☆ Save color'}</button><button type="button" class="button button-small" data-nexus-color-action="create-palette">New palette</button>${customPalette ? '<button type="button" class="button button-small" data-nexus-color-action="add-to-palette">Add color</button>' : ''}<button type="button" class="button button-small" data-nexus-color-action="copy-palette">Copy palette</button></div><div class="nexus-color-copy-row"><button type="button" data-nexus-color-action="copy" data-value-format="hex">Copy HEX</button><button type="button" data-nexus-color-action="copy" data-value-format="rgb">Copy RGB</button><button type="button" data-nexus-color-action="copy" data-value-format="hsl">Copy HSL</button></div><div class="nexus-color-contrast" data-nexus-color-contrast></div><nav class="nexus-color-tabs" aria-label="Color palettes">${groups.map(group => { const id = group.startsWith('palette:') ? group : group; const label = group.startsWith('palette:') ? colorShelf.palettes.find(item => `palette:${item.id}` === group)?.name || 'Palette' : group; return `<button type="button" data-nexus-color-action="group" data-group="${escapeHTML(id)}" aria-pressed="${paletteGroup === group}">${escapeHTML(label)}</button>`; }).join('')}</nav><div class="nexus-color-palette-heading"><strong>${escapeHTML(paletteGroup.startsWith('palette:') ? colorShelf.palettes.find(item => `palette:${item.id}` === paletteGroup)?.name || 'Palette' : paletteGroup)}</strong><small>${rows.length} colors</small></div> <div data-nexus-color-palette>${colors}</div><p class="nexus-color-message" data-nexus-color-message aria-live="polite">Solid colors are used by these theme controls; transparency is not supported by this color field.</p><footer class="nexus-color-foot"><button type="button" class="button button-quiet button-small" data-nexus-color-action="cancel">Cancel</button><button type="button" class="button button-primary button-small" data-nexus-color-action="apply">Use color</button></footer>`;
    popover.classList.remove('hidden');
    positionPopover(popover, activeColor.trigger);
    setPickerColor(activeColor.value);
  };
  const closeColorPicker = commit => {
    const popover = document.getElementById('nexusColorPickerPopover');
    const current = activeColor;
    if (!current) return;
    if (commit) {
      fire(current.input, 'change');
      colorShelf.recent = [current.value, ...colorShelf.recent.filter(color => color !== current.value)].slice(0, 12); persistColorShelf();
    } else {
      current.input.value = current.start;
      current.trigger.querySelector('.nexus-color-swatch').style.backgroundColor = current.start;
      current.trigger.querySelector('.nexus-color-hex').textContent = current.start;
      fire(current.input, 'input');
    }
    activeColor = null;
    popover?.classList.add('hidden');
  };
  const openColorPicker = (input, trigger) => {
    const value = normalizeHex(input.value) || '#4C68ED';
    activeColor = { input, trigger, value, start: value, hsv: rgbToHsv(value) };
    paletteGroup = 'NEXUS';
    paintColorPopover();
  };

  const enhanceInputs = root => {
    if (!root?.querySelectorAll) return;
    const dates = [...root.querySelectorAll(`${DATE_SELECTOR}:not([data-nexus-date-enhanced])`)];
    if (root.matches?.(`${DATE_SELECTOR}:not([data-nexus-date-enhanced])`)) dates.unshift(root);
    dates.forEach(input => {
      input.dataset.nexusDateEnhanced = 'true';
      const wrapper = document.createElement('span');
      wrapper.className = 'nexus-date-control';
      input.parentNode.insertBefore(wrapper, input);
      wrapper.append(input);
      input.classList.add('nexus-date-native');
      input.setAttribute('aria-hidden', 'true');
      input.tabIndex = -1;
      const trigger = document.createElement('button');
      trigger.type = 'button';
      trigger.className = 'nexus-date-trigger';
      trigger.setAttribute('aria-haspopup', 'dialog');
      trigger.setAttribute('aria-label', `${labelFor(input)}: ${input.value ? input.value.replace('T', ' ') : 'choose date'}`);
      trigger.innerHTML = `<span class="nexus-date-icon" aria-hidden="true"><svg viewBox="0 0 20 20" fill="none"><rect x="3" y="5" width="14" height="12" rx="2.5" stroke="currentColor" stroke-width="1.5"/><path d="M6.5 3.5v3M13.5 3.5v3M3 8.5h14" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/></svg></span><span class="nexus-date-value">${escapeHTML(input.value ? (input.type === 'datetime-local' ? `${displayDate(input.value.slice(0, 10))} · ${readTime(input.value)?.[1]}:${readTime(input.value)?.[2]}` : displayDate(input.value)) : 'Choose date')}</span><span class="nexus-date-chevron" aria-hidden="true">⌄</span>`;
      wrapper.append(trigger);
      trigger.disabled = input.disabled;
      trigger.addEventListener('click', () => openDatePicker(input, trigger));
    });
    const colors = [...root.querySelectorAll(`${COLOR_SELECTOR}:not([data-nexus-color-enhanced])`)];
    if (root.matches?.(`${COLOR_SELECTOR}:not([data-nexus-color-enhanced])`)) colors.unshift(root);
    colors.forEach(input => {
      input.dataset.nexusColorEnhanced = 'true';
      const wrapper = document.createElement('span');
      wrapper.className = 'nexus-color-control';
      input.parentNode.insertBefore(wrapper, input);
      wrapper.append(input);
      input.classList.add('nexus-color-native');
      input.setAttribute('aria-hidden', 'true');
      input.tabIndex = -1;
      const trigger = document.createElement('button');
      trigger.type = 'button';
      trigger.className = 'nexus-color-trigger';
      trigger.setAttribute('aria-haspopup', 'dialog');
      trigger.setAttribute('aria-label', `${labelFor(input)} color ${input.value}`);
      trigger.innerHTML = `<span class="nexus-color-swatch" style="background:${escapeHTML(input.value)}"></span><span class="nexus-color-hex">${escapeHTML(input.value.toUpperCase())}</span><span aria-hidden="true">⌄</span>`;
      wrapper.append(trigger);
      trigger.disabled = input.disabled;
      trigger.addEventListener('click', () => openColorPicker(input, trigger));
      input.addEventListener('input', () => {
        if (!trigger.isConnected) return;
        trigger.querySelector('.nexus-color-swatch').style.backgroundColor = input.value;
        trigger.querySelector('.nexus-color-hex').textContent = input.value.toUpperCase();
        trigger.setAttribute('aria-label', `${labelFor(input)} color ${input.value.toUpperCase()}`);
      });
    });
  };

  const updateCustomThemePreview = form => {
    const preview = form?.querySelector('#customThemePreview');
    if (!preview) return;
    const values = Object.fromEntries([...form.querySelectorAll('[data-theme-key]')].map(input => [input.dataset.themeKey, input.value]));
    const variables = { background: 'bg', surface: 'surface', panel: 'panel', sidebar: 'sidebar', header: 'header', text: 'text', textSecondary: 'text-secondary', textMuted: 'muted', border: 'border', primary: 'accent', secondary: 'secondary', accentSoft: 'accent-soft', green: 'green', greenSoft: 'green-soft', amber: 'amber', amberSoft: 'amber-soft', red: 'red', redSoft: 'red-soft', purple: 'purple' };
    Object.entries(variables).forEach(([key, variable]) => { if (values[key]) preview.style.setProperty(`--preview-${variable}`, values[key]); });
    if (values.primary) preview.style.setProperty('--preview-accent-ink', contrastTextFor(values.primary));
    const radius = form.querySelector('#customThemeRadius')?.value;
    if (radius) preview.style.setProperty('--preview-radius', `${radius}px`);
    preview.classList.toggle('no-shadow', !form.querySelector('#customThemeShadow')?.checked);
    const name = form.querySelector('#customThemeName')?.value.trim();
    const nameNode = preview.querySelector('[data-preview-theme-name]');
    if (nameNode) nameNode.textContent = name || 'Your custom theme';
  };

  document.addEventListener('input', event => {
    if (event.target.closest?.('#customThemeForm')) updateCustomThemePreview(event.target.closest('#customThemeForm'));
  });
  document.addEventListener('change', event => {
    if (event.target.closest?.('#customThemeForm')) updateCustomThemePreview(event.target.closest('#customThemeForm'));
  });
  document.addEventListener('pointerdown', event => {
    const date = document.getElementById('nexusDatePickerPopover');
    if (activeDate && !date?.contains(event.target) && !activeDate.trigger.contains(event.target)) closeDatePicker();
  });
  document.addEventListener('click', event => {
    const color = document.getElementById('nexusColorPickerPopover');
    if (activeColor && !color?.contains(event.target) && !activeColor.trigger.contains(event.target)) closeColorPicker(true);
  });
  document.addEventListener('keydown', event => {
    if (event.key === 'Escape' && activeDate) { event.preventDefault(); closeDatePicker(true); }
    else if (event.key === 'Escape' && activeColor) { event.preventDefault(); closeColorPicker(false); }
  });
  window.addEventListener('resize', () => {
    if (activeDate) positionPopover(datePopover(), activeDate.trigger);
    if (activeColor) positionPopover(colorPopover(), activeColor.trigger);
  });
  document.addEventListener('scroll', () => {
    if (activeDate) positionPopover(datePopover(), activeDate.trigger);
    if (activeColor) positionPopover(colorPopover(), activeColor.trigger);
  }, true);

  const observer = new MutationObserver(records => {
    // Rendering a page can insert several nested fragments at once. Reduce each
    // batch to its outermost added roots, and ignore the wrappers/popovers this
    // script creates. Otherwise wrapping a control queues another subtree scan
    // for every input and can stall large pages such as Date & Time tools.
    const roots = new Set();
    for (const record of records) for (const node of record.addedNodes) {
      if (node.nodeType !== Node.ELEMENT_NODE || node.closest?.('.nexus-date-control,.nexus-color-control,#nexusDatePickerPopover,#nexusColorPickerPopover')) continue;
      if (node.matches?.('.nexus-date-control,.nexus-color-control,#nexusDatePickerPopover,#nexusColorPickerPopover')) continue;
      if ([...roots].some(root => root === node || root.contains(node))) continue;
      for (const root of [...roots]) if (node.contains(root)) roots.delete(root);
      roots.add(node);
    }
    for (const root of roots) enhanceInputs(root);
    const form = document.getElementById('customThemeForm');
    if (form && !form.dataset.nexusPreviewBound) {
      form.dataset.nexusPreviewBound = 'true';
      updateCustomThemePreview(form);
    }
  });
  observer.observe(document.documentElement, { childList: true, subtree: true });
  enhanceInputs(document);
})();
