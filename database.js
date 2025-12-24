// ============================================
// MÓDULO DE BASE DE DATOS Y REGISTROS CON SUPABASE
// ============================================

// ============================================
// MÓDULO DE BASE DE DATOS Y REGISTROS CON SUPABASE
// ============================================

class PlacaValidator {
    static normalizarPlaca(placa) {
        if (!placa || typeof placa !== 'string') return "";
        
        // Elimina TODOS los caracteres no alfanuméricos (guiones, espacios, puntos, etc.)
        // y convierte a mayúsculas
        let normalizada = placa
            .toUpperCase()
            .replace(/[^A-Z0-9]/g, '')  // Elimina todo excepto letras A-Z y números 0-9
            .trim();
        
        return normalizada;
    }
    
    static agregarGuionPlaca(placa) {
        if (!placa || typeof placa !== 'string') return placa;
        
        const normalizada = this.normalizarPlaca(placa);
        
        // Si tiene al menos 4 caracteres, intenta agregar guión después del 4to carácter
        if (normalizada.length >= 4) {
            // Busca donde están los números y letras
            const numeros = normalizada.match(/^\d+/);
            if (numeros && numeros[0].length >= 1) {
                const longitudNumeros = numeros[0].length;
                // Agrega guión después de los números
                return normalizada.substring(0, longitudNumeros) + '-' + normalizada.substring(longitudNumeros);
            }
        }
        
        return normalizada;
    }
    
    static generarVariantesBusqueda(placa) {
        const variantes = new Set();
        
        if (!placa || typeof placa !== 'string') return Array.from(variantes);
        
        // 1. Placa original
        variantes.add(placa.toUpperCase().trim());
        
        // 2. Placa normalizada (sin guiones)
        const normalizada = this.normalizarPlaca(placa);
        variantes.add(normalizada);
        
        // 3. Placa con guión
        const conGuion = this.agregarGuionPlaca(placa);
        variantes.add(conGuion);
        
        // 4. Si ya tiene guión, también probar sin él
        if (placa.includes('-')) {
            const sinGuion = placa.replace(/-/g, '');
            variantes.add(sinGuion.toUpperCase());
        }
        
        // Filtrar valores vacíos
        return Array.from(variantes).filter(v => v && v.length > 0);
    }
    
    static validarFormatoPlaca(placa) {
        if (!placa || placa.trim().length < 2) return false;
        
        const normalizada = this.normalizarPlaca(placa);
        return normalizada.length >= 2 && normalizada.length <= 10;
    }
    
    static compararPlacas(placa1, placa2) {
        // Comparación simple: normaliza ambas y compara
        const normalizada1 = this.normalizarPlaca(placa1);
        const normalizada2 = this.normalizarPlaca(placa2);
        
        return normalizada1 === normalizada2;
    }
}

class Placa {
    constructor(id, placa, empresa, asociacion, created_at, usuario_registro) {
        this.id = id || Date.now();
        this.placa = placa;
        this.empresa = empresa || "";
        this.asociacion = asociacion || "";
        this.created_at = created_at || new Date().toISOString();
        this.usuario_registro = usuario_registro || "Sistema";
        this.normalizada = PlacaValidator.normalizarPlaca(placa);
    }
    
    toTableRow() {
        return {
            id: this.id,
            placa: this.placa,
            empresa: this.empresa,
            asociacion: this.asociacion,
            created_at: this.created_at,
            usuario_registro: this.usuario_registro,
            normalizada: this.normalizada
        };
    }
    
    toSupabaseFormat() {
        return {
            placa: this.placa,
            empresa: this.empresa,
            asociacion: this.asociacion,
            usuario_registro: this.usuario_registro,
            created_at: this.created_at
        };
    }
}

class ExcelManager {
    constructor() {
        if (typeof XLSX === 'undefined') {
            throw new Error('SheetJS (XLSX) no está cargado.');
        }
    }
    
    async leerArchivoExcel(archivo) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            
            reader.onload = (e) => {
                try {
                    const data = e.target.result;
                    const workbook = XLSX.read(data, {
                        type: 'binary',
                        cellDates: true,
                        cellText: false
                    });
                    
                    resolve(workbook);
                } catch (error) {
                    reject(new Error(`Error al leer el archivo Excel: ${error.message}`));
                }
            };
            
            reader.onerror = () => {
                reject(new Error('Error al leer el archivo'));
            };
            
            reader.readAsBinaryString(archivo);
        });
    }
    
    obtenerHojasDisponibles(workbook) {
        return workbook.SheetNames.map(name => ({
            name: name,
            sheet: workbook.Sheets[name]
        }));
    }
    
    leerDatosDeHoja(sheet, options = {}) {
        const defaultOptions = {
            range: null,
            header: 1,
            blankrows: false,
            defval: ''
        };
        
        const config = { ...defaultOptions, ...options };
        let jsonData = XLSX.utils.sheet_to_json(sheet, config);
        
        const datos = [];
        
        jsonData.forEach((fila, index) => {
            const placa = fila[0] || "";
            const empresa = fila[1] || "";
            const asociacion = fila[2] || "";
            
            if (placa && placa.toString().trim()) {
                datos.push({
                    placa: placa.toString().trim(),
                    empresa: empresa.toString().trim(),
                    asociacion: asociacion.toString().trim(),
                    rowNumber: index + 1
                });
            }
        });
        
        return datos;
    }
    
    crearWorkbookDesdeDatos(datos) {
        const rows = [];
        
        rows.push(['PLACA', 'EMPRESA', 'ASOCIACIÓN', 'FECHA REGISTRO', 'USUARIO']);
        
        datos.forEach(placa => {
            rows.push([
                placa.placa,
                placa.empresa,
                placa.asociacion,
                placa.created_at ? new Date(placa.created_at).toLocaleString('es-ES') : '',
                placa.usuario_registro || 'Sistema'
            ]);
        });
        
        const worksheet = XLSX.utils.aoa_to_sheet(rows);
        
        const columnWidths = [
            { wch: 15 },
            { wch: 30 },
            { wch: 30 },
            { wch: 20 },
            { wch: 20 }
        ];
        worksheet['!cols'] = columnWidths;
        
        const workbook = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(workbook, worksheet, 'Placas');
        
        return workbook;
    }
    
    descargarWorkbook(workbook, nombreArchivo) {
        const excelBuffer = XLSX.write(workbook, {
            bookType: 'xlsx',
            type: 'binary'
        });
        
        const blob = new Blob([this.s2ab(excelBuffer)], {
            type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
        });
        
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = nombreArchivo || `placas_${new Date().toISOString().slice(0, 10)}.xlsx`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        
        setTimeout(() => URL.revokeObjectURL(url), 100);
    }
    
    s2ab(s) {
        const buf = new ArrayBuffer(s.length);
        const view = new Uint8Array(buf);
        for (let i = 0; i < s.length; i++) {
            view[i] = s.charCodeAt(i) & 0xFF;
        }
        return buf;
    }
}

class MultiUserDatabase {
    constructor(supabaseManager = null) {
        this.dbName = 'placas_multi_usuario';
        this.storeName = 'placas';
        this.supabaseManager = supabaseManager;
        this.useSupabase = false;
        this.excelManager = new ExcelManager();
        this.placaEditando = null;
        this.cachePlacas = null;
        this.cacheTimestamp = null;
        this.CACHE_DURATION = 5 * 60 * 1000; // 5 minutos
        this.init();
    }
    
    async init() {
        // Verificar si tenemos SupabaseManager
        if (this.supabaseManager) {
            this.useSupabase = this.supabaseManager.isConnected;
            if (this.useSupabase) {
                console.log('✅ Usando Supabase como backend');
                return;
            }
        }
        
        // Fallback a IndexedDB/LocalStorage
        if (!window.indexedDB) {
            console.warn('IndexedDB no soportado, usando localStorage como fallback');
            this.useLocalStorage = true;
            this.ensureLocalStorage();
        } else {
            await this.initIndexedDB();
        }
    }
    
    async initIndexedDB() {
        return new Promise((resolve, reject) => {
            const request = indexedDB.open(this.dbName, 1);
            
            request.onerror = (event) => {
                console.error('Error abriendo IndexedDB:', event.target.error);
                this.useLocalStorage = true;
                this.ensureLocalStorage();
                resolve();
            };
            
            request.onsuccess = (event) => {
                this.db = event.target.result;
                console.log('IndexedDB conectado (modo local)');
                resolve();
            };
            
            request.onupgradeneeded = (event) => {
                const db = event.target.result;
                if (!db.objectStoreNames.contains(this.storeName)) {
                    const store = db.createObjectStore(this.storeName, { keyPath: 'id', autoIncrement: true });
                    store.createIndex('placa', 'placa', { unique: true });
                    store.createIndex('empresa', 'empresa', { unique: false });
                }
            };
        });
    }
    
    ensureLocalStorage() {
        if (!localStorage.getItem(this.dbName)) {
            localStorage.setItem(this.dbName, JSON.stringify([]));
        }
    }
    
    // NUEVO: Método para obtener TODAS las placas con caché
    async obtenerTodasPlacasConCache() {
        // Verificar si el caché es válido
        const ahora = Date.now();
        if (this.cachePlacas && this.cacheTimestamp && (ahora - this.cacheTimestamp) < this.CACHE_DURATION) {
            console.log(`📦 Usando caché de ${this.cachePlacas.length} placas`);
            return this.cachePlacas;
        }
        
        console.log('🔄 Actualizando caché de placas...');
        const todasLasPlacas = await this.buscarPlacas();
        this.cachePlacas = todasLasPlacas;
        this.cacheTimestamp = ahora;
        
        console.log(`✅ Caché actualizado: ${todasLasPlacas.length} placas`);
        return todasLasPlacas;
    }
    
    async insertarPlaca(placa, empresa, asociacion, usuario = 'Sistema') {
        const nuevaPlaca = new Placa(null, placa, empresa, asociacion, new Date().toISOString(), usuario);
        
        // Si está conectado a Supabase, usar ese backend
        if (this.useSupabase && this.supabaseManager) {
            try {
                const resultado = await this.supabaseManager.insertPlaca({
                    placa: placa,
                    empresa: empresa,
                    asociacion: asociacion,
                    usuario: usuario
                });
                
                if (resultado) {
                    nuevaPlaca.id = resultado.id;
                    // Invalidar caché
                    this.cachePlacas = null;
                    return nuevaPlaca;
                }
            } catch (error) {
                console.error('Error insertando en Supabase:', error);
            }
        }
        
        // Fallback a almacenamiento local
        if (this.useLocalStorage) {
            const datos = JSON.parse(localStorage.getItem(this.dbName) || '[]');
            
            const existe = datos.some(p => 
                PlacaValidator.compararPlacas(p.placa, placa)
            );
            
            if (existe) {
                throw new Error(`La placa ${placa} ya existe en la base de datos`);
            }
            
            datos.push(nuevaPlaca);
            localStorage.setItem(this.dbName, JSON.stringify(datos));
        } else {
            return new Promise((resolve, reject) => {
                const transaction = this.db.transaction([this.storeName], 'readwrite');
                const store = transaction.objectStore(this.storeName);
                
                const request = store.add(nuevaPlaca);
                
                request.onsuccess = () => {
                    nuevaPlaca.id = request.result;
                    // Invalidar caché
                    this.cachePlacas = null;
                    resolve(nuevaPlaca);
                };
                
                request.onerror = (event) => {
                    if (event.target.error.name === 'ConstraintError') {
                        reject(new Error(`La placa ${placa} ya existe en la base de datos`));
                    } else {
                        reject(new Error('Error al insertar placa: ' + event.target.error));
                    }
                };
            });
        }
        
        return nuevaPlaca;
    }
    
    async buscarPlacas(termino = null) {
        console.log(`🔍 Buscando placas con término: "${termino}"`);
        
        // Si está conectado a Supabase, usar ese backend
        if (this.useSupabase && this.supabaseManager) {
            try {
                let datosSupabase;
                
                if (termino && termino.trim() !== '') {
                    const terminoNormalizado = PlacaValidator.normalizarPlaca(termino);
                    console.log(`🔍 Búsqueda en Supabase con término normalizado: "${terminoNormalizado}"`);
                    
                    // Búsqueda flexible en Supabase
                    datosSupabase = await this.supabaseManager.searchPlacasFlexible(terminoNormalizado);
                    
                    // Si no encuentra, intenta con el término original
                    if (!datosSupabase || datosSupabase.length === 0) {
                        console.log(`🔄 No se encontraron resultados con término normalizado, intentando con original: "${termino}"`);
                        datosSupabase = await this.supabaseManager.searchPlacasFlexible(termino);
                    }
                } else {
                    // Obtener TODAS las placas sin límite
                    datosSupabase = await this.supabaseManager.getAllPlacasCompleto();
                }
                
                console.log(`✅ Encontradas ${datosSupabase.length} placas en Supabase`);
                
                return datosSupabase.map(p => new Placa(
                    p.id, 
                    p.placa, 
                    p.empresa, 
                    p.asociacion,
                    p.created_at,
                    p.usuario_registro
                ));
            } catch (error) {
                console.error('Error buscando en Supabase:', error);
                return [];
            }
        }
        
        // Fallback a almacenamiento local
        if (this.useLocalStorage) {
            let datos = JSON.parse(localStorage.getItem(this.dbName) || '[]');
            
            if (termino && termino.trim() !== '') {
                const terminoNormalizado = PlacaValidator.normalizarPlaca(termino);
                const terminoMinusculas = termino.toLowerCase();
                
                datos = datos.filter(p => {
                    const placaNormalizada = PlacaValidator.normalizarPlaca(p.placa);
                    return (
                        placaNormalizada.includes(terminoNormalizado) ||
                        (p.empresa && p.empresa.toLowerCase().includes(terminoMinusculas)) ||
                        (p.asociacion && p.asociacion.toLowerCase().includes(terminoMinusculas))
                    );
                });
            }
            
            return datos.map(p => new Placa(p.id, p.placa, p.empresa, p.asociacion, p.created_at, p.usuario_registro));
        } else {
            return new Promise((resolve, reject) => {
                const transaction = this.db.transaction([this.storeName], 'readonly');
                const store = transaction.objectStore(this.storeName);
                const request = store.getAll();
                
                request.onsuccess = () => {
                    let datos = request.result;
                    
                    if (termino && termino.trim() !== '') {
                        const terminoNormalizado = PlacaValidator.normalizarPlaca(termino);
                        const terminoMinusculas = termino.toLowerCase();
                        
                        datos = datos.filter(p => {
                            const placaNormalizada = PlacaValidator.normalizarPlaca(p.placa);
                            return (
                                placaNormalizada.includes(terminoNormalizado) ||
                                (p.empresa && p.empresa.toLowerCase().includes(terminoMinusculas)) ||
                                (p.asociacion && p.asociacion.toLowerCase().includes(terminoMinusculas))
                            );
                        });
                    }
                    
                    const placas = datos.map(p => new Placa(p.id, p.placa, p.empresa, p.asociacion, p.created_at, p.usuario_registro));
                    resolve(placas);
                };
                
                request.onerror = () => {
                    reject(new Error('Error al buscar placas'));
                };
            });
        }
    }
    
    // NUEVO: Método especializado para verificar si una placa existe

    async verificarPlacaExiste(placa) {
        console.log(`🔍 Búsqueda OPTIMIZADA de placa: "${placa}"`);
        
        // 1. Normalizar la placa y agregar guión
        const placaConGuion = PlacaValidator.agregarGuionPlaca(placa);
        console.log(`🔍 Placa con guión: "${placaConGuion}"`);
        
        // 2. Si está conectado a Supabase, buscar directamente con la placa con guión
        if (this.useSupabase && this.supabaseManager && this.supabaseManager.supabase) {
            try {
                console.log(`🔍 Buscando en Supabase: "${placaConGuion}"`);
                
                // Busqueda DIRECTA en Supabase (más rápida)
                const { data, error } = await this.supabaseManager.supabase
                    .from('placas_registradas')
                    .select('*')
                    .eq('placa', placaConGuion)
                    .limit(1)
                    .single();
                
                if (error && error.code !== 'PGRST116') { // PGRST116 es "no encontrado"
                    console.error(`Error buscando "${placaConGuion}":`, error);
                    return null;
                }
                
                if (data) {
                    console.log(`✅ Encontrada EXACTAMENTE: "${data.placa}"`);
                    return new Placa(
                        data.id,
                        data.placa,
                        data.empresa,
                        data.asociacion,
                        data.created_at,
                        data.usuario_registro
                    );
                }
                
                console.log(`❌ Placa NO encontrada: "${placaConGuion}"`);
                return null;
                
            } catch (error) {
                console.error('Error verificando placa en Supabase:', error);
                return null;
            }
        }
        
        // 3. Para modo local (fallback)
        console.log(`🔄 Usando búsqueda local para placa: "${placaConGuion}"`);
        const todasLasPlacas = await this.obtenerTodasPlacasConCache();
        
        // Buscar entre todas las placas usando comparación normalizada
        for (const item of todasLasPlacas) {
            if (PlacaValidator.compararPlacas(item.placa, placaConGuion)) {
                console.log(`✅ Encontrada en local: "${item.placa}"`);
                return item;
            }
        }
        
        console.log(`❌ Placa NO encontrada en modo local`);
        return null;
    }


    async actualizarPlaca(id, placa, empresa, asociacion) {
        const placaActualizada = new Placa(id, placa, empresa, asociacion, new Date().toISOString());
        
        // Si está conectado a Supabase, usar ese backend
        if (this.useSupabase && this.supabaseManager) {
            try {
                const success = await this.supabaseManager.updatePlaca(id, {
                    placa: placa,
                    empresa: empresa,
                    asociacion: asociacion
                });
                
                if (success) {
                    // Invalidar caché
                    this.cachePlacas = null;
                    return placaActualizada;
                }
            } catch (error) {
                console.error('Error actualizando en Supabase:', error);
                throw error;
            }
        }
        
        // Fallback a almacenamiento local
        if (this.useLocalStorage) {
            const datos = JSON.parse(localStorage.getItem(this.dbName) || '[]');
            const index = datos.findIndex(p => p.id === id);
            
            if (index === -1) {
                throw new Error('Placa no encontrada');
            }
            
            const existeOtra = datos.some((p, i) => 
                i !== index && PlacaValidator.compararPlacas(p.placa, placa)
            );
            
            if (existeOtra) {
                throw new Error(`La placa ${placa} ya existe en la base de datos`);
            }
            
            datos[index] = placaActualizada;
            localStorage.setItem(this.dbName, JSON.stringify(datos));
        } else {
            return new Promise((resolve, reject) => {
                const transaction = this.db.transaction([this.storeName], 'readwrite');
                const store = transaction.objectStore(this.storeName);
                
                const request = store.put(placaActualizada);
                
                request.onsuccess = () => {
                    // Invalidar caché
                    this.cachePlacas = null;
                    resolve(placaActualizada);
                };
                
                request.onerror = (event) => {
                    if (event.target.error.name === 'ConstraintError') {
                        reject(new Error(`La placa ${placa} ya existe en la base de datos`));
                    } else {
                        reject(new Error('Error al actualizar placa: ' + event.target.error));
                    }
                };
            });
        }
        
        return placaActualizada;
    }
    
    async eliminarPlaca(id) {
        // Si está conectado a Supabase, usar ese backend
        if (this.useSupabase && this.supabaseManager) {
            try {
                const success = await this.supabaseManager.deletePlaca(id);
                if (success) {
                    // Invalidar caché
                    this.cachePlacas = null;
                }
                return success;
            } catch (error) {
                console.error('Error eliminando de Supabase:', error);
                throw error;
            }
        }
        
        // Fallback a almacenamiento local
        if (this.useLocalStorage) {
            const datos = JSON.parse(localStorage.getItem(this.dbName) || '[]');
            const nuevaData = datos.filter(p => p.id !== id);
            
            if (nuevaData.length === datos.length) {
                throw new Error('Placa no encontrada');
            }
            
            localStorage.setItem(this.dbName, JSON.stringify(nuevaData));
        } else {
            return new Promise((resolve, reject) => {
                const transaction = this.db.transaction([this.storeName], 'readwrite');
                const store = transaction.objectStore(this.storeName);
                
                const request = store.delete(id);
                
                request.onsuccess = () => {
                    // Invalidar caché
                    this.cachePlacas = null;
                    resolve(true);
                };
                
                request.onerror = () => {
                    reject(new Error('Error al eliminar placa'));
                };
            });
        }
        
        return true;
    }
    
    async eliminarTodasPlacas() {
        // Si está conectado a Supabase, usar ese backend
        if (this.useSupabase && this.supabaseManager) {
            try {
                const success = await this.supabaseManager.deleteAllPlacas();
                if (success) {
                    // Invalidar caché
                    this.cachePlacas = null;
                }
                return success;
            } catch (error) {
                console.error('Error eliminando todas de Supabase:', error);
                throw error;
            }
        }
        
        // Fallback a almacenamiento local
        if (this.useLocalStorage) {
            localStorage.setItem(this.dbName, JSON.stringify([]));
        } else {
            return new Promise((resolve, reject) => {
                const transaction = this.db.transaction([this.storeName], 'readwrite');
                const store = transaction.objectStore(this.storeName);
                
                const request = store.clear();
                
                request.onsuccess = () => {
                    // Invalidar caché
                    this.cachePlacas = null;
                    resolve(true);
                };
                
                request.onerror = () => {
                    reject(new Error('Error al eliminar todas las placas'));
                };
            });
        }
        
        return true;
    }
    
    async contarRegistros() {
        // Si está conectado a Supabase, usar ese backend
        if (this.useSupabase && this.supabaseManager) {
            try {
                const datos = await this.supabaseManager.getAllPlacasCompleto();
                return datos.length;
            } catch (error) {
                console.error('Error contando registros en Supabase:', error);
                return 0;
            }
        }
        
        // Fallback a almacenamiento local
        if (this.useLocalStorage) {
            const datos = JSON.parse(localStorage.getItem(this.dbName) || '[]');
            return datos.length;
        } else {
            return new Promise((resolve, reject) => {
                const transaction = this.db.transaction([this.storeName], 'readonly');
                const store = transaction.objectStore(this.storeName);
                const request = store.count();
                
                request.onsuccess = () => {
                    resolve(request.result);
                };
                
                request.onerror = () => {
                    reject(new Error('Error al contar registros'));
                };
            });
        }
    }
    
    async importarDesdeExcel(archivo, saltarDuplicados = true, hojaSeleccionada = null) {
        try {
            const workbook = await this.excelManager.leerArchivoExcel(archivo);
            const hojas = this.excelManager.obtenerHojasDisponibles(workbook);
            
            if (hojas.length === 0) {
                throw new Error('El archivo Excel no contiene hojas de trabajo');
            }
            
            const hojaNombre = hojaSeleccionada || hojas[0].name;
            const hoja = workbook.Sheets[hojaNombre];
            
            if (!hoja) {
                throw new Error(`No se encontró la hoja "${hojaNombre}"`);
            }
            
            const datosExcel = this.excelManager.leerDatosDeHoja(hoja);
            
            if (datosExcel.length === 0) {
                throw new Error('No se encontraron datos válidos en la hoja seleccionada');
            }
            
            let registrosImportados = 0;
            let duplicados = 0;
            let errores = 0;
            
            for (const dato of datosExcel) {
                try {
                    if (saltarDuplicados) {
                        const existe = await this.verificarPlacaExiste(dato.placa);
                        if (existe) {
                            duplicados++;
                            continue;
                        }
                    }
                    
                    await this.insertarPlaca(dato.placa, dato.empresa, dato.asociacion, 'Importación Excel');
                    registrosImportados++;
                    
                } catch (error) {
                    errores++;
                    console.error(`Error en fila ${dato.rowNumber}:`, error);
                }
            }
            
            return {
                registrosImportados,
                duplicados,
                errores,
                totalProcesado: datosExcel.length,
                datosPreview: datosExcel.slice(0, 5),
                archivoNombre: archivo.name,
                hojaUsada: hojaNombre,
                totalHojas: hojas.length,
                columnasUsadas: {
                    A: 'PLACA',
                    B: 'EMPRESA', 
                    C: 'ASOCIACION'
                }
            };
            
        } catch (error) {
            throw error;
        }
    }
    
    async exportarAExcel() {
        const datos = await this.buscarPlacas();
        
        if (datos.length === 0) {
            throw new Error('No hay datos para exportar');
        }
        
        const datosParaExcel = datos.map(p => ({
            placa: p.placa,
            empresa: p.empresa,
            asociacion: p.asociacion,
            created_at: p.created_at,
            usuario_registro: p.usuario_registro
        }));
        
        const workbook = this.excelManager.crearWorkbookDesdeDatos(datosParaExcel);
        this.excelManager.descargarWorkbook(workbook, `placas_${new Date().toISOString().slice(0, 10)}.xlsx`);
        
        return datos.length;
    }
    
    async obtenerPlacaPorId(id) {
        // Si está conectado a Supabase
        if (this.useSupabase && this.supabaseManager) {
            try {
                const todasLasPlacas = await this.obtenerTodasPlacasConCache();
                const data = todasLasPlacas.find(p => p.id === id);
                return data || null;
            } catch (error) {
                console.error('Error obteniendo placa por ID:', error);
                return null;
            }
        }
        
        // Para modo local, busca en todos los registros
        const datos = await this.buscarPlacas();
        const data = datos.find(p => p.id === id);
        
        if (data) {
            return data;
        }
        return null;
    }
    
    async syncToSupabase() {
        if (!this.supabaseManager || !this.supabaseManager.isConnected) {
            throw new Error('No hay conexión a Supabase');
        }
        
        // Obtener datos locales
        let datosLocales = [];
        if (this.useLocalStorage) {
            datosLocales = JSON.parse(localStorage.getItem(this.dbName) || '[]');
        } else if (this.db) {
            datosLocales = await new Promise((resolve) => {
                const transaction = this.db.transaction([this.storeName], 'readonly');
                const store = transaction.objectStore(this.storeName);
                const request = store.getAll();
                
                request.onsuccess = () => {
                    resolve(request.result);
                };
                
                request.onerror = () => {
                    resolve([]);
                };
            });
        }
        
        // Convertir a formato Supabase
        const datosParaSupabase = datosLocales.map(p => ({
            placa: p.placa,
            empresa: p.empresa || '',
            asociacion: p.asociacion || '',
            usuario_registro: p.usuario_registro || 'Sistema Local',
            created_at: p.created_at || new Date().toISOString()
        }));
        
        // Sincronizar con Supabase
        return await this.supabaseManager.syncLocalToSupabase(datosParaSupabase, 'placas_registradas');
    }
    
    async syncFromSupabase() {
        if (!this.supabaseManager || !this.supabaseManager.isConnected) {
            throw new Error('No hay conexión a Supabase');
        }
        
        const resultado = await this.supabaseManager.syncFromSupabase('placas_registradas');
        
        if (resultado.success && resultado.data.length > 0) {
            // Guardar localmente
            if (this.useLocalStorage) {
                localStorage.setItem(this.dbName, JSON.stringify(resultado.data));
            } else if (this.db) {
                // Limpiar y cargar nuevos datos en IndexedDB
                await this.eliminarTodasPlacas();
                
                for (const dato of resultado.data) {
                    await this.insertarPlaca(
                        dato.placa, 
                        dato.empresa, 
                        dato.asociacion, 
                        dato.usuario_registro
                    );
                }
            }
            
            // Invalidar caché
            this.cachePlacas = null;
        }
        
        return resultado;
    }
}

class PlacasDatabaseApp {
    constructor(supabaseManager = null) {
        this.supabaseManager = supabaseManager;
        this.db = new MultiUserDatabase(supabaseManager);
        this.archivoImportar = null;
        this.workbookImportar = null;
        this.hojaSeleccionada = null;
        this.init();
    }
    
    async init() {
        await this.db.init();
        this.bindEvents();
        await this.cargarDatos();
        this.setupDragAndDrop();
        this.addSupabaseButtons();
        
    }
    
    addSupabaseButtons() {
        // Solo agregar botones si hay conexión a Supabase
        if (this.supabaseManager && this.supabaseManager.isConnected) {
            const controlsRow = document.querySelector('.controls-row');
            
            // Botón para sincronizar a Supabase
            const syncToBtn = document.createElement('button');
            syncToBtn.className = 'btn btn-warning';
            syncToBtn.id = 'btnSyncToSupabase';
            syncToBtn.innerHTML = '<i class="fas fa-cloud-upload-alt"></i> SUBIR A SUPABASE';
            syncToBtn.style.marginRight = '8px';
            
            // Botón para descargar de Supabase
            const syncFromBtn = document.createElement('button');
            syncFromBtn.className = 'btn btn-info';
            syncFromBtn.id = 'btnSyncFromSupabase';
            syncFromBtn.innerHTML = '<i class="fas fa-cloud-download-alt"></i> DESCARGAR DE SUPABASE';
            syncFromBtn.style.marginRight = '8px';
            
            // Insertar antes del botón de eliminar todo
            if (controlsRow) {
                controlsRow.insertBefore(syncFromBtn, controlsRow.firstChild);
                controlsRow.insertBefore(syncToBtn, controlsRow.firstChild);
                
                // Agregar eventos
                syncToBtn.addEventListener('click', () => this.syncToSupabase());
                syncFromBtn.addEventListener('click', () => this.syncFromSupabase());
            }
        }
    }
    
    async syncToSupabase() {
        try {
            const boton = document.getElementById('btnSyncToSupabase');
            const textoOriginal = boton.innerHTML;
            
            boton.innerHTML = '<div class="spinner"></div> SUBIENDO...';
            boton.disabled = true;
            
            const resultado = await this.db.syncToSupabase();
            
            if (resultado.success) {
                this.mostrarResultado(
                    'SINCRONIZACIÓN COMPLETA',
                    `✅ ${resultado.message}\n\nLos datos locales han sido subidos a Supabase y ahora están disponibles para todos los usuarios.`,
                    'success'
                );
                
                // Recargar datos para reflejar cambios
                await this.cargarDatos();
            } else {
                throw new Error(resultado.message);
            }
            
        } catch (error) {
            this.mostrarAlerta('Error', `Error al sincronizar con Supabase: ${error.message}`, 'error');
        } finally {
            const boton = document.getElementById('btnSyncToSupabase');
            if (boton) {
                boton.innerHTML = '<i class="fas fa-cloud-upload-alt"></i> SUBIR A SUPABASE';
                boton.disabled = false;
            }
        }
    }
    
    async syncFromSupabase() {
        try {
            const boton = document.getElementById('btnSyncFromSupabase');
            const textoOriginal = boton.innerHTML;
            
            boton.innerHTML = '<div class="spinner"></div> DESCARGANDO...';
            boton.disabled = true;
            
            const resultado = await this.db.syncFromSupabase();
            
            if (resultado.success) {
                this.mostrarResultado(
                    'DESCARGA COMPLETA',
                    `✅ ${resultado.message}\n\nLos datos de Supabase han sido descargados y ahora están disponibles localmente.`,
                    'success'
                );
                
                // Recargar datos para reflejar cambios
                await this.cargarDatos();
            } else {
                throw new Error(resultado.message);
            }
            
        } catch (error) {
            this.mostrarAlerta('Error', `Error al descargar de Supabase: ${error.message}`, 'error');
        } finally {
            const boton = document.getElementById('btnSyncFromSupabase');
            if (boton) {
                boton.innerHTML = '<i class="fas fa-cloud-download-alt"></i> DESCARGAR DE SUPABASE';
                boton.disabled = false;
            }
        }
    }
    
    bindEvents() {
        // Eventos existentes...
        document.getElementById('btnGuardar').addEventListener('click', () => this.guardarPlaca());
        document.getElementById('btnEditar').addEventListener('click', () => this.editarPlaca());
        document.getElementById('btnLimpiarForm').addEventListener('click', () => this.limpiarFormulario());
        
        document.getElementById('btnExportarExcel').addEventListener('click', () => this.exportarExcel());
        document.getElementById('btnImportarExcel').addEventListener('click', () => this.mostrarModalImportacion());
        document.getElementById('btnEliminarTodos').addEventListener('click', () => this.eliminarTodos());
        
        document.getElementById('btnBuscar').addEventListener('click', () => this.buscarPlacas());
        document.getElementById('btnLimpiarBusqueda').addEventListener('click', () => this.limpiarBusqueda());
        document.getElementById('buscarPlaca').addEventListener('keypress', (e) => {
            if (e.key === 'Enter') this.buscarPlacas();
        });
        
        document.getElementById('placa').addEventListener('keypress', (e) => {
            if (e.key === 'Enter') this.guardarPlaca();
        });
        
        document.getElementById('importModalClose').addEventListener('click', () => this.cerrarModalImportacion());
        document.getElementById('importCancel').addEventListener('click', () => this.cerrarModalImportacion());
        document.getElementById('importConfirm').addEventListener('click', () => this.procesarImportacion());
        document.getElementById('removeFile').addEventListener('click', () => this.removerArchivo());
        
        document.getElementById('confirmModalClose').addEventListener('click', () => this.cerrarModalConfirmacion());
        document.getElementById('confirmModalCancel').addEventListener('click', () => this.cerrarModalConfirmacion());
        
        document.getElementById('resultModalClose').addEventListener('click', () => this.cerrarModalResultados());
        document.getElementById('resultModalCloseBtn').addEventListener('click', () => this.cerrarModalResultados());
        
        document.getElementById('sheetSelectModalClose').addEventListener('click', () => this.cerrarModalSeleccionHoja());
        document.getElementById('sheetSelectCancel').addEventListener('click', () => this.cerrarModalSeleccionHoja());
        
        document.getElementById('fileInput').addEventListener('change', (e) => {
            if (e.target.files.length > 0) {
                this.seleccionarArchivo(e.target.files[0]);
            }
        });
    }
    
    // Resto de los métodos permanecen iguales...
    // ... [todos los demás métodos de la clase PlacasDatabaseApp se mantienen igual] ...
    
    setupDragAndDrop() {
        const dropArea = document.getElementById('fileDropArea');
        
        ['dragenter', 'dragover', 'dragleave', 'drop'].forEach(eventName => {
            dropArea.addEventListener(eventName, (e) => {
                e.preventDefault();
                e.stopPropagation();
            });
        });
        
        ['dragenter', 'dragover'].forEach(eventName => {
            dropArea.addEventListener(eventName, () => {
                dropArea.style.borderColor = 'var(--secondary)';
                dropArea.style.background = '#f0f8ff';
            });
        });
        
        ['dragleave', 'drop'].forEach(eventName => {
            dropArea.addEventListener(eventName, () => {
                dropArea.style.borderColor = '#dee2e6';
                dropArea.style.background = 'white';
            });
        });
        
        dropArea.addEventListener('drop', (e) => {
            const files = e.dataTransfer.files;
            if (files.length > 0) {
                this.seleccionarArchivo(files[0]);
            }
        });
    }
    
    async seleccionarArchivo(archivo) {
        this.archivoImportar = archivo;
        
        document.getElementById('fileName').textContent = archivo.name;
        document.getElementById('fileDetails').innerHTML = `
            <div>Tamaño: ${this.formatBytes(archivo.size)}</div>
            <div>Formato: ${this.obtenerExtension(archivo.name).toUpperCase()}</div>
        `;
        
        document.getElementById('fileInfo').style.display = 'block';
        document.getElementById('importConfirm').disabled = true;
        
        await this.mostrarVistaPrevia(archivo);
    }
    
    async mostrarVistaPrevia(archivo) {
        try {
            const botonConfirmar = document.getElementById('importConfirm');
            botonConfirmar.innerHTML = '<div class="spinner"></div> CARGANDO...';
            botonConfirmar.disabled = true;
            
            this.workbookImportar = await this.db.excelManager.leerArchivoExcel(archivo);
            const hojas = this.db.excelManager.obtenerHojasDisponibles(this.workbookImportar);
            
            const sheetInfo = document.getElementById('sheetInfo');
            const sheetNameElement = document.getElementById('sheetName');
            
            if (hojas.length > 1) {
                sheetNameElement.textContent = `Múltiples hojas encontradas (${hojas.length}) - Se usará la primera`;
                sheetInfo.style.display = 'block';
                
                setTimeout(() => {
                    this.mostrarModalSeleccionHoja(hojas);
                }, 500);
            } else {
                sheetNameElement.textContent = `Hoja: "${hojas[0].name}"`;
                sheetInfo.style.display = 'block';
                this.hojaSeleccionada = hojas[0].name;
            }
            
            const primeraHoja = hojas[0];
            const datosPreview = this.db.excelManager.leerDatosDeHoja(primeraHoja.sheet);
            
            const previewTableBody = document.getElementById('previewTableBody');
            previewTableBody.innerHTML = '';
            
            if (datosPreview.length === 0) {
                previewTableBody.innerHTML = `
                    <tr>
                        <td colspan="3" style="text-align: center; padding: 20px; color: #95a5a6;">
                            No se encontraron datos en la hoja "${primeraHoja.name}"
                        </td>
                    </tr>
                `;
            } else {
                datosPreview.slice(0, 5).forEach(dato => {
                    const tr = document.createElement('tr');
                    tr.innerHTML = `
                        <td style="padding: 6px 8px;">${dato.placa}</td>
                        <td style="padding: 6px 8px;">${dato.empresa}</td>
                        <td style="padding: 6px 8px;">${dato.asociacion}</td>
                    `;
                    previewTableBody.appendChild(tr);
                });
                
                document.getElementById('previewStats').textContent = 
                    `Mostrando ${Math.min(5, datosPreview.length)} de ${datosPreview.length} registros`;
            }
            
            document.getElementById('importPreview').style.display = 'block';
            document.getElementById('importConfirm').disabled = false;
            botonConfirmar.innerHTML = '<i class="fas fa-upload"></i> IMPORTAR';
            
        } catch (error) {
            console.error('Error mostrando vista previa:', error);
            document.getElementById('previewStats').textContent = `Error: ${error.message}`;
            document.getElementById('importPreview').style.display = 'block';
            document.getElementById('importConfirm').disabled = true;
            document.getElementById('importConfirm').innerHTML = '<i class="fas fa-exclamation-triangle"></i> ERROR';
        }
    }
    
    mostrarModalSeleccionHoja(hojas) {
        const sheetList = document.getElementById('sheetList');
        sheetList.innerHTML = '';
        
        hojas.forEach((hoja, index) => {
            const button = document.createElement('button');
            button.className = 'btn btn-secondary';
            button.style.width = '100%';
            button.style.marginBottom = '8px';
            button.style.textAlign = 'left';
            button.style.justifyContent = 'flex-start';
            button.innerHTML = `
                <i class="fas fa-table"></i> 
                ${hoja.name} 
                ${index === 0 ? '<span style="margin-left: 8px; font-size: 12px; opacity: 0.7;">(Predeterminada)</span>' : ''}
            `;
            
            button.addEventListener('click', () => {
                this.hojaSeleccionada = hoja.name;
                
                document.getElementById('sheetName').textContent = `Hoja seleccionada: "${hoja.name}"`;
                
                this.cerrarModalSeleccionHoja();
                
                this.actualizarVistaPreviaConHoja(hoja);
            });
            
            sheetList.appendChild(button);
        });
        
        document.getElementById('sheetSelectModal').style.display = 'flex';
    }
    
    actualizarVistaPreviaConHoja(hoja) {
        try {
            const datosPreview = this.db.excelManager.leerDatosDeHoja(hoja.sheet);
            
            const previewTableBody = document.getElementById('previewTableBody');
            previewTableBody.innerHTML = '';
            
            if (datosPreview.length === 0) {
                previewTableBody.innerHTML = `
                    <tr>
                        <td colspan="3" style="text-align: center; padding: 20px; color: #95a5a6;">
                            No se encontraron datos en la hoja "${hoja.name}"
                        </td>
                    </tr>
                `;
            } else {
                datosPreview.slice(0, 5).forEach(dato => {
                    const tr = document.createElement('tr');
                    tr.innerHTML = `
                        <td style="padding: 6px 8px;">${dato.placa}</td>
                        <td style="padding: 6px 8px;">${dato.empresa}</td>
                        <td style="padding: 6px 8px;">${dato.asociacion}</td>
                    `;
                    previewTableBody.appendChild(tr);
                });
                
                document.getElementById('previewStats').textContent = 
                    `Hoja: "${hoja.name}" - Mostrando ${Math.min(5, datosPreview.length)} de ${datosPreview.length} registros`;
            }
            
        } catch (error) {
            console.error('Error actualizando vista previa:', error);
        }
    }
    
    cerrarModalSeleccionHoja() {
        document.getElementById('sheetSelectModal').style.display = 'none';
    }
    
    removerArchivo() {
        this.archivoImportar = null;
        this.workbookImportar = null;
        this.hojaSeleccionada = null;
        document.getElementById('fileInfo').style.display = 'none';
        document.getElementById('importPreview').style.display = 'none';
        document.getElementById('importConfirm').disabled = true;
        document.getElementById('importConfirm').innerHTML = '<i class="fas fa-upload"></i> IMPORTAR';
        document.getElementById('fileInput').value = '';
    }
    
    formatBytes(bytes, decimals = 2) {
        if (bytes === 0) return '0 Bytes';
        const k = 1024;
        const dm = decimals < 0 ? 0 : decimals;
        const sizes = ['Bytes', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
    }
    
    obtenerExtension(nombreArchivo) {
        return nombreArchivo.split('.').pop().toLowerCase();
    }
    
    async buscarPlacas() {
        const termino = document.getElementById('buscarPlaca').value.trim();
        await this.cargarDatos(termino);
    }
    
    limpiarBusqueda() {
        document.getElementById('buscarPlaca').value = '';
        this.cargarDatos();
    }
    
    async cargarDatos(termino = null) {
        try {
            const datos = await this.db.buscarPlacas(termino);
            this.mostrarDatosEnTabla(datos);
            await this.actualizarEstadisticas(datos.length, termino);
        } catch (error) {
            console.error('Error cargando datos:', error);
            this.mostrarAlerta('Error', 'No se pudieron cargar los datos de la base de datos', 'error');
        }
    }
    
    mostrarDatosEnTabla(datos) {
        const tbody = document.getElementById('placasTableBody');
        tbody.innerHTML = '';
        
        if (datos.length === 0) {
            const termino = document.getElementById('buscarPlaca').value.trim();
            tbody.innerHTML = `
                <tr>
                    <td colspan="3" style="text-align: center; padding: 40px; color: #95a5a6;">
                        <i class="fas fa-database" style="font-size: 40px; margin-bottom: 10px; display: block; opacity: 0.5;"></i>
                        ${termino ? 
                            `No se encontraron resultados para "${termino}"` : 
                            'No hay registros de placas. Agrega una nueva placa o importa datos.'}
                    </td>
                </tr>
            `;
            return;
        }
        
        datos.forEach(placa => {
            const rowData = placa.toTableRow();
            const fila = document.createElement('tr');
            
            fila.innerHTML = `
                <td style="font-weight: 600; color: var(--dark); font-size: 15px;">${rowData.placa}</td>
                <td>${rowData.empresa || '<span style="color: #95a5a6; font-style: italic;">-</span>'}</td>
                <td>${rowData.asociacion || '<span style="color: #95a5a6; font-style: italic;">-</span>'}</td>
            `;
            
            tbody.appendChild(fila);
        });
    }
    
    async actualizarEstadisticas(resultados = 0, termino = null) {
        try {
            const total = await this.db.contarRegistros();
            
            document.getElementById('totalRegistros').textContent = total;
            document.getElementById('tableInfo').textContent = `${resultados} registros`;
            
            let statsText = `Total de registros: ${total}`;
            if (termino) {
                statsText = `Búsqueda: "${termino}" - ${resultados} resultados (Total: ${total})`;
            }
            document.getElementById('statsText').textContent = statsText;
        } catch (error) {
            console.error('Error actualizando estadísticas:', error);
        }
    }
    
    async guardarPlaca() {
        const placa = document.getElementById('placa').value.trim();
        const empresa = document.getElementById('empresa').value.trim();
        const asociacion = document.getElementById('asociacion').value.trim();
        const usuarioActual = window.sistema?.authManager?.getCurrentUser() || 'Sistema';
        
        if (this.db.placaEditando) {
            await this.actualizarPlacaExistente();
            return;
        }
        
        if (!placa) {
            this.mostrarAlerta('Advertencia', 'El campo PLACA es obligatorio', 'warning');
            document.getElementById('placa').focus();
            return;
        }
        
        if (!PlacaValidator.validarFormatoPlaca(placa)) {
            this.mostrarAlerta('Advertencia', 'El formato de la placa no es válido', 'warning');
            document.getElementById('placa').focus();
            return;
        }
        
        try {
            await this.db.insertarPlaca(placa, empresa, asociacion, usuarioActual);
            this.mostrarAlerta('Éxito', 'Placa registrada correctamente', 'success');
            this.limpiarFormulario();
            await this.cargarDatos();
        } catch (error) {
            this.mostrarAlerta('Error', error.message, 'error');
        }
    }
    
    async cargarParaEditar(id) {
        try {
            const placa = await this.db.obtenerPlacaPorId(id);
            if (!placa) {
                this.mostrarAlerta('Error', 'Placa no encontrada', 'error');
                return;
            }
            
            document.getElementById('placa').value = placa.placa;
            document.getElementById('empresa').value = placa.empresa;
            document.getElementById('asociacion').value = placa.asociacion;
            
            document.getElementById('btnGuardar').innerHTML = '<i class="fas fa-save"></i> ACTUALIZAR';
            document.getElementById('btnGuardar').className = 'btn btn-info';
            
            this.db.placaEditando = placa;
            
            document.getElementById('btnEditar').innerHTML = '<i class="fas fa-times"></i> CANCELAR';
            document.getElementById('btnEditar').className = 'btn btn-danger';
            
            document.getElementById('placa').focus();
            
            this.mostrarAlerta('Información', `Editando placa: ${placa.placa}`, 'info');
            
        } catch (error) {
            this.mostrarAlerta('Error', 'Error al cargar placa para editar: ' + error.message, 'error');
        }
    }
    
    async editarPlaca() {
        if (this.db.placaEditando) {
            this.cancelarEdicion();
            return;
        }
        
        const placaInput = document.getElementById('placa').value.trim();
        if (!placaInput) {
            this.mostrarAlerta('Advertencia', 'Ingrese una placa para buscar y editar', 'warning');
            return;
        }
        
        try {
            const placaEncontrada = await this.db.verificarPlacaExiste(placaInput);
            if (!placaEncontrada) {
                this.mostrarAlerta('Error', `No se encontró la placa "${placaInput}"`, 'error');
                return;
            }
            
            document.getElementById('placa').value = placaEncontrada.placa;
            document.getElementById('empresa').value = placaEncontrada.empresa;
            document.getElementById('asociacion').value = placaEncontrada.asociacion;
            
            document.getElementById('btnGuardar').innerHTML = '<i class="fas fa-save"></i> ACTUALIZAR';
            document.getElementById('btnGuardar').className = 'btn btn-info';
            
            this.db.placaEditando = new Placa(
                placaEncontrada.id,
                placaEncontrada.placa,
                placaEncontrada.empresa,
                placaEncontrada.asociacion
            );
            
            document.getElementById('btnEditar').innerHTML = '<i class="fas fa-times"></i> CANCELAR';
            document.getElementById('btnEditar').className = 'btn btn-danger';
            
            document.getElementById('placa').focus();
            
            this.mostrarAlerta('Información', `Editando placa: ${placaEncontrada.placa}`, 'info');
            
        } catch (error) {
            this.mostrarAlerta('Error', 'Error al buscar placa para editar: ' + error.message, 'error');
        }
    }
    
    async actualizarPlacaExistente() {
        const placa = document.getElementById('placa').value.trim();
        const empresa = document.getElementById('empresa').value.trim();
        const asociacion = document.getElementById('asociacion').value.trim();
        
        if (!placa) {
            this.mostrarAlerta('Advertencia', 'El campo PLACA es obligatorio', 'warning');
            document.getElementById('placa').focus();
            return;
        }
        
        if (!PlacaValidator.validarFormatoPlaca(placa)) {
            this.mostrarAlerta('Advertencia', 'El formato de la placa no es válido', 'warning');
            document.getElementById('placa').focus();
            return;
        }
        
        try {
            await this.db.actualizarPlaca(this.db.placaEditando.id, placa, empresa, asociacion);
            this.mostrarAlerta('Éxito', 'Placa actualizada correctamente', 'success');
            this.cancelarEdicion();
            await this.cargarDatos();
        } catch (error) {
            this.mostrarAlerta('Error', error.message, 'error');
        }
    }
    
    async eliminarPlaca(id) {
        try {
            this.mostrarModalConfirmacion(
                'ELIMINAR PLACA',
                `¿Está seguro de eliminar esta placa?`,
                async () => {
                    try {
                        await this.db.eliminarPlaca(id);
                        this.mostrarAlerta('Éxito', 'Placa eliminada correctamente', 'success');
                        await this.cargarDatos();
                    } catch (error) {
                        this.mostrarAlerta('Error', error.message, 'error');
                    }
                }
            );
        } catch (error) {
            this.mostrarAlerta('Error', error.message, 'error');
        }
    }
    
    cancelarEdicion() {
        this.limpiarFormulario();
        this.db.placaEditando = null;
        
        document.getElementById('btnGuardar').innerHTML = '<i class="fas fa-save"></i> GUARDAR';
        document.getElementById('btnGuardar').className = 'btn btn-primary';
        document.getElementById('btnEditar').innerHTML = '<i class="fas fa-edit"></i> EDITAR';
        document.getElementById('btnEditar').className = 'btn btn-info';
        
        this.mostrarAlerta('Información', 'Edición cancelada', 'info');
    }
    
    limpiarFormulario() {
        document.getElementById('placa').value = '';
        document.getElementById('empresa').value = '';
        document.getElementById('asociacion').value = '';
        document.getElementById('placa').focus();
    }
    
    async eliminarTodos() {
        try {
            const total = await this.db.contarRegistros();
            if (total === 0) {
                this.mostrarAlerta('Información', 'No hay registros para eliminar', 'info');
                return;
            }
            
            this.mostrarModalConfirmacion(
                'ELIMINAR TODOS LOS REGISTROS',
                `¿Está seguro de eliminar TODOS los registros (${total} en total)?\n\n⚠️ ESTA ACCIÓN NO SE PUEDE DESHACER ⚠️\nSe perderán todos los datos permanentemente.`,
                async () => {
                    try {
                        await this.db.eliminarTodasPlacas();
                        this.mostrarResultado(
                            'BASE DE DATOS LIMPIADA',
                            `✅ Se eliminaron todos los registros (${total}) correctamente.`,
                            'success'
                        );
                        await this.cargarDatos();
                    } catch (error) {
                        this.mostrarAlerta('Error', 'No se pudieron eliminar todos los registros: ' + error.message, 'error');
                    }
                }
            );
        } catch (error) {
            this.mostrarAlerta('Error', 'No se pudo contar los registros: ' + error.message, 'error');
        }
    }
    
    async exportarExcel() {
        try {
            const botonExportar = document.getElementById('btnExportarExcel');
            const textoOriginal = botonExportar.innerHTML;
            
            botonExportar.innerHTML = '<div class="spinner"></div> EXPORTANDO...';
            botonExportar.disabled = true;
            
            const exportados = await this.db.exportarAExcel();
            
            this.mostrarResultado(
                'EXPORTACIÓN COMPLETADA',
                `✅ Se exportaron ${exportados} registros a archivo Excel (.xlsx).\n\nEl archivo se descargará automáticamente con las columnas en el orden correcto:\n\n1. PLACA\n2. EMPRESA\n3. ASOCIACIÓN\n4. FECHA REGISTRO\n5. USUARIO\n\n📁 Formato: Excel (.xlsx)`,
                'success'
            );
            
            botonExportar.innerHTML = textoOriginal;
            botonExportar.disabled = false;
            
        } catch (error) {
            this.mostrarAlerta('Error', `No se pudo exportar: ${error.message}`, 'error');
            document.getElementById('btnExportarExcel').innerHTML = '<i class="fas fa-file-excel"></i> EXPORTAR A EXCEL';
            document.getElementById('btnExportarExcel').disabled = false;
        }
    }
    
    mostrarModalImportacion() {
        document.getElementById('importModal').style.display = 'flex';
        this.removerArchivo();
    }
    
    cerrarModalImportacion() {
        document.getElementById('importModal').style.display = 'none';
        this.removerArchivo();
    }
    
    async procesarImportacion() {
        if (!this.archivoImportar) {
            this.mostrarAlerta('Advertencia', 'Debe seleccionar un archivo para importar', 'warning');
            return;
        }
        
        const saltarDuplicados = document.getElementById('skipDuplicates').checked;
        const botonConfirmar = document.getElementById('importConfirm');
        const textoOriginal = botonConfirmar.innerHTML;
        
        botonConfirmar.innerHTML = '<div class="spinner"></div> IMPORTANDO...';
        botonConfirmar.disabled = true;
        
        try {
            const resultado = await this.db.importarDesdeExcel(
                this.archivoImportar, 
                saltarDuplicados,
                this.hojaSeleccionada
            );
            
            this.cerrarModalImportacion();
            
            let mensaje = `✅ IMPORTACIÓN COMPLETADA\n\n`;
            mensaje += `✓ Nuevos registros: ${resultado.registrosImportados}\n`;
            mensaje += `○ Registros duplicados: ${resultado.duplicados}\n`;
            mensaje += `✗ Errores: ${resultado.errores}\n`;
            mensaje += `▸ Total procesado: ${resultado.totalProcesado}\n\n`;
            mensaje += `📊 Información del archivo:\n`;
            mensaje += `  • Archivo: ${resultado.archivoNombre}\n`;
            mensaje += `  • Hoja usada: "${resultado.hojaUsada}"\n`;
            mensaje += `  • Total de hojas: ${resultado.totalHojas}\n\n`;
            mensaje += `📋 Columnas usadas:\n`;
            mensaje += `  • Columna A → PLACA\n`;
            mensaje += `  • Columna B → EMPRESA\n`;
            mensaje += `  • Columna C → ASOCIACIÓN\n\n`;
            mensaje += `💾 Los datos se han guardado en la base de datos`;
            
            this.mostrarResultado(
                'RESUMEN DE IMPORTACIÓN',
                mensaje,
                'success'
            );
            
            await this.cargarDatos();
            
        } catch (error) {
            this.mostrarAlerta('Error', `No se pudo importar el archivo: ${error.message}`, 'error');
        } finally {
            botonConfirmar.innerHTML = textoOriginal;
            botonConfirmar.disabled = false;
        }
    }
    
    mostrarModalConfirmacion(titulo, mensaje, callbackConfirmar) {
        document.getElementById('confirmModalTitle').innerHTML = `<i class="fas fa-exclamation-triangle"></i> ${titulo}`;
        document.getElementById('confirmModalMessage').textContent = mensaje;
        
        const modal = document.getElementById('confirmModal');
        modal.style.display = 'flex';
        
        const confirmar = () => {
            modal.style.display = 'none';
            document.getElementById('confirmModalConfirm').removeEventListener('click', confirmar);
            if (callbackConfirmar) callbackConfirmar();
        };
        
        document.getElementById('confirmModalConfirm').addEventListener('click', confirmar);
    }
    
    cerrarModalConfirmacion() {
        document.getElementById('confirmModal').style.display = 'none';
    }
    
    mostrarResultado(titulo, mensaje, tipo = 'info') {
        let icono = 'fas fa-info-circle';
        if (tipo === 'success') icono = 'fas fa-check-circle';
        if (tipo === 'error') icono = 'fas fa-times-circle';
        if (tipo === 'warning') icono = 'fas fa-exclamation-triangle';
        
        document.getElementById('resultModalTitle').innerHTML = `<i class="${icono}"></i> ${titulo}`;
        document.getElementById('resultModalMessage').textContent = mensaje;
        
        document.getElementById('resultModal').style.display = 'flex';
    }
    
    cerrarModalResultados() {
        document.getElementById('resultModal').style.display = 'none';
    }
    
    mostrarAlerta(titulo, mensaje, tipo = 'info') {
        const alerta = document.createElement('div');
        
        let clase = 'alert-info';
        switch(tipo) {
            case 'success': clase = 'alert-success'; break;
            case 'error': clase = 'alert-error'; break;
            case 'warning': clase = 'alert-warning'; break;
        }
        
        alerta.className = `alert ${clase}`;
        
        let icono = 'fas fa-info-circle';
        if (tipo === 'success') icono = 'fas fa-check-circle';
        if (tipo === 'error') icono = 'fas fa-times-circle';
        if (tipo === 'warning') icono = 'fas fa-exclamation-triangle';
        
        alerta.innerHTML = `
            <i class="${icono}" style="font-size: 18px; margin-top: 2px;"></i>
            <div>
                <div style="font-size: 14px; margin-bottom: 4px; font-weight: 700;">${titulo}</div>
                <div style="font-size: 13px; opacity: 0.9;">${mensaje}</div>
            </div>
        `;
        
        document.body.appendChild(alerta);
        
        setTimeout(() => {
            alerta.style.animation = 'slideOutAlert 0.3s ease-out';
            setTimeout(() => {
                if (alerta.parentNode) {
                    alerta.parentNode.removeChild(alerta);
                }
            }, 300);
        }, 4000);
    }
}

// Exportar para uso global
window.PlacasDatabaseApp = PlacasDatabaseApp;
window.MultiUserDatabase = MultiUserDatabase;
window.PlacaValidator = PlacaValidator; // Exportar para usar en otros archivos