// ============================================
// MÓDULO DE BASE DE DATOS OPTIMIZADO
// ============================================

class PlacaValidator {
    static normalizarPlaca(placa) {
        if (!placa || typeof placa !== 'string') return "";
        
        return placa
            .toUpperCase()
            .replace(/[^A-Z0-9]/g, '')
            .trim();
    }
    
    static agregarGuionPlaca(placa) {
        if (!placa || typeof placa !== 'string') return placa;
        
        const normalizada = this.normalizarPlaca(placa);
        
        if (normalizada.length >= 4) {
            const numeros = normalizada.match(/^\d+/);
            if (numeros && numeros[0].length >= 1) {
                const longitudNumeros = numeros[0].length;
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
        
        return Array.from(variantes).filter(v => v && v.length > 0);
    }
    
    static validarFormatoPlaca(placa) {
        if (!placa || placa.trim().length < 2) return false;
        
        const normalizada = this.normalizarPlaca(placa);
        return normalizada.length >= 2 && normalizada.length <= 10;
    }
    
    static compararPlacas(placa1, placa2) {
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
                        cellDates: true
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
    
    leerDatosDeHoja(sheet) {
        let jsonData = XLSX.utils.sheet_to_json(sheet, { header: 1, blankrows: false, defval: '' });
        
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
        this.cachePlacas = null;
        this.cacheTimestamp = null;
        this.CACHE_DURATION = 5 * 60 * 1000;
        this.init();
    }
    
    async init() {
        if (this.supabaseManager) {
            this.useSupabase = this.supabaseManager.isConnected;
            if (this.useSupabase) {
                console.log('✅ Usando Supabase como backend');
                return;
            }
        }
        
        if (!window.indexedDB) {
            this.useLocalStorage = true;
            this.ensureLocalStorage();
        } else {
            await this.initIndexedDB();
        }
    }
    
    async initIndexedDB() {
        return new Promise((resolve) => {
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
                }
            };
        });
    }
    
    ensureLocalStorage() {
        if (!localStorage.getItem(this.dbName)) {
            localStorage.setItem(this.dbName, JSON.stringify([]));
        }
    }
    
    async obtenerTodasPlacasConCache() {
        const ahora = Date.now();
        if (this.cachePlacas && this.cacheTimestamp && (ahora - this.cacheTimestamp) < this.CACHE_DURATION) {
            return this.cachePlacas;
        }
        
        const todasLasPlacas = await this.buscarPlacas();
        this.cachePlacas = todasLasPlacas;
        this.cacheTimestamp = ahora;
        
        return todasLasPlacas;
    }
    
    async verificarPlacaExiste(placa) {
        console.log(`🔍 Verificando placa: "${placa}"`);
        
        // Normalizar la placa
        const placaNormalizada = PlacaValidator.normalizarPlaca(placa);
        
        // Si está conectado a Supabase
        if (this.useSupabase && this.supabaseManager && this.supabaseManager.supabase) {
            try {
                console.log(`🔍 Buscando en Supabase: "${placaNormalizada}"`);
                
                // Generar variantes de búsqueda
                const variantes = PlacaValidator.generarVariantesBusqueda(placa);
                
                // Buscar cada variante
                for (const variante of variantes) {
                    const { data, error } = await this.supabaseManager.supabase
                        .from('placas_registradas')
                        .select('*')
                        .eq('placa', variante)
                        .limit(1)
                        .single();
                    
                    if (error && error.code !== 'PGRST116') {
                        console.error(`Error buscando "${variante}":`, error);
                        continue;
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
                }
                
                console.log(`❌ Placa NO encontrada: "${placaNormalizada}"`);
                return null;
                
            } catch (error) {
                console.error('Error verificando placa en Supabase:', error);
                // Fallback a búsqueda local
            }
        }
        
        // Para modo local (fallback)
        console.log(`🔄 Usando búsqueda local para placa: "${placaNormalizada}"`);
        const todasLasPlacas = await this.obtenerTodasPlacasConCache();
        
        // Buscar usando todas las variantes
        const variantes = PlacaValidator.generarVariantesBusqueda(placa);
        
        for (const variante of variantes) {
            for (const item of todasLasPlacas) {
                if (PlacaValidator.compararPlacas(item.placa, variante)) {
                    console.log(`✅ Encontrada en local: "${item.placa}"`);
                    return item;
                }
            }
        }
        
        console.log(`❌ Placa NO encontrada en modo local`);
        return null;
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
                    
                    datosSupabase = await this.supabaseManager.searchPlacasFlexible(terminoNormalizado);
                    
                    if (!datosSupabase || datosSupabase.length === 0) {
                        datosSupabase = await this.supabaseManager.searchPlacasFlexible(termino);
                    }
                } else {
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
            return new Promise((resolve) => {
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
                    resolve([]);
                };
            });
        }
    }
    
    async contarRegistros() {
        if (this.useSupabase && this.supabaseManager) {
            try {
                const datos = await this.supabaseManager.getAllPlacasCompleto();
                return datos.length;
            } catch (error) {
                console.error('Error contando registros en Supabase:', error);
                return 0;
            }
        }
        
        if (this.useLocalStorage) {
            const datos = JSON.parse(localStorage.getItem(this.dbName) || '[]');
            return datos.length;
        } else {
            return new Promise((resolve) => {
                const transaction = this.db.transaction([this.storeName], 'readonly');
                const store = transaction.objectStore(this.storeName);
                const request = store.count();
                
                request.onsuccess = () => {
                    resolve(request.result);
                };
                
                request.onerror = () => {
                    resolve(0);
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
                    
                    // Solo verificamos, no insertamos
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
                totalHojas: hojas.length
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
    
    // NUEVO MÉTODO: Descargar datos para modo offline
    async descargarParaOffline() {
        try {
            console.log('📥 Iniciando descarga para modo offline...');
            
            if (!this.useSupabase || !this.supabaseManager || !this.supabaseManager.isConnected) {
                return {
                    success: false,
                    message: 'No hay conexión a Supabase para descargar datos',
                    registros: 0
                };
            }
            
            // Obtener todos los datos de Supabase
            const datosSupabase = await this.supabaseManager.getAllPlacasCompleto();
            
            if (!datosSupabase || datosSupabase.length === 0) {
                return {
                    success: false,
                    message: 'No hay datos disponibles en Supabase',
                    registros: 0
                };
            }
            
            console.log(`📊 Descargando ${datosSupabase.length} registros de Supabase...`);
            
            // Convertir a formato local
            const datosLocal = datosSupabase.map(p => ({
                id: p.id,
                placa: p.placa,
                empresa: p.empresa || '',
                asociacion: p.asociacion || '',
                created_at: p.created_at,
                usuario_registro: p.usuario_registro || 'Sistema',
                normalizada: PlacaValidator.normalizarPlaca(p.placa)
            }));
            
            // Guardar en localStorage
            localStorage.setItem(this.dbName, JSON.stringify(datosLocal));
            
            // Actualizar caché
            this.cachePlacas = datosLocal.map(p => new Placa(
                p.id, p.placa, p.empresa, p.asociacion, p.created_at, p.usuario_registro
            ));
            this.cacheTimestamp = Date.now();
            
            // Cambiar a modo local
            this.useSupabase = false;
            this.useLocalStorage = true;
            
            console.log(`✅ Descarga completada: ${datosLocal.length} registros guardados en localStorage`);
            
            return {
                success: true,
                message: `Descarga completada: ${datosLocal.length} registros guardados localmente`,
                registros: datosLocal.length
            };
            
        } catch (error) {
            console.error('❌ Error en descarga para modo offline:', error);
            return {
                success: false,
                message: `Error al descargar datos: ${error.message}`,
                registros: 0
            };
        }
    }
    
    // NUEVO MÉTODO: Verificar si hay datos offline disponibles
    tieneDatosOffline() {
        if (this.useLocalStorage) {
            const datos = JSON.parse(localStorage.getItem(this.dbName) || '[]');
            return datos.length > 0;
        }
        return false;
    }
    
    // NUEVO MÉTODO: Obtener estadísticas de datos offline
    getEstadisticasOffline() {
        if (!this.tieneDatosOffline()) {
            return {
                total: 0,
                ultimaActualizacion: null,
                origen: 'Sin datos offline'
            };
        }
        
        const datos = JSON.parse(localStorage.getItem(this.dbName) || '[]');
        
        // Encontrar la fecha más reciente
        let ultimaFecha = null;
        if (datos.length > 0) {
            const fechas = datos
                .filter(p => p.created_at)
                .map(p => new Date(p.created_at).getTime());
            
            if (fechas.length > 0) {
                ultimaFecha = new Date(Math.max(...fechas));
            }
        }
        
        return {
            total: datos.length,
            ultimaActualizacion: ultimaFecha,
            origen: 'LocalStorage'
        };
    }
}

class PlacasDatabaseApp {
    constructor(supabaseManager = null) {
        this.supabaseManager = supabaseManager;
        this.db = new MultiUserDatabase(supabaseManager);
        this.init();
    }
    
    async init() {
        await this.db.init();
        this.bindEvents();
        await this.cargarDatos();
    }
    
    bindEvents() {
        // Mantener solo los eventos necesarios
        document.getElementById('btnBuscar').addEventListener('click', () => this.buscarPlacas());
        document.getElementById('btnLimpiarBusqueda').addEventListener('click', () => this.limpiarBusqueda());
        document.getElementById('buscarPlaca').addEventListener('keypress', (e) => {
            if (e.key === 'Enter') this.buscarPlacas();
        });
        
        // Eliminados según requerimiento:
        // - btnExportarExcel
        // - btnImportarExcel
        // - btnEliminarTodos
        
        // Mantener eventos de modales que aún pueden existir
        document.getElementById('importModalClose')?.addEventListener('click', () => this.cerrarModalImportacion());
        document.getElementById('importCancel')?.addEventListener('click', () => this.cerrarModalImportacion());
        document.getElementById('resultModalClose')?.addEventListener('click', () => this.cerrarModalResultados());
        document.getElementById('resultModalCloseBtn')?.addEventListener('click', () => this.cerrarModalResultados());
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
                            'No hay registros de placas.'}
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
            
            // Agregar información de modo offline si está activo
            if (!this.db.useSupabase && this.db.tieneDatosOffline()) {
                const stats = this.db.getEstadisticasOffline();
                statsText += ` | Modo Offline`;
                if (stats.ultimaActualizacion) {
                    statsText += ` (Actualizado: ${stats.ultimaActualizacion.toLocaleDateString('es-ES')})`;
                }
            }
            
            document.getElementById('statsText').textContent = statsText;
        } catch (error) {
            console.error('Error actualizando estadísticas:', error);
        }
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
    
    // Métodos de modales (mantenidos por si acaso)
    mostrarModalImportacion() {
        // Eliminado según requerimiento
    }
    
    cerrarModalImportacion() {
        // Eliminado según requerimiento
    }
    
    mostrarResultado(titulo, mensaje, tipo = 'info') {
        // Mantenido por compatibilidad
        let icono = 'fas fa-info-circle';
        if (tipo === 'success') icono = 'fas fa-check-circle';
        if (tipo === 'error') icono = 'fas fa-times-circle';
        if (tipo === 'warning') icono = 'fas fa-exclamation-triangle';
        
        console.log(`${icono} ${titulo}: ${mensaje}`);
    }
    
    cerrarModalResultados() {
        // Mantenido por compatibilidad
    }
}

// Exportar para uso global
window.PlacasDatabaseApp = PlacasDatabaseApp;
window.PlacaValidator = PlacaValidator;
