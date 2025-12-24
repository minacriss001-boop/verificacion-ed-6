// ============================================
// MÓDULO DE INTEGRACIÓN CON SUPABASE - VERSIÓN MEJORADA
// ============================================

class SupabaseManager {
    constructor() {
        this.supabase = null;
        this.isConnected = false;
        this.supabaseUrl = 'https://xzfaljcftyezfugjnbai.supabase.co'; // Reemplazar con tu URL
        this.supabaseKey = 'sb_publishable_uL2ZKNK2NUaOMdhb47k5ig_GNnlSCar'; // Reemplazar con tu anon key
        this.connectionAttempts = 0;
        this.maxAttempts = 3;
        
        this.tables = {
            placas: 'placas_registradas',
            observaciones: 'observaciones_compartidas',
            usuarios: 'usuarios_activos'
        };
    }
    
    async init() {
        try {
            // Verificar credenciales
            if (this.supabaseUrl === 'SUPABASE_URL' || this.supabaseKey === 'SUPABASE_ANON_KEY') {
                console.warn('Credenciales de Supabase no configuradas. Usando modo local.');
                this.isConnected = false;
                this.updateConnectionStatus(false);
                return false;
            }
            
            // Inicializar Supabase
            this.supabase = supabase.createClient(this.supabaseUrl, this.supabaseKey);
            
            // Probar conexión
            const { data, error } = await this.supabase
                .from(this.tables.placas)
                .select('count')
                .limit(1);
            
            if (error) {
                throw error;
            }
            
            this.isConnected = true;
            this.connectionAttempts = 0;
            this.updateConnectionStatus(true);
            console.log('✅ Conectado a Supabase');
            
            return true;
            
        } catch (error) {
            console.error('Error conectando a Supabase:', error);
            this.isConnected = false;
            this.connectionAttempts++;
            
            // Intentar reconectar si no superó el máximo
            if (this.connectionAttempts < this.maxAttempts) {
                console.log(`Reintentando conexión... (${this.connectionAttempts}/${this.maxAttempts})`);
                setTimeout(() => this.init(), 2000);
            } else {
                this.updateConnectionStatus(false);
            }
            
            return false;
        }
    }
    
    updateConnectionStatus(connected) {
        const statusElement = document.getElementById('connectionStatus');
        if (!statusElement) return;
        
        const icon = statusElement.querySelector('i');
        if (connected) {
            icon.style.color = '#00f667ff'; // Verde
            icon.className = 'fas fa-circle';
            statusElement.title = 'Conectado';
        } else {
            icon.style.color = '#b01807ff'; // Rojo
            icon.className = 'fas fa-circle';
            statusElement.title = 'Sin conexión - Modo local';
        }
    }
    
    // ============================================
    // MÉTODOS MEJORADOS PARA LA TABLA DE PLACAS
    // ============================================
    
    async getAllPlacasCompleto() {
        if (!this.isConnected) return [];
        
        try {
            console.log('🔄 Obteniendo TODAS las placas de Supabase...');
            
            // Primero obtenemos el conteo total
            const { count, error: countError } = await this.supabase
                .from(this.tables.placas)
                .select('*', { count: 'exact', head: true });
            
            if (countError) throw countError;
            
            console.log(`📊 Total de registros en Supabase: ${count}`);
            
            // Si hay muchos registros, los obtenemos en lotes
            let todasLasPlacas = [];
            const limitePorLote = 1000;
            const totalLotes = Math.ceil(count / limitePorLote);
            
            for (let i = 0; i < totalLotes; i++) {
                const desde = i * limitePorLote;
                const hasta = Math.min((i + 1) * limitePorLote - 1, count - 1);
                
                console.log(`📦 Obteniendo lote ${i + 1}/${totalLotes} (${desde}-${hasta})`);
                
                const { data, error } = await this.supabase
                    .from(this.tables.placas)
                    .select('*')
                    .order('placa')
                    .range(desde, hasta);
                
                if (error) throw error;
                
                todasLasPlacas = todasLasPlacas.concat(data || []);
            }
            
            console.log(`✅ Obtenidas ${todasLasPlacas.length} placas de Supabase`);
            return todasLasPlacas;
            
        } catch (error) {
            console.error('Error obteniendo todas las placas de Supabase:', error);
            return [];
        }
    }
    
    async getAllPlacas() {
        // Versión más rápida para la tabla principal (solo primeras 1000)
        if (!this.isConnected) return [];
        
        try {
            const { data, error } = await this.supabase
                .from(this.tables.placas)
                .select('*')
                .order('created_at', { ascending: false })
                .limit(1000);
            
            if (error) throw error;
            return data || [];
        } catch (error) {
            console.error('Error obteniendo placas de Supabase:', error);
            return [];
        }
    }
    
    // NUEVO: Método optimizado para búsqueda exacta de placa
    async buscarPlacaExacta(placa) {
        if (!this.isConnected) return null;
        
        try {
            console.log(`🔍 Búsqueda EXACTA en Supabase: "${placa}"`);
            
            // Primero, normaliza la placa para búsqueda flexible
            const placaNormalizada = this.normalizarPlacaParaBusqueda(placa);
            console.log(`🔍 Placa normalizada para búsqueda: "${placaNormalizada}"`);
            
            // Buscar con múltiples criterios
            const consultas = [
                // 1. Búsqueda exacta
                this.supabase
                    .from(this.tables.placas)
                    .select('*')
                    .eq('placa', placa)
                    .limit(1),
                
                // 2. Búsqueda con normalización (elimina guiones)
                this.supabase
                    .from(this.tables.placas)
                    .select('*')
                    .eq('placa', placa.replace(/[-\s]/g, ''))
                    .limit(1),
                
                // 3. Búsqueda ILIKE (case insensitive) con la placa original
                this.supabase
                    .from(this.tables.placas)
                    .select('*')
                    .ilike('placa', `%${placa}%`)
                    .limit(1),
                
                // 4. Búsqueda ILIKE con placa sin guiones
                this.supabase
                    .from(this.tables.placas)
                    .select('*')
                    .ilike('placa', `%${placa.replace(/[-\s]/g, '')}%`)
                    .limit(1)
            ];
            
            // Ejecutar todas las consultas
            for (let i = 0; i < consultas.length; i++) {
                const { data, error } = await consultas[i];
                
                if (error && error.code !== 'PGRST116') { // PGRST116 es "no encontrado"
                    console.error(`Error en consulta ${i + 1}:`, error);
                    continue;
                }
                
                if (data && data.length > 0) {
                    console.log(`✅ Encontrada con criterio ${i + 1}: "${data[0].placa}"`);
                    return data[0];
                }
            }
            
            console.log(`❌ No se encontró placa: "${placa}"`);
            return null;
            
        } catch (error) {
            console.error('Error en búsqueda exacta de placa:', error);
            return null;
        }
    }

    // Agrega este método helper
    normalizarPlacaParaBusqueda(placa) {
        if (!placa) return '';
        return placa
            .toUpperCase()
            .replace(/[^A-Z0-9]/g, '')  // Elimina todo excepto letras y números
            .trim();
    }
    
    async searchPlacasFlexible(searchTerm) {
        if (!this.isConnected) return [];
        if (!searchTerm) return this.getAllPlacasCompleto();
        
        try {
            console.log(`🔍 Búsqueda FLEXIBLE en Supabase: "${searchTerm}"`);
            
            const { data, error } = await this.supabase
                .from(this.tables.placas)
                .select('*')
                .or(`placa.ilike.%${searchTerm}%,empresa.ilike.%${searchTerm}%,asociacion.ilike.%${searchTerm}%`)
                .order('placa')
                .limit(1000);
            
            if (error) throw error;
            
            console.log(`✅ Encontradas ${data?.length || 0} placas con búsqueda flexible`);
            return data || [];
            
        } catch (error) {
            console.error('Error buscando placas en Supabase:', error);
            return [];
        }
    }
    
    async searchPlacas(searchTerm) {
        // Método legacy para compatibilidad
        return this.searchPlacasFlexible(searchTerm);
    }
    
    async insertPlaca(placaData) {
        if (!this.isConnected) return null;
        
        try {
            const { data, error } = await this.supabase
                .from(this.tables.placas)
                .insert([{
                    placa: placaData.placa,
                    empresa: placaData.empresa || '',
                    asociacion: placaData.asociacion || '',
                    usuario_registro: placaData.usuario || 'Sistema',
                    created_at: new Date().toISOString()
                }])
                .select()
                .single();
            
            if (error) throw error;
            return data;
        } catch (error) {
            console.error('Error insertando placa en Supabase:', error);
            return null;
        }
    }
    
    async updatePlaca(id, placaData) {
        if (!this.isConnected) return false;
        
        try {
            const { error } = await this.supabase
                .from(this.tables.placas)
                .update({
                    placa: placaData.placa,
                    empresa: placaData.empresa || '',
                    asociacion: placaData.asociacion || '',
                    updated_at: new Date().toISOString()
                })
                .eq('id', id);
            
            if (error) throw error;
            return true;
        } catch (error) {
            console.error('Error actualizando placa en Supabase:', error);
            return false;
        }
    }
    
    async deletePlaca(id) {
        if (!this.isConnected) return false;
        
        try {
            const { error } = await this.supabase
                .from(this.tables.placas)
                .delete()
                .eq('id', id);
            
            if (error) throw error;
            return true;
        } catch (error) {
            console.error('Error eliminando placa de Supabase:', error);
            return false;
        }
    }
    
    async deleteAllPlacas() {
        if (!this.isConnected) return false;
        
        try {
            const { error } = await this.supabase
                .from(this.tables.placas)
                .delete()
                .neq('id', 0); // Elimina todos
            
            if (error) throw error;
            return true;
        } catch (error) {
            console.error('Error eliminando todas las placas de Supabase:', error);
            return false;
        }
    }
    
    async checkPlacaExists(placa) {
        if (!this.isConnected) return false;
        
        try {
            const placaEncontrada = await this.buscarPlacaExacta(placa);
            return placaEncontrada !== null;
        } catch (error) {
            console.error('Error verificando placa en Supabase:', error);
            return false;
        }
    }
    




    // En la clase SupabaseManager, agrega este método optimizado:

    async buscarPlacaOptimizada(placa) {
        if (!this.isConnected) return null;
        
        try {
            console.log(`⚡ Búsqueda OPTIMIZADA en Supabase: "${placa}"`);
            
            // Generar variantes de búsqueda
            const variantes = this.generarVariantesBusquedaOptimizada(placa);
            console.log(`🔍 Variantes generadas:`, variantes);
            
            // Buscar cada variante EXACTA en paralelo
            const consultasPromesas = variantes.map(variante => 
                this.supabase
                    .from(this.tables.placas)
                    .select('*')
                    .eq('placa', variante)
                    .limit(1)
                    .single()
            );
            
            // Ejecutar todas las consultas
            const resultados = await Promise.allSettled(consultasPromesas);
            
            // Buscar el primer resultado exitoso
            for (let i = 0; i < resultados.length; i++) {
                const resultado = resultados[i];
                
                if (resultado.status === 'fulfilled') {
                    const { data, error } = resultado.value;
                    
                    // Si hay error pero no es "no encontrado", continuar
                    if (error && error.code !== 'PGRST116') {
                        console.error(`Error en variante ${variantes[i]}:`, error);
                        continue;
                    }
                    
                    if (data) {
                        console.log(`✅ Encontrada con variante "${variantes[i]}": "${data.placa}"`);
                        return data;
                    }
                }
            }
            
            console.log(`❌ No se encontró placa después de probar ${variantes.length} variantes`);
            return null;
            
        } catch (error) {
            console.error('Error en búsqueda optimizada:', error);
            return null;
        }
    }

    generarVariantesBusquedaOptimizada(placa) {
        const variantes = new Set();
        
        if (!placa || typeof placa !== 'string') return Array.from(variantes);
        
        // 1. Original en mayúsculas
        variantes.add(placa.toUpperCase().trim());
        
        // 2. Sin guiones
        variantes.add(placa.toUpperCase().replace(/[-\s]/g, ''));
        
        // 3. Con guión inteligente (números-letras)
        const sinGuion = placa.toUpperCase().replace(/[-\s]/g, '');
        if (sinGuion.length >= 4) {
            // Buscar transición número->letra
            const match = sinGuion.match(/^(\d+)([A-Z]+)/);
            if (match) {
                const numeros = match[1];
                const letras = match[2];
                variantes.add(`${numeros}-${letras}`);
            }
        }
        
        // 4. Si tiene guión, también sin él
        if (placa.includes('-')) {
            variantes.add(placa.toUpperCase().replace(/-/g, ''));
        }
        
        return Array.from(variantes).filter(v => v && v.length > 0);
    }

    // ============================================
    // MÉTODOS PARA OBSERVACIONES COMPARTIDAS
    // ============================================
    
    async getAllObservaciones() {
        if (!this.isConnected) return [];
        
        try {
            const { data, error } = await this.supabase
                .from(this.tables.observaciones)
                .select('*')
                .order('created_at', { ascending: false });
            
            if (error) throw error;
            return data || [];
        } catch (error) {
            console.error('Error obteniendo observaciones de Supabase:', error);
            return [];
        }
    }
    
    async insertObservacion(observacionData) {
        if (!this.isConnected) return null;
        
        try {
            const { data, error } = await this.supabase
                .from(this.tables.observaciones)
                .insert([{
                    nro_placa: observacionData.nroPlaca,
                    numero_tramite: observacionData.numeroTramite || '',
                    observacion: observacionData.observacion,
                    usuario_registro: observacionData.usuarioRegistro || 'Anónimo',
                    created_at: new Date().toISOString()
                }])
                .select()
                .single();
            
            if (error) throw error;
            return data;
        } catch (error) {
            console.error('Error insertando observación en Supabase:', error);
            return null;
        }
    }
    
    async deleteObservacion(id) {
        if (!this.isConnected) return false;
        
        try {
            const { error } = await this.supabase
                .from(this.tables.observaciones)
                .delete()
                .eq('id', id);
            
            if (error) throw error;
            return true;
        } catch (error) {
            console.error('Error eliminando observación de Supabase:', error);
            return false;
        }
    }
    
    async deleteAllObservaciones() {
        if (!this.isConnected) return false;
        
        try {
            const { error } = await this.supabase
                .from(this.tables.observaciones)
                .delete()
                .neq('id', 0);
            
            if (error) throw error;
            return true;
        } catch (error) {
            console.error('Error eliminando todas las observaciones de Supabase:', error);
            return false;
        }
    }
    
    // ============================================
    // MÉTODOS DE SINCRONIZACIÓN
    // ============================================
    
    async syncLocalToSupabase(localData, tableName) {
        if (!this.isConnected) return { success: false, message: 'Sin conexión a Supabase' };
        
        try {
            // Eliminar todos los datos existentes
            await this.supabase
                .from(tableName)
                .delete()
                .neq('id', 0);
            
            // Insertar datos locales
            const { error } = await this.supabase
                .from(tableName)
                .insert(localData);
            
            if (error) throw error;
            
            return { 
                success: true, 
                message: `Sincronizado: ${localData.length} registros a Supabase` 
            };
            
        } catch (error) {
            console.error('Error sincronizando con Supabase:', error);
            return { success: false, message: error.message };
        }
    }
    
    async syncFromSupabase(tableName) {
        if (!this.isConnected) return { success: false, message: 'Sin conexión a Supabase', data: [] };
        
        try {
            const { data, error } = await this.supabase
                .from(tableName)
                .select('*')
                .order('created_at', { ascending: false })
                .limit(5000); // Limitar para no sobrecargar
            
            if (error) throw error;
            
            return { 
                success: true, 
                message: `Descargado: ${data.length} registros de Supabase`,
                data: data || []
            };
            
        } catch (error) {
            console.error('Error descargando de Supabase:', error);
            return { success: false, message: error.message, data: [] };
        }
    }
    
    // ============================================
    // MÉTODOS PARA USUARIOS ACTIVOS
    // ============================================
    
    async updateActiveUser(username, action = 'login') {
        if (!this.isConnected) return;
        
        try {
            if (action === 'login') {
                await this.supabase
                    .from(this.tables.usuarios)
                    .upsert({
                        username: username,
                        last_active: new Date().toISOString(),
                        status: 'activo'
                    });
            } else {
                await this.supabase
                    .from(this.tables.usuarios)
                    .update({ status: 'inactivo' })
                    .eq('username', username);
            }
        } catch (error) {
            console.error('Error actualizando usuario activo:', error);
        }
    }
    
    async getActiveUsers() {
        if (!this.isConnected) return [];
        
        try {
            const { data, error } = await this.supabase
                .from(this.tables.usuarios)
                .select('username')
                .eq('status', 'activo')
                .gte('last_active', new Date(Date.now() - 5 * 60000).toISOString()); // Últimos 5 minutos
            
            if (error) throw error;
            return data || [];
        } catch (error) {
            console.error('Error obteniendo usuarios activos:', error);
            return [];
        }
    }
}

// Exportar para uso global
window.SupabaseManager = SupabaseManager;