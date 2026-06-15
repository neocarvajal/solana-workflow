import type { NextApiRequest, NextApiResponse } from 'next';
import { createClient } from '@supabase/supabase-js';

// Inicialización del cliente Supabase con privilegios de administrador (Service Role)
// Esta clave permite realizar operaciones de escritura ignorando las políticas RLS.
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  // 1. Validación de Seguridad: Verificar que la petición viene de QuickNode
  const signature = req.headers['x-qn-signature'];
  const expectedToken = process.env.QUICKNODE_SECURITY_TOKEN;

  if (!signature || signature !== expectedToken) {
    console.error('Intento de acceso no autorizado detectado');
    return res.status(401).json({ error: 'Acceso no autorizado: Token inválido' });
  }

  // 2. Validación de Método: Solo permitimos POST
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  // 3. Extracción de datos del payload de QuickNode
  const { eventType, account, amount } = req.body;

  if (!account || !eventType) {
    return res.status(400).json({ error: 'Missing required fields: account or eventType' });
  }

  // 4. Lógica de Negocio: Si detectamos una transferencia, registramos la acción
  if (eventType === 'transfer') {
    try {
      console.log(`Transferencia detectada en ${account}. Registrando en Supabase...`);

      const { data, error } = await supabase
        .from('pending_actions')
        .insert([
          { 
            wallet_address: account, 
            action: 'swap_sol_to_usdc', 
            status: 'pending',
            amount: amount || '0', // Manejo de caso por si el monto no viene definido
            created_at: new Date().toISOString()
          }
        ]);

      if (error) {
        console.error('Error al insertar en Supabase:', error);
        throw error;
      }

      return res.status(200).json({ 
        message: 'Evento guardado exitosamente. Pendiente de firma en el frontend.' 
      });

    } catch (e) {
      console.error('Error interno procesando el webhook:', e);
      return res.status(500).json({ error: 'Error interno de base de datos' });
    }
  }

  // Si el evento no es de tipo 'transfer', lo ignoramos
  return res.status(200).json({ message: 'Evento recibido pero no procesado', eventType });
}