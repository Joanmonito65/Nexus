/* Local spreadsheet formula engine. No evaluation through eval() or remote services. */
(function (root, factory) {
  const engine = factory();
  if (typeof module === 'object' && module.exports) module.exports = engine;
  if (root) root.NexusSpreadsheetEngine = engine;
})(typeof window !== 'undefined' ? window : globalThis, function () {
  'use strict';

  const colToNumber = value => String(value).toUpperCase().replace(/\$/g, '').split('').reduce((n, c) => n * 26 + c.charCodeAt(0) - 64, 0);
  const numberToCol = value => { let n = Math.max(1, Number(value) || 1), out = ''; while (n) { const r = (n - 1) % 26; out = String.fromCharCode(65 + r) + out; n = Math.floor((n - 1) / 26); } return out; };
  const parseAddress = value => { const m = String(value).replace(/\$/g, '').match(/^([A-Z]+)(\d+)$/i); return m ? { row: Number(m[2]), col: colToNumber(m[1]), address: `${numberToCol(colToNumber(m[1]))}${Number(m[2])}` } : null; };
  const addressOf = (row, col) => `${numberToCol(col)}${row}`;
  const toCellMap = cells => {
    const out = {};
    for (const [key, value] of Object.entries(cells || {})) {
      const legacy = key.match(/^(\d+)-(\d+)$/);
      const address = legacy ? addressOf(Number(legacy[1]) + 1, Number(legacy[2]) + 1) : parseAddress(key)?.address;
      if (address) out[address] = value;
    }
    return out;
  };
  const normalizeWorkbook = item => {
    if (!Array.isArray(item.sheets) || !item.sheets.length) item.sheets = [{ id: `sheet-${Date.now()}`, name: 'Sheet 1', cells: toCellMap(item.cells || {}), styles: {}, hidden: false, color: '' }];
    item.sheets = item.sheets.map((sheet, i) => ({ id: sheet.id || `sheet-${i + 1}-${Date.now()}`, name: String(sheet.name || `Sheet ${i + 1}`), cells: toCellMap(sheet.cells || (i === 0 ? item.cells : {})), styles: sheet.styles || {}, hidden: !!sheet.hidden, color: sheet.color || '', frozenRows: Number(sheet.frozenRows) || 0, frozenCols: Number(sheet.frozenCols) || 0, hiddenRows: sheet.hiddenRows || [], hiddenCols: sheet.hiddenCols || [], merged: sheet.merged || [], filters: sheet.filters || {}, charts: sheet.charts || [], conditionalFormats: sheet.conditionalFormats || [] }));
    if (!item.sheets.some(s => s.id === item.activeSheetId && !s.hidden)) item.activeSheetId = item.sheets.find(s => !s.hidden)?.id || item.sheets[0].id;
    item.cells = item.sheets.find(s => s.id === item.activeSheetId)?.cells || item.sheets[0].cells;
    return item;
  };

  const tokenize = source => {
    const tokens = []; let i = 0;
    while (i < source.length) {
      if (/\s/.test(source[i])) { i++; continue; }
      const rest = source.slice(i);
      let m;
      if ((m = rest.match(/^"(?:[^"]|"")*"/))) { tokens.push({ type: 'string', value: m[0].slice(1, -1).replace(/""/g, '"') }); i += m[0].length; continue; }
      if (source[i] === "'") { let j = i + 1, value = ''; while (j < source.length) { if (source[j] === "'" && source[j + 1] === "'") { value += "'"; j += 2; continue; } if (source[j] === "'") break; value += source[j++]; } if (j >= source.length) throw new Error('#NAME?'); tokens.push({ type: 'quoted', value }); i = j + 1; continue; }
      if ((m = rest.match(/^\$?[A-Za-z]{1,3}\$?\d+(?![A-Za-z0-9_])(?!\s*\()/))) { tokens.push({ type: 'ref', value: m[0] }); i += m[0].length; continue; }
      if ((m = rest.match(/^(?:\d+(?:\.\d*)?|\.\d+)(?:[Ee][+-]?\d+)?/))) { tokens.push({ type: 'number', value: Number(m[0]) }); i += m[0].length; continue; }
      if ((m = rest.match(/^[A-Za-z_][A-Za-z0-9_.]*/))) { tokens.push({ type: 'name', value: m[0] }); i += m[0].length; continue; }
      if ((m = rest.match(/^(?:<=|>=|<>|!=|==)/))) { tokens.push({ type: 'op', value: m[0] }); i += m[0].length; continue; }
      if ('+-*/^&%=<>(),;:!'.includes(source[i])) { tokens.push({ type: 'op', value: source[i] }); i++; continue; }
      throw new Error('#NAME?');
    }
    tokens.push({ type: 'eof' }); return tokens;
  };
  const precedence = { '=': 1, '==': 1, '<>': 1, '!=': 1, '<': 1, '>': 1, '<=': 1, '>=': 1, '&': 2, '+': 3, '-': 3, '*': 4, '/': 4, '%': 4, '^': 5 };
  const parse = source => {
    const tokens = tokenize(source); let p = 0;
    const peek = () => tokens[p]; const take = () => tokens[p++];
    const primary = () => {
      const t = take();
      if (t.type === 'number' || t.type === 'string') return { kind: 'literal', value: t.value };
      if (t.type === 'op' && (t.value === '+' || t.value === '-')) return { kind: 'unary', op: t.value, value: primary() };
      if (t.type === 'op' && t.value === '(') { const x = expression(0); if (take().value !== ')') throw new Error('#ERROR!'); return x; }
      if (t.type === 'ref' || t.type === 'name' || t.type === 'quoted') {
        let sheet = null, refToken = t;
        if ((t.type === 'name' || t.type === 'quoted') && peek().value === '!') { take(); sheet = t.value; refToken = take(); if (refToken.type !== 'ref') throw new Error('#REF!'); }
        else if (t.type === 'name' && peek().value === '(') {
          take(); const args = []; if (peek().value !== ')') { do { args.push(expression(0)); if (peek().value !== ',' && peek().value !== ';') break; take(); } while (true); }
          if (take().value !== ')') throw new Error('#ERROR!'); return { kind: 'call', name: t.value.toUpperCase(), args };
        } else if (t.type !== 'ref') return { kind: 'literal', value: t.value.toUpperCase() === 'TRUE' ? true : t.value.toUpperCase() === 'FALSE' ? false : t.value };
        const start = { kind: 'ref', address: refToken.value, sheet };
        if (peek().value === ':') { take(); let endSheet = sheet, endToken = take(); if ((endToken.type === 'name' || endToken.type === 'quoted') && peek().value === '!') { endSheet = endToken.value; take(); endToken = take(); } if (endToken.type !== 'ref') throw new Error('#REF!'); return { kind: 'range', start, end: { kind: 'ref', address: endToken.value, sheet: endSheet } }; }
        return start;
      }
      throw new Error('#ERROR!');
    };
    const expression = min => {
      let left = primary();
      while (peek().type === 'op' && precedence[peek().value] >= min) { const op = take().value, prec = precedence[op], right = expression(prec + (op === '^' ? 0 : 1)); left = { kind: 'binary', op, left, right }; }
      if (min === 0 && peek().value === '%') { take(); left = { kind: 'percent', value: left }; }
      return left;
    };
    const ast = expression(0); if (peek().type !== 'eof') throw new Error('#ERROR!'); return ast;
  };

  const isError = value => typeof value === 'string' && /^#(?:REF!|VALUE!|DIV\/0!|NAME\?|N\/A|NUM!|NULL!|CIRCULAR!|ERROR!|SPILL!)/.test(value);
  const truthy = value => typeof value === 'string' ? value.length > 0 && value.toUpperCase() !== 'FALSE' && value !== '0' : !!value;
  const number = value => { if (typeof value === 'number') return value; if (value === true) return 1; if (value === false || value == null || value === '') return 0; const n = Number(value); return Number.isFinite(n) ? n : NaN; };
  const flatten = value => Array.isArray(value) ? value.flat(Infinity) : [value];
  const text = value => value == null ? '' : value instanceof Date ? value.toISOString() : String(value);
  const dateSerial = d => Math.floor((Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()) - Date.UTC(1899, 11, 30)) / 86400000);
  const fromSerial = n => new Date(Date.UTC(1899, 11, 30) + Number(n) * 86400000);
  const criteriaMatch = (value, criteria) => { const s = String(criteria ?? ''); const m = s.match(/^(<=|>=|<>|!=|=|<|>)(.*)$/); const op = m?.[1] || '='; const rhs = m ? m[2] : s; const a = number(value), b = number(rhs); const cmp = Number.isFinite(a) && Number.isFinite(b) ? (a < b ? -1 : a > b ? 1 : 0) : String(value ?? '').toLowerCase().localeCompare(rhs.toLowerCase()); return ({ '=': cmp === 0 || String(value ?? '').toLowerCase() === rhs.toLowerCase(), '==': cmp === 0, '<>': cmp !== 0, '!=': cmp !== 0, '<': cmp < 0, '>': cmp > 0, '<=': cmp <= 0, '>=': cmp >= 0 })[op] ?? false; };
  const evaluate = (raw, workbook, sheetId, address, stack = new Set()) => {
    if (raw == null || raw === '') return '';
    const source = String(raw); if (!source.startsWith('=')) return raw;
    const currentSheet = workbook.sheets.find(s => s.id === sheetId) || workbook.sheets[0];
    const currentRef = parseAddress(address || 'A1');
    const resolveSheet = name => workbook.sheets.find(s => s.name.toLowerCase() === String(name).toLowerCase() || s.id === name) || null;
    const getRef = ref => {
      const s = ref.sheet ? resolveSheet(ref.sheet) : currentSheet; if (!s) return '#REF!';
      const addr = parseAddress(ref.address); if (!addr || addr.row < 1 || addr.col < 1) return '#REF!';
      const key = `${s.id}!${addr.address}`; if (stack.has(key)) return '#CIRCULAR!';
      const value = s.cells?.[addr.address]; if (typeof value === 'string' && value.startsWith('=')) { const next = new Set(stack); next.add(key); return evaluate(value, workbook, s.id, addr.address, next); }
      return value ?? '';
    };
    const getRange = node => {
      const s = (node.start.sheet || node.end.sheet) ? resolveSheet(node.start.sheet || node.end.sheet) : currentSheet; if (!s) return '#REF!';
      const a = parseAddress(node.start.address), b = parseAddress(node.end.address); if (!a || !b) return '#REF!';
      const r1=Math.min(a.row,b.row),r2=Math.max(a.row,b.row),c1=Math.min(a.col,b.col),c2=Math.max(a.col,b.col),rows=[];
      for (let r=r1;r<=r2&&r-r1<2000;r++) { const row=[]; for (let c=c1;c<=c2&&c-c1<200;c++) row.push(getRef({address:addressOf(r,c),sheet:s.id})); rows.push(row); }
      return rows;
    };
    const calc = node => {
      if (node.kind === 'literal') return node.value;
      if (node.kind === 'ref') return getRef(node);
      if (node.kind === 'range') return getRange(node);
      if (node.kind === 'percent') { const v=calc(node.value); return isError(v)?v:number(v)/100; }
      if (node.kind === 'unary') { const v=calc(node.value); if(isError(v))return v; const n=number(v);return Number.isFinite(n)?(node.op==='-'?-n:n):'#VALUE!'; }
      if (node.kind === 'binary') {
        const a=calc(node.left); if(isError(a))return a; const b=calc(node.right); if(isError(b))return b;
        if(node.op==='&')return text(a)+text(b);
        if(['=','==','<>','!=','<','>','<=','>='].includes(node.op)){const na=number(a),nb=number(b),cmp=Number.isFinite(na)&&Number.isFinite(nb)?(na<nb?-1:na>nb?1:0):String(a).toLowerCase().localeCompare(String(b).toLowerCase());return ({'=':cmp===0,'==':cmp===0,'<>':cmp!==0,'!=':cmp!==0,'<':cmp<0,'>':cmp>0,'<=':cmp<=0,'>=':cmp>=0})[node.op];}
        const na=number(a),nb=number(b);if(!Number.isFinite(na)||!Number.isFinite(nb))return '#VALUE!';
        if(node.op==='+')return na+nb;if(node.op==='-')return na-nb;if(node.op==='*')return na*nb;if(node.op==='/')return nb===0?'#DIV/0!':na/nb;if(node.op==='%')return nb===0?'#DIV/0!':na%nb;if(node.op==='^'){const x=na**nb;return Number.isFinite(x)?x:'#NUM!';}
      }
      if (node.kind === 'call') {
        const fn=node.name, args=node.args;
        const rawArg=i=>i<args.length?calc(args[i]):'';
        if(fn==='IF'){const c=rawArg(0);if(isError(c))return c;return truthy(c)?rawArg(1):(args.length>2?rawArg(2):false);}
        if(fn==='IFS'){for(let i=0;i+1<args.length;i+=2){const c=rawArg(i);if(isError(c))return c;if(truthy(c))return rawArg(i+1);}return '#N/A';}
        if(fn==='IFERROR'||fn==='IFNA'){const v=rawArg(0);return isError(v)&&(fn==='IFERROR'||v==='#N/A')?(args.length>1?rawArg(1):''):v;}
        if(fn==='AND'||fn==='OR'){let result=fn==='AND';for(let i=0;i<args.length;i++){const v=rawArg(i);if(isError(v))return v;if(fn==='AND'&&!truthy(v))return false;if(fn==='OR'&&truthy(v))return true;}return result;}
        if(fn==='NOT'){const v=rawArg(0);return isError(v)?v:!truthy(v);}
        const values=args.map((_,i)=>rawArg(i));for(const v of values)if(isError(v))return v;
        const flat=values.flatMap(flatten), nums=flat.map(number).filter(Number.isFinite), one=values[0], n0=number(one), str0=text(one);
        const sum=xs=>xs.map(number).filter(Number.isFinite).reduce((a,b)=>a+b,0);
        switch(fn){
          case 'SUM':return sum(flat);
          case 'AVERAGE':return nums.length?sum(nums)/nums.length:'#DIV/0!';
          case 'MIN':return nums.length?Math.min(...nums):0;
          case 'MAX':return nums.length?Math.max(...nums):0;
          case 'COUNT':return flat.filter(v=>typeof v==='number'||(String(v).trim()!==''&&Number.isFinite(Number(v)))).length;
          case 'COUNTA':return flat.filter(v=>v!==''&&v!=null).length;
          case 'ROUND':{if(!Number.isFinite(n0))return '#VALUE!';const digits=Math.max(-12,Math.min(12,Math.trunc(number(values[1])||0)));const factor=10**Math.abs(digits);return digits>=0?Number(n0.toFixed(digits)):Math.round(n0/factor)*factor;}
          case 'ROUNDUP':case 'ROUNDDOWN':{if(!Number.isFinite(n0))return '#VALUE!';const p=10**(number(values[1])||0);return (fn==='ROUNDUP'?Math.sign(n0)*Math.ceil(Math.abs(n0*p)):Math.trunc(n0*p))/p;}
          case 'ABS':return Math.abs(n0);case 'MOD':return number(values[1])===0?'#DIV/0!':n0%number(values[1]);case 'POWER':return n0**number(values[1]);case 'SQRT':return n0<0?'#NUM!':Math.sqrt(n0);
          case 'SUMIF':case 'AVERAGEIF':case 'COUNTIF':{const range=flatten(values[0]),criteria=values[1],sumRange=fn==='COUNTIF'?range:flatten(values[2]??values[0]),picked=[];for(let i=0;i<range.length;i++)if(criteriaMatch(range[i],criteria))picked.push(sumRange[i]??0);return fn==='COUNTIF'?picked.length:fn==='SUMIF'?sum(picked):(picked.length?sum(picked)/picked.length:'#DIV/0!');}
          case 'SUMIFS':case 'COUNTIFS':case 'AVERAGEIFS':{const sumRange=fn==='COUNTIFS'?null:flatten(values[0]),start=fn==='COUNTIFS'?0:1;if((values.length-start)%2!==0)return '#VALUE!';const len=flatten(values[start]).length, picked=[];for(let i=0;i<len;i++){let ok=true;for(let j=start;j<values.length;j+=2)if(!criteriaMatch(flatten(values[j])[i],values[j+1])){ok=false;break;}if(ok)picked.push(fn==='COUNTIFS'?1:(sumRange?.[i]??0));}return fn==='COUNTIFS'?picked.length:fn==='SUMIFS'?sum(picked):(picked.length?sum(picked)/picked.length:'#DIV/0!');}
          case 'CONCAT':case 'CONCATENATE':return flat.map(text).join('');case 'TEXTJOIN':{const delim=text(values[0]),ignore=truthy(values[1]);return flat.slice(2).filter(v=>!ignore||v!=='').map(text).join(delim);}
          case 'LEFT':return str0.slice(0,Math.max(0,number(values[1])||1));case 'RIGHT':return str0.slice(-Math.max(0,number(values[1])||1));case 'MID':return str0.slice(Math.max(0,number(values[1])-1),Math.max(0,number(values[1])-1)+Math.max(0,number(values[2])));case 'LEN':return str0.length;case 'TRIM':return str0.trim().replace(/\s+/g,' ');case 'UPPER':return str0.toUpperCase();case 'LOWER':return str0.toLowerCase();case 'PROPER':return str0.toLowerCase().replace(/\b\w/g,c=>c.toUpperCase());
          case 'SUBSTITUTE':return str0.split(text(values[1])).join(text(values[2]));case 'FIND':case 'SEARCH':{const hay=fn==='SEARCH'?str0.toLowerCase():str0,needle=fn==='SEARCH'?text(values[1]).toLowerCase():text(values[1]),pos=hay.indexOf(needle,(number(values[2])||1)-1);return pos<0?'#VALUE!':pos+1;}
          case 'TEXT':{const fmt=text(values[1]);if(fmt.includes('%'))return `${(n0*100).toFixed((fmt.split('.')[1]||'').replace(/[^0#]/g,'').length)}%`;const decimals=(fmt.split('.')[1]||'').replace(/[^0#]/g,'').length;return Number.isFinite(n0)?n0.toFixed(decimals):str0;}
          case 'TODAY':{const d=new Date(),today=new Date(Date.UTC(d.getFullYear(),d.getMonth(),d.getDate()));return dateSerial(today);}case 'NOW':return (Date.now()-Date.UTC(1899,11,30))/86400000;
          case 'DATE':{const d=new Date(Date.UTC(number(values[0]),number(values[1])-1,number(values[2])));return dateSerial(d);}case 'YEAR':return fromSerial(n0).getUTCFullYear();case 'MONTH':return fromSerial(n0).getUTCMonth()+1;case 'DAY':return fromSerial(n0).getUTCDate();case 'HOUR':return Math.floor((n0%1)*24);case 'MINUTE':return Math.floor((n0*1440)%60);case 'SECOND':return Math.floor((n0*86400)%60);case 'WEEKDAY':{const type=number(values[1])||1,d=fromSerial(n0).getUTCDay();return type===2?(d+6)%7+1:type===3?(d+6)%7:d+1;}case 'EOMONTH':{const d=fromSerial(n0);return dateSerial(new Date(Date.UTC(d.getUTCFullYear(),d.getUTCMonth()+1+number(values[1]),0)));}
          case 'DATEDIF':{const a=fromSerial(number(values[0])),b=fromSerial(number(values[1])),unit=text(values[2]).toUpperCase();if(b<a)return '#NUM!';if(unit==='D')return Math.floor((b-a)/86400000);if(unit==='M')return (b.getUTCFullYear()-a.getUTCFullYear())*12+b.getUTCMonth()-a.getUTCMonth()-(b.getUTCDate()<a.getUTCDate()?1:0);if(unit==='Y')return b.getUTCFullYear()-a.getUTCFullYear()-(b.getUTCMonth()<a.getUTCMonth()||(b.getUTCMonth()===a.getUTCMonth()&&b.getUTCDate()<a.getUTCDate())?1:0);return '#VALUE!';}
          case 'VLOOKUP':case 'HLOOKUP':case 'XLOOKUP':{const matrix=values[1],rows=Array.isArray(matrix)?matrix:[[matrix]],needle=values[0];if(fn==='XLOOKUP'){const look=flatten(values[1]),ret=flatten(values[2]??values[1]),idx=look.findIndex(v=>String(v)===String(needle));return idx<0?(values[3]??'#N/A'):(ret[idx]??'#N/A');}const idx=Math.max(1,number(values[2])||1)-1,exact=values.length>=4&&(values[3]===false||values[3]===0);if(fn==='VLOOKUP'){let found=null;for(const row of rows){const match=exact?String(row[0])===String(needle):number(row[0])<=number(needle);if(match){if(exact)return row[idx]??'#REF!';found=row[idx];}}return found??'#N/A';}let found=null;const header=rows[0]||[];for(let c=0;c<header.length;c++){const match=exact?String(header[c])===String(needle):number(header[c])<=number(needle);if(match){if(exact)return rows[idx]?.[c]??'#REF!';found=rows[idx]?.[c];}}return found??'#N/A';}
          case 'INDEX':{const matrix=Array.isArray(one)?one:[[one]],r=Math.max(1,number(values[1])||1)-1,c=Math.max(1,number(values[2])||1)-1;return matrix[r]?.[c]??'#REF!';}
          case 'MATCH':{const arr=flatten(values[1]),mode=number(values[2])||0;let i=arr.findIndex(v=>String(v)===String(one));if(i<0&&mode!==0){for(let j=0;j<arr.length;j++)if(number(arr[j])<=number(one))i=j;}return i<0?'#N/A':i+1;}
          case 'CHOOSE':return values[Math.trunc(n0)]??'#VALUE!';case 'ROW':return currentRef?.row||1;case 'COLUMN':return currentRef?.col||1;
          default:return `#NAME? (${fn} is not supported)`;
        }
      }
      return '#ERROR!';
    };
    try { const result=calc(parse(source.slice(1))); return typeof result==='number'&&Number.isFinite(result)?String(Number(result.toPrecision(12))):result; }
    catch (err) { return typeof err.message==='string'&&err.message.startsWith('#')?err.message:'#ERROR!'; }
  };

  const translateFormula = (formula, rowDelta, colDelta) => {
    const chunks=String(formula||'').split(/("(?:[^"]|"")*")/g);
    return chunks.map((chunk,i)=>i%2?chunk:chunk.replace(/((?:'(?:[^']|'')+'|[A-Za-z_][A-Za-z0-9_ ]*)!)?(\$?)([A-Za-z]{1,3})(\$?)(\d+)(?![A-Za-z0-9_])(?!\s*\()/g,(all,sheet,absCol,col,absRow,row)=>{
      const c=absCol?colToNumber(col):colToNumber(col)+colDelta,r=absRow?Number(row):Number(row)+rowDelta;if(c<1||r<1)return '#REF!';return `${sheet||''}${absCol?'$':''}${numberToCol(c)}${absRow?'$':''}${r}`;
    })).join('');
  };
  return { colToNumber, numberToCol, parseAddress, addressOf, toCellMap, normalizeWorkbook, evaluate, translateFormula, parse };
});
